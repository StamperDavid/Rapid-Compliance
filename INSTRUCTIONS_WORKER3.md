# WORKER 3 TASK: Fix proposal-generator.ts

## Error
Line 115, col 68: Argument of type 'unknown' is not assignable to parameter of type 'LogContext | undefined'.

## EXACT STEPS:
```bash
cd ~/worktree-1

# 1. Find the error line
sed -n '113,117p' src/lib/documents/proposal-generator.ts

# 2. The issue is an 'unknown' type being passed to logger
# Cast it using 'as LogContext'
# Find the logger call and add type assertion
sed -i '115s/, error)/, error as LogContext)/' src/lib/documents/proposal-generator.ts

# 3. Verify fix  
NODE_OPTIONS='--max-old-space-size=4096' npx tsc --noEmit 2>&1 | grep 'proposal-generator'

# 4. If no errors, commit
git add src/lib/documents/proposal-generator.ts
git commit -m "[W3] Fix: Cast error to LogContext type"

# 5. Report back
echo "WORKER 3 COMPLETE: proposal-generator.ts"
```

## Expected Result:
0 errors in proposal-generator.ts
