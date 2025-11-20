# PowerShell Script to Start Development Environment
# Run all necessary services for local development

param(
    [switch]$WithFirebase,
    [switch]$WithRedis,
    [switch]$WithDatabase,
    [switch]$All
)

Write-Host "Starting AI CRM Platform Development Environment" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a command exists
function Test-Command {
    param($Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# Function to start a process in a new window
function Start-Service {
    param(
        [string]$Name,
        [string]$Command,
        [string]$Arguments,
        [string]$WorkingDirectory = (Get-Location)
    )
    
    Write-Host "Starting $Name..." -ForegroundColor Yellow
    
    $cmd = "Write-Host '[$Name] Starting...' -ForegroundColor Green; cd '$WorkingDirectory'; $Command $Arguments"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd
    
    Write-Host "Started $Name in new window" -ForegroundColor Green
    Start-Sleep -Seconds 2
}

# Check Node.js installation
if (-not (Test-Command "node")) {
    Write-Host "ERROR: Node.js is not installed. Please run setup-dev.ps1 first." -ForegroundColor Red
    exit 1
}

Write-Host "Node.js detected" -ForegroundColor Green

# Start Next.js dev server
Write-Host ""
Write-Host "Starting Next.js development server..." -ForegroundColor Yellow
Start-Service -Name "Next.js" -Command "npm" -Arguments "run dev"

# Start Firebase Emulators (if flag is set)
if ($WithFirebase -or $All) {
    Write-Host ""
    if (Test-Command "firebase") {
        Write-Host "Starting Firebase Emulators..." -ForegroundColor Yellow
        Start-Service -Name "Firebase" -Command "firebase" -Arguments "emulators:start"
    } else {
        Write-Host "WARNING: Firebase CLI not installed. Skipping Firebase emulators." -ForegroundColor Yellow
        Write-Host "Install with: npm install -g firebase-tools" -ForegroundColor Gray
    }
}

# Start Redis (if flag is set)
if ($WithRedis -or $All) {
    Write-Host ""
    if (Test-Command "redis-server") {
        Write-Host "Starting Redis..." -ForegroundColor Yellow
        Start-Service -Name "Redis" -Command "redis-server"
    } else {
        Write-Host "WARNING: Redis not installed. Skipping Redis server." -ForegroundColor Yellow
        Write-Host "Install from: https://redis.io/download" -ForegroundColor Gray
    }
}

# Start PostgreSQL (if flag is set)
if ($WithDatabase -or $All) {
    Write-Host ""
    if (Test-Command "pg_ctl") {
        Write-Host "Starting PostgreSQL..." -ForegroundColor Yellow
        $pgData = "C:\Program Files\PostgreSQL\15\data"
        Start-Service -Name "PostgreSQL" -Command "pg_ctl" -Arguments "-D `"$pgData`" start"
    } else {
        Write-Host "WARNING: PostgreSQL not installed. Skipping database server." -ForegroundColor Yellow
    }
}

# Wait for services to initialize
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Development Environment Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services running:" -ForegroundColor Yellow
Write-Host "  - Next.js Dev Server: http://localhost:3000" -ForegroundColor White

if ($WithFirebase -or $All) {
    Write-Host "  - Firebase UI: http://localhost:4000" -ForegroundColor White
    Write-Host "  - Firestore: http://localhost:8080" -ForegroundColor White
    Write-Host "  - Auth: http://localhost:9099" -ForegroundColor White
}

if ($WithRedis -or $All) {
    Write-Host "  - Redis: localhost:6379" -ForegroundColor White
}

if ($WithDatabase -or $All) {
    Write-Host "  - PostgreSQL: localhost:5432" -ForegroundColor White
}

Write-Host ""
Write-Host "Press Ctrl+C in each window to stop services" -ForegroundColor Gray
Write-Host ""
Write-Host "Happy coding!" -ForegroundColor Cyan
Write-Host ""
