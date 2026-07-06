@echo off
echo ========================================
echo  Digital Signage - Setup Auto-Update
echo ========================================
echo.

:: Creeaza scriptul de update
echo @echo off > C:\signage\auto-update.bat
echo cd C:\signage >> C:\signage\auto-update.bat
echo. >> C:\signage\auto-update.bat
echo :: Verifica daca sunt modificari pe GitHub >> C:\signage\auto-update.bat
echo git fetch origin >> C:\signage\auto-update.bat
echo. >> C:\signage\auto-update.bat
echo :: Compara local cu remote >> C:\signage\auto-update.bat
echo for /f %%%%i in ('git rev-parse HEAD') do set LOCAL=%%%%i >> C:\signage\auto-update.bat
echo for /f %%%%i in ('git rev-parse origin/main') do set REMOTE=%%%%i >> C:\signage\auto-update.bat
echo. >> C:\signage\auto-update.bat
echo if "%%LOCAL%%"=="%%REMOTE%%" ( >> C:\signage\auto-update.bat
echo     exit /b 0 >> C:\signage\auto-update.bat
echo ^) >> C:\signage\auto-update.bat
echo. >> C:\signage\auto-update.bat
echo :: Sunt modificari - face update >> C:\signage\auto-update.bat
echo git pull origin main >> C:\signage\auto-update.bat
echo cd C:\signage\player >> C:\signage\auto-update.bat
echo npm install >> C:\signage\auto-update.bat
echo npm run build >> C:\signage\auto-update.bat
echo cd C:\signage\server >> C:\signage\auto-update.bat
echo npm install >> C:\signage\auto-update.bat
echo pm2 restart signage-server >> C:\signage\auto-update.bat

:: Adauga Task Scheduler la 02:00 in fiecare noapte
echo.
echo Configurez auto-update la 02:00 in fiecare noapte...
schtasks /create /tn "SignageAutoUpdate" /tr "C:\signage\auto-update.bat" /sc daily /st 02:00 /rl highest /f

if %errorlevel% neq 0 (
    echo EROARE! Incearca sa rulezi ca Administrator.
    pause
    exit /b 1
)

echo.
echo [OK] Auto-update configurat la 02:00 in fiecare noapte
echo [OK] Se actualizeaza DOAR daca sunt modificari pe GitHub
echo.
echo ========================================
echo  TOATE SCRIPTURILE SUNT CONFIGURATE!
echo.
echo  Ordine instalare:
echo  1-install.bat       - O singura data la inceput
echo  2-build-player.bat  - O singura data la inceput
echo  3-start-server.bat  - O singura data la inceput
echo  4-setup-kiosk.bat   - O singura data la inceput
echo  5-setup-autoupdate  - O singura data la inceput
echo.
echo  Dupa asta mini PC-ul se gestioneaza singur!
echo ========================================
pause
