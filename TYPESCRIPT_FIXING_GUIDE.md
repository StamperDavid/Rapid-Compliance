# TypeScript Error Fixing Guide for Workers
**Master reference for all workers - Best practices only, NO shortcuts**

## 🎯 MANDATORY FIXING PATTERNS

### Pattern 1: DocumentData → Typed Interface
**Error**: `Type 'DocumentData' is not assignable to type 'X'`  
**Fix**: Cast using `as unknown as T`
```typescript
// BEFORE
const data = await FirestoreService.get(...);

// AFTER  
const data = await FirestoreService.get(...) as unknown as MyInterface;
```

### Pattern 2: adminDb Possibly Null
**Error**: `'adminDb' is possibly 'null'`
**Fix**: Create guard helper, replace all usage
```typescript
// ADD at top of file:
function ensureAdminDb() {
  if (!adminDb) {
    throw new Error('Admin DB not initialized');
  }
  return adminDb;
}

// REPLACE all instances:
adminDb.collection(...) → ensureAdminDb().collection(...)
const ref = adminDb → const ref = ensureAdminDb()
```

### Pattern 3: null → undefined Type Mismatch
**Error**: `Type 'string | null' is not assignable to type 'string | undefined'`
**Fix**: Use ?? operator
```typescript
// BEFORE
field: value || null
field: value

// AFTER
field: value ?? undefined
```

### Pattern 4: Config Property Access on Record<string, unknown>
**Error**: `Property 'X' does not exist on type 'Record<string, unknown>'`
**Fix**: Guard check + explicit cast
```typescript
// BEFORE
const { prop1, prop2 } = integration.config;

// AFTER
if (!integration.config) {
  throw new Error('Config missing');
}
const prop1 = integration.config.prop1 as string;
const prop2 = integration.config.prop2 as string;
```

### Pattern 5: Date → Timestamp Conversion
**Error**: `Type 'Date' is missing properties from 'Timestamp'`
**Fix**: Import and use Timestamp.fromDate()
```typescript
// ADD import:
import { Timestamp } from 'firebase/firestore';

// REPLACE:
occurredAt: new Date() → occurredAt: Timestamp.fromDate(new Date())
occurredAt: dateValue → occurredAt: Timestamp.fromDate(dateValue)
```

### Pattern 6: Unknown Type to Specific Type
**Error**: `Argument of type 'unknown' is not assignable to parameter of type 'X'`
**Fix**: Cast to proper type or unknown
```typescript
// For logger errors:
logger.warn('msg', error) → logger.warn('msg', error as unknown)

// For known types:
new Date(value) → new Date(value as string | number | Date)
```

### Pattern 7: Possibly Undefined Property Access
**Error**: `'object.property' is possibly 'undefined'`
**Fix**: Add guard check (prefer early return over ! assertion)
```typescript
// BEFORE
object.property.nestedValue

// AFTER (Option A - Guard):
if (!object.property) {
  return; // or throw or default
}
object.property.nestedValue

// AFTER (Option B - Optional chain when appropriate):
object.property?.nestedValue
```

### Pattern 8: Duplicate Property Name
**Error**: `'property' is specified more than once`
**Fix**: Remove duplicate or rename
```typescript
// BEFORE
{ url: x, ...spread } // spread also contains 'url'

// AFTER
{ ...spread } // Just use the one from spread
```

### Pattern 9: Implicit Any Type
**Error**: `Parameter 'x' implicitly has an 'any' type`
**Fix**: Add explicit type annotation
```typescript
// BEFORE
.map(item => ...)

// AFTER
.map((item: Record<string, unknown>) => ...)
```

### Pattern 10: String | Undefined Not Assignable to String
**Error**: `Type 'string | undefined' is not assignable to type 'string'`
**Fix**: Add default or guard
```typescript
// BEFORE
functionExpectingString(maybeUndefinedString)

// AFTER
functionExpectingString(maybeUndefinedString || '')
// OR
if (!maybeUndefinedString) throw new Error('Required');
functionExpectingString(maybeUndefinedString)
```

## 🔧 WORKFLOW FOR EACH FILE

1. **Read the error** - Understand what TypeScript is complaining about
2. **Find the pattern** - Match to one of the 10 patterns above
3. **Apply the fix** - Use the EXACT pattern shown
4. **Verify** - Run `npx tsc --noEmit 2>&1 | grep filename`
5. **Commit** - `git add file && git commit -m "[WX] Fix: description"`
6. **Move to next** - Continue until your file list is empty

## ⚠️ NEVER DO THIS
- ❌ NO `as any` casts
- ❌ NO `// @ts-ignore` comments
- ❌ NO non-null assertions `!` (use guards instead)
- ❌ NO skipping verification step
