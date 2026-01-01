# TEST DATABASE SETUP REQUIRED

## Critical Issue

**Your tests are polluting production because they connect to your production Firebase project.**

Every time tests run, they create organizations like:
- `test-org-1766952554132`
- `test-org-1766952920889`
- etc.

This has created **113+ test organizations in production**.

## Root Cause

1. Tests use `AdminFirestoreService` (bypasses security rules)
2. `admin.ts` loads `serviceAccountKey.json` → Points to **PRODUCTION**
3. Tests run → Create test data in **PRODUCTION**

## The Solution (2 Separate Firebase Projects)

### Setup Required:

1. **Create a TEST Firebase Project**
   - Go to Firebase Console
   - Create a new project called `ai-sales-platform-TEST`
   - This will be ONLY for running tests

2. **Download TEST Service Account Key**
   - In Firebase Console → Project Settings → Service Accounts
   - Generate new private key
   - Save as: `serviceAccountKey-TEST.json` in project root
   - **DO NOT COMMIT THIS FILE**

3. **Update .gitignore**
   ```
   serviceAccountKey.json
   serviceAccountKey-TEST.json
   ```

4. **Configure Tests to Use TEST Project**
   - Update `jest.setup.js` to load test credentials
   - Tests will ONLY connect to test project
   - Production remains untouched

## What Tests Do

Tests create temporary data to verify features work:
- **Pagination tests**: Create 200 test leads, 100 test deals to verify pagination works
- **E2E tests**: Create test organizations, products, orders to verify checkout flow
- **Integration tests**: Create test data to verify services work correctly

**This data should NEVER be in production.**

## Current State

Your production database has:
- ✅ 1 super admin (you)
- ✅ 5 demo accounts (approved)
- ❌ 113 test organizations (from tests running against production)

## Action Items

1. ✅ **Tests are now BLOCKED** from running until you set up test project
2. ⏳ **Create separate TEST Firebase project**
3. ⏳ **Download test service account key**
4. ⏳ **Update environment variables**

## Why This Happened

The original setup assumed:
- Tests would use Firebase emulators (local fake Firebase)
- OR tests would use a separate test project

But the configuration pointed tests at production, causing pollution.

## Next Steps

Do you want me to:
1. Update the code to use a separate test project configuration?
2. Document how to set up the test Firebase project?
3. Add additional safeguards to prevent this?
