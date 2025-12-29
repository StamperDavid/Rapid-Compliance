# Production Environment Variables

**Complete guide for configuring production environment variables for the AI Sales Platform.**

Last Updated: December 29, 2025

---

## 📋 Required Variables Checklist

### ✅ Firebase Configuration (6 variables) - **REQUIRED**

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc123
```

**Where to find:**
1. Go to Firebase Console → Project Settings → General
2. Scroll to "Your apps" → Web app
3. Copy each value from the Firebase config object

**Critical Notes:**
- These are **public** (NEXT_PUBLIC_ prefix) and safe to expose in client code
- Used for client-side Firebase SDK initialization
- Required for authentication, Firestore, and Storage

---

### ✅ Firebase Admin SDK (3 variables) - **REQUIRED**

```env
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE....\n-----END PRIVATE KEY-----\n"
```

**Where to find:**
1. Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download JSON file
4. Extract: `project_id`, `client_email`, `private_key`

**Critical Notes:**
- **NEVER** commit these to git
- **NEVER** expose in client code (no NEXT_PUBLIC_ prefix)
- Private key must include `\n` newline characters in quotes
- Used for server-side admin operations (bypassing security rules)

---

### ✅ AI Model APIs (3 variables) - **AT LEAST ONE REQUIRED**

```env
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AIzaSy...
```

**Where to find:**
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/settings/keys
- Google AI (Gemini): https://makersuite.google.com/app/apikey

**Critical Notes:**
- At least ONE AI provider required for AI agent functionality
- OpenAI recommended for best compatibility
- Used for: AI chat, email generation, function calling, embeddings
- Cost: Pay-per-token usage

**Production Recommendations:**
- Start with OpenAI (most features supported)
- Add Anthropic for Claude models (optional)
- Add Gemini for cost-effective embeddings (optional)

---

### ✅ Email Service (3 variables) - **REQUIRED**

```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Your Company Name
```

**Where to find:**
1. SendGrid: https://app.sendgrid.com/settings/api_keys
2. Create API key with "Mail Send" permissions
3. Verify sender email in SendGrid

**Critical Notes:**
- Required for: Confirmation emails, password resets, campaigns, workflows
- Alternative: Can use Resend instead (see Optional APIs below)
- FROM_EMAIL must be verified in SendGrid before production use

**Production Setup:**
1. Verify domain in SendGrid (recommended over single sender)
2. Set up SPF/DKIM records for email deliverability
3. Monitor bounce rates and spam reports

---

### ✅ Google OAuth (3 variables) - **REQUIRED FOR GMAIL/CALENDAR**

```env
GOOGLE_CLIENT_ID=123456789-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/integrations/google/callback
```

**Where to find:**
1. Google Cloud Console: https://console.cloud.google.com
2. APIs & Services → Credentials
3. Create OAuth 2.0 Client ID (Web application)
4. Add authorized redirect URI

**Critical Notes:**
- Required for Gmail and Google Calendar integrations
- GOOGLE_REDIRECT_URI must match exactly (including https://)
- Add both production and localhost redirect URIs during development

**Production Setup:**
1. Enable Gmail API and Google Calendar API
2. Configure OAuth consent screen (external, production mode)
3. Add authorized domains
4. Request verification if accessing sensitive scopes

---

### ✅ Stripe (3 variables) - **REQUIRED FOR PAYMENTS**

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Where to find:**
1. Stripe Dashboard: https://dashboard.stripe.com/apikeys
2. Publishable key: Safe to expose (NEXT_PUBLIC_)
3. Secret key: Server-only, never expose
4. Webhook secret: Developers → Webhooks → Add endpoint

**Critical Notes:**
- Use **pk_live_** and **sk_live_** for production (not test keys)
- STRIPE_WEBHOOK_SECRET created when setting up webhook endpoint
- Required events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*`

**Production Setup:**
1. Switch from test to live mode in Stripe Dashboard
2. Configure webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select all subscription and checkout events
4. Copy webhook signing secret to STRIPE_WEBHOOK_SECRET

**Webhook Configuration (CRITICAL):**
```
Endpoint URL: https://yourdomain.com/api/webhooks/stripe
Events to send:
  ✅ checkout.session.completed (creates order)
  ✅ customer.subscription.created
  ✅ customer.subscription.updated
  ✅ customer.subscription.deleted
  ✅ customer.subscription.trial_will_end
  ✅ invoice.payment_succeeded
  ✅ invoice.payment_failed
```

---

### ✅ Application Configuration (2 variables) - **REQUIRED**

```env
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
```

**Critical Notes:**
- NEXT_PUBLIC_APP_URL: No trailing slash
- Used for: OAuth redirects, email links, webhook URLs
- NODE_ENV: Must be "production" for production deployment

---

### ✅ Security & Monitoring (2 variables) - **REQUIRED**

```env
CRON_SECRET=random-secret-string-min-32-chars
SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxx@sentry.io/1234567
```

**Where to find:**
- CRON_SECRET: Generate random string (min 32 characters)
- Sentry DSN: https://sentry.io → Project Settings → Client Keys

**Critical Notes:**
- CRON_SECRET: Protects scheduled job endpoints from unauthorized access
- SENTRY_DSN: Optional but highly recommended for error tracking

**Generate CRON_SECRET:**
```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

### ✅ Website Builder (3 variables) - **REQUIRED FOR CUSTOM DOMAINS**

```env
NEXT_PUBLIC_BASE_DOMAIN=yourdomain.com
VERCEL_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VERCEL_PROJECT_ID=prj_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VERCEL_TEAM_ID=team_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Where to find:**
1. Vercel Dashboard: https://vercel.com/account/tokens
2. Create token with "Manage Domains" and "Manage DNS" permissions
3. Project ID and Team ID in project settings

**Critical Notes:**
- Required for custom domain DNS configuration
- NEXT_PUBLIC_BASE_DOMAIN: Main domain for subdomain websites
- Used by Website Builder for auto-DNS setup

---

## 🔧 Optional API Keys (Feature Enhancements)

### Prospect Enrichment APIs

```env
CLEARBIT_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxx
CRUNCHBASE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
BUILTWITH_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
NEWS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
RAPIDAPI_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
```

**Where to find:**
- Clearbit: https://clearbit.com/keys
- Crunchbase: https://data.crunchbase.com/docs/using-the-api
- BuiltWith: https://api.builtwith.com/api-key
- News API: https://newsapi.org/account
- RapidAPI: https://rapidapi.com/developer/security

**Impact if missing:**
- Prospect research features won't work
- Can configure per-organization in app settings instead

---

### Analytics & Monitoring

```env
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

**Where to find:**
- PostHog: https://app.posthog.com/project/settings
- Self-hosted or cloud instance

**Impact if missing:**
- Product analytics won't track
- User behavior insights unavailable

---

### Alternative Email Provider (Instead of SendGrid)

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

**Where to find:**
- Resend: https://resend.com/api-keys

**Critical Notes:**
- Use EITHER SendGrid OR Resend (not both)
- Code automatically detects which is configured
- Resend recommended for modern API and better DX

---

### Payment Providers (Additional Options)

```env
# PayPal
PAYPAL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYPAL_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYPAL_MODE=live

# Square
SQUARE_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SQUARE_LOCATION_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SQUARE_ENVIRONMENT=production

# Authorize.Net
AUTHORIZE_NET_API_LOGIN_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AUTHORIZE_NET_TRANSACTION_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Impact if missing:**
- Users can only pay via Stripe
- Alternative payment methods unavailable

---

### Communication APIs

```env
# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890

# Slack
SLACK_CLIENT_ID=1234567890.1234567890
SLACK_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Microsoft Teams
TEAMS_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TEAMS_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TEAMS_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Zoom
ZOOM_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ZOOM_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Impact if missing:**
- SMS features won't work (Twilio)
- Integration OAuth won't work for missing providers
- Can configure per-organization in app settings instead

---

## 🚀 Deployment Platform Configuration

### Vercel (Recommended)

1. **Add all required variables:**
   - Go to Project Settings → Environment Variables
   - Add each variable for "Production" environment
   - For multi-line values (Firebase private key), use Vercel's text editor

2. **Critical Vercel-specific settings:**
   ```env
   # Vercel auto-sets these (don't manually add):
   VERCEL=1
   VERCEL_URL=auto-generated
   VERCEL_ENV=production
   ```

3. **Build settings:**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`
   - Node.js Version: 18.x or 20.x

---

### Docker / Self-Hosted

Create `.env.production` file:

```bash
# Copy from env.template
cp env.template .env.production

# Edit with production values
nano .env.production
```

**Docker Compose Example:**

```yaml
version: '3.8'
services:
  app:
    build: .
    env_file:
      - .env.production
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
```

---

## 🔒 Security Best Practices

### ✅ DO:
- Use different secrets for development/staging/production
- Rotate API keys every 90 days
- Use environment variable management tools (Vercel, AWS Secrets Manager)
- Set up monitoring for API key usage anomalies
- Use least-privilege API keys (minimal scopes needed)

### ❌ DON'T:
- Commit .env files to git (already in .gitignore)
- Share production keys in Slack/email
- Use production keys in development
- Expose secret keys in client code
- Reuse the same CRON_SECRET across projects

---

## 🧪 Testing Environment Variables

**Before deploying to production:**

```bash
# 1. Validate all required variables are set
node -e "
const required = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'FIREBASE_ADMIN_PROJECT_ID',
  'OPENAI_API_KEY',
  'SENDGRID_API_KEY',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_APP_URL',
  'CRON_SECRET'
];

const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ Missing required variables:', missing);
  process.exit(1);
} else {
  console.log('✅ All required variables set');
}
"

# 2. Test Firebase connection
npm run test:firebase

# 3. Test Stripe webhook
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 📊 Variable Priority Matrix

| Priority | Variables | Count | Impact if Missing |
|----------|-----------|-------|-------------------|
| **P0 - Critical** | Firebase (client + admin), AI (1 provider), Email, App URL | 13 | App won't start |
| **P1 - High** | Stripe, Google OAuth, Security (CRON_SECRET) | 7 | Major features broken |
| **P2 - Medium** | Website builder (Vercel), Monitoring (Sentry) | 5 | Advanced features unavailable |
| **P3 - Low** | Enrichment APIs, Additional payment providers, PostHog | 10+ | Nice-to-have features missing |

**Minimum viable production:** 13 P0 variables  
**Recommended production:** 20 P0+P1 variables  
**Full-featured production:** 25-30 variables

---

## 🆘 Troubleshooting

### "Firebase Auth: Invalid API Key"
- Check NEXT_PUBLIC_FIREBASE_API_KEY is correct
- Verify Firebase project in console matches
- Ensure key is from Web app config (not Android/iOS)

### "Stripe webhook signature verification failed"
- STRIPE_WEBHOOK_SECRET doesn't match webhook endpoint
- Regenerate secret in Stripe Dashboard → Webhooks
- Ensure using live mode keys (not test)

### "Permission denied" errors in Firestore
- FIREBASE_ADMIN_PRIVATE_KEY malformed
- Check `\n` newlines in private key
- Ensure key is wrapped in quotes in .env

### "Email sending failed"
- SENDGRID_API_KEY invalid or expired
- FROM_EMAIL not verified in SendGrid
- Check SendGrid activity log for errors

---

## 📝 Production Deployment Checklist

Before going live:

- [ ] All 13 P0 variables configured in production environment
- [ ] All 7 P1 variables configured (if using features)
- [ ] Firebase Admin private key tested (can write to Firestore)
- [ ] Stripe webhook endpoint configured and tested
- [ ] SendGrid sender email verified and SPF/DKIM set up
- [ ] Google OAuth redirect URIs include production domain
- [ ] NEXT_PUBLIC_APP_URL matches actual production URL
- [ ] CRON_SECRET is strong random string (32+ chars)
- [ ] NODE_ENV=production
- [ ] All secrets rotated from development values
- [ ] Sentry DSN configured for error tracking
- [ ] Test deployment in staging environment first

---

**Last Updated:** December 29, 2025  
**Version:** 1.0 (Production Ready)  
**Maintainer:** AI Sales Platform Team
