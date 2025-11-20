# Quick Start Script - AI CRM Platform
# Simplified version that just starts the essentials

Write-Host "Quick Starting AI CRM Platform..." -ForegroundColor Cyan
Write-Host ""

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "No .env.local found. Creating template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env.local" -ErrorAction SilentlyContinue
    Write-Host "Please update .env.local with your API keys" -ForegroundColor Gray
    Write-Host ""
}

# Start Next.js dev server
Write-Host "Starting development server..." -ForegroundColor Green
Write-Host ""
Write-Host "Opening in new window..." -ForegroundColor Gray
Write-Host ""

Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"

Start-Sleep -Seconds 3

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Server Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Open your browser to: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop the server, close the PowerShell window or press Ctrl+C" -ForegroundColor Gray
Write-Host ""
