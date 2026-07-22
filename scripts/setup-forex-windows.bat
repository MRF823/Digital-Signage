@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

echo.
echo ============================================================
echo    BancaSign ^| Setup TV Schimb Valutar ^| Windows
echo ============================================================
echo.

REM ── Verificare Administrator ─────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  EROARE: Scriptul trebuie rulat ca Administrator.
    echo  Click dreapta pe fisier ^> "Run as administrator"
    pause & exit /b 1
)

REM ── Directorul de instalare ───────────────────────────────────
set INSTALL_DIR=C:\BancaSign
set REPO_DIR=%INSTALL_DIR%\Digital-Signage
set PLAYER_DIR=%REPO_DIR%\player
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

echo  Directorul de instalare: %INSTALL_DIR%
echo.

REM ── PASUL 1: Node.js ─────────────────────────────────────────
echo [1/8] Verificare / Instalare Node.js...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo       Instalare Node.js via winget...
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
    REM Adauga Node.js in PATH pentru sesiunea curenta
    set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
) else (
    echo       Node.js deja instalat:
    node -v
)

REM ── PASUL 2: Git ─────────────────────────────────────────────
echo [2/8] Verificare / Instalare Git...
where git >nul 2>&1
if %errorLevel% neq 0 (
    echo       Instalare Git via winget...
    winget install Git.Git --accept-source-agreements --accept-package-agreements --silent
    set "PATH=C:\Program Files\Git\bin;%PATH%"
) else (
    echo       Git deja instalat.
)

REM ── PASUL 3: Google Chrome ────────────────────────────────────
echo [3/8] Verificare / Instalare Google Chrome...
set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
if not exist "%CHROME_PATH%" set CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
if not exist "%CHROME_PATH%" (
    echo       Instalare Google Chrome via winget...
    winget install Google.Chrome --accept-source-agreements --accept-package-agreements --silent
) else (
    echo       Chrome deja instalat.
)

REM ── PASUL 4: Clonare / Actualizare repo ──────────────────────
echo [4/8] Clonare / Actualizare repo BancaSign...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if exist "%REPO_DIR%\.git" (
    echo       Repo existent - actualizare...
    cd /d "%REPO_DIR%"
    git pull origin main
) else (
    echo       Clonare repo...
    cd /d "%INSTALL_DIR%"
    git clone https://github.com/MRF823/Digital-Signage.git
)

REM ── PASUL 5: Build player ─────────────────────────────────────
echo [5/8] Build player...
cd /d "%PLAYER_DIR%"
call npm install
if %errorLevel% neq 0 ( echo  EROARE la npm install! & pause & exit /b 1 )
call npm run build
if %errorLevel% neq 0 ( echo  EROARE la npm run build! & pause & exit /b 1 )
echo       Build finalizat.

REM ── PASUL 6: pm2 + serve ─────────────────────────────────────
echo [6/8] Instalare pm2 si configurare server...
call npm install -g pm2 pm2-windows-startup serve
call pm2 delete forex-player >nul 2>&1
cd /d "%PLAYER_DIR%"
call pm2 start "serve dist -p 3000" --name forex-player
call pm2 save
call pm2-windows-startup install
echo       pm2 configurat - forex-player pornit pe portul 3000.

REM ── PASUL 7: Kiosk Chrome la startup ─────────────────────────
echo [7/8] Configurare Chrome kiosk la pornire Windows...

REM Detectam calea corecta Chrome
set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
if not exist "%CHROME_PATH%" set CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe

REM Cream VBS (fara fereastra CMD care clipeste la start)
set VBS_FILE=%STARTUP_DIR%\BancaSign-Forex.vbs
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.Run """"%CHROME_PATH%"""" ^& _
    echo     "" --kiosk" ^& _
    echo     " --noerrdialogs" ^& _
    echo     " --disable-infobars" ^& _
    echo     " --disable-session-crashed-bubble" ^& _
    echo     " --disable-translate" ^& _
    echo     " --check-for-update-interval=31536000" ^& _
    echo     " http://localhost:3000", 0
) > "%VBS_FILE%"
echo       Shortcut kiosk creat in Startup.

REM ── PASUL 8: Setari Windows ───────────────────────────────────
echo [8/8] Configurare setari Windows...

REM Dezactivare sleep si screensaver
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change monitor-timeout-ac 0
powercfg /change monitor-timeout-dc 0
powercfg /change hibernate-timeout-ac 0

REM Dezactivare screensaver
reg add "HKCU\Control Panel\Desktop" /v ScreenSaveActive /t REG_SZ /d 0 /f >nul
reg add "HKCU\Control Panel\Desktop" /v ScreenSaverIsSecure /t REG_SZ /d 0 /f >nul

echo       Sleep si screensaver dezactivate.

REM ── GATA ─────────────────────────────────────────────────────
echo.
echo ============================================================
echo    Instalare completa!
echo ============================================================
echo.
echo  CE TREBUIE SA FACI IN CONTINUARE:
echo.
echo  1. Seteaza auto-login Windows (fara parola la startup):
echo     Win+R ^> netplwiz ^> debifezi "Users must enter..."
echo.
echo  2. In dashboard BancaSign, adauga TV-ul in agentia corecta:
echo     Agentii ^> Agentia ta ^> + TV
echo     Label OBLIGATORIU: TV schimb valutar
echo.
echo  3. Reporneste PC-ul.
echo     La startup: pm2 porneste serverul, Chrome deschide kiosk.
echo     TV-ul se conecteaza automat si afiseaza cursurile.
echo.
echo  SERVER VPS: 92.5.28.167:4000
echo.
pause
