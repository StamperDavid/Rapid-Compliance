# Website Builder Environment Setup

## Required Environment Variables

### Core Firebase Configuration

These are required for basic Firebase functionality:

```bash
# Firebase Client SDK (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Storage
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
```

### Firebase Admin SDK (Server-Side)

Choose ONE of these methods:

**Method 1: Service Account JSON (Development)**
- Place `serviceAccountKey.json` in project root
- No env variable needed
- ⚠️ DO NOT commit this file to Git

**Method 2: Environment Variable (Production)**
```bash
# Firebase Admin SDK credentials as JSON string
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

### Website Builder Configuration

```bash
# Application URL
NEXT_PUBLIC_APP_URL=https://yourplatform.com
NEXT_PUBLIC_BASE_DOMAIN=yourplatform.com

# For local development
# NEXT_PUBLIC_APP_URL=http://localhost:3000
# NEXT_PUBLIC_BASE_DOMAIN=localhost:3000
```

### Custom Domains (Optional but Recommended)

Required for custom domain features:

```bash
# Vercel API Credentials
VERCEL_TOKEN=your_vercel_api_token
VERCEL_PROJECT_ID=prj_xxxxxxxxxxxxx
VERCEL_TEAM_ID=team_xxxxxxxxxxxx  # Optional, only if using Vercel teams
```

**How to get Vercel credentials:**
1. Go to https://vercel.com/account/tokens
2. Create a new token with appropriate scopes
3. Find project ID in Vercel project settings
4. Find team ID in team settings (if applicable)

### Scheduled Publishing (Optional)

For scheduled publishing to work:

**Option 1: Vercel Cron (Recommended)**
- Configure in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/scheduled-publisher",
    "schedule": "*/5 * * * *"
  }]
}
```

**Option 2: External Cron**
```bash
# Add authentication for cron endpoint
CRON_SECRET=your_random_secret_key_here

# Then call from external cron:
# curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourplatform.com/api/cron/scheduled-publisher
```

---

## Environment File Examples

### `.env.local` (Development)

```bash
# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Firebase Server
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BASE_DOMAIN=localhost:3000

# Vercel API (Optional - for custom domains)
VERCEL_TOKEN=your_vercel_token
VERCEL_PROJECT_ID=prj_xxxxx
VERCEL_TEAM_ID=team_xxxxx

# Cron Authentication (Optional)
CRON_SECRET=your_random_secret
```

### `.env.production` (Production on Vercel)

```bash
# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Firebase Admin (JSON string - add via Vercel dashboard)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# App Configuration
NEXT_PUBLIC_APP_URL=https://yourplatform.com
NEXT_PUBLIC_BASE_DOMAIN=yourplatform.com

# Vercel API
VERCEL_TOKEN=your_vercel_token
VERCEL_PROJECT_ID=prj_xxxxx
VERCEL_TEAM_ID=team_xxxxx

# Cron Authentication
CRON_SECRET=your_production_secret
```

---

## Setup Checklist

### 1. Firebase Setup
- [ ] Create Firebase project
- [ ] Enable Firestore
- [ ] Enable Authentication
- [ ] Enable Storage
- [ ] Download service account key
- [ ] Add Firebase config to `.env.local`

### 2. Database Initialization
```bash
# Run the initialization script
node scripts/init-website-builder-db.js
```

### 3. Firestore Rules
```bash
# Deploy updated Firestore rules
firebase deploy --only firestore:rules
```

### 4. Vercel Configuration (if using custom domains)
- [ ] Create Vercel account
- [ ] Create API token
- [ ] Add token to environment variables
- [ ] Configure Vercel project ID

### 5. Scheduled Publishing (if needed)
- [ ] Add cron configuration to `vercel.json`
- [ ] Set `CRON_SECRET` environment variable
- [ ] Test cron endpoint manually

### 6. Test the Setup
```bash
# Start development server
npm run dev

# Test basic website builder access
# Navigate to: http://localhost:3000/workspace/YOUR_ORG_ID/website/settings
```

---

## Troubleshooting

### Firebase Admin SDK Errors

**Error: "Could not load the default credentials"**
- Solution: Ensure `serviceAccountKey.json` exists in project root OR
- Solution: Set `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable

**Error: "Permission denied"**
- Solution: Check Firestore rules are deployed
- Solution: Verify user authentication

### Custom Domain Issues

**Error: "Invalid API token"**
- Solution: Check `VERCEL_TOKEN` is correct
- Solution: Regenerate token if expired

**Error: "Domain verification failed"**
- Solution: Wait 5-60 minutes for DNS propagation
- Solution: Verify DNS records are correct

### Scheduled Publishing Not Working

**Posts not auto-publishing**
- Solution: Check Vercel cron is configured
- Solution: Test endpoint manually: `/api/cron/scheduled-publisher`
- Solution: Check server logs for errors

---

## Security Notes

### DO NOT Commit:
- ❌ `serviceAccountKey.json`
- ❌ `.env` or `.env.local` files
- ❌ Any file containing API keys or secrets

### Already in `.gitignore`:
- ✅ `serviceAccountKey.json`
- ✅ `.env*`
- ✅ `node_modules/`

### Production Security:
- ✅ Use environment variables, not files
- ✅ Rotate API tokens regularly
- ✅ Use least-privilege access
- ✅ Monitor Firestore usage
- ✅ Enable Firestore audit logging

---

## Need Help?

1. Check Firebase Console for errors
2. Check Vercel deployment logs
3. Review Firestore rules in console
4. Test API endpoints manually
5. Check browser console for client errors

**Environment setup complete!** ✅

