# ============================================================
#  DisplayIQ — Setup Mini PC Windows
#  Rulare: PowerShell ca Administrator (Win+R → powershell → Ctrl+Shift+Enter)
# ============================================================

$agencyId = Read-Host "Agency ID (ex: 12 pentru Ana Tower)"
$tvLabel  = Read-Host "Label TV exact ca in dashboard (ex: Tv Vitrina)"

$repoDir = "C:\Users\$env:USERNAME\Digital-Signage"
$serverDir = "$repoDir\server"

# ── [1/5] Git clone repo ─────────────────────────────────────
Write-Host ""
Write-Host "[1/5] Descarcare Digital-Signage..." -ForegroundColor Cyan

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "      Instalare Git via winget..." -ForegroundColor Yellow
    winget install Git.Git --accept-source-agreements --accept-package-agreements --silent
    $env:PATH += ";C:\Program Files\Git\cmd"
}

if (Test-Path $repoDir) {
    Write-Host "      Repo deja exista, actualizare..." -ForegroundColor Yellow
    cd $repoDir
    git pull
} else {
    git clone https://github.com/MRF823/Digital-Signage.git $repoDir
}
Write-Host "      OK." -ForegroundColor Green

# ── [2/5] npm install in server ──────────────────────────────
Write-Host "[2/5] Instalare dependinte server..." -ForegroundColor Cyan
cd $serverDir
npm install --omit=dev
Write-Host "      OK." -ForegroundColor Green

# ── [3/5] PM2 update agent ───────────────────────────────────
Write-Host "[3/5] Pornire update agent (PM2)..." -ForegroundColor Cyan
pm2 delete signage-update-agent 2>$null
pm2 start update-agent.cjs --name signage-update-agent
pm2 save

# Auto-start la boot via Task Scheduler
$action = New-ScheduledTaskAction -Execute "pm2" -Argument "resurrect" -WorkingDirectory $serverDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0
Register-ScheduledTask -TaskName "DisplayIQ-UpdateAgent" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force | Out-Null

Write-Host "      OK." -ForegroundColor Green

# ── [4/5] Edge autostart (registry) ─────────────────────────
Write-Host "[4/5] Configurare Edge autostart..." -ForegroundColor Cyan

$tvEncoded = [Uri]::EscapeDataString($tvLabel)
$url  = "http://92.5.28.167:4000/player?agencyId=$agencyId&tvId=$tvEncoded"
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

$cmd = "`"$edge`" --app=`"$url`" --start-maximized --no-first-run"

Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "BancaSign" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "DisplayIQ" -ErrorAction SilentlyContinue
New-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "DisplayIQ" -Value $cmd -PropertyType String -Force | Out-Null

Write-Host "      OK." -ForegroundColor Green

# ── [5/5] Setari Windows ─────────────────────────────────────
Write-Host "[5/5] Dezactivare sleep, screensaver, hibernare..." -ForegroundColor Cyan
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change monitor-timeout-ac 0
powercfg /change monitor-timeout-dc 0
powercfg /change hibernate-timeout-ac 0
Write-Host "      OK." -ForegroundColor Green

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
