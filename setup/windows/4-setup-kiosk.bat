@echo off
echo ========================================
echo  Digital Signage - Setup Kiosk Autostart
echo ========================================
echo.

:: Calea catre Chromium sau Chrome
set CHROME_PATH=
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
)
if exist "C:\Program Files\Chromium\Application\chromium.exe" (
    set CHROME_PATH=C:\Program Files\Chromium\Application\chromium.exe
)

if "%CHROME_PATH%"=="" (
    echo EROARE: Chrome sau Chromium nu este instalat!
    echo Descarca Chrome de la: https://www.google.com/chrome/
    pause
    exit /b 1
)

echo [OK] Browser gasit: %CHROME_PATH%

:: Creeaza scriptul de pornire kiosk
echo @echo off > C:\signage\start-kiosk.bat
echo timeout /t 5 /nobreak >> C:\signage\start-kiosk.bat
echo start "" "%CHROME_PATH%" --kiosk --no-first-run --disable-infobars --disable-session-crashed-bubble --noerrdialogs --disable-translate --no-default-browser-check http://localhost:5176 >> C:\signage\start-kiosk.bat

:: Adauga la Task Scheduler sa porneasca la login
echo.
echo Adaug kiosk la pornire automata...
schtasks /create /tn "SignageKiosk" /tr "C:\signage\start-kiosk.bat" /sc onlogon /rl highest /f

if %errorlevel% neq 0 (
    echo EROARE la crearea task-ului! Incearca sa rulezi ca Administrator.
    pause
    exit /b 1
)

echo.
echo [OK] Kiosk configurat sa porneasca automat la login
echo [OK] Browserul va deschide http://localhost:5176 full screen
echo.
echo ========================================
echo  Setup complet!
echo  Urmatorul pas: ruleaza 5-setup-autoupdate.bat
echo ========================================
pause
