# Test Data Pollution Prevention Guide

## Problem

When automated tests create data in Firestore, they can "pollute" your production database with test organizations, leading to:

- Cluttered admin CRM with fake data
- Difficulty distinguishing real customers from test data
- Performance issues from excessive database records
- Confusion when analyzing metrics and reports

## The Root Cause

Tests were creating organizations directly in Firestore without:

1. **Marking them as test data** (`isTest: true`)
2. **Using distinctive names** (e.g., `[TEST]` prefix)
3. **Cleaning up after themselves** (no `afterAll` cleanup)
4. **Environment separation** (using production database for tests)

## Solutions Implemented

### 1. Cleanup Script

**Location:** `scripts/cleanup-test-orgs.js`

**Usage:**

```bash
# Run the cleanup script to delete all test organizations
node scripts/cleanup-test-orgs.js

# Or with auto-confirm (skips the 5-second confirmation)
AUTO_CONFIRM=true node scripts/cleanup-test-orgs.js
```

**What it does:**

- Identifies test organizations by:
  - `isTest: true` flag
  - Names matching patterns: "Test Payment Org", "Pagination Test Org"
  - Names starting with `[TEST]`, `test-org-`, or `TEMP_TEST`
  - Suspicious dates (before 2020, Unix epoch errors)
- Shows a preview of what will be deleted
- Waits 5 seconds for confirmation (can be skipped with `AUTO_CONFIRM=true`)
- Deletes all identified test organizations

**Requirements:**

- `service-account-key.json` in the project root, OR
- `GOOGLE_APPLICATION_CREDENTIALS` environment variable set

### 2. Updated Test Files

All test files now:

✅ **Add `isTest: true` flag** to all created organizations

```typescript
await FirestoreService.set('organizations', testOrgId, {
  id: testOrgId,
  name: '[TEST] Payment Org',
  isTest: true, // ← Prevents pollution
  createdAt: new Date().toISOString(),
}, false);
```

✅ **Use `[TEST]` prefix** in names for easy identification

✅ **Properly clean up** in `afterAll` hooks

```typescript
afterAll(async () => {
  // Delete all test organizations
  for (const orgId of createdOrgIds) {
    await FirestoreService.delete('organizations', orgId);
  }
});
```

### 3. Admin UI Improvements

**Organizations Page** (`/admin/organizations`)

✅ **Pagination implemented** - Now loads 20 orgs at a time with Next/Previous buttons

✅ **Scrollable container** - Added `max-height: 70vh` and `overflow-y: auto`

✅ **Test org filter** - Toggle to show/hide test organizations

✅ **Visual indicators** - Test orgs highlighted with yellow background and "TEST" badge

✅ **Default behavior** - Test orgs are hidden by default

### 4. API Route Enhancement

The API already supported pagination but wasn't being used:

```typescript
GET /api/admin/organizations?limit=20&startAfter=2024-01-01T00:00:00.000Z
```

**Parameters:**

- `limit` - Page size (default: 50, max: 100)
- `startAfter` - ISO timestamp cursor for pagination

**Response:**

```json
{
  "organizations": [...],
  "pagination": {
    "count": 20,
    "hasMore": true,
    "nextCursor": "2024-01-15T10:30:00.000Z"
  }
}
```

## Best Practices for Future Tests

### ✅ DO: Mark all test data

```typescript
const testData = {
  name: '[TEST] My Test Org',
  isTest: true, // Always add this!
  // ... other fields
};
```

### ✅ DO: Clean up in afterAll

```typescript
afterAll(async () => {
  for (const id of createdIds) {
    await FirestoreService.delete('collection', id);
  }
});
```

### ✅ DO: Use distinctive naming

- Prefix with `[TEST]` or `TEMP_TEST`
- Include random identifiers: `test-org-${Date.now()}`
- Make it obvious these aren't real customers

### ❌ DON'T: Leave orphaned data

```typescript
// BAD - No cleanup
beforeAll(async () => {
  await createTestOrg();
});
// afterAll is missing!

// GOOD - Always clean up
afterAll(async () => {
  await deleteTestOrg();
});
```

### ❌ DON'T: Use production-like names

```typescript
// BAD - Looks like real data
name: 'Acme Corporation'

// GOOD - Obviously a test
name: '[TEST] Acme Corporation'
```

### ❌ DON'T: Create more than necessary

```typescript
// BAD - Excessive test data
for (let i = 0; i < 1000; i++) {
  await createOrg();
}

// GOOD - Use minimal test data
for (let i = 0; i < 10; i++) {
  await createOrg();
}
```

## Monitoring & Maintenance

### Regular Cleanup

Run the cleanup script periodically:

```bash
# Weekly cleanup (add to your CI/CD or cron)
node scripts/cleanup-test-orgs.js
```

### Verify Clean Database

1. Navigate to `/admin/organizations`
2. Uncheck "Show Test Orgs"
3. All organizations should be real customers
4. Check "Show Test Orgs" to see if any test data leaked through

### Check for Pollution

```bash
# View all organizations with isTest flag
# (Firebase Console → Firestore → organizations)
# Filter by: isTest == true
```

## Future Improvements

### Option 1: Separate Test Environment

Use a separate Firebase project for tests:

```typescript
// config/firebase-test.ts
const testConfig = {
  projectId: 'my-app-test', // Different project
  // ...
};
```



```bash

```

### Option 3: Auto-Cleanup Scheduled Function

Create a Cloud Function that runs daily:

```typescript
// Deletes test orgs older than 24 hours
export const cleanupTestData = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    // Delete isTest: true organizations older than 1 day
  });
```

## Troubleshooting

### "service-account-key.json not found"

**Solution:** Download from Firebase Console → Project Settings → Service Accounts

### "Permission denied"

**Solution:** Make sure service account has `Firebase Admin` role

### "Still seeing test orgs"

**Solution:**

1. Run cleanup script: `node scripts/cleanup-test-orgs.js`
2. Check "Show Test Orgs" is unchecked in UI
3. Verify `isTest` field exists in Firestore

### "Cleanup script takes too long"

**Solution:** The script deletes documents one at a time. For bulk deletes:

```bash
# Use Firebase CLI (faster for large datasets)
firebase firestore:delete organizations/test-org-123 --recursive
```

## Summary

**Before:**
- ❌ Tests created 50+ duplicate orgs in production
- ❌ No pagination = UI couldn't scroll
- ❌ No way to filter test data
- ❌ Unix epoch dates (12/31/1969)

**After:**
- ✅ All test orgs marked with `isTest: true`
- ✅ Pagination with 20 orgs per page
- ✅ Scrollable UI with max-height
- ✅ Toggle to show/hide test data
- ✅ Cleanup script for removing pollution
- ✅ Tests properly clean up after themselves

**Next Steps:**

1. Run the cleanup script to remove existing pollution
2. Verify the admin UI shows only real organizations
3. Run tests again to verify they clean up properly
