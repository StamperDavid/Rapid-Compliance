# System Administrator's Operations Manual

**AI Sales Platform - Multi-Tenant SaaS**  
**Version:** 1.0  
**Last Updated:** December 30, 2025  
**Maintainer:** System Architecture Team

---

## 📚 Documentation Library

This directory contains comprehensive operational documentation for system administrators managing the AI Sales Platform (200k+ lines, Next.js 14, Firebase, Stripe).

---

## 📖 Documents

### 1. [Tenant Provisioning Flow](./TENANT_PROVISIONING_FLOW.md)
**Purpose:** Step-by-step technical breakdown of organization creation  
**Use When:** Onboarding new customers, debugging provisioning issues  
**Key Topics:**
- Database operations sequence (12 steps)
- Firebase Auth user creation
- Stripe subscription setup
- Multi-tenant isolation verification
- Rollback procedures
- Common provisioning issues

**Quick Reference:**
```bash
# Create organization via API
POST /api/admin/organizations
Body: { "name": "Acme Corp", "plan": "starter" }

# Organization ID format: org_1704067200000_abc123xyz
```

---

### 2. [Environment Variables Dictionary](./ENVIRONMENT_VARIABLES.md)
**Purpose:** Complete catalog of all environment variables  
**Use When:** Setting up environments, debugging config issues, onboarding developers  
**Key Topics:**
- 40+ environment variables documented
- Required vs optional status
- Impact analysis if missing
- Default values
- Security best practices

**Categories:**
- Firebase (6 client + 3 admin variables)
- AI/LLM Providers (OpenAI, Anthropic, Google)
- Email (SendGrid)
- Payments (Stripe)
- Authentication (Google OAuth)
- Infrastructure (Vercel, Node)
- Monitoring (PostHog, Sentry)
- Data Enrichment (Clearbit, Crunchbase, etc.)
- Communication (Twilio)
- Security (CRON_SECRET)

**Critical Variables:**
- `FIREBASE_ADMIN_PRIVATE_KEY` - Never commit to git
- `STRIPE_WEBHOOK_SECRET` - Required for billing
- `CRON_SECRET` - Protects scheduled jobs
- `OPENAI_API_KEY` - Powers AI agents

---

### 3. [Manual Intervention Guide](./MANUAL_INTERVENTION_GUIDE.md)
**Purpose:** Emergency procedures and support operations  
**Use When:** Customer support escalations, emergency fixes  
**Risk Level:** ⚠️ HIGH (direct database manipulation)

**Key Operations:**

#### Subscription Management
- Override subscription status
- Change pricing tier
- Extend trial period
- Emergency cancellation

```bash
# Fix subscription status
node scripts/fix-subscription-status.js org_123456 active

# Extend trial by 7 days
node scripts/extend-trial.js org_123456 7
```

#### AI Token Management
- Reset token usage
- Grant bonus credits
- View usage reports

```bash
# Reset AI tokens
node scripts/reset-ai-tokens.js org_123456

# Grant 10,000 bonus tokens
node scripts/grant-bonus-credits.js org_123456 10000 "Service disruption compensation"
```

#### User Impersonation
- Start support session
- End impersonation
- Audit impersonation history

```bash
# Impersonate user for debugging
node scripts/impersonate-user.js admin@example.com customer@acme.com "Debugging workflow issue"
```

#### Data Recovery
- Restore deleted records
- Recover from audit logs
- Merge duplicate organizations

---

### 4. [Infrastructure Map](./INFRASTRUCTURE_MAP.md)
**Purpose:** Complete guide to background processes and integrations  
**Use When:** Debugging async operations, monitoring infrastructure, scaling

**Infrastructure Components:**

#### Cron Jobs (4 scheduled tasks)
1. **Sequence Processor** - Every hour (`0 * * * *`)
   - Sends scheduled emails/SMS
   - ~5-30 seconds execution time
   
2. **Scheduled Publisher** - Every 5 minutes (`*/5 * * * *`)
   - Publishes scheduled website content
   - ~1-5 seconds execution time
   
3. **Record Counter** - Daily 2 AM UTC (`0 2 * * *`)
   - Calculates pricing tiers
   - ~10-60 minutes execution time
   
4. **Cleanup Expired** - Daily 3 AM UTC (`0 3 * * *`)
   - Deletes expired data (TTL)
   - ~5-15 minutes execution time

#### Webhook Handlers (4 endpoints)
1. **Stripe** - `/api/webhooks/stripe`
   - Payment events (6 event types)
   - Subscription management
   
2. **SendGrid** - `/api/webhooks/email`
   - Email tracking (delivered, opened, clicked)
   
3. **Twilio** - `/api/webhooks/voice` & `/api/webhooks/sms`
   - Incoming calls/SMS
   
4. **Gmail** - `/api/webhooks/gmail`
   - Email sync integration

#### Background Workers
- Discovery Engine (web scraping)
- AI Training Pipeline
- Email Sender Queue (rate-limited)

**Monitoring Endpoints:**
```bash
# Health check
GET /api/health

# Response: { "status": "healthy", "services": {...} }
```

---

### 5. [Security & Recovery](./SECURITY_AND_RECOVERY.md)
**Purpose:** Security architecture and disaster recovery procedures  
**Use When:** Security audits, incident response, data recovery

**Security Layers:**
1. Network (Vercel Edge, DDoS protection)
2. Authentication (Firebase Auth)
3. Authorization (Firestore Rules - 842 lines)
4. Application Logic (Input validation, XSS/CSRF)
5. Data Encryption (at-rest & in-transit)

**Firestore Security Rules Highlights:**
- **Deny by Default:** All collections start locked
- **Super Admin Bypass:** Full access for IT support
- **Organization Isolation:** Users limited to their `organizationId`
- **Role-Based Access:** 5-tier hierarchy (super_admin → owner → admin → manager → member)

**Critical Security Functions:**
```javascript
// Enforce multi-tenant isolation
function belongsToOrg(orgId) {
  return isAuthenticated() && getUserOrgId() == orgId;
}

// Prevent privilege escalation
allow update: if !('role' in request.resource.data.diff(resource.data).affectedKeys())

// Prevent tenant jumping
allow update: if !('organizationId' in request.resource.data.diff(resource.data).affectedKeys())
```

**Backup Strategy:**
- Automated daily backups (2 AM UTC)
- 30-day retention
- Point-in-time recovery capability

```bash
# Full database backup
ts-node scripts/backup-firestore.ts backup

# Restore from specific timestamp
ts-node scripts/backup-firestore.ts restore 2025-12-29T02-00-00

# Restore single organization
node scripts/restore-org.js --orgId=org_123456 --backup=2025-12-29T02-00-00
```

**Incident Response:**
- Data breach playbook
- Unauthorized access procedures
- GDPR compliance tools

---

## 🚀 Quick Start for New Admins

### Day 1: Essential Reading
1. Read **Environment Variables Dictionary** (understand the stack)
2. Verify all env vars are set: `node scripts/verify-env-vars.js`
3. Review **Security & Recovery** (understand the rules)

### Day 2: Operations Training
1. Read **Tenant Provisioning Flow** (understand customer onboarding)
2. Practice creating test organization: `POST /api/admin/organizations`
3. Review **Infrastructure Map** (understand background jobs)

### Day 3: Support Training
1. Read **Manual Intervention Guide** (emergency procedures)
2. Practice impersonation in staging environment
3. Test backup/restore process

### Week 2: Security Audit
1. Review Firestore rules: `firestore.rules` (842 lines)
2. Audit super_admin accounts
3. Test security rules locally: `npm run test:security`

---

## 🔧 Common Operations

### Create New Organization
```bash
curl -X POST https://app.salesvelocity.ai/api/admin/organizations \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "plan": "starter"}'
```

### Extend Customer Trial
```bash
node scripts/extend-trial.js org_123456 7
```

### Reset AI Token Usage
```bash
node scripts/reset-ai-tokens.js org_123456
```

### Impersonate User for Support
```bash
node scripts/impersonate-user.js admin@example.com customer@acme.com "Debugging issue"
```

### Backup Database
```bash
ts-node scripts/backup-firestore.ts backup
```

### View Cron Job Logs
```bash
vercel logs --filter="[Cron]"
```

### Check System Health
```bash
curl https://app.salesvelocity.ai/api/health
```

---

## 📊 Architecture Summary

### Tech Stack
- **Frontend:** Next.js 14 (React, TypeScript)
- **Database:** Firebase Firestore (NoSQL)
- **Authentication:** Firebase Auth
- **Payments:** Stripe (volume-based pricing)
- **Email:** SendGrid
- **AI:** OpenAI GPT-4, Anthropic Claude
- **Hosting:** Vercel (serverless functions)
- **Monitoring:** Sentry, PostHog

### Multi-Tenancy
- **Isolation Key:** `organizationId` field on all documents
- **Routing:** Subdomain/custom domain → organization mapping
- **Security:** Firestore rules enforce tenant boundaries
- **Billing:** Volume-based tiers (0-100, 101-1K, 1K-10K, 10K+ records)

### Pricing Tiers
| Tier | Records | Price/Month |
|------|---------|-------------|
| Starter | 0-100 | $19 |
| Growth | 101-1,000 | $49 |
| Scale | 1,001-10,000 | $149 |
| Enterprise | 10,001+ | $499 |

---

## 🛠️ Useful Scripts

All scripts located in `/scripts/` directory:

### Organization Management
- `create-platform-admin-org.js` - Create platform admin organization
- `cleanup-test-orgs.js` - Delete test organizations
- `merge-organizations.js` - Merge duplicate orgs (high-risk)

### User Management
- `create-super-admin.js` - Create super admin account (run once)
- `fix-user-roles.js` - Fix user role/org assignment
- `impersonate-user.js` - Start impersonation session

### Subscription Management
- `fix-subscription-status.js` - Override subscription status
- `extend-trial.js` - Extend trial period
- `grant-bonus-credits.js` - Grant AI token bonuses

### Data Management
- `backup-firestore.ts` - Backup database
- `restore-org-data.js` - Restore organization from backup
- `cleanup-expired-data.js` - Manual TTL cleanup

### Monitoring
- `verify-env-vars.js` - Check environment configuration
- `verify-database.js` - Validate database integrity
- `test-production-health.js` - Production health check

---

## 🚨 Emergency Contacts

### System Issues
- **Firebase Outage:** [status.firebase.google.com](https://status.firebase.google.com/)
- **Vercel Outage:** [vercel-status.com](https://www.vercel-status.com/)
- **Stripe Outage:** [status.stripe.com](https://status.stripe.com/)

### Escalation Paths
1. **Database Issues:** Check Firebase Console → Firestore
2. **Payment Issues:** Check Stripe Dashboard → Webhooks
3. **Email Issues:** Check SendGrid Dashboard → Activity
4. **Critical Outage:** Execute disaster recovery playbook (Security & Recovery doc)

---

## 📝 Documentation Maintenance

### Update Schedule
- **Monthly:** Review environment variables
- **Quarterly:** Update security procedures
- **After Major Changes:** Update relevant documentation

### Contribution Guidelines
1. All changes must be reviewed by senior admin
2. Test procedures in staging before documenting
3. Include version number and date in updates
4. Keep examples executable and tested

---

## 🔐 Security Reminders

### Super Admin Access
- Only 2-3 trusted personnel should have `super_admin` role
- Never share super admin credentials
- All super admin actions are logged and audited

### Environment Variables
- **Never commit** `.env.local` or private keys to git
- Rotate secrets quarterly
- Use separate Firebase projects for dev/prod

### Backup Verification
- Test restore process monthly
- Verify backup integrity weekly
- Maintain 30-day retention minimum

---

## 📞 Support Resources

### Internal Documentation
- `/docs/admin/` - This operations manual
- `/docs/` - General platform documentation
- `firestore.rules` - Security rules (842 lines)
- `vercel.json` - Deployment configuration

### External Resources
- [Firebase Documentation](https://firebase.google.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Documentation](https://vercel.com/docs)

---

## 🎯 Success Metrics

### Operational Health
- Uptime: 99.9% target
- Error Rate: <1% target
- P95 Response Time: <500ms target
- Backup Success Rate: 100%

### Customer Success
- Trial Conversion: Track monthly
- Churn Rate: Monitor weekly
- Support Response Time: <2 hours target
- Incident Resolution: <4 hours target

---

## END OF README

**Questions or issues?** Review the specific documentation for detailed procedures.

**Emergency?** Start with Security & Recovery document, section 6 (Incident Response).

**New to the platform?** Follow the Quick Start guide above.
