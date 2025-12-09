@echo off
echo ========================================
echo Disabling Firebase Emulator Mode
echo ========================================
echo.

if not exist .env.local (
    echo Creating .env.local from template...
    copy env.template .env.local
)

REM Remove any existing emulator flag
powershell -Command "(Get-Content .env.local) | Where-Object { $_ -notmatch 'NEXT_PUBLIC_USE_FIREBASE_EMULATOR' } | Set-Content .env.local"

REM Add the flag set to false
echo NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false >> .env.local

echo.
echo ✓ Emulator mode disabled
echo.
echo The app will now:
echo  - Use Firebase config from environment variables (if set)
echo  - Or run in DEMO MODE (if no Firebase config found)
echo.
echo Restart your dev server for changes to take effect
echo.
pause






