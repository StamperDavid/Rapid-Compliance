# Manual Intervention Guide

**Last Updated:** December 30, 2025  
**Target Audience:** System Administrators, Support Engineers  
**Complexity:** High  
**Risk Level:** High (Direct database manipulation)

---

## Overview

This guide documents manual operations for emergency support scenarios where automated systems cannot resolve issues. All operations require `super_admin` role and should be performed with extreme caution.

---

## Table of Contents

1. [Subscription Management](#1-subscription-management)
2. [AI Token Management](#2-ai-token-management)
3. [User Impersonation](#3-user-impersonation-support-mode)
4. [Organization Maintenance](#4-organization-maintenance)
5. [Data Recovery](#5-data-recovery)
6. [Emergency Procedures](#6-emergency-procedures)

---

## 1. Subscription Management

### 1.1 Override Subscription Status

**Use Case:** Customer payment failed but they've resolved it externally; need to manually reactivate account.

#### Via Firebase Console (Manual)

1. Navigate to Firestore:
   ```
   organizations/{orgId}/subscriptions/current
   ```

2. Update fields:
   ```json
   {
     "status": "active",
     "lastPaymentFailed": false,
     "lastPaymentFailedAt": null,
     "updatedAt": <current_timestamp>
   }
   ```

3. Verify in Stripe dashboard that payment actually succeeded

#### Via Script (Recommended)

**File:** `scripts/fix-subscription-status.js` (create if doesn't exist)

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixSubscriptionStatus(orgId, newStatus) {
  try {
    await db.collection('organizations')
      .doc(orgId)
      .collection('subscriptions')
      .doc('current')
      .update({
        status: newStatus,
        lastPaymentFailed: false,
        lastPaymentFailedAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        manualOverride: true,
        overrideBy: 'support-team',
        overrideReason: 'Manual payment verification'
      });
    
    console.log(`✓ Subscription status updated to ${newStatus} for org: ${orgId}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage: node fix-subscription-status.js org_123456 active
const orgId = process.argv[2];
const newStatus = process.argv[3] || 'active';

fixSubscriptionStatus(orgId, newStatus)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

**Run:**
```bash
node scripts/fix-subscription-status.js org_1704067200000_abc123xyz active
```

---

### 1.2 Change Subscription Tier

**Use Case:** Customer negotiated custom pricing or needs emergency upgrade/downgrade.

#### Via API (Recommended)

**Endpoint:** `POST /api/admin/subscriptions/update-tier`  
**Authentication:** Super admin bearer token

```bash
curl -X POST https://app.salesvelocity.ai/api/admin/subscriptions/update-tier \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org_1704067200000_abc123xyz",
    "newTier": "enterprise",
    "reason": "Custom contract negotiated",
    "skipStripe": false
  }'
```

#### Via Firestore (Emergency)

1. Update organization subscription:
   ```
   organizations/{orgId}/subscriptions/current
   ```
   
   Update:
   ```json
   {
     "tier": "enterprise",
     "customPricing": true,
     "monthlyPrice": 299,
     "updatedAt": <current_timestamp>
   }
   ```

2. If Stripe subscription exists, update in Stripe:
   ```bash
   stripe subscriptions update sub_1234567890 \
     --items[0][price]=price_enterprise_tier
   ```

---

### 1.3 Extend Trial Period

**Use Case:** Prospect needs more time to evaluate, extend trial by 7-14 days.

#### Script

```javascript
async function extendTrial(orgId, additionalDays) {
  const subscriptionRef = db.collection('organizations')
    .doc(orgId)
    .collection('subscriptions')
    .doc('current');
  
  const subscription = await subscriptionRef.get();
  const data = subscription.data();
  
  if (data.status !== 'trialing') {
    console.error('Organization is not on trial');
    return;
  }
  
  const currentTrialEnd = new Date(data.trialEndDate);
  const newTrialEnd = new Date(currentTrialEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000);
  
  await subscriptionRef.update({
    trialEndDate: newTrialEnd.toISOString(),
    trialExtended: true,
    trialExtensionDays: additionalDays,
    extendedAt: admin.firestore.FieldValue.serverTimestamp(),
    extendedBy: 'support-team'
  });
  
  // Also update Stripe if subscription exists
  if (data.stripeSubscriptionId) {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    await stripe.subscriptions.update(data.stripeSubscriptionId, {
      trial_end: Math.floor(newTrialEnd.getTime() / 1000)
    });
  }
  
  console.log(`✓ Trial extended by ${additionalDays} days until ${newTrialEnd.toISOString()}`);
}

// Usage: node extend-trial.js org_123456 7
const orgId = process.argv[2];
const days = parseInt(process.argv[3]) || 7;

extendTrial(orgId, days);
```

---

### 1.4 Cancel Subscription (Emergency)

**Use Case:** Customer requests immediate cancellation or fraudulent account detected.

#### Steps:

1. **Mark subscription as canceled in Firestore:**
   ```javascript
   await db.collection('organizations')
     .doc(orgId)
     .collection('subscriptions')
     .doc('current')
     .update({
       status: 'canceled',
       canceledAt: admin.firestore.FieldValue.serverTimestamp(),
       canceledBy: 'support-team',
       cancelReason: 'Customer request'
     });
   ```

2. **Cancel in Stripe:**
   ```bash
   stripe subscriptions cancel sub_1234567890 --prorate
   ```

3. **Suspend organization access:**
   ```javascript
   await db.collection('organizations')
     .doc(orgId)
     .update({
       status: 'suspended',
       suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
       suspensionReason: 'Subscription canceled'
     });
   ```

4. **Send confirmation email:**
   ```bash
   node scripts/send-cancellation-email.js org_123456
   ```

---

## 2. AI Token Management

### 2.1 Reset Organization AI Token Usage

**Use Case:** Organization hit token limit due to bug, need to reset counter.

#### Via Firestore

**Collection:** `organizations/{orgId}`  
**Field:** `aiUsage.tokensUsed`

```javascript
async function resetAITokens(orgId) {
  await db.collection('organizations')
    .doc(orgId)
    .update({
      'aiUsage.tokensUsed': 0,
      'aiUsage.lastReset': admin.firestore.FieldValue.serverTimestamp(),
      'aiUsage.resetBy': 'support-team',
      'aiUsage.resetReason': 'Manual reset - bug in token counting'
    });
  
  console.log(`✓ AI tokens reset for org: ${orgId}`);
}

// Usage: node reset-ai-tokens.js org_123456
const orgId = process.argv[2];
resetAITokens(orgId);
```

---

### 2.2 Grant Bonus AI Credits

**Use Case:** Compensate customer for service disruption, grant 10,000 free tokens.

#### Script

```javascript
async function grantBonusCredits(orgId, bonusTokens, reason) {
  const orgRef = db.collection('organizations').doc(orgId);
  const org = await orgRef.get();
  const data = org.data();
  
  const currentBonus = data.aiUsage?.bonusTokens || 0;
  const newBonus = currentBonus + bonusTokens;
  
  await orgRef.update({
    'aiUsage.bonusTokens': newBonus,
    'aiUsage.bonusGrantedAt': admin.firestore.FieldValue.serverTimestamp(),
    'aiUsage.bonusReason': reason
  });
  
  // Log transaction
  await db.collection('organizations')
    .doc(orgId)
    .collection('aiCreditHistory')
    .add({
      type: 'bonus_grant',
      amount: bonusTokens,
      reason: reason,
      grantedBy: 'support-team',
      grantedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  
  console.log(`✓ Granted ${bonusTokens} bonus tokens to org: ${orgId}`);
  console.log(`  Total bonus tokens: ${newBonus}`);
}

// Usage: node grant-bonus-credits.js org_123456 10000 "Compensation for downtime"
const orgId = process.argv[2];
const tokens = parseInt(process.argv[3]);
const reason = process.argv[4] || 'Support team bonus';

grantBonusCredits(orgId, tokens, reason);
```

---

### 2.3 View AI Token Usage

**Use Case:** Investigate why customer's bill is higher than expected.

#### Query Script

```javascript
async function getAIUsage(orgId) {
  const org = await db.collection('organizations').doc(orgId).get();
  const usage = org.data()?.aiUsage || {};
  
  console.log('\nAI Token Usage Report');
  console.log('='.repeat(50));
  console.log(`Organization: ${orgId}`);
  console.log(`Tokens Used: ${usage.tokensUsed || 0}`);
  console.log(`Bonus Tokens: ${usage.bonusTokens || 0}`);
  console.log(`Effective Usage: ${(usage.tokensUsed || 0) - (usage.bonusTokens || 0)}`);
  console.log(`Last Reset: ${usage.lastReset?.toDate?.() || 'Never'}`);
  
  // Get conversation history
  const conversations = await db.collection('chatSessions')
    .where('organizationId', '==', orgId)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  
  console.log('\nRecent Conversations:');
  conversations.forEach(doc => {
    const data = doc.data();
    console.log(`  ${doc.id}: ${data.tokensUsed || 0} tokens`);
  });
}

// Usage: node get-ai-usage.js org_123456
const orgId = process.argv[2];
getAIUsage(orgId);
```

---

## 3. User Impersonation (Support Mode)

### 3.1 Start Impersonation Session

**Use Case:** Customer reports UI issue, need to see their exact view to debug.

#### Via Admin UI (Recommended)

1. Login to admin panel: `https://app.salesvelocity.ai/admin/login`
2. Navigate to **Support → Impersonate User**
3. Enter user email or ID
4. Enter reason for impersonation (required for audit trail)
5. Click "Start Impersonation Session"

**Audit Trail:**
All impersonation sessions are logged in:
```
admin/impersonationSessions/{sessionId}
```

```json
{
  "adminId": "admin_uid_123",
  "adminEmail": "admin@salesvelocity.ai",
  "targetUserId": "user_uid_456",
  "targetUserEmail": "customer@acme.com",
  "reason": "Debugging workflow issue",
  "startedAt": "2025-12-30T20:00:00.000Z",
  "endedAt": null,
  "status": "active"
}
```

#### Via Script (Emergency)

```javascript
async function impersonateUser(adminEmail, targetUserEmail, reason) {
  // Get target user
  const usersSnapshot = await db.collection('users')
    .where('email', '==', targetUserEmail)
    .limit(1)
    .get();
  
  if (usersSnapshot.empty) {
    console.error('User not found');
    return;
  }
  
  const targetUser = usersSnapshot.docs[0];
  const targetUserData = targetUser.data();
  
  // Create impersonation session
  const sessionId = `impersonation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.collection('admin').doc('impersonationSessions').collection('sessions').doc(sessionId).set({
    adminEmail,
    targetUserId: targetUser.id,
    targetUserEmail,
    targetOrgId: targetUserData.organizationId,
    reason,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'active'
  });
  
  console.log(`✓ Impersonation session created: ${sessionId}`);
  console.log(`  Target: ${targetUserEmail}`);
  console.log(`  Organization: ${targetUserData.organizationId}`);
  console.log(`  Login URL: https://app.salesvelocity.ai/workspace/${targetUserData.organizationId}/dashboard?impersonate=${sessionId}`);
}

// Usage: node impersonate-user.js admin@example.com customer@acme.com "Debugging workflow"
const adminEmail = process.argv[2];
const targetEmail = process.argv[3];
const reason = process.argv[4] || 'Support access';

impersonateUser(adminEmail, targetEmail, reason);
```

---

### 3.2 End Impersonation Session

```javascript
async function endImpersonation(sessionId) {
  await db.collection('admin')
    .doc('impersonationSessions')
    .collection('sessions')
    .doc(sessionId)
    .update({
      status: 'ended',
      endedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  
  console.log(`✓ Impersonation session ended: ${sessionId}`);
}
```

---

### 3.3 Audit Impersonation History

**Query all impersonation sessions for an admin:**

```bash
node scripts/audit-impersonation.js admin@example.com
```

**Query all impersonation sessions for a customer:**

```bash
node scripts/audit-impersonation.js customer@acme.com --target
```

---

## 4. Organization Maintenance

### 4.1 Transfer Organization Ownership

**Use Case:** Original owner left company, need to assign new owner.

#### Steps:

1. **Update user roles:**
   ```javascript
   // Demote old owner to admin
   await db.collection('users').doc(oldOwnerId).update({
     role: 'admin',
     updatedAt: admin.firestore.FieldValue.serverTimestamp()
   });
   
   // Promote new owner
   await db.collection('users').doc(newOwnerId).update({
     role: 'owner',
     updatedAt: admin.firestore.FieldValue.serverTimestamp()
   });
   ```

2. **Update organization:**
   ```javascript
   await db.collection('organizations').doc(orgId).update({
     ownerId: newOwnerId,
     ownershipTransferredAt: admin.firestore.FieldValue.serverTimestamp(),
     transferReason: 'Employee departure'
   });
   ```

3. **Send notification emails** to both old and new owner

---

### 4.2 Merge Duplicate Organizations

**Use Case:** Customer accidentally created two accounts, need to merge data.

⚠️ **CAUTION:** This is a high-risk operation. Backup data first.

#### Script

```javascript
async function mergeOrganizations(sourceOrgId, targetOrgId) {
  console.log('⚠️ MERGING ORGANIZATIONS - BACKUP DATA FIRST ⚠️');
  
  // 1. Move all users
  const users = await db.collection('users')
    .where('organizationId', '==', sourceOrgId)
    .get();
  
  console.log(`Moving ${users.size} users...`);
  const batch = db.batch();
  users.forEach(doc => {
    batch.update(doc.ref, { organizationId: targetOrgId });
  });
  await batch.commit();
  
  // 2. Move all subcollections (leads, deals, etc.)
  const subcollections = ['leads', 'deals', 'contacts', 'workflows'];
  
  for (const subCol of subcollections) {
    const docs = await db.collection('organizations')
      .doc(sourceOrgId)
      .collection(subCol)
      .get();
    
    console.log(`Moving ${docs.size} ${subCol}...`);
    
    for (const doc of docs.docs) {
      await db.collection('organizations')
        .doc(targetOrgId)
        .collection(subCol)
        .doc(doc.id)
        .set(doc.data());
    }
  }
  
  // 3. Mark source org as merged
  await db.collection('organizations').doc(sourceOrgId).update({
    status: 'merged',
    mergedInto: targetOrgId,
    mergedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  console.log(`✓ Organizations merged: ${sourceOrgId} → ${targetOrgId}`);
}

// Usage: node merge-organizations.js org_source org_target
```

---

### 4.3 Delete Test Organization

**Use Case:** Clean up test/demo accounts.

⚠️ **WARNING:** Deletion is permanent. Backup first.

```bash
node scripts/cleanup-test-orgs.js org_test_123456 --confirm
```

Or via API:
```bash
curl -X DELETE https://app.salesvelocity.ai/api/admin/organizations/org_test_123456 \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "X-Confirm-Delete: yes"
```

---

## 5. Data Recovery

### 5.1 Restore Deleted Records

**Use Case:** Customer accidentally deleted important leads, need to recover.

#### From Firestore Backup

```bash
# List available backups
node scripts/backup-firestore.js list

# Restore specific collection for one organization
node scripts/restore-org-data.js \
  --backup=2025-12-30T10-00-00 \
  --orgId=org_123456 \
  --collection=leads
```

#### From Audit Trail

If backups are unavailable, check audit logs:

```javascript
async function recoverFromAuditLog(orgId, recordId) {
  const auditLogs = await db.collection('admin')
    .doc('auditLogs')
    .collection('entries')
    .where('organizationId', '==', orgId)
    .where('recordId', '==', recordId)
    .where('action', '==', 'delete')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();
  
  if (auditLogs.empty) {
    console.error('No audit log found for deleted record');
    return;
  }
  
  const deletedData = auditLogs.docs[0].data().previousData;
  
  // Restore the record
  await db.collection('organizations')
    .doc(orgId)
    .collection('leads')
    .doc(recordId)
    .set({
      ...deletedData,
      restoredAt: admin.firestore.FieldValue.serverTimestamp(),
      restoredBy: 'support-team'
    });
  
  console.log(`✓ Record restored: ${recordId}`);
}
```

---

### 5.2 Recover Corrupt Data

**Use Case:** Bug corrupted organization data, need to restore from backup.

```bash
node scripts/backup-firestore.js restore \
  --timestamp=2025-12-30T10-00-00 \
  --orgId=org_123456 \
  --force
```

---

## 6. Emergency Procedures

### 6.1 Emergency Account Suspension

**Use Case:** Fraud detected, need to immediately suspend account.

```bash
node scripts/emergency-suspend.js org_123456 "Fraudulent activity detected"
```

**What it does:**
- Sets `organizations/{orgId}.status = "suspended"`
- Revokes all API keys
- Disables all integrations
- Sends notification to owner
- Creates incident log

---

### 6.2 Emergency Password Reset

**Use Case:** Owner locked out, cannot receive password reset email.

#### Via Firebase Console:

1. Go to Firebase Console → Authentication
2. Find user by email
3. Click "⋮" → "Reset Password"
4. Send password reset email (or copy reset link)

#### Via Script:

```bash
firebase auth:reset-password user@acme.com
```

---

### 6.3 Emergency Super Admin Access

**Use Case:** All admins locked out, need to create new super admin.

```bash
node scripts/create-super-admin.js emergency-admin@your-domain.com
```

Enter strong password when prompted.

---

## Best Practices

1. **Always backup before manual operations**
   ```bash
   node scripts/backup-firestore.js backup
   ```

2. **Document all manual interventions** in admin audit log

3. **Verify operations in staging first** (if available)

4. **Notify affected customers** after manual changes

5. **Double-check organization IDs** before operations (typos are permanent)

6. **Use read-only mode** when investigating (avoid accidental writes)

7. **Keep a runbook** of recent interventions for team knowledge sharing

---

## Support Escalation

If manual intervention doesn't resolve the issue:

1. **Check system health:** `https://status.salesvelocity.ai`
2. **Review error logs:** Sentry dashboard
3. **Verify third-party services:** Stripe, SendGrid, Firebase status pages
4. **Escalate to engineering:** Slack #engineering-escalation channel

---

## END OF DOCUMENT
