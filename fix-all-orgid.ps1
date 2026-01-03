# PowerShell script to add organizationId checks across all API routes

$files = Get-ChildItem -Path "src/app/api" -Filter "*.ts" -Recurse | Where-Object { $_.FullName -notlike "*node_modules*" }

$fixedFiles = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Pattern 1: const organizationId = user.organizationId;
    # Add check if not already present
    if ($content -match 'const organizationId = user\.organizationId;' -and 
        $content -notmatch 'if \(!organizationId\)' -and
        $content -notmatch 'if \(organizationId\)') {
        
        $content = $content -replace '(const organizationId = user\.organizationId;)\r?\n', "`$1`r`n`r`n    if (!organizationId) {`r`n      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });`r`n    }`r`n`r`n"
        Write-Host "Fixed user.organizationId in: $($file.Name)" -ForegroundColor Green
    }
    
    # Pattern 2: user.organizationId used directly after const { user }
    if ($content -match 'const { user } = authResult;\r?\n\s+(await .+user\.organizationId)' -and
        $content -notmatch 'if \(!user\.organizationId\)') {
        
        $content = $content -replace '(const { user } = authResult;)\r?\n(\s+)(await)', "`$1`r`n`$2`r`n`$2if (!user.organizationId) {`r`n`$2  return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });`r`n`$2}`r`n`$2`r`n`$2`$3"
        Write-Host "Fixed direct user.organizationId in: $($file.Name)" -ForegroundColor Green
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $fixedFiles++
    }
}

Write-Host "`n✅ Total files fixed: $fixedFiles" -ForegroundColor Cyan
