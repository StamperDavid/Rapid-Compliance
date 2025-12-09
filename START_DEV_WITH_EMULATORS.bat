@echo off
echo ========================================
echo AI Sales Platform - Development Mode
echo ========================================
echo.
echo This will start:
echo  1. Firebase Emulators (Firestore, Auth, Storage)
echo  2. Next.js Development Server
echo.
echo ========================================
echo.

REM Check if .env.local exists
if not exist .env.local (
    echo WARNING: .env.local file not found!
    echo Creating from template...
    copy env.template .env.local
    echo.
    echo NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true >> .env.local
    echo.
    echo Please edit .env.local with your API keys if needed
    echo Press any key to continue...
    pause >nul
)

REM Check if emulator flag is set
findstr /C:"NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true" .env.local >nul 2>&1
if %errorlevel% neq 0 (
    echo Adding emulator flag to .env.local...
    echo NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true >> .env.local
)

echo.
echo Starting in 3 seconds...
echo Press Ctrl+C NOW to cancel
timeout /t 3 >nul

REM Start emulators in a new window
start "Firebase Emulators" cmd /k "echo Starting Firebase Emulators... && firebase emulators:start --import=./emulator-data --export-on-exit"

echo.
echo Waiting 5 seconds for emulators to start...
timeout /t 5 >nul

REM Start Next.js dev server in current window
echo.
echo Starting Next.js development server...
echo.
npm run dev






