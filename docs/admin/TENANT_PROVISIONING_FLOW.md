# Tenant Provisioning Flow

**Last Updated:** December 30, 2025  
**Target Audience:** System Administrators, DevOps Engineers  
**Complexity:** High

---

## Overview

This document provides a step-by-step technical breakdown of what happens in the database and authentication system when a new organization (tenant) is created in the AI Sales Platform.

---

## 1. Organization Creation Entry Points

### 1.1 Admin UI Creation
**Location:** `/src/app/api/admin/organizations/route.ts` (POST)  
**Required Role:** `super_admin`  
**Authentication:** Admin SDK bypass of Firestore rules

#### Request Flow:
```
Admin Dashboard → POST /api/admin/organizations → verifyAdminRequest() → adminDal.safeSetDoc()
```

#### Request Body:
```json
{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "plan": "starter",
  "status": "active",
  "industry": "Technology",
  "billingEmail": "billing@acme.com",
  "settings": {}
}
```

### 1.2 Script-Based Creation
**Location:** `/scripts/seed-test-organizations.ts`, `/scripts/create-platform-admin-org.js`

---

## 2. Database Operations Sequence

### Step 1: Generate Organization ID
```typescript
const orgId = `org_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
```

**Format:** `org_1704067200000_abc123xyz`  
**Purpose:** Globally unique, sortable by creation time

---

### Step 2: Create Organization Document
**Collection:** `organizations`  
**Document ID:** Generated `orgId`

```typescript
{
  name: "Acme Corporation",
  slug: "acme-corp",
  plan: "starter",                    // Plan tiers: starter, growth, scale, enterprise
  status: "active",                   // Status: active, suspended, deleted
  industry: "Technology",
  billingEmail: "billing@acme.com",
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
  createdBy: "<super_admin_uid>",
  settings: {
    isSystemOrg: false,
    features: {
      aiAgents: true,
      workflows: true,
      websiteBuilder: true,
      ecommerce: true
    }
  }
}
```

**Firestore Path:** `/organizations/{orgId}`

---

### Step 3: Initialize Organization Subcollections

#### 3.1 Default Workspace
**Collection:** `organizations/{orgId}/workspaces`  
**Document ID:** `default`

```typescript
{
  name: "Default Workspace",
  status: "active",
  createdAt: FieldValue.serverTimestamp(),
  createdBy: "<owner_uid>",
  organizationId: orgId
}
```

#### 3.2 Subscription Record
**Collection:** `organizations/{orgId}/subscriptions`  
**Document ID:** `current`

```typescript
{
  status: "trialing",
  trialStartDate: new Date().toISOString(),
  trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
  tier: "starter",
  recordCount: 0,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null
}
```

#### 3.3 Website Configuration
**Collection:** `organizations/{orgId}/website`  
**Document ID:** `settings`

```typescript
{
  organizationId: orgId,
  subdomain: null,              // Will be set via website builder
  customDomain: null,
  status: "not_configured",
  createdAt: FieldValue.serverTimestamp()
}
```

#### 3.4 AI Agent Configuration
**Collection:** `organizations/{orgId}/agentPersona`  
**Document ID:** Auto-generated

```typescript
{
  organizationId: orgId,
  name: "Default Sales Agent",
  personality: "professional",
  industry: "Technology",
  enabled: false,
  createdAt: FieldValue.serverTimestamp()
}
```

---

## 3. User Association

### Step 1: Create Owner User (if new signup)
**Collection:** `users`  
**Document ID:** Firebase Auth UID

```typescript
{
  email: "owner@acme.com",
  name: "John Doe",
  role: "owner",                    // Roles: owner, admin, manager, member
  organizationId: orgId,
  currentWorkspaceId: "default",
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
  emailVerified: true
}
```

**CRITICAL:** The `organizationId` field is the tenant isolation key. All Firestore security rules use this field to enforce multi-tenancy.

### Step 2: Add to Organization Members
**Collection:** `organizations/{orgId}/members`  
**Document ID:** User's UID

```typescript
{
  userId: "<user_uid>",
  email: "owner@acme.com",
  role: "owner",
  addedAt: FieldValue.serverTimestamp(),
  addedBy: "<super_admin_uid>"
}
```

---

## 4. Firebase Authentication Setup

### User Creation
**Method:** Firebase Admin SDK `auth.createUser()`

```typescript
await admin.auth().createUser({
  email: "owner@acme.com",
  password: "<secure_password>",
  displayName: "John Doe",
  emailVerified: true
});
```

**Output:** Returns Firebase UID (e.g., `abc123xyz456`)

### Custom Claims (Optional)
Not currently implemented, but recommended for role-based access:

```typescript
await admin.auth().setCustomUserClaims(uid, {
  role: 'owner',
  organizationId: orgId
});
```

---

## 5. Stripe Integration (Billing)

### Step 1: Create Stripe Customer
**Triggered:** On first billing setup or trial end

```typescript
const customer = await stripe.customers.create({
  email: "owner@acme.com",
  name: "Acme Corporation",
  metadata: {
    organizationId: orgId,
    plan: "starter"
  }
});
```

### Step 2: Create Trial Subscription
```typescript
const subscription = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: VOLUME_TIER_PRICE_IDS['starter'] }],
  trial_period_days: 14,
  metadata: {
    organizationId: orgId,
    tierId: 'starter'
  }
});
```

### Step 3: Update Organization with Stripe IDs
```typescript
await adminDal.safeUpdateDoc('ORGANIZATIONS', orgId, {
  stripeCustomerId: customer.id,
  stripeSubscriptionId: subscription.id,
  'subscriptions/current': {
    stripeSubscriptionId: subscription.id,
    status: 'trialing'
  }
});
```

---

## 6. Post-Provisioning Operations

### 6.1 Send Welcome Email
**Service:** SendGrid  
**Template:** Welcome email with login link, setup instructions

### 6.2 Audit Log Entry
**Collection:** `admin/auditLogs`  
```typescript
{
  action: "organization_created",
  performedBy: "<super_admin_uid>",
  organizationId: orgId,
  timestamp: new Date().toISOString(),
  metadata: {
    name: "Acme Corporation",
    plan: "starter"
  }
}
```

### 6.3 Initialize Analytics
**Collection:** `organizations/{orgId}/sequenceAnalytics`  
Empty collection, will be populated as sequences are created and executed.

---

## 7. Tenant Isolation Verification

### Database Rules
**File:** `firestore.rules`

All organization data is protected by:
```javascript
function belongsToOrg(orgId) {
  return isAuthenticated() && getUserOrgId() == orgId;
}
```

### Multi-Tenant Website Routing
**File:** `src/middleware.ts`

Subdomains and custom domains are mapped to `organizationId`:
- **Subdomain:** `acme.salesvelocity.ai` → Looks up in `/subdomains/acme` → Gets `organizationId`
- **Custom Domain:** `www.acme.com` → Looks up in `/customDomains/www.acme.com` → Gets `organizationId`

---

## 8. Rollback Procedure

If organization creation fails mid-process:

### Manual Cleanup Steps
1. **Delete Organization Document:**
   ```bash
   node scripts/delete-org.js <orgId>
   ```

2. **Delete Firebase Auth User:**
   ```bash
   firebase auth:delete <uid>
   ```

3. **Cancel Stripe Subscription:**
   ```bash
   stripe subscriptions cancel <sub_id>
   ```

4. **Remove Audit Logs:**
   ```bash
   node scripts/cleanup-audit-logs.js <orgId>
   ```

---

## 9. Production Checklist

Before creating a production organization, verify:

- [ ] Firebase Admin SDK initialized with production service account
- [ ] Stripe webhook endpoint configured (`/api/webhooks/stripe`)
- [ ] SendGrid API key configured and verified
- [ ] DNS records configured for custom domain (if applicable)
- [ ] Rate limits configured (`RATE_LIMIT_*` env vars)
- [ ] Backup system active (automated Firestore exports)

---

## 10. Common Issues

### Issue: "Organization created but user can't login"
**Cause:** User document missing `organizationId` field  
**Fix:**
```bash
node scripts/fix-user-roles.js <userId> <orgId>
```

### Issue: "Stripe webhook not received"
**Cause:** Webhook secret mismatch  
**Fix:**
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
Then update `STRIPE_WEBHOOK_SECRET` in `.env`

### Issue: "Subdomain not resolving"
**Cause:** Missing entry in `/subdomains` collection  
**Fix:**
```typescript
await db.collection('subdomains').doc('acme').set({
  organizationId: '<orgId>',
  createdAt: FieldValue.serverTimestamp()
});
```

---

## 11. Monitoring

### Key Metrics
- Organization creation latency (target: < 3s)
- Failed organization creations (alert if > 5% failure rate)
- Trial conversion rate (14-day trial → paid)

### Logging
All organization creation events are logged with:
```typescript
logger.info('Organization created', {
  orgId,
  name,
  createdBy,
  plan,
  timestamp: new Date().toISOString()
});
```

---

## 12. API Reference

### Create Organization
```http
POST /api/admin/organizations
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "plan": "starter",
  "status": "active",
  "industry": "Technology",
  "billingEmail": "billing@acme.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "org_1704067200000_abc123xyz",
    "name": "Acme Corporation",
    "plan": "starter",
    "status": "active",
    "createdAt": "2025-12-30T20:00:00.000Z"
  }
}
```

---

## END OF DOCUMENT
