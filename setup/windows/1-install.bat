@echo off
echo ========================================
echo  Digital Signage - Instalare initiala
echo ========================================
echo.

:: Verifica daca Node.js e instalat
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo EROARE: Node.js nu este instalat!
    echo Descarca de la: https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js instalat:
node --version

:: Verifica daca Git e instalat
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo EROARE: Git nu este instalat!
    echo Descarca de la: https://git-scm.com
    pause
    exit /b 1
)
echo [OK] Git instalat:
git --version

:: Instaleaza pm2 global
echo.
echo Instalez pm2...
npm install -g pm2
npm install -g pm2-windows-startup
echo [OK] pm2 instalat

:: Cloneaza repo daca nu exista
if not exist "C:\signage" (
    echo.
    echo Clonez proiectul...
    git clone https://github.com/MRF823/Digital-Signage.git C:\signage
    echo [OK] Proiect clonat in C:\signage
) else (
    echo [OK] Proiectul exista deja in C:\signage
)

:: Instaleaza dependintele serverului
echo.
echo Instalez dependintele serverului...
cd C:\signage\server
npm install
echo [OK] Dependinte server instalate

:: Instaleaza dependintele player-ului
echo.
echo Instalez dependintele player-ului...
cd C:\signage\player
npm install
echo [OK] Dependinte player instalate

echo.
echo ========================================
echo  Instalare completa!
echo  Urmatorul pas: ruleaza 2-build-player.bat
echo ========================================
pause
