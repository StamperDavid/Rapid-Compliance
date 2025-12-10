# 🔥 Firebase Emulator Setup - Quick Start Guide

## You're Almost Ready!

I've configured Firebase Emulators for you. Here's how to get everything running:

---

## Step 1: Install Firebase CLI (One-Time Setup)

Open PowerShell and run:

```powershell
npm install -g firebase-tools
```

**That's it!** No account needed, no login required for emulators.

---

## Step 2: Start the Emulators

### Option A: Double-Click Method (Easiest)
1. Double-click `start-dev-with-emulators.bat`
2. This opens 2 windows:
   - **Firebase Emulators** (leave it running)
   - **Next.js Dev Server** (your app)

### Option B: Manual Method (Two Terminals)

**Terminal 1 - Start Emulators:**
```powershell
firebase emulators:start --import=./emulator-data --export-on-exit
```

**Terminal 2 - Start App:**
```powershell
npm run dev
```

---

## Step 3: Access Your Local App

Once both are running:

- **Your App**: http://localhost:3000
- **Emulator UI**: http://localhost:4000 (view/edit database)
- **Firestore**: localhost:8080
- **Auth**: localhost:9099
- **Storage**: localhost:9199

---

## Step 4: Add Your OpenRouter API Key

Once the app is running:

1. Go to http://localhost:3000
2. Sign up / Create an account (it's all local!)
3. Create an organization/workspace
4. Go to **Settings → API Keys**
5. Find **OpenRouter** section
6. Paste your key: `${YOUR_OPENROUTER_KEY}`
7. Click **Save**

The key is now stored in your local Firestore emulator!

---

## What You'll See

### When Emulators Start:
```
✔  firestore: Firestore Emulator running at localhost:8080
✔  auth: Auth Emulator running at localhost:9099  
✔  storage: Storage Emulator running at localhost:9199
✔  ui: Emulator UI running at localhost:4000

┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
└─────────────────────────────────────────────────────────────┘
```

### In Your App Console:
```
🔥 Connected to Firebase Emulator Suite
   Firestore: localhost:8080
   Auth: localhost:9099
   Storage: localhost:9199
   UI: http://localhost:4000
```

---

## Data Persistence

Your data is automatically saved to `./emulator-data/` folder when you stop the emulators.

Next time you start with `--import=./emulator-data`, all your data comes back!

**Pro Tip:** This folder is gitignored, so your local test data stays private.

---

## Common Issues

### "firebase: command not found"
- Firebase CLI not installed
- Run: `npm install -g firebase-tools`

### Port Already in Use
- Another service using port 8080, 9099, or 4000
- Close other apps or change ports in `firebase.json`

### App Can't Connect to Emulator
- Make sure emulators are running BEFORE starting the app
- Check `.env.local` has `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`

---

## Testing Workflow

1. **Start Emulators** (once per session)
2. **Start Dev Server**
3. **Create test account** in the app
4. **Add API keys** via Settings page
5. **Test features** (CRM, AI chat, etc.)
6. **View data** at http://localhost:4000
7. **Stop servers** when done (Ctrl+C)

Your data persists between sessions!

---

## Next Steps After Emulators Are Running

1. ✅ Create a test user account
2. ✅ Create an organization
3. ✅ Go to Settings → API Keys
4. ✅ Add your OpenRouter key
5. ✅ Add SendGrid key (if you have one)
6. ✅ Test creating a lead in CRM
7. ✅ Test AI chat
8. ✅ Find bugs and we'll fix them!

---

## When You're Ready for Production

To switch from emulators to real Firebase:

1. Create Firebase project at https://console.firebase.google.com
2. Copy the config
3. In `.env.local`, change:
   - Set `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false`
   - Add your real Firebase config
4. Restart the app

**Your code stays exactly the same!** 🎉

---

## Quick Reference

| What | Command |
|------|---------|
| Install Firebase CLI | `npm install -g firebase-tools` |
| Start Emulators Only | `firebase emulators:start` |
| Start Everything | Double-click `start-dev-with-emulators.bat` |
| View Database | http://localhost:4000 |
| Stop Emulators | Press Ctrl+C |

---

## You're All Set!

Just run:
```powershell
# Install Firebase CLI (once)
npm install -g firebase-tools

# Start everything
.\start-dev-with-emulators.bat
```

Then go to http://localhost:3000 and start testing! 🚀







