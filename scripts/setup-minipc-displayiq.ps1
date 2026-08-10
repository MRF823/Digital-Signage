# ============================================================
#  DisplayIQ — Setup Mini PC Windows
#  Rulare: PowerShell ca Administrator (Win+R → powershell → Ctrl+Shift+Enter)
# ============================================================

$agencyId = Read-Host "Agency ID (ex: 12 pentru Ana Tower)"
$tvLabel  = Read-Host "Label TV exact ca in dashboard (ex: Tv Vitrina)"

$tvEncoded = [Uri]::EscapeDataString($tvLabel)
$url  = "http://92.5.28.167:4000/player?agencyId=$agencyId&tvId=$tvEncoded"
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

$cmd = "`"$edge`" --app=`"$url`" --start-maximized --no-first-run"

# Sterge orice intrare veche
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "BancaSign" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "DisplayIQ" -ErrorAction SilentlyContinue

# Adauga intrarea noua
New-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "DisplayIQ" -Value $cmd -PropertyType String -Force | Out-Null

# Dezactiveaza sleep si screensaver
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change monitor-timeout-ac 0
powercfg /change monitor-timeout-dc 0
powercfg /change hibernate-timeout-ac 0

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Gata! URL configurat:" -ForegroundColor Green
Write-Host "  $url" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  PASUL URMATOR — auto-login fara parola:" -ForegroundColor Yellow
Write-Host "  Se deschide netplwiz. Debifezi 'Users must enter a user" -ForegroundColor White
Write-Host "  name and password', dai OK, confirmi cu parola." -ForegroundColor White
Write-Host ""
Write-Host "  Dupa netplwiz: REPORNESTE PC-ul." -ForegroundColor Yellow
Write-Host ""

netplwiz
