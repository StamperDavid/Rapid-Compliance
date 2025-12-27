# Schema Adaptability System - Design Decisions & Options

## Question 1: Should field resolution be synchronous or async?

### **What This Means**

When your code needs to find a field (e.g., "price"), should it:
- **Synchronous:** Return immediately from memory/cache (like `FieldResolver.resolveFieldSync(schema, 'price')`)
- **Asynchronous:** Query database/perform lookups (like `await FieldResolver.resolveField(schema, 'price')`)

### **Current Implementation: Async**

I made it async because field resolution might need to:
1. Look up schemas from Firestore
2. Check field mapping configurations
3. Query integration settings

### **Options & Trade-offs**

| Option | Pros | Cons | When to Use |
|--------|------|------|-------------|
| **Async (current)** | - Can fetch data from database<br>- More flexible for future features<br>- Can perform complex lookups | - Requires `await` everywhere<br>- Slightly more verbose code | When schema isn't already in memory |
| **Sync** | - Cleaner code (no await)<br>- Faster execution<br>- Simpler to understand | - Schema must be pre-loaded<br>- Can't fetch additional data<br>- Limited flexibility | When schema is already loaded |
| **Hybrid** | - Best of both worlds<br>- `resolveField()` = async<br>- `resolveFieldSync()` = sync | - Two methods to maintain<br>- Developers must choose | Most flexible approach |

### **My Recommendation: Keep Async (but add sync option)**

```typescript
// Current (async) - use when schema needs to be fetched
const resolved = await FieldResolver.resolveField(schema, 'price');

// Add this (sync) - use when schema is already in memory
const resolved = FieldResolver.resolveFieldSync(schema, 'price');
```

**Why:** Most use cases already have the schema loaded, so we can add a sync version for convenience while keeping async for flexibility.

---

## Question 2: How to handle field type changes (text → currency)?

### **What This Means**

When a user changes a field from `text` to `currency` (or any type change), what should happen to:
1. Existing data in that field
2. Workflows using that field
3. Integrations syncing that field

### **The Problem**

```typescript
// Before: field is 'text'
product.price = "One hundred dollars";

// User changes field type to 'currency'
// What happens to existing data?
product.price = "One hundred dollars"; // ❌ Not a number!
```

### **Options**

#### **Option 1: No Automatic Conversion (Current Implementation)**
**What happens:**
- Field type changes
- Existing data stays as-is
- Warning logged
- User notified to review data

**Pros:**
- Safe (no data loss)
- User controls migration
- No assumptions about data

**Cons:**
- Data might be invalid
- User must manually fix data
- Workflows might fail on invalid data

**Code:**
```typescript
// Just log a warning
logger.warn('Field type changed from text to currency - manual data review needed');
```

---

#### **Option 2: Automatic Conversion with Validation**
**What happens:**
- System attempts to convert existing data
- If conversion fails, marks record for review
- User gets report of failed conversions

**Pros:**
- Most data automatically converted
- Reduces manual work
- Smart migration

**Cons:**
- Complex logic needed
- Risk of data corruption
- Some conversions are ambiguous

**Code:**
```typescript
async function convertFieldType(
  records: any[],
  fieldKey: string,
  oldType: FieldType,
  newType: FieldType
) {
  const conversions = {
    'text_to_currency': (value: string) => {
      // Extract numbers from text
      const numbers = value.replace(/[^0-9.]/g, '');
      return parseFloat(numbers) || null;
    },
    'text_to_number': (value: string) => parseFloat(value) || null,
    'number_to_text': (value: number) => String(value),
    'currency_to_number': (value: number) => value,
  };
  
  const conversionKey = `${oldType}_to_${newType}`;
  const converter = conversions[conversionKey];
  
  if (!converter) {
    return { success: false, message: 'No automatic conversion available' };
  }
  
  const results = {
    successful: 0,
    failed: 0,
    failedRecords: []
  };
  
  for (const record of records) {
    try {
      const oldValue = record[fieldKey];
      const newValue = converter(oldValue);
      
      if (newValue !== null) {
        record[fieldKey] = newValue;
        results.successful++;
      } else {
        results.failed++;
        results.failedRecords.push(record.id);
      }
    } catch (error) {
      results.failed++;
      results.failedRecords.push(record.id);
    }
  }
  
  return results;
}
```

---

#### **Option 3: Migration Preview with User Approval**
**What happens:**
- System analyzes existing data
- Shows preview of how data will be converted
- User approves or rejects migration
- Only proceeds if user approves

**Pros:**
- User sees exactly what will happen
- No surprises
- User can fix data first

**Cons:**
- Requires UI for preview
- User must take action
- Blocks the type change until approved

**UI Example:**
```typescript
// Migration Preview Modal
{
  "fieldName": "price",
  "oldType": "text",
  "newType": "currency",
  "affectedRecords": 150,
  "conversionPreview": [
    { "before": "One hundred", "after": null, "status": "fail" },
    { "before": "$100.00", "after": 100.00, "status": "success" },
    { "before": "100", "after": 100.00, "status": "success" }
  ],
  "successRate": "66% (100/150 records)",
  "action": "approve_or_reject"
}
```

---

#### **Option 4: Type-Compatible Validation Only**
**What happens:**
- System checks if types are "compatible"
- If compatible (e.g., number → currency), allow change
- If incompatible (e.g., text → currency), require data cleanup first

**Pros:**
- Prevents broken data
- Simple rules
- Safe

**Cons:**
- Blocks useful migrations
- User might want text → currency
- Inflexible

**Type Compatibility Matrix:**
```typescript
const compatibleTypes = {
  'text': ['longText', 'email', 'url'],
  'number': ['currency', 'percent'],
  'currency': ['number'],
  'date': ['dateTime'],
  'singleSelect': ['multiSelect'],
};

function areTypesCompatible(oldType: FieldType, newType: FieldType): boolean {
  return compatibleTypes[oldType]?.includes(newType) || oldType === newType;
}
```

---

### **My Recommendation: Hybrid Approach**

**Implement Option 2 + Option 3:**

1. **For compatible types** (number → currency): Auto-convert
2. **For complex types** (text → currency): Show preview, require approval
3. **Always** create backup before conversion
4. **Always** provide rollback option

**Implementation:**
```typescript
async function handleFieldTypeChange(event: SchemaChangeEvent) {
  const { oldFieldType, newFieldType } = event;
  
  // Check if types are "safe" to auto-convert
  if (isSafeConversion(oldFieldType, newFieldType)) {
    // Auto-convert (e.g., number → currency)
    await autoConvertFieldType(event);
    return;
  }
  
  // Complex conversion - require user approval
  const preview = await generateConversionPreview(event);
  
  // Create notification with preview
  await createTypeChangeNotification({
    preview,
    requiresApproval: true,
    onApprove: () => convertFieldType(event),
    onReject: () => revertTypeChange(event)
  });
}
```

---

## Question 3: Should we maintain field rename history for rollback?

### **Your Answer: Yes**

Great! Let me explain implementation options.

### **Why This Matters**

If a user accidentally renames a field, they should be able to:
1. See the rename history
2. Rollback to previous name
3. Understand what changed and when

### **Implementation Options**

#### **Option 1: Event Log Only (Current Implementation)**
**What we have:**
```typescript
// Schema change events already track renames
{
  changeType: 'field_renamed',
  oldFieldKey: 'price',
  newFieldKey: 'hourly_rate',
  timestamp: '2024-01-15T10:30:00Z'
}
```

**Pros:**
- Already implemented
- Can reconstruct history from events
- Minimal storage

**Cons:**
- Must query events to get history
- No direct "rename chain"
- Harder to rollback

---

#### **Option 2: Field Rename History Array (Recommended)**

Add a `renameHistory` array to each field:

```typescript
interface SchemaField {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  // ... other properties
  
  // NEW: Rename history
  renameHistory?: FieldRenameRecord[];
}

interface FieldRenameRecord {
  timestamp: Timestamp;
  oldKey: string;
  newKey: string;
  oldLabel: string;
  newLabel: string;
  renamedBy: string; // User who made the change
  reason?: string; // Optional user note
}
```

**Example:**
```typescript
{
  id: 'field_123',
  key: 'hourly_rate', // Current name
  label: 'Hourly Rate',
  type: 'currency',
  renameHistory: [
    {
      timestamp: '2024-01-01T10:00:00Z',
      oldKey: 'price',
      newKey: 'cost',
      oldLabel: 'Price',
      newLabel: 'Cost',
      renamedBy: 'user_abc'
    },
    {
      timestamp: '2024-01-15T10:30:00Z',
      oldKey: 'cost',
      newKey: 'hourly_rate',
      oldLabel: 'Cost',
      newLabel: 'Hourly Rate',
      renamedBy: 'user_abc'
    }
  ]
}
```

**Rollback Function:**
```typescript
async function rollbackFieldRename(
  schemaId: string,
  fieldId: string,
  toVersion: number // Index in renameHistory
) {
  const schema = await getSchema(schemaId);
  const field = schema.fields.find(f => f.id === fieldId);
  
  if (!field || !field.renameHistory) {
    throw new Error('No rename history found');
  }
  
  const targetRename = field.renameHistory[toVersion];
  
  // Rollback to old name
  await updateField(schemaId, fieldId, {
    key: targetRename.oldKey,
    label: targetRename.oldLabel
  });
  
  // Add rollback record to history
  field.renameHistory.push({
    timestamp: Timestamp.now(),
    oldKey: field.key,
    newKey: targetRename.oldKey,
    oldLabel: field.label,
    newLabel: targetRename.oldLabel,
    renamedBy: 'system',
    reason: `Rollback to version ${toVersion}`
  });
}
```

---

#### **Option 3: Separate Rename History Collection**

Store rename history in a separate Firestore collection:

```
/organizations/{orgId}/workspaces/{wsId}/fieldRenameHistory/{historyId}
```

**Document:**
```typescript
{
  id: 'history_123',
  schemaId: 'schema_products',
  fieldId: 'field_price',
  changes: [
    { timestamp: '...', oldKey: 'price', newKey: 'cost' },
    { timestamp: '...', oldKey: 'cost', newKey: 'hourly_rate' }
  ]
}
```

**Pros:**
- Doesn't bloat schema document
- Easy to query all renames
- Can add metadata

**Cons:**
- Extra collection to manage
- More queries needed
- Could get out of sync

---

### **My Recommendation: Option 2 (Field-Level History)**

**Why:**
- History stays with the field
- Easy to access
- Simple rollback
- No sync issues

**Implementation:**

```typescript
// Add to schema-manager.ts
async updateField(
  schemaId: string,
  fieldId: string,
  updates: Partial<SchemaField>,
  userId: string
): Promise<void> {
  const schema = await this.getSchema(schemaId);
  const fieldIndex = schema.fields.findIndex(f => f.id === fieldId);
  const currentField = schema.fields[fieldIndex];
  
  // Track rename
  if (updates.key && updates.key !== currentField.key) {
    const renameHistory = currentField.renameHistory || [];
    renameHistory.push({
      timestamp: Timestamp.now(),
      oldKey: currentField.key,
      newKey: updates.key,
      oldLabel: currentField.label,
      newLabel: updates.label || currentField.label,
      renamedBy: userId
    });
    updates.renameHistory = renameHistory;
  }
  
  // Update field
  const updatedFields = [...schema.fields];
  updatedFields[fieldIndex] = {
    ...currentField,
    ...updates,
    updatedAt: Timestamp.now()
  };
  
  await this.updateSchema(schemaId, { fields: updatedFields }, userId);
}
```

---

## Question 4: How to batch schema changes to avoid multiple recompilations?

### **What This Means**

**Problem Scenario:**
```typescript
// User makes 5 field changes in quick succession
await updateField(schemaId, 'field1', { key: 'new_name_1' });  // Triggers AI recompile
await updateField(schemaId, 'field2', { key: 'new_name_2' });  // Triggers AI recompile again
await updateField(schemaId, 'field3', { key: 'new_name_3' });  // And again...
await updateField(schemaId, 'field4', { key: 'new_name_4' });  // And again...
await updateField(schemaId, 'field5', { key: 'new_name_5' });  // And again...

// AI agent knowledge recompiled 5 times! Wasteful!
```

### **Options**

#### **Option 1: Debounced Event Processing (Recommended)**

**How it works:**
- Collect events for X seconds
- Process all events together in one batch
- AI agent recompiled only once

**Implementation:**
```typescript
class SchemaChangeDebouncer {
  private pendingEvents: Map<string, SchemaChangeEvent[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private debounceMs = 5000; // 5 seconds
  
  async addEvent(event: SchemaChangeEvent) {
    const key = `${event.organizationId}:${event.schemaId}`;
    
    // Add event to pending list
    const events = this.pendingEvents.get(key) || [];
    events.push(event);
    this.pendingEvents.set(key, events);
    
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      this.processBatch(key);
    }, this.debounceMs);
    
    this.timers.set(key, timer);
  }
  
  private async processBatch(key: string) {
    const events = this.pendingEvents.get(key) || [];
    
    if (events.length === 0) return;
    
    logger.info(`Processing ${events.length} batched events for ${key}`);
    
    // Process all events together
    await processSchemaChangeEventBatch(events);
    
    // Clear
    this.pendingEvents.delete(key);
    this.timers.delete(key);
  }
}

// Usage
const debouncer = new SchemaChangeDebouncer();

// In schema-manager.ts
await debouncer.addEvent(event); // Instead of immediate processing
```

**Result:**
```
User makes 5 changes in 3 seconds
  ↓
Debouncer waits 5 seconds after last change
  ↓
Process all 5 events together
  ↓
AI agent recompiled ONCE
```

---

#### **Option 2: Manual Batch API**

**How it works:**
- User explicitly creates a "batch update"
- All changes grouped together
- Single event published at end

**Implementation:**
```typescript
class SchemaBatchUpdater {
  private changes: SchemaChange[] = [];
  
  // User creates batch
  startBatch() {
    this.changes = [];
  }
  
  // User adds changes
  queueFieldUpdate(fieldId: string, updates: any) {
    this.changes.push({ type: 'field_update', fieldId, updates });
  }
  
  queueFieldAdd(field: SchemaField) {
    this.changes.push({ type: 'field_add', field });
  }
  
  // User commits all changes at once
  async commitBatch(schemaId: string, userId: string) {
    // Apply all changes
    for (const change of this.changes) {
      await this.applyChange(change);
    }
    
    // Publish single event
    await publishSchemaChangeEvent({
      changeType: 'batch_update',
      changes: this.changes,
      schemaId
    });
    
    // Clear batch
    this.changes = [];
  }
}

// Usage
const batch = new SchemaBatchUpdater();
batch.startBatch();
batch.queueFieldUpdate('field1', { key: 'new_name_1' });
batch.queueFieldUpdate('field2', { key: 'new_name_2' });
batch.queueFieldUpdate('field3', { key: 'new_name_3' });
await batch.commitBatch(schemaId, userId); // Single recompile
```

---

#### **Option 3: Smart Coalescing**

**How it works:**
- Events published immediately
- Handler deduplicates events
- Only processes unique changes

**Implementation:**
```typescript
async function processSchemaChangeEvents(
  organizationId: string,
  timeWindowMinutes: number = 5
) {
  // Get recent unprocessed events
  const events = await getUnprocessedEvents(organizationId);
  
  // Group by schema
  const bySchema = new Map<string, SchemaChangeEvent[]>();
  
  for (const event of events) {
    const key = event.schemaId;
    const schemaEvents = bySchema.get(key) || [];
    schemaEvents.push(event);
    bySchema.set(key, schemaEvents);
  }
  
  // Process each schema's events together
  for (const [schemaId, schemaEvents] of bySchema) {
    // Coalesce events (merge multiple field renames, etc.)
    const coalesced = coalesceEvents(schemaEvents);
    
    // Process once
    await processCoalescedEvents(coalesced);
    
    // Mark all as processed
    for (const event of schemaEvents) {
      await markEventProcessed(event.id);
    }
  }
}

function coalesceEvents(events: SchemaChangeEvent[]): SchemaChangeEvent[] {
  const coalesced = new Map<string, SchemaChangeEvent>();
  
  for (const event of events) {
    const key = `${event.changeType}:${event.fieldId}`;
    
    // If same field renamed multiple times, keep only latest
    if (event.changeType === 'field_renamed') {
      coalesced.set(key, event);
    } else {
      coalesced.set(key, event);
    }
  }
  
  return Array.from(coalesced.values());
}
```

---

#### **Option 4: Transaction-Based Updates**

**How it works:**
- Schema updates wrapped in transaction
- All changes atomic
- Single event at transaction commit

**Implementation:**
```typescript
async function updateSchemaTransaction(
  schemaId: string,
  changes: SchemaChange[]
) {
  await runTransaction(db, async (transaction) => {
    const schemaRef = getSchemaRef(schemaId);
    const schema = await transaction.get(schemaRef);
    
    // Apply all changes
    let updatedSchema = schema.data();
    for (const change of changes) {
      updatedSchema = applyChange(updatedSchema, change);
    }
    
    // Write once
    transaction.update(schemaRef, updatedSchema);
    
    // Publish single event
    await publishSchemaChangeEvent({
      changeType: 'bulk_update',
      changes,
      schemaId
    });
  });
}
```

---

### **My Recommendation: Option 1 (Debounced) + Option 2 (Manual Batch)**

**Why:**
- Debounced handles accidental rapid changes automatically
- Manual batch gives users control for intentional bulk updates
- Best of both worlds

**Implementation:**
```typescript
// Automatic debouncing for UI-driven changes
SchemaChangeHandler.setDebounceMs(5000); // 5 seconds

// Manual batching for API/bulk operations
const batch = new SchemaBatchUpdater();
batch.startBatch();
// ... add changes ...
await batch.commitBatch();
```

---

## Question 5: What's the UX when auto-fix isn't possible?

### **Scenarios Where Auto-Fix Fails**

1. **Field deleted** - Can't find replacement
2. **Field type changed incompatibly** - Can't convert data
3. **Multiple fields match** - Ambiguous resolution
4. **Integration requires manual mapping** - No defaults available

### **UX Options**

#### **Option 1: Notification Center (Current Implementation)**

**What happens:**
- System creates notification
- User sees in notification dropdown
- Click to view details

**Example:**
```typescript
{
  title: "Workflow May Need Attention",
  message: "Field 'price' was deleted. Workflow 'Create Quote' references this field.",
  type: "warning",
  actions: [
    { label: "Review Workflow", url: "/workflows/wf_123" },
    { label: "Dismiss", action: "dismiss" }
  ]
}
```

**Pros:**
- Non-intrusive
- User can handle later
- Central notification system

**Cons:**
- Easy to miss
- User might not notice
- No immediate action

---

#### **Option 2: Blocking Modal**

**What happens:**
- Schema change paused
- Modal appears immediately
- User must resolve before continuing

**Example:**
```typescript
// Modal appears during schema update
{
  title: "⚠️ Cannot Delete Field",
  message: "The field 'price' is used by:",
  affectedItems: [
    "Workflow: Create Quote (3 actions)",
    "E-Commerce: Product pricing",
    "Integration: Salesforce sync"
  ],
  options: [
    {
      label: "Cancel Deletion",
      action: "cancel"
    },
    {
      label: "Delete Anyway (May Break Workflows)",
      action: "force_delete",
      dangerous: true
    },
    {
      label: "Help Me Fix",
      action: "show_wizard"
    }
  ]
}
```

**Pros:**
- User can't miss it
- Immediate awareness
- Prevents breaking changes

**Cons:**
- Interrupts workflow
- Annoying for minor issues
- Might block legitimate changes

---

#### **Option 3: Wizard/Guided Fix**

**What happens:**
- System detects issue
- Launches step-by-step wizard
- Helps user resolve conflicts

**Example:**
```typescript
// Step 1: Show Impact
"You're deleting field 'price' which is used by 3 workflows."

// Step 2: Offer Solutions
"What would you like to do?"
  - Replace with different field: [Select Field ▼]
  - Disable affected workflows
  - Delete field anyway

// Step 3: Preview Changes
"If you choose 'hourly_rate':
  ✓ Workflow 'Create Quote' will use 'hourly_rate'
  ✓ E-Commerce will use 'hourly_rate'
  ⚠️ Salesforce integration needs manual update"

// Step 4: Confirm
[Cancel] [Apply Changes]
```

**Pros:**
- Educational
- Helps user understand impact
- Guides to solution

**Cons:**
- Time-consuming
- Might be overkill
- More complex to build

---

#### **Option 4: Preview Mode with Rollback**

**What happens:**
- Change applied immediately
- "Preview" banner shown
- 30-second rollback window

**Example:**
```typescript
// Banner at top of screen
┌─────────────────────────────────────────────────┐
│ ⚠️ Field 'price' deleted                        │
│                                                  │
│ 3 workflows may be affected                     │
│                                                  │
│ [Undo] [Keep Changes] [View Details]            │
│                                                  │
│ Auto-save in 30 seconds...                      │
└─────────────────────────────────────────────────┘
```

**Pros:**
- Fast iteration
- Easy to undo
- Non-blocking

**Cons:**
- Changes might propagate
- Confusion about state
- Race conditions possible

---

#### **Option 5: Issues Dashboard**

**What happens:**
- Changes proceed
- Issues logged to dashboard
- User reviews at their convenience

**Example:**
```typescript
// Dashboard shows:
Schema Issues (3 unresolved)
┌──────────────────────────────────────────────────────────┐
│ High Priority                                            │
│ ⚠️ Field 'price' deleted                                 │
│    Affects: 3 workflows, 1 integration                   │
│    [Fix Now] [Ignore]                                    │
├──────────────────────────────────────────────────────────┤
│ Medium Priority                                          │
│ ⚠️ Workflow 'Create Quote' references unknown field      │
│    Field 'old_price' not found                           │
│    [Update Workflow] [Ignore]                            │
├──────────────────────────────────────────────────────────┤
│ Low Priority                                             │
│ ℹ️ Integration mapping outdated                          │
│    Salesforce sync needs field mapping update            │
│    [Configure] [Dismiss]                                 │
└──────────────────────────────────────────────────────────┘
```

**Pros:**
- Doesn't interrupt user
- Clear overview of all issues
- Prioritized list

**Cons:**
- User might not check
- Issues accumulate
- Delayed resolution

---

### **My Recommendation: Hybrid Approach**

Use different UX based on severity:

**1. Critical (Blocks Functionality)**
- Use **Blocking Modal** (Option 2)
- Examples:
  - Deleting field used by active workflows
  - Type change that breaks integrations

**2. High Priority (Should Fix Soon)**
- Use **Wizard** (Option 3)
- Examples:
  - Field rename affecting e-commerce
  - Integration mapping needs update

**3. Medium Priority (Fix When Convenient)**
- Use **Notification** (Option 1) + **Issues Dashboard** (Option 5)
- Examples:
  - Workflow has warning
  - Low-confidence field match

**4. Low Priority (Informational)**
- Use **Issues Dashboard** (Option 5) only
- Examples:
  - Field added (positive change)
  - Schema description updated

---

## Implementation Summary

Based on your feedback, here's what I recommend implementing:

### **1. Field Resolution: Add Sync Option**
```typescript
// Add to field-resolver.ts
static resolveFieldSync(schema: Schema, fieldReference: string): ResolvedField | null {
  // Same logic but synchronous
}
```

### **2. Field Type Changes: Hybrid Approach**
```typescript
// Add to schema-change-handler.ts
async handleFieldTypeChange(event: SchemaChangeEvent) {
  if (isSafeConversion(event.oldFieldType, event.newFieldType)) {
    await autoConvertFieldType(event);
  } else {
    await showConversionPreviewModal(event);
  }
}
```

### **3. Field Rename History: Add to Schema**
```typescript
// Add to schema.ts types
interface SchemaField {
  // ... existing properties
  renameHistory?: FieldRenameRecord[];
}

// Add rollback function
async rollbackFieldRename(schemaId, fieldId, toVersion) { ... }
```

### **4. Batch Changes: Debounced + Manual**
```typescript
// Add to schema-change-handler.ts
const debouncer = new SchemaChangeDebouncer(5000); // 5 sec debounce

// Add manual batch API
class SchemaBatchUpdater { ... }
```

### **5. UX for Auto-Fix Failures: Severity-Based**
```typescript
// Add to schema-change-handler.ts
async handleAutoFixFailure(event: SchemaChangeEvent) {
  const severity = assessSeverity(event);
  
  switch (severity) {
    case 'critical':
      await showBlockingModal(event);
      break;
    case 'high':
      await launchWizard(event);
      break;
    case 'medium':
      await createNotification(event);
      await addToIssuesDashboard(event);
      break;
    case 'low':
      await addToIssuesDashboard(event);
      break;
  }
}
```

---

Would you like me to implement any of these enhancements now?


