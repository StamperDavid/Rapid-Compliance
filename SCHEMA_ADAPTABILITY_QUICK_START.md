# Schema Adaptability System - Quick Start Guide

## 🚀 5-Minute Developer Guide

### **What Is This?**

A system that automatically adapts your platform when clients modify schemas. No more broken workflows, failed integrations, or outdated AI agents.

---

## **For Developers: How to Use**

### **✅ DO THIS (New Way):**

```typescript
import { FieldResolver } from '@/lib/schema/field-resolver';

// 1. Get your schema
const schema = await getSchema(schemaId);

// 2. Resolve field dynamically
const resolved = await FieldResolver.resolveFieldWithCommonAliases(
  schema, 
  'price' // Works even if field was renamed to 'hourly_rate', 'cost', 'rate', etc.
);

if (!resolved) {
  console.warn('Field not found');
  return;
}

// 3. Get/set values using resolved field
const value = FieldResolver.getFieldValue(record, resolved);
FieldResolver.setFieldValue(record, resolved, newValue);
```

### **❌ DON'T DO THIS (Old Way):**

```typescript
// Breaks when field is renamed
const price = product.price;
product.price = 100;
```

---

## **Common Use Cases**

### **Use Case 1: Get Field Value**

```typescript
// Works even if 'price' was renamed to 'hourly_rate'
const schema = await getSchema(schemaId);
const resolved = await FieldResolver.resolveFieldWithCommonAliases(schema, 'price');
const value = FieldResolver.getFieldValue(product, resolved);
```

### **Use Case 2: Create Entity with Dynamic Fields**

```typescript
const entityData: Record<string, any> = {};

for (const mapping of fieldMappings) {
  const resolved = await FieldResolver.resolveField(schema, mapping.targetField);
  
  if (!resolved) {
    logger.warn(`Field ${mapping.targetField} not found`);
    continue;
  }
  
  entityData[resolved.fieldKey] = mapping.value;
}

await createEntity(entityData);
```

### **Use Case 3: Validate Field Exists**

```typescript
const validation = await FieldResolver.validateFieldReference(schema, 'price');

if (!validation.valid) {
  console.log('Field not found. Suggestions:', validation.suggestions);
}
```

### **Use Case 4: Map Between Schemas**

```typescript
const mapping = await FieldResolver.createFieldMapping(
  sourceSchema,
  targetSchema,
  'price',
  'cost'
);

if (!mapping.compatible) {
  console.warn('Type mismatch:', mapping.warnings);
}
```

---

## **API Endpoints**

### **Get Schema Changes**
```bash
GET /api/schema-changes?organizationId=org_123&schemaId=schema_456
```

### **Process Pending Changes**
```bash
POST /api/schema-changes/process
Content-Type: application/json

{
  "organizationId": "org_123"
}
```

### **Get Impact Analysis**
```bash
GET /api/schema-changes/impact?organizationId=org_123&workspaceId=ws_456&schemaId=schema_789
```

---

## **UI Component**

```tsx
import SchemaChangeImpactDashboard from '@/components/SchemaChangeImpactDashboard';

export default function SchemaSettingsPage() {
  return (
    <div>
      <h1>Schema Settings</h1>
      
      <SchemaChangeImpactDashboard
        organizationId={orgId}
        workspaceId={workspaceId}
        schemaId={schemaId}
      />
    </div>
  );
}
```

---

## **Field Resolver - Common Aliases**

The system knows these common variations:

| You search for | Also matches |
|----------------|--------------|
| `price` | cost, amount, rate, hourly_rate, pricing, value |
| `name` | title, product_name, item_name, display_name |
| `description` | desc, details, summary, about, info |
| `email` | email_address, contact_email, e_mail |
| `phone` | phone_number, telephone, contact_number, mobile |
| `company` | company_name, organization, business |
| `quantity` | qty, amount, count, stock |
| `sku` | product_code, item_code, part_number |

**This means:** If a client renames `price` to `hourly_rate`, your code searching for `price` will automatically find `hourly_rate`.

---

## **Confidence Scores**

```typescript
const resolved = await FieldResolver.resolveField(schema, 'price');

// resolved.confidence tells you match quality:
// 1.0  = Exact match (field key = 'price')
// 0.95 = Exact label match
// 0.8  = Alias match (e.g., 'hourly_rate' when searching 'price')
// 0.6  = Fuzzy match (partial string match)
// 0.5  = Type match (any field of same type)

if (resolved.confidence < 0.8) {
  logger.warn('Low confidence match - may need review');
}
```

---

## **Error Handling**

```typescript
const resolved = await FieldResolver.resolveField(schema, fieldName);

if (!resolved) {
  // Field not found - get suggestions
  const validation = await FieldResolver.validateFieldReference(schema, fieldName);
  
  throw new Error(
    `Field '${fieldName}' not found. Did you mean: ${validation.suggestions?.join(', ')}?`
  );
}

if (resolved.confidence < 0.8) {
  logger.warn(
    `Low confidence match for '${fieldName}' -> '${resolved.fieldKey}' (${resolved.confidence})`
  );
}
```

---

## **Performance Tips**

### **1. Cache Schema Lookups**

```typescript
// ❌ BAD - Fetches schema every time
for (const item of items) {
  const schema = await getSchema(schemaId); // Slow!
  const resolved = await FieldResolver.resolveField(schema, 'price');
}

// ✅ GOOD - Fetch schema once
const schema = await getSchema(schemaId);
for (const item of items) {
  const resolved = await FieldResolver.resolveField(schema, 'price'); // Fast! (cached)
}
```

### **2. Batch Field Resolutions**

```typescript
const fieldRefs = ['price', 'name', 'description'];
const resolved = await FieldResolver.resolveMultipleFields(schema, fieldRefs);

// resolved is a Map<string, ResolvedField | null>
```

---

## **Testing Your Code**

```typescript
import { FieldResolver } from '@/lib/schema/field-resolver';
import { Schema } from '@/types/schema';

describe('My Feature', () => {
  it('should handle field renames', async () => {
    const schema: Schema = {
      // ... schema with 'hourly_rate' field
    };
    
    // Should still find field when searching for 'price'
    const resolved = await FieldResolver.resolveFieldWithCommonAliases(schema, 'price');
    
    expect(resolved).toBeDefined();
    expect(resolved?.fieldKey).toBe('hourly_rate');
  });
});
```

---

## **When Schema Changes Happen**

1. **User updates schema** via UI or API
2. **Schema Manager** detects changes and publishes events
3. **Handlers process events** in parallel:
   - Workflows validated
   - E-commerce mappings updated
   - AI agent knowledge refreshed
   - Integration mappings adapted
4. **User receives notification** if action needed
5. **Everything keeps working** ✅

---

## **Troubleshooting**

### **Problem:** Field not resolving

**Solution:**
```typescript
// Check what the resolver found
const resolved = await FieldResolver.resolveField(schema, 'price');
console.log('Resolved:', resolved);

// Try with aliases
const withAliases = await FieldResolver.resolveFieldWithCommonAliases(schema, 'price');
console.log('With aliases:', withAliases);

// Get validation details
const validation = await FieldResolver.validateFieldReference(schema, 'price');
console.log('Validation:', validation);
```

### **Problem:** Events not processing

**Solution:**
```bash
# Manually trigger processing
POST /api/schema-changes/process
{
  "organizationId": "org_123"
}

# Check logs
console.log('[Schema Change Handler] ...');
```

---

## **Best Practices**

### **✅ DO:**
- Always use `FieldResolver` for dynamic field access
- Check confidence scores for critical operations
- Handle `null` returns gracefully
- Log low-confidence matches
- Use `resolveFieldWithCommonAliases()` for better matching

### **❌ DON'T:**
- Hardcode field names as strings
- Assume field always exists
- Ignore confidence scores
- Skip error handling
- Fetch schema in loops

---

## **Next Steps**

1. **Read the full guide:** `SCHEMA_ADAPTABILITY_SYSTEM.md`
2. **Check examples:** `tests/schema-adaptability.test.ts`
3. **Review implementation:** `SCHEMA_ADAPTABILITY_IMPLEMENTATION_SUMMARY.md`

---

## **TL;DR**

```typescript
// Old way (breaks):
const price = product.price;

// New way (adapts):
import { FieldResolver } from '@/lib/schema/field-resolver';

const schema = await getSchema(schemaId);
const resolved = await FieldResolver.resolveFieldWithCommonAliases(schema, 'price');
const price = FieldResolver.getFieldValue(product, resolved);
```

**That's it!** The system handles everything else automatically. 🎉


