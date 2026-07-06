@echo off
echo ========================================
echo  Digital Signage - Build Player
echo ========================================
echo.

cd C:\signage\player

echo Construiesc player-ul pentru productie...
npm run build

if %errorlevel% neq 0 (
    echo EROARE la build! Verifica erorile de mai sus.
    pause
    exit /b 1
)

echo.
echo [OK] Build complet! Fisierele sunt in C:\signage\player\dist
echo.
echo Urmatorul pas: ruleaza 3-start-server.bat
pause
