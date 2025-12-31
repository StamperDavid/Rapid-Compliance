# Production Protection - CRITICAL

## What Happened

**INCIDENT**: Test seed scripts were accidentally run against the PRODUCTION database TWICE, polluting it with:
- 16 test user accounts
- 17 test organizations
- Associated test data

This caused confusion, database bloat, and required emergency cleanup.

## Root Cause

1. **No Guardrails**: Seed scripts had no protection against running on production
2. **Confusing Project Name**: Production database is named "ai-sales-platform-dev" (misleading)
3. **Easy Access**: serviceAccountKey.json points directly to production
4. **No Confirmation**: Scripts run immediately without asking for confirmation

## Protection Measures Implemented

### 1. **PRODUCTION_PROTECTION.js Module**

All seed/test scripts MUST use this module:

```javascript
const { requireProductionProtection } = require('./PRODUCTION_PROTECTION');

// At the start of your script, BEFORE doing anything:
await requireProductionProtection(projectId, 'script-name.js');
```

This module:
- Blocks execution if project ID contains "prod" or is in the production list
- Requires typing "YES I AM SURE" before proceeding
- Exits immediately if blocked

### 2. **Dangerous Scripts Disabled**

The following scripts have been renamed to `.DANGEROUS` and will not run:
- `seed-demo-accounts-production.js` → `DISABLED-seed-demo-accounts-production.js.DANGEROUS`
- `seed-production-test-orgs.js` → `DISABLED-seed-production-test-orgs.js.DANGEROUS`
- `seed-test-accounts.js` → `DISABLED-seed-test-accounts.js.DANGEROUS`
- `seed-e2e-test-data.js` → `DISABLED-seed-e2e-test-data.js.DANGEROUS`

### 3. **Production Project ID Locked**

The project ID `ai-sales-platform-dev` is now in the PRODUCTION_PROJECT_IDS blocklist.

## Safe Development Practices

### DO THIS:
✅ Use Firebase Emulators for local development
✅ Create a separate TEST Firebase project
✅ Never commit serviceAccountKey.json
✅ Always verify project ID before running scripts
✅ Use the PRODUCTION_PROTECTION module in all seed scripts

### NEVER DO THIS:
❌ Run seed scripts against production
❌ Use production serviceAccountKey.json for testing
❌ Create test data with "test", "demo", or "example" in production
❌ Bypass protection mechanisms

## Emergency Cleanup

If test data gets into production again:

```bash
node scripts/EMERGENCY-CLEANUP-TEST-DATA.js
```

This script:
- Deletes all users with test/demo/example in email or name
- Deletes all organizations with test/demo/example in name or ID
- Preserves dstamper@rapidcompliance.us (production user)
- Preserves platform organization

## Project Structure

**Production Database**: `ai-sales-platform-dev` (confusing name, but this IS production)
**Production User**: dstamper@rapidcompliance.us (ONLY user who should have super_admin role)

## Questions?

Before running ANY script that creates data:
1. What project ID am I connecting to?
2. Is this test data or production data?
3. Do I have protection in place?
4. Am I using emulators or real Firebase?

**When in doubt, DON'T RUN IT.**
