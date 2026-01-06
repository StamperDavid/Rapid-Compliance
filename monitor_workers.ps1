# Worker Management Script - Run to 0 Errors
# Monitors all 3 workers, integrates branches, tracks progress

$ErrorActionPreference = "Continue"

function Get-WorkerStatus {
    param($workerNum, $workerName)
    
    Write-Host "`n=== Worker $workerNum ($workerName) ===" -ForegroundColor Cyan
    
    # Get commit count
    $commits = python orchestrate.py exec $workerNum "cd ~/worktree-1 && git log --oneline --since='10 minutes ago' | wc -l" 2>$null
    
    # Get modified files count  
    $modified = python orchestrate.py exec $workerNum "cd ~/worktree-1 && git status --short | grep '^ M' | wc -l" 2>$null
    
    # Get latest commit
    $latest = python orchestrate.py exec $workerNum "cd ~/worktree-1 && git log --oneline -1" 2>$null
    
    Write-Host "Commits (last 10min): $commits"
    Write-Host "Modified files: $modified"
    Write-Host "Latest: $latest"
}

function Integrate-WorkerBranch {
    param($branchName, $workerNum)
    
    Write-Host "`n>>> Integrating $branchName..." -ForegroundColor Yellow
    
    # Fetch branch
    git fetch origin $branchName 2>&1 | Out-Null
    
    # Check if there are new commits
    $commits = git log dev..origin/$branchName --oneline 2>&1
    
    if ($commits) {
        Write-Host "New commits found, merging..." -ForegroundColor Green
        git merge origin/$branchName --no-edit
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Merged successfully" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Merge conflict - needs manual resolution" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "No new commits" -ForegroundColor Gray
        return $false
    }
}

# Main monitoring loop
$iteration = 0

while ($true) {
    $iteration++
    Clear-Host
    Write-Host "=====================================" -ForegroundColor Magenta
    Write-Host "WORKER MANAGEMENT CYCLE #$iteration" -ForegroundColor Magenta
    Write-Host "Target: 0 TypeScript/ESLint Errors" -ForegroundColor Magenta
    Write-Host "=====================================" -ForegroundColor Magenta
    Write-Host "Time: $(Get-Date -Format 'HH:mm:ss')"
    
    # Check all workers
    Get-WorkerStatus 1 "worker-1-logic"
    Get-WorkerStatus 2 "worker-2-ui"
    Get-WorkerStatus 3 "worker-3-infra"
    
    # Integration phase
    Write-Host "`n=== INTEGRATION PHASE ===" -ForegroundColor Yellow
    
    $anyMerged = $false
    
    # Try to integrate each worker's branch
    if (Integrate-WorkerBranch "worker-1-logic" 1) { $anyMerged = $true }
    if (Integrate-WorkerBranch "worker-2-ui" 2) { $anyMerged = $true }
    if (Integrate-WorkerBranch "worker-3-infra" 3) { $anyMerged = $true }
    
    # If anything merged, push and sync workers
    if ($anyMerged) {
        Write-Host "`n>>> Pushing merged dev to GitHub..." -ForegroundColor Yellow
        git push origin dev
        
        Write-Host ">>> Syncing all workers with dev..." -ForegroundColor Yellow
        python orchestrate.py exec 1 "cd ~/worktree-1 && git fetch origin dev && git merge origin/dev --no-edit"
        python orchestrate.py exec 2 "cd ~/worktree-1 && git fetch origin dev && git merge origin/dev --no-edit"
        python orchestrate.py exec 3 "cd ~/worktree-1 && git fetch origin dev && git merge origin/dev --no-edit"
        
        Write-Host "✅ Sync complete" -ForegroundColor Green
    }
    
    Write-Host "`n=== Waiting 10 minutes until next cycle ===" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop monitoring"
    Start-Sleep -Seconds 600
}
