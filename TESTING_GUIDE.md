# 🧪 Testing Guide

## Quick Start

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Access the app:**
   - Open http://localhost:3000
   - Login with your Firebase credentials

---

## System Testing

### 1. Knowledge Processing & RAG

**Test PDF Upload:**
```
POST /api/agent/knowledge/upload
Body: FormData with PDF file
```

**Test Vector Search:**
- Upload a document
- Wait for indexing
- Search via chat interface

**Test RAG:**
- Ask questions in chat
- Verify responses use knowledge base context

### 2. Workflow Engine

**Test Workflow Creation:**
```
POST /api/workflows
Body: { workflow definition }
```

**Test Workflow Execution:**
```
POST /api/workflows/execute
Body: { workflowId, triggerData }
```

**Test Actions:**
- Email action: Should send real email
- SMS action: Should send real SMS
- Entity action: Should create/update/delete records
- HTTP action: Should make HTTP request
- Delay action: Should wait specified time

### 3. E-Commerce

**Test Cart:**
```
GET /api/ecommerce/cart?sessionId=xxx&workspaceId=xxx
POST /api/ecommerce/cart
Body: { sessionId, workspaceId, productId, quantity }
```

**Test Checkout:**
```
POST /api/ecommerce/checkout
Body: { cartId, customer, addresses, payment }
```

**Test Orders:**
```
GET /api/ecommerce/orders?workspaceId=xxx
GET /api/ecommerce/orders/[orderId]?workspaceId=xxx
```

### 4. Analytics

**Test Revenue Report:**
```
GET /api/analytics/revenue?workspaceId=xxx&period=monthly&startDate=2024-01-01&endDate=2024-12-31
```

**Test Pipeline Report:**
```
GET /api/analytics/pipeline?workspaceId=xxx&period=current
```

**Test Forecast:**
```
GET /api/analytics/forecast?workspaceId=xxx&period=month
```

### 5. Integrations

**Test OAuth Flow:**
```
GET /api/integrations/oauth/authorize?integrationId=xxx&provider=google
```

**Test Integration:**
```
GET /api/integrations/[integrationId]
POST /api/integrations/[integrationId]/test
POST /api/integrations/[integrationId]/sync
```

---

## Common Issues & Fixes

### Issue: TypeScript Errors
**Fix:** Most are non-blocking. Focus on runtime errors first.

### Issue: Firebase Not Configured
**Fix:** Set up Firebase config in `.env.local`

### Issue: API Keys Missing
**Fix:** Configure API keys in Settings > API Keys

### Issue: OAuth Redirect URI Mismatch
**Fix:** Ensure redirect URI matches provider settings

---

## Debugging Tips

1. **Check Console Logs:** All services log to console
2. **Check Firestore:** Verify data is being saved
3. **Check Network Tab:** See API request/response
4. **Check Error Messages:** Most errors include helpful messages

---

**Happy Testing!** 🚀











