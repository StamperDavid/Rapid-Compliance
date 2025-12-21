# 🚀 Quick Start: Environment Setup

**You need to update your `.env.local` file with dev Firebase credentials to get your local environment working!**

---

## ⚡ 3-Minute Setup

### 1. Get Dev Credentials (2 minutes)

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select **`ai-sales-platform-dev`** project
3. Click ⚙️ > Project settings > Your apps
4. Copy the config values

### 2. Update `.env.local` (1 minute)

Open `.env.local` in your project root and replace these placeholders:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_DEV_API_KEY_HERE          ← Replace this
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ai-sales-platform-dev.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-sales-platform-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ai-sales-platform-dev.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_DEV_SENDER_ID_HERE  ← Replace this
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_DEV_APP_ID_HERE           ← Replace this
```

### 3. Restart Dev Server

```bash
npm run dev
```

**Done!** Your local environment now uses the dev database, completely separate from production.

---

## 📁 What Changed?

### New Files Created:
- ✅ `.env.example` - Template for team (committed to git)
- ✅ `.env.development` - Dev defaults (committed to git)
- ✅ `.env.production` - Prod defaults (committed to git)
- ✅ `.env.local` - **Your personal dev config** (gitignored)

### Updated Files:
- ✅ `src/lib/firebase/config.ts` - Now reads from environment variables
- ✅ `FIREBASE_ENV_SETUP.md` - Complete documentation

---

## ✅ Current Status

| Environment | Firebase Project | Status |
|-------------|------------------|--------|
| **Local (your machine)** | `ai-sales-platform-dev` | ⚠️ **Needs your action** - Update `.env.local` |
| **Vercel Production** | `ai-sales-platform-4f5e4` | ⚠️ **Needs setup** - Add env vars in Vercel dashboard |
| **Vercel Preview** | Not configured yet | ⏳ Optional - Set up later |

---

## 🔥 Important!

**Until you update `.env.local` with dev credentials:**
- Your local environment **won't work** (Firebase not configured error)
- You need to complete Step 1 & 2 above to fix this

**For production to work on Vercel:**
- You need to add the production Firebase credentials to Vercel environment variables
- See `FIREBASE_ENV_SETUP.md` for detailed instructions

---

## 📖 Need More Help?

See `FIREBASE_ENV_SETUP.md` for:
- Detailed step-by-step instructions
- Vercel setup guide
- Troubleshooting tips
- Security best practices



