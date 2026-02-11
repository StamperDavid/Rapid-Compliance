$routes = Get-ChildItem -Recurse -Path 'src\app\api' -Filter 'route.ts'
foreach ($route in $routes) {
    $content = Get-Content -LiteralPath $route.FullName -Raw
    if ($content -notmatch 'requireAuth|requireRole|requireApiKey|verifyAdminRequest|CRON_SECRET|validateRequest|verifyIdToken|requireUserRole') {
        $route.FullName.Replace('D:\Future Rapid Compliance\', '')
    }
}
