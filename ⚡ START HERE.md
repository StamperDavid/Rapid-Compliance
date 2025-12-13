# ⚡ START HERE - Quick Setup Guide

## You're 2 Commands Away From Testing!

### Step 1: Install Firebase CLI (One-Time)
```powershell
npm install -g firebase-tools
```

### Step 2: Start Everything
```powershell
.\start-dev-with-emulators.bat
```

**That's it!** 🎉

---

## What Just Happened?

- ✅ Firebase Emulators configured (local database)
- ✅ TypeScript build error fixed
- ✅ Error handling added to API routes  
- ✅ Loading states created for UI
- ✅ OpenRouter API key system ready

---

## Access Your App

- **App**: http://localhost:3000
- **Database UI**: http://localhost:4000 ← View your data here!

---

## Add Your OpenRouter Key

1. Go to http://localhost:3000
2. **Sign Up** (creates local test account)
3. **Create Organization**
4. Go to **Settings → API Keys**
5. **Paste your OpenRouter key**
6. **Save**

Now AI chat will work!

---

## What You Can Test Now

✅ User authentication (sign up/login)  
✅ Creating leads/contacts/deals  
✅ AI chat (with OpenRouter key)  
✅ CRM features  
✅ Workflows  
✅ Analytics  
✅ Email campaigns (with SendGrid key)

Everything saves to your local database!

---

## Need More Details?

- **Emulator Setup**: `EMULATOR_SETUP_INSTRUCTIONS.md`
- **What I Just Did**: `SETUP_COMPLETE.md`
- **Full Guide**: `LOCAL_DEVELOPMENT_GUIDE.md`
- **Project Status**: `PROJECT_STATUS.md`

---

## Troubleshooting

### "firebase: command not found"
```powershell
npm install -g firebase-tools
```

### Port Already in Use
Close other apps or change ports in `firebase.json`

### App Can't Connect
Make sure emulators start BEFORE the app

---

## Ready to Test!

```powershell
npm install -g firebase-tools
.\start-dev-with-emulators.bat
```

Then open http://localhost:3000 🚀

---

**Questions?** Read `SETUP_COMPLETE.md` for full details!










