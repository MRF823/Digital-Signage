# Ghid complet configurare Mini PC nou — BancaSign

## Ce se schimbă de la un mini PC la altul
- **agencyId** — ID-ul agenției din baza de date
- **tvId** — numele TV-ului (ex: `Tv Vitrina`, `TV-1`, `TV-2`)

> Spune-mi numele agenției și eu găsesc ID-ul și configurez tot.

---

## Tabel agenții și ID-uri

| ID | Agenție | TV-uri |
|----|---------|--------|
| 1  | Agenția Centrală | TV-1, TV-2 |
| 2  | Agenția Floreasca | TV-1, TV-2 |
| 3  | Agenția Cluj-Napoca | TV-1, TV-2 |
| 4  | Agenția Timișoara | TV-1, TV-2 |
| 5  | Agenția Iași | TV-1, TV-2 |
| 6  | Agenția Brașov | TV-1, TV-2 |
| 7  | Agenția Constanța | TV-1, TV-2 |
| 8  | Agenția Sibiu | TV-1, TV-2 |
| 9  | Agenția Oradea | TV-1, TV-2 |
| 10 | Agenția Craiova | TV-1, TV-2 |
| 13 | Agentia Ana Tower | Tv Vitrina |

---

## PASUL 1 — Instalare software

Instalează în această ordine:

### 1.1 Node.js
- Descarcă de la: https://nodejs.org
- Alege versiunea **LTS**
- Instalează cu opțiunile implicite (Next → Next → Finish)
- Verificare: deschide PowerShell și scrie `node -v` → trebuie să apară `v20.x.x`

### 1.2 Git
- Descarcă de la: https://git-scm.com
- Instalează cu opțiunile implicite
- Verificare: în PowerShell scrie `git --version`

### 1.3 pm2 și pornire automată
Deschide PowerShell **ca Administrator** și rulează:
```powershell
npm install -g pm2
npm install -g pm2-windows-startup
pm2-windows-startup install
```

---

## PASUL 2 — Descărcare și configurare player

```powershell
cd C:\Users\admin
git clone https://github.com/MRF823/Digital-Signage.git digital-signage
cd digital-signage\player
npm install
npm run build
```

---

## PASUL 3 — Pornire server player

```powershell
cd C:\Users\admin\digital-signage\player
pm2 start node --name signage-player -- start.cjs
pm2 save
```

Verificare — toate procesele trebuie să fie `online`:
```powershell
pm2 list
```

---

## PASUL 4 — Configurare kiosk (agencyId și tvId)

Deschide fișierul `C:\Users\admin\digital-signage\start-kiosk.bat` cu Notepad și modifică **agencyId** și **tvId**:

```bat
@echo off
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk "http://localhost:5176?agencyId=13&tvId=Tv%%20Vitrina" --edge-kiosk-type=fullscreen --autoplay-policy=no-user-gesture-required
```

> **Atenție:** spațiile în tvId se scriu ca `%%20` (ex: `Tv Vitrina` → `Tv%%20Vitrina`)

---

## PASUL 5 — Pornire automată la boot Windows

### 5.1 Shortcut kiosk la pornire
1. Apasă `Win + R` → scrie `shell:startup` → Enter
2. Se deschide folderul de startup
3. Click dreapta pe `C:\Users\admin\digital-signage\start-kiosk.bat` → `Send to` → `Desktop (create shortcut)`
4. Mută shortcut-ul creat pe Desktop în folderul de startup deschis la pasul 2

### 5.2 Testare pornire completă
1. Repornește mini PC-ul
2. Edge trebuie să pornească automat fullscreen cu videoclipul
3. În dashboard (`http://92.5.28.167:4000`) TV-ul trebuie să apară cu punct **verde**

---

## Actualizare conținut de la distanță

1. Intră pe dashboard: `http://92.5.28.167:4000`
2. **Conținut** → Upload fișier video sau imagine
3. **Agenții** → selectează agenția → editează playlist → salvează
4. Conținutul apare automat pe TV în câteva secunde

---

## Dacă TV-ul apare Offline în dashboard

Pe mini PC, deschide PowerShell:
```powershell
pm2 list
```
Dacă vreun proces nu e `online`:
```powershell
pm2 resurrect
```
Dacă nu ajută:
```powershell
cd C:\Users\admin\digital-signage\player
pm2 restart signage-player
```

---

## Actualizare player (când există cod nou)

```powershell
cd C:\Users\admin\digital-signage\player
git pull
npm run build
pm2 restart signage-player
```

---

## Ieșire din modul kiosk (dacă e nevoie)

Apasă `Alt + F4` pentru a închide Edge kiosk.

---

## Rezumat ordine pași pentru mini PC nou

```
1. Instalează Node.js
2. Instalează Git
3. Instalează pm2 (ca Administrator)
4. git clone repo
5. npm install + npm run build
6. pm2 start + pm2 save
7. Editează start-kiosk.bat cu agencyId și tvId corecte
8. Pune shortcut în shell:startup
9. Repornește PC-ul și verifică
```
