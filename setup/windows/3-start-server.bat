@echo off
echo ========================================
echo  Digital Signage - Pornire Server
echo ========================================
echo.

cd C:\signage\server

:: Opreste procesul vechi daca exista
pm2 stop signage-server >nul 2>&1
pm2 delete signage-server >nul 2>&1

:: Porneste serverul cu pm2
echo Pornesc serverul...
pm2 start src/index.js --name signage-server

:: Seteaza pm2 sa porneasca automat la boot Windows
pm2-startup install

:: Salveaza configuratia pm2
pm2 save

echo.
echo [OK] Serverul ruleaza pe portul 4000
echo [OK] Se va reporni automat la fiecare boot
echo.
pm2 status
echo.
echo Urmatorul pas: ruleaza 4-setup-kiosk.bat
pause
