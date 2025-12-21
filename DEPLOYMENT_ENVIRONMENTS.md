# 🚀 Three-Environment Deployment Setup

## Overview

This platform uses three isolated environments to ensure safe development and deployment:

| Environment | Branch | URL | Firebase Project | Purpose |
|-------------|--------|-----|------------------|---------|
| **Development** | `development` | `localhost:3000` | `ai-sales-platform-dev` | Local coding & testing |
| **Staging** | `staging` | `staging.salesvelocity.ai` | `ai-sales-platform-staging` | Pre-production testing |
| **Production** | `main` | `salesvelocity.ai` | `ai-sales-platform-4f5e4` | Live customers |

---

## Step 1: Create Additional Firebase Projects

You need to create 2 new Firebase projects for development and staging.

### Create Development Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add Project**
3. Name it: `ai-sales-platform-dev`
4. Disable Google Analytics (optional for dev)
5. Create project

**Enable Services:**
- Authentication → Email/Password + Google
- Firestore Database → Start in test mode
- Storage → Start in test mode

**Get Credentials:**
- Project Settings → General → Your apps → Add web app
- Copy the config values
- Project Settings → Service accounts → Generate new private key

### Create Staging Firebase Project

Repeat the above steps with name: `ai-sales-platform-staging`

---

## Step 2: Create Environment Files

### Local Development (.env.local)

This file already exists. Update it to point to the **development** Firebase:

```env
# Development Firebase (local testing)
NEXT_PUBLIC_FIREBASE_API_KEY=your-dev-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ai-sales-platform-dev.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-sales-platform-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ai-sales-platform-dev.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-dev-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-dev-app-id

# Development Firebase Admin
FIREBASE_ADMIN_PROJECT_ID=ai-sales-platform-dev
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@ai-sales-platform-dev.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

---

## Step 3: Configure Vercel Environments

Go to Vercel → Your Project → Settings → Environment Variables

### Production Environment Variables
Select: ✅ Production only

Add all 9 variables pointing to `ai-sales-platform-4f5e4` (current production):
- `NEXT_PUBLIC_FIREBASE_API_KEY` (production)
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (production)
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (production)
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (production)
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (production)
- `NEXT_PUBLIC_FIREBASE_APP_ID` (production)
- `FIREBASE_ADMIN_PROJECT_ID` (production)
- `FIREBASE_ADMIN_CLIENT_EMAIL` (production)
- `FIREBASE_ADMIN_PRIVATE_KEY` (production)

### Preview/Staging Environment Variables
Select: ✅ Preview only

Add all 9 variables pointing to `ai-sales-platform-staging`:
- Same keys, but with staging Firebase values

---

## Step 4: Configure Vercel Branch Deployments

### Set Up Staging Domain

1. Go to Vercel → Settings → Domains
2. Add domain: `staging.salesvelocity.ai`
3. In domain settings, set **Git Branch**: `staging`

This means:
- Pushes to `staging` branch → deploys to `staging.salesvelocity.ai`
- Pushes to `main` branch → deploys to `salesvelocity.ai`

### Configure in GoDaddy

Add DNS record:
- Type: CNAME
- Name: staging
- Value: cname.vercel-dns.com

---

## Step 5: Development Workflow

### Daily Development Flow

```bash
# 1. Start on development branch
git checkout development

# 2. Make your changes
# ... edit code ...

# 3. Test locally
npm run dev
# Test at localhost:3000 (uses dev Firebase)

# 4. Commit and push
git add -A
git commit -m "Add new feature"
git push

# 5. Ready for staging? Create PR to staging
# On GitHub: Create Pull Request from development → staging

# 6. Merge to staging
# Vercel auto-deploys to staging.salesvelocity.ai

# 7. Test on staging
# Test at staging.salesvelocity.ai (uses staging Firebase)

# 8. Ready for production? Create PR to main
# On GitHub: Create Pull Request from staging → main

# 9. Merge to main
# Vercel auto-deploys to salesvelocity.ai
```

### Quick Reference

| Action | Command |
|--------|---------|
| Work on new feature | `git checkout development` |
| Test locally | `npm run dev` |
| Push to staging | Merge PR: development → staging |
| Push to production | Merge PR: staging → main |
| Hotfix to production | Branch from main, fix, PR to main |

---

## Step 6: Database Safety Rules

### Never Do This:
- ❌ Run seed scripts on production
- ❌ Delete collections on production
- ❌ Test destructive operations on production
- ❌ Share production Firebase credentials

### Always Do This:
- ✅ Test schema changes on staging first
- ✅ Use migrations for database changes
- ✅ Back up production before major updates
- ✅ Test with realistic data on staging

---

## Step 7: Rollback Procedure

If something breaks in production:

1. Go to Vercel → Deployments
2. Find the last working deployment
3. Click the three dots (⋮) → **Promote to Production**

This instantly reverts to the previous version. No data is lost.

---

## Environment Variables Checklist

### Development (localhost)
File: `.env.local`
- [ ] Firebase Dev API Key
- [ ] Firebase Dev Auth Domain
- [ ] Firebase Dev Project ID
- [ ] Firebase Dev Storage Bucket
- [ ] Firebase Dev Messaging Sender ID
- [ ] Firebase Dev App ID
- [ ] Firebase Dev Admin Project ID
- [ ] Firebase Dev Admin Client Email
- [ ] Firebase Dev Admin Private Key

### Staging (Vercel Preview)
Location: Vercel → Environment Variables → Preview
- [ ] Firebase Staging API Key
- [ ] Firebase Staging Auth Domain
- [ ] Firebase Staging Project ID
- [ ] Firebase Staging Storage Bucket
- [ ] Firebase Staging Messaging Sender ID
- [ ] Firebase Staging App ID
- [ ] Firebase Staging Admin Project ID
- [ ] Firebase Staging Admin Client Email
- [ ] Firebase Staging Admin Private Key

### Production (Vercel Production)
Location: Vercel → Environment Variables → Production
- [ ] Firebase Prod API Key ✅
- [ ] Firebase Prod Auth Domain ✅
- [ ] Firebase Prod Project ID ✅
- [ ] Firebase Prod Storage Bucket ✅
- [ ] Firebase Prod Messaging Sender ID ✅
- [ ] Firebase Prod App ID ✅
- [ ] Firebase Prod Admin Project ID ✅
- [ ] Firebase Prod Admin Client Email ✅
- [ ] Firebase Prod Admin Private Key ✅

---

## Current Status

- ✅ Git branches created: `main`, `staging`, `development`
- ✅ Production Firebase configured
- ⏳ Staging Firebase project: **NEEDS CREATION**
- ⏳ Development Firebase project: **NEEDS CREATION**
- ⏳ Vercel staging domain: **NEEDS CONFIGURATION**
- ⏳ Separate environment variables in Vercel: **NEEDS CONFIGURATION**

---

## Next Steps

1. **Create Firebase projects** for staging and development
2. **Update Vercel environment variables** to be environment-specific
3. **Set up staging.salesvelocity.ai** domain
4. **Test the workflow** with a sample change

Estimated time: 1-2 hours








