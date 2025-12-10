# 🚀 Deployment Guide - Production Ready

## ✅ Pre-Deployment Checklist

### 1. Environment Variables
Create `.env.production` with:
```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Sentry (Error Tracking)
SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-auth-token

# Stripe (Billing)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Google Cloud (if using)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Other Services
GEMINI_API_KEY=your-gemini-key
```

### 2. Firebase Setup
1. Deploy Firestore security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

2. Set up Firestore indexes (if needed):
   ```bash
   firebase deploy --only firestore:indexes
   ```

3. Configure Firebase Authentication:
   - Enable Email/Password
   - Enable Google OAuth
   - Enable Microsoft OAuth

### 3. GCP Setup (for production hosting)
1. Create GCP project
2. Enable required APIs:
   - Cloud Run
   - Cloud Load Balancer
   - Cloud CDN
   - Cloud Storage
   - Cloud Functions
   - Vertex AI (for AI features)

3. Set up service account with proper permissions

### 4. Build & Test
```bash
# Run tests
npm test

# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build
```

### 5. Deploy Firestore Security Rules
```bash
firebase deploy --only firestore:rules
```

---

## 🌐 Deployment Options

### Option 1: Vercel (Recommended for Next.js)
1. Connect GitHub repository
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main

### Option 2: Google Cloud Run
1. Build Docker image:
   ```bash
   docker build -t ai-sales-platform .
   ```

2. Push to GCR:
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/ai-sales-platform
   ```

3. Deploy to Cloud Run:
   ```bash
   gcloud run deploy ai-sales-platform \
     --image gcr.io/PROJECT_ID/ai-sales-platform \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

### Option 3: Self-Hosted
1. Build production bundle:
   ```bash
   npm run build
   ```

2. Start production server:
   ```bash
   npm start
   ```

---

## 🔒 Security Checklist

- [x] All API routes have authentication
- [x] Input validation on all endpoints
- [x] Rate limiting enabled
- [x] Firestore security rules deployed
- [x] Environment variables secured
- [x] Error tracking configured
- [x] Logging configured
- [ ] SSL/TLS certificates configured
- [ ] CORS properly configured
- [ ] API keys stored in Secret Manager (GCP)

---

## 📊 Monitoring Setup

### 1. Sentry
- Configure DSN in environment variables
- Set up alerts for critical errors
- Configure release tracking

### 2. Cloud Logging (GCP)
- Enable Cloud Logging API
- Configure log exports if needed
- Set up log-based alerts

### 3. Health Checks
- Monitor `/api/health` endpoint
- Set up uptime monitoring
- Configure alerts for downtime

---

## 🚨 Post-Deployment

1. **Verify Health Checks**:
   - Check `/api/health` endpoint
   - Check `/api/health/detailed` (admin only)

2. **Test Critical Paths**:
   - User authentication
   - API routes
   - Data persistence
   - Email/SMS sending

3. **Monitor**:
   - Error tracking dashboard
   - API logs
   - Performance metrics

4. **Set Up Alerts**:
   - Error rate thresholds
   - Response time thresholds
   - Uptime monitoring

---

## 📝 Environment-Specific Notes

### Development
- Uses Firebase Emulator Suite (optional)
- Demo mode available (no Firebase needed)
- Hot reload enabled

### Staging
- Uses separate Firebase project
- Full feature testing
- Production-like environment

### Production
- Uses production Firebase project
- All security features enabled
- Monitoring and alerts active
- Error tracking enabled

---

**Status**: Ready for deployment ✅












