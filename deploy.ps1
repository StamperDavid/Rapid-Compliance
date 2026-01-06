param (
    [int]$Worker,
    [string]$Command
)

$IPs = @{
    1 = "164.92.118.130"   # Worker 1: Build/Error Resolution
    2 = "147.182.243.137"  # Worker 2: UX/UI and Website Builder
    3 = "161.35.239.20"    # Worker 3: Infrastructure/Database
}

# Uses SSH key: ~/.ssh/ai_swarm_key (passwordless after setup)
ssh -i "$env:USERPROFILE\.ssh\ai_swarm_key" root@$($IPs[$Worker]) "cd ~/worktree-1 && git pull origin dev && $Command"
