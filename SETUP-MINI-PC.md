# Ghid configurare Mini PC nou — BancaSign

## Ce se schimbă de la un mini PC la altul
- **agencyId** — ID-ul agenției din baza de date
- **tvId** — numele TV-ului (ex: `Tv Vitrina`, `TV-1`, `TV-2`)

Spune-mi numele agenției și eu găsesc ID-ul și configurez tot.

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

## Pași configurare mini PC nou (o singură dată)

### 1. Instalare software (dacă nu e deja instalat)
```
- Node.js v20+: https://nodejs.org
- Git: https://git-scm.com
- pm2: npm install -g pm2
```

### 2. Clonare repo
```powershell
cd C:\Users\admin
git clone https://github.com/MRF823/Digital-Signage.git digital-signage
```

### 3. Build player
```powershell
cd C:\Users\admin\digital-signage\player
npm install
npm run build
```

### 4. Pornire server player cu pm2
```powershell
cd C:\Users\admin\digital-signage\player
pm2 start node --name signage-player -- start.cjs
pm2 save
pm2 startup
```
> Rulează comanda afișată de `pm2 startup` ca Administrator.

### 5. Configurare kiosk (editează `start-kiosk.bat`)

Fișierul se află la `C:\Users\admin\digital-signage\start-kiosk.bat`.

Schimbă **agencyId** și **tvId** cu valorile corecte:
```bat
@echo off
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk "http://localhost:5176?agencyId=13&tvId=Tv%%20Vitrina" --edge-kiosk-type=fullscreen --autoplay-policy=no-user-gesture-required
```

> **Atenție:** spațiile în tvId se scriu ca `%%20` în fișierul .bat (ex: `Tv%%20Vitrina`)

### 6. Pornire automată kiosk la boot

1. Apasă `Win + R` → scrie `shell:startup` → Enter
2. Pune un shortcut către `start-kiosk.bat` în folderul care se deschide

---

## Actualizare conținut de la distanță

1. Intră pe dashboard: `http://92.5.28.167:4000`
2. Mergi la **Conținut** → Upload fișier video/imagine
3. Mergi la **Agenții** → selectează agenția → editează playlist
4. Conținutul apare automat pe TV în câteva secunde

---

## Dacă TV-ul apare Offline în dashboard

Pe mini PC, deschide PowerShell:
```powershell
pm2 list
```
Toate 4 procese trebuie să fie `online`. Dacă nu:
```powershell
pm2 resurrect
```

---

## Actualizare player (când există cod nou)

```powershell
cd C:\Users\admin\digital-signage\player
git pull
npm run build
pm2 restart signage-player
```
