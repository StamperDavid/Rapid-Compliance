# Vercel Environment Variables Setup - Complete Guide

## Overview
Your Vercel deployments need Firebase credentials to connect to the correct databases.

---

## Step 1: Go to Vercel Dashboard

1. Open https://vercel.com/dashboard
2. Find your project: **ai-sales-platform** (or whatever it's named)
3. Click on the project
4. Go to **Settings** tab
5. Click **Environment Variables** in the left sidebar

---

## Step 2: Add Production Environment Variables

For each variable below, click **Add New**:

### Variable 1:
- **Key**: `NEXT_PUBLIC_FIREBASE_API_KEY`
- **Value**: `AIzaSyAuoM61E76vsHrKIXvZuMdhJMwsxEFn1PA`
- **Environments**: ✅ Production only

### Variable 2:
- **Key**: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- **Value**: `ai-sales-platform-4f5e4.firebaseapp.com`
- **Environments**: ✅ Production only

### Variable 3:
- **Key**: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- **Value**: `ai-sales-platform-4f5e4`
- **Environments**: ✅ Production only

### Variable 4:
- **Key**: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- **Value**: `ai-sales-platform-4f5e4.firebasestorage.app`
- **Environments**: ✅ Production only

### Variable 5:
- **Key**: `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- **Value**: `97257356518`
- **Environments**: ✅ Production only

### Variable 6:
- **Key**: `NEXT_PUBLIC_FIREBASE_APP_ID`
- **Value**: `1:97257356518:web:4e51eeb7e1a95e52018f27`
- **Environments**: ✅ Production only

---

## Step 3: Add Preview/Development Environment Variables

Repeat the same process, but use DEV credentials and select **Preview** environment:

### Variable 1:
- **Key**: `NEXT_PUBLIC_FIREBASE_API_KEY`
- **Value**: `AIzaSyACl4kQYDPc4cgWat4cGpc7vinvEPjT8EI`
- **Environments**: ✅ Preview only

### Variable 2:
- **Key**: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- **Value**: `ai-sales-platform-dev.firebaseapp.com`
- **Environments**: ✅ Preview only

### Variable 3:
- **Key**: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- **Value**: `ai-sales-platform-dev`
- **Environments**: ✅ Preview only

### Variable 4:
- **Key**: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- **Value**: `ai-sales-platform-dev.firebasestorage.app`
- **Environments**: ✅ Preview only

### Variable 5:
- **Key**: `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- **Value**: `1004950247006`
- **Environments**: ✅ Preview only

### Variable 6:
- **Key**: `NEXT_PUBLIC_FIREBASE_APP_ID`
- **Value**: `1:1004950247006:web:dfe77953cdd95edaba46cf`
- **Environments**: ✅ Preview only

---

## Step 4: Redeploy (Important!)

After adding all variables:

1. Go to **Deployments** tab in Vercel
2. Find your latest deployment
3. Click the **three dots** menu → **Redeploy**
4. Select **Redeploy with existing Build Cache**

This ensures the new environment variables take effect.

---

## Step 5: Verify Setup

### Check Production (salesvelocity.ai):
1. Visit https://salesvelocity.ai
2. Open browser console (F12)
3. Look for Firebase initialization
4. Should connect to `ai-sales-platform-4f5e4`

### Check Preview (dev branch):
1. Push to dev branch: `git push origin development`
2. Vercel will create a preview URL
3. Open preview URL
4. Check browser console
5. Should connect to `ai-sales-platform-dev`

### Check Local:
1. Run `npm run dev`
2. Open http://localhost:3000
3. Check browser console
4. Should connect to `ai-sales-platform-dev` (from `.env.local`)

---

## Final Environment Summary

| Environment | URL | Firebase Project | Database |
|-------------|-----|------------------|----------|
| **Local** | localhost:3000 | `ai-sales-platform-dev` | Dev data |
| **Preview** | vercel-preview-url | `ai-sales-platform-dev` | Dev data |
| **Production** | salesvelocity.ai | `ai-sales-platform-4f5e4` | Live data |

---

## Troubleshooting

### "Firebase not configured" error on Vercel:
- Make sure all 6 variables are added
- Make sure you selected the correct environment (Production vs Preview)
- Redeploy after adding variables

### Production still using dev database (or vice versa):
- Check the `NEXT_PUBLIC_FIREBASE_PROJECT_ID` variable
- Make sure it matches the intended project
- Redeploy

### Preview deployments not working:
- Vercel Preview is triggered by pushes to non-main branches
- Make sure you're pushing to `development` branch
- Check Vercel project settings → Git → Production Branch is set to `main`

---

## Quick Copy-Paste Format

**Production Variables:**
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAuoM61E76vsHrKIXvZuMdhJMwsxEFn1PA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ai-sales-platform-4f5e4.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-sales-platform-4f5e4
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ai-sales-platform-4f5e4.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=97257356518
NEXT_PUBLIC_FIREBASE_APP_ID=1:97257356518:web:4e51eeb7e1a95e52018f27
```

**Preview Variables:**
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyACl4kQYDPc4cgWat4cGpc7vinvEPjT8EI
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ai-sales-platform-dev.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-sales-platform-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ai-sales-platform-dev.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1004950247006
NEXT_PUBLIC_FIREBASE_APP_ID=1:1004950247006:web:dfe77953cdd95edaba46cf
```

---

## Checklist

- [ ] Added 6 Production environment variables in Vercel
- [ ] Added 6 Preview environment variables in Vercel
- [ ] Redeployed production after adding variables
- [ ] Verified production connects to correct database
- [ ] Verified preview connects to dev database
- [ ] Verified local connects to dev database
- [ ] Set user passwords in dev Firebase (if not done)
- [ ] Tested login on all three environments

---

## ✅ Once Complete

Your complete workflow will be:
1. **Develop locally** → Changes saved to dev database
2. **Push to development branch** → Preview deployment uses dev database
3. **Test preview** → Safe testing with dev data
4. **Push to main branch** → Production deployment uses production database
5. **Live site** → Real users, real data, completely separate from dev

**All environments properly isolated!** 🎉



