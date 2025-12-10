@echo off
echo ========================================
echo Starting AI Sales Platform - Development Mode
echo ========================================
echo.
echo This will start:
echo   1. Firebase Emulators (background)
echo   2. Next.js Dev Server
echo.
echo ========================================
echo.

REM Start Firebase Emulators in a new window
start "Firebase Emulators" cmd /k "firebase emulators:start --import=./emulator-data --export-on-exit"

REM Wait a few seconds for emulators to start
echo Waiting for Firebase Emulators to start...
timeout /t 5 /nobreak >nul

REM Start Next.js dev server
echo Starting Next.js development server...
npm run dev







