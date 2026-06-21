# Digital Signage — Design Spec
**Data:** 2026-06-21
**Proiect:** Sistem de afișaj digital pentru agenții bancare

---

## Contextul proiectului

Sistem intern pentru o bancă comercială cu 10 agenții, fiecare cu 2 TV-uri conectate la WiFi. Un admin central încarcă conținut de marketing (video-uri MP4 și imagini) și îl distribuie selectiv pe agenții. TV-urile rulează pe Raspberry Pi 4 cu Chromium în mod kiosk.

---

## Arhitectura generală

Trei componente independente care comunică prin rețea:

```
[Admin Dashboard]  ←→ REST API  ←→  [Backend Server]  ←→ WebSocket  ←→  [Player pe Pi]
     React                           Node.js + SQLite                        React
```

### Fluxul principal
1. Admin uploadează fișier → stocat pe server
2. Admin asignează fișier la o agenție → server creează playlist
3. Server trimite playlist nou prin WebSocket la Pi-urile agenției respective
4. Pi descarcă fișierele lipsă, le cachează local, pornește redarea imediat
5. Dacă WiFi cade → Pi continuă din cache local fără întrerupere

---

## Componenta 1: Backend Server

**Tehnologii:** Node.js, Express, better-sqlite3, ws (WebSocket), multer (upload)

### REST API

| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| POST | `/api/media/upload` | Uploadează fișier (video/imagine) |
| GET | `/api/media` | Listă toate fișierele din librărie |
| DELETE | `/api/media/:id` | Șterge un fișier |
| GET | `/api/agencies` | Listă agenții cu statusul TV-urilor |
| POST | `/api/agencies/:id/playlist` | Setează playlistul unei agenții |
| GET | `/api/agencies/:id/playlist` | Returnează playlistul curent |
| GET | `/api/media/:filename` | Servire fișier media (pentru Pi) |

### WebSocket
- Serverul menține o conexiune deschisă cu fiecare Pi
- La conectare, Pi se identifică cu `{ type: "register", agencyId: "cluj", tvId: "tv1" }`
- La schimbarea playlistului, serverul trimite: `{ type: "playlist_update", items: [...] }`
- Pi-urile trimit heartbeat la fiecare 30s: `{ type: "ping" }` → server răspunde `{ type: "pong" }`

### Baza de date (SQLite)

**Tabela `media`**
```sql
id, filename, original_name, type (video|image), size_bytes, duration_seconds, created_at
```

**Tabela `agencies`**
```sql
id, name, city, created_at
```

**Tabela `tvs`**
```sql
id, agency_id, label, last_seen_at, ip_address
```

**Tabela `playlist_items`**
```sql
id, agency_id, media_id, position, display_duration_seconds
-- display_duration_seconds: null pentru video (folosește durata naturală), valoare în secunde pentru imagini (implicit 10)
```

### Stocare fișiere
- Director local `/uploads/` pe server
- Fișierele video se servesc cu suport pentru `Range` headers (streaming corect în browser)
- Imagini afișate pentru durata configurată (implicit 10 secunde)

---

## Componenta 2: Admin Dashboard

**Tehnologii:** React 18, Vite, TailwindCSS, Axios

### Pagini

**Pagina „Conținut"** (implicită)
- Zona de upload cu drag & drop (librărie Dropzone)
- Progress bar în timpul uploadului
- Grilă cu toate fișierele: thumbnail, nume, durată, tip
- Buton de ștergere per fișier

**Pagina „Agenții"**
- Card per agenție cu:
  - Statusul TV-urilor (online/offline, ultima conexiune)
  - Playlistul curent (fișiere în ordine)
  - Buton „Modifică playlist" → modal cu drag & drop pentru reordonare și adăugare/eliminare fișiere
- Modificarea playlistului se trimite instant la TV-urile online

**Pagina „TV-uri"**
- Tabel cu toate cele 20 de TV-uri
- Status (online/offline), agenția, IP, ultima activitate

### Autentificare
- Login simplu cu username/parolă (un singur cont admin)
- JWT token stocat în localStorage, expiră după 24h
- Toate request-urile API necesită header `Authorization: Bearer <token>`

---

## Componenta 3: Player (Raspberry Pi)

**Tehnologii:** React 18, Vite, serviciu systemd

### Configurare Pi
- La primul boot, Pi citește un fișier de configurare local (`/etc/signage/config.json`) care conține:
  - URL-ul serverului
  - ID-ul agenției
  - ID-ul TV-ului
- Chromium pornește automat la boot în kiosk mode pe `http://localhost:3000`

### Logica de redare
1. La start, Player încarcă playlist-ul salvat local (dacă există) și începe redarea
2. Se conectează la server prin WebSocket
3. La primirea unui `playlist_update`:
   - Descarcă fișierele noi care lipsesc din cache local
   - Actualizează playlist-ul și trece la el după ce fișierul curent se termină
4. Redare în loop infinit: video-uri la durata lor naturală, imagini 10 secunde (configurabil)
5. Cache local în `/home/pi/signage-cache/` — fișierele vechi (neincluse în playlist) se șterg automat

### Reziliență offline
- Dacă conexiunea WebSocket cade, Player încearcă reconectare la fiecare 10 secunde
- Redarea continuă neîntrerupt din cache local
- La reconectare, cere playlist-ul curent și sincronizează

---

## Deployment

### Server
- VPS Linux (Ubuntu 22.04), minim 2 vCPU / 4GB RAM / 100GB SSD
- Rulat cu PM2 pentru restart automat
- Nginx ca reverse proxy (HTTPS cu Let's Encrypt)
- Recomandat: Hetzner CX22 (~5€/lună) sau server intern al băncii

### Raspberry Pi (per TV)
- Raspberry Pi 4, 4GB RAM, card SD 32GB
- Raspberry Pi OS Lite + Chromium
- Player instalat ca serviciu systemd (pornire automată la curent)
- Actualizări prin `git pull` + restart serviciu

---

## Securitate

- HTTPS obligatoriu pe server (Nginx + Let's Encrypt)
- WebSocket prin WSS (WebSocket Secure)
- Upload limitat la tipuri permise: `.mp4`, `.jpg`, `.jpeg`, `.png`
- Upload limitat la 500MB per fișier
- Rate limiting pe API (max 100 req/min per IP)
- Parola admin hashată cu bcrypt

---

## Ce NU este inclus în v1

- Programare pe ore/zile (scheduler)
- Multiple conturi admin
- Statistici de vizualizare
- Conținut diferit per TV în aceeași agenție (toată agenția primește același playlist)
- Aplicație mobilă

Acestea pot fi adăugate în versiuni ulterioare.

---

## Estimare complexitate

| Componentă | Efort estimat |
|------------|---------------|
| Backend (API + WebSocket) | 3-4 zile |
| Admin Dashboard | 3-4 zile |
| Player (React + kiosk setup) | 2-3 zile |
| Deployment + configurare Pi | 1-2 zile |
| **Total** | **~2 săptămâni** |
