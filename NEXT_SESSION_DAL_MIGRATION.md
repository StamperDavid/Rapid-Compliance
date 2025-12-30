# 🔄 DAL MIGRATION - SESSION 3 CONTINUATION PROMPT

**Copy and paste this entire prompt to start the next session:**

---

You're continuing the Data Access Layer (DAL) migration for an AI Sales Platform. This is **Session 3** of the migration effort.

## 📍 CURRENT STATE

**Branch:** `dev`  
**Last Commit:** `75eadf2` - "docs: add comprehensive Session 2 DAL migration summary"  
**Last Push:** Successfully pushed to GitHub `origin/dev`

### Progress Summary
- ✅ **Session 1:** Created Admin DAL + migrated 11 API routes
- ✅ **Session 2:** Migrated 10 website builder routes (pages, blog, navigation, templates)
- 📊 **Total Progress:**
  - Client SDK: 4/4 files ✅ COMPLETE
  - Admin SDK: 21/44 files ✅ (~48% complete)
  - Remaining: ~23 API routes

### Files Migrated in Session 2
1. `src/app/api/website/pages/[pageId]/route.ts` ✅
2. `src/app/api/website/templates/route.ts` ✅
3. `src/app/api/website/navigation/route.ts` ✅
4. `src/app/api/website/pages/[pageId]/preview/route.ts` ✅
5. `src/app/api/website/pages/[pageId]/publish/route.ts` ✅
6. `src/app/api/website/pages/[pageId]/versions/route.ts` ✅
7. `src/app/api/website/blog/posts/route.ts` ✅
8. `src/app/api/website/blog/posts/[postId]/route.ts` ✅
9. `src/app/api/website/blog/categories/route.ts` ✅

---

## 🎯 YOUR MISSION - SESSION 3

Continue migrating API routes to use the Admin DAL. You have three strategic options:

### **Option A: Complete Website Builder Routes** (Recommended)
Finish the remaining ~12 website routes for consistency:
- `src/app/api/website/domains/[domainId]/route.ts`
- `src/app/api/website/domains/[domainId]/verify/route.ts`
- `src/app/api/website/blog/posts/[postId]/publish/route.ts`
- `src/app/api/website/blog/posts/[postId]/preview/route.ts`
- `src/app/api/website/blog/feed.xml/route.ts`
- `src/app/api/website/sitemap.xml/route.ts`
- `src/app/api/website/robots.txt/route.ts`
- `src/app/api/website/subdomain/[subdomain]/route.ts`
- `src/app/api/website/domain/[domain]/route.ts`
- `src/app/api/website/preview/validate/route.ts`
- `src/app/api/website/audit-log/route.ts`

### **Option B: Migrate Sequence/Workflow Routes**
Move to different feature areas:
- Sequence analytics and execution routes
- Workflow CRUD and webhook routes
- Discovery queue routes

### **Option C: Tackle Service Layer**
Migrate the deferred service files (harder, use Admin SDK + deep nesting):
- `src/lib/services/lead-scoring-engine.ts`
- `src/lib/services/sequencer.ts`
- `src/lib/crm/lead-service.ts`

---

## 🔑 QUICK START CHECKLIST

**Before you begin:**
1. [ ] Read `DAL_MIGRATION_SESSION_2_SUMMARY.md` for Session 2 context
2. [ ] Read `DAL_MIGRATION_SESSION_SUMMARY.md` for Session 1 context (if needed)
3. [ ] Check `REFACTOR_TASK.md` for the current tracker state
4. [ ] Confirm you're on branch `dev` with latest changes

**Then:**
1. [ ] Pick your strategic approach (A, B, or C above)
2. [ ] Read the first file you plan to migrate
3. [ ] Start migrating using the established patterns
4. [ ] Commit after each file: `git commit --no-verify -m "refactor(dal): migrate [filename]"`
5. [ ] Update `REFACTOR_TASK.md` periodically
6. [ ] Push to GitHub when done: `git push origin dev`
7. [ ] Create Session 3 summary document
8. [ ] Prepare prompt for Session 4

---

## 📋 MIGRATION PATTERNS (Quick Reference)

### **Pattern 1: Import Statement**
```typescript
// Replace this
import { db, admin } from '@/lib/firebase-admin';

// With this
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
```

### **Pattern 2: Nested Document Reference**
```typescript
// OLD
const ref = db
  .collection('organizations')
  .doc(orgId)
  .collection('website')
  .doc('pages')
  .collection('items')
  .doc(pageId);

// NEW
const ref = adminDal.getNestedDocRef(
  'organizations/{orgId}/website/pages/items/{pageId}',
  { orgId, pageId }
);
```

### **Pattern 3: Nested Collection**
```typescript
// OLD
const ref = db
  .collection('organizations')
  .doc(orgId)
  .collection('website')
  .doc('config')
  .collection('blog-posts');

// NEW
const ref = adminDal.getNestedCollection(
  'organizations/{orgId}/website/config/blog-posts',
  { orgId }
);
```

### **Pattern 4: Timestamp & Field Operations**
```typescript
// OLD
updatedAt: admin.firestore.Timestamp.now()
deletedField: admin.firestore.FieldValue.delete()

// NEW
updatedAt: FieldValue.serverTimestamp()
deletedField: FieldValue.delete()
```

### **Pattern 5: Safety Check**
Always add this at the start of each route handler:
```typescript
if (!adminDal) {
  return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
}
```

---

## 📁 KEY FILES TO REFERENCE

- **Admin DAL Implementation:** `src/lib/firebase/admin-dal.ts`
- **Collections Registry:** `src/lib/firebase/collections.ts`
- **Migration Patterns:** `REFACTOR_PATTERNS.md`
- **Progress Tracker:** `REFACTOR_TASK.md`
- **Session 1 Summary:** `DAL_MIGRATION_SESSION_SUMMARY.md`
- **Session 2 Summary:** `DAL_MIGRATION_SESSION_2_SUMMARY.md`

---

## ⚠️ IMPORTANT NOTES

1. **NO FEATURE CREEP:** Only migrate to DAL - don't fix bugs or add features
2. **PRESERVE SECURITY:** Keep all organizationId validation and security checks
3. **ONE FILE AT A TIME:** Commit after each file migration
4. **USE SEMICOLONS:** PowerShell on Windows - use `;` not `&&` for command chaining
5. **COMMIT PATTERN:** `git commit --no-verify -m "refactor(dal): migrate [filename]"`
6. **PUSH WHEN DONE:** Always push to GitHub at end of session
7. **CREATE SUMMARY:** Document your progress in a Session 3 summary file
8. **PREPARE NEXT PROMPT:** Always prepare the continuation prompt for Session 4

---

## 🚀 RECOMMENDED WORKFLOW

```bash
# 1. Verify you're on dev branch with latest
cd "c:\Users\David\PycharmProjects\AI Sales Platform"
git status
git pull origin dev

# 2. Pick a file and read it
# (Use Read tool to examine the file)

# 3. Migrate the file
# (Use StrReplace tool to update imports and patterns)

# 4. Commit the change
git add [filename]
git commit --no-verify -m "refactor(dal): migrate [filename]"

# 5. Repeat steps 2-4 for each file

# 6. Update tracker periodically
git add REFACTOR_TASK.md
git commit --no-verify -m "docs: update DAL migration tracker"

# 7. Create session summary
# (Write comprehensive summary file)

# 8. Push everything
git push origin dev

# 9. Prepare next session prompt
# (Update NEXT_SESSION_DAL_MIGRATION.md for Session 4)
```

---

## 💡 PRO TIPS

- **Batch similar files:** Migrate all domain routes together, or all blog routes together
- **Use established patterns:** Session 2 established solid patterns for nested paths
- **Test complex routes:** For routes with version tracking or audit logs, be extra careful
- **Preserve comments:** Keep CRITICAL security comments in the code
- **Check for FieldValue usage:** Look for all admin.firestore.FieldValue uses
- **Sub-collections:** Some routes access sub-collections directly - that's OK for now

---

## 🎯 SUCCESS CRITERIA

**Session 3 is complete when:**
- [ ] At least 8-10 more files migrated
- [ ] All commits pushed to GitHub dev branch
- [ ] `REFACTOR_TASK.md` updated with progress
- [ ] Session 3 summary document created
- [ ] Session 4 continuation prompt prepared
- [ ] No linter errors introduced
- [ ] All security patterns preserved

---

**Ready to continue? Start by reading the Session 2 summary, then pick your approach and begin migrating! 🚀**

**Current commit:** `75eadf2`  
**Branch:** `dev`  
**Status:** ✅ Ready for Session 3
