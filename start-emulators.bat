@echo off
echo ========================================
echo Starting Firebase Emulators
echo ========================================
echo.
echo Emulator UI will be available at: http://localhost:4000
echo Firestore: localhost:8080
echo Auth: localhost:9099
echo Storage: localhost:9199
echo.
echo Press Ctrl+C to stop emulators
echo ========================================
echo.

firebase emulators:start --import=./emulator-data --export-on-exit






