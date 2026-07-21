# Ghid complet configurare Mini PC nou — BancaSign

## Ce se schimbă de la un mini PC la altul
- **agencyId** — ID-ul agenției din baza de date
- **tvId** — numele TV-ului (ex: `Tv Vitrina`, `TV-1`, `TV-2`)

> Spune-mi numele agenției și eu găsesc ID-ul și configurez tot.

---

## Tabel agenții și ID-uri

| ID | Agenție | TV-uri |
|----|---------|--------|
| 13 | Agentia Ana Tower | Tv Vitrina |
| _  | _(se adaugă din dashboard)_ | |

> ID-ul real se vede în dashboard la **Agenții → ID:xx** de lângă numele agenției.

---

## PASUL 1 — Instalare software

Instalează în această ordine (PowerShell normal, nu Administrator):

### 1.1 Node.js
- Descarcă de la: https://nodejs.org → versiunea **LTS**
- Instalează cu opțiunile implicite (Next → Next → Finish)
- Verificare: `node -v` → trebuie să apară `v20.x.x`

### 1.2 Git
- Descarcă de la: https://git-scm.com
- Instalează cu opțiunile implicite
- Verificare: `git --version`

### 1.3 pm2 și pornire automată Windows
Deschide PowerShell **ca Administrator**:
```powershell
npm install -g pm2
npm install -g pm2-windows-startup
pm2-windows-startup install
```

---

## PASUL 2 — Descărcare repo și build player

```powershell
cd C:\Users\admin
git clone https://github.com/MRF823/Digital-Signage.git digital-signage
cd digital-signage\player
npm install
npm run build
```

---

## PASUL 3 — Pornire procese pm2

```powershell
cd C:\Users\admin\digital-signage\player
pm2 start node --name signage-player -- start.cjs
pm2 save
```

Verificare — procesul trebuie să fie `online`:
```powershell
pm2 list
```

---

## PASUL 4 — Configurare kiosk (agencyId și tvId)

Deschide `C:\Users\admin\digital-signage\start-kiosk.bat` cu Notepad și modifică **agencyId** și **tvId**:

```bat
@echo off
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk "http://localhost:5176?agencyId=13&tvId=Tv%%20Vitrina" --edge-kiosk-type=fullscreen --autoplay-policy=no-user-gesture-required
```

> **Atenție:** spațiile în tvId se scriu ca `%%20` (ex: `Tv Vitrina` → `Tv%%20Vitrina`)

---

## PASUL 5 — Pornire automată Edge la boot

1. Apasă `Win + R` → scrie `shell:startup` → Enter
2. Se deschide folderul de startup
3. Click dreapta pe `C:\Users\admin\digital-signage\start-kiosk.bat` → `Send to` → `Desktop (create shortcut)`
4. Mută shortcut-ul în folderul de startup deschis la pasul 2

---

## PASUL 6 — Update agent (actualizare automată și din dashboard)

Update agent-ul este un proces pm2 care ascultă comenzi de la VPS și actualizează automat mini PC-ul.

```powershell
cd C:\Users\admin\digital-signage\server
pm2 start update-agent.cjs --name signage-update-agent
pm2 save
```

---

## PASUL 7 — Auto-update la ora 00:00 (Task Scheduler)

Rulează **ca Administrator**:
```powershell
cmd /c "C:\Users\admin\digital-signage\setup\windows\6-setup-autoupdate.bat"
```

Dacă merge: `[OK] Task Scheduler configurat cu succes!`

---

## PASUL 8 — Verificare finală

Repornește mini PC-ul și verifică:
1. `pm2 list` → toate procesele `online`: `signage-player` + `signage-update-agent`
2. Edge pornește automat fullscreen cu videoclipul
3. În dashboard → TV-ul apare cu punct **verde**
4. Numele agenției apare în colțul stânga sus pe TV (dacă e bifat în dashboard)

---

## Cum funcționează sistemul

```
Dashboard (browser tu) → VPS (92.5.28.167:4000) → WebSocket → Mini PC player (localhost:5176)
```

- **Conținut nou** → Agenții → editează playlist → apare pe TV în câteva secunde
- **Actualizare manuală** → Overview → buton "Actualizează mini PC-uri" → mini PC face git pull + build + restart în ~2 min
- **Actualizare automată** → în fiecare noapte la 00:00 mini PC-ul se actualizează singur
- **Offline** → playerul redă din cache local (IndexedDB) chiar dacă pică internetul

---

## Opțiuni afișare pe TV (din dashboard → Agenții)

Per agenție poți bifa/debifa:
- **Afișează numele agenției pe TV** — apare în colțul stânga sus (fundal semi-transparent)
- **Afișează eticheta Player** — apare sub numele agenției (util la debugging)

Schimbarea e instantanee — apare pe TV fără rebuild.

---

## Dacă TV-ul apare Offline în dashboard

```powershell
pm2 list
```
Dacă vreun proces nu e `online`:
```powershell
pm2 resurrect
```
Dacă nu ajută:
```powershell
pm2 restart signage-player
pm2 restart signage-update-agent
```

---

## Ieșire din modul kiosk

Apasă `Alt + F4` pentru a închide Edge kiosk.

---

## Rezumat ordine pași — mini PC nou

```
1. Instalează Node.js (nodejs.org → LTS)
2. Instalează Git (git-scm.com)
3. Instalează pm2 ca Administrator
4. git clone repo
5. npm install + npm run build (în player/)
6. pm2 start signage-player + pm2 save
7. Editează start-kiosk.bat cu agencyId și tvId corecte
8. Pune shortcut în shell:startup
9. pm2 start update-agent.cjs --name signage-update-agent + pm2 save
10. Rulează 6-setup-autoupdate.bat ca Administrator (Task Scheduler 00:00)
11. Repornește PC-ul și verifică în dashboard că TV-ul e verde
```
