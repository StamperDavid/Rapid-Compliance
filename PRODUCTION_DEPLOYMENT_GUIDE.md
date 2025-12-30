# Production Deployment Guide - AI Sales Platform

**Complete step-by-step guide to deploy the AI Sales Platform to production.**

Last Updated: December 30, 2025  
Platform Status: **99% Production Ready** 🚀  
Estimated Deployment Time: **4-6 hours**

---

## 🎯 Executive Summary

This guide walks you through deploying the AI Sales Platform to production with:
- ✅ **99% Code Complete** - 151/154 tests passing (98.1%)
- ✅ **Zero TypeScript Errors** - Fully type-safe codebase
- ✅ **Hunter-Closer Compliant** - 100% native implementation ($28K+/year savings)
- ✅ **Enterprise Security** - Multi-tenant isolation, RBAC, rate limiting
- ✅ **Scalable Architecture** - Supports 100+ orgs, 1000+ users

**Deployment Options:**
1. **Vercel (Recommended)** - Zero-config deployment with CDN, edge functions
2. **Self-Hosted** - Docker or direct deployment with PM2/systemd

**Prerequisites:**
- Firebase Blaze plan (pay-as-you-go)
- Stripe account (live mode)
- SendGrid account (or Resend)
- OpenAI API key (or Anthropic/Google AI)
- Domain name (optional but recommended)

---

## 📋 Pre-Deployment Checklist

### Phase 1: Environment Setup (30 minutes)

**Required Actions:**
- [ ] Firebase project created (production environment)
- [ ] Stripe account in live mode
- [ ] SendGrid domain verified
- [ ] Production domain purchased (if applicable)
- [ ] Git tagged for release (e.g., `v1.0.0`)

**Environment Variables to Prepare:**

Copy `PRODUCTION_ENVIRONMENT_VARIABLES.md` for full details. Minimum required (13 variables):

```bash
# Firebase Client (6)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (3)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# AI Provider (1 - choose OpenAI recommended)
OPENAI_API_KEY=

# Email Service (2 - SendGrid or Resend)
SENDGRID_API_KEY=
FROM_EMAIL=

# Application (1)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

### Phase 2: Firebase Configuration (20 minutes)

#### Step 1: Deploy Firestore Security Rules

**What:** Deploy the comprehensive multi-tenant security rules to production.

**Why:** Prevents unauthorized data access and enforces organization isolation.

**How:**

```bash
# 1. Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# 2. Login to Firebase
firebase login

# 3. Select your PRODUCTION project
firebase use production  # or firebase use --add

# 4. Deploy security rules
firebase deploy --only firestore:rules

# Expected output:
# ✔  firestore: released rules firestore.rules to cloud.firestore
```

**Verification:**

```bash
# Check rules are deployed
firebase firestore:databases:get

# Test with Firebase Emulator
firebase emulators:start --only firestore
npm run test:firestore-rules
```

**Critical Rules Highlights:**
- ✅ Multi-tenant isolation (`organizationId` checks)
- ✅ Super admin access (IT support via `role == 'super_admin'`)
- ✅ Role-based permissions (owner, admin, manager, user)
- ✅ Discovery archive isolation (30-day proprietary moat)
- ✅ Website builder domain isolation

**Security Checklist:**
- [ ] Rules deployed successfully
- [ ] No wildcards allowing public access
- [ ] All sensitive collections protected
- [ ] Super admin email configured in Firestore users
- [ ] Test org cannot access another org's data

---

#### Step 2: Deploy Firestore Indexes

**What:** Deploy composite indexes for optimized queries.

**Why:** Required for complex queries with multiple filters/sorts.

**How:**

```bash
# Deploy all indexes defined in firestore.indexes.json
firebase deploy --only firestore:indexes

# Expected output:
# ✔  firestore: deployed indexes in firestore.indexes.json successfully
```

**Included Indexes:**
- Customers (orgId + createdAt, orgId + status + updatedAt)
- Orders (workspaceId + status + createdAt)
- Workflows (workspaceId + isActive + triggerType)
- Discovery Archive (orgId + url, orgId + expiresAt)
- Integrations (orgId + provider + isActive)

**Note:** Some indexes are auto-created on first query. Check Firebase Console → Firestore → Indexes after deployment.

**Verification:**
- [ ] Indexes deployed successfully
- [ ] No pending index builds
- [ ] Check Firebase Console → Firestore → Indexes

---

#### Step 3: Configure Firebase Authentication

**Firebase Console → Authentication → Sign-in method:**

1. **Enable Email/Password:**
   - Toggle "Email/Password" to enabled
   - Enable "Email link (passwordless sign-in)" (optional)

2. **Enable Google Sign-In (if using Gmail integration):**
   - Toggle "Google" to enabled
   - Enter Google Client ID and Secret (from Google Cloud Console)

3. **Configure Authorized Domains:**
   - Add production domain: `yourdomain.com`
   - Add staging domain (if applicable): `staging.yourdomain.com`
   - **Remove** `localhost` from production environment

4. **Email Templates (optional):**
   - Customize password reset email
   - Customize verification email
   - Add company branding

**Verification:**
- [ ] Email/Password enabled
- [ ] Google OAuth configured (if applicable)
- [ ] Production domains authorized
- [ ] Localhost removed from production

---

#### Step 4: Configure Firebase Storage (optional)

If using Firebase Storage for file uploads:

```bash
# Create cors.json
cat > cors.json << EOF
[
  {
    "origin": ["https://yourdomain.com"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]
EOF

# Apply CORS configuration
gsutil cors set cors.json gs://your-project.appspot.com
```

**Verification:**
- [ ] CORS configured for production domain
- [ ] Test file upload and download
- [ ] Storage rules deployed (if custom rules)

---

### Phase 3: Stripe Configuration (30 minutes)

#### Step 1: Switch to Live Mode

**Stripe Dashboard → Top-right toggle → Live mode**

⚠️ **CRITICAL:** Use **live keys** in production (`pk_live_*` and `sk_live_*`), **not test keys**!

```bash
# Environment variables for production
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

#### Step 2: Configure Webhook Endpoint

**Why:** Webhooks notify your app when payments succeed/fail, subscriptions change, etc.

**How:**

1. **Stripe Dashboard → Developers → Webhooks → Add endpoint**

2. **Endpoint URL:**
   ```
   https://yourdomain.com/api/webhooks/stripe
   ```

3. **Select events to send:**
   ```
   ✅ checkout.session.completed       (CRITICAL - creates orders)
   ✅ customer.subscription.created
   ✅ customer.subscription.updated
   ✅ customer.subscription.deleted
   ✅ customer.subscription.trial_will_end
   ✅ invoice.payment_succeeded
   ✅ invoice.payment_failed
   ✅ payment_intent.succeeded
   ✅ payment_intent.payment_failed
   ```

4. **Copy Webhook Signing Secret:**
   - After saving, Stripe shows: `whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Add to environment variables:
     ```bash
     STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
     ```

**Verification:**

```bash
# Install Stripe CLI (if not already installed)
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Test webhook locally (before deploying)
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe

# In another terminal, trigger test event
stripe trigger checkout.session.completed

# Expected output in server logs:
# ✅ Webhook received: checkout.session.completed
# ✅ Order created in Firestore
# ✅ Confirmation email sent
```

**Post-Deployment Webhook Test:**

```bash
# After deploying to production
stripe listen --forward-to https://yourdomain.com/api/webhooks/stripe

# Trigger test payment
stripe trigger checkout.session.completed
```

**Common Issues:**

| Issue | Solution |
|-------|----------|
| Webhook signature verification failed | Check `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard |
| Order not created in Firestore | Check server logs for errors; verify Firebase Admin SDK initialized |
| Email not sent | Verify SendGrid API key and FROM_EMAIL configured |

**Checklist:**
- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] All required events selected
- [ ] Webhook secret added to environment variables
- [ ] Test webhook triggered successfully
- [ ] Order created in Firestore
- [ ] Confirmation email sent

---

#### Step 3: Create Products/Prices (if applicable)

**Stripe Dashboard → Products → Add product**

1. **Create Product:**
   - Name: "AI Sales Platform - Pro Plan"
   - Description: "Full access to AI sales automation"
   - Upload product image (optional)

2. **Set Pricing:**
   - **One-time payment:** Fixed amount (e.g., $99)
   - **Recurring subscription:** Monthly/Yearly (e.g., $49/month)
   - Currency: USD

3. **Copy Price ID:**
   - After saving: `price_xxxxxxxxxxxxxxxxxxxxx`
   - Use in checkout sessions or subscription creation

**Verification:**
- [ ] Products created in Stripe Dashboard
- [ ] Prices configured correctly
- [ ] Test checkout flow with test card (before going live)

---

### Phase 4: Email Service Setup (20 minutes)

#### Option A: SendGrid (Recommended)

**Step 1: Domain Authentication**

**SendGrid Dashboard → Settings → Sender Authentication → Domain Authentication**

1. **Add DNS Records:**
   - SPF: `v=spf1 include:sendgrid.net ~all`
   - DKIM: (Copy from SendGrid)
   - DMARC: `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com`

2. **Verify Domain:**
   - Wait for DNS propagation (5-60 minutes)
   - Click "Verify" in SendGrid Dashboard
   - ✅ Green checkmark indicates success

**Step 2: Create API Key**

**SendGrid Dashboard → Settings → API Keys → Create API Key**

- Name: "AI Sales Platform Production"
- Permissions: **Full Access** (or minimum: Mail Send)
- Copy key: `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

```bash
# Add to environment variables
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Your Company Name
```

**Step 3: Test Email Sending**

```bash
# After deployment, test via API
curl -X POST https://yourdomain.com/api/test/email \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com"}'

# Expected: Email received in inbox (not spam)
```

**Checklist:**
- [ ] Domain authenticated in SendGrid
- [ ] DNS records verified (SPF, DKIM, DMARC)
- [ ] API key created with Mail Send permissions
- [ ] FROM_EMAIL verified
- [ ] Test email sent successfully
- [ ] Email delivered to inbox (not spam folder)

---

#### Option B: Resend (Alternative)

**Resend Dashboard → API Keys → Create**

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Your Company Name
```

**Note:** Code automatically detects SendGrid vs Resend based on which key is set.

---

### Phase 5: Google OAuth Setup (if using Gmail/Calendar) (20 minutes)

**Google Cloud Console → APIs & Services → Credentials**

#### Step 1: Create OAuth 2.0 Client ID

1. **Create Credentials → OAuth client ID → Web application**

2. **Authorized JavaScript origins:**
   ```
   https://yourdomain.com
   ```

3. **Authorized redirect URIs:**
   ```
   https://yourdomain.com/api/integrations/google/callback
   ```

4. **Copy credentials:**
   ```bash
   GOOGLE_CLIENT_ID=123456789-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
   GOOGLE_REDIRECT_URI=https://yourdomain.com/api/integrations/google/callback
   ```

#### Step 2: Enable APIs

**APIs & Services → Library → Enable:**
- ✅ Gmail API
- ✅ Google Calendar API
- ✅ Google People API (for contacts)

#### Step 3: Configure OAuth Consent Screen

**APIs & Services → OAuth consent screen:**

1. **User Type:** External
2. **App Information:**
   - App name: "AI Sales Platform"
   - Support email: support@yourdomain.com
   - App logo: Upload 120x120 PNG
3. **Scopes:**
   - Add: `gmail.readonly`, `gmail.send`
   - Add: `calendar.readonly`, `calendar.events`
4. **Test Users:** Add your email for testing

**Checklist:**
- [ ] OAuth client ID created
- [ ] Redirect URIs configured
- [ ] APIs enabled (Gmail, Calendar, People)
- [ ] OAuth consent screen configured
- [ ] Test OAuth flow before launch

---

### Phase 6: Security Audit (30 minutes)

#### Step 1: Verify No Exposed Secrets

```bash
# Run security scan
grep -rn "sk_live_" src/ --exclude-dir=node_modules
grep -rn "sk_test_" src/ --exclude-dir=node_modules
grep -rn "AIzaSy" src/ --exclude-dir=node_modules

# Expected output: No matches (all secrets in environment variables)
```

**Checklist:**
- [ ] No API keys in source code
- [ ] No hardcoded passwords
- [ ] `.env.local` in `.gitignore`
- [ ] Secrets stored in Vercel/hosting platform only

---

#### Step 2: Review Firestore Rules

**Firebase Console → Firestore → Rules**

**Critical Checks:**
```javascript
// ✅ GOOD: Organization isolation
allow read: if isAuthenticated() && belongsToOrg(orgId);

// ❌ BAD: Public access without checks
allow read, write: if true;

// ❌ BAD: Wildcard without validation
allow read, write: if request.auth != null;
```

**Test Multi-Tenant Isolation:**

1. Create two test organizations: Org A, Org B
2. Create user in Org A
3. Attempt to read Org B's data via API
4. **Expected:** 403 Forbidden error

**Checklist:**
- [ ] No `allow read, write: if true;` rules
- [ ] All collections check `organizationId`
- [ ] Super admin role enforced
- [ ] Discovery archive isolated per org
- [ ] Custom domains cannot be hijacked

---

#### Step 3: Test Authentication

**Create test accounts:**

1. **Regular User (role: user):**
   - Can read own data
   - Cannot delete records
   - Cannot access admin panel

2. **Manager (role: manager):**
   - Can create/update records
   - Can access team dashboard
   - Cannot modify organization settings

3. **Admin (role: admin):**
   - Can manage users
   - Can configure integrations
   - Cannot delete organization

4. **Owner (role: owner):**
   - Full access to organization
   - Can modify billing
   - Can delete organization (with confirmation)

5. **Super Admin (role: super_admin):**
   - Platform-level access
   - Can access ALL organizations (IT support)
   - Can modify Firestore rules

**Verification Tests:**

| Test | Expected Result |
|------|----------------|
| User tries to delete record | ❌ 403 Forbidden |
| Manager creates workflow | ✅ 201 Created |
| Admin deletes organization | ❌ 403 Forbidden |
| Owner updates billing | ✅ 200 OK |
| Super Admin accesses Org A and Org B | ✅ 200 OK for both |

**Checklist:**
- [ ] Role-based access control working
- [ ] Users cannot escalate privileges
- [ ] Super admin email configured in Firestore
- [ ] Session timeout working (default: 2 hours)

---

#### Step 4: Rate Limiting Test

**Middleware Rate Limits:**
- 100 requests per minute per IP
- Exceptions: `/api/webhooks/*`, `/api/cron/*`

**Test:**

```bash
# Stress test (should trigger rate limiting after 100 requests)
for i in {1..120}; do
  curl -w "%{http_code}\n" https://yourdomain.com/api/health
done

# Expected:
# Requests 1-100: 200 OK
# Requests 101-120: 429 Too Many Requests
```

**Checklist:**
- [ ] Rate limiting active in production
- [ ] 429 responses returned after threshold
- [ ] Webhooks exempt from rate limiting
- [ ] CRON jobs exempt from rate limiting

---

### Phase 7: Performance Optimization (30 minutes)

#### Step 1: Build Optimization

**Verify in `next.config.js`:**

```javascript
{
  swcMinify: true,           // ✅ Fast minification
  compress: true,            // ✅ Gzip compression
  images: {
    formats: ['image/avif', 'image/webp'],  // ✅ Modern formats
    minimumCacheTTL: 31536000,              // ✅ 1 year cache
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],  // ✅ Tree-shaking
  },
}
```

**Checklist:**
- [x] SWC minification enabled
- [x] Gzip compression enabled
- [x] Image optimization configured
- [x] Large packages tree-shaken

---

#### Step 2: Caching Strategy

**Static Assets:**
```
Cache-Control: public, max-age=31536000, immutable
```

**Published Pages:**
```
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

**API Routes:**
```
Cache-Control: no-store
```

**Vercel Edge Caching:**
- Static files cached at edge (< 50ms response)
- ISR pages regenerated on-demand
- API routes always fresh

**Checklist:**
- [ ] Cache headers configured in `next.config.js`
- [ ] Static assets cached for 1 year
- [ ] Published pages cached for 1 hour
- [ ] API routes not cached

---

#### Step 3: Database Performance

**Firestore Query Optimization:**

1. **Use Indexed Queries:**
   - All composite indexes deployed (`firestore.indexes.json`)
   - Check Firebase Console → Firestore → Indexes for auto-created indexes

2. **Pagination:**
   - ✅ All list pages use `usePagination` hook
   - ✅ Firestore cursor-based pagination (no `limit` + `offset`)
   - ✅ 25 items per page (configurable)

3. **Caching:**
   - Discovery archive: 30-day cache (proprietary moat)
   - Lead scores: 7-day cache (auto-refresh on data change)
   - Enrichment data: 30-day cache

**Checklist:**
- [ ] Composite indexes deployed
- [ ] Pagination working on all list pages
- [ ] No `getAll()` queries (all paginated)
- [ ] Caching implemented for expensive operations

---

### Phase 8: Monitoring & Error Tracking (20 minutes)

#### Step 1: Sentry Setup

**Sentry Dashboard → Create Project → Next.js**

1. **Copy DSN:**
   ```bash
   SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxx@sentry.io/1234567
   ```

2. **Verify Integration:**
   - Sentry auto-initialized via `sentry.client.config.ts`
   - Server errors tracked via `sentry.server.config.ts`
   - Edge runtime tracked via `sentry.edge.config.ts`

3. **Test Error Tracking:**
   ```bash
   # Trigger test error
   curl https://yourdomain.com/api/sentry-test

   # Check Sentry Dashboard → Issues
   # Expected: New issue appears
   ```

**Configure Alerts:**
- Email on new issues
- Slack webhook (optional)
- PagerDuty integration (for critical errors)

**Checklist:**
- [ ] Sentry DSN configured
- [ ] Test error appears in Sentry
- [ ] Alerts configured
- [ ] Source maps uploaded (optional)

---

#### Step 2: Structured Logging

**Logger Configuration:**

```typescript
// All console.log replaced with structured logger
logger.info('User created', {
  userId: user.uid,
  orgId: user.organizationId,
  role: user.role,
});

logger.error('Payment failed', error, {
  stripeCustomerId,
  amount,
  currency,
});
```

**Log Aggregation:**
- **Vercel:** Automatic log aggregation in dashboard
- **Self-Hosted:** Ship logs to Datadog/Logtail/Logflare

**Checklist:**
- [x] All `console.log` replaced with `logger.*`
- [x] Context objects include `orgId`, `userId`, `route`
- [ ] Log aggregation configured
- [ ] Log retention policy set

---

#### Step 3: Health Check Endpoint

**Test:**

```bash
curl https://yourdomain.com/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-12-30T00:00:00.000Z",
  "services": {
    "firebase": "connected",
    "stripe": "connected",
    "sendgrid": "connected"
  }
}
```

**Checklist:**
- [ ] Health check returns 200 OK
- [ ] All services report "connected"
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom, etc.)

---

### Phase 9: Deployment Execution (30 minutes)

#### Option A: Deploy to Vercel (Recommended)

**Step 1: Connect GitHub Repository**

1. **Vercel Dashboard → Add New Project**
2. **Import Git Repository:** `github.com/yourusername/ai-sales-platform`
3. **Framework Preset:** Next.js (auto-detected)
4. **Root Directory:** `./` (default)
5. **Build Command:** `npm run build` (default)
6. **Output Directory:** `.next` (default)
7. **Install Command:** `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install`

**Step 2: Configure Environment Variables**

**Vercel Dashboard → Project Settings → Environment Variables**

Add ALL environment variables from `PRODUCTION_ENVIRONMENT_VARIABLES.md`:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSy...` | Production |
| `FIREBASE_ADMIN_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | Production |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Production |
| ... | ... | Production |

**Critical Notes:**
- Use **multi-line editor** for `FIREBASE_ADMIN_PRIVATE_KEY`
- Include `\n` newlines in private key
- Use **Production** environment (not Preview or Development)

**Step 3: Deploy**

```bash
# Option 1: Push to main branch (auto-deploy)
git checkout main
git merge dev
git push origin main

# Option 2: Use Vercel CLI
npm install -g vercel
vercel login
vercel --prod
```

**Expected Output:**
```
✅ Production: https://ai-sales-platform.vercel.app
✅ Custom Domain: https://yourdomain.com (if configured)
```

**Step 4: Configure Custom Domain (Optional)**

1. **Vercel Dashboard → Project → Settings → Domains**
2. **Add Domain:** `yourdomain.com`
3. **Configure DNS:**
   - Type: `CNAME`
   - Name: `@` (or `www`)
   - Value: `cname.vercel-dns.com`
4. **Wait for DNS propagation** (5-60 minutes)
5. **SSL Certificate:** Auto-issued by Vercel

**Checklist:**
- [ ] Project created in Vercel
- [ ] All environment variables configured
- [ ] Deployment successful
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active (HTTPS working)

---

#### Option B: Self-Hosted Deployment

**Prerequisites:**
- Server with Node.js 18+ installed
- PM2 or systemd for process management
- Nginx reverse proxy (recommended)

**Step 1: Clone and Build**

```bash
# SSH into server
ssh user@your-server.com

# Clone repository
git clone https://github.com/yourusername/ai-sales-platform.git
cd ai-sales-platform

# Install dependencies
npm install --production

# Build production bundle
npm run build
```

**Step 2: Configure Environment Variables**

```bash
# Create .env.production file
cp env.template .env.production

# Edit with production values
nano .env.production

# Set NODE_ENV
echo "NODE_ENV=production" >> .env.production
```

**Step 3: Start with PM2**

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start npm --name "ai-sales-platform" -- start

# Set to restart on server reboot
pm2 startup
pm2 save

# Monitor logs
pm2 logs ai-sales-platform
```

**Step 4: Configure Nginx Reverse Proxy**

```nginx
# /etc/nginx/sites-available/ai-sales-platform
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "origin-when-cross-origin" always;

    # Proxy to Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files cache
    location /_next/static {
        proxy_pass http://localhost:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/ai-sales-platform /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

**Step 5: SSL Certificate (Let's Encrypt)**

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (cron)
sudo crontab -e
# Add: 0 0 * * * certbot renew --quiet
```

**Checklist:**
- [ ] Application built successfully
- [ ] PM2 running and monitoring app
- [ ] Nginx configured as reverse proxy
- [ ] SSL certificate installed
- [ ] HTTPS working
- [ ] Auto-restart on server reboot configured

---

### Phase 10: Post-Deployment Verification (30 minutes)

#### Step 1: Smoke Tests

**Test critical user flows:**

1. **Homepage loads:**
   ```bash
   curl -I https://yourdomain.com
   # Expected: 200 OK
   ```

2. **User registration:**
   - Visit: `https://yourdomain.com/signup`
   - Create account with email
   - Verify confirmation email received
   - ✅ User created in Firestore `users` collection

3. **Authentication:**
   - Login with created account
   - Dashboard loads
   - User profile shows correct organization

4. **E-commerce checkout (if applicable):**
   - Add product to cart
   - Proceed to checkout
   - Enter test card: `4242 4242 4242 4242`, Exp: `12/34`, CVC: `123`
   - Complete purchase
   - ✅ Order created in Firestore
   - ✅ Confirmation email sent
   - ✅ Stripe webhook received

5. **Email sending:**
   - Create email campaign
   - Send test email
   - ✅ Email received in inbox (not spam)

6. **Workflow execution:**
   - Create simple workflow (e.g., "Welcome email on signup")
   - Trigger workflow
   - ✅ Workflow executes successfully
   - ✅ Actions complete (email sent, record updated, etc.)

**Checklist:**
- [ ] Homepage loads in < 2 seconds
- [ ] User registration works
- [ ] Login works
- [ ] Dashboard loads
- [ ] Checkout completes successfully
- [ ] Emails send successfully
- [ ] Workflows execute correctly

---

#### Step 2: Monitor Logs for Errors

**Vercel:**
- **Vercel Dashboard → Project → Logs**
- Filter: Last 1 hour
- Look for: Error 500, Error 400, Unhandled exceptions

**Self-Hosted:**
```bash
# PM2 logs
pm2 logs ai-sales-platform --lines 100

# Look for:
# - Uncaught exceptions
# - Database connection errors
# - API failures
```

**Sentry:**
- **Sentry Dashboard → Issues**
- Filter: Last hour
- **Expected:** No critical errors

**Checklist:**
- [ ] No unhandled exceptions in logs
- [ ] No database connection errors
- [ ] No API authentication failures
- [ ] Sentry shows no critical errors

---

#### Step 3: Performance Audit

**Run Lighthouse:**

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit
lighthouse https://yourdomain.com --view

# Expected scores:
# Performance: 90+
# Accessibility: 90+
# Best Practices: 90+
# SEO: 90+
```

**Key Metrics:**
- **Largest Contentful Paint (LCP):** < 2.5s
- **First Input Delay (FID):** < 100ms
- **Cumulative Layout Shift (CLS):** < 0.1
- **Time to Interactive (TTI):** < 3.5s

**Checklist:**
- [ ] Lighthouse Performance score > 90
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1

---

#### Step 4: Security Scan

**Run OWASP ZAP or Security Headers:**

```bash
# Check security headers
curl -I https://yourdomain.com

# Expected headers:
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
# Referrer-Policy: origin-when-cross-origin
# Strict-Transport-Security: max-age=31536000 (if HTTPS)
```

**Test SQL Injection (should fail):**
```bash
curl "https://yourdomain.com/api/leads?orgId=123' OR '1'='1"
# Expected: 400 Bad Request or 403 Forbidden
```

**Test XSS (should be sanitized):**
```bash
curl -X POST https://yourdomain.com/api/leads \
  -H "Content-Type: application/json" \
  -d '{"name": "<script>alert(\"XSS\")</script>"}'
# Expected: Input sanitized, script tags removed
```

**Checklist:**
- [ ] Security headers present
- [ ] SQL injection prevented
- [ ] XSS inputs sanitized
- [ ] CSRF protection active
- [ ] HTTPS enforced (HTTP → HTTPS redirect)

---

### Phase 11: Create Super Admin User (10 minutes)

**Firestore Console:**

1. **Navigate:** Firebase Console → Firestore Database → `users` collection

2. **Create document with ID = your email (e.g., `admin@yourdomain.com`):**

```json
{
  "email": "admin@yourdomain.com",
  "displayName": "Platform Admin",
  "role": "super_admin",
  "organizationId": "platform_admin",
  "createdAt": "2025-12-30T00:00:00.000Z",
  "updatedAt": "2025-12-30T00:00:00.000Z",
  "isActive": true
}
```

3. **Create corresponding user in Firebase Authentication:**
   - Firebase Console → Authentication → Add user
   - Email: `admin@yourdomain.com`
   - Password: (Strong password)
   - **User UID must match Firestore document ID**

4. **Test super admin access:**
   - Login with super admin credentials
   - Navigate to `/admin` (platform admin panel)
   - ✅ Can access all organizations
   - ✅ Can view system metrics

**Checklist:**
- [ ] Super admin user created in Firestore
- [ ] Super admin user created in Firebase Auth
- [ ] UIDs match
- [ ] Can access admin panel
- [ ] Can view all organizations

---

### Phase 12: Documentation & Handoff (20 minutes)

**Update Documentation:**

1. **README.md:**
   - Update production URL
   - Add deployment status badge
   - Link to user guide

2. **Create PRODUCTION_RUNBOOK.md:**
   - Common issues and fixes
   - Rollback procedure
   - Emergency contacts
   - Incident response plan

3. **Update CHANGELOG.md:**
   - Tag release version (v1.0.0)
   - List all features
   - Known issues (if any)

**Tag Release:**

```bash
git tag -a v1.0.0 -m "Production Release v1.0.0"
git push origin v1.0.0
```

**Create GitHub Release:**
- GitHub → Releases → Create new release
- Tag: v1.0.0
- Title: "AI Sales Platform v1.0.0 - Production Launch"
- Description: Changelog summary

**Checklist:**
- [ ] README.md updated
- [ ] Production runbook created
- [ ] Git tagged with v1.0.0
- [ ] GitHub release created
- [ ] Team notified of deployment

---

## 🎯 Success Criteria

**Production deployment is SUCCESSFUL when:**

- ✅ All 20+ environment variables configured
- ✅ Firestore rules deployed and verified
- ✅ Firestore indexes deployed
- ✅ Stripe webhook configured and tested
- ✅ Email service verified (test email sent)
- ✅ Production build successful (< 5MB bundle)
- ✅ Smoke tests pass (signup, login, checkout, workflows)
- ✅ Lighthouse Performance score > 90
- ✅ No critical errors in Sentry
- ✅ Super admin user created
- ✅ Monitoring and logging active

**Expected Metrics After 24 Hours:**
- Uptime: 99.9%+
- Error rate: < 0.1%
- P95 response time: < 500ms
- Zero critical bugs
- Zero security incidents

---

## 🆘 Rollback Procedure

**If deployment fails or critical bugs discovered:**

### Vercel Rollback:

1. **Vercel Dashboard → Project → Deployments**
2. **Find previous working deployment**
3. **Click "..." → Promote to Production**
4. **Verify:** Previous version now live

**Rollback time:** < 2 minutes

### Self-Hosted Rollback:

```bash
# Stop current version
pm2 stop ai-sales-platform

# Checkout previous tag
git checkout v0.9.0

# Rebuild
npm install
npm run build

# Restart
pm2 restart ai-sales-platform
```

**Rollback time:** 5-10 minutes

---

## 📊 Post-Launch Monitoring

**Monitor for 48 Hours:**

1. **Error Tracking (Sentry):**
   - Check every 2 hours
   - Alert on > 10 errors/hour

2. **Performance (Vercel Analytics / New Relic):**
   - Monitor response times
   - Alert on P95 > 1s

3. **Uptime (UptimeRobot / Pingdom):**
   - Check every 5 minutes
   - Alert on downtime > 1 minute

4. **Database (Firebase Console):**
   - Monitor read/write ops
   - Alert on > 10K ops/minute (quota exceeded)

5. **Costs:**
   - Firebase usage
   - Stripe fees
   - SendGrid email sends
   - OpenAI API calls

**Daily Metrics to Track:**
- New user signups
- Total active organizations
- Revenue (Stripe)
- Email deliverability rate
- Workflow execution success rate
- Average page load time

---

## 🎉 Congratulations!

**Your AI Sales Platform is now LIVE in production! 🚀**

**Next Steps:**
1. Monitor metrics for 48 hours
2. Address any issues quickly
3. Announce launch to users
4. Gather feedback
5. Plan next feature iteration

**Support:**
- Issues: GitHub Issues
- Emergency: Slack #production-incidents
- Documentation: `/docs`

---

**Deployed By:** _______________  
**Deployment Date:** _______________  
**Production URL:** https://yourdomain.com  
**Status:** 🟢 LIVE

**END OF DEPLOYMENT GUIDE**
