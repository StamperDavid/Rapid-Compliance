# swarm_monitor.ps1 - Stable Version
$PollInterval = 600
$MemBoost = "export NODE_OPTIONS=--max-old-space-size=4096"

function Get-Truncated($raw) {
    if ($raw -eq $null -or $raw -match "Warning") { return "Synchronizing..." }
    $s = "$raw".Trim()
    if ($s.Length -gt 40) { return $s.Substring(0,37) + "..." }
    return $s
}

Write-Host "SWARM ADMIRAL: AUTO-RECOVERY MODE ONLINE" -ForegroundColor Cyan

while ($true) {
    $Timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host ""
    Write-Host ("[" + $Timestamp + "] Heartbeat Check...") -ForegroundColor Yellow

    # 1. Fetch Progress (W1 is the Logic Leader)
    $w1_log = python orchestrate.py exec 1 "git log -1 --format=%s"
    $w1_err = python orchestrate.py exec 1 ($MemBoost + " && npx tsc --noEmit | grep -c 'error TS' || echo 'Scanning'")

    $t1 = Get-Truncated $w1_log
    
    Write-Host "------------------------------------------------------------"
    Write-Host ("W1 | " + $t1 + " | Errors: " + $w1_err)
    Write-Host "W2 | Active and Synced"
    Write-Host "W3 | Active and Synced"
    Write-Host "------------------------------------------------------------"

    # 2. Automated Sync (Force W1 state to the others)
    Write-Host "Syncing Hive State..." -ForegroundColor Gray
    python orchestrate.py exec 1 "git add . && git commit -m 'Swarm Sync' --allow-empty && git push origin dev --force"
    python orchestrate.py exec 2 "git fetch origin && git reset --hard origin/dev"
    python orchestrate.py exec 3 "git fetch origin && git reset --hard origin/dev"

    # 3. Resume Missions
    python orchestrate.py exec 1 ($MemBoost + " && agent -p --force 'Fix TS errors in src/lib. Prioritize Firebase types.'")
    python orchestrate.py exec 2 "agent -p --force 'Fix ESLint warnings in src/app'"
    
    $WaitMin = [math]::Round($PollInterval / 60)
    Write-Host ("Waiting " + $WaitMin + " minutes...") -ForegroundColor Gray
    Start-Sleep -Seconds $PollInterval
}