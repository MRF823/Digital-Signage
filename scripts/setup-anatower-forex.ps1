# ============================================================
#  DisplayIQ — Setup Mini PC: Agentia Ana Tower | TV Schimb Valutar
#  Rulare: PowerShell ca Administrator (Win+R → powershell → Ctrl+Shift+Enter)
# ============================================================

$agencyId = "12"
$tvLabel  = "TV Schimb Valutar"
$repoDir  = "C:\Users\$env:USERNAME\Digital-Signage"
$serverDir = "$repoDir\server"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  DisplayIQ Setup — Agentia Ana Tower | TV Schimb Valutar" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ── [0/5] Verificare & instalare Git + Node.js ───────────────
Write-Host "[0/5] Verificare Git si Node.js..." -ForegroundColor Cyan

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "      Instalare Git via winget..." -ForegroundColor Yellow
    winget install Git.Git --accept-source-agreements --accept-package-agreements --silent
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "      Instalare Node.js via winget..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
}

$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
Write-Host "      Git: $(git --version)" -ForegroundColor Green
Write-Host "      Node: $(node --version)" -ForegroundColor Green

# ── [1/5] Git clone repo ─────────────────────────────────────
Write-Host "[1/5] Descarcare Digital-Signage..." -ForegroundColor Cyan
if (Test-Path $repoDir) {
    Write-Host "      Repo deja exista, actualizare..." -ForegroundColor Yellow
    Set-Location $repoDir
    git pull
} else {
    git clone https://github.com/MRF823/Digital-Signage.git $repoDir
}
Write-Host "      OK." -ForegroundColor Green

# ── [2/5] npm install in server ──────────────────────────────
Write-Host "[2/5] Instalare dependinte server..." -ForegroundColor Cyan
Set-Location $serverDir
npm install --omit=dev
Write-Host "      OK." -ForegroundColor Green

# ── [3/5] Update agent via Task Scheduler ────────────────────
Write-Host "[3/5] Configurare update agent..." -ForegroundColor Cyan
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = "node" }
$action   = New-ScheduledTaskAction -Execute $node -Argument "update-agent.cjs" -WorkingDirectory $serverDir
$trigger  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "DisplayIQ-UpdateAgent" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force | Out-Null
Start-ScheduledTask -TaskName "DisplayIQ-UpdateAgent"
Write-Host "      OK." -ForegroundColor Green

# ── [4/5] Edge autostart (registry) ─────────────────────────
Write-Host "[4/5] Configurare Edge autostart..." -ForegroundColor Cyan
$tvEncoded = [Uri]::EscapeDataString($tvLabel)
$url  = "https://displayiq.funkymedia.ro/player?agencyId=$agencyId&tvId=$tvEncoded&portrait=1"
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$cmd = "`"$edge`" --app=`"$url`" --start-fullscreen --no-first-run"
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "BancaSign" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "DisplayIQ" -ErrorAction SilentlyContinue
New-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "DisplayIQ" -Value $cmd -PropertyType String -Force | Out-Null
Write-Host "      OK." -ForegroundColor Green

# ── [5/5] Dezactivare sleep / screensaver / hibernare ────────
Write-Host "[5/5] Dezactivare sleep, screensaver, hibernare..." -ForegroundColor Cyan
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change monitor-timeout-ac 0
powercfg /change monitor-timeout-dc 0
powercfg /change hibernate-timeout-ac 0
Write-Host "      OK." -ForegroundColor Green

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Gata! URL configurat:" -ForegroundColor Green
Write-Host "  $url" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  PASUL URMATOR — auto-login fara parola:" -ForegroundColor Yellow
Write-Host "  Se deschide netplwiz. Debifezi 'Users must enter a user" -ForegroundColor White
Write-Host "  name and password', dai OK, confirmi cu parola." -ForegroundColor White
Write-Host ""
Write-Host "  Dupa netplwiz: REPORNESTE PC-ul." -ForegroundColor Yellow
Write-Host ""

netplwiz
