@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

echo.
echo ============================================================
echo    BancaSign  ^|  Setup Mini PC  ^|  Windows
echo ============================================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  EROARE: Rulati ca Administrator!
    echo  Click dreapta pe fisier ^> Run as administrator
    pause
    exit /b 1
)

echo  Gasiti datele in dashboard DisplayIQ ^> sectiunea Agentii sau TV-uri
echo.
set /p AGENCY_ID= ID Agentie [ex: 12 pentru Ana Tower]:
set /p TV_LABEL= Label TV exact ca in dashboard [ex: Tv Vitrina]:
echo.

REM ── Detectare Chrome ─────────────────────────────────────────
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "!CHROME!" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_FILE=!STARTUP_DIR!\BancaSign-Kiosk.vbs"
set "PS1=%TEMP%\bancasign_setup.ps1"

echo  Configurare:
echo    Agentie ID : !AGENCY_ID!
echo    TV Label   : !TV_LABEL!
echo    Server     : 92.5.28.167:4000
echo.

REM ── [1/4] Chrome ─────────────────────────────────────────────
echo [1/4] Verificare Google Chrome...
if not exist "!CHROME!" (
    echo       Instalare Chrome via winget...
    winget install Google.Chrome --accept-source-agreements --accept-package-agreements --silent
    set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
    if not exist "!CHROME!" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
if exist "!CHROME!" (
    echo       OK.
) else (
    echo       ATENTIE: Chrome nu a fost gasit dupa instalare.
)

REM ── [2/4] Kiosk autostart ────────────────────────────────────
echo [2/4] Creare kiosk la pornire Windows...

REM Scriem un script PowerShell temporar care gestioneaza URL-ul si VBS-ul
> "!PS1!" echo param([string]$AgencyId, [string]$TvLabel, [string]$Chrome, [string]$VbsPath)
>> "!PS1!" echo $tvEncoded = [Uri]::EscapeDataString($TvLabel)
>> "!PS1!" echo $content = @"
>> "!PS1!" echo Set WshShell = CreateObject("WScript.Shell")
>> "!PS1!" echo Dim chrome, url
>> "!PS1!" echo chrome = "$Chrome"
>> "!PS1!" echo url = "http://92.5.28.167:4000/player?agencyId=$AgencyId" ^& Chr(38) ^& "tvId=$tvEncoded"
>> "!PS1!" echo WshShell.Run Chr(34) ^& chrome ^& Chr(34) ^& " --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble " ^& Chr(34) ^& url ^& Chr(34), 0
>> "!PS1!" echo "@
>> "!PS1!" echo Set-Content -Path $VbsPath -Value $content -Encoding UTF8
>> "!PS1!" echo Write-Host ("URL kiosk: http://92.5.28.167:4000/player?agencyId=" + $AgencyId + [char]38 + "tvId=" + $tvEncoded)

powershell -NoProfile -ExecutionPolicy Bypass -File "!PS1!" -AgencyId "!AGENCY_ID!" -TvLabel "!TV_LABEL!" -Chrome "!CHROME!" -VbsPath "!VBS_FILE!"
del "!PS1!" >nul 2>&1

if exist "!VBS_FILE!" (
    echo       Creat: !VBS_FILE!
) else (
    echo       EROARE: fisierul VBS nu a fost creat.
)

REM ── [3/4] Setari Windows ─────────────────────────────────────
echo [3/4] Dezactivare sleep, screensaver, hibernare...
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change monitor-timeout-ac 0
powercfg /change monitor-timeout-dc 0
powercfg /change hibernate-timeout-ac 0
reg add "HKCU\Control Panel\Desktop" /v ScreenSaveActive /t REG_SZ /d 0 /f >nul
reg add "HKCU\Control Panel\Desktop" /v ScreenSaverIsSecure /t REG_SZ /d 0 /f >nul
echo       OK.

REM ── [4/4] Test imediat ───────────────────────────────────────
echo [4/4] Lansare Chrome pentru test...
if exist "!CHROME!" (
    powershell -NoProfile -Command "$tv=[Uri]::EscapeDataString('!TV_LABEL!'); $url='http://92.5.28.167:4000/player?agencyId=!AGENCY_ID!'+[char]38+'tvId='+$tv; Start-Process '!CHROME!' -ArgumentList '--kiosk','--noerrdialogs','--disable-infobars','--disable-session-crashed-bubble','--edge-kiosk-idle-timeout-minutes=0',$url"
    echo       Chrome lansat in kiosk.
) else (
    echo       Chrome nu a fost gasit - test sarit.
)

echo.
echo ============================================================
echo    INSTALARE COMPLETA
echo ============================================================
echo.
echo  PASUL MANUAL OBLIGATORIU - auto-login fara parola:
echo    Win+R ^> netplwiz
echo    Debifezi "Users must enter a user name and password"
echo    OK ^> confirma cu parola daca ti-o cere
echo.
echo  La urmatoarea repornire a PC-ului:
echo    - Windows se logheaza automat
echo    - Chrome porneste in kiosk si se conecteaza la BancaSign
echo    - TV-ul apare online in dashboard
echo.
echo  Verifica in dashboard DisplayIQ ca TV-ul "!TV_LABEL!" este:
echo    - Adaugat la agentia ID !AGENCY_ID!
echo    - Alocat la un Grup cu continut ^(pentru TV-uri vitrina^)
echo.
pause
