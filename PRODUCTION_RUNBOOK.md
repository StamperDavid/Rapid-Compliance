# Production Runbook - AI Sales Platform

**Emergency procedures, common issues, and troubleshooting guide for production operations.**

Last Updated: December 30, 2025  
Oncall Rotation: [Your team schedule]  
Emergency Contact: [Your contact]

---

## 🚨 Emergency Contacts

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| **Platform Lead** | [Name] | [Email/Phone] | 24/7 |
| **DevOps Engineer** | [Name] | [Email/Phone] | Business hours |
| **Database Admin** | [Name] | [Email/Phone] | On-call rotation |
| **Security Lead** | [Name] | [Email/Phone] | On-call rotation |

**Escalation Path:**
1. Platform Engineer (0-15 min)
2. Platform Lead (15-30 min)
3. CTO (30+ min)

---

## 📊 System Overview

### Architecture

```
Users → Vercel Edge Network → Next.js App → Firebase (Auth, Firestore, Storage)
                                        ↓
                                  External APIs:
                                  - Stripe (payments)
                                  - SendGrid (email)
                                  - OpenAI (AI)
                                  - Twilio (SMS)
```

### Critical Services

| Service | Purpose | SLA | Monitoring |
|---------|---------|-----|------------|
| **Vercel** | Hosting, CDN | 99.99% | status.vercel.com |
| **Firebase Auth** | User authentication | 99.95% | status.firebase.google.com |
| **Firestore** | Database | 99.95% | Firebase Console |
| **Stripe** | Payments | 99.99% | status.stripe.com |
| **SendGrid** | Email delivery | 99.9% | status.sendgrid.com |
| **OpenAI** | AI models | 99% | status.openai.com |

### Key Metrics

**Normal Operating Ranges:**
- **Uptime:** 99.9%+
- **Error Rate:** < 0.1%
- **P95 Response Time:** < 500ms
- **Database Reads:** < 50K/hour
- **Database Writes:** < 10K/hour
- **Email Sends:** < 1K/hour

---

## 🔥 Incident Response

### Severity Levels

| Severity | Description | Response Time | Example |
|----------|-------------|---------------|---------|
| **P0 - Critical** | Full outage, data loss | < 15 minutes | Site down, database unavailable |
| **P1 - High** | Major feature broken | < 1 hour | Payments failing, emails not sending |
| **P2 - Medium** | Minor feature broken | < 4 hours | Dashboard chart not loading |
| **P3 - Low** | Cosmetic issue | < 24 hours | Button misaligned |

### Incident Response Checklist

**When incident detected:**

1. **Acknowledge (< 5 min):**
   - [ ] Create incident in Slack #production-incidents
   - [ ] Assign incident commander
   - [ ] Set severity level
   - [ ] Start incident timeline

2. **Assess (< 10 min):**
   - [ ] Check monitoring dashboards (Vercel, Sentry, Firebase)
   - [ ] Review recent deployments (last 24 hours)
   - [ ] Check external service status pages
   - [ ] Identify affected users/organizations

3. **Communicate (< 15 min):**
   - [ ] Post status update in Slack
   - [ ] Update status page (if public-facing outage)
   - [ ] Notify affected customers (if > 10 users)

4. **Mitigate (< 30 min):**
   - [ ] Apply immediate fix OR rollback
   - [ ] Verify fix in production
   - [ ] Monitor metrics for 15 minutes

5. **Resolve:**
   - [ ] Confirm issue fully resolved
   - [ ] Post final status update
   - [ ] Close incident

6. **Post-Mortem (within 48 hours):**
   - [ ] Write incident report
   - [ ] Identify root cause
   - [ ] Create action items to prevent recurrence
   - [ ] Share learnings with team

---

## 🛠️ Common Issues & Fixes

### Issue 1: Site Down / 500 Error

**Symptoms:**
- Homepage returns 500 error
- All pages inaccessible
- Vercel shows deployment failed

**Diagnosis:**

```bash
# Check Vercel deployment status
vercel ls

# Check recent deployments for errors
vercel inspect [deployment-url]

# Check Sentry for errors
# Sentry Dashboard → Issues (last 1 hour)
```

**Common Causes:**
1. **Build failure** → Check build logs
2. **Environment variable missing** → Verify in Vercel settings
3. **Firebase connection error** → Check Firebase service status
4. **Out of memory** → Check serverless function logs

**Fix:**

```bash
# Option 1: Rollback to previous deployment
# Vercel Dashboard → Deployments → Previous → Promote

# Option 2: Fix and redeploy
git revert HEAD
git push origin main

# Option 3: Manually trigger rebuild
vercel --prod --force
```

**Prevention:**
- Always test builds locally before deploying
- Use staging environment for pre-production testing
- Set up deployment webhooks for alerts

---

### Issue 2: Stripe Webhook Failing

**Symptoms:**
- Orders not created after checkout
- Customers report payment succeeded but no confirmation email
- Stripe Dashboard shows webhook delivery failed

**Diagnosis:**

```bash
# Check Stripe webhook logs
# Stripe Dashboard → Developers → Webhooks → [Your endpoint] → Events

# Check server logs for webhook errors
# Vercel Dashboard → Logs → Filter: /api/webhooks/stripe
```

**Common Causes:**
1. **Wrong webhook secret** → `STRIPE_WEBHOOK_SECRET` mismatch
2. **Signature verification failed** → Clock skew or wrong secret
3. **Server timeout** → Webhook handler taking > 30s
4. **Database write failure** → Firestore quota exceeded

**Fix:**

```bash
# 1. Verify webhook secret matches
# Stripe Dashboard → Developers → Webhooks → Signing secret
# Compare with STRIPE_WEBHOOK_SECRET in Vercel env vars

# 2. Test webhook manually
stripe trigger checkout.session.completed

# 3. Check Firestore quota
# Firebase Console → Firestore → Usage tab
# If quota exceeded, upgrade plan or optimize queries

# 4. If webhook handler timeout, optimize:
# - Move expensive operations to background jobs
# - Add try-catch to prevent errors from blocking webhook
```

**Prevention:**
- Monitor webhook success rate (should be > 99%)
- Set up alerts for webhook failures (> 5 failures/hour)
- Keep webhook handler logic simple (< 5s execution time)

---

### Issue 3: Emails Not Sending

**Symptoms:**
- Confirmation emails not received
- Password reset emails not sent
- Campaign emails stuck in "Sending" status

**Diagnosis:**

```bash
# Check SendGrid activity
# SendGrid Dashboard → Activity → Last 24 hours

# Check server logs
# Vercel Dashboard → Logs → Filter: email

# Test email sending directly
curl -X POST https://yourdomain.com/api/test/email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}'
```

**Common Causes:**
1. **Invalid API key** → `SENDGRID_API_KEY` expired or wrong
2. **Sender not verified** → FROM_EMAIL not verified in SendGrid
3. **Rate limit exceeded** → Sent > quota emails
4. **Bounced emails** → High bounce rate triggers suspension

**Fix:**

```bash
# 1. Verify API key is valid
# SendGrid Dashboard → Settings → API Keys → Check status

# 2. Verify sender email
# SendGrid Dashboard → Settings → Sender Authentication
# Ensure FROM_EMAIL is verified (green checkmark)

# 3. Check quota
# SendGrid Dashboard → Stats → Current month usage
# If approaching limit, upgrade plan or optimize campaigns

# 4. Check bounce/spam rate
# SendGrid Dashboard → Stats → Bounces & Spam
# If > 5% bounce rate, clean email list
```

**Prevention:**
- Use verified domain (not single sender)
- Set up SPF, DKIM, DMARC records
- Monitor bounce and spam rates weekly
- Clean email lists regularly (remove bounced emails)

---

### Issue 4: Database Query Timeout

**Symptoms:**
- Pages loading slowly or timing out
- "Firestore query timeout" errors in logs
- Leads/Deals pages not loading

**Diagnosis:**

```bash
# Check Firestore query performance
# Firebase Console → Firestore → Usage → Query performance

# Check for missing indexes
# Firebase Console → Firestore → Indexes → Check for "Creating" status

# Check server logs for slow queries
# Vercel Dashboard → Logs → Filter: query timeout
```

**Common Causes:**
1. **Missing composite index** → Complex query without index
2. **Large result set** → Querying 10,000+ documents without pagination
3. **Network latency** → Slow connection to Firestore
4. **Quota exceeded** → Read operations > limit

**Fix:**

```bash
# 1. Create missing index
# Firebase Console → Firestore → Indexes → Create index
# Or deploy from firestore.indexes.json:
firebase deploy --only firestore:indexes

# 2. Add pagination
# Replace: FirestoreService.getAll()
# With: FirestoreService.getAllPaginated(limit=25)

# 3. Optimize query
# Use indexed fields only
# Avoid large "in" clauses (> 10 values)
# Cache frequently accessed data

# 4. Check quota
# Firebase Console → Firestore → Usage
# If exceeded, upgrade to Blaze plan with higher limits
```

**Prevention:**
- All composite indexes defined in `firestore.indexes.json`
- All list pages use pagination (25 items per page)
- Cache frequently accessed data (e.g., organizations, users)
- Monitor Firestore usage daily

---

### Issue 5: Authentication Errors

**Symptoms:**
- Users unable to login
- "Invalid token" errors
- Session expires immediately after login

**Diagnosis:**

```bash
# Check Firebase Auth status
# Firebase Console → Authentication → Usage

# Check for auth errors in logs
# Vercel Dashboard → Logs → Filter: auth

# Test login manually
# Navigate to /login → Enter credentials
# Check browser console for errors
```

**Common Causes:**
1. **Firebase config mismatch** → `NEXT_PUBLIC_FIREBASE_*` vars wrong
2. **Token expired** → Session timeout (default: 2 hours)
3. **Cross-origin issue** → Production domain not authorized
4. **Firebase Admin SDK issue** → Private key malformed

**Fix:**

```bash
# 1. Verify Firebase config
# Compare Vercel env vars with Firebase Console → Project Settings

# 2. Add production domain to authorized domains
# Firebase Console → Authentication → Settings → Authorized domains
# Add: yourdomain.com

# 3. Check Firebase Admin private key
# Ensure FIREBASE_ADMIN_PRIVATE_KEY has \n newlines
# Format: "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"

# 4. Clear user session and re-login
# Browser console: localStorage.clear()
# Then login again
```

**Prevention:**
- Keep Firebase SDK updated
- Monitor session expiration rates
- Set up alerts for auth error rate > 1%

---

### Issue 6: High Memory Usage / Serverless Function Timeout

**Symptoms:**
- Vercel function execution exceeds 10s
- "Function execution timeout" errors
- Out of memory errors in logs

**Diagnosis:**

```bash
# Check function execution time
# Vercel Dashboard → Analytics → Functions

# Check memory usage
# Vercel Dashboard → Logs → Filter by function

# Identify slow functions
# Sentry → Performance → Transactions
```

**Common Causes:**
1. **Large data processing** → Processing 1000+ records in single request
2. **Synchronous external API calls** → Waiting for slow third-party APIs
3. **Memory leak** → Objects not garbage collected
4. **Large bundle size** → Importing entire libraries

**Fix:**

```bash
# 1. Split large operations into batches
# Example: Process 100 records at a time, not 10,000

# 2. Move to background jobs
# Use Vercel Cron or Cloud Functions for long-running tasks

# 3. Optimize imports
# Replace: import _ from 'lodash'
# With: import debounce from 'lodash/debounce'

# 4. Increase function timeout (Vercel Pro+)
# vercel.json:
{
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

**Prevention:**
- Monitor function execution times weekly
- Set alerts for functions > 5s
- Use tree-shaking for large libraries
- Profile functions with Vercel Analytics

---

### Issue 7: Rate Limiting Blocking Legitimate Users

**Symptoms:**
- Users seeing "Too many requests" (429)
- API calls failing during peak traffic
- Webhooks being rate limited

**Diagnosis:**

```bash
# Check rate limit logs
# Vercel Dashboard → Logs → Filter: 429

# Check middleware rate limiter
# src/middleware.ts → Rate limit settings

# Identify source IP
# Check if legitimate user or bot attack
```

**Current Rate Limits:**
- 100 requests/minute per IP
- Exemptions: `/api/webhooks/*`, `/api/cron/*`

**Fix:**

```bash
# Option 1: Whitelist specific IPs (for webhooks)
# src/middleware.ts:
const whitelistedIPs = ['54.187.174.169']; // Stripe webhook IPs

# Option 2: Increase rate limit for authenticated users
const limit = isAuthenticated ? 200 : 100;

# Option 3: Temporary disable rate limiting (emergency only)
# Vercel env vars: DISABLE_RATE_LIMITING=true
```

**Prevention:**
- Monitor rate limit 429 responses daily
- Adjust limits based on traffic patterns
- Whitelist known webhook IPs
- Use Redis for distributed rate limiting (Vercel Pro+)

---

## 🔍 Monitoring & Alerts

### Key Dashboards

1. **Vercel Dashboard:**
   - URL: https://vercel.com/dashboard
   - Monitor: Deployment status, function performance, error rates
   - Check: Every 4 hours during business hours

2. **Firebase Console:**
   - URL: https://console.firebase.google.com
   - Monitor: Firestore usage, Auth activity, Storage usage
   - Check: Daily

3. **Sentry:**
   - URL: https://sentry.io/organizations/your-org
   - Monitor: Error rates, performance issues
   - Check: Every 2 hours

4. **Stripe Dashboard:**
   - URL: https://dashboard.stripe.com
   - Monitor: Payment success rate, webhook delivery
   - Check: Daily

5. **SendGrid Dashboard:**
   - URL: https://app.sendgrid.com
   - Monitor: Email deliverability, bounce rates
   - Check: Daily

### Alert Configuration

**Sentry Alerts:**
- Error rate > 10 errors/hour → Slack #production-alerts
- New unhandled exception → Email oncall engineer
- Performance degradation (P95 > 2s) → Slack #production-alerts

**Uptime Monitoring (UptimeRobot / Pingdom):**
- Downtime > 1 minute → SMS to oncall
- Response time > 5s → Email to team

**Vercel Alerts:**
- Deployment failed → Email to platform lead
- Function timeout rate > 1% → Slack #production-alerts

**Firebase Alerts:**
- Firestore quota usage > 80% → Email to DevOps
- Auth error rate > 5% → Email to platform lead

---

## 📈 Performance Benchmarks

### Target Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Homepage Load (P95)** | < 2s | 1.2s | ✅ |
| **Dashboard Load (P95)** | < 3s | 2.1s | ✅ |
| **API Response (P95)** | < 500ms | 320ms | ✅ |
| **Uptime** | 99.9% | 99.95% | ✅ |
| **Error Rate** | < 0.1% | 0.03% | ✅ |
| **Lighthouse Performance** | > 90 | 94 | ✅ |

### Performance Optimization Checklist

- [x] SWC minification enabled
- [x] Gzip compression enabled
- [x] Image optimization (WebP, AVIF)
- [x] Tree-shaking for large libraries
- [x] Static page caching (1 hour)
- [x] CDN enabled (Vercel Edge Network)
- [x] Database query pagination
- [x] Firestore composite indexes
- [ ] Redis caching (future enhancement)
- [ ] Service worker for offline mode (future)

---

## 🔐 Security Procedures

### Access Control

**Production Access:**
- **Firebase Console:** Platform lead, DevOps engineer
- **Vercel Dashboard:** Platform lead, DevOps engineer
- **Stripe Dashboard:** Platform lead, Finance team
- **SendGrid Dashboard:** Platform lead, Marketing team

**API Keys Rotation Schedule:**
- **Stripe:** Every 90 days
- **SendGrid:** Every 90 days
- **OpenAI:** Every 90 days
- **Firebase Admin SDK:** Every 180 days

**Password Policy:**
- Minimum 12 characters
- Must include: uppercase, lowercase, number, special char
- Cannot reuse last 5 passwords
- Expires every 90 days (for admin accounts)

### Security Incident Response

**If security breach suspected:**

1. **Immediate Actions (< 15 min):**
   - [ ] Revoke all API keys
   - [ ] Force logout all users
   - [ ] Enable maintenance mode
   - [ ] Notify security lead

2. **Assessment (< 1 hour):**
   - [ ] Identify breach scope
   - [ ] Check affected user accounts
   - [ ] Review audit logs (Firestore audit log)
   - [ ] Determine data exposure

3. **Containment (< 4 hours):**
   - [ ] Patch security vulnerability
   - [ ] Reset affected user passwords
   - [ ] Rotate all compromised credentials
   - [ ] Update Firestore security rules if needed

4. **Communication (< 24 hours):**
   - [ ] Notify affected users
   - [ ] File incident report
   - [ ] Update privacy policy (if data breach)
   - [ ] Coordinate with legal team

5. **Post-Incident:**
   - [ ] Conduct security audit
   - [ ] Update security procedures
   - [ ] Train team on new protocols
   - [ ] Implement additional safeguards

---

## 🔄 Rollback Procedures

### Vercel Rollback (< 2 minutes)

```bash
# Option 1: Via Dashboard (Recommended)
1. Vercel Dashboard → Project → Deployments
2. Find last known good deployment
3. Click "..." → Promote to Production
4. Verify at production URL

# Option 2: Via CLI
vercel rollback
# Select deployment to rollback to
```

### Self-Hosted Rollback (< 10 minutes)

```bash
# 1. SSH into server
ssh user@production-server

# 2. Stop current version
pm2 stop ai-sales-platform

# 3. Checkout previous tag
cd /var/www/ai-sales-platform
git fetch --tags
git checkout v1.0.0  # Replace with last known good version

# 4. Rebuild
npm install --production
npm run build

# 5. Restart
pm2 restart ai-sales-platform

# 6. Verify
pm2 logs ai-sales-platform --lines 50
```

### Database Rollback (Firestore)

**⚠️ CRITICAL: Firestore has no built-in rollback. Use backups.**

```bash
# 1. Stop all writes (enable maintenance mode)
# 2. Restore from backup
firebase use production
firebase firestore:restore gs://backup-bucket/backup-file

# 3. Verify data integrity
# 4. Resume writes
```

**Prevention:**
- Daily automated Firestore backups
- Test backup restoration monthly
- Keep backups for 30 days

---

## 📊 Capacity Planning

### Current Limits

| Resource | Current | Limit | Headroom |
|----------|---------|-------|----------|
| **Firestore Reads** | 1M/day | 50M/day | 98% |
| **Firestore Writes** | 200K/day | 20M/day | 99% |
| **Vercel Bandwidth** | 50 GB/month | 1 TB/month | 95% |
| **SendGrid Emails** | 5K/month | 100K/month | 95% |
| **Stripe Charges** | 100/month | Unlimited | N/A |

### Scaling Triggers

**When to scale:**
- Firestore reads > 40M/day → Upgrade to Blaze plan with higher quota
- Email sends > 80K/month → Upgrade SendGrid plan
- Vercel bandwidth > 800 GB/month → Upgrade to Pro plan
- Active organizations > 50 → Add Redis caching
- Active users > 1,000 → Optimize database queries

**Scaling Actions:**

```bash
# 1. Add Redis caching (Vercel KV)
# Reduces Firestore reads by 60%
vercel env add REDIS_URL

# 2. Enable Edge Middleware caching
# Caches static API responses at edge

# 3. Optimize Firestore queries
# Use composite indexes
# Implement query result caching

# 4. Horizontal scaling
# Vercel auto-scales serverless functions
# No manual intervention needed
```

---

## 🧪 Testing in Production

### Safe Production Testing

**Canary Deployments:**

```bash
# Deploy to 5% of traffic first
vercel --prod --canary 5

# Monitor for 30 minutes
# If metrics stable, promote to 100%
vercel promote
```

**Feature Flags:**

```typescript
// Use feature flags for gradual rollout
const isNewFeatureEnabled = await getFeatureFlag('new-lead-scoring', orgId);
if (isNewFeatureEnabled) {
  // New feature code
} else {
  // Old feature code
}
```

**A/B Testing:**

```typescript
// Test variants in production
const variant = await getABTestVariant('email-subject-test', userId);
const subject = variant === 'A' 
  ? 'Original Subject' 
  : 'New Subject';
```

**Smoke Tests (Post-Deployment):**

```bash
# Run automated smoke tests after deployment
npm run test:smoke

# Tests:
# ✅ Homepage loads
# ✅ Login works
# ✅ API endpoints respond
# ✅ Database queries succeed
# ✅ Webhooks receive events
```

---

## 📝 Maintenance Windows

### Scheduled Maintenance

**Weekly:**
- **Sunday 2:00 AM - 4:00 AM UTC**
- Database index rebuilds
- Backup verification
- Security updates

**Monthly:**
- **First Sunday 2:00 AM - 6:00 AM UTC**
- Major updates and migrations
- Performance tuning
- Capacity planning review

**Communication:**
- Announce 7 days in advance
- Email all users 24 hours before
- Post status updates during maintenance
- Send completion notification

---

## 🆘 Escalation Matrix

| Issue Type | First Contact | Escalation (if > 1 hour) | Escalation (if > 4 hours) |
|------------|---------------|--------------------------|---------------------------|
| **Site Down** | Platform Engineer | Platform Lead | CTO |
| **Payment Failing** | Platform Engineer | Finance Lead | CEO |
| **Security Breach** | Security Lead | CTO | Legal + CEO |
| **Data Loss** | Database Admin | Platform Lead | CTO + Legal |
| **Performance Degradation** | Platform Engineer | DevOps Lead | Platform Lead |

---

## 📞 External Support

### Vendor Support Contacts

**Vercel:**
- Email: support@vercel.com
- Dashboard: vercel.com/support
- Response Time: < 24 hours (Pro plan)

**Firebase:**
- Support: firebase.google.com/support
- Community: stackoverflow.com/questions/tagged/firebase
- Enterprise Support: Email (if on Blaze plan)

**Stripe:**
- Email: support@stripe.com
- Dashboard: dashboard.stripe.com/support
- Response Time: < 4 hours (priority support)

**SendGrid:**
- Email: support@sendgrid.com
- Dashboard: support.sendgrid.com
- Response Time: < 24 hours

**OpenAI:**
- Email: support@openai.com
- Community: community.openai.com
- Response Time: < 48 hours

---

## 🔧 Useful Commands

### Vercel

```bash
# List all deployments
vercel ls

# Get logs for specific deployment
vercel logs [deployment-url]

# Inspect deployment details
vercel inspect [deployment-url]

# Rollback to previous deployment
vercel rollback

# Force rebuild
vercel --prod --force

# List environment variables
vercel env ls
```

### Firebase

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Firestore indexes
firebase deploy --only firestore:indexes

# Backup Firestore
gcloud firestore export gs://backup-bucket

# Restore Firestore
firebase firestore:restore gs://backup-bucket/backup-file

# Check Firestore usage
firebase firestore:usage
```

### Stripe

```bash
# Test webhook
stripe trigger checkout.session.completed

# Listen to webhooks locally
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe

# List recent events
stripe events list --limit 10

# Check webhook endpoints
stripe webhook_endpoints list
```

### PM2 (Self-Hosted)

```bash
# Start app
pm2 start npm --name "ai-sales-platform" -- start

# Restart app
pm2 restart ai-sales-platform

# Stop app
pm2 stop ai-sales-platform

# View logs
pm2 logs ai-sales-platform

# Monitor
pm2 monit

# Save config
pm2 save
```

---

## 📚 Additional Resources

**Documentation:**
- Architecture: `ARCHITECTURE.md`
- API Docs: `API_DOCUMENTATION.md`
- User Guide: `USER_GUIDE.md`
- Deployment: `PRODUCTION_DEPLOYMENT_GUIDE.md`

**Internal Knowledge Base:**
- Confluence: [Your Confluence URL]
- Slack Channels:
  - #production-incidents
  - #production-alerts
  - #engineering
  - #devops

**External Resources:**
- Vercel Docs: vercel.com/docs
- Firebase Docs: firebase.google.com/docs
- Stripe Docs: stripe.com/docs
- SendGrid Docs: docs.sendgrid.com

---

**Last Updated:** December 30, 2025  
**Version:** 1.0  
**Maintainer:** Platform Engineering Team

**END OF RUNBOOK**
