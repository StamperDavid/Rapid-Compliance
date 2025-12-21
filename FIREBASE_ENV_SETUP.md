# Firebase Environment Variables Setup - Best Practices

## Overview
This project uses a **multi-environment setup** to keep development and production databases completely separated. This follows Next.js and industry best practices.

## Problem That Was Fixed
The Firebase config was previously hardcoded to production, causing both local and live environments to share the same database. Now it uses environment variables with proper precedence to separate them.

---

## Environment Files Structure

We use 4 environment files:

| File | Purpose | Git Tracked | Contains |
|------|---------|-------------|----------|
| `.env.example` | Template for developers | ✅ Yes | Example values only |
| `.env.development` | Dev defaults (shared) | ✅ Yes | Non-sensitive dev defaults |
| `.env.production` | Prod defaults (shared) | ✅ Yes | Non-sensitive prod defaults |
| `.env.local` | **Your personal config** | ❌ No (gitignored) | **Your actual dev credentials** |

### Loading Priority (Next.js)
Next.js loads environment variables in this order (later overrides earlier):

1. `.env.development` or `.env.production` (based on `NODE_ENV`)
2. `.env.local` (your personal overrides) ← **This is where your dev Firebase credentials go**
3. Environment variables from hosting (Vercel dashboard)

---

## Quick Setup Guide

### Step 1: Get Your Dev Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your **`ai-sales-platform-dev`** project (NOT the production one!)
3. Click the gear icon ⚙️ > **Project settings**
4. Scroll down to **"Your apps"** section
5. Click on your web app or create one if it doesn't exist
6. Copy the `firebaseConfig` values

### Step 2: Update Your `.env.local` File

The `.env.local` file has been created with placeholders. Replace the `YOUR_DEV_*` values with the actual credentials you just copied:

```env
# Firebase Configuration (DEVELOPMENT PROJECT)
NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_dev_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ai-sales-platform-dev.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-sales-platform-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ai-sales-platform-dev.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_actual_app_id
```

### Step 3: Restart Your Dev Server

```bash
# Stop your current dev server (Ctrl+C)
npm run dev
```

### Step 4: Verify It's Working

Open your browser console and check:
- No Firebase errors
- You're connecting to the dev project (`ai-sales-platform-dev`)
- Data you create locally doesn't appear in production

---

## Vercel Production Setup

### Set Environment Variables in Vercel Dashboard

1. Go to your Vercel project
2. **Settings** → **Environment Variables**
3. Add these variables for the **Production** environment:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAuoM61E76vsHrKIXvZuMdhJMwsxEFn1PA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ai-sales-platform-4f5e4.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-sales-platform-4f5e4
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ai-sales-platform-4f5e4.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=97257356518
NEXT_PUBLIC_FIREBASE_APP_ID=1:97257356518:web:4e51eeb7e1a95e52018f27
```

### (Optional) Set Preview Environment Variables

For Vercel preview deployments (dev branch), add the same variables but:
- Select **Preview** environment
- Use your **dev** project credentials

This way your preview deployments also use the dev database.

---

## How It Works

### 🖥️ Local Development
- Reads from **`.env.local`** (your personal file)
- Connects to **`ai-sales-platform-dev`** Firebase project
- ✅ Data created locally stays in dev database

### 🚀 Vercel Production
- Reads from **Vercel environment variables**
- Connects to **`ai-sales-platform-4f5e4`** Firebase project
- ✅ Data created in production stays in production database

### 👀 Vercel Preview (dev branch)
- Reads from **Vercel Preview environment variables**
- Can connect to dev project for safe testing
- ✅ Changes don't affect production

---

## Troubleshooting

### "Firebase not configured" Error
- Make sure you updated `.env.local` with actual credentials (not the `YOUR_DEV_*` placeholders)
- Restart your dev server after changing `.env.local`
- Check that all required variables are set

### Local Changes Appear in Production
- Check your `.env.local` - make sure `NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-sales-platform-dev`
- If it says `ai-sales-platform-4f5e4`, you're still pointing to production!

### Can't Find Dev Project Credentials
- Make sure you selected the correct project in Firebase Console
- If you don't have a dev project, you may need to create one or use Firebase Emulator

---

## Security Best Practices

✅ **DO:**
- Keep credentials in `.env.local` (gitignored)
- Use dev credentials for local development
- Set production credentials only in Vercel dashboard
- Use `.env.example` as a template for team members

❌ **DON'T:**
- Commit `.env.local` to git
- Put production credentials in code or committed files
- Share credentials in Slack/email (use secure methods)
- Use production database for testing

---

## Additional Notes

- Both dev and production projects should have the same:
  - Security rules
  - Firestore structure
  - Cloud Functions
- This ensures consistency when deploying to production
- Use Firebase Emulator for even safer local development (no Firebase project needed)



