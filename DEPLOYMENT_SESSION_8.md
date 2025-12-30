# Session 8: Production Deployment Execution

**Date:** December 29, 2025  
**Focus:** Execute production deployment following comprehensive deployment guide  
**Branch:** `dev`  
**Status:** 🚀 In Progress

---

## 📋 Session Objectives

1. ✅ Create deployment helper scripts
2. Execute production deployment checklist
3. Deploy Firebase rules and indexes
4. Configure all environment variables
5. Set up Stripe webhooks
6. Configure email service
7. Deploy to production (Vercel)
8. Execute post-deployment verification
9. Create super admin user
10. Monitor for 24-48 hours

---

## 🛠️ Deployment Scripts Created

### 1. Environment Variable Verification (`scripts/verify-env-vars.js`)

**Purpose:** Validates all required production environment variables

**Features:**
- Checks P0 (critical), P1 (high), P2 (medium) priority variables
- Validates Stripe keys are live mode (`sk_live_*`, `pk_live_*`)
- Checks Firebase private key format
- Validates CRON_SECRET strength (32+ characters)
- Ensures APP_URL uses HTTPS
- Provides detailed report with pass/fail status

**Usage:**
```bash
node scripts/verify-env-vars.js
```

**Exit Codes:**
- `0` = All critical variables configured
- `1` = Missing critical variables

---

### 2. Firebase Rules Deployment (`scripts/deploy-firebase-rules.js`)

**Purpose:** Automates deployment of Firestore security rules and indexes

**Features:**
- Checks Firebase CLI is installed
- Verifies `firestore.rules` and `firestore.indexes.json` exist
- Deploys security rules to production
- Deploys composite indexes
- Provides deployment status and next steps

**Usage:**
```bash
# First, select production Firebase project
firebase use --add

# Then deploy
node scripts/deploy-firebase-rules.js
```

**What it deploys:**
- **Security Rules:**
  - Multi-tenant isolation (organizationId checks)
  - Role-based access control (owner, admin, manager, user, super_admin)
  - Discovery archive protection (30-day proprietary moat)
  - Website builder domain isolation
  
- **Indexes:**
  - Customers: orgId + createdAt, orgId + status + updatedAt
  - Orders: workspaceId + status + createdAt
  - Workflows: workspaceId + isActive + triggerType
  - Discovery archive: orgId + url, orgId + expiresAt
  - Integrations: orgId + provider + isActive

---

### 3. Production Health Check (`scripts/test-production-health.js`)

**Purpose:** Tests all critical endpoints after deployment

**Features:**
- Homepage load test
- Health check API test (`/api/health`)
- Auth middleware test
- Stripe webhook endpoint test
- Response time tracking
- Critical vs non-critical test prioritization

**Usage:**
```bash
# Set production URL first
export NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Run health checks
node scripts/test-production-health.js
```

**Tested Endpoints:**
- `GET /` - Homepage (should return 200)
- `GET /api/health` - Health check (should return 200)
- `GET /api/workspaces` - Auth test (should return 401/403 without auth)
- `POST /api/webhooks/stripe` - Webhook endpoint (should exist)

---

### 4. CRON Secret Generator (`scripts/generate-cron-secret.js`)

**Purpose:** Generates cryptographically secure CRON_SECRET

**Usage:**
```bash
node scripts/generate-cron-secret.js
```

**Output:**
```
🔐 Generated CRON_SECRET:
abc123XYZ...

📋 Add to your environment variables:
CRON_SECRET=abc123XYZ...
```

---

## 📝 Deployment Execution Plan

### Phase 1: Pre-Deployment Preparation ⏳

**1.1 Environment Variables Setup**

Required actions:
- [ ] Create production Firebase project (or select existing)
- [ ] Copy Firebase client config (6 variables)
- [ ] Generate Firebase Admin service account (3 variables)
- [ ] Get OpenAI API key (or Anthropic/Google AI)
- [ ] Set up SendGrid account and verify domain
- [ ] Create Stripe live mode account
- [ ] Generate CRON_SECRET (use script)
- [ ] Set up Sentry project for error tracking

**1.2 DNS and Domain**

- [ ] Purchase/configure production domain
- [ ] Point domain to Vercel (or hosting platform)
- [ ] Configure DNS for email (SPF, DKIM, DMARC)
- [ ] Set up wildcard subdomain for website builder

**1.3 Code Preparation**

- [ ] Run `npm run type-check` - verify 0 errors
- [ ] Run `npm test` - verify 98%+ pass rate
- [ ] Run security scan (no exposed secrets)
- [ ] Create git tag: `v1.0.0`
- [ ] Push tag to GitHub

---

### Phase 2: Firebase Configuration ⏳

**2.1 Deploy Security Rules**

```bash
# Login to Firebase
firebase login

# Add production project
firebase use --add
# Select: production
# Alias: production

# List projects to verify
firebase projects:list

# Deploy rules using helper script
node scripts/deploy-firebase-rules.js
```

**Expected output:**
```
✅ Deploying Firestore Security Rules - SUCCESS
✅ Deploying Firestore Indexes - SUCCESS
```

**2.2 Verify Deployment**

- [ ] Firebase Console → Firestore → Rules (verify deployed)
- [ ] Firebase Console → Firestore → Indexes (verify building)
- [ ] Wait for index builds to complete (5-10 minutes)

**2.3 Configure Authentication**

Firebase Console → Authentication:
- [ ] Enable Email/Password sign-in
- [ ] Enable Google OAuth (if using Gmail/Calendar)
- [ ] Add production domain to authorized domains
- [ ] Remove `localhost` from authorized domains
- [ ] Customize email templates (optional)

**2.4 Configure Storage**

If using Firebase Storage:
```bash
# Create cors.json
cat > cors.json << EOF
[
  {
    "origin": ["https://yourdomain.com"],
    "method": ["GET", "PUT", "POST", "DELETE"],
    "maxAgeSeconds": 3600
  }
]
EOF

# Apply CORS
gsutil cors set cors.json gs://your-project.appspot.com
```

---

### Phase 3: Stripe Configuration ⏳

**3.1 Switch to Live Mode**

- [ ] Stripe Dashboard → Toggle to **Live** mode (top-right)

**3.2 Configure Webhook**

Stripe Dashboard → Developers → Webhooks → Add endpoint:

- **Endpoint URL:** `https://yourdomain.com/api/webhooks/stripe`
- **Events to send:**
  - [x] `checkout.session.completed` ⭐ (CRITICAL)
  - [x] `customer.subscription.created`
  - [x] `customer.subscription.updated`
  - [x] `customer.subscription.deleted`
  - [x] `customer.subscription.trial_will_end`
  - [x] `invoice.payment_succeeded`
  - [x] `invoice.payment_failed`
  - [x] `payment_intent.succeeded`
  - [x] `payment_intent.payment_failed`

- [ ] Copy webhook signing secret: `whsec_...`
- [ ] Add to environment variables: `STRIPE_WEBHOOK_SECRET=whsec_...`

**3.3 Test Webhook (After Deployment)**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward to production
stripe listen --forward-to https://yourdomain.com/api/webhooks/stripe

# In another terminal, trigger test
stripe trigger checkout.session.completed
```

**Expected:**
- ✅ Webhook received: checkout.session.completed
- ✅ Order created in Firestore
- ✅ Confirmation email sent

---

### Phase 4: Email Service Setup ⏳

**4.1 SendGrid Domain Authentication**

SendGrid Dashboard → Settings → Sender Authentication:

1. **Domain Authentication:**
   - [ ] Add your domain: `yourdomain.com`
   - [ ] SendGrid provides DNS records

2. **Add DNS Records** (at your domain registrar):
   ```
   SPF:   v=spf1 include:sendgrid.net ~all
   DKIM:  [Copy from SendGrid - unique per domain]
   DMARC: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
   ```

3. **Verify Domain:**
   - [ ] Wait for DNS propagation (5-60 minutes)
   - [ ] Click "Verify" in SendGrid Dashboard
   - [ ] ✅ Green checkmark = success

**4.2 Create API Key**

SendGrid Dashboard → Settings → API Keys:
- [ ] Create API Key: "AI Sales Platform Production"
- [ ] Permissions: **Full Access** (or minimum: Mail Send)
- [ ] Copy key: `SG.xxx...`
- [ ] Add to env vars: `SENDGRID_API_KEY=SG.xxx...`

**4.3 Test Email (After Deployment)**

```bash
curl -X POST https://yourdomain.com/api/test/email \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com"}'
```

**Expected:** Email received in inbox (not spam)

---

### Phase 5: Google OAuth Setup ⏳

**5.1 Create OAuth Client ID**

Google Cloud Console → APIs & Services → Credentials:

1. **Create OAuth 2.0 Client ID:**
   - [ ] Application type: Web application
   - [ ] Name: "AI Sales Platform Production"

2. **Authorized JavaScript origins:**
   ```
   https://yourdomain.com
   ```

3. **Authorized redirect URIs:**
   ```
   https://yourdomain.com/api/integrations/google/callback
   ```

4. **Copy credentials:**
   - [ ] Client ID: `123...apps.googleusercontent.com`
   - [ ] Client Secret: `GOCSPX-xxx...`

**5.2 Enable APIs**

APIs & Services → Library:
- [ ] Gmail API
- [ ] Google Calendar API
- [ ] Google People API

**5.3 Configure OAuth Consent Screen**

- [ ] User Type: External
- [ ] App name: "AI Sales Platform"
- [ ] Support email: `support@yourdomain.com`
- [ ] App logo: 120x120 PNG
- [ ] Scopes: `gmail.readonly`, `gmail.send`, `calendar.readonly`, `calendar.events`

---

### Phase 6: Vercel Deployment ⏳

**6.1 Connect GitHub Repository**

Vercel Dashboard → Add New Project:
- [ ] Import: `github.com/StamperDavid/ai-sales-platform`
- [ ] Framework: Next.js (auto-detected)
- [ ] Root Directory: `./`
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `.next`
- [ ] Install Command: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install`

**6.2 Configure Environment Variables**

Vercel Dashboard → Project Settings → Environment Variables:

**Add all 13 P0 (Critical) variables:**
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY=...  # Use multi-line editor
OPENAI_API_KEY=...
SENDGRID_API_KEY=...
FROM_EMAIL=...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

**Add all 7 P1 (High Priority) variables:**
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/integrations/google/callback
CRON_SECRET=...  # Generated from script
```

**Add P2 (Optional but Recommended):**
```bash
SENTRY_DSN=...
NEXT_PUBLIC_BASE_DOMAIN=yourdomain.com
VERCEL_TOKEN=...  # For website builder
VERCEL_PROJECT_ID=...
VERCEL_TEAM_ID=...
```

**Important Notes:**
- Use **Production** environment (not Preview or Development)
- For `FIREBASE_ADMIN_PRIVATE_KEY`, use multi-line text editor
- Include `\n` newlines in private key
- Verify Stripe keys are **live mode** (`pk_live_*`, `sk_live_*`)

**6.3 Deploy**

Option 1 - Auto-deploy:
```bash
git checkout main
git merge dev
git push origin main
```

Option 2 - Vercel CLI:
```bash
npm install -g vercel
vercel login
vercel --prod
```

**Expected Output:**
```
✅ Production: https://ai-sales-platform.vercel.app
✅ Custom Domain: https://yourdomain.com (if configured)
```

**6.4 Configure Custom Domain**

Vercel Dashboard → Project → Settings → Domains:
- [ ] Add domain: `yourdomain.com`
- [ ] Add DNS record (Vercel provides instructions)
- [ ] Wait for DNS propagation (5-60 minutes)
- [ ] SSL certificate auto-issued by Vercel

---

### Phase 7: Post-Deployment Verification ⏳

**7.1 Run Health Checks**

```bash
export NEXT_PUBLIC_APP_URL=https://yourdomain.com
node scripts/test-production-health.js
```

**Expected:**
```
✅ Homepage Load... 200 (1200ms)
✅ Health Check Endpoint... 200 (300ms)
✅ API Auth Test... 401 (250ms)
✅ Stripe Webhook Endpoint... 400 (200ms)

📊 Results: 4/4 tests passed
   Critical: 4/4 passed

⚡ Average Response Time: 487ms

✅ All critical services are healthy!
```

**7.2 Manual Smoke Tests**

- [ ] **Homepage loads:** Visit `https://yourdomain.com`
- [ ] **User registration:**
  - Create account with email/password
  - Verify confirmation email received
  - User created in Firestore `users` collection
- [ ] **Login:** Sign in with created account
- [ ] **Dashboard loads:** User sees organization dashboard
- [ ] **Create workflow:** Test workflow creation
- [ ] **Send email:** Test email campaign sending
- [ ] **E-commerce checkout:**
  - Add product to cart
  - Complete checkout with test card: `4242 4242 4242 4242`
  - Order created in Firestore
  - Confirmation email sent
  - Webhook received

**7.3 Monitor Logs**

Vercel Dashboard → Project → Logs:
- [ ] No 500 errors
- [ ] No unhandled exceptions
- [ ] API routes responding correctly

Sentry Dashboard → Issues:
- [ ] No critical errors
- [ ] Error rate < 0.1%

---

### Phase 8: Create Super Admin User ⏳

**8.1 Create in Firebase Auth**

Firebase Console → Authentication → Users → Add user:
- Email: `admin@yourdomain.com`
- Password: [Strong password - save securely]
- [ ] Copy User UID

**8.2 Create in Firestore**

Firebase Console → Firestore → `users` collection → Add document:

Document ID: [Paste User UID from step 8.1]

```json
{
  "email": "admin@yourdomain.com",
  "displayName": "Platform Admin",
  "role": "super_admin",
  "organizationId": "platform_admin",
  "createdAt": "[Current timestamp]",
  "updatedAt": "[Current timestamp]",
  "isActive": true
}
```

**8.3 Test Super Admin Access**

- [ ] Login with super admin credentials
- [ ] Navigate to `/admin` (if admin panel exists)
- [ ] Verify can access all organizations
- [ ] Test creating/modifying users

---

### Phase 9: Final Checklist ⏳

**Production is LIVE when:**

- [ ] All 13 P0 environment variables configured
- [ ] All 7 P1 environment variables configured (if using features)
- [ ] Firestore rules deployed and verified
- [ ] Firestore indexes deployed and built
- [ ] Stripe webhook configured and tested
- [ ] Email service verified (test email sent)
- [ ] Production build successful (< 5MB bundle)
- [ ] All smoke tests pass
- [ ] Health check returns 200 OK
- [ ] Lighthouse Performance score > 90
- [ ] No critical errors in Sentry
- [ ] Super admin user created and tested
- [ ] Monitoring and logging active

---

## 📊 Deployment Metrics (To Be Measured)

### Build Metrics
- [ ] Build time: ______ seconds
- [ ] Bundle size: ______ MB
- [ ] Static pages generated: ______

### Performance Metrics
- [ ] Lighthouse Performance: ______/100
- [ ] Homepage load (P95): ______ ms
- [ ] API response (P95): ______ ms
- [ ] Time to Interactive: ______ s

### Post-Launch (24 hours)
- [ ] Uptime: ______%
- [ ] Error rate: ______%
- [ ] Total requests: ______
- [ ] New signups: ______
- [ ] Revenue: $______

---

## 🎯 Next Steps After Deployment

1. **Monitor for 24-48 hours:**
   - Check Sentry every 2 hours
   - Monitor Vercel logs
   - Track performance metrics
   - Watch Firebase usage

2. **Announce launch:**
   - Email early access users
   - Post on social media
   - Update status page

3. **Gather feedback:**
   - Set up user feedback form
   - Monitor support emails
   - Track feature requests

4. **Plan next iteration:**
   - Review Phase 2 enhancements
   - Prioritize based on user feedback
   - Schedule next development sprint

---

## 🆘 Rollback Plan

**If critical issues discovered:**

1. **Immediate (< 2 minutes):**
   - Vercel Dashboard → Deployments
   - Find previous working deployment
   - Click "..." → Promote to Production

2. **Investigation:**
   - Check Sentry for error details
   - Review deployment logs
   - Test in staging environment

3. **Fix Forward:**
   - Apply hotfix to main branch
   - Re-deploy
   - Verify fix in production

---

## 📝 Deployment Log

**Deployment Date:** ______________  
**Deployed By:** ______________  
**Git Commit:** ______________  
**Deployment Method:** Vercel  
**Production URL:** https://yourdomain.com  
**Status:** 🟡 In Progress

---

**Created:** December 29, 2025  
**Last Updated:** December 29, 2025  
**Version:** 1.0
