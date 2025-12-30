# 🔄 DAL MIGRATION TRACKER

**Mission:** Migrate all direct Firestore SDK calls to the Data Access Layer (DAL)

**Reference Files:**
- `src/lib/firebase/dal.ts` - The DAL API
- `src/lib/firebase/collections.ts` - Collection Registry
- `REFACTOR_PATTERNS.md` - Transformation Patterns

---

## 📊 PROGRESS OVERVIEW

- **Phase 1 (Auth & Signup):** 2/2 ✅ COMPLETE
- **Phase 2 (Core Services):** 0/5 ✗
- **Phase 3 (API Routes):** 0/12 ✗
- **Phase 4 (Integrations):** 0/8 ✗
- **Phase 5 (Advanced Features):** 0/10 ✗

**Total:** 2/37 files migrated (5.4%)

---

## ✅ PHASE 1: Auth & Signup (COMPLETE)
**Critical path - user registration and authentication**

- [x] `src/app/(public)/signup/page.tsx` ✅ (commit 3ef3e81)
  - Migrated organization creation to `dal.safeSetDoc('ORGANIZATIONS', ...)`
  - Migrated user creation to `dal.safeSetDoc('USERS', ...)`
  - Added audit logging with userId from Firebase Auth
  - Removed unused imports (setDoc, doc, db)
  
- [x] `src/lib/auth/auth-service.ts` ✅ (commit 986f17e)
  - Replaced FirestoreService.set → dal.safeSetDoc
  - Replaced FirestoreService.get → dal.safeGetDoc
  - Replaced FirestoreService.update → dal.safeUpdateDoc
  - Fixed COLLECTIONS import to use new location
  - Switched from ISO strings to serverTimestamp()
  - Added audit logging with userId

---

## 🔧 PHASE 2: Core Services (CURRENT)
**High-priority business logic**

- [ ] `src/lib/services/lead-scoring-engine.ts` ⏸️ ADMIN SDK (needs Admin DAL)
- [ ] `src/lib/services/sequencer.ts` ⏸️ ADMIN SDK (needs Admin DAL)
- [ ] `src/lib/agent/base-model-builder.ts` ⚡ NEXT (Client SDK)
- [ ] `src/lib/crm/lead-service.ts` (Client SDK)
- [ ] `src/lib/outbound/meeting-scheduler.ts` (Mixed SDK)

---

## 🌐 PHASE 3: API Routes
**Backend endpoints**

### Admin Routes
- [ ] `src/app/api/admin/organizations/route.ts`
- [ ] `src/app/api/admin/organizations/[orgId]/route.ts`

### Organization Routes
- [ ] `src/app/api/organizations/[orgId]/route.ts`
- [ ] `src/app/api/organizations/[orgId]/users/route.ts`

### Schema Routes
- [ ] `src/app/api/schemas/route.ts`
- [ ] `src/app/api/schemas/[schemaId]/route.ts`
- [ ] `src/app/api/schemas/[schemaId]/update/route.ts`

### Sequence Routes
- [ ] `src/app/api/sequences/route.ts`
- [ ] `src/app/api/sequences/[sequenceId]/route.ts`

### Lead Routes
- [ ] `src/app/api/leads/route.ts`
- [ ] `src/app/api/leads/[leadId]/route.ts`

### Other Routes
- [ ] `src/app/api/billing/subscribe/route.ts`

---

## 🔌 PHASE 4: Integrations
**Third-party service integrations**

- [ ] `src/app/api/integrations/quickbooks/auth/route.ts`
- [ ] `src/app/api/integrations/slack/auth/route.ts`
- [ ] `src/app/api/integrations/microsoft/auth/route.ts`
- [ ] `src/app/api/integrations/google/auth/route.ts`
- [ ] `src/app/api/integrations/teams/auth/route.ts`
- [ ] `src/lib/integrations/stripe-service.ts`
- [ ] `src/lib/integrations/sendgrid-service.ts`
- [ ] `src/components/integrations/StripeIntegration.tsx`

---

## 🚀 PHASE 5: Advanced Features
**Analytics, workflows, and advanced functionality**

- [ ] `src/lib/analytics/analytics-service.ts`
- [ ] `src/lib/workflows/workflow-engine.ts`
- [ ] `src/lib/ai/conversation-service.ts`
- [ ] `src/lib/ai/training-service.ts`
- [ ] `src/lib/website-builder/page-service.ts`
- [ ] `src/lib/ecommerce/order-service.ts`
- [ ] `src/lib/ecommerce/cart-service.ts`
- [ ] `src/lib/ecommerce/product-service.ts`
- [ ] `src/components/analytics/AnalyticsDashboard.tsx`
- [ ] `src/components/workflows/WorkflowBuilder.tsx`

---

## 📝 REFACTORING CHECKLIST (Per File)

When refactoring each file:

1. **Import Updates**
   - [ ] Add `import { dal } from '@/lib/firebase/dal'`
   - [ ] Add `import { COLLECTIONS } from '@/lib/firebase/collections'`
   - [ ] Keep `serverTimestamp` from firebase/firestore if needed
   - [ ] Remove unused Firestore imports (setDoc, updateDoc, addDoc, doc, collection)

2. **Code Transformation**
   - [ ] Replace `collection(db, 'string')` → `dal.getCollection('COLLECTION_KEY')`
   - [ ] Replace `setDoc(...)` → `dal.safeSetDoc('COLLECTION_KEY', id, data, options)`
   - [ ] Replace `updateDoc(...)` → `dal.safeUpdateDoc('COLLECTION_KEY', id, data, options)`
   - [ ] Replace `deleteDoc(...)` → `dal.safeDeleteDoc('COLLECTION_KEY', id, options)`
   - [ ] Replace `addDoc(...)` → `dal.safeAddDoc('COLLECTION_KEY', data, options)`
   - [ ] Replace `getDoc(...)` → `dal.safeGetDoc('COLLECTION_KEY', id)`
   - [ ] Replace `getDocs(...)` → `dal.safeGetDocs('COLLECTION_KEY', ...constraints)`

3. **Metadata & Context**
   - [ ] Extract `userId` from local context (auth, session, request)
   - [ ] Add `audit: true` for write operations
   - [ ] Add `userId` to options object
   - [ ] Add `organizationId` where applicable

4. **Validation**
   - [ ] Code compiles without errors
   - [ ] No unused imports remain
   - [ ] All environment guards are respected
   - [ ] Linter passes

5. **Git Workflow**
   - [ ] `git add .`
   - [ ] `git commit -m "refactor(dal): migrated [File Name]"`
   - [ ] `git push origin dev`
   - [ ] Update this tracker (check the box)

---

## 🎓 TRANSFORMATION EXAMPLES

### Before:
```typescript
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

await setDoc(doc(db, 'organizations', orgId), {
  name: 'Acme Inc',
  createdAt: serverTimestamp(),
});
```

### After:
```typescript
import { dal } from '@/lib/firebase/dal';
import { serverTimestamp } from 'firebase/firestore';

await dal.safeSetDoc('ORGANIZATIONS', orgId, {
  name: 'Acme Inc',
  createdAt: serverTimestamp(),
}, {
  audit: true,
  userId: userId, // From context
});
```

---

## 🚨 IMPORTANT NOTES

1. **NO FEATURE CREEP:** Only migrate to DAL. Do not fix unrelated bugs or refactor UI.
2. **USER ID:** Always try to extract userId from the current context (auth, session, API request).
3. **COLLECTION REGISTRY:** If a collection isn't in `collections.ts`, add it FIRST before migrating.
4. **ONE FILE AT A TIME:** Complete, commit, and push each file before moving to the next.
5. **TEST MODE:** The DAL automatically prefixes collections with `test_` or `dev_` based on NODE_ENV.

---

## 📈 COMPLETION CRITERIA

**Phase 1 Complete when:**
- [x] All auth & signup files migrated
- [x] Users can sign up with proper audit trails
- [x] No direct Firestore SDK calls in auth code
- [x] All commits pushed to `dev` branch

**Project Complete when:**
- [x] All 37 files migrated
- [x] No direct `setDoc`, `updateDoc`, `deleteDoc`, `addDoc` calls outside DAL
- [x] All collections use registry from `collections.ts`
- [x] Comprehensive audit logging in place
- [x] All commits pushed to `dev` branch

---

**Last Updated:** Dec 30, 2025
**Current Phase:** Phase 2 - Core Services
**Next File:** `src/lib/services/lead-scoring-engine.ts`
**Last Commit:** 986f17e
**Phase 1:** ✅ COMPLETE (2/2 files)
