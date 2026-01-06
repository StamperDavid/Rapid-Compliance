# 🚀 SWARM DISPATCH QUICK REFERENCE
**AI Sales Platform - Error Resolution Campaign**

## Pre-Flight Checklist (Run from Local Command Center)

```bash
# 1. Verify git repository
git remote -v
# Expected: https://github.com/StamperDavid/ai-sales-platform.git

# 2. Verify current branch
git status
# Expected: On branch dev

# 3. Sync all workers with latest code
python orchestrate.py sync

# 4. Check worker connectivity
python orchestrate.py status
```

---

## Phase 2: Parallel Execution (Workers 1 & 2)

### Worker 1: Type Fixes (164.92.118.130)
**Domain:** `src/lib/` + `src/types/`  
**Task:** Fix 144 TypeScript errors (null checks, type assertions)  
**Duration:** ~45 minutes

```bash
# Diagnostic (see first 100 errors)
python orchestrate.py exec 1 "npx tsc --noEmit src/lib/**/*.ts 2>&1 | head -100"

# Start fixes on Worker 1
python orchestrate.py exec 1 "git checkout -b worker1-type-fixes && echo 'Worker 1 starting type fixes...'"

# Monitor progress (after 15 min)
python orchestrate.py exec 1 "npx tsc --noEmit | grep -c 'error TS' || echo '0'"

# Commit batch (every 50 fixes)
python orchestrate.py exec 1 "git add -A && git commit -m '[W1-FIX] Type safety batch 1: adminDb null guards' && git push origin worker1-type-fixes"
```

---

### Worker 2: ESLint Auto-Fix (147.182.243.137)
**Domain:** `src/components/` + `src/app/`  
**Task:** Auto-fix 1,565 ESLint warnings, then manual cleanup  
**Duration:** ~35 minutes

```bash
# Auto-fix pass (fast win)
python orchestrate.py exec 2 "git checkout -b worker2-eslint-cleanup && npx eslint 'src/**/*.{ts,tsx}' --fix && git add -A && git commit -m '[W2-FIX] ESLint auto-fix (1.5k warnings)' && git push origin worker2-eslint-cleanup"

# Check remaining issues
python orchestrate.py exec 2 "npx eslint 'src/**/*.{ts,tsx}' --format compact | tail -20"

# Manual cleanup (react-hooks, next/image)
python orchestrate.py exec 2 "npx eslint 'src/components/**/*.tsx' --format compact"

# Commit manual fixes
python orchestrate.py exec 2 "git add -A && git commit -m '[W2-FIX] ESLint manual cleanup batch 1' && git push origin worker2-eslint-cleanup"
```

---

## Phase 3: Merge & Verify (Local)

```bash
# Pull Worker 1 changes
git fetch origin worker1-type-fixes
git merge origin/worker1-type-fixes

# Pull Worker 2 changes
git fetch origin worker2-eslint-cleanup
git merge origin/worker2-eslint-cleanup

# Verify no regressions
npx tsc --noEmit
npx eslint "src/**/*.{ts,tsx}" --format compact | grep "✖"

# Push to dev
git push origin dev
```

---

## Phase 4: Worker 3 Activation (Sequential)

### Worker 3: Test Suite Fixes (161.35.239.20)
**Domain:** `tests/`  
**Task:** Fix 198 TypeScript errors in test files  
**Duration:** ~60 minutes  
**Depends on:** Worker 1 completion (updated type definitions)

```bash
# Sync latest from dev (includes Worker 1 fixes)
python orchestrate.py exec 3 "git pull origin dev"

# Diagnostic
python orchestrate.py exec 3 "npx tsc --noEmit tests/**/*.test.ts 2>&1 | head -50"

# Start fixes
python orchestrate.py exec 3 "git checkout -b worker3-test-fixes"

# Commit batches
python orchestrate.py exec 3 "git add -A && git commit -m '[W3-FIX] Test type safety batch 1' && git push origin worker3-test-fixes"
```

---

## Emergency Commands

### Check Worker Status
```bash
python orchestrate.py status
```

### See Recent Commits on Worker
```bash
python orchestrate.py exec 1 "git log --oneline -10"
python orchestrate.py exec 2 "git log --oneline -10"
python orchestrate.py exec 3 "git log --oneline -10"
```

### Abort Worker Task
```bash
python orchestrate.py exec <worker_id> "git reset --hard HEAD && git checkout dev"
```

### Pull All Worker Changes
```bash
git fetch --all
git merge origin/worker1-type-fixes origin/worker2-eslint-cleanup origin/worker3-test-fixes
```

---

## Success Criteria by Phase

### Milestone 1: Auto-Fix Complete (30 min)
- Worker 2 auto-fix committed
- ESLint warnings reduced from 21,299 to ~19,700
- ✅ Branch: `worker2-eslint-cleanup` pushed

### Milestone 2: Type Safety (2 hours)
- Worker 1 core lib/ fixes completed
- TypeScript errors reduced from 342 to <100
- ✅ Branch: `worker1-type-fixes` merged to dev

### Milestone 3: Test Suite Clean (4 hours)
- Worker 3 test fixes completed
- All test files type-safe
- ✅ Branch: `worker3-test-fixes` merged to dev

### Milestone 4: Zero Errors (6 hours)
- All workers completed
- `npx tsc --noEmit` → 0 errors
- `npx eslint` → <500 warnings (cosmetic)
- ✅ Ready for production build

---

## Monitoring Dashboard (Live Stats)

```bash
# Total error count (run locally after each merge)
echo "=== TypeScript Errors ===" && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0"
echo "=== ESLint Issues ===" && npx eslint "src/**/*.{ts,tsx}" 2>&1 | grep "✖"

# Worker progress (run every 15 min)
watch -n 900 'python orchestrate.py exec 1 "npx tsc --noEmit | grep -c \"error TS\" || echo 0"'
```

---

## Rollback Plan

If a worker introduces regressions:

```bash
# Identify bad commit
python orchestrate.py exec <worker_id> "git log --oneline -5"

# Revert specific commit
python orchestrate.py exec <worker_id> "git revert <commit_hash> && git push origin worker<id>-branch"

# Or reset to safe point
python orchestrate.py exec <worker_id> "git reset --hard origin/dev && git push origin worker<id>-branch --force"
```

---

**Notes:**
- Commit every 50 fixes minimum (rollback safety)
- No logic deletion allowed (fix, don't delete)
- Verify build after each merge (catch regressions early)
- Workers 1 & 2 run in parallel, Worker 3 sequential after Worker 1
