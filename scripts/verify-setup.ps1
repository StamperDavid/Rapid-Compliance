# Verification Script - Checks if everything is set up correctly
# Run this if you're having startup issues

# Ensure we're in the project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

Write-Host "Verifying AI CRM Platform Setup..." -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check 1: Node.js
Write-Host "[1/5] Checking Node.js..." -ForegroundColor Yellow
if (Get-Command "node" -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ Node.js NOT installed!" -ForegroundColor Red
    Write-Host "    Download from: https://nodejs.org/" -ForegroundColor Yellow
    $allGood = $false
}

# Check 2: package.json
Write-Host "[2/5] Checking package.json..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" | ConvertFrom-Json
    if ($pkg.scripts.dev) {
        Write-Host "  ✓ package.json is valid" -ForegroundColor Green
    } else {
        Write-Host "  ✗ package.json is missing 'dev' script!" -ForegroundColor Red
        Write-Host "    Restoring from backup..." -ForegroundColor Yellow
        if (Test-Path "package.json.backup") {
            Copy-Item "package.json.backup" "package.json" -Force
            Write-Host "    ✓ Restored from backup!" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  ✗ package.json NOT found!" -ForegroundColor Red
    $allGood = $false
}

# Check 3: node_modules
Write-Host "[3/5] Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  ✓ node_modules exists" -ForegroundColor Green
} else {
    Write-Host "  ! node_modules not found" -ForegroundColor Yellow
    Write-Host "    Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host "  ✓ Dependencies installed" -ForegroundColor Green
}

# Check 4: Next.js
Write-Host "[4/5] Checking Next.js..." -ForegroundColor Yellow
if (Test-Path "node_modules\next") {
    Write-Host "  ✓ Next.js is installed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Next.js NOT installed!" -ForegroundColor Red
    Write-Host "    Run: npm install" -ForegroundColor Yellow
    $allGood = $false
}

# Check 5: Start scripts
Write-Host "[5/5] Checking start scripts..." -ForegroundColor Yellow
$scriptsExist = $true
if (-not (Test-Path "START.bat")) {
    Write-Host "  ✗ START.bat missing" -ForegroundColor Red
    $scriptsExist = $false
}
if (-not (Test-Path "START.ps1")) {
    Write-Host "  ✗ START.ps1 missing" -ForegroundColor Red
    $scriptsExist = $false
}
if ($scriptsExist) {
    Write-Host "  ✓ Start scripts are present" -ForegroundColor Green
}

Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan

if ($allGood) {
    Write-Host "✓ All checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can start the server with:" -ForegroundColor Yellow
    Write-Host "  .\START.bat" -ForegroundColor White
    Write-Host "  .\START.ps1" -ForegroundColor White
    Write-Host "  npm run dev" -ForegroundColor White
} else {
    Write-Host "✗ Some issues found. Please fix them and try again." -ForegroundColor Red
}

Write-Host ""




