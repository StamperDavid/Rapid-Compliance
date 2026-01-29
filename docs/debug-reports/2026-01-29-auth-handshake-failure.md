# Forensic Debug Report: /api/system/status 401 Unauthorized

**Date:** January 29, 2026
**Severity:** CRITICAL
**Status:** ROOT CAUSE IDENTIFIED
**Branch:** dev
**Auditor:** Multi-Agent Forensic Team (Frontend, Backend, Wiring Sub-Agents)

---

## Executive Summary

The `/api/system/status` endpoint returns **401 Unauthorized** because the frontend hook `useSystemStatus.ts` does **NOT** send an `Authorization` header with the Firebase ID Token. The backend `verifyAdminRequest()` function requires a Bearer token, but the frontend only sends `Content-Type: application/json`.

---

## Investigation Questions Answered

### 1. Header Presence: Does the fetch request contain an Authorization header?

**ANSWER: NO**

**File:** `src/hooks/useSystemStatus.ts` (Lines 151-157)

```typescript
const response = await fetch(url, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    // NO AUTHORIZATION HEADER
  },
  credentials: 'include',
});
```

The `credentials: 'include'` only sends cookies, but the backend does NOT use cookie-based authentication.

---

### 2. Token Validity: Is the token being sent a "Session Token" or a "Firebase ID Token"?

**ANSWER: NO TOKEN IS BEING SENT**

The hook does not import or use any authentication mechanism:

```typescript
// useSystemStatus.ts imports
import { useState, useEffect, useCallback, useRef } from 'react';
import type { SystemStatusResponse, SystemAgentStatus, AgentTier } from '@/app/api/system/status/route';

// Missing:
// - useUnifiedAuth
// - auth from Firebase
// - Any token retrieval logic
```

**Expected Token Type:** Firebase ID Token (JWT)
**Expected Retrieval Method:** `auth.currentUser?.getIdToken()`

---

### 3. Tenant Scoping: Is the tenantId missing from the request?

**ANSWER: NO - TenantId is correctly sent as query parameter**

**File:** `src/hooks/useSystemStatus.ts` (Lines 147-149)

```typescript
const url = tenantId
  ? `/api/system/status?tenantId=${encodeURIComponent(tenantId)}`
  : '/api/system/status';
```

**Backend Extraction:** `src/app/api/system/status/route.ts` (Lines 713-714)

```typescript
const { searchParams } = new URL(request.url);
const tenantId = searchParams.get('tenantId') ?? authResult.user.tenantId ?? 'default';
```

**Verdict:** TenantId transmission is NOT the issue. The request fails at the authentication step before tenant validation occurs.

---

### 4. Route Conflict: Is the middleware interfering with the API route?

**ANSWER: NO - Middleware explicitly skips API routes**

**File:** `src/middleware.ts` (Lines 119-126)

```typescript
if (
  pathname.startsWith('/api/') ||
  pathname.startsWith('/_next/') ||
  pathname.startsWith('/static/') ||
  pathname.includes('.')
) {
  return NextResponse.next();
}
```

**Verdict:** Middleware does NOT interfere with `/api/system/status`. Headers pass through unmodified.

---

## Authentication Flow Analysis

### Backend Requirements

**File:** `src/lib/api/admin-auth.ts`

```typescript
export async function verifyAdminRequest(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'Missing or invalid Authorization header',  // <-- THIS ERROR
      status: 401,
    };
  }

  const token = authHeader.split('Bearer ')[1];

  if (!token || token.length < 100) {
    return { success: false, error: 'Invalid token format', status: 401 };
  }

  // Firebase Admin SDK verification
  const decodedToken = await adminAuth.verifyIdToken(token);
  // ... claims extraction and role validation
}
```

### Expected Token Claims

```typescript
interface ExpectedClaims {
  uid: string;           // Firebase User ID
  email: string;         // User email
  tenant_id: string;     // Organization ID (snake_case in JWT)
  role: string;          // 'platform_admin' | 'admin'
  admin: boolean;        // Legacy admin flag
}
```

---

## Root Cause Flow

```
1. Component mounts → SwarmMonitorWidget calls useSystemStatus()
2. Hook executes fetch → Request to /api/system/status
3. Headers sent: { "Content-Type": "application/json" }
4. Backend receives request → verifyAdminRequest() called
5. authHeader = null → Returns 401 "Missing or invalid Authorization header"
6. Hook catches error → Sets error state
7. UI shows → "Unable to connect to swarm"
```

---

## Contract Mismatch Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND SENDS:                                                  │
├─────────────────────────────────────────────────────────────────┤
│ GET /api/system/status?tenantId=xxx                             │
│ Headers:                                                         │
│   Content-Type: application/json                                │
│   (cookies via credentials: 'include')                          │
│                                                                  │
│ Authorization: [MISSING]                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ BACKEND EXPECTS:                                                 │
├─────────────────────────────────────────────────────────────────┤
│ GET /api/system/status                                          │
│ Headers:                                                         │
│   Authorization: Bearer <Firebase-ID-Token>                     │
│   Content-Type: application/json                                │
│                                                                  │
│ Token must contain: uid, email, tenant_id, role, admin          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Working Reference Code

**File:** `src/hooks/useUnifiedAuth.ts` (Lines 82-89)

This shows the correct pattern that SHOULD be used:

```typescript
const response = await fetch('/api/admin/verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,  // CORRECT
    'Content-Type': 'application/json',
  },
});
```

**File:** `src/app/admin/swarm/page.tsx` (Lines 372-377)

Another working reference:

```typescript
const token = await auth?.currentUser?.getIdToken();

const response = await fetch('/api/admin/swarm/execute', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,  // CORRECT
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({...}),
});
```

---

## Related Files

| Category | File | Purpose |
|----------|------|---------|
| **BROKEN** | `src/hooks/useSystemStatus.ts` | Missing auth token in fetch |
| Auth Hook | `src/hooks/useUnifiedAuth.ts` | Token retrieval pattern |
| Backend Auth | `src/lib/api/admin-auth.ts` | Token validation |
| Claims Validator | `src/lib/auth/claims-validator.ts` | Tenant/role validation |
| API Route | `src/app/api/system/status/route.ts` | Protected endpoint |
| Middleware | `src/middleware.ts` | Route interception (skips API) |

---

## Impact Assessment

| Component | Impact |
|-----------|--------|
| Swarm Monitor Widget | Cannot display agent status |
| System Health Dashboard | Shows error state |
| Real-time Metrics | Unavailable |
| Admin Visibility | Degraded |

---

## Recommended Fix (For Reference Only - NO CHANGES MADE)

**File:** `src/hooks/useSystemStatus.ts`

```typescript
// ADD: Import Firebase auth
import { auth } from '@/lib/firebase/config';

// MODIFY: fetchStatus function
const fetchStatus = useCallback(async (isManualRefresh = false) => {
  // ... existing setup code ...

  try {
    // GET: Firebase ID Token
    const token = await auth?.currentUser?.getIdToken();

    if (!token) {
      throw new Error('User not authenticated');
    }

    const url = tenantId
      ? `/api/system/status?tenantId=${encodeURIComponent(tenantId)}`
      : '/api/system/status';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,  // ADD THIS LINE
      },
    });
    // ... rest of function
  }
}, [tenantId]);
```

---

## SignalBus Hardening Context

Recent commit `a724918b` added strict multi-tenant isolation to SignalBus:

```
security: harden SignalBus with strict multi-tenant isolation
- Add mandatory tenantId to Signal and SignalHandler interfaces
- Add O(1) tenant lookup for all signal operations
- Add validateTenantContext() middleware for all public methods
```

This hardening does NOT directly cause the 401 error, but confirms the platform's direction toward strict tenant validation, which requires authenticated requests with valid tenant claims.

---

## Verification Checklist

| Check | Result |
|-------|--------|
| Route requires authentication? | YES (verifyAdminRequest) |
| Frontend sends Authorization header? | **NO (BUG)** |
| Token type expected? | Firebase ID Token |
| Middleware interferes? | NO |
| TenantId sent correctly? | YES (query param) |
| Claims validation correct? | YES |

---

## Conclusion

**Root Cause:** `useSystemStatus.ts` does not retrieve or send the Firebase ID Token in the Authorization header.

**Fix Complexity:** Low - Single file modification

**Security Impact:** None - Backend correctly enforces authentication; frontend simply needs to comply.

---

*Report generated by Multi-Agent Forensic Debugging System*
