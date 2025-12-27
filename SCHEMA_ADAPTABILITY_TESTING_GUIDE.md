# Schema Adaptability System - Testing Guide

## **How to Test Everything Works Properly**

This guide shows you **exactly** how to verify each piece is connected and working.

---

## 🚀 **Quick Smoke Test (5 minutes)**

### **Test 1: Basic Field Rename**

**What to do:**
```bash
# 1. Start your dev server
npm run dev

# 2. Open browser console (F12)
# 3. Navigate to a schema in your app
# 4. Rename a field (change "price" to "cost")
```

**What to check:**
```javascript
// Check Firestore in browser console or Firebase Console
// Look for: /organizations/{orgId}/schemaChangeEvents

// You should see a new event like:
{
  changeType: "field_renamed",
  oldFieldKey: "price",
  newFieldKey: "cost",
  timestamp: "...",
  processed: false  // Will be true after 5 seconds
}
```

**✅ Success if:**
- Event appears in Firestore
- After 5 seconds, `processed` becomes `true`
- No errors in console

---

### **Test 2: Rename History Tracking**

**What to do:**
```bash
# 1. Rename a field again
# 2. Check the field document in Firestore
```

**What to check:**
```javascript
// In Firestore: /organizations/{orgId}/workspaces/{wsId}/schemas/{schemaId}
// Look at the field you renamed

// Should see:
{
  key: "cost",
  label: "Cost",
  renameHistory: [    // ← NEW FIELD!
    {
      oldKey: "price",
      newKey: "cost",
      oldLabel: "Price",
      newLabel: "Cost",
      renamedBy: "user_123",
      timestamp: "..."
    }
  ]
}
```

**✅ Success if:**
- `renameHistory` array exists
- Contains the rename record
- Timestamp is accurate

---

### **Test 3: Debouncer Working**

**What to do:**
```bash
# 1. Rename the same field 3 times rapidly (within 5 seconds):
#    - price → cost
#    - cost → rate  
#    - rate → hourly_rate

# 2. Watch the browser console
```

**What to check:**
```javascript
// In browser console, look for logs:
"[Schema Change Debouncer] Event queued"
"[Schema Change Debouncer] Event queued"
"[Schema Change Debouncer] Event queued"

// Wait 5 seconds...

"[Schema Change Debouncer] Processing batch"
"[Schema Change Debouncer] Events coalesced"
// Should show: original: 3, coalesced: 1

"[Schema Change Debouncer] Batch processing complete"
```

**✅ Success if:**
- Events are queued (not immediately processed)
- After 5 seconds, batch processes
- 3 events coalesced into 1
- No errors

---

## 🧪 **Detailed Feature Testing**

### **Test 4: Field Rename History API**

**Step 1: Create rename history**
```bash
# In your app, rename a field multiple times:
# price → cost → rate → hourly_rate
```

**Step 2: Test GET endpoint**
```bash
curl "http://localhost:3000/api/schema/schema_123/field/field_456/rename-history?organizationId=org_123&workspaceId=ws_123"
```

**Expected response:**
```json
{
  "success": true,
  "field": {
    "id": "field_456",
    "currentKey": "hourly_rate",
    "currentLabel": "Hourly Rate"
  },
  "history": [
    {
      "oldKey": "price",
      "newKey": "cost",
      "oldLabel": "Price",
      "newLabel": "Cost",
      "timestamp": "..."
    },
    {
      "oldKey": "cost",
      "newKey": "rate",
      "oldLabel": "Cost",
      "newLabel": "Rate",
      "timestamp": "..."
    },
    {
      "oldKey": "rate",
      "newKey": "hourly_rate",
      "oldLabel": "Rate",
      "newLabel": "Hourly Rate",
      "timestamp": "..."
    }
  ],
  "timeline": [
    { "version": 0, "key": "cost", ... },
    { "version": 1, "key": "rate", ... },
    { "version": 2, "key": "hourly_rate", ... }
  ],
  "aliases": ["price", "cost", "rate", "hourly_rate"]
}
```

**Step 3: Test Rollback**
```bash
curl -X POST "http://localhost:3000/api/schema/schema_123/field/field_456/rename-history" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org_123",
    "workspaceId": "ws_123",
    "toVersion": 0,
    "userId": "user_123"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "message": "Field rolled back to version 0"
}
```

**Step 4: Verify rollback worked**
```bash
# Check Firestore - field should now be "cost" again
# Check rename history - should have new entry for rollback
```

**✅ Success if:**
- GET returns complete history
- POST successfully rolls back
- Field key actually changes in Firestore
- New rollback entry added to history

---

### **Test 5: Type Conversion Preview API**

**Step 1: Create test data**
```bash
# In Firestore, create a few product records with text prices:
{
  id: "product_1",
  name: "Widget",
  price: "$100.00"  # ← text field
}
{
  id: "product_2",
  name: "Gadget",
  price: "free"  # ← will fail conversion
}
{
  id: "product_3",
  name: "Thing",
  price: "50"  # ← will succeed
}
```

**Step 2: Test preview endpoint**
```bash
curl "http://localhost:3000/api/schema/schema_products/field/field_price/convert-type?organizationId=org_123&workspaceId=ws_123&fieldKey=price&oldType=text&newType=currency"
```

**Expected response:**
```json
{
  "success": true,
  "isSafe": false,
  "preview": [
    {
      "recordId": "product_1",
      "before": "$100.00",
      "after": 100.00,
      "status": "success"
    },
    {
      "recordId": "product_2",
      "before": "free",
      "after": null,
      "status": "fail",
      "message": "Could not extract number"
    },
    {
      "recordId": "product_3",
      "before": "50",
      "after": 50.00,
      "status": "success"
    }
  ],
  "totalRecords": 3,
  "estimatedSuccess": 2,
  "estimatedFailures": 1,
  "successRate": 66
}
```

**Step 3: Test conversion**
```bash
curl -X POST "http://localhost:3000/api/schema/schema_products/field/field_price/convert-type" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org_123",
    "workspaceId": "ws_123",
    "fieldKey": "price",
    "oldType": "text",
    "newType": "currency"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "successful": 2,
  "failed": 1,
  "failedRecords": [
    {
      "recordId": "product_2",
      "oldValue": "free",
      "error": "Could not extract number"
    }
  ],
  "message": "Converted 2 records successfully, 1 failed"
}
```

**Step 4: Verify in Firestore**
```bash
# Check products in Firestore:
# product_1.price should now be: 100.00 (number)
# product_2.price should be: null or "free" (failed)
# product_3.price should now be: 50.00 (number)
```

**✅ Success if:**
- Preview generates correct estimates
- Conversion actually changes data
- Failed records are tracked
- Success/failure counts are accurate

---

### **Test 6: Debouncer Control API**

**Step 1: Check status**
```bash
curl "http://localhost:3000/api/schema-debouncer"
```

**Expected response:**
```json
{
  "success": true,
  "debounceMs": 5000,
  "pendingCount": 0
}
```

**Step 2: Make some changes**
```bash
# Rename a few fields quickly
# Don't wait 5 seconds
```

**Step 3: Check status again**
```bash
curl "http://localhost:3000/api/schema-debouncer"
```

**Expected response:**
```json
{
  "success": true,
  "debounceMs": 5000,
  "pendingCount": 3  # ← Shows pending events
}
```

**Step 4: Force flush**
```bash
curl -X POST "http://localhost:3000/api/schema-debouncer" \
  -H "Content-Type: application/json" \
  -d '{ "action": "flush" }'
```

**Expected response:**
```json
{
  "success": true,
  "message": "All pending events flushed"
}
```

**Step 5: Verify events processed**
```bash
# Check Firestore - events should now be processed: true
```

**✅ Success if:**
- Status shows pending count
- Flush processes events immediately
- Events marked as processed

---

## 🎨 **UI Component Testing**

### **Test 7: FieldRenameHistory Component**

**Step 1: Create a test page**
```typescript
// Create: src/app/test-rename-history/page.tsx

'use client';

import FieldRenameHistory from '@/components/FieldRenameHistory';

export default function TestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Rename History Test</h1>
      <FieldRenameHistory
        organizationId="org_your_test_org"
        workspaceId="ws_your_test_workspace"
        schemaId="schema_products"
        fieldId="field_price"
        userId="user_your_test_user"
        onRollback={() => alert('Rolled back!')}
      />
    </div>
  );
}
```

**Step 2: Navigate to test page**
```bash
# Open: http://localhost:3000/test-rename-history
```

**What to check:**
- [ ] Shows current field info
- [ ] Displays all aliases
- [ ] Timeline shows all versions
- [ ] Each version has a "Rollback" button
- [ ] History table shows changes
- [ ] Timestamps are formatted correctly

**Step 3: Test rollback**
```bash
# Click "Rollback" button on an old version
# Should see confirmation dialog
# Click OK
# Should see "Rolled back!" alert
# Page should reload with new data
```

**✅ Success if:**
- Component renders without errors
- Data loads correctly
- Rollback button works
- Alert fires on rollback
- Data updates after rollback

---

### **Test 8: FieldTypeConversionPreview Component**

**Step 1: Create test page**
```typescript
// Create: src/app/test-type-conversion/page.tsx

'use client';

import FieldTypeConversionPreview from '@/components/FieldTypeConversionPreview';

export default function TestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Type Conversion Test</h1>
      <FieldTypeConversionPreview
        organizationId="org_your_test_org"
        workspaceId="ws_your_test_workspace"
        schemaId="schema_products"
        fieldId="field_price"
        fieldKey="price"
        fieldLabel="Price"
        oldType="text"
        newType="currency"
        onApprove={() => alert('Approved!')}
        onCancel={() => alert('Cancelled')}
      />
    </div>
  );
}
```

**Step 2: Navigate to test page**
```bash
# Open: http://localhost:3000/test-type-conversion
```

**What to check:**
- [ ] Shows safe/complex indicator
- [ ] Displays statistics (total, success, failures, rate)
- [ ] Preview table shows samples
- [ ] Before/after values correct
- [ ] Success rate color-coded (green/yellow/red)
- [ ] Warning shown if low success rate
- [ ] Convert button enabled

**Step 3: Test conversion**
```bash
# Click "Convert X Records" button
# Should see confirmation dialog
# Click OK
# Should see "Converting..." state
# After completion, shows results
# Shows "Approved!" alert
```

**✅ Success if:**
- Component renders correctly
- Preview loads successfully
- Statistics are accurate
- Conversion works
- Results displayed properly
- Alert fires on approve

---

## 🔍 **End-to-End Testing**

### **Test 9: Complete Schema Change Flow**

**Scenario:** Rename a field and verify entire system adapts

**Step 1: Initial state**
```bash
# 1. Create a workflow that uses field "price"
# 2. Set up e-commerce with "price" field mapping
# 3. Create AI agent that knows about "price"
```

**Step 2: Rename field**
```bash
# In your app, rename "price" to "hourly_rate"
```

**Step 3: Watch logs**
```bash
# In browser console, you should see:

"[Schema Manager] Failed to detect/publish changes:" 
# OR
"[Schema Change Debouncer] Event queued"
# (After 5 seconds)
"[Schema Change Debouncer] Processing batch"
"[Schema Change Handler] Processing event"
"[Schema Change UX] Handling schema change"
"[Schema Change Handler] Event processed successfully"
```

**Step 4: Check what happened**

**A. Check Firestore for event:**
```javascript
// /organizations/{orgId}/schemaChangeEvents/{eventId}
{
  changeType: "field_renamed",
  oldFieldKey: "price",
  newFieldKey: "hourly_rate",
  processed: true,
  affectedSystems: [...]
}
```

**B. Check field has rename history:**
```javascript
// Schema field should have:
{
  key: "hourly_rate",
  renameHistory: [
    {
      oldKey: "price",
      newKey: "hourly_rate",
      ...
    }
  ]
}
```

**C. Check severity was assessed:**
```javascript
// /organizations/{orgId}/schemaIssues/{issueId}
{
  severity: "medium",
  title: "field_renamed: Price",
  description: "Field renamed from 'price' to 'hourly_rate'..."
}
```

**D. Check workflows still work:**
```bash
# Run your workflow that referenced "price"
# Should still work because field resolver finds "hourly_rate"
```

**✅ Success if:**
- Event created and processed
- Rename history tracked
- Severity assessed
- Issue added to dashboard
- Workflows still function
- Field resolver finds renamed field

---

## 🐛 **Debugging Guide**

### **Problem: Events not being created**

**Check:**
```javascript
// In schema-manager.ts, add console.log:
console.log('Events detected:', events);
console.log('Debouncer instance:', debouncer);
```

**Common causes:**
- organizationId not found
- Schema update failed before event detection
- Import error in detectAndPublishChanges

---

### **Problem: Events created but not processed**

**Check:**
```javascript
// Check debouncer status:
const response = await fetch('/api/schema-debouncer');
console.log(await response.json());
// Look at pendingCount
```

**Common causes:**
- Debouncer timer not firing
- Error in processSchemaChangeEvent
- Missing await on async function

**Fix:**
```bash
# Force flush to process immediately:
curl -X POST "http://localhost:3000/api/schema-debouncer" \
  -H "Content-Type: application/json" \
  -d '{ "action": "flush" }'
```

---

### **Problem: Rename history not saving**

**Check:**
```javascript
// In schema-manager.ts updateField(), add:
console.log('Current field:', currentField);
console.log('Updates:', updates);
console.log('Updated field with history:', updatedField);
```

**Common causes:**
- FieldRenameManager import failing
- Updates not including renameHistory
- Firestore write failing

---

### **Problem: Type conversion not working**

**Check:**
```javascript
// Test the converter directly:
import { FieldTypeConverter } from '@/lib/schema/field-type-converter';

const isSafe = FieldTypeConverter.isSafeConversion('text', 'currency');
console.log('Is safe:', isSafe);
```

**Common causes:**
- Field type strings don't match exactly
- Schema or records not found
- Conversion logic error

---

### **Problem: UI components not loading data**

**Check browser console:**
```javascript
// Look for fetch errors:
// "Failed to load rename history"
// "Failed to load conversion preview"
```

**Common causes:**
- Wrong organizationId/workspaceId/schemaId
- API endpoint not found (404)
- CORS issues
- Missing await in API route

**Fix:**
```bash
# Test API directly in browser:
# Open: http://localhost:3000/api/schema/schema_123/field/field_456/rename-history?organizationId=org_123&workspaceId=ws_123

# Should return JSON, not 404
```

---

## ✅ **Final Verification Checklist**

Run through this checklist to confirm everything works:

### **Backend:**
- [ ] Schema changes create events in Firestore
- [ ] Events go through debouncer (5-second wait)
- [ ] Events get processed after debounce
- [ ] Rename history automatically tracked
- [ ] Type changes trigger converter
- [ ] Severity assessed for each change

### **APIs:**
- [ ] GET rename-history returns data
- [ ] POST rename-history rolls back field
- [ ] GET convert-type returns preview
- [ ] POST convert-type performs conversion
- [ ] GET schema-debouncer returns status
- [ ] POST schema-debouncer controls debouncer

### **UI:**
- [ ] FieldRenameHistory loads without errors
- [ ] Shows timeline and history table
- [ ] Rollback button works
- [ ] FieldTypeConversionPreview loads
- [ ] Shows preview and statistics
- [ ] Convert button works

### **Integration:**
- [ ] Field resolver finds renamed fields
- [ ] Workflows adapt to field renames
- [ ] E-commerce mappings update
- [ ] AI agent knowledge refreshes
- [ ] Notifications created for users

---

## 🚀 **Quick Test Script**

Run this to test core functionality:

```bash
#!/bin/bash

echo "Testing Schema Adaptability System..."

# Test 1: Debouncer status
echo "\n1. Testing debouncer API..."
curl -s "http://localhost:3000/api/schema-debouncer" | jq .

# Test 2: Rename history (replace IDs with real ones)
echo "\n2. Testing rename history API..."
curl -s "http://localhost:3000/api/schema/SCHEMA_ID/field/FIELD_ID/rename-history?organizationId=ORG_ID&workspaceId=WS_ID" | jq .

# Test 3: Type conversion preview
echo "\n3. Testing type conversion preview..."
curl -s "http://localhost:3000/api/schema/SCHEMA_ID/field/FIELD_ID/convert-type?organizationId=ORG_ID&workspaceId=WS_ID&fieldKey=price&oldType=text&newType=currency" | jq .

echo "\n✅ All API tests complete!"
```

---

**That's it! If all these tests pass, your Schema Adaptability System is 100% working.** 🎉


