# WORKER 1 TASK: Complete email-delivery-service.ts

## Current State
Helper function `ensureAdminDb()` already added at line 31.
Still has 7 errors - need to replace remaining `adminDb` usage.

## EXACT STEPS:
```bash
cd ~/worktree-1

# 1. Open file and find all adminDb usage
grep -n "adminDb\[" src/lib/email-writer/email-delivery-service.ts

# 2. Replace pattern: adminDb[ → ensureAdminDb()[
sed -i 's/adminDb\[/ensureAdminDb()\[/g' src/lib/email-writer/email-delivery-service.ts

# 3. Verify fix
NODE_OPTIONS='--max-old-space-size=4096' npx tsc --noEmit 2>&1 | grep 'email-delivery-service'

# 4. If no errors, commit
git add src/lib/email-writer/email-delivery-service.ts
git commit -m "[W1] Fix: Replace adminDb array access with ensureAdminDb()"

# 5. Report back
echo "WORKER 1 COMPLETE: email-delivery-service.ts"
```

## Expected Result:
0 errors in email-delivery-service.ts
