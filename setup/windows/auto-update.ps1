# BancaSign Auto-Update Script
# Ruleaza noaptea prin Task Scheduler sau la cerere din dashboard

$repoDir = "C:\Users\admin\digital-signage"
$playerDir = "C:\Users\admin\digital-signage\player"
$logFile = "C:\Users\admin\digital-signage\update.log"

function Log($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp $msg" | Add-Content $logFile
}

Log "=== Verificare actualizare ==="

# Verifica conexiunea la internet
try {
    $response = Invoke-WebRequest -Uri "http://92.5.28.167:4000/api/rates" -TimeoutSec 10 -UseBasicParsing
    Log "Internet OK"
} catch {
    Log "Fara internet — skip"
    exit 0
}

# Git pull din radacina repo-ului
Set-Location $repoDir
$pullOutput = git pull 2>&1
Log "git pull: $pullOutput"

# Daca nu sunt modificari, iesim
if ($pullOutput -match "Already up to date") {
    Log "Fara modificari — nu e nevoie de build"
    exit 0
}

# Sunt modificari — face build in folderul player
Log "Modificari detectate — incep build..."
Set-Location $playerDir
$buildOutput = npm run build 2>&1
Log "build: $buildOutput"

# Restart player
$restartOutput = pm2 restart signage-player 2>&1
Log "pm2 restart: $restartOutput"

Log "Actualizare completa!"
