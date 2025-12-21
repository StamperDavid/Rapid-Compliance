# 🔧 Development Environment Setup Plan

## Overview

This document outlines the complete setup for a 3-stage development workflow:
- **LOCAL** → Your PC, for development and initial testing
- **DEV/STAGING** → Vercel preview, connected to Dev Firebase
- **PRODUCTION** → Live site, connected to Prod Firebase

**Goal:** Never break production. Test everything in dev first.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              GIT WORKFLOW                                     │
└──────────────────────────────────────────────────────────────────────────────┘

   LOCAL (Your PC)              GITHUB                         VERCEL
   ─────────────────            ────────────────               ─────────────────
   
   Work on code          ──►    develop branch    ──────────►  Preview Deploy
   npm run dev                       │                         (dev.yoursite.com)
   npm run build                     │                              │
        │                            │                              ▼
        │                       Pull Request                   Dev Firebase
        │                       & Merge                        (safe to break)
        │                            │
        │                            ▼
        │                       main branch       ──────────►  Production Deploy
        │                                                      (yoursite.com)
        │                                                           │
        │                                                           ▼
        │                                                      Prod Firebase
        │                                                      (protected)
        │
        ▼
   Dev Firebase (same as staging)
```

---

## PHASE 1: Create Development Firebase Project

### Step 1.1: Go to Firebase Console

1. Open browser: **https://console.firebase.google.com**
2. Sign in with your Google account (same one used for production Firebase)

### Step 1.2: Create New Project

1. Click the **"Add project"** button (or "+ Add project" card)
2. Enter project name: `ai-sales-platform-dev`
   - This name helps you distinguish from production
3. Click **Continue**
4. **Disable Google Analytics** (toggle OFF) - not needed for dev
5. Click **Create project**
6. Wait for project creation (30 seconds)
7. Click **Continue** when done

### Step 1.3: Enable Firestore Database

1. In left sidebar, click **Build** (expand if needed)
2. Click **Firestore Database**
3. Click **Create database**
4. Select **Start in test mode**
   - This allows all reads/writes for 30 days (fine for dev)
5. Click **Next**
6. Select location: **nam5 (us-central)** or same as your production
   - ⚠️ Location cannot be changed later
7. Click **Enable**
8. Wait for database provisioning

### Step 1.4: Enable Authentication

1. In left sidebar, click **Build** → **Authentication**
2. Click **Get started**
3. Click **Email/Password** under "Native providers"
4. Toggle **Enable** to ON
5. Leave "Email link" OFF
6. Click **Save**

### Step 1.5: Enable Storage (Optional but Recommended)

1. In left sidebar, click **Build** → **Storage**
2. Click **Get started**
3. Select **Start in test mode**
4. Click **Next**
5. Select same location as Firestore
6. Click **Done**

### Step 1.6: Get Web App Config

1. Click the **gear icon** ⚙️ next to "Project Overview" (top left)
2. Click **Project settings**
3. Scroll down to **"Your apps"** section
4. Click **Add app**
5. Click the **Web** icon `</>`
6. Enter nickname: `dev-web-app`
7. Leave "Firebase Hosting" unchecked
8. Click **Register app**
9. You'll see a code block with `firebaseConfig` - **COPY THESE VALUES:**

```javascript
// COPY THESE VALUES - YOU'LL NEED THEM IN PHASE 2
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "ai-sales-platform-dev.firebaseapp.com",
  projectId: "ai-sales-platform-dev",
  storageBucket: "ai-sales-platform-dev.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

10. Click **Continue to console**

### Step 1.7: Get Service Account Key (for Admin SDK)

1. Still in Project Settings, click **Service accounts** tab (at top)
2. Make sure **Firebase Admin SDK** is selected
3. Click **Generate new private key**
4. Click **Generate key** in the popup
5. A JSON file will download - **KEEP THIS SAFE**
6. Open the JSON file and note these values:
   - `project_id`
   - `client_email`
   - `private_key` (long string starting with `-----BEGIN PRIVATE KEY-----`)

---

## PHASE 2: Configure Environment Files

### Step 2.1: Create Local Development Environment File

Create/update file: `.env.local`

```bash
# ============================================
# LOCAL DEVELOPMENT ENVIRONMENT
# Points to DEV Firebase (safe to break)
# ============================================

# Firebase Client SDK (from Step 1.6)
NEXT_PUBLIC_FIREBASE_API_KEY=your-dev-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ai-sales-platform-dev.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-sales-platform-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ai-sales-platform-dev.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-dev-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-dev-app-id

# Firebase Admin SDK (from Step 1.7 JSON file)
FIREBASE_ADMIN_PROJECT_ID=ai-sales-platform-dev
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@ai-sales-platform-dev.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Environment indicator (for debugging)
NEXT_PUBLIC_ENVIRONMENT=development
```

### Step 2.2: Create Production Environment File (Reference Only)

Create file: `.env.production.example` (this is a TEMPLATE - actual values go in Vercel)

```bash
# ============================================
# PRODUCTION ENVIRONMENT (Vercel)
# DO NOT COMMIT REAL VALUES - ADD TO VERCEL DASHBOARD
# ============================================

# Firebase Client SDK (PRODUCTION PROJECT)
NEXT_PUBLIC_FIREBASE_API_KEY=your-prod-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-prod-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-prod-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-prod-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-prod-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-prod-app-id

# Firebase Admin SDK (PRODUCTION PROJECT)
FIREBASE_ADMIN_PROJECT_ID=your-prod-project
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your-prod-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# App URL
NEXT_PUBLIC_APP_URL=https://yoursite.com

# Environment indicator
NEXT_PUBLIC_ENVIRONMENT=production
```

### Step 2.3: Update .gitignore

Make sure `.gitignore` includes:

```
# Environment files with secrets
.env.local
.env.production.local
.env*.local

# Firebase service account keys
*-firebase-adminsdk-*.json
service-account*.json
```

---

## PHASE 3: Set Up Git Branching

### Step 3.1: Create Develop Branch

Open terminal in project folder:

```powershell
# Make sure you're on main and up to date
git checkout main
git pull origin main

# Create develop branch
git checkout -b develop

# Push develop branch to GitHub
git push -u origin develop
```

### Step 3.2: Set Develop as Default Working Branch

From now on, your workflow is:
1. Always work on `develop` (or feature branches off develop)
2. Only merge to `main` when ready for production

---

## PHASE 4: Configure Vercel Environments

### Step 4.1: Access Vercel Project Settings

1. Go to **https://vercel.com/dashboard**
2. Click on your project (AI Sales Platform)
3. Click **Settings** tab (top navigation)

### Step 4.2: Configure Environment Variables

1. Click **Environment Variables** in left sidebar
2. You need to add variables for TWO environments:

#### For Preview Environment (uses Dev Firebase):

Add each variable with **"Preview"** checkbox ONLY:

| Key | Value | Environment |
|-----|-------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | (dev value) | Preview |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | (dev value) | Preview |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `ai-sales-platform-dev` | Preview |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | (dev value) | Preview |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | (dev value) | Preview |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | (dev value) | Preview |
| `FIREBASE_ADMIN_PROJECT_ID` | `ai-sales-platform-dev` | Preview |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | (dev value) | Preview |
| `FIREBASE_ADMIN_PRIVATE_KEY` | (dev value) | Preview |
| `NEXT_PUBLIC_ENVIRONMENT` | `staging` | Preview |

#### For Production Environment (uses Prod Firebase):

Add each variable with **"Production"** checkbox ONLY:

| Key | Value | Environment |
|-----|-------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | (prod value) | Production |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | (prod value) | Production |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | (your prod project) | Production |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | (prod value) | Production |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | (prod value) | Production |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | (prod value) | Production |
| `FIREBASE_ADMIN_PROJECT_ID` | (prod value) | Production |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | (prod value) | Production |
| `FIREBASE_ADMIN_PRIVATE_KEY` | (prod value) | Production |
| `NEXT_PUBLIC_ENVIRONMENT` | `production` | Production |

### Step 4.3: Configure Branch Deployments

1. In Vercel Settings, click **Git** in left sidebar
2. Under "Production Branch", ensure it says: `main`
3. Preview deployments automatically happen for all other branches

### Step 4.4: (Optional) Set Up Custom Domain for Staging

1. Click **Domains** in left sidebar
2. Add domain: `dev.yoursite.com` or `staging.yoursite.com`
3. In the domain settings, set **Git Branch** to `develop`
4. This gives you a consistent URL for testing instead of random preview URLs

---

## PHASE 5: Deploy Firestore Rules to Dev

### Step 5.1: Install Firebase CLI (if not installed)

```powershell
npm install -g firebase-tools
```

### Step 5.2: Login to Firebase CLI

```powershell
firebase login
```

### Step 5.3: Add Dev Project to Firebase Config

Check your `firebase.json` - it should exist. 

Check/create `.firebaserc`:

```json
{
  "projects": {
    "default": "ai-sales-platform-dev",
    "dev": "ai-sales-platform-dev",
    "prod": "your-production-project-id"
  }
}
```

### Step 5.4: Deploy Rules to Dev

```powershell
# Deploy to dev project
firebase use dev
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

### Step 5.5: Deploy Rules to Prod (when ready)

```powershell
# Deploy to prod project
firebase use prod
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

---

## PHASE 6: Daily Workflow

### The Development Cycle

```
┌─────────────────────────────────────────────────────────────────┐
│                     DAILY WORKFLOW                               │
└─────────────────────────────────────────────────────────────────┘

1. START WORK
   ─────────────────────────────────────────────────────────────
   git checkout develop
   git pull origin develop
   npm run dev

2. MAKE CHANGES
   ─────────────────────────────────────────────────────────────
   - Edit code
   - Test at localhost:3000
   - Uses DEV Firebase (safe)

3. BEFORE COMMITTING - TEST BUILD
   ─────────────────────────────────────────────────────────────
   npm run build
   
   ✅ Build passes? → Continue to step 4
   ❌ Build fails? → Fix TypeScript errors first!

4. COMMIT AND PUSH TO DEVELOP
   ─────────────────────────────────────────────────────────────
   git add .
   git commit -m "Description of changes"
   git push origin develop
   
   → Vercel auto-deploys to preview URL
   → Uses DEV Firebase

5. TEST ON VERCEL PREVIEW
   ─────────────────────────────────────────────────────────────
   - Go to Vercel dashboard
   - Click on the deployment
   - Test the preview URL
   - Verify everything works with Dev Firebase

6. READY FOR PRODUCTION? MERGE TO MAIN
   ─────────────────────────────────────────────────────────────
   git checkout main
   git pull origin main
   git merge develop
   git push origin main
   
   → Vercel auto-deploys to production
   → Uses PROD Firebase
```

---

## Troubleshooting

### Issue: Build Works Locally, Fails on Vercel

**Cause:** TypeScript strict mode catches errors that dev server ignores.

**Prevention:** Always run `npm run build` locally before pushing.

**Common Errors:**
- Missing imports → File doesn't exist or typo
- Type errors → Property doesn't exist on type
- Unused imports → Remove them

### Issue: Can't Connect to Firebase

**Check:**
1. Environment variables are set correctly in Vercel
2. `FIREBASE_ADMIN_PRIVATE_KEY` has proper escaping (newlines as `\n`)
3. Project ID matches exactly

### Issue: Data Showing in Wrong Environment

**Check:**
1. Verify which Firebase project you're connected to
2. Check `NEXT_PUBLIC_FIREBASE_PROJECT_ID` value
3. Clear browser cache/cookies

### Issue: Rules Deployment Fails

**Check:**
1. You're logged into Firebase CLI: `firebase login`
2. You're using correct project: `firebase use dev` or `firebase use prod`
3. You have permission on the Firebase project

---

## Quick Reference

### Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start local development server |
| `npm run build` | Test production build (RUN BEFORE EVERY PUSH) |
| `firebase use dev` | Switch to dev Firebase project |
| `firebase use prod` | Switch to prod Firebase project |
| `firebase deploy --only firestore:rules` | Deploy Firestore rules |
| `git checkout develop` | Switch to develop branch |
| `git checkout main` | Switch to main branch |

### URLs

| Environment | URL | Firebase |
|-------------|-----|----------|
| Local | http://localhost:3000 | Dev |
| Staging/Preview | (Vercel preview URL) | Dev |
| Production | https://yoursite.com | Prod |

### Files

| File | Purpose |
|------|---------|
| `.env.local` | Local environment variables (DEV Firebase) |
| `.firebaserc` | Firebase project aliases |
| `firebase.json` | Firebase configuration |
| `firestore.rules` | Firestore security rules |
| `firestore.indexes.json` | Firestore indexes |

---

## Checklist

### Phase 1: Firebase Dev Project
- [ ] Created `ai-sales-platform-dev` project
- [ ] Enabled Firestore (test mode)
- [ ] Enabled Authentication (Email/Password)
- [ ] Enabled Storage (test mode)
- [ ] Got web app config values
- [ ] Downloaded service account JSON

### Phase 2: Environment Files
- [ ] Created `.env.local` with dev values
- [ ] Updated `.gitignore`

### Phase 3: Git Branches
- [ ] Created `develop` branch
- [ ] Pushed to GitHub

### Phase 4: Vercel Configuration
- [ ] Added Preview environment variables (Dev Firebase)
- [ ] Added Production environment variables (Prod Firebase)
- [ ] Verified branch deployment settings

### Phase 5: Firebase Rules
- [ ] Updated `.firebaserc` with both projects
- [ ] Deployed rules to dev project
- [ ] Deployed rules to prod project

### Phase 6: Test the Workflow
- [ ] Made test change on develop
- [ ] Verified build passes locally
- [ ] Pushed to develop
- [ ] Verified Vercel preview works
- [ ] Merged to main
- [ ] Verified production works

---

## Notes

- **Never commit `.env.local`** - it contains secrets
- **Always run `npm run build` before pushing** - catches TypeScript errors
- **Dev Firebase is disposable** - break it, reset it, experiment freely
- **Prod Firebase is protected** - only deploy after testing in dev





