# Infrastructure Map

**Last Updated:** December 30, 2025  
**Target Audience:** System Administrators, DevOps Engineers  
**Complexity:** High

---

## Overview

This document maps all background processes, scheduled jobs, webhooks, and async workers in the AI Sales Platform. It provides operational context for monitoring, debugging, and scaling infrastructure.

---

## Table of Contents

1. [Cron Jobs](#1-cron-jobs)
2. [Webhook Handlers](#2-webhook-handlers)
3. [Background Workers](#3-background-workers)
4. [Message Queues](#4-message-queues)
5. [External Services](#5-external-services)
6. [Monitoring & Health Checks](#6-monitoring--health-checks)

---

## 1. Cron Jobs

### 1.1 Sequence Processor
**Route:** `/api/cron/process-sequences`  
**Schedule:** Every hour (`0 * * * *`)  
**Purpose:** Process scheduled email sequences and trigger next steps  
**File:** `/src/app/api/cron/process-sequences/route.ts`

#### What It Does:
1. Queries all active sequence enrollments
2. Checks which steps are due to execute (based on delay settings)
3. Sends emails/SMS for due steps
4. Updates enrollment status
5. Triggers next step in sequence

#### Database Operations:
- **Reads:** `organizations/{orgId}/enrollments` (where `status = "active"`)
- **Writes:** 
  - `organizations/{orgId}/enrollments/{enrollmentId}` (update step status)
  - `organizations/{orgId}/emails/{emailId}` (log sent emails)
  - `organizations/{orgId}/sequenceAnalytics/{analyticsId}` (track performance)

#### Configuration:
```typescript
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/process-sequences",
      "schedule": "0 * * * *"
    }
  ]
}
```

#### Authentication:
```typescript
const authHeader = request.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

#### Response Format:
```json
{
  "success": true,
  "processed": 247,
  "errors": 3,
  "timestamp": "2025-12-30T20:00:00.000Z"
}
```

#### Typical Execution Time: 5-30 seconds (depends on number of active sequences)

#### Monitoring:
- CloudWatch/Vercel Logs: Search for "Processing sequences (cron)"
- Sentry: Track errors in sequence processing
- Alert if execution time > 60s (function timeout)

---

### 1.2 Scheduled Publisher
**Route:** `/api/cron/scheduled-publisher`  
**Schedule:** Every 5 minutes (`*/5 * * * *`)  
**Purpose:** Publish website pages and blog posts that have scheduled publish dates  
**File:** `/src/app/api/cron/scheduled-publisher/route.ts`

#### What It Does:
1. Queries pages/posts with `status = "scheduled"` and `publishDate <= now`
2. Updates status to `"published"`
3. Invalidates CDN cache
4. Sends notification to page owner

#### Database Operations:
- **Reads:** `organizations/{orgId}/website/pages/items/*` (where `status = "scheduled"`)
- **Writes:** 
  - `organizations/{orgId}/website/pages/items/{pageId}` (set `status = "published"`)
  - `organizations/{orgId}/website/audit-log/entries/*` (log publish event)

#### Configuration:
```typescript
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/scheduled-publisher",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

#### Response Format:
```json
{
  "success": true,
  "pagesPublished": 3,
  "postsPublished": 1,
  "errors": [],
  "timestamp": "2025-12-30T20:05:00.000Z"
}
```

#### Typical Execution Time: 1-5 seconds

---

### 1.3 Record Counter (Volume-Based Pricing)
**Route:** `/api/cron/recalculate-record-counts`  
**Schedule:** Daily at 2 AM UTC (`0 2 * * *`)  
**Purpose:** Recalculate record counts for all organizations to determine correct pricing tier  
**File:** `/src/lib/subscription/record-counter.ts`

#### What It Does:
1. For each active organization:
   - Count records across all collections (leads, deals, contacts, products)
   - Compare current count to tier thresholds
   - If tier should change, trigger subscription update
2. Update Firestore with latest counts
3. Sync with Stripe if tier changed

#### Database Operations:
- **Reads:** All records in `organizations/{orgId}/leads`, `deals`, `contacts`, `products`
- **Writes:** 
  - `organizations/{orgId}` (update `recordCount` field)
  - `organizations/{orgId}/subscriptions/current` (update tier if changed)

#### Tier Thresholds:
```typescript
export const VOLUME_TIERS = {
  starter: { min: 0, max: 100, price: 1900 },      // $19/mo
  growth: { min: 101, max: 1000, price: 4900 },    // $49/mo
  scale: { min: 1001, max: 10000, price: 14900 },  // $149/mo
  enterprise: { min: 10001, max: Infinity, price: 49900 } // $499/mo
};
```

#### Typical Execution Time: 10-60 minutes (depends on number of organizations)

#### Manual Trigger:
```bash
curl -X POST https://app.salesvelocity.ai/api/cron/recalculate-record-counts \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

### 1.4 Cleanup Expired Data (TTL)
**Route:** `/api/cron/cleanup-expired`  
**Schedule:** Daily at 3 AM UTC (`0 3 * * *`)  
**Purpose:** Delete expired data (cached enrichment, temporary scrapes, old sessions)  
**File:** `/src/app/api/cron/cleanup-expired/route.ts`

#### What It Does:
1. Delete cached enrichment data older than 30 days
2. Delete temporary scrapes from Discovery Archive
3. Delete expired preview tokens
4. Delete old audit logs (retention: 90 days)

#### Database Operations:
- **Deletes from:**
  - `organizations/{orgId}/enrichment-cache/*` (where `createdAt < 30 days ago`)
  - `discoveryArchive/*` (where `createdAt < 30 days ago`)
  - `organizations/{orgId}/website/preview-tokens/tokens/*` (where `expiresAt < now`)

#### Typical Execution Time: 5-15 minutes

---

## 2. Webhook Handlers

### 2.1 Stripe Webhooks
**Route:** `/api/webhooks/stripe`  
**Method:** POST  
**Purpose:** Handle Stripe payment events (subscriptions, invoices, checkouts)  
**File:** `/src/app/api/webhooks/stripe/route.ts`

#### Supported Events:

| Event | Handler | Action |
|-------|---------|--------|
| `checkout.session.completed` | `handleCheckoutSessionCompleted` | Process e-commerce order, create order record |
| `customer.subscription.trial_will_end` | `handleTrialWillEnd` | Calculate tier, send email notification |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Sync subscription status to Firestore |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Mark subscription as canceled |
| `invoice.payment_succeeded` | `handlePaymentSucceeded` | Log successful payment in billing history |
| `invoice.payment_failed` | `handlePaymentFailed` | Mark subscription as past_due, send alert email |

#### Webhook Verification:
```typescript
const signature = request.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
```

#### Database Operations:
- **Reads:** `organizations/{orgId}`, `users/{ownerId}`
- **Writes:** 
  - `organizations/{orgId}/subscriptions/current`
  - `organizations/{orgId}/billing_history/{historyId}`

#### Configuration in Stripe:
1. Dashboard → Developers → Webhooks
2. Add endpoint: `https://app.salesvelocity.ai/api/webhooks/stripe`
3. Select events (listed above)
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

#### Testing Locally:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

#### Response Format:
```json
{
  "received": true
}
```

#### Retry Policy:
Stripe automatically retries failed webhooks:
- Immediately
- After 1 hour
- After 3 hours
- After 6 hours
- After 12 hours

#### Monitoring:
- Stripe Dashboard → Webhooks → View recent attempts
- Sentry: Track webhook processing errors
- CloudWatch: Search for "[Stripe Webhook]" in logs

---

### 2.2 SendGrid Email Webhooks
**Route:** `/api/webhooks/email`  
**Method:** POST  
**Purpose:** Track email delivery status (delivered, opened, clicked, bounced)  
**File:** `/src/app/api/webhooks/email/route.ts`

#### Supported Events:

| Event | Action |
|-------|--------|
| `delivered` | Mark email as delivered in Firestore |
| `open` | Track email open event |
| `click` | Track link click event |
| `bounce` | Mark email as bounced, update contact status |
| `spam_report` | Flag contact, pause sequences |

#### Database Operations:
- **Writes:** 
  - `organizations/{orgId}/emails/{emailId}` (update delivery status)
  - `organizations/{orgId}/emailEvents/{eventId}` (log tracking events)
  - `organizations/{orgId}/sequenceAnalytics/{analyticsId}` (update open/click rates)

#### Configuration in SendGrid:
1. Dashboard → Settings → Mail Settings → Event Webhook
2. HTTP POST URL: `https://app.salesvelocity.ai/api/webhooks/email`
3. Select events to track
4. (Optional) Enable OAuth for webhook security

---

### 2.3 Twilio Voice/SMS Webhooks
**Route:** `/api/webhooks/voice` (voice calls)  
**Route:** `/api/webhooks/sms` (SMS messages)  
**Method:** POST  
**Purpose:** Handle incoming calls and SMS messages  
**Files:** 
- `/src/app/api/webhooks/voice/route.ts`
- `/src/app/api/webhooks/sms/route.ts`

#### Voice Webhook (`/api/webhooks/voice`)
**Triggered:** When customer calls your Twilio number

**Response (TwiML):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Thank you for calling. Your call is being recorded for quality assurance.
  </Say>
  <Record maxLength="120" transcribe="true" transcribeCallback="/api/webhooks/voice/transcription"/>
</Response>
```

#### SMS Webhook (`/api/webhooks/sms`)
**Triggered:** When customer replies to SMS sequence

**Actions:**
1. Parse SMS body for keywords ("STOP", "HELP", "YES", "NO")
2. Update sequence enrollment based on reply
3. Trigger AI agent response (if conversational AI enabled)
4. Log SMS reply in Firestore

#### Database Operations:
- **Writes:**
  - `organizations/{orgId}/smsMessages/{messageId}` (log incoming SMS)
  - `organizations/{orgId}/enrollments/{enrollmentId}` (update based on reply)
  - `chatSessions/{sessionId}/messages/{messageId}` (if AI conversation)

#### Configuration in Twilio:
1. Console → Phone Numbers → Active Numbers
2. Click your number
3. Configure webhooks:
   - Voice: `https://app.salesvelocity.ai/api/webhooks/voice`
   - SMS: `https://app.salesvelocity.ai/api/webhooks/sms`

---

### 2.4 Gmail Sync Webhook
**Route:** `/api/webhooks/gmail`  
**Method:** POST  
**Purpose:** Sync Gmail inbox for organizations with email integration  
**File:** `/src/app/api/webhooks/gmail/route.ts`

#### What It Does:
1. Receive Gmail push notification
2. Fetch new emails via Gmail API
3. Parse email metadata (sender, subject, body)
4. Match sender to contact in CRM
5. Log email in activity timeline

#### Database Operations:
- **Reads:** `organizations/{orgId}/integrations/gmail` (get OAuth tokens)
- **Writes:** `organizations/{orgId}/emails/{emailId}` (log received emails)

#### Setup:
1. Enable Gmail API in Google Cloud Console
2. Create OAuth client ID
3. User authorizes Gmail access in app
4. Subscribe to push notifications via Gmail API
5. Gmail sends webhook to this endpoint when new email arrives

---

## 3. Background Workers

### 3.1 Discovery Engine (Web Scraping)
**Service:** Async worker processing job queue  
**Purpose:** Scrape websites to gather company/person data  
**File:** `/src/lib/services/discovery-engine.ts`

#### Architecture:
```
User triggers discovery → Job added to queue → Worker picks up job → 
Scrapes website → Stores in Discovery Archive → Returns results
```

#### Queue System:
- **Collection:** `organizations/{orgId}/discoveryQueue`
- **Status Flow:** `pending` → `processing` → `completed` or `failed`

#### Worker Logic:
```typescript
async function processDiscoveryQueue(orgId: string) {
  const pendingJobs = await getQueue(orgId, 'pending');
  
  for (const job of pendingJobs) {
    // Mark as processing
    await updateJobStatus(job.id, 'processing');
    
    try {
      // Scrape target URL
      const data = await scrapeWebsite(job.url);
      
      // Store in Discovery Archive (30-day TTL)
      await storeInArchive(orgId, data);
      
      // Mark as completed
      await updateJobStatus(job.id, 'completed', data);
    } catch (error) {
      // Mark as failed
      await updateJobStatus(job.id, 'failed', error);
    }
  }
}
```

#### Concurrency Limits:
- Max 5 concurrent scrapes per organization
- Max 50 concurrent scrapes globally (to avoid rate limits)

#### Trigger:
- User-initiated: Click "Enrich Lead" in UI
- Automatic: On lead import (if enrichment enabled)
- API: `POST /api/discovery/enqueue`

---

### 3.2 AI Training Pipeline
**Service:** Fine-tuning job processor  
**Purpose:** Train custom AI models on organization's conversation data  
**File:** `/src/lib/ai/training-manager.ts`

#### Steps:
1. **Data Collection:** Aggregate approved conversation transcripts
2. **Preprocessing:** Format as JSONL for fine-tuning API
3. **Validation:** Check data quality (min 50 examples)
4. **Submit Job:** Send to OpenAI Fine-Tuning API
5. **Monitor:** Poll job status every 5 minutes
6. **Deploy:** Update organization's AI model ID when complete

#### Database Operations:
- **Reads:** `organizations/{orgId}/trainingData/*`
- **Writes:** 
  - `fineTuningJobs/{jobId}` (track job progress)
  - `organizations/{orgId}/goldenMasters/{masterId}` (update model ID)

#### Typical Duration: 30 minutes - 2 hours (depends on dataset size)

---

### 3.3 Email Sender Queue
**Service:** Rate-limited email sender  
**Purpose:** Send bulk emails while respecting SendGrid rate limits  
**File:** `/src/lib/outbound/sequence-engine.ts`

#### Rate Limits:
- **SendGrid Free:** 100 emails/day
- **SendGrid Essentials:** 40,000 emails/day
- **SendGrid Pro:** 100,000 emails/day

#### Queue Logic:
```typescript
async function processSendQueue(orgId: string) {
  const queuedEmails = await getQueue(orgId, 'pending');
  
  // Respect rate limits (max 100/hour for free tier)
  const rateLimitPerHour = getRateLimit(orgId);
  const sent = await getEmailsSentThisHour(orgId);
  
  const remaining = rateLimitPerHour - sent;
  const toSend = queuedEmails.slice(0, remaining);
  
  for (const email of toSend) {
    try {
      await sendEmail(email);
      await markAsSent(email.id);
    } catch (error) {
      await markAsFailed(email.id, error);
    }
  }
}
```

#### Monitoring:
- Track send rate vs. limit
- Alert if approaching daily cap
- Auto-pause sequences if limit reached

---

## 4. Message Queues

### 4.1 Firestore-Based Queues
The platform uses Firestore collections as lightweight job queues:

| Queue | Collection Path | Purpose |
|-------|----------------|---------|
| Discovery Queue | `organizations/{orgId}/discoveryQueue` | Web scraping jobs |
| Email Queue | `organizations/{orgId}/emailQueue` | Pending emails |
| SMS Queue | `organizations/{orgId}/smsQueue` | Pending SMS |
| Webhook Queue | `webhookRetryQueue` | Failed webhooks to retry |

#### Queue Status Values:
- `pending`: Job not yet started
- `processing`: Worker picked up job
- `completed`: Job finished successfully
- `failed`: Job failed (with error details)
- `retrying`: Job failed, will retry

---

### 4.2 Queue Monitoring

**View queue lengths:**
```javascript
async function getQueueStats(orgId) {
  const queues = ['discoveryQueue', 'emailQueue', 'smsQueue'];
  
  for (const queue of queues) {
    const pending = await db.collection('organizations')
      .doc(orgId)
      .collection(queue)
      .where('status', '==', 'pending')
      .count()
      .get();
    
    console.log(`${queue}: ${pending.data().count} pending`);
  }
}
```

---

## 5. External Services

### 5.1 Service Dependencies

| Service | Purpose | Impact if Down | Fallback |
|---------|---------|----------------|----------|
| Firebase Firestore | Primary database | **CRITICAL:** App unusable | None (critical dependency) |
| Firebase Auth | User authentication | **CRITICAL:** Users can't login | None (critical dependency) |
| Stripe | Payment processing | **HIGH:** Billing fails | Manual invoicing |
| SendGrid | Email delivery | **HIGH:** Emails not sent | Queue for retry |
| OpenAI | AI conversations | **HIGH:** AI agent disabled | Anthropic Claude fallback |
| Twilio | SMS/voice | **MEDIUM:** Communication limited | Email-only sequences |
| Vercel | Hosting & edge functions | **CRITICAL:** App offline | None (critical dependency) |

---

### 5.2 Rate Limits

| Service | Limit | Action on Limit |
|---------|-------|-----------------|
| OpenAI GPT-4 | 10,000 requests/day | Switch to GPT-3.5 or Anthropic |
| SendGrid (Free) | 100 emails/day | Pause sequences, upgrade prompt |
| Stripe API | 100 req/sec | Retry with exponential backoff |
| Firebase Firestore | 10,000 reads/day (free) | Optimize queries, cache data |
| Twilio | 1 SMS/sec per number | Queue and throttle sends |

---

## 6. Monitoring & Health Checks

### 6.1 Health Check Endpoint
**Route:** `/api/health`  
**Method:** GET  
**Purpose:** Verify system health for uptime monitoring

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-30T20:00:00.000Z",
  "services": {
    "database": "connected",
    "stripe": "connected",
    "sendgrid": "connected",
    "openai": "connected"
  },
  "version": "1.0.0"
}
```

#### Monitor with:
- UptimeRobot (free tier: 5-minute checks)
- Pingdom
- StatusCake
- Vercel's built-in monitoring

---

### 6.2 Key Metrics to Track

#### Application Metrics:
- Request latency (p50, p95, p99)
- Error rate (4xx, 5xx responses)
- Database query performance
- API endpoint usage

#### Business Metrics:
- Active organizations
- Trial conversion rate
- AI token usage per org
- Sequence send rate
- Revenue (Stripe MRR)

#### Infrastructure Metrics:
- Vercel function execution time
- Firebase quota usage
- CDN bandwidth
- Error tracking (Sentry)

---

### 6.3 Alerting Rules

Set up alerts for:

| Condition | Severity | Action |
|-----------|----------|--------|
| Error rate > 5% | **HIGH** | Page on-call engineer |
| Cron job failed 3x | **MEDIUM** | Slack notification |
| SendGrid quota > 80% | **LOW** | Email notification |
| Stripe webhook failure rate > 10% | **HIGH** | Investigate immediately |
| Firebase quota > 90% | **MEDIUM** | Plan upgrade |

---

### 6.4 Log Aggregation

**Centralized Logging:**
- Vercel Logs (7-day retention)
- Sentry (error tracking)
- Firebase Console (Firestore operations)
- Stripe Dashboard (webhook logs)

**Search Examples:**
```bash
# Find failed cron jobs
vercel logs --filter="[Cron]" --filter="error"

# Find failed Stripe webhooks
vercel logs --filter="[Stripe Webhook]" --filter="failed"

# Find slow queries
vercel logs --filter="query took" --filter=">1000ms"
```

---

## 7. Disaster Recovery

### 7.1 Service Outage Playbook

#### Firebase Outage:
1. Check [Firebase Status Page](https://status.firebase.google.com/)
2. Enable maintenance mode banner
3. Notify customers via status page
4. Switch to cached data (read-only mode)

#### Stripe Outage:
1. Check [Stripe Status Page](https://status.stripe.com/)
2. Queue subscription changes for later processing
3. Allow users to continue using platform (grace period)

#### Vercel Outage:
1. Check [Vercel Status Page](https://www.vercel-status.com/)
2. No action possible (wait for Vercel recovery)
3. Communicate ETA to customers

---

### 7.2 Rollback Procedure

If deployment breaks production:

```bash
# Revert to previous deployment
vercel rollback

# Or revert via dashboard:
# Vercel Dashboard → Project → Deployments → Previous → Promote to Production
```

---

## END OF DOCUMENT
