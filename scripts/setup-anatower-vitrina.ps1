$url = "http://92.5.28.167:4000/player?agencyId=12&tvId=Tv%20Vitrina"
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$cmd = "`"$edge`" --app=`"$url`" --start-fullscreen --no-first-run"
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "BancaSign" -ErrorAction SilentlyContinue
New-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "DisplayIQ" -Value $cmd -PropertyType String -Force
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
Write-Host "Gata! Acum ruleaza netplwiz pentru auto-login." -ForegroundColor Green
netplwiz
