# Admin SDK Architecture - Best Practice Implementation

## Overview

This document explains the secure architecture for privileged Firestore operations using Firebase Admin SDK on the server side.

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
│  - Uses Client SDK (firebase/firestore)                         │
│  - Subject to Security Rules                                     │
│  - Limited permissions                                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Authenticated API Call
                             │ (Bearer Token)
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    API ROUTES (Server/Node.js)                   │
│  - Validates authentication & authorization                      │
│  - Uses Admin SDK (firebase-admin)                              │
│  - Bypasses security rules (trusted environment)                 │
│  - Performs privileged operations                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                         FIRESTORE                                │
│  - Strict security rules protect against malicious clients      │
│  - Admin SDK operations bypass rules                             │
└─────────────────────────────────────────────────────────────────┘
```

## Why This Is Secure

### ✅ Best Practice Benefits:

1. **Server-Side Validation**: All privileged operations go through server-side validation
2. **Admin SDK is Server-Only**: Never exposed to client, can't be compromised
3. **Strict Security Rules**: Client SDK operations are tightly controlled
4. **Audit Trail**: All operations logged on server
5. **Production-Ready**: Google-recommended pattern for production apps

### ❌ Alternative (Less Secure):

Making security rules permissive to allow client writes would:
- Expose your database to potential abuse
- Make security rules complex and error-prone
- Bypass server-side business logic validation
- Harder to audit and monitor

## Implementation

### 1. Admin Firestore Service

**File**: `src/lib/db/admin-firestore-service.ts`

```typescript
import { adminDb } from '@/lib/firebase/admin';

export class AdminFirestoreService {
  // Bypasses security rules - SERVER ONLY
  static async set(collectionPath: string, docId: string, data: any) {
    await adminDb.collection(collectionPath).doc(docId).set(data);
  }
  // ... other methods
}
```

### 2. Hybrid Functions (Server + Client)

**File**: `src/lib/agent/base-model-builder.ts`

Functions that can be called from both server and client automatically choose the right SDK:

```typescript
const isServer = typeof window === 'undefined';

export async function saveBaseModel(baseModel: BaseModel): Promise<void> {
  if (isServer) {
    // Admin SDK - bypasses rules
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    await AdminFirestoreService.set('baseModels', baseModel.id, baseModel);
  } else {
    // Client SDK - follows rules
    const { db } = await import('@/lib/firebase/config');
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'baseModels', baseModel.id), baseModel);
  }
}
```

### 3. API Routes with Auth

**File**: `src/app/api/agent/process-onboarding/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // 1. Validate authentication
  const authResult = await requireOrganization(request);
  if (authResult instanceof NextResponse) return authResult;
  
  // 2. Validate authorization
  if (user.organizationId !== organizationId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  
  // 3. Use Admin SDK for privileged operations
  const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
  await AdminFirestoreService.set(
    `organizations/${organizationId}/onboarding`,
    'current',
    onboardingData
  );
}
```

## Security Rules

Security rules remain **strict** because Admin SDK operations bypass them:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Strict rules for client SDK
    match /organizations/{orgId}/{subcollection}/{docId} {
      allow read, write: if isAuthenticated() && belongsToOrg(orgId);
    }
    
    // Admin SDK bypasses these rules entirely
  }
}
```

## Development vs Production

### Development
- Admin SDK uses emulator when `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`
- Set `FIRESTORE_EMULATOR_HOST=localhost:8080`

### Production (Vercel/Cloud)
- Admin SDK uses service account credentials
- Set environment variables:
  - `FIREBASE_ADMIN_PROJECT_ID`
  - `FIREBASE_ADMIN_CLIENT_EMAIL`
  - `FIREBASE_ADMIN_PRIVATE_KEY`

## Files Modified for Best Practice

1. **Created**:
   - `src/lib/db/admin-firestore-service.ts` - Admin SDK wrapper

2. **Updated to use Admin SDK**:
   - `src/lib/agent/onboarding-processor.ts` - Server-side processor
   - `src/lib/agent/base-model-builder.ts` - Hybrid functions
   - `src/app/api/agent/process-onboarding/route.ts` - API route

3. **Updated to call API only**:
   - `src/app/workspace/[orgId]/onboarding/page.tsx` - Client page

## Key Principles

1. **Never expose Admin SDK to client**: Always runs server-side only
2. **Validate before using Admin SDK**: Check auth & authorization first
3. **Keep security rules strict**: Protect against malicious clients
4. **Log privileged operations**: Audit trail for security
5. **Use client SDK for user operations**: Only use Admin for privileged tasks

## Common Use Cases for Admin SDK

✅ **Use Admin SDK for**:
- Onboarding flows (creating initial data)
- Bulk operations (importing data)
- Admin functions (user management)
- System-triggered updates (cron jobs)
- Complex multi-document transactions

❌ **Use Client SDK for**:
- User reading their own data
- User updating their profile
- CRUD operations within their org
- Real-time listeners
- Offline support

## Testing

### Local Development
```bash
# Start emulators
firebase emulators:start

# Set environment variable
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true npm run dev
```

### Production Deployment
1. Set Admin SDK environment variables in Vercel
2. Security rules are automatically enforced
3. Admin SDK uses service account credentials

## Summary

This architecture follows Google's recommended best practices:
- ✅ Admin SDK for server-side privileged operations
- ✅ Client SDK for user operations
- ✅ Strict security rules for protection
- ✅ Server-side validation and authorization
- ✅ Production-ready and scalable

The "fast fix" (loosening security rules) would have been a security vulnerability. This implementation is secure, maintainable, and production-ready.



