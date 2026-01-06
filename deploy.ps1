param (
    [int]$Worker,
    [string]$Command
)

$Passwords = @{
    1 = "RapidArchitecture2026TEN"
    2 = "RapidArchitecture2026TEN"
    3 = "RapidArchitecture2026TEN"
}

$IPs = @{
    1 = "147.93.63.136"   # Worker 1: Build/Error Resolution
    2 = "147.93.57.170"   # Worker 2: UX/UI and Website Builder
    3 = "147.93.103.111"  # Worker 3: Infrastructure/Database
}

# This uses sshpass (standard on most systems) to send the password automatically
sshpass -p $Passwords[$Worker] ssh root@$IPs[$Worker] "cd ~/worktree-1 && git pull origin dev && $Command"
