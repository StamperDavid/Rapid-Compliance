# How to Start the Server

## EASIEST METHODS (Pick One):

### Option 1: Double-Click START.bat (Windows)
Just double-click `START.bat` in the project root folder.

### Option 2: Run START.ps1
```powershell
.\START.ps1
```

### Option 3: Use npm directly
```powershell
npm run dev
```

## That's It!

The server will start on **http://localhost:3000**

## Troubleshooting

### If you get "command not found":
1. Make sure you're in the project directory:
   ```powershell
   cd "C:\Users\David\PycharmProjects\AI Sales Platform"
   ```
2. Then run one of the commands above

### If you get "Missing script: dev":
Your `package.json` is corrupted. It should have been fixed. If this happens again:
1. Make sure you're in the project root (not in a subdirectory)
2. Check that `package.json` exists in the current directory
3. Run `npm install` first

### Server won't start:
1. Check if port 3000 is already in use
2. Try closing other applications
3. Restart your terminal and try again

---

**For more details, see HOW_TO_RUN.md**














