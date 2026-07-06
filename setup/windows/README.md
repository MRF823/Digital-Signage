# Setup Windows — Digital Signage

## Înainte de a începe, instalează:
1. **Node.js LTS** — https://nodejs.org
2. **Git** — https://git-scm.com
3. **Google Chrome** — https://www.google.com/chrome/

## Rulează scripturile în ordine (click dreapta → Run as Administrator):

| Script | Ce face | Când |
|---|---|---|
| `1-install.bat` | Clonează proiectul, instalează dependințele | O singură dată |
| `2-build-player.bat` | Construiește player-ul pentru producție | O singură dată (și după update manual) |
| `3-start-server.bat` | Pornește serverul + autostart la boot | O singură dată |
| `4-setup-kiosk.bat` | Chrome full screen la login automat | O singură dată |
| `5-setup-autoupdate.bat` | Update automat la 02:00 noaptea | O singură dată |

## După instalare:
- Mini PC-ul se gestionează singur
- Serverul pornește automat la fiecare boot
- Chrome-ul se deschide automat la login în full screen
- La 02:00 noaptea verifică GitHub — dacă sunt modificări, se actualizează singur

## Notă:
- Toate scripturile trebuie rulate ca **Administrator** (click dreapta → Run as Administrator)
- Proiectul se instalează în `C:\signage\`
- Serverul rulează pe portul **4000**, player-ul pe portul **5176**
