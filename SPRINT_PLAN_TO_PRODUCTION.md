# Sprint Plan to Production-Ready
**Created:** December 26, 2025  
**Goal:** Fix all critical issues and reach production-ready state  
**Timeline:** 5-6 days (3 sprints)

---

## 🚨 SPRINT 1: CRITICAL BLOCKERS (2 days)
**Goal:** Fix features that would confuse/frustrate users  
**Must complete before beta launch**

### 1. Field Type Conversion POST Endpoint ⏱️ 6 hours
**File:** `src/app/api/schema/[schemaId]/field/[fieldId]/convert-type/route.ts`

**Current state:**
```typescript
export async function POST(...) {
  return NextResponse.json(
    { error: 'Type conversion not yet implemented' },
    { status: 501 }
  );
}
```

**Implementation:**
```typescript
export async function POST(request: NextRequest, context: { params: Promise<{ schemaId: string; fieldId: string }> }) {
  try {
    const params = await context.params;
    const body = await request.json();
    const { organizationId, workspaceId, fieldKey, oldType, newType } = body;
    
    // Validate
    if (!organizationId || !workspaceId || !fieldKey || !oldType || !newType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Import admin SDK
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    
    // Get all records
    const recordsRef = db
      .collection('organizations').doc(organizationId)
      .collection('workspaces').doc(workspaceId)
      .collection('entities').doc(params.schemaId)
      .collection('records');
    
    const snapshot = await recordsRef.get();
    
    // Batch update (Firestore allows 500 operations per batch)
    const batch = db.batch();
    let successCount = 0;
    let failureCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const oldValue = data[fieldKey];
      const conversion = FieldTypeConverterServer.convertValue(oldValue, oldType, newType);
      
      if (conversion.success) {
        batch.update(doc.ref, { [fieldKey]: conversion.value });
        successCount++;
      } else {
        failureCount++;
      }
    }
    
    // Commit batch
    await batch.commit();
    
    // Update field schema
    const schemaRef = db
      .collection('organizations').doc(organizationId)
      .collection('workspaces').doc(workspaceId)
      .collection('schemas').doc(params.schemaId);
    
    const schemaDoc = await schemaRef.get();
    const schemaData = schemaDoc.data();
    const updatedFields = schemaData.fields.map(f => 
      f.id === params.fieldId ? { ...f, type: newType } : f
    );
    
    await schemaRef.update({ 
      fields: updatedFields,
      updatedAt: new Date().toISOString()
    });
    
    return NextResponse.json({
      success: true,
      successCount,
      failureCount,
      totalRecords: snapshot.size
    });
  } catch (error) {
    logger.error('[Type Conversion] Execution failed', error);
    return NextResponse.json({ error: 'Conversion failed' }, { status: 500 });
  }
}
```

**Testing:**
- Create test schema with 100 records
- Add text field with numbers "123", "456", etc.
- Convert text → number
- Verify all records updated
- Verify field type updated in schema

---

### 2. Cron Expression Parsing ⏱️ 3 hours

**Install dependency:**
```bash
npm install cron-parser
```

**File:** `src/lib/workflows/triggers/schedule-trigger.ts`

**Current state:**
```typescript
} else if (schedule.type === 'cron') {
  // TODO: Parse cron expression and calculate next run
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
}
```

**Implementation:**
```typescript
import parser from 'cron-parser';

function calculateNextRun(schedule: ScheduleTrigger['schedule']): string {
  const now = new Date();
  
  if (schedule.type === 'interval') {
    // ... existing interval logic ...
  } else if (schedule.type === 'cron') {
    try {
      const cronExpression = schedule.cron!;
      
      // Validate and parse cron expression
      const interval = parser.parseExpression(cronExpression, {
        currentDate: now,
        tz: 'UTC' // Or get from organization settings
      });
      
      // Get next occurrence
      const next = interval.next().toDate();
      return next.toISOString();
    } catch (error) {
      logger.error('[Schedule] Invalid cron expression', error, {
        cron: schedule.cron,
        file: 'schedule-trigger.ts'
      });
      
      // Fallback to 1 day from now if invalid
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
  }
  
  return now.toISOString();
}
```

**Add validation function:**
```typescript
export function validateCronExpression(cron: string): { valid: boolean; error?: string } {
  try {
    parser.parseExpression(cron);
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid cron expression'
    };
  }
}
```

**Update UI to validate cron:**
File: `src/app/workspace/[orgId]/workflows/new/page.tsx`

Add validation when user enters cron expression.

**Testing:**
- Test `0 9 * * 1` (Every Monday at 9am)
- Test `*/15 * * * *` (Every 15 minutes)
- Test `0 0 1 * *` (First of month)
- Verify next run calculated correctly
- Test invalid cron shows error

---

### 3. Webhook Query Parameter Parsing ⏱️ 1 hour

**File:** `src/lib/workflows/triggers/webhook-trigger.ts`

**Current state:**
```typescript
const triggerData = {
  organizationId: org.id,
  workspaceId: workspace.id,
  method,
  headers,
  body,
  query: {}, // TODO: Parse query params
};
```

**Implementation:**
```typescript
export async function handleWebhook(
  webhookUrl: string,
  method: string,
  headers: Record<string, string>,
  body: any,
  queryParams?: Record<string, string> // Add parameter
): Promise<void> {
  // ... existing logic ...
  
  const triggerData = {
    organizationId: org.id,
    workspaceId: workspace.id,
    method,
    headers,
    body,
    query: queryParams || {},
  };
  
  await executeWorkflow(workflow as Workflow, triggerData);
}
```

**Update webhook API route:**
File: `src/app/api/workflows/webhooks/[workflowId]/route.ts`

```typescript
export async function POST(request: NextRequest, { params }: { params: { workflowId: string } }) {
  const webhookUrl = request.url;
  const method = request.method;
  const headers = Object.fromEntries(request.headers.entries());
  const body = await request.json();
  
  // Parse query parameters
  const url = new URL(request.url);
  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });
  
  await handleWebhook(webhookUrl, method, headers, body, queryParams);
  
  return NextResponse.json({ success: true });
}
```

**Testing:**
- Send webhook: `POST /api/workflows/webhooks/123?status=urgent&priority=high`
- Verify triggerData.query.status === 'urgent'
- Verify triggerData.query.priority === 'high'
- Test workflow can access {{query.status}}

---

**SPRINT 1 TOTAL: 10 hours**

**Deliverable:** Beta-ready platform with critical issues fixed

---

## ⚠️ SPRINT 2: IMPORTANT IMPROVEMENTS (3-4 days)
**Goal:** Add testing, validation, better UX  
**Recommended before production launch**

### 4. Custom Transform Functions ⏱️ 8 hours

**Install dependency:**
```bash
npm install isolated-vm
```

**File:** `src/lib/integrations/field-mapper.ts`

**Implementation:**
```typescript
import ivm from 'isolated-vm';

interface CustomTransform {
  id: string;
  name: string;
  code: string; // JavaScript function code
  organizationId: string;
}

async function applyCustomTransform(
  value: any,
  transformId: string,
  organizationId: string
): Promise<any> {
  // Load transform from database
  const transform = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/customTransforms`,
    transformId
  );
  
  if (!transform) {
    throw new Error(`Transform ${transformId} not found`);
  }
  
  // Create isolated VM
  const isolate = new ivm.Isolate({ memoryLimit: 8 }); // 8MB limit
  const context = await isolate.createContext();
  
  // Set timeout
  const timeout = 1000; // 1 second max
  
  try {
    // Inject value into context
    await context.global.set('inputValue', value);
    
    // Run transform code
    const code = `
      ${transform.code}
      transform(inputValue)
    `;
    
    const result = await context.eval(code, { timeout });
    
    return result;
  } catch (error) {
    logger.error('[Field Mapper] Custom transform failed', error, {
      transformId,
      file: 'field-mapper.ts'
    });
    throw error;
  } finally {
    isolate.dispose();
  }
}
```

**Update field-mapper.ts:**
```typescript
case 'custom':
  if (!mapping.customTransformId) {
    logger.warn('[Field Mapper] No custom transform specified', {
      file: 'field-mapper.ts',
    });
    return value;
  }
  
  return await applyCustomTransform(
    value,
    mapping.customTransformId,
    organizationId
  );
```

**Add UI for creating custom transforms:**
File: `src/app/workspace/[orgId]/settings/integrations/transforms/page.tsx`

Allow users to:
1. Create custom transform
2. Write JavaScript function
3. Test with sample data
4. Save to database

**Testing:**
- Create transform: `(val) => val.toUpperCase()`
- Test with "hello" → "HELLO"
- Test timeout (infinite loop)
- Test memory limit
- Test security (no access to require, fs, etc.)

---

### 5. API Key Testing - Add All Services ⏱️ 6 hours

**File:** `src/app/api/settings/api-keys/test/route.ts`

**Add tests for missing services:**

```typescript
switch (service) {
  // ... existing tests ...
  
  case 'anthropic':
    return await testAnthropic(apiKey);
  
  case 'openrouter':
    return await testOpenRouter(apiKey);
  
  case 'gemini':
    return await testGemini(apiKey);
  
  case 'twilio':
    return await testTwilio(apiKeys.twilio_account_sid, apiKeys.twilio_auth_token);
  
  case 'resend':
    return await testResend(apiKey);
  
  // ... etc for all 12 missing services ...
}

async function testAnthropic(apiKey: string): Promise<NextResponse> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      })
    });
    
    if (response.ok || response.status === 400) {
      // 400 is ok, means API key valid but bad request
      return NextResponse.json({
        success: true,
        message: 'Anthropic API key is valid!'
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid Anthropic API key'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
}

// Repeat for all 12 services...
```

**Testing:**
- Test each service with valid key
- Test each service with invalid key
- Verify error messages helpful

---

### 6. Integration Test Suite ⏱️ 12 hours

**File:** `tests/integration/api-routes.test.ts`

**Replace all TODO tests with real tests:**

```typescript
import { NextRequest } from 'next/server';
import { POST as chatHandler } from '@/app/api/agent/chat/route';
import { POST as configHandler } from '@/app/api/agent/config/route';

describe('API Routes', () => {
  describe('/api/agent/chat', () => {
    it('should handle chat requests', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 'test-customer',
          orgId: 'test-org',
          message: 'Hello',
        }),
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });
      
      const response = await chatHandler(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('response');
      expect(data).toHaveProperty('instanceId');
    });
    
    it('should enforce rate limiting', async () => {
      // Make 100 requests rapidly
      const requests = Array(100).fill(null).map(() => 
        chatHandler(createRequest())
      );
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });
    
    it('should require authentication', async () => {
      const req = new NextRequest('http://localhost:3000/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 'test-customer',
          orgId: 'test-org',
          message: 'Hello',
        }),
        // NO Authorization header
      });
      
      const response = await chatHandler(req);
      expect(response.status).toBe(401);
    });
  });
  
  describe('/api/agent/config', () => {
    it('should save agent configuration', async () => {
      const config = {
        orgId: 'test-org',
        systemPrompt: 'Test prompt',
        selectedModel: 'gpt-4',
      };
      
      const req = createRequest(config);
      const response = await configHandler(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
  
  // ... etc for all routes ...
});
```

**Create test utilities:**
File: `tests/utils/test-helpers.ts`

```typescript
export function createMockRequest(body: any, headers?: Record<string, string>) {
  return new NextRequest('http://localhost:3000/test', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
      ...headers,
    },
  });
}

export async function setupTestOrg() {
  // Create test organization
  // Create test user
  // Return auth token
}

export async function cleanupTestData() {
  // Delete test organization
  // Delete test users
}
```

**Testing:**
- Run all tests: `npm test`
- Verify >80% code coverage
- All tests pass

---

**SPRINT 2 TOTAL: 26 hours**

**Deliverable:** Production-ready platform with testing & validation

---

## 📝 SPRINT 3: NICE-TO-HAVE (2-3 days)
**Goal:** Enhance features, expand capabilities  
**Can be deferred to post-launch**

### 7. Integration Function Calling - 9 Additional Integrations ⏱️ 16 hours

**Add function calling for:**
1. Gmail (2 hours)
2. Outlook (2 hours)
3. Slack (2 hours)
4. Teams (2 hours)
5. QuickBooks (2 hours)
6. Xero (2 hours)
7. PayPal (2 hours)
8. Square (2 hours)
9. Zoom (2 hours)

**Pattern for each integration:**

File: `src/lib/integrations/email/gmail.ts`

```typescript
export async function executeGmailFunction(
  functionName: string,
  parameters: Record<string, any>,
  integration: ConnectedIntegration
): Promise<any> {
  const { accessToken } = integration;
  
  switch (functionName) {
    case 'sendGmailEmail':
      return await sendEmail({
        to: parameters.to,
        subject: parameters.subject,
        body: parameters.body,
      }, accessToken);
    
    case 'searchGmailEmails':
      return await searchEmails(parameters.query, accessToken);
    
    default:
      throw new Error(`Unknown Gmail function: ${functionName}`);
  }
}
```

**Update function-calling.ts:**
```typescript
switch (integration.providerId) {
  // ... existing cases ...
  
  case 'gmail':
    result = await executeGmailFunction(...);
    break;
  
  case 'outlook':
    result = await executeOutlookFunction(...);
    break;
  
  // ... etc for all 9 integrations ...
}
```

---

### 8. Email Writer Configuration ⏱️ 3 hours

**File:** `src/lib/outbound/email-writer.ts`

**Add configuration:**

```typescript
async function buildAIDAEmail(
  request: EmailGenerationRequest,
  tokens: Record<string, string>
): Promise<string> {
  const { valueProposition = 'increase sales productivity', cta = 'book a 15-minute call' } = request;
  
  // Load organization preferences
  const orgConfig = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${request.organizationId}/settings`,
    'email_writer'
  );
  
  const useAI = orgConfig?.useAI !== false; // Default true
  const strategy = orgConfig?.defaultStrategy || 'AIDA';
  
  if (useAI) {
    return await generateWithAI(request, tokens, strategy);
  }

  // Template-based fallback
  // ...
}
```

**Add settings UI:**
File: `src/app/workspace/[orgId]/settings/email-writer/page.tsx`

Allow configuration of:
- Use AI (yes/no)
- Default strategy (AIDA, PAS, BAB)
- Default tone (professional, friendly, etc.)

---

**SPRINT 3 TOTAL: 19 hours**

**Deliverable:** Feature-complete platform with expanded integrations

---

## 📊 TIMELINE SUMMARY

| Sprint | Duration | Hours | Status |
|--------|----------|-------|--------|
| Sprint 1 (CRITICAL) | 2 days | 10 | **MUST DO** |
| Sprint 2 (IMPORTANT) | 3-4 days | 26 | **SHOULD DO** |
| Sprint 3 (NICE-TO-HAVE) | 2-3 days | 19 | **CAN DEFER** |
| **TOTAL** | **5-6 days** | **55 hours** | - |

### Launch Options

**Option A: Beta Launch (Fastest)**
- Complete: Sprint 1 only
- Timeline: 2 days
- Risk: Medium (incomplete features documented)
- Users: Limited beta (50-100 users)

**Option B: Production Launch (Recommended)**
- Complete: Sprint 1 + Sprint 2
- Timeline: 5-6 days
- Risk: Low (tested, validated)
- Users: Open production launch

**Option C: Feature-Complete (Best)**
- Complete: All 3 sprints
- Timeline: 8-10 days
- Risk: Very Low
- Users: Full production with all features

---

## 🎯 RECOMMENDATION

**Do Sprint 1 + Sprint 2 = Production Launch in 5-6 days**

**Rationale:**
- Sprint 1 fixes blocking issues (2 days)
- Sprint 2 adds critical testing & validation (3-4 days)
- Sprint 3 nice-to-have, can add post-launch
- Total: 5-6 days to production-ready
- Low risk, high quality

**Defer to post-launch:**
- Sprint 3 (integration expansions)
- Mobile PWA
- Advanced reporting
- Additional integrations

---

**END OF SPRINT PLAN**


