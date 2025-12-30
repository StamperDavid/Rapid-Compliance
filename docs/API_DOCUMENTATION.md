

# API Documentation - AI Sales Platform

**Version:** 1.0  
**Base URL:** `https://your-domain.com` or `http://localhost:3000`  
**Authentication:** Bearer Token (Firebase Auth)

---

## 📚 Table of Contents

1. [Authentication](#authentication)
2. [Email Sequences](#email-sequences)
3. [SMS Campaigns](#sms-campaigns)
4. [Workflows](#workflows)
5. [Analytics](#analytics)
6. [CRM](#crm)
7. [Webhooks](#webhooks)
8. [Rate Limiting](#rate-limiting)
9. [Error Handling](#error-handling)

---

## 🔐 Authentication

All API requests require authentication using Firebase Auth tokens.

### Headers Required:
```http
Authorization: Bearer YOUR_FIREBASE_ID_TOKEN
Content-Type: application/json
```

### Getting a Token:
```javascript
// Client-side (Firebase SDK)
const user = auth.currentUser;
const token = await user.getIdToken();

// Make API request
fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

---

## 📧 Email Sequences

### Enroll Prospect in Sequence

**Endpoint:** `POST /api/outbound/sequences/enroll`

**Request:**
```json
{
  "orgId": "org_abc123",
  "sequenceId": "seq_xyz789",
  "prospectIds": ["prospect_001", "prospect_002"]
}
```

**Response:**
```json
{
  "success": true,
  "enrolled": 2,
  "enrollments": [
    {
      "id": "enrollment_123",
      "prospectId": "prospect_001",
      "sequenceId": "seq_xyz789",
      "status": "active",
      "currentStep": 0,
      "nextStepAt": "2025-12-24T10:00:00Z"
    }
  ]
}
```

### List Sequences

**Endpoint:** `GET /api/outbound/sequences?orgId=org_abc123`

**Query Parameters:**
- `orgId` (required): Organization ID
- `cursor` (optional): Pagination cursor
- `limit` (optional): Results per page (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "hasMore": true,
      "nextCursor": "cursor_abc",
      "total": 150
    }
  }
}
```

---

## 📱 SMS Campaigns

### Send SMS

**Endpoint:** `POST /api/sms/send`

**Request:**
```json
{
  "orgId": "org_abc123",
  "to": ["+1234567890"],
  "message": "Hello! This is a test message.",
  "provider": "twilio"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "SM123456789",
  "provider": "twilio",
  "sent": 1
}
```

### Webhooks

SMS delivery status updates are received via webhook:

**Endpoint:** `POST /api/webhooks/sms`

**Twilio Webhook Payload:**
```json
{
  "MessageSid": "SM123456789",
  "MessageStatus": "delivered",
  "To": "+1234567890",
  "From": "+1555123456"
}
```

---

## ⚙️ Workflows

### Execute Workflow

**Endpoint:** `POST /api/workflows/execute`

**Request:**
```json
{
  "workflowId": "workflow_123",
  "orgId": "org_abc123",
  "triggerData": {
    "leadId": "lead_456",
    "action": "created"
  }
}
```

**Response:**
```json
{
  "success": true,
  "executionId": "exec_789",
  "status": "completed",
  "actionResults": [
    {
      "actionId": "action_001",
      "status": "success",
      "result": { "messageId": "email_123" }
    }
  ]
}
```

### Supported Actions:
- `send_email` - Send email via SendGrid/Gmail
- `send_sms` - Send SMS via Twilio
- `send_slack` - Post to Slack channel
- `http_request` - Make HTTP API call
- `create_entity` - Create CRM record
- `update_entity` - Update CRM record
- `delay` - Wait specified duration
- `conditional_branch` - If/else logic
- `loop` - Iterate over array
- `ai_agent` - Execute AI agent

---

## 📊 Analytics

### Revenue Analytics

**Endpoint:** `GET /api/analytics/revenue?orgId=org_123&period=30d`

**Query Parameters:**
- `orgId` (required): Organization ID
- `period` (optional): `7d`, `30d`, `90d`, `all` (default: `30d`)

**Response:**
```json
{
  "success": true,
  "totalRevenue": 125000,
  "dealsCount": 45,
  "avgDealSize": 2777.78,
  "mrr": 15000,
  "growth": 12.5,
  "bySource": [
    { "source": "website", "revenue": 50000 },
    { "source": "referral", "revenue": 35000 }
  ],
  "byProduct": [...],
  "byRep": [...]
}
```

**Caching:** Results cached for 5 minutes

### Pipeline Analytics

**Endpoint:** `GET /api/analytics/pipeline?orgId=org_123`

**Response:**
```json
{
  "success": true,
  "totalValue": 500000,
  "totalDeals": 120,
  "avgDealSize": 4166.67,
  "byStage": [
    {
      "stage": "Qualified",
      "value": 150000,
      "count": 35,
      "avgDealSize": 4285.71
    }
  ],
  "velocity": {
    "avgSalesCycle": 45,
    "medianSalesCycle": 38
  }
}
```

**Caching:** Results cached for 10 minutes

---

## 👥 CRM

### Create Lead

**Endpoint:** `POST /api/leads/create`

**Request:**
```json
{
  "orgId": "org_123",
  "email": "lead@company.com",
  "firstName": "John",
  "lastName": "Doe",
  "company": "Acme Corp",
  "phone": "+1234567890",
  "source": "website"
}
```

**Response:**
```json
{
  "success": true,
  "lead": {
    "id": "lead_abc123",
    "email": "lead@company.com",
    "status": "new",
    "createdAt": "2025-12-23T10:00:00Z"
  }
}
```

---

## 🪝 Webhooks

### Email Tracking Webhook

**Endpoint:** `POST /api/webhooks/email`

**SendGrid Webhook Payload:**
```json
[
  {
    "email": "recipient@example.com",
    "event": "delivered",
    "sg_message_id": "msg_123",
    "enrollmentId": "enrollment_456",
    "stepId": "step_789",
    "organizationId": "org_abc"
  }
]
```

**Events Supported:**
- `delivered` - Email successfully delivered
- `open` - Email opened by recipient
- `click` - Link clicked in email
- `bounce` - Email bounced
- `spamreport` - Marked as spam
- `unsubscribe` - Unsubscribe requested

### Gmail Push Notification

**Endpoint:** `POST /api/webhooks/gmail`

**Google Pub/Sub Payload:**
```json
{
  "message": {
    "data": "base64_encoded_data",
    "messageId": "msg_123"
  }
}
```

---

## 🚦 Rate Limiting

All endpoints are rate-limited for security and stability.

### Limits by Endpoint Type:

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| Authentication | 5 requests | 1 minute |
| Email/SMS Sending | 50 requests | 1 minute |
| Analytics | 100 requests | 1 minute |
| CRM Operations | 200 requests | 1 minute |
| Webhooks | 500 requests | 1 minute |

### Rate Limit Headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

### Rate Limited Response:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 60
  }
}
```

**Status Code:** `429 Too Many Requests`

---

## ❌ Error Handling

### Error Response Format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": "Additional context (optional)"
  }
}
```

### Error Codes:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BAD_REQUEST` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Temporary service issue |

---

## 🔍 Pagination

All list endpoints support cursor-based pagination for scalability.

### Request:
```http
GET /api/leads?orgId=org_123&limit=50&cursor=eyJpZCI6ImxlYWRfMTIzIn0
```

### Response:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "hasMore": true,
      "nextCursor": "eyJpZCI6ImxlYWRfMTczIn0",
      "total": 1500
    }
  }
}
```

**Best Practices:**
- Use `limit` between 10-100 (default: 50)
- Store `nextCursor` for subsequent requests
- Don't skip pages (cursor-based pagination is sequential)

---

## 🧪 Testing

### Test Environment:
```
Base URL: http://localhost:3000
```

### Test Accounts:
```
Email: admin@auraflow.test
Password: Testing123!
Org: Varies (created during seeding)
```

### Running Tests:
```bash

# Seed test data
npm run seed:e2e

# Run E2E tests
npm run test:e2e

# Run load tests
npm run load:all

# Run security audit
npm run security:all
```

---

## 📖 Examples

### Complete Sequence Enrollment Flow:
```javascript
// 1. Create sequence
const sequence = await fetch('/api/outbound/sequences', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    orgId: 'org_123',
    name: 'Onboarding Sequence',
    steps: [
      {
        type: 'email',
        delayDays: 0,
        subject: 'Welcome!',
        content: 'Hi {{firstName}}!',
      },
      {
        type: 'email',
        delayDays: 3,
        subject: 'Checking in',
        content: 'How are you finding our product?',
      },
    ],
  }),
});

// 2. Enroll prospects
const enrollment = await fetch('/api/outbound/sequences/enroll', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    orgId: 'org_123',
    sequenceId: sequence.id,
    prospectIds: ['prospect_001', 'prospect_002'],
  }),
});

// 3. Monitor with webhooks (automatically handled)
```

---

## 🚀 Best Practices

### Performance:
- ✅ Use pagination for large result sets
- ✅ Analytics are cached (5-30 min TTL)
- ✅ Use batch operations for bulk actions
- ✅ Implement exponential backoff for retries

### Security:
- ✅ Always validate auth tokens
- ✅ Never expose API keys in responses
- ✅ Respect rate limits
- ✅ Sanitize all inputs
- ✅ Use HTTPS in production

### Reliability:
- ✅ Handle rate limit errors (429)
- ✅ Implement retry logic for 5xx errors
- ✅ Use idempotency keys for critical operations
- ✅ Monitor webhook deliveries

---

## 📞 Support

For API questions or issues:
- GitHub Issues: https://github.com/your-repo/issues
- Email: support@your-domain.com
- Documentation: https://docs.your-domain.com

---

**Last Updated:** December 23, 2025  
**API Version:** 1.0.0




