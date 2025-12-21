# DAY 1 PROGRESS: Setup & Foundation

**Date Started:** December 4, 2025  
**Goal:** Get Firebase + OpenRouter + SendGrid working  
**Estimated Time:** 6-8 hours  
**Current Status:** NOT STARTED ⏳

---

## 🎯 MORNING SESSION (3-4 hours): Firebase Setup

### Step 1: Create Firebase Project (30 minutes)

- [ ] **Go to:** https://console.firebase.google.com
- [ ] Click "Add project" or "Create a project"
- [ ] **Project name:** `AI Sales Platform` (or whatever you prefer)
- [ ] **Optional:** Disable Google Analytics (you can add later)
- [ ] Wait for project to be created (takes ~1 minute)

### Step 2: Enable Firebase Authentication (5 minutes)

- [ ] In Firebase Console, click **"Authentication"** in left sidebar
- [ ] Click **"Get Started"**
- [ ] Click **"Sign-in method"** tab
- [ ] Click **"Email/Password"**
- [ ] Toggle **Enable** (first switch only, not "Email link")
- [ ] Click **"Save"**

### Step 3: Create Firestore Database (5 minutes)

- [ ] In Firebase Console, click **"Firestore Database"** in left sidebar
- [ ] Click **"Create database"**
- [ ] Select **"Start in test mode"** (we'll deploy real rules later)
- [ ] Choose location: **us-central** (or closest to you)
- [ ] Click **"Enable"**
- [ ] Wait for database to be created (takes ~30 seconds)

### Step 4: Get Firebase Configuration (5 minutes)

- [ ] In Firebase Console, click ⚙️ (Settings) icon → **"Project settings"**
- [ ] Scroll down to **"Your apps"** section
- [ ] Click the **</>** (Web) icon
- [ ] **App nickname:** `AI Sales Platform Web`
- [ ] **Don't** check "Also set up Firebase Hosting"
- [ ] Click **"Register app"**
- [ ] **COPY the firebaseConfig object** - you'll see something like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

**⚠️ IMPORTANT:** Don't click "Continue to console" yet - keep this page open!

### Step 5: Add Firebase Config to .env.local (10 minutes)

**Open your `.env.local` file** (in the root of the project) and update these values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...        # Copy from firebaseConfig.apiKey
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

**Save the file!**

### Step 6: Restart Development Server (2 minutes)

The server should auto-reload, but if not:

- [ ] Stop the server (Ctrl+C in terminal 34)
- [ ] Run: `npm run dev`
- [ ] Check console - **"Firebase Auth is not configured"** warning should be GONE

### Step 7: Test Firebase Connection (5 minutes)

- [ ] Open browser: http://localhost:3000
- [ ] Try to sign up for a new account
- [ ] **Expected:** Should work now!
- [ ] **If it fails:** Check browser console (F12) for errors

### Step 8: Deploy Firestore Security Rules (5 minutes)

**In your terminal, run:**

```bash
firebase login
firebase use --add
# Select your project from the list
firebase deploy --only firestore:rules
```

**Expected output:** ✅ Deploy complete!

---

## ☕ BREAK (10-15 minutes)

You've just configured the entire database and authentication system. Take a break!

---

## 🎯 AFTERNOON SESSION (3-4 hours): API Keys Setup

### Step 9: Sign Up for OpenRouter (10 minutes)

- [ ] **Go to:** https://openrouter.ai
- [ ] Click **"Sign In"** (top right)
- [ ] Sign in with Google/GitHub (or create account)
- [ ] Click your profile → **"Keys"**
- [ ] Click **"Create Key"**
- [ ] **Name:** `AI Sales Platform`
- [ ] **Copy the API key** (starts with `sk-or-v1-...`)
- [ ] **⚠️ SAVE IT SOMEWHERE** - you can only see it once!

**Why OpenRouter?**
- One API key works with GPT-4, Claude, Gemini, and 100+ models
- Pay-as-you-go pricing (no monthly fees)
- Cheaper than using OpenAI/Anthropic directly

### Step 10: Add OpenRouter Key to Platform (5 minutes)

**Option A: Via Admin UI (Recommended)**
- [ ] Open: http://localhost:3000/admin/system/api-keys
- [ ] Click **"Add API Key"**
- [ ] **Service:** OpenRouter
- [ ] **API Key:** Paste your `sk-or-v1-...` key
- [ ] Click **"Save"**

**Option B: Via .env.local (Backup)**
```env
OPENAI_API_KEY=sk-or-v1-...  # OpenRouter key also works here
```

### Step 11: Test AI Chat (5 minutes)

- [ ] Navigate to AI chat page in the app
- [ ] Send a test message: "Hello, are you working?"
- [ ] **Expected:** Should get a response within 5-10 seconds
- [ ] **If it fails:** Check browser console and terminal for errors

**✅ SUCCESS:** If AI responds, OpenRouter is working!

---

### Step 12: Sign Up for SendGrid (15 minutes)

- [ ] **Go to:** https://sendgrid.com
- [ ] Click **"Start for free"** or **"Sign Up"**
- [ ] Fill out signup form
- [ ] **Choose:** Free plan (100 emails/day - enough for testing)
- [ ] **Verify your email address** (check inbox)
- [ ] Complete account setup

### Step 13: Create SendGrid API Key (5 minutes)

- [ ] Log in to SendGrid
- [ ] Click **"Settings"** (left sidebar) → **"API Keys"**
- [ ] Click **"Create API Key"**
- [ ] **Name:** `AI Sales Platform`
- [ ] **Permissions:** Full Access (or Restricted Access with Mail Send)
- [ ] Click **"Create & View"**
- [ ] **Copy the API key** (starts with `SG.`)
- [ ] **⚠️ SAVE IT SOMEWHERE** - you can only see it once!

### Step 14: Verify Sender Email (15 minutes)

**This is REQUIRED or emails won't send!**

- [ ] In SendGrid, click **"Settings"** → **"Sender Authentication"**
- [ ] Click **"Verify a Single Sender"**
- [ ] Fill out form:
  - **From Name:** Your Name or Company Name
  - **From Email Address:** your-email@gmail.com (use real email)
  - **Reply To:** Same as From Email
  - **Company Address:** Can be home address for testing
- [ ] Click **"Create"**
- [ ] **Check your email inbox** - SendGrid sent a verification email
- [ ] **Click the verification link** in the email
- [ ] **Wait** for "Verified" status in SendGrid dashboard

### Step 15: Add SendGrid Key to Platform (5 minutes)

**Option A: Via Admin UI (Recommended)**
- [ ] Open: http://localhost:3000/admin/system/api-keys
- [ ] Click **"Add API Key"**
- [ ] **Service:** SendGrid
- [ ] **API Key:** Paste your `SG.` key
- [ ] Click **"Save"**

**Option B: Via .env.local (Backup)**
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=your-verified-email@gmail.com
FROM_NAME=Your Name
```

### Step 16: Test Email Sending (10 minutes)

**Try sending a test email:**

- [ ] Navigate to email/campaign settings in the app
- [ ] Try to send a test email to yourself
- [ ] **Expected:** Email arrives within 1-2 minutes
- [ ] **Check spam folder** if you don't see it in inbox
- [ ] **If it fails:**
  - Check that sender email is verified in SendGrid
  - Check terminal logs for errors
  - Check SendGrid dashboard → Activity for delivery status

**✅ SUCCESS:** If email arrives, SendGrid is working!

---

## 🎉 END OF DAY 1 CHECKLIST

### What MUST be working:
- [ ] Firebase connected (no console errors)
- [ ] Can sign up for new account
- [ ] Can log in/out
- [ ] OpenRouter API key stored
- [ ] AI chat responds to messages
- [ ] SendGrid API key stored
- [ ] Sender email verified
- [ ] Test email sent successfully

### Bugs Found Today:
1. 
2. 
3. 

### Bugs Fixed Today:
1. 
2. 

### Notes / Issues:


---

## 🚨 TROUBLESHOOTING

### "Firebase Auth is not configured"
→ Check `.env.local` has all NEXT_PUBLIC_FIREBASE_* variables  
→ Restart dev server after editing .env.local

### "AI chat not responding"
→ Check OpenRouter API key is added  
→ Check browser console for "401 Unauthorized" errors  
→ Make sure you have credits on OpenRouter account

### "Email not sending"
→ Check SendGrid sender email is VERIFIED (green checkmark)  
→ Check SendGrid API key has "Mail Send" permissions  
→ Check SendGrid Activity Feed for bounce/error details

### "Cannot read properties of undefined"
→ Firestore database not created yet  
→ Security rules not deployed

---

## ⏱️ TIME TRACKING

**Start Time:**  
**End Time:**  
**Total Hours:**  
**Productivity:** ⭐⭐⭐⭐⭐ (1-5 stars)

---

## 📝 TOMORROW'S PRIORITY (Day 2)

Once Day 1 is complete, we'll move to **Day 2: Test Authentication**
- Test user registration flow
- Test login/logout
- Test password reset
- Create 2-3 test accounts
- Verify data saves to Firestore

**Don't worry about perfection - just get the basics working!**














