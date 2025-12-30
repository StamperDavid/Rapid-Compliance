# 🔄 REFACTOR PATTERNS
**Quick Reference Guide for Updating Code**

Use this guide to quickly refactor existing code to use the new Data Access Layer (DAL).

---

## 📚 **TABLE OF CONTENTS**

1. [Import Statements](#import-statements)
2. [Collection References](#collection-references)
3. [Write Operations](#write-operations)
4. [Read Operations](#read-operations)
5. [Sub-Collections](#sub-collections)
6. [API Route Patterns](#api-route-patterns)

---

## 1️⃣ **IMPORT STATEMENTS**

### ❌ **OLD:**
```typescript
import { db } from '@/lib/firebase/config';
import { collection, doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
```

### ✅ **NEW:**
```typescript
import { dal } from '@/lib/firebase/dal';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { serverTimestamp } from 'firebase/firestore'; // Still need this for timestamps
```

---

## 2️⃣ **COLLECTION REFERENCES**

### ❌ **OLD:**
```typescript
const orgsRef = db.collection('organizations');
const usersRef = db.collection('users');
const leadsRef = collection(db, 'leads');
```

### ✅ **NEW:**
```typescript
const orgsRef = dal.getCollection('ORGANIZATIONS');
const usersRef = dal.getCollection('USERS');
const leadsRef = dal.getCollection('LEADS');
```

**Benefits:**
- ✅ Automatic environment-aware naming (`dev_organizations` in dev, `test_organizations` in tests)
- ✅ Type-safe (autocomplete in IDE)
- ✅ Single source of truth (change in one place)

---

## 3️⃣ **WRITE OPERATIONS**

### 📝 **setDoc() - Create or Replace**

#### ❌ **OLD:**
```typescript
await setDoc(doc(db, 'organizations', orgId), {
  name: 'Acme Inc',
  createdAt: serverTimestamp(),
});
```

#### ✅ **NEW:**
```typescript
await dal.safeSetDoc('ORGANIZATIONS', orgId, {
  name: 'Acme Inc',
  createdAt: serverTimestamp(),
}, {
  audit: true,
  userId: userId, // For audit trail
});
```

#### ✅ **NEW (with merge):**
```typescript
await dal.safeSetDoc('ORGANIZATIONS', orgId, {
  name: 'Acme Inc',
}, {
  merge: true, // Only update specified fields
  audit: true,
  userId: userId,
});
```

---

### 📝 **updateDoc() - Update Existing**

#### ❌ **OLD:**
```typescript
await updateDoc(doc(db, 'organizations', orgId), {
  name: 'Updated Name',
  updatedAt: serverTimestamp(),
});
```

#### ✅ **NEW:**
```typescript
await dal.safeUpdateDoc('ORGANIZATIONS', orgId, {
  name: 'Updated Name',
  updatedAt: serverTimestamp(),
}, {
  audit: true,
  userId: userId,
});
```

---

### 🗑️ **deleteDoc() - Delete**

#### ❌ **OLD:**
```typescript
await deleteDoc(doc(db, 'organizations', orgId));
```

#### ✅ **NEW:**
```typescript
await dal.safeDeleteDoc('ORGANIZATIONS', orgId, {
  audit: true,
  userId: userId,
});
```

**Note:** In production, this will throw an error unless `ALLOW_PROD_DELETES=true` is set.

---

### ➕ **addDoc() - Auto-Generated ID**

#### ❌ **OLD:**
```typescript
const docRef = await addDoc(collection(db, 'leads'), {
  email: 'john@example.com',
  createdAt: serverTimestamp(),
});
console.log('Created lead:', docRef.id);
```

#### ✅ **NEW:**
```typescript
const docRef = await dal.safeAddDoc('LEADS', {
  email: 'john@example.com',
  createdAt: serverTimestamp(),
}, {
  audit: true,
  userId: userId,
});
console.log('Created lead:', docRef.id);
```

---

## 4️⃣ **READ OPERATIONS**

### 📖 **getDoc() - Read Single Document**

#### ❌ **OLD:**
```typescript
const orgDoc = await getDoc(doc(db, 'organizations', orgId));
if (orgDoc.exists()) {
  const data = orgDoc.data();
}
```

#### ✅ **NEW:**
```typescript
const orgDoc = await dal.safeGetDoc('ORGANIZATIONS', orgId);
if (orgDoc.exists()) {
  const data = orgDoc.data();
}
```

---

### 📚 **getDocs() - Query Multiple Documents**

#### ❌ **OLD:**
```typescript
import { query, where, getDocs } from 'firebase/firestore';

const q = query(
  collection(db, 'organizations'),
  where('status', '==', 'active')
);
const snapshot = await getDocs(q);

snapshot.forEach(doc => {
  console.log(doc.id, doc.data());
});
```

#### ✅ **NEW:**
```typescript
import { where } from 'firebase/firestore';

const snapshot = await dal.safeGetDocs('ORGANIZATIONS',
  where('status', '==', 'active')
);

snapshot.forEach(doc => {
  console.log(doc.id, doc.data());
});
```

#### ✅ **NEW (multiple conditions):**
```typescript
import { where, orderBy, limit } from 'firebase/firestore';

const snapshot = await dal.safeGetDocs('ORGANIZATIONS',
  where('status', '==', 'active'),
  where('tier', '==', 'tier1'),
  orderBy('createdAt', 'desc'),
  limit(10)
);
```

---

## 5️⃣ **SUB-COLLECTIONS**

### 🗂️ **Organization Sub-Collections**

#### ❌ **OLD:**
```typescript
const recordsRef = collection(db, 'organizations', orgId, 'records');
const schemasRef = collection(db, 'organizations', orgId, 'schemas');
```

#### ✅ **NEW:**
```typescript
const recordsRef = dal.getOrgCollection(orgId, 'records');
const schemasRef = dal.getOrgCollection(orgId, 'schemas');
```

**Benefits:**
- ✅ Automatically prefixes sub-collection names in test/dev mode
- ✅ Example: `organizations/org123/records` → `dev_organizations/org123/dev_records`

---

### 🗂️ **Deep Sub-Collections**

#### ❌ **OLD:**
```typescript
const fieldsRef = collection(
  db,
  'organizations',
  orgId,
  'schemas',
  schemaId,
  'fields'
);
```

#### ✅ **NEW:**
```typescript
import { getSchemaSubCollection } from '@/lib/firebase/collections';
import { collection } from 'firebase/firestore';

const fieldsPath = getSchemaSubCollection(orgId, schemaId, 'fields');
const fieldsRef = collection(db, fieldsPath);
```

**Or use the helper directly:**
```typescript
import { collection } from 'firebase/firestore';

const fieldsRef = collection(
  dal.getCollection('ORGANIZATIONS'),
  orgId,
  'schemas',
  schemaId,
  'fields'
);
```

---

## 6️⃣ **API ROUTE PATTERNS**

### 🛣️ **Typical API Route Before/After**

#### ❌ **OLD:** `src/app/api/organizations/[orgId]/route.ts`

```typescript
import { db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const { orgId } = params;
  
  // ❌ Direct database access
  const orgDoc = await getDoc(doc(db, 'organizations', orgId));
  
  if (!orgDoc.exists()) {
    return new Response('Not found', { status: 404 });
  }
  
  return Response.json(orgDoc.data());
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const { orgId } = params;
  const body = await request.json();
  
  // ❌ No audit trail
  await updateDoc(doc(db, 'organizations', orgId), {
    ...body,
    updatedAt: serverTimestamp(),
  });
  
  return Response.json({ success: true });
}
```

#### ✅ **NEW:**

```typescript
import { dal } from '@/lib/firebase/dal';
import { serverTimestamp } from 'firebase/firestore';
import { verifyOrgAccess } from '@/lib/middleware/org-guard'; // Phase 4

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const { orgId } = params;
  
  // ✅ TODO: Verify user has access (Phase 4)
  // const userId = await getUserIdFromAuth(request);
  // const hasAccess = await verifyOrgAccess(userId, orgId);
  // if (!hasAccess) {
  //   return new Response('Unauthorized', { status: 403 });
  // }
  
  // ✅ Use DAL for reads
  const orgDoc = await dal.safeGetDoc('ORGANIZATIONS', orgId);
  
  if (!orgDoc.exists()) {
    return new Response('Not found', { status: 404 });
  }
  
  return Response.json(orgDoc.data());
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const { orgId } = params;
  const body = await request.json();
  
  // ✅ TODO: Verify user has access (Phase 4)
  // const userId = await getUserIdFromAuth(request);
  
  // ✅ Use DAL with audit trail
  await dal.safeUpdateDoc('ORGANIZATIONS', orgId, {
    ...body,
    updatedAt: serverTimestamp(),
  }, {
    audit: true,
    // userId: userId, // Uncomment when auth is ready
  });
  
  return Response.json({ success: true });
}
```

---

## 🧪 **DRY RUN MODE**

### When to Use Dry Run

Use dry run mode when you want to **test** a refactor without actually writing to the database.

#### Example:

```typescript
// Test a complex operation without side effects
await dal.safeSetDoc('ORGANIZATIONS', 'test-org-123', {
  name: 'Test Org',
  createdAt: serverTimestamp(),
}, {
  dryRun: true, // ✅ Logs the operation but doesn't execute it
  audit: true,
});
```

**Output:**
```
[DRY RUN] Would write to Firestore {
  collection: 'dev_organizations',
  docId: 'test-org-123',
  data: { name: 'Test Org', ... }
}
```

---

## 🔥 **BATCH OPERATIONS**

For batch writes (creating multiple documents at once), you'll need to use the underlying Firestore API. Here's the pattern:

#### ❌ **OLD:**
```typescript
import { writeBatch } from 'firebase/firestore';

const batch = writeBatch(db);

batch.set(doc(db, 'organizations', 'org1'), { name: 'Org 1' });
batch.set(doc(db, 'organizations', 'org2'), { name: 'Org 2' });
batch.update(doc(db, 'users', 'user1'), { status: 'active' });

await batch.commit();
```

#### ✅ **NEW:**
```typescript
import { writeBatch, doc } from 'firebase/firestore';
import { dal } from '@/lib/firebase/dal';

const batch = writeBatch(db);

// Use DAL collections with batch
batch.set(
  doc(dal.getCollection('ORGANIZATIONS'), 'org1'),
  { name: 'Org 1' }
);

batch.set(
  doc(dal.getCollection('ORGANIZATIONS'), 'org2'),
  { name: 'Org 2' }
);

batch.update(
  doc(dal.getCollection('USERS'), 'user1'),
  { status: 'active' }
);

await batch.commit();

// TODO: Manually log audit trail for batch operations
logger.info('Batch operation completed', { 
  operations: 3,
  collections: ['ORGANIZATIONS', 'USERS']
});
```

**Note:** Full batch support in the DAL is coming in a future enhancement.

---

## 🚀 **QUICK WIN: Refactor a Single File**

Let's refactor one file as an example. Pick a simple one first:

### **Before:** `src/lib/crm/lead-service.ts` (Example)

```typescript
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function createLead(email: string, organizationId: string) {
  const leadRef = await addDoc(collection(db, 'leads'), {
    email,
    organizationId,
    status: 'new',
    createdAt: serverTimestamp(),
  });
  
  return leadRef.id;
}
```

### **After:**

```typescript
import { dal } from '@/lib/firebase/dal';
import { serverTimestamp } from 'firebase/firestore';

export async function createLead(
  email: string, 
  organizationId: string,
  userId?: string
) {
  const leadRef = await dal.safeAddDoc('LEADS', {
    email,
    organizationId,
    status: 'new',
    createdAt: serverTimestamp(),
  }, {
    audit: true,
    userId: userId,
  });
  
  return leadRef.id;
}
```

**Changes:**
1. ✅ Import `dal` instead of `db`
2. ✅ Use `dal.safeAddDoc('LEADS', ...)` instead of `addDoc(collection(db, 'leads'), ...)`
3. ✅ Add audit logging
4. ✅ Add optional `userId` parameter for audit trail

---

## 📋 **CHECKLIST FOR EACH FILE**

When refactoring a file:

- [ ] Update imports (add `dal`, `COLLECTIONS`)
- [ ] Replace hardcoded collection strings with constants
- [ ] Replace `setDoc` → `dal.safeSetDoc`
- [ ] Replace `updateDoc` → `dal.safeUpdateDoc`
- [ ] Replace `deleteDoc` → `dal.safeDeleteDoc`
- [ ] Replace `addDoc` → `dal.safeAddDoc`
- [ ] Replace `getDoc` → `dal.safeGetDoc`
- [ ] Replace `getDocs` → `dal.safeGetDocs`
- [ ] Add `audit: true` for sensitive operations
- [ ] Add `userId` parameter where applicable
- [ ] Test the refactored code

---

## 🎯 **PRIORITY ORDER FOR REFACTORING**

Refactor these files first (highest impact):

1. ✅ **`src/app/(public)/signup/page.tsx`** - Signup flow (CRITICAL)
2. ✅ **`src/lib/services/lead-scoring-engine.ts`** - Direct org writes
3. ✅ **`src/lib/services/sequencer.ts`** - Direct sequence writes
4. ✅ **`src/lib/agent/base-model-builder.ts`** - Agent data writes
5. ✅ **`src/app/api/admin/organizations/route.ts`** - Admin org management

Then work through the rest systematically.

---

## 🆘 **COMMON ERRORS & FIXES**

### Error: "Cannot find module '@/lib/firebase/dal'"
**Fix:** Restart your dev server: `npm run dev`

### Error: "dal.getCollection is not a function"
**Fix:** Make sure you're importing the singleton instance: `import { dal } from '@/lib/firebase/dal'`

### Error: "COLLECTIONS.ORGANIZATIONS is not defined"
**Fix:** Import the constants: `import { COLLECTIONS } from '@/lib/firebase/collections'`

### Error: "Production deletes require ALLOW_PROD_DELETES=true"
**Fix:** This is working as intended! Only set `ALLOW_PROD_DELETES=true` in production when you **really** need to delete data.

---

**You're ready to start refactoring! 🚀**

Start with the signup flow, then work through the high-priority files. Each file you refactor makes your system more robust and production-ready.
