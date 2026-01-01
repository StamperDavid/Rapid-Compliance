# DAL Refactor Plan - Complete Environment Isolation

## 📊 Analysis Complete

### Files Requiring Refactoring

**Category 1: Admin SDK Files (Server-side)**
These files use `adminDb.collection()` and need to use `adminDal.getCollection()` or helpers:

1. ✅ `src/lib/firebase-admin.ts` - 3 hardcoded references
2. ✅ `src/lib/api-keys/api-key-service.ts` - 2 hardcoded references
3. ✅ `src/lib/agent/instance-manager.ts` - 3 hardcoded references  
4. ✅ `src/lib/api/admin-auth.ts` - 1 hardcoded reference
5. ✅ `src/lib/services/smart-sequencer.ts` - 3 hardcoded references
6. ✅ `src/lib/schema/server/schema-change-publisher-server.ts` - 1 hardcoded reference
7. ✅ `src/lib/schema/server/field-type-converter-server.ts` - 1 hardcoded reference
8. ✅ `src/app/api/admin/test-api-connection/route.ts` - 1 hardcoded reference
9. ✅ `src/app/api/test/admin-status/route.ts` - 1 hardcoded reference
10. ✅ `src/app/api/integrations/google/callback/route.ts` - 1 hardcoded reference
11. ✅ `src/app/api/schema/[schemaId]/field/[fieldId]/convert-type/route.ts` - 1 hardcoded reference

**Category 2: React Components (Client-side)**
These use client SDK and need BaseAgentDAL or FirestoreService:

12. ✅ `src/app/admin/support/api-health/page.tsx` - 1 hardcoded reference

**Category 3: Mixed/Other Services**
Need to check what SDK they use:

13. ✅ `src/lib/scraper-intelligence/training-manager.ts`
14. ✅ `src/lib/scraper-intelligence/temporary-scrapes-service.ts`
15. ✅ `src/lib/scraper-intelligence/version-control.ts`
16. ✅ `src/lib/scraper-intelligence/scraper-intelligence-service.ts`
17. ✅ `src/lib/scraper-intelligence/discovery-archive-service.ts`
18. ✅ `src/lib/services/discovery-dispatcher.ts`
19. ✅ `src/lib/templates/template-service.ts`
20. ✅ `src/lib/db/admin-firestore-service.ts`
21. ✅ `src/app/api/chat/public/route.ts`
22. ✅ `src/app/api/website/blog/feed.xml/route.ts`
23. ✅ `src/app/api/website/robots.txt/route.ts`
24. ✅ `src/app/api/website/sitemap.xml/route.ts`
25. ✅ `src/app/api/schemas/route.ts`
26. ✅ `src/app/api/website/pages/[pageId]/versions/route.ts`

**Already Refactored:**
- ✅ `src/lib/scheduled-publisher.ts` (refactored in Session 1)
- ✅ `src/lib/firebase/admin-dal.ts` (DAL infrastructure)
- ✅ `src/lib/firebase/collections.ts` (Collection registry)

## 🎯 Refactoring Strategy

### Batch 1: Core Service Files (5 files)
- firebase-admin.ts
- api-key-service.ts
- agent/instance-manager.ts
- admin-auth.ts
- smart-sequencer.ts

### Batch 2: Schema Server Files (2 files)
- schema-change-publisher-server.ts
- field-type-converter-server.ts

### Batch 3: API Routes (6 files)
- admin/test-api-connection/route.ts
- test/admin-status/route.ts
- integrations/google/callback/route.ts
- schema/[schemaId]/field/[fieldId]/convert-type/route.ts
- chat/public/route.ts
- schemas/route.ts

### Batch 4: Website API Routes (4 files)
- website/blog/feed.xml/route.ts
- website/robots.txt/route.ts
- website/sitemap.xml/route.ts
- website/pages/[pageId]/versions/route.ts

### Batch 5: Scraper Intelligence Services (5 files)
- scraper-intelligence/training-manager.ts
- scraper-intelligence/temporary-scrapes-service.ts
- scraper-intelligence/version-control.ts
- scraper-intelligence/scraper-intelligence-service.ts
- scraper-intelligence/discovery-archive-service.ts

### Batch 6: Remaining Services (3 files)
- services/discovery-dispatcher.ts
- templates/template-service.ts
- db/admin-firestore-service.ts
- admin/support/api-health/page.tsx

## 🔧 Refactoring Pattern

**For Admin SDK (server-side):**
```typescript
// BEFORE:
import { adminDb } from '@/lib/firebase/admin';
const doc = await adminDb.collection('organizations').doc(orgId).get();

// AFTER:
import { adminDal } from '@/lib/firebase/admin-dal';
const doc = await adminDal.getCollection('ORGANIZATIONS').doc(orgId).get();

// OR for sub-collections:
import { getOrgSubCollection } from '@/lib/firebase/collections';
const path = getOrgSubCollection(orgId, 'goldenMasters');
const doc = await adminDb.collection(path).doc(id).get();
```

## 📈 Progress Tracker

- [x] Analysis Complete
- [ ] Batch 1: Core Service Files (0/5)
- [ ] Batch 2: Schema Server Files (0/2)
- [ ] Batch 3: API Routes (0/6)
- [ ] Batch 4: Website API Routes (0/4)
- [ ] Batch 5: Scraper Intelligence (0/5)
- [ ] Batch 6: Remaining Services (0/4)
- [ ] TypeScript Compilation Check
- [ ] Git Commit
- [ ] Update project_status.md

**Total Files**: 26 files to refactor
**Estimated Completion**: ~2-3 hours
