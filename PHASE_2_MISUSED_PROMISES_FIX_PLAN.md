# Phase 2: Fix `@typescript-eslint/no-misused-promises` (174 violations)

## 🎯 Target Rule
**Rule:** `@typescript-eslint/no-misused-promises`  
**Total Violations:** 174  
**Impact:** 🔴 CRITICAL - Causes hydration warnings & silent event handler failures  
**Strategy:** Rule-by-rule fixing across entire `src/app/` folder

---

## 📋 Batch 1: First 5 Files (31 violations)

### File 1: `src/app/admin/sales-agent/training/page.tsx` (7 violations)

**Lines to fix:** 776, 789, 856, 897, 944, 979, 1107

#### Pattern Analysis:
All violations are async handlers in event attributes (`onClick`, `onKeyPress`).

#### Fix Strategy:
1. **onKeyPress** (line 776): Wrap async call in void
2. **onClick handlers** (lines 789, 856, 897, 944, 979, 1107): Wrap async functions in void

**Example Fix:**
```typescript
// ❌ BEFORE (Line 776)
onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}

// ✅ AFTER
onKeyPress={(e) => {
  if (e.key === 'Enter') {
    void handleSendMessage();
  }
}}

// ❌ BEFORE (Line 789)
onClick={handleSendMessage}

// ✅ AFTER
onClick={() => void handleSendMessage()}
```

**Estimated Time:** ~15 minutes  
**Complexity:** Low - straightforward wrapping

---

### File 2: `src/app/workspace/[orgId]/settings/ai-agents/training/page.tsx` (7 violations)

**Lines to fix:** 1115, 1128, 1287, 1339, 1433, 1504, 1678

#### Pattern Analysis:
Similar to File 1 - async handlers in onClick attributes.

#### Fix Strategy:
Wrap all async onClick handlers with void operator.

**Example Fix:**
```typescript
// Pattern repeats - same fix as File 1
onClick={() => void handleAsyncFunction()}
```

**Estimated Time:** ~15 minutes  
**Complexity:** Low

---

### File 3: `src/app/workspace/[orgId]/settings/subscription/page.tsx` (5 violations)

**Lines to fix:** 156, 196, 231, 271, 308

#### Pattern Analysis:
Multiple toggle/action buttons with async handlers.

#### Fix Strategy:
```typescript
// ❌ BEFORE (Line 156)
onClick={() => toggleFeature('aiEmailWriter', !subscription?.outboundFeatures?.aiEmailWriter?.enabled)}

// ✅ AFTER
onClick={() => void toggleFeature('aiEmailWriter', !subscription?.outboundFeatures?.aiEmailWriter?.enabled)}
```

**Note:** `toggleFeature` appears to be async - need to verify and wrap properly.

**Estimated Time:** ~10 minutes  
**Complexity:** Low

---

### File 4: `src/app/workspace/[orgId]/templates/page.tsx` (5 violations)

**Lines to fix:** 220, 280, 309, 369, 393

#### Pattern Analysis:
Template action handlers (apply, delete, etc.).

#### Fix Strategy:
```typescript
// ❌ BEFORE (Line 220)
onClick={handleApplyTemplate}

// ✅ AFTER
onClick={() => void handleApplyTemplate()}
```

**Estimated Time:** ~10 minutes  
**Complexity:** Low

---

### File 5: `src/app/workspace/[orgId]/website/editor/page.tsx` (5 violations)

**Lines to fix:** 507, 508, 509, 510, 511

#### Pattern Analysis:
**SPECIAL CASE**: All 5 violations are consecutive in prop spreading to a component.

```typescript
// Current (Lines 507-511):
onSave={() => savePage(false)}
onSaveAsTemplate={saveAsTemplate}
onPublish={() => publishPage()}
onUnpublish={unpublishPage}
onPreview={generatePreview}
```

#### Fix Strategy:
**Option A: Wrap each prop** (Quick fix)
```typescript
onSave={() => void savePage(false)}
onSaveAsTemplate={() => void saveAsTemplate()}
onPublish={() => void publishPage()}
onUnpublish={() => void unpublishPage()}
onPreview={() => void generatePreview()}
```

**Option B: Define handlers** (Better practice)
```typescript
// Add at component level
const handleSave = () => void savePage(false);
const handleSaveAsTemplate = () => void saveAsTemplate();
const handlePublish = () => void publishPage();
const handleUnpublish = () => void unpublishPage();
const handlePreview = () => void generatePreview();

// Use in JSX
onSave={handleSave}
onSaveAsTemplate={handleSaveAsTemplate}
onPublish={handlePublish}
onUnpublish={handleUnpublish}
onPreview={handlePreview}
```

**Recommended:** Option A for speed, can refactor to Option B later if needed.

**Estimated Time:** ~10 minutes  
**Complexity:** Low

---

## 📊 Batch 1 Summary

| File | Violations | Est. Time | Complexity |
|------|------------|-----------|------------|
| 1. `admin/sales-agent/training/page.tsx` | 7 | 15 min | Low |
| 2. `workspace/[orgId]/settings/ai-agents/training/page.tsx` | 7 | 15 min | Low |
| 3. `workspace/[orgId]/settings/subscription/page.tsx` | 5 | 10 min | Low |
| 4. `workspace/[orgId]/templates/page.tsx` | 5 | 10 min | Low |
| 5. `workspace/[orgId]/website/editor/page.tsx` | 5 | 10 min | Low |
| **TOTAL** | **31** | **60 min** | **Low** |

---

## 🔧 Fix Pattern Reference

### Pattern 1: Direct async function in onClick
```typescript
// ❌ BAD
<button onClick={asyncFunction}>Click</button>

// ✅ GOOD
<button onClick={() => void asyncFunction()}>Click</button>
```

### Pattern 2: Inline async arrow in onClick
```typescript
// ❌ BAD
<button onClick={async () => { await doSomething(); }}>Click</button>

// ✅ GOOD
<button onClick={() => void (async () => { await doSomething(); })()}>Click</button>
```

### Pattern 3: Conditional async call (onKeyPress)
```typescript
// ❌ BAD
onKeyPress={(e) => e.key === 'Enter' && asyncFunction()}

// ✅ GOOD
onKeyPress={(e) => {
  if (e.key === 'Enter') {
    void asyncFunction();
  }
}}
```

### Pattern 4: Async function with parameters
```typescript
// ❌ BAD
onClick={() => toggleFeature('key', value)}  // if toggleFeature is async

// ✅ GOOD
onClick={() => void toggleFeature('key', value)}
```

---

## ✅ Verification Plan

After fixing each batch of 5 files:

```bash
# 1. Verify specific rule count is dropping
npx eslint "src/app/**" --format json | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const count = data.reduce((sum, file) => 
  sum + file.messages.filter(m => m.ruleId === '@typescript-eslint/no-misused-promises').length, 
0);
console.log('Remaining no-misused-promises violations:', count);
"

# 2. Run full lint to ensure no new errors
npx eslint "src/app/**" --quiet

# 3. Spot check one fixed file
npx eslint "src/app/admin/sales-agent/training/page.tsx" | grep "no-misused-promises"
```

**Expected Result:** Should show 143 violations (174 - 31 = 143) after Batch 1.

---

## 🚀 Execution Steps

1. **Fix File 1** → Run file-specific lint → Verify no new errors
2. **Fix File 2** → Run file-specific lint → Verify no new errors
3. **Fix File 3** → Run file-specific lint → Verify no new errors
4. **Fix File 4** → Run file-specific lint → Verify no new errors
5. **Fix File 5** → Run file-specific lint → Verify no new errors
6. **Run batch verification** → Confirm count dropped from 174 to 143
7. **Commit changes** with message: "fix: resolve no-misused-promises in batch 1 (31 violations)"

---

## 📈 Progress Tracking

- [ ] Batch 1 (31 violations) - Files 1-5
- [ ] Batch 2 (30 violations) - Files 6-10
- [ ] Batch 3 (30 violations) - Files 11-15
- [ ] Batch 4 (remaining ~83 violations)

**Total batches estimated:** 6-7  
**Total time estimated:** 4-5 hours

---

## ⚠️ Important Notes

1. **DO NOT use `// eslint-disable`** - All fixes must be proper code changes
2. **Use `void` operator** - This explicitly tells TypeScript we're ignoring the promise
3. **Keep it simple** - Don't over-engineer; wrap handlers inline for now
4. **Verify after each file** - Don't batch fixes without verification
5. **Watch for false positives** - If a function isn't actually async, don't wrap it

---

## 🎯 Success Criteria

- ✅ All 174 violations of `@typescript-eslint/no-misused-promises` resolved
- ✅ No new ESLint errors introduced
- ✅ All event handlers properly typed
- ✅ Hydration warnings eliminated in dev console
- ✅ Event handlers function correctly in browser

**Ready to begin? Start with File 1!**
