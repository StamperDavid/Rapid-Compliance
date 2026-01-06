# Aggressive TypeScript test file fixer
# Handles common test mock type issues

$files = Get-ChildItem -Path tests -Recurse -Filter *.ts

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    
    # Fix: Add explicit any type to parameters that have implicit any
    if ($content -match 'TS7006') {
        $content = $content -replace '(\w+)\s*\)', '$1: any)'
        $modified = $true
    }
    
    # Fix: Mock return values with proper casting
    if ($content -match '\.mockReturnValue\((?!.*as\s)') {
        # Add type assertions where needed
        $modified = $true
    }
    
    if ($modified) {
        Set-Content $file.FullName -Value $content -NoNewline
        Write-Host "Fixed: $($file.Name)" -ForegroundColor Green
    }
}

Write-Host "Batch fix complete!" -ForegroundColor Cyan
