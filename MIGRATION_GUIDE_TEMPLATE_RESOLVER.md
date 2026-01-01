# Migration Guide: Using the New Template Resolver

## Overview

The new template resolver (`src/lib/templates/template-resolver.ts`) provides Firestore override support while maintaining backward compatibility. This guide shows how to update existing code to use the new system.

## Quick Migration

### Before (Old Import)
```typescript
import { getIndustryTemplate } from '@/lib/persona/industry-templates';

// Usage
const template = await getIndustryTemplate('dental-practices');
```

### After (New Import)
```typescript
import { getIndustryTemplate } from '@/lib/templates/template-resolver';

// Usage (exactly the same!)
const template = await getIndustryTemplate('dental-practices');
```

**That's it!** The API is identical, but now it checks Firestore first.

## Files to Update

### 1. Base Model Builder
**File**: `src/lib/agent/base-model-builder.ts`

```typescript
// OLD
import { getIndustryTemplate } from '@/lib/persona/industry-templates';

// NEW
import { getIndustryTemplate } from '@/lib/templates/template-resolver';
```

### 2. Enrichment Service
**File**: `src/lib/enrichment/enrichment-service.ts`

```typescript
// OLD
import { getIndustryTemplate } from '@/lib/persona/industry-templates';

// NEW
import { getIndustryTemplate } from '@/lib/templates/template-resolver';
```

### 3. Scraper Runner
**File**: `src/lib/scraper-intelligence/scraper-runner.ts`

```typescript
// OLD
import { getIndustryTemplate } from '@/lib/persona/industry-templates';

// NEW
import { getIndustryTemplate } from '@/lib/templates/template-resolver';
```

### 4. Any Other Files

Find all usages:
```bash
# Unix/Mac
grep -r "from '@/lib/persona/industry-templates'" src/

# Windows PowerShell
Get-ChildItem -Path src\ -Recurse -Filter *.ts,*.tsx | Select-String "from '@/lib/persona/industry-templates'"
```

## Advanced Usage

### Get Template with Source Information

If you need to know whether a template came from Firestore or code:

```typescript
import { getTemplateWithSource } from '@/lib/templates/template-resolver';

const result = await getTemplateWithSource('dental-practices');

if (result) {
  console.log('Template:', result.template);
  console.log('Source:', result.source); // 'firestore' or 'code'
  console.log('Has Override:', result.hasOverride); // true/false
}
```

### Get All Templates with Overrides

```typescript
import { getAllIndustryTemplates } from '@/lib/templates/template-resolver';

const templates = await getAllIndustryTemplates();
// Returns: Record<string, IndustryTemplate>
// All Firestore overrides are automatically applied
```

### Get Template List with Override Status

```typescript
import { getIndustryOptionsWithOverrides } from '@/lib/templates/template-resolver';

const options = await getIndustryOptionsWithOverrides();
// Returns array of:
// {
//   value: 'dental-practices',
//   label: 'Dental Practices',
//   description: '...',
//   category: 'Healthcare & Wellness',
//   hasOverride: true // ← NEW field
// }
```

### Compare Versions

```typescript
import { compareTemplateVersions } from '@/lib/templates/template-resolver';

const comparison = await compareTemplateVersions('dental-practices');

if (comparison) {
  console.log('Firestore version:', comparison.firestoreVersion);
  console.log('Code version:', comparison.codeVersion);
  console.log('Has changes:', comparison.hasChanges);
}
```

## Direct Firestore Access

If you need direct Firestore operations:

```typescript
import {
  getGlobalTemplate,
  saveGlobalTemplate,
  deleteGlobalTemplate,
  hasTemplateOverride,
  listGlobalTemplates,
} from '@/lib/templates/template-service';

// Check if override exists
const hasOverride = await hasTemplateOverride('dental-practices');

// Get override (returns null if doesn't exist)
const override = await getGlobalTemplate('dental-practices');

// Save override
await saveGlobalTemplate(template, userId);

// Delete override (revert to code)
await deleteGlobalTemplate('dental-practices');

// List all overrides
const overrides = await listGlobalTemplates();
```

## Important Notes

### 1. Async Only
The new resolver is **async only**. Update any synchronous calls:

```typescript
// OLD (sync, deprecated)
import { getTemplatesSync } from '@/lib/persona/industry-templates';
const templates = getTemplatesSync(); // ❌ Throws error

// NEW (async)
import { getAllIndustryTemplates } from '@/lib/templates/template-resolver';
const templates = await getAllIndustryTemplates(); // ✅
```

### 2. Error Handling
The resolver may throw errors. Always wrap in try-catch:

```typescript
try {
  const template = await getIndustryTemplate('dental-practices');
  if (!template) {
    // Template not found in Firestore or code
    throw new Error('Template not found');
  }
  // Use template
} catch (error) {
  logger.error('Failed to load template', { error });
  // Handle error
}
```

### 3. Caching
Templates are cached after first load. To force refresh:

```typescript
// The resolver uses dynamic imports which are cached by the module system
// If you need to force a refresh of Firestore data, call directly:
import { getGlobalTemplate } from '@/lib/templates/template-service';

const freshTemplate = await getGlobalTemplate('dental-practices');
```

### 4. Performance
- **First call**: ~50-100ms (Firestore query + potential dynamic import)
- **Subsequent calls**: ~1-5ms (cached)
- **Firestore miss**: Adds ~30ms for dynamic import fallback

## Testing

### Unit Tests
```typescript
import { getIndustryTemplate } from '@/lib/templates/template-resolver';

describe('Template Resolver', () => {
  it('should return template from code', async () => {
    const template = await getIndustryTemplate('dental-practices');
    expect(template).toBeDefined();
    expect(template?.id).toBe('dental-practices');
  });

  it('should return null for invalid ID', async () => {
    const template = await getIndustryTemplate('invalid-id');
    expect(template).toBeNull();
  });
});
```

### Integration Tests
```typescript
import { getIndustryTemplate } from '@/lib/templates/template-resolver';
import { saveGlobalTemplate, deleteGlobalTemplate } from '@/lib/templates/template-service';

describe('Template Override', () => {
  afterEach(async () => {
    // Cleanup
    await deleteGlobalTemplate('test-template');
  });

  it('should return Firestore override when exists', async () => {
    // Create override
    const override = { ...baseTemplate, name: 'OVERRIDDEN' };
    await saveGlobalTemplate(override, 'test-user');

    // Should return override
    const template = await getIndustryTemplate('test-template');
    expect(template?.name).toBe('OVERRIDDEN');
  });

  it('should fall back to code after delete', async () => {
    // Create override
    await saveGlobalTemplate(override, 'test-user');
    
    // Delete override
    await deleteGlobalTemplate('test-template');
    
    // Should return code version
    const template = await getIndustryTemplate('test-template');
    expect(template?.name).toBe('Original Name'); // From code
  });
});
```

## Rollback Plan

If issues arise, you can easily rollback:

### Option 1: Revert Import (Immediate)
```typescript
// Change back to old import
import { getIndustryTemplate } from '@/lib/persona/industry-templates';
```

### Option 2: Delete All Overrides (Reset System)
```typescript
import { listGlobalTemplates, deleteGlobalTemplate } from '@/lib/templates/template-service';

// Get all overrides
const overrides = await listGlobalTemplates();

// Delete each one
for (const override of overrides) {
  await deleteGlobalTemplate(override.id);
}
```

### Option 3: Disable Firestore Check (Fallback Only)
Modify `template-resolver.ts`:
```typescript
export async function getIndustryTemplate(templateId: string) {
  // Skip Firestore, go straight to code
  return await getHardcodedTemplate(templateId);
}
```

## Migration Checklist

- [ ] Find all files using old import
- [ ] Update imports to new resolver
- [ ] Test each updated file
- [ ] Verify fallback works (no Firestore document)
- [ ] Verify override works (create test override)
- [ ] Update any unit tests
- [ ] Update integration tests
- [ ] Test in development environment
- [ ] Test in staging environment
- [ ] Monitor logs for errors
- [ ] Deploy to production

## Support

If you encounter issues during migration:

1. **Check Logs**: Look for template resolution errors
   ```typescript
   logger.info('Template loaded', { templateId, source });
   ```

2. **Verify Firestore**: Ensure collection exists and permissions are correct

3. **Test Fallback**: Delete all overrides and verify code fallback works

4. **Rollback**: Use old import if needed (no breaking changes)

---

**Migration Time**: ~15 minutes (simple find/replace)  
**Breaking Changes**: None (API identical)  
**Risk Level**: Low (fallback to code if Firestore fails)  
**Testing Required**: High (verify both paths work)
