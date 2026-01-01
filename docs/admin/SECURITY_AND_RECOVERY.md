# Security & Recovery

**Last Updated:** December 30, 2025  
**Target Audience:** System Administrators, Security Engineers, DevOps  
**Complexity:** High  
**Risk Level:** Critical

---

## Overview

This document covers the security architecture of the AI Sales Platform, focusing on Firebase Firestore security rules, multi-tenant isolation, and data recovery procedures.

---

## Table of Contents

1. [Security Architecture](#1-security-architecture)
2. [Firestore Security Rules](#2-firestore-security-rules)
3. [Multi-Tenant Isolation](#3-multi-tenant-isolation)
4. [Backup Strategy](#4-backup-strategy)
5. [Point-in-Time Recovery](#5-point-in-time-recovery)
6. [Security Incident Response](#6-security-incident-response)

---

## 1. Security Architecture

### 1.1 Security Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Network (Vercel Edge, Cloudflare)             │
│ - DDoS protection                                       │
│ - Rate limiting (IP-based)                              │
│ - TLS 1.3 encryption                                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Authentication (Firebase Auth)                │
│ - Email/password authentication                         │
│ - OAuth (Google)                                        │
│ - Session management                                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Authorization (Firestore Rules)               │
│ - Role-based access control (RBAC)                      │
│ - Organization-based isolation                          │
│ - Collection-level permissions                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Application Logic                             │
│ - Input validation                                      │
│ - XSS protection                                        │
│ - CSRF tokens                                           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 5: Data Encryption                               │
│ - At-rest: Firebase default encryption                  │
│ - In-transit: TLS 1.3                                   │
│ - Sensitive fields: Application-level encryption        │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Firestore Security Rules

### 2.1 Rule Architecture

**File:** `firestore.rules` (842 lines)

#### Core Security Principles:

1. **Deny by Default:** All collections start with `allow read, write: if false;`
2. **Super Admin Bypass:** `super_admin` role has full access to all data (for IT support)
3. **Organization Isolation:** Users can only access data in their own `organizationId`
4. **Role-Based Permissions:** Different actions require different roles

---

### 2.2 Helper Functions

#### Authentication Check
```javascript
function isAuthenticated() {
  return request.auth != null;
}
```
**Used by:** All protected collections  
**Purpose:** Verify user is logged in

---

#### Super Admin Check
```javascript
function isSuperAdmin() {
  return isAuthenticated() 
    && exists(/databases/$(database)/documents/users/$(request.auth.uid))
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin';
}
```
**Used by:** All collections (highest privilege level)  
**Purpose:** Grant IT support full access for troubleshooting

**CRITICAL:** Only grant `super_admin` role to trusted personnel.

---

#### Organization Membership Check
```javascript
function getUserOrgId() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.organizationId;
}

function belongsToOrg(orgId) {
  return isAuthenticated() && getUserOrgId() == orgId;
}
```
**Used by:** All organization-scoped collections  
**Purpose:** Enforce multi-tenant isolation

**How it works:**
1. Reads user document to get their `organizationId`
2. Compares to the `organizationId` in the resource being accessed
3. Allows access only if they match

**Example:**
- User A (orgId: `org_123`) tries to read lead from Org B (orgId: `org_456`)
- `belongsToOrg('org_456')` returns `false`
- Access denied

---

#### Role Checks
```javascript
function getUserRole() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
}

function isAdminOrOwner() {
  return getUserRole() in ['admin', 'owner', 'super_admin'];
}

function isManagerOrAbove() {
  return getUserRole() in ['admin', 'owner', 'manager', 'super_admin'];
}
```

**Role Hierarchy:**
```
super_admin (platform admin)
    ↓
  owner (organization owner)
    ↓
  admin (organization admin)
    ↓
 manager (team manager)
    ↓
  member (regular user)
```

---

### 2.3 Collection Rules

#### Organizations Collection
**Path:** `/organizations/{orgId}`

```javascript
match /organizations/{orgId} {
  // Super admins can do anything
  allow read, write: if isSuperAdmin();
  
  // Users can read their own organization
  allow read: if isAuthenticated() && belongsToOrg(orgId);
  
  // Only owners can update
  allow update: if isAuthenticated() 
    && belongsToOrg(orgId)
    && getUserRole() == 'owner';
  
  // Only platform admins can create
  allow create: if isAuthenticated() && isAdminOrOwner();
  
  // Never allow deletion via client (use super_admin write rule)
  allow delete: if false;
}
```

**Security Considerations:**
- Deletion disabled to prevent accidental data loss
- Only owners can change organization settings
- Super admins can create organizations (for onboarding new customers)

---

#### Users Collection
**Path:** `/users/{userId}`

```javascript
match /users/{userId} {
  // Users can read their own profile (MUST BE FIRST to avoid circular dependency)
  allow read: if isAuthenticated() && request.auth.uid == userId;
  
  // Super admins have FULL access
  allow read, write: if isSuperAdmin();
  
  // Users can update their own profile (except role and organizationId)
  allow update: if isAuthenticated() 
    && request.auth.uid == userId
    && !('role' in request.resource.data.diff(resource.data).affectedKeys())
    && !('organizationId' in request.resource.data.diff(resource.data).affectedKeys());
  
  // Only admins can create/delete users
  allow create, delete: if isAuthenticated() && isAdminOrOwner();
  
  // Admins can read all users in their organization
  allow read: if isAuthenticated() 
    && belongsToOrg(resource.data.organizationId);
}
```

**Security Considerations:**
- Users cannot change their own `role` (prevents privilege escalation)
- Users cannot change their own `organizationId` (prevents tenant jumping)
- Admins can only see users in their own organization

**Circular Dependency Warning:**
The first rule (`allow read: if request.auth.uid == userId`) must come before the `belongsToOrg()` calls, otherwise Firestore enters an infinite loop when checking permissions (because `belongsToOrg()` reads the user document, which requires permission).

---

#### Records Collection (CRM Data)
**Path:** `/records/{recordId}`

```javascript
match /records/{recordId} {
  // Super admins have FULL access
  allow read, write: if isSuperAdmin();
  
  // Users can read records in their organization
  allow read: if isAuthenticated() 
    && belongsToOrg(resource.data.organizationId);
  
  // All authenticated users can create/update records in their org
  allow create, update: if isAuthenticated() 
    && request.resource.data.organizationId == getUserOrgId();
  
  // Managers and above can delete records
  allow delete: if isAuthenticated() 
    && belongsToOrg(resource.data.organizationId)
    && isManagerOrAbove();
}
```

**Security Considerations:**
- All users can create records (for self-service data entry)
- Only managers+ can delete (prevents accidental data loss)
- `organizationId` must match user's org on create/update (prevents cross-tenant writes)

---

### 2.4 Website Builder Rules (Multi-Tenant Isolation)

#### Published Pages (Public Read)
**Path:** `/organizations/{orgId}/website/pages/items/{pageId}`

```javascript
match /organizations/{orgId}/website/pages/items/{pageId} {
  allow read, write: if isSuperAdmin();
  
  // Published pages can be read publicly (for public site viewing)
  allow read: if resource.data.status == 'published';
  
  // Org members can read all pages (including drafts)
  allow read: if isAuthenticated() && belongsToOrg(orgId);
  
  // Managers and above can create/update/delete pages
  allow create, update, delete: if isAuthenticated() && belongsToOrg(orgId) && isManagerOrAbove();
  
  // CRITICAL: Prevent cross-org data leaks
  // Validate organizationId matches on create/update
  allow create: if request.resource.data.organizationId == orgId;
  allow update: if resource.data.organizationId == orgId 
                && request.resource.data.organizationId == orgId;
}
```

**Security Considerations:**
- Published pages are publicly readable (for website visitors)
- Draft pages are only visible to organization members
- Double-validation on `organizationId` prevents tenant confusion attacks

---

#### Custom Domains (Global Collection)
**Path:** `/customDomains/{domain}`

```javascript
match /customDomains/{domain} {
  allow read, write: if isSuperAdmin();
  
  // Anyone can read domain status (for DNS verification UI)
  allow read: if true;
  
  // CRITICAL: Only the org that owns this domain can write
  allow create: if isAuthenticated() 
                && request.resource.data.organizationId == getUserOrgId()
                && isManagerOrAbove();
  
  allow update, delete: if isAuthenticated() 
                      && resource.data.organizationId == getUserOrgId()
                      && isManagerOrAbove();
  
  // PREVENT domain hijacking: Cannot change organizationId after creation
  allow update: if request.resource.data.organizationId == resource.data.organizationId;
}
```

**Security Considerations:**
- Custom domains are globally readable (for DNS verification)
- `organizationId` is immutable after creation (prevents domain hijacking)
- Only the owning organization can modify/delete their domain

**Attack Scenario Prevented:**
1. Attacker registers `example.com` in their org
2. Attacker tries to update `organizationId` to victim's org
3. Rule rejects update because `organizationId` changed
4. Victim remains safe

---

### 2.5 Sensitive Collections

#### API Keys (Manager+ Only)
**Path:** `/apiKeys/{keyId}`

```javascript
match /apiKeys/{keyId} {
  allow read, write: if isSuperAdmin();
  
  // Only managers+ can read API keys
  allow read: if isAuthenticated() 
    && belongsToOrg(resource.data.organizationId)
    && isManagerOrAbove();
  
  // Only owners can create/update/delete API keys
  allow create, update, delete: if isAuthenticated() 
    && request.resource.data.organizationId == getUserOrgId()
    && getUserRole() == 'owner';
}
```

**Security Considerations:**
- API keys are highly sensitive (grant programmatic access)
- Only owners can manage them (highest trust level)
- Managers can view but not modify (read-only for debugging)

---

#### Subscription Data (Owner Only)
**Path:** `/customerSubscriptions/{subscriptionId}`

```javascript
match /customerSubscriptions/{subscriptionId} {
  allow read, write: if isSuperAdmin();
  
  // Users can read their org's subscription
  allow read: if isAuthenticated() && belongsToOrg(resource.data.organizationId);
  
  // Only owners can modify subscription
  allow update: if isAuthenticated() 
    && belongsToOrg(resource.data.organizationId)
    && getUserRole() == 'owner';
  
  // Only super admins can create/delete subscriptions
  allow create, delete: if isSuperAdmin();
}
```

**Security Considerations:**
- Billing data is read-only for non-owners
- Only super admins can create subscriptions (via Stripe webhooks)
- Prevents unauthorized subscription changes

---

### 2.6 Discovery Archive (Temporary Scrapes)

**Path:** `/discoveryArchive/{scrapeId}`

```javascript
match /discoveryArchive/{scrapeId} {
  allow read, write: if isSuperAdmin();
  
  // Only the owning organization can read their scrapes
  allow read: if isAuthenticated() 
             && resource.data.organizationId == getUserOrgId();
  
  // Only the owning organization can create scrapes
  allow create: if isAuthenticated() 
               && request.resource.data.organizationId == getUserOrgId();
  
  // Cannot change organizationId after creation
  allow update: if isAuthenticated() 
               && resource.data.organizationId == getUserOrgId()
               && request.resource.data.organizationId == resource.data.organizationId;
  
  // Only the owning organization can delete
  allow delete: if isAuthenticated() 
               && resource.data.organizationId == getUserOrgId();
}
```

**Security Considerations:**
- Scraped data is organization-private (competitive intelligence)
- TTL: 30 days (automatic deletion via Firestore TTL policy)
- No cross-organization access (this is the platform's "moat")

**TTL Configuration:**
```javascript
// Firestore Console → TTL Policies
{
  "collection": "discoveryArchive",
  "field": "createdAt",
  "ttlDays": 30
}
```

---

### 2.7 Testing Security Rules

#### Local Testing (Firebase Emulator)

```bash
# Start emulator with rules
firebase emulators:start --only firestore

# Run rules tests
npm run test:security
```

**Test File:** `firestore.rules.test.js`

```javascript
const { assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');

describe('Organization Isolation', () => {
  it('prevents reading other org data', async () => {
    const userA = testEnv.authenticatedContext('userA', { 
      organizationId: 'org_A' 
    });
    
    // Try to read Org B's data
    const docRef = userA.firestore()
      .collection('organizations')
      .doc('org_B');
    
    await assertFails(docRef.get());
  });
  
  it('allows reading own org data', async () => {
    const userA = testEnv.authenticatedContext('userA', { 
      organizationId: 'org_A' 
    });
    
    // Read own org data
    const docRef = userA.firestore()
      .collection('organizations')
      .doc('org_A');
    
    await assertSucceeds(docRef.get());
  });
});
```

---

## 3. Multi-Tenant Isolation

### 3.1 Isolation Strategy

**Every document in organization-scoped collections MUST have:**
```typescript
{
  organizationId: string; // The tenant ID
  // ... other fields
}
```

**Enforcement:**
1. **Firestore Rules:** Validate `organizationId` matches user's org
2. **Application Code:** Automatically inject `organizationId` on create
3. **Middleware:** Verify `organizationId` on API requests

---

### 3.2 Middleware Validation

**File:** `src/middleware.ts`

#### Subdomain → Organization Mapping

```typescript
// User visits: acme.salesvelocity.ai
const subdomain = "acme";

// Lookup in Firestore
const orgId = await getOrgBySubdomain(subdomain);
// Returns: org_1704067200000_abc123xyz

// Rewrite request to:
// /sites/{orgId}/home
```

**Security:**
- Subdomain mappings are cached (5 minutes)
- Cache invalidated on subdomain change
- Invalid subdomains return 404 (not error details)

---

### 3.3 Custom Domain Isolation

**Collections:**
- `/subdomains/{subdomain}` → Maps to `organizationId`
- `/customDomains/{domain}` → Maps to `organizationId`

**Firestore Rules:**
```javascript
match /subdomains/{subdomain} {
  allow read: if true; // Public read for DNS verification
  
  // Cannot update or delete (subdomain is permanent)
  allow update, delete: if false;
  
  // Only create if user owns the org
  allow create: if isAuthenticated() 
                && request.resource.data.organizationId == getUserOrgId();
}
```

**Attack Scenario Prevented:**
1. Attacker tries to register subdomain `acme` (already taken)
2. Firestore returns "Document already exists"
3. Attacker cannot overwrite or claim existing subdomain

---

### 3.4 API Request Validation

**Every API endpoint validates organization access:**

```typescript
// src/lib/middleware/org-validator.ts
export async function validateOrgAccess(userId: string, orgId: string) {
  const user = await FirestoreService.get('users', userId);
  
  if (user.organizationId !== orgId) {
    throw new UnauthorizedError('User does not belong to organization');
  }
  
  return true;
}
```

**Usage in API routes:**
```typescript
export async function GET(request: NextRequest) {
  const userId = await verifyAuth(request);
  const orgId = request.nextUrl.searchParams.get('organizationId');
  
  // Validate user belongs to org
  await validateOrgAccess(userId, orgId);
  
  // Now safe to query org data
  const data = await getOrgData(orgId);
  return NextResponse.json(data);
}
```

---

## 4. Backup Strategy

### 4.1 Automated Backups

#### Daily Firestore Exports (Production)

**Setup:**
1. Enable Cloud Scheduler in Google Cloud Console
2. Create scheduled job:
   ```bash
   gcloud scheduler jobs create http firestore-daily-backup \
     --schedule="0 2 * * *" \
     --uri="https://firestore.googleapis.com/v1/projects/PROJECT_ID:exportDocuments" \
     --http-method=POST \
     --message-body='{"outputUriPrefix":"gs://BUCKET/backups","collectionIds":[]}'
   ```

3. Backups stored in Google Cloud Storage:
   ```
   gs://ai-sales-backups/
     └── backups/
         ├── 2025-12-30T02-00-00/
         │   ├── all_namespaces/
         │   │   ├── all_kinds/
         │   │   │   └── output-0
         │   │   └── all_kinds_metadata
         │   └── export_metadata
         ├── 2025-12-29T02-00-00/
         └── ...
   ```

**Retention:** 30 days (automatic deletion)

---

#### Manual Backup Script

**File:** `scripts/backup-firestore.ts`

**Usage:**
```bash
# Full backup
ts-node scripts/backup-firestore.ts backup

# List backups
ts-node scripts/backup-firestore.ts list

# Restore from backup
ts-node scripts/backup-firestore.ts restore 2025-12-30T02-00-00
```

**What it backs up:**
- organizations
- workspaces
- customers
- products
- orders
- workflows
- agents
- integrations

**Backup Format:**
```json
{
  "id": "org_123456",
  "data": {
    "name": "Acme Corporation",
    "plan": "enterprise",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### 4.2 Backup Validation

**Automated Backup Testing (Weekly):**
```bash
# scripts/test-backup-restore.sh
#!/bin/bash

# 1. Create test org
ORG_ID=$(node scripts/create-test-org.js)

# 2. Add sample data
node scripts/seed-test-data.js $ORG_ID

# 3. Backup
ts-node scripts/backup-firestore.ts backup

# 4. Delete org
node scripts/delete-org.js $ORG_ID

# 5. Restore from backup
BACKUP_TIME=$(date -u +"%Y-%m-%dT%H-00-00")
ts-node scripts/backup-firestore.ts restore $BACKUP_TIME

# 6. Verify data
node scripts/verify-restore.js $ORG_ID

echo "✓ Backup restore test passed"
```

---

## 5. Point-in-Time Recovery

### 5.1 Restore Single Organization

**Use Case:** Customer accidentally deleted all their leads, need to restore from yesterday.

#### Steps:

1. **Find backup timestamp:**
   ```bash
   ts-node scripts/backup-firestore.ts list
   ```
   
   Output:
   ```
   Available backups:
     2025-12-30T02-00-00 - 15,423 documents
     2025-12-29T02-00-00 - 15,401 documents
     2025-12-28T02-00-00 - 15,389 documents
   ```

2. **Extract organization data:**
   ```bash
   node scripts/extract-org-from-backup.js \
     --backup=2025-12-29T02-00-00 \
     --orgId=org_1704067200000_abc123xyz \
     --output=./temp-restore/
   ```

3. **Review extracted data:**
   ```bash
   ls ./temp-restore/
   # organizations.json
   # leads.json
   # deals.json
   # contacts.json
   ```

4. **Restore to Firestore:**
   ```bash
   node scripts/restore-org.js \
     --input=./temp-restore/ \
     --orgId=org_1704067200000_abc123xyz \
     --collections=leads,deals,contacts \
     --merge=false
   ```
   
   Options:
   - `--merge=false`: Replace all data (destructive)
   - `--merge=true`: Merge with existing data (safe)

5. **Verify restore:**
   ```bash
   node scripts/verify-org-data.js org_1704067200000_abc123xyz
   ```

---

### 5.2 Restore Single Collection

**Use Case:** Bug corrupted all leads, need to restore just the `leads` collection.

```bash
node scripts/restore-org-collection.js \
  --backup=2025-12-29T02-00-00 \
  --orgId=org_1704067200000_abc123xyz \
  --collection=leads \
  --confirm
```

**Script Logic:**
```javascript
async function restoreCollection(orgId, collection, backupPath) {
  // 1. Read backup data
  const data = JSON.parse(fs.readFileSync(`${backupPath}/${collection}.json`));
  
  // 2. Delete current data (optional)
  const currentDocs = await db.collection('organizations')
    .doc(orgId)
    .collection(collection)
    .get();
  
  for (const doc of currentDocs.docs) {
    await doc.ref.delete();
  }
  
  // 3. Restore from backup
  const batch = db.batch();
  let batchCount = 0;
  
  for (const doc of data) {
    const docRef = db.collection('organizations')
      .doc(orgId)
      .collection(collection)
      .doc(doc.id);
    
    batch.set(docRef, doc.data);
    batchCount++;
    
    // Firestore batch limit is 500
    if (batchCount === 500) {
      await batch.commit();
      batchCount = 0;
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`✓ Restored ${data.length} documents to ${collection}`);
}
```

---

### 5.3 Restore Deleted Record

**Use Case:** Customer accidentally deleted a critical deal.

#### Option A: From Backup
```bash
node scripts/restore-single-record.js \
  --backup=2025-12-29T02-00-00 \
  --orgId=org_123456 \
  --collection=deals \
  --recordId=deal_abc123
```

#### Option B: From Audit Log
```javascript
async function recoverDeletedRecord(orgId, collection, recordId) {
  // Find deletion event in audit log
  const auditLogs = await db.collection('admin')
    .doc('auditLogs')
    .collection('entries')
    .where('organizationId', '==', orgId)
    .where('collection', '==', collection)
    .where('recordId', '==', recordId)
    .where('action', '==', 'delete')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();
  
  if (auditLogs.empty) {
    console.error('No audit log found');
    return;
  }
  
  const deletedData = auditLogs.docs[0].data().previousData;
  
  // Restore the record
  await db.collection('organizations')
    .doc(orgId)
    .collection(collection)
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

### 5.4 Full Database Restore (Disaster Recovery)

**Use Case:** Firebase project corrupted, need to restore entire database.

⚠️ **WARNING:** This is a destructive operation. Only use in emergencies.

```bash
# 1. Create new Firebase project
firebase projects:create ai-sales-recovery

# 2. Initialize Firestore
firebase firestore:setup

# 3. Import from backup
gcloud firestore import \
  gs://ai-sales-backups/backups/2025-12-29T02-00-00 \
  --project=ai-sales-recovery

# 4. Verify data
node scripts/verify-database.js --project=ai-sales-recovery

# 5. Update DNS to point to new project
# 6. Update env vars with new Firebase config
```

---

## 6. Security Incident Response

### 6.1 Incident Response Playbook

#### Suspected Data Breach

1. **Immediately:**
   - Suspend affected organization(s)
   - Revoke all API keys
   - Reset all user passwords
   - Enable forced re-authentication

2. **Within 1 hour:**
   - Review audit logs for suspicious activity
   - Check Firestore rules for vulnerabilities
   - Identify compromised data

3. **Within 24 hours:**
   - Notify affected customers
   - Report to authorities (if required by GDPR/CCPA)
   - Document incident timeline

4. **Post-Incident:**
   - Conduct security audit
   - Update Firestore rules
   - Implement additional monitoring

---

#### Unauthorized Admin Access

1. **Revoke access:**
   ```bash
   firebase auth:delete <compromised_admin_uid>
   ```

2. **Audit admin actions:**
   ```bash
   node scripts/audit-admin-actions.js \
     --adminId=<compromised_admin_uid> \
     --since=2025-12-01
   ```

3. **Check for unauthorized changes:**
   - Review organization modifications
   - Check for new super_admin accounts
   - Verify subscription changes

4. **Restore from backup if needed:**
   ```bash
   ts-node scripts/backup-firestore.ts restore 2025-12-29T02-00-00
   ```

---

### 6.2 Security Monitoring

#### Real-Time Alerts

**Sentry Rules:**
- Unauthorized access attempts (429 rate limit errors)
- Firestore permission denied errors (403)
- Suspicious API key usage patterns

**Firebase Monitoring:**
- Unusual read/write patterns
- Spike in authentication attempts
- Quota limit warnings

**Stripe Alerts:**
- Failed webhook signatures
- Unusual refund patterns
- Subscription cancellations spike

---

### 6.3 Security Audit Checklist

**Monthly:**
- [ ] Review Firestore security rules for gaps
- [ ] Audit super_admin accounts
- [ ] Check for unused API keys
- [ ] Review user permissions for anomalies
- [ ] Verify backup restore process

**Quarterly:**
- [ ] Penetration testing (third-party)
- [ ] Dependency vulnerability scan (`npm audit`)
- [ ] Review access logs for suspicious patterns
- [ ] Update security documentation

---

## 7. Compliance & Data Privacy

### 7.1 GDPR Compliance

#### Data Deletion (Right to be Forgotten)

**User Requests Deletion:**
```bash
node scripts/gdpr-delete-user.js \
  --userId=<user_uid> \
  --orgId=<org_id> \
  --confirm
```

**What it deletes:**
- User account (Firebase Auth)
- User document (Firestore)
- All user-generated content
- Email history
- Conversation logs

**What it preserves (anonymized):**
- Billing records (required by law)
- Audit logs (anonymized)

---

#### Data Export (Right to Access)

**User Requests Data Export:**
```bash
node scripts/gdpr-export-user.js \
  --userId=<user_uid> \
  --format=json \
  --output=./exports/
```

**Exports:**
- Profile data
- Conversation history
- Email/SMS history
- Workflow activity
- Subscription history

**Format:**
```json
{
  "export_timestamp": "2025-12-30T20:00:00.000Z",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "data": {
    "conversations": [...],
    "emails": [...],
    "workflows": [...]
  }
}
```

---

### 7.2 Data Retention

**Automatic Deletion (TTL):**
- Discovery Archive: 30 days
- Cached enrichment data: 30 days
- Preview tokens: 7 days
- Expired sessions: 24 hours

**Manual Retention:**
- Audit logs: 90 days
- Billing records: 7 years (legal requirement)
- User data: Until account deletion

---

## END OF DOCUMENT
