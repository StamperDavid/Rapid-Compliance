# 🚀 SalesVelocity.ai - Deployment Setup Guide

## Overview: The 3 Environment System

| Environment | Purpose | URL | Firebase |
|-------------|---------|-----|----------|
| **Local** | Your development | `localhost:3000` | `ai-sales-platform-4f5e4` (current) |
| **Preview** | Test before live | `*.vercel.app` (auto) | Same as local (for now) |
| **Production** | Customer-facing | `salesvelocity.ai` | `salesvelocity-prod` (create this) |

---

## Step 1: Deploy to Vercel (Preview Environment)

### 1.1 Connect GitHub to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click **"Add New Project"**
3. Import your GitHub repository: `StamperDavid/ai-sales-platform`
4. Vercel will auto-detect Next.js

### 1.2 Add Environment Variables in Vercel

Go to: **Project Settings → Environment Variables**

Add these variables (copy values from your `.env.local`):

```
NEXT_PUBLIC_FIREBASE_API_KEY = AIzaSyAuoM61E76vsHrKIXvZuMdhJMwsxEFn1PA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = ai-sales-platform-4f5e4.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID = ai-sales-platform-4f5e4
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = ai-sales-platform-4f5e4.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 97257356518
NEXT_PUBLIC_FIREBASE_APP_ID = 1:97257356518:web:4e51eeb7e1a95e52018f27
```

**For Firebase Admin (server-side):**
Open your `serviceAccountKey.json` and add:
```
FIREBASE_ADMIN_PROJECT_ID = ai-sales-platform-4f5e4
FIREBASE_ADMIN_CLIENT_EMAIL = (from serviceAccountKey.json → client_email)
FIREBASE_ADMIN_PRIVATE_KEY = (from serviceAccountKey.json → private_key, keep the \n characters)
```

**Set for environments:**
- ☑️ Production
- ☑️ Preview
- ☑️ Development

### 1.3 Deploy

Click **Deploy** - Vercel will build and give you a URL like:
`https://ai-sales-platform-xyz.vercel.app`

---

## Step 2: Set Up Custom Domain (salesvelocity.ai)

### 2.1 Purchase Domain
- Go to [Namecheap](https://namecheap.com), [Google Domains](https://domains.google), or [Cloudflare](https://cloudflare.com)
- Purchase `salesvelocity.ai`

### 2.2 Connect to Vercel

1. In Vercel: **Project Settings → Domains**
2. Add domain: `salesvelocity.ai`
3. Also add: `www.salesvelocity.ai`
4. Vercel will give you DNS records to add

### 2.3 Configure DNS

Add these records at your domain registrar:

| Type | Name | Value |
|------|------|-------|
| A | @ | `76.76.21.21` |
| CNAME | www | `cname.vercel-dns.com` |

SSL certificate is automatic!

---

## Step 3: Create Production Firebase Project

**Why a separate project?**
- Keep test/demo data away from real customers
- Different security rules
- Separate billing
- Clean analytics

### 3.1 Create New Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add Project"**
3. Name: `salesvelocity-prod`
4. Enable Google Analytics (recommended)
5. Create project

### 3.2 Enable Services

In your new `salesvelocity-prod` project:

1. **Authentication**
   - Click "Get Started"
   - Enable: Email/Password
   - Enable: Google (optional)

2. **Firestore Database**
   - Click "Create Database"
   - Start in **Production mode**
   - Choose region: `us-central` (or closest to users)

3. **Storage**
   - Click "Get Started"
   - Use default rules for now

### 3.3 Get Configuration

**Firebase Client Config:**
1. Project Settings → General → Your apps → Add app (Web)
2. Register app name: `salesvelocity-web`
3. Copy the config object

**Firebase Admin SDK:**
1. Project Settings → Service accounts
2. Click "Generate new private key"
3. Save the JSON file securely

### 3.4 Deploy Security Rules

Copy from your dev project:
```bash
firebase use salesvelocity-prod
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

### 3.5 Update Vercel Environment Variables

In Vercel, add new variables for **Production only**:

1. Go to Project Settings → Environment Variables
2. For each Firebase variable:
   - Click the existing variable
   - Uncheck "Production"
   - Add new variable with production values
   - Check only "Production"

**Result:**
- Preview deployments → Use dev Firebase
- Production → Use prod Firebase

---

## Step 4: Your Development Workflow

### Daily Development Flow

```
1. Work locally (localhost:3000)
   ↓
2. git add . && git commit -m "Feature X"
   ↓
3. git push origin main
   ↓
4. Vercel auto-deploys preview
   ↓
5. Test at preview URL
   ↓
6. If good → Vercel auto-deploys to production
```

### For Bigger Changes (Feature Branches)

```
1. git checkout -b feature/new-thing
   ↓
2. Work locally, commit
   ↓
3. git push origin feature/new-thing
   ↓
4. Vercel creates unique preview URL
   ↓
5. Test thoroughly
   ↓
6. Create Pull Request on GitHub
   ↓
7. Merge to main → Production deploy
```

---

## Step 5: Environment-Specific Settings

### Local Development (.env.local)
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
# Dev Firebase credentials
```

### Preview (Vercel auto-sets)
```
NEXT_PUBLIC_APP_URL=https://your-preview-url.vercel.app
NODE_ENV=production
# Dev Firebase credentials (same as local)
```

### Production (Vercel environment variables)
```
NEXT_PUBLIC_APP_URL=https://salesvelocity.ai
NODE_ENV=production
# Prod Firebase credentials
```

---

## Quick Reference: What Goes Where

| Secret/Config | Local (.env.local) | Vercel (Preview) | Vercel (Production) |
|---------------|-------------------|------------------|---------------------|
| Firebase Config | Dev project | Dev project | **Prod project** |
| OpenAI Key | Your key | Your key | Your key |
| SendGrid Key | Your key | Your key | Your key |
| Stripe Keys | Test keys | Test keys | **Live keys** |
| App URL | localhost:3000 | Auto-set | salesvelocity.ai |

---

## Checklist

### Before First Deploy
- [ ] Vercel account created
- [ ] GitHub repo connected to Vercel
- [ ] Environment variables added to Vercel
- [ ] Domain purchased (optional for preview)

### Before Production Launch
- [ ] Production Firebase project created
- [ ] Production environment variables in Vercel
- [ ] Custom domain connected
- [ ] SSL working (automatic)
- [ ] Demo accounts removed from prod Firebase
- [ ] Stripe live keys configured
- [ ] SendGrid sender verified

### After Production Launch
- [ ] Monitor error logs (Vercel dashboard)
- [ ] Set up alerts
- [ ] Regular backups configured

---

## Troubleshooting

### "Firebase not initialized"
- Check environment variables in Vercel
- Make sure NEXT_PUBLIC_ prefix is used for client-side vars

### "Cannot read serviceAccountKey.json"
- Add FIREBASE_ADMIN_PRIVATE_KEY to Vercel
- Format: Keep \n characters as literal `\n`

### Preview works, production doesn't
- Check production-specific environment variables
- Make sure both environments have all required vars

### CORS errors on chat widget
- vercel.json headers are set correctly
- Check the domain is allowed

---

## Support

If you get stuck:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify environment variables are set correctly

**Last Updated:** December 9, 2025

