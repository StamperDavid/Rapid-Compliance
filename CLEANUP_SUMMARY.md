# Test Organization Cleanup - Summary

## Problem Solved

Your admin CRM was polluted with dozens of duplicate test organizations created by automated tests. The UI couldn't scroll properly, and there was no way to distinguish test data from real customers.

## What Was Fixed

### 1. ✅ Cleanup Script Created

**File:** `scripts/cleanup-test-orgs.js`

**Run it now:**

```bash
npm run cleanup:test-orgs
```

This will:
- Find all test organizations (by name patterns, `isTest` flag, or suspicious dates)
- Show you what will be deleted
- Wait 5 seconds for confirmation
- Delete all test organizations

**For automated cleanup (skips confirmation):**

```bash
npm run cleanup:test-orgs:auto
```

### 2. ✅ Organizations Page - Pagination Added

**Changes to `/admin/organizations`:**

- **Pagination:** Now loads 20 orgs per page (instead of all at once)
- **Scrollable:** Table has `max-height: 70vh` with scroll
- **Next/Previous buttons:** Navigate between pages
- **Test org filter:** Checkbox to show/hide test organizations
- **Visual indicators:** Test orgs have yellow background + "TEST" badge
- **Default behavior:** Test orgs are hidden unless you check "Show Test Orgs"

### 3. ✅ Tests Fixed

**Files updated:**
- `tests/pagination-validation.test.ts`
- `tests/integration/payment-integration.test.ts`

**Changes:**
- All created orgs now have `isTest: true` flag
- Names prefixed with `[TEST]` for easy identification
- Proper cleanup in `afterAll` hooks
- Tests delete their own data when finished

### 4. ✅ Type Safety Added

**File:** `src/types/organization.ts`

Added `isTest?: boolean` field to Organization interface

### 5. ✅ API Updated

**File:** `src/app/api/admin/organizations/route.ts`

- Now returns `isTest` field in organization data
- Already had pagination support, now properly used by frontend

## How to Use

### Step 1: Clean Up Existing Pollution

Run the cleanup script:

```bash
npm run cleanup:test-orgs
```

You'll see output like:

```
🧹 Starting Test Organization Cleanup...

📊 Found 52 total organization(s)

🔍 Analysis:
   - Test organizations: 50
   - Real organizations: 2

📋 Test organizations to be deleted:

   1. Test Payment Org (ID: test-org-1234567890)
      Created: 2024-12-29T10:30:00.000Z
      Reason: Pattern match

   ... (49 more)

⚠️  WARNING: This will permanently delete the above organizations!

🗑️  Deleting test organizations...

✅ Cleanup complete!
   - Deleted 50 organization document(s)
   - Remaining organizations: 2
```

### Step 2: Verify Clean CRM

1. Navigate to `/admin/organizations` in your browser
2. You should now see:
   - Only 2 real organizations (or however many you had before the tests)
   - Clean, scrollable table
   - Pagination controls at the bottom
3. Check "Show Test Orgs" to verify nothing leaked through

### Step 3: Run Tests Again (Optional)

To verify tests clean up properly:

```bash
npm test
```

After tests finish, check `/admin/organizations` again. There should be no new test orgs (tests delete them in `afterAll`).

## Files Changed

### Created Files

1. `scripts/cleanup-test-orgs.js` - Cleanup script
2. `docs/TEST_DATA_POLLUTION_PREVENTION.md` - Detailed guide
3. `CLEANUP_SUMMARY.md` - This file

### Modified Files

1. `src/app/admin/organizations/page.tsx` - Added pagination + filters
2. `src/types/organization.ts` - Added `isTest` field
3. `src/app/api/admin/organizations/route.ts` - Returns `isTest` field
4. `tests/pagination-validation.test.ts` - Added cleanup + `isTest` flag
5. `tests/integration/payment-integration.test.ts` - Added cleanup + `isTest` flag
6. `package.json` - Added cleanup scripts

## Features Overview

### Before

- ❌ 50+ duplicate test orgs polluting the CRM
- ❌ UI couldn't scroll (no pagination)
- ❌ No way to filter test data
- ❌ Tests left behind orphaned data
- ❌ Unix epoch dates (12/31/1969)

### After

- ✅ Cleanup script to remove all test pollution
- ✅ Pagination (20 orgs per page)
- ✅ Scrollable table (max-height: 70vh)
- ✅ Filter to show/hide test orgs
- ✅ Visual indicators for test data
- ✅ Tests properly clean up after themselves
- ✅ All test orgs marked with `isTest: true`

## Troubleshooting

### "service-account-key.json not found"

The cleanup script needs Firebase Admin credentials.

**Solution:**

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save as `service-account-key.json` in project root
4. **DO NOT commit this file** (it's in `.gitignore`)

### "Permission denied"

**Solution:** Make sure the service account has the `Firebase Admin` role.

### "Still seeing test orgs in CRM"

**Solution:**

1. Run the cleanup script again: `npm run cleanup:test-orgs`
2. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
3. Make sure "Show Test Orgs" is unchecked

### "Cleanup script is slow"

The script deletes one org at a time due to Firestore batch limits.

**For bulk deletion:**

```bash
# Use Firebase CLI (faster for large datasets)
firebase firestore:delete organizations/test-org-123 --recursive
```

## Best Practices Going Forward

### ✅ Always mark test data

```typescript
await FirestoreService.set('organizations', testOrgId, {
  name: '[TEST] My Org',
  isTest: true, // ← Always include this!
  // ...
});
```

### ✅ Always clean up

```typescript
afterAll(async () => {
  for (const id of createdOrgIds) {
    await FirestoreService.delete('organizations', id);
  }
});
```

### ✅ Use the Firestore emulator (recommended)

```bash
# Start emulator
firebase emulators:start

# Run tests against emulator (no production pollution)
FIRESTORE_EMULATOR_HOST=localhost:8080 npm test
```

## Next Steps

1. **Run cleanup script now**: `npm run cleanup:test-orgs`
2. **Verify CRM is clean**: Check `/admin/organizations`
3. **Read the guide**: See `docs/TEST_DATA_POLLUTION_PREVENTION.md` for details
4. **Consider emulator**: Use Firebase emulator for future tests (no production pollution)

## Questions?

- Full documentation: `docs/TEST_DATA_POLLUTION_PREVENTION.md`
- Cleanup script: `scripts/cleanup-test-orgs.js`
- Test examples: `tests/pagination-validation.test.ts`

---

**Summary:** All test pollution issues have been resolved. Run the cleanup script to restore your CRM to its original state, then enjoy proper pagination and test data filtering! 🎉
