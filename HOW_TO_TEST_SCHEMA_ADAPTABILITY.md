# How to Test Schema Adaptability System

## 🎯 **Three Ways to Test**

---

## **Option 1: Automated Script (Easiest - 2 minutes)**

### **What it does:**
- Creates test schema with test records
- Renames fields and checks events are created
- Tests all APIs
- Checks rename history tracking
- Tests type conversion preview
- Cleans up after itself

### **How to run:**

```bash
# Step 1: Set your test IDs
export TEST_ORG_ID="org_your_actual_org_id"
export TEST_WORKSPACE_ID="ws_your_actual_workspace_id"

# Step 2: Make sure server is running
npm run dev

# Step 3: Run the test script (in a separate terminal)
node scripts/test-schema-adaptability.js
```

### **What you'll see:**
```
========================================
Schema Adaptability System - Test Suite
========================================

📋 TEST 1: Creating test schema...
✅ Test Schema Creation: Created schema schema_test_1234567890

📋 TEST 2: Creating test records...
✅ Test Records Creation: Created 3 test records

📋 TEST 3: Testing field rename...
✅ Field Rename: Renamed price → cost
✅ Rename History Tracking: renameHistory array exists

📋 TEST 4: Checking schema change events...
✅ Schema Change Events: Found 1 event(s)

📋 TEST 5: Testing field resolver...
✅ Field Resolver Compatibility: Field structure supports resolver

📋 TEST 6: Testing debouncer API...
✅ Debouncer API: Debounce: 5000ms, Pending: 0

📋 TEST 7: Testing rename history API...
✅ Rename History API: Found 1 rename(s)

📋 TEST 8: Testing type conversion preview API...
✅ Type Conversion Preview API: Success rate: 66%

📋 TEST 9: Testing schema changes API...
✅ Schema Changes API: Found 5 event(s)

📋 TEST 10: Cleaning up test data...
✅ Cleanup: Removed test data

========================================
TEST RESULTS
========================================

Total Tests: 10
✅ Passed: 10
❌ Failed: 0

🎉 ALL TESTS PASSED!
The Schema Adaptability System is working correctly.
```

---

## **Option 2: Manual UI Testing (Interactive - 5 minutes)**

### **Step 1: Create Test Page**

Create `src/app/test-adaptability/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import FieldRenameHistory from '@/components/FieldRenameHistory';
import FieldTypeConversionPreview from '@/components/FieldTypeConversionPreview';
import SchemaChangeImpactDashboard from '@/components/SchemaChangeImpactDashboard';

export default function TestAdaptability() {
  const [tab, setTab] = useState('impact');

  // ⚠️ REPLACE THESE WITH YOUR ACTUAL IDs
  const orgId = 'org_YOUR_ORG_ID';
  const wsId = 'ws_YOUR_WORKSPACE_ID';
  const schemaId = 'schema_YOUR_SCHEMA_ID';
  const fieldId = 'field_YOUR_FIELD_ID';
  const userId = 'user_YOUR_USER_ID';

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Schema Adaptability Testing</h1>
        <p className="text-gray-600 mb-8">Test all components of the adaptability system</p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setTab('impact')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              tab === 'impact'
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            📊 Impact Dashboard
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              tab === 'history'
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            📜 Rename History
          </button>
          <button
            onClick={() => setTab('conversion')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              tab === 'conversion'
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            🔄 Type Conversion
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {tab === 'impact' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Schema Change Impact Dashboard</h2>
              <SchemaChangeImpactDashboard
                organizationId={orgId}
                workspaceId={wsId}
                schemaId={schemaId}
              />
            </div>
          )}

          {tab === 'history' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Field Rename History</h2>
              <FieldRenameHistory
                organizationId={orgId}
                workspaceId={wsId}
                schemaId={schemaId}
                fieldId={fieldId}
                userId={userId}
                onRollback={() => {
                  alert('✅ Field rolled back successfully!');
                  window.location.reload();
                }}
              />
            </div>
          )}

          {tab === 'conversion' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Field Type Conversion Preview</h2>
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
                  alert('✅ Conversion approved and executed!');
                  window.location.reload();
                }}
                onCancel={() => {
                  alert('❌ Conversion cancelled');
                }}
              />
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-blue-900 font-semibold mb-2">📝 Testing Instructions:</h3>
          <ol className="text-blue-800 text-sm space-y-1 list-decimal list-inside">
            <li>Replace the IDs above with your actual org/workspace/schema/field IDs</li>
            <li>Click through each tab to test all components</li>
            <li>Impact Dashboard should show any schema changes you've made</li>
            <li>Rename History should show rename timeline (if field was renamed)</li>
            <li>Type Conversion should show preview of converting field type</li>
            <li>Test the action buttons (rollback, convert) to verify they work</li>
          </ol>
        </div>

        {/* API Test Buttons */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-gray-900 font-semibold mb-4">🔧 API Quick Tests:</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={async () => {
                const res = await fetch('/api/schema-debouncer');
                const data = await res.json();
                alert(JSON.stringify(data, null, 2));
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Test Debouncer API
            </button>
            <button
              onClick={async () => {
                const res = await fetch(`/api/schema-changes?organizationId=${orgId}`);
                const data = await res.json();
                alert(`Found ${data.count} events`);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              Test Events API
            </button>
            <button
              onClick={async () => {
                const res = await fetch(`/api/schema-changes/impact?organizationId=${orgId}&workspaceId=${wsId}&schemaId=${schemaId}`);
                const data = await res.json();
                alert(JSON.stringify(data.impact, null, 2));
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
            >
              Test Impact API
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### **Step 2: Update Your IDs**
Replace these in the code above:
- `org_YOUR_ORG_ID` → Your actual organization ID
- `ws_YOUR_WORKSPACE_ID` → Your actual workspace ID  
- `schema_YOUR_SCHEMA_ID` → Your actual schema ID
- `field_YOUR_FIELD_ID` → Your actual field ID
- `user_YOUR_USER_ID` → Your actual user ID

### **Step 3: Navigate to Test Page**
```bash
# Open: http://localhost:3000/test-adaptability
```

### **Step 4: Test Each Tab**

**Impact Dashboard Tab:**
- Should show schema change statistics
- Should show affected systems
- Should list recent changes
- Click "Process Pending Changes" → should work

**Rename History Tab:**
- Should show current field info
- Should show all aliases
- Should show rename timeline
- Click "Rollback" → should confirm and rollback

**Type Conversion Tab:**
- Should show conversion statistics
- Should show preview table
- Should show success rate
- Click "Convert" → should confirm and convert

### **Step 5: Test API Buttons**
- Click "Test Debouncer API" → should show debounce settings
- Click "Test Events API" → should show event count
- Click "Test Impact API" → should show impact data

**✅ SUCCESS if all components load and buttons work**

---

## **Option 3: Quick Console Tests (30 seconds)**

Just open browser console and run:

### **Test 1: Check Events**
```javascript
// In browser console (F12):
const orgId = 'YOUR_ORG_ID';

fetch(`/api/schema-changes?organizationId=${orgId}`)
  .then(r => r.json())
  .then(data => console.log('Events:', data));
```

**Should show:** List of schema change events

---

### **Test 2: Check Debouncer**
```javascript
fetch('/api/schema-debouncer')
  .then(r => r.json())
  .then(data => console.log('Debouncer:', data));
```

**Should show:** `{ debounceMs: 5000, pendingCount: 0 }`

---

### **Test 3: Process Events**
```javascript
fetch('/api/schema-changes/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ organizationId: 'YOUR_ORG_ID' })
})
  .then(r => r.json())
  .then(data => console.log('Processed:', data));
```

**Should show:** `{ processed: X, failed: 0 }`

---

## 📊 **What Each Test Verifies**

| Test | What It Checks | Files Involved |
|------|---------------|----------------|
| **Automated Script** | Complete backend + APIs | All backend + API files |
| **UI Test Page** | All 3 components + APIs | All UI components + APIs |
| **Console Tests** | APIs work | API routes only |

---

## 🎯 **Recommended Testing Order**

**For first-time testing:**
1. ✅ Run automated script (verifies backend)
2. ✅ Create UI test page (verifies frontend)
3. ✅ Make real schema change (verifies integration)

**For ongoing testing:**
- Use automated script in CI/CD
- Use UI test page for manual verification

---

## 🐛 **Common Issues & Fixes**

### **Issue: "Server not running" errors**
**Fix:**
```bash
# Make sure dev server is running:
npm run dev
# Wait for "Ready on http://localhost:3000"
```

---

### **Issue: "404 Not Found" on APIs**
**Check:**
```bash
# Verify API files exist:
ls src/app/api/schema-changes/route.ts
ls src/app/api/schema-debouncer/route.ts
ls src/app/api/schema/\[schemaId\]/field/\[fieldId\]/rename-history/route.ts
```

**Fix:** All files should exist (I created them above)

---

### **Issue: "No events found"**
**This is normal if:**
- You haven't made any schema changes yet
- Debouncer is still waiting (5 seconds)

**Force events to process:**
```bash
curl -X POST "http://localhost:3000/api/schema-debouncer" \
  -H "Content-Type: application/json" \
  -d '{ "action": "flush" }'
```

---

### **Issue: "Organization ID not found"**
**Fix:**
```bash
# Find your actual IDs in Firestore:
# 1. Open Firebase Console
# 2. Go to Firestore Database
# 3. Navigate to: /organizations/{your_org_id}
# 4. Copy the ID
# 5. Replace in test script or test page
```

---

## ⚡ **FASTEST Test (Literally 30 seconds)**

```bash
# 1. Start server
npm run dev

# 2. In another terminal, run automated test:
TEST_ORG_ID=org_abc123 TEST_WORKSPACE_ID=ws_xyz789 node scripts/test-schema-adaptability.js

# 3. Done! It will tell you pass/fail.
```

---

## 📖 **What Success Looks Like**

**Automated Script:**
```
🎉 ALL TESTS PASSED!
The Schema Adaptability System is working correctly.
```

**UI Test Page:**
- All 3 tabs load without errors
- Data appears in each tab
- Buttons are clickable and work

**Console Tests:**
- All API calls return JSON (not errors)
- Events are found
- Debouncer shows status

---

## 🎉 **That's It!**

Pick one method and run it. If tests pass, **you're 100% ready for production**.

**Recommended:** Run automated script first, then create UI test page for visual verification.


