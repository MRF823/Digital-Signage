@echo off
REM Configureaza Task Scheduler sa ruleze auto-update in fiecare noapte la 00:00
REM Ruleaza ca Administrator!

echo Configurare auto-update BancaSign...

schtasks /create /tn "BancaSign-AutoUpdate" /tr "powershell.exe -ExecutionPolicy Bypass -File C:\Users\admin\digital-signage\setup\windows\auto-update.ps1" /sc daily /st 00:00 /ru SYSTEM /f

if %errorlevel% == 0 (
    echo.
    echo [OK] Task Scheduler configurat cu succes!
    echo      Updateul va rula automat in fiecare noapte la 00:00
) else (
    echo.
    echo [EROARE] A aparut o problema. Asigura-te ca rulezi ca Administrator.
)

pause
