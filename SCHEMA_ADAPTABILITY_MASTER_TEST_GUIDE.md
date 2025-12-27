# Schema Adaptability System - MASTER TESTING GUIDE

## 🎯 **ONE FILE - ALL TESTS**

This is the **ONLY** file you need to test the entire Schema Adaptability System.

---

## 📋 **Testing Checklist (Copy & Check Off)**

```
Backend Core:
[ ] Schema change events are created
[ ] Events go through debouncer (5-sec wait)
[ ] Events get processed
[ ] Rename history auto-tracked
[ ] Type converter works
[ ] Severity assessment works

APIs:
[ ] GET /api/schema-changes
[ ] POST /api/schema-changes/process
[ ] GET /api/schema-changes/impact
[ ] GET /api/schema/.../rename-history
[ ] POST /api/schema/.../rename-history (rollback)
[ ] GET /api/schema/.../convert-type
[ ] POST /api/schema/.../convert-type
[ ] GET/POST /api/schema-debouncer

UI Components:
[ ] SchemaChangeImpactDashboard loads
[ ] FieldRenameHistory shows timeline
[ ] FieldRenameHistory rollback works
[ ] FieldTypeConversionPreview shows stats
[ ] FieldTypeConversionPreview converts

Integration:
[ ] Field resolver finds renamed fields
[ ] Workflows adapt to changes
[ ] E-commerce mappings update
[ ] AI agent refreshes
[ ] Notifications created
```

---

## 🚀 **FASTEST TEST (2 minutes)**

### **Step 1: Start Server**
```bash
npm run dev
```

### **Step 2: Open Browser Console (F12)**
```bash
# Navigate to any schema in your app
# Example: http://localhost:3000/workspace/org_123/schemas
```

### **Step 3: Rename a Field**
```bash
# In the UI, rename any field:
# "price" → "cost"
```

### **Step 4: Watch Console**
**You should see:**
```
[Schema Change Debouncer] Event queued
(5 second wait...)
[Schema Change Debouncer] Processing batch
[Schema Change Handler] Processing event
[Schema Change UX] Handling schema change
✅ Event processed successfully
```

**✅ SUCCESS if you see these logs**

---

### **Step 5: Check Firestore**
```bash
# Open Firebase Console
# Go to: /organizations/{your_org_id}/schemaChangeEvents
```

**You should see:**
```json
{
  "changeType": "field_renamed",
  "oldFieldKey": "price",
  "newFieldKey": "cost",
  "processed": true,
  "timestamp": "..."
}
```

**✅ SUCCESS if event exists**

---

### **Step 6: Check Rename History**
```bash
# In Firebase Console
# Go to: /organizations/{orgId}/workspaces/{wsId}/schemas/{schemaId}
# Look at the field you renamed
```

**You should see:**
```json
{
  "key": "cost",
  "label": "Cost",
  "renameHistory": [
    {
      "oldKey": "price",
      "newKey": "cost",
      "oldLabel": "Price",
      "newLabel": "Cost",
      "timestamp": "...",
      "renamedBy": "user_123"
    }
  ]
}
```

**✅ SUCCESS if renameHistory exists**

---

## 🧪 **COMPLETE TEST SUITE**

### **Test 1: API Endpoints**

**Replace these values with your actual IDs:**
```bash
ORG_ID="org_your_organization_id"
WS_ID="ws_your_workspace_id"
SCHEMA_ID="schema_products"  # or your schema ID
FIELD_ID="field_price"       # or your field ID
```

#### **Test 1.1: Debouncer Status**
```bash
curl "http://localhost:3000/api/schema-debouncer"
```

**Expected:**
```json
{
  "success": true,
  "debounceMs": 5000,
  "pendingCount": 0
}
```

---

#### **Test 1.2: Schema Changes**
```bash
curl "http://localhost:3000/api/schema-changes?organizationId=${ORG_ID}"
```

**Expected:**
```json
{
  "success": true,
  "events": [...],
  "count": 5
}
```

---

#### **Test 1.3: Impact Analysis**
```bash
curl "http://localhost:3000/api/schema-changes/impact?organizationId=${ORG_ID}&workspaceId=${WS_ID}&schemaId=${SCHEMA_ID}"
```

**Expected:**
```json
{
  "success": true,
  "impact": {
    "totalChanges": 3,
    "byType": { "field_renamed": 2, "field_added": 1 },
    "affectedSystems": { "workflows": 2, "ecommerce": 1, ... }
  },
  "workflows": { "total": 5, "valid": 4, "withWarnings": 1 }
}
```

---

#### **Test 1.4: Rename History**
```bash
curl "http://localhost:3000/api/schema/${SCHEMA_ID}/field/${FIELD_ID}/rename-history?organizationId=${ORG_ID}&workspaceId=${WS_ID}"
```

**Expected:**
```json
{
  "success": true,
  "field": {
    "currentKey": "hourly_rate",
    "currentLabel": "Hourly Rate"
  },
  "history": [...],
  "timeline": [...],
  "aliases": ["price", "cost", "hourly_rate"]
}
```

---

#### **Test 1.5: Type Conversion Preview**
```bash
curl "http://localhost:3000/api/schema/${SCHEMA_ID}/field/${FIELD_ID}/convert-type?organizationId=${ORG_ID}&workspaceId=${WS_ID}&fieldKey=price&oldType=text&newType=currency"
```

**Expected:**
```json
{
  "success": true,
  "isSafe": false,
  "preview": [
    { "before": "$100", "after": 100.00, "status": "success" },
    { "before": "free", "after": null, "status": "fail" }
  ],
  "totalRecords": 10,
  "estimatedSuccess": 7,
  "estimatedFailures": 3,
  "successRate": 70
}
```

---

### **Test 2: UI Components**

#### **Test 2.1: Create Test Page**
```bash
# Create: src/app/test-schema-adaptability/page.tsx
```

```typescript
'use client';

import { useState } from 'react';
import FieldRenameHistory from '@/components/FieldRenameHistory';
import FieldTypeConversionPreview from '@/components/FieldTypeConversionPreview';
import SchemaChangeImpactDashboard from '@/components/SchemaChangeImpactDashboard';

export default function TestSchemaAdaptability() {
  const [tab, setTab] = useState('impact');

  // REPLACE WITH YOUR ACTUAL IDs
  const orgId = 'org_your_org_id';
  const wsId = 'ws_your_workspace_id';
  const schemaId = 'schema_products';
  const fieldId = 'field_price';
  const userId = 'user_your_id';

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-8">Schema Adaptability Testing</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('impact')}
          className={`px-4 py-2 border-b-2 ${
            tab === 'impact'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600'
          }`}
        >
          Impact Dashboard
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 border-b-2 ${
            tab === 'history'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600'
          }`}
        >
          Rename History
        </button>
        <button
          onClick={() => setTab('conversion')}
          className={`px-4 py-2 border-b-2 ${
            tab === 'conversion'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600'
          }`}
        >
          Type Conversion
        </button>
      </div>

      {/* Content */}
      {tab === 'impact' && (
        <SchemaChangeImpactDashboard
          organizationId={orgId}
          workspaceId={wsId}
          schemaId={schemaId}
        />
      )}

      {tab === 'history' && (
        <FieldRenameHistory
          organizationId={orgId}
          workspaceId={wsId}
          schemaId={schemaId}
          fieldId={fieldId}
          userId={userId}
          onRollback={() => {
            alert('Field rolled back!');
            window.location.reload();
          }}
        />
      )}

      {tab === 'conversion' && (
        <FieldTypeConversionPreview
          organizationId={orgId}
          workspaceId={wsId}
          schemaId={schemaId}
          fieldId={fieldId}
          fieldKey="price"
          fieldLabel="Price"
          oldType="text"
          newType="currency"
          onApprove={() => {
            alert('Conversion approved!');
            window.location.reload();
          }}
          onCancel={() => alert('Conversion cancelled')}
        />
      )}
    </div>
  );
}
```

**Visit:** `http://localhost:3000/test-schema-adaptability`

**✅ All 3 components should load without errors**

---

## **If You Don't Want to Test Manually:**

I can create an **automated test script** that:
1. Creates test schema
2. Makes changes
3. Verifies events created
4. Checks rename history
5. Tests all APIs
6. Reports pass/fail

**Want me to create that automated test script?**

---

## **Bottom Line:**

**Single source of truth:** `SCHEMA_ADAPTABILITY_MASTER_TEST_GUIDE.md`

**Fastest test:** 
1. Rename a field
2. Check console for debouncer logs
3. Check Firestore for event + renameHistory

**Most thorough test:**
- Create the test page above
- Visit it
- All 3 components should work

That's it! ✅

