# DisplayIQ Watchdog — verifică la fiecare 2 minute dacă Edge cu playerul rulează
# Dacă nu — îl repornește automat

$agencyId = $env:DISPLAYIQ_AGENCY_ID
$tvId     = $env:DISPLAYIQ_TV_ID

if (-not $agencyId -or -not $tvId) {
    # Citește parametrii din registry (salvați de scriptul de setup)
    $regPath = "HKCU:\Software\DisplayIQ"
    $agencyId = (Get-ItemProperty -Path $regPath -Name "AgencyId" -ErrorAction SilentlyContinue).AgencyId
    $tvId     = (Get-ItemProperty -Path $regPath -Name "TvId"     -ErrorAction SilentlyContinue).TvId
}

if (-not $agencyId -or -not $tvId) {
    Write-Host "[watchdog] AgencyId sau TvId negasit. Iesire."
    exit 1
}

$tvEncoded = [Uri]::EscapeDataString($tvId)
$url  = "https://displayiq.funkymedia.ro/player?agencyId=$agencyId&tvId=$tvEncoded"
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

while ($true) {
    $edgeProcs = Get-Process -Name "msedge" -ErrorAction SilentlyContinue
    $playerRunning = $edgeProcs | Where-Object {
        try {
            $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
            $cmd -and $cmd -like "*displayiq.funkymedia.ro/player*"
        } catch { $false }
    }

    if (-not $playerRunning) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "[$timestamp] [watchdog] Player offline — repornire Edge..."
        Start-Process -FilePath $edge -ArgumentList "--app=`"$url`" --start-fullscreen --no-first-run"
    }

    Start-Sleep -Seconds 120
}
