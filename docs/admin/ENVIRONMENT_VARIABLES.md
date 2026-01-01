# Environment Variables Dictionary

**Last Updated:** December 30, 2025  
**Target Audience:** System Administrators, DevOps Engineers  
**Complexity:** High

---

## Overview

This document catalogs every environment variable used in the AI Sales Platform, including purpose, required status, default values, and impact if missing.

---

## Variable Categories

1. [Firebase Configuration](#1-firebase-configuration)
2. [AI/LLM Provider Keys](#2-aillm-provider-keys)
3. [Email Service](#3-email-service)
4. [Payment Processing](#4-payment-processing-stripe)
5. [Authentication](#5-authentication)
6. [Infrastructure & Deployment](#6-infrastructure--deployment)
7. [Monitoring & Analytics](#7-monitoring--analytics)
8. [Data Enrichment APIs](#8-data-enrichment-apis-optional)
9. [Communication Services](#9-communication-services)
10. [System Security](#10-system-security)

---

## 1. Firebase Configuration

### Client SDK (Public)

| Variable | Required | Purpose | Impact if Missing | Default |
|----------|----------|---------|-------------------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | **Yes** | Firebase Web API key for client-side auth | **CRITICAL:** Authentication fails, users cannot login | None |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | **Yes** | Firebase Auth domain | **CRITICAL:** OAuth flows fail, auth redirects break | None |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | **Yes** | Firebase project identifier | **CRITICAL:** All Firebase operations fail | None |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | **Yes** | Firebase Storage bucket for file uploads | **HIGH:** File uploads fail (images, documents) | None |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | No | Firebase Cloud Messaging sender ID | **LOW:** Push notifications disabled (not currently used) | None |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | **Yes** | Firebase app identifier | **CRITICAL:** Firebase SDK initialization fails | None |

### Admin SDK (Server-side)

| Variable | Required | Purpose | Impact if Missing | Default |
|----------|----------|---------|-------------------|---------|
| `FIREBASE_ADMIN_PROJECT_ID` | **Yes** | Firebase project ID for Admin SDK | **CRITICAL:** Server-side database operations fail | None |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | **Yes** | Service account email | **CRITICAL:** Admin SDK authentication fails | None |
| `FIREBASE_ADMIN_PRIVATE_KEY` | **Yes** | Service account private key (base64 or raw) | **CRITICAL:** Admin SDK cannot authenticate | None |

**Setup Notes:**
- Service account keys are generated in Firebase Console → Project Settings → Service Accounts
- For local development, use `serviceAccountKey.json` file
- In production, set these as environment variables (never commit private keys)

---

## 2. AI/LLM Provider Keys

| Variable | Required | Purpose | Impact if Missing | Default |
|----------|----------|---------|-------------------|---------|
| `OPENAI_API_KEY` | **Yes** | OpenAI API for GPT models (conversation, distillation) | **CRITICAL:** AI agents cannot respond, lead enrichment fails | None |
| `ANTHROPIC_API_KEY` | Recommended | Anthropic Claude API (fallback AI provider) | **MEDIUM:** Reduces AI redundancy, no fallback if OpenAI fails | None |
| `GOOGLE_AI_API_KEY` | Optional | Google Gemini API (experimental features) | **LOW:** Experimental AI features disabled | None |

**Usage Context:**
- OpenAI is the primary LLM for:
  - Sales agent conversations (`/src/lib/ai/conversation-engine.ts`)
  - Lead scoring (`/src/lib/ai/lead-scoring.ts`)
  - Content generation (emails, SMS)
  - Distillation engine (web scraping intelligence)
- Anthropic is used as fallback when OpenAI rate limits are hit
- Google AI is experimental for persona training

**Cost Impact:**
- Average cost per conversation: $0.02 - $0.15
- Monthly AI spend (1000 conversations): $20 - $150

---

## 3. Email Service

| Variable | Required | Purpose | Impact if Missing | Default |
|----------|----------|---------|-------------------|---------|
| `SENDGRID_API_KEY` | **Yes** | SendGrid API for transactional emails | **HIGH:** Welcome emails, password resets, billing notifications fail | None |
| `FROM_EMAIL` | **Yes** | Sender email address | **HIGH:** Emails cannot be sent | `noreply@salesvelocity.ai` |
| `FROM_NAME` | No | Sender display name | **LOW:** Emails show generic sender name | `AI Sales Platform` |

**SendGrid Setup:**
1. Create SendGrid account
2. Generate API key with "Full Access" or "Mail Send" permission
3. Verify sender domain in SendGrid dashboard
4. Add SPF/DKIM records to DNS

**Email Types Sent:**
- User registration confirmation
- Password reset links
- Trial ending notifications (3 days before)
- Payment failure alerts
- Subscription changes
- Sequence execution reports

---

## 4. Payment Processing (Stripe)

| Variable | Required | Purpose | Impact if Missing | Default |
|----------|----------|---------|-------------------|---------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **Yes** | Stripe public key for client-side checkout | **CRITICAL:** Users cannot upgrade/downgrade plans | None |
| `STRIPE_SECRET_KEY` | **Yes** | Stripe secret key for server-side API calls | **CRITICAL:** Billing operations fail, subscriptions cannot be created | None |
| `STRIPE_WEBHOOK_SECRET` | **Yes** | Webhook signature verification secret | **CRITICAL:** Webhook events rejected, subscription updates not processed | None |

**Webhook Configuration:**
1. In Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.trial_will_end`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

**Volume-Based Pricing Tiers:**
- Starter: 0-100 records → $19/mo
- Growth: 101-1,000 records → $49/mo
- Scale: 1,001-10,000 records → $149/mo
- Enterprise: 10,001+ records → $499/mo

**Testing:**
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 5. Authentication

| Variable | Required | Purpose | Impact if Missing | Default |
|----------|----------|---------|-------------------|---------|
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID | **MEDIUM:** "Sign in with Google" disabled | None |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth secret | **MEDIUM:** Google OAuth fails | None |
| `GOOGLE_REDIRECT_URI` | Optional | OAuth callback URL | **MEDIUM:** Google OAuth redirects fail | None |

**Google OAuth Setup:**
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback` (dev)
   - `https://your-domain.com/api/auth/google/callback` (production)
4. Copy Client ID and Secret

---

## 6. Infrastructure & Deployment

| Variable | Required | Purpose | Impact if Missing | Default |
|----------|----------|---------|-------------------|---------|
| `NEXT_PUBLIC_APP_URL` | **Yes** | Base URL for the application | **HIGH:** OAuth redirects, webhooks, email links break | `http://localhost:3000` |
| `NODE_ENV` | **Yes** | Environment mode | **MEDIUM:** Logging, error handling, caching behavior incorrect | `development` |
| `NEXT_PUBLIC_BASE_DOMAIN` | **Yes** | Base domain for multi-tenant routing | **HIGH:** Subdomain routing fails | `localhost:3000` |
| `VERCEL_TOKEN` | Optional | Vercel API token for domain management | **LOW:** Automated DNS verification disabled | None |
| `VERCEL_PROJECT_ID` | Optional | Vercel project identifier | **LOW:** Automated domain setup disabled | None |
| `VERCEL_TEAM_ID` | Optional | Vercel team identifier | **LOW:** Automated deployments may fail | None |

**Multi-Tenant Routing:**
- `NEXT_PUBLIC_BASE_DOMAIN` is used for subdomain mapping
- Example: `acme.salesvelocity.ai` → Organization "acme"
- Middleware (`/src/middleware.ts`) handles routing logic

**Environment Values:**
- `development` → Local dev, verbose logging, Firebase emulators
- `production` → Live environment, error tracking, rate limiting
- `test` → Automated testing, Firebase emulators, mock data

---

## 7. Monitoring & Analytics

| Variable | Required | Purpose | Impact if Missing | Default |
|----------|----------|---------|-------------------|---------|
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional | PostHog analytics key | **LOW:** Product analytics disabled | None |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional | PostHog instance URL | **LOW:** Analytics not sent | `https://app.posthog.com` |
| `SENTRY_DSN` | Recommended | Sentry error tracking DSN | **MEDIUM:** Production errors not reported | None |

**PostHog Events Tracked:**
- User signups
- Feature usage (sequences, workflows, AI agent)
- Page views
- Conversion funnels

**Sentry Setup:**
1. Create Sentry project
2. Copy DSN from Project Settings
3. Set `SENTRY_DSN` environment variable
4. Errors are automatically captured and reported

---

## 8. Data Enrichment APIs (Optional)

These are optional third-party APIs for lead enrichment. If missing, enrichment features are degraded but not broken.

| Variable | Required | Purpose | Impact if Missing | Default |
|----------|----------|---------|-------------------|---------|
| `CLEARBIT_API_KEY` | No | Clearbit company/person data enrichment | **LOW:** Company logo, employee count unavailable | None |
| `CRUNCHBASE_API_KEY` | No | Crunchbase funding/investor data | **LOW:** Funding data not enriched | None |
| `BUILTWITH_API_KEY` | No | Technology stack detection | **LOW:** Tech stack insights unavailable | None |
| `NEWS_API_KEY` | No | Company news/press releases | **LOW:** News feed empty | None |
| `RAPIDAPI_KEY` | No | Generic API gateway key | **LOW:** Some enrichment APIs unavailable | None |

**Alternative:** The platform has a built-in "Scraper Intelligence" engine that can extract data from public websites without third-party APIs. See `/src/lib/scraper-intelligence/`.

---

## 9. Communication Services

| Variable | Required | Purpose | Impact if Missing | Default |
|----------|----------|---------|-------------------|---------|
| `TWILIO_ACCOUNT_SID` | Optional | Twilio account identifier | **MEDIUM:** SMS/voice features disabled | None |
| `TWILIO_AUTH_TOKEN` | Optional | Twilio authentication token | **MEDIUM:** SMS/voice API calls fail | None |
| `TWILIO_PHONE_NUMBER` | Optional | Twilio phone number for outbound calls | **MEDIUM:** Outbound calling disabled | None |

**Twilio Setup:**
1. Create Twilio account
2. Buy phone number (US: ~$1/month)
3. Copy Account SID and Auth Token from console
4. Configure webhook endpoint: `https://your-domain.com/api/webhooks/sms`

---

## 10. System Security

| Variable | Required | Purpose | Impact if Missing | Default |
|----------|----------|---------|-------------------|---------|
| `CRON_SECRET` | **Yes** | Bearer token for cron job authentication | **HIGH:** Cron endpoints accessible to public (security risk) | None |

**Cron Secret Generation:**
```bash
node scripts/generate-cron-secret.js
```

**Usage:**
Protects cron endpoints (`/api/cron/*`) from unauthorized access:
```typescript
const authHeader = request.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Vercel Cron Configuration:**
Set `CRON_SECRET` in Vercel dashboard, then configure in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/process-sequences",
      "schedule": "0 * * * *"
    }
  ]
}
```

---

## Environment-Specific Configuration

### Local Development (.env.local)
```bash
# Firebase (Dev Project)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-sales-dev
FIREBASE_ADMIN_PROJECT_ID=ai-sales-dev

# AI (Development Keys)
OPENAI_API_KEY=sk-...

# Local URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BASE_DOMAIN=localhost:3000

# Development Mode
NODE_ENV=development
```

### Production (Vercel Environment Variables)
```bash
# Firebase (Production Project)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-sales-prod
FIREBASE_ADMIN_PROJECT_ID=ai-sales-prod

# AI (Production Keys with higher rate limits)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Production URLs
NEXT_PUBLIC_APP_URL=https://app.salesvelocity.ai
NEXT_PUBLIC_BASE_DOMAIN=salesvelocity.ai

# Production Mode
NODE_ENV=production

# Security
CRON_SECRET=<generated-secret>
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Validation Script

Check all required environment variables:

```bash
node scripts/verify-env-vars.js
```

**Output:**
```
✓ NEXT_PUBLIC_FIREBASE_API_KEY is set
✓ FIREBASE_ADMIN_PROJECT_ID is set
✗ STRIPE_SECRET_KEY is missing (CRITICAL)
⚠ ANTHROPIC_API_KEY is missing (recommended)
```

---

## Security Best Practices

1. **Never commit `.env.local` or `.env.production` to git**
   - Already in `.gitignore`

2. **Rotate secrets quarterly**
   - Especially `STRIPE_SECRET_KEY`, `FIREBASE_ADMIN_PRIVATE_KEY`

3. **Use different Firebase projects for dev/staging/production**
   - Prevents accidental data corruption

4. **Encrypt sensitive variables in CI/CD**
   - Use Vercel's encrypted environment variables
   - Or GitHub Secrets for GitHub Actions

5. **Audit access logs**
   - Track who accessed environment variables in Vercel dashboard

---

## Troubleshooting

### Error: "Firebase Admin SDK not initialized"
**Cause:** Missing `FIREBASE_ADMIN_*` variables  
**Fix:** Verify service account credentials are set

### Error: "Stripe webhook signature verification failed"
**Cause:** `STRIPE_WEBHOOK_SECRET` mismatch  
**Fix:** Regenerate webhook secret in Stripe dashboard

### Error: "OpenAI API rate limit exceeded"
**Cause:** Free-tier API key or high traffic  
**Fix:** Upgrade OpenAI plan or add `ANTHROPIC_API_KEY` as fallback

### Warning: "SendGrid daily limit reached"
**Cause:** Free plan limit (100 emails/day)  
**Fix:** Upgrade SendGrid plan or reduce email volume

---

## END OF DOCUMENT
