# Worker 1: Fix email-delivery-service.ts

## Errors to Fix
7 errors: "adminDb is possibly null" on lines 350, 371, 408, 429, 450, 470, 500

## Fix Pattern (SAME as admin-firestore-service.ts)
1. Import adminDb from '@/lib/firebase/admin'
2. Create helper function:
```typescript
function ensureAdminDb() {
  if (!adminDb) {
    throw new Error('Admin Firestore DB not initialized');
  }
  return adminDb;
}
```
3. Replace all `adminDb.` with `ensureAdminDb().`

## Commands
```bash
# Edit the file
nano src/lib/email-writer/email-delivery-service.ts

# Verify fix
NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit 2>&1 | grep 'email-delivery-service'

# Commit
git add src/lib/email-writer/email-delivery-service.ts
git commit -m "Fix: adminDb null guards in email-delivery-service"
```
