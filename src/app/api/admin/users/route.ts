import type { NextRequest } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import {
  verifyAdminRequest,
  createErrorResponse,
  createSuccessResponse,
  isAuthError
} from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

// Firestore document data interfaces
interface FirestoreTimestamp {
  toDate(): Date;
}

interface FirestoreUserData {
  email?: string;
  name?: string;
  displayName?: string;
  role?: string;
  organizationId?: string;
  createdAt?: FirestoreTimestamp | Timestamp;
  updatedAt?: FirestoreTimestamp | Timestamp;
  lastLoginAt?: FirestoreTimestamp | Timestamp;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
}

interface UpdateUserRequestBody {
  userId: string;
  name?: string;
  role?: string;
  organizationId?: string;
  status?: string;
}

// Type guard for request body
function isUpdateUserRequestBody(body: unknown): body is UpdateUserRequestBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const obj = body as Record<string, unknown>;
  return typeof obj.userId === 'string';
}

// Helper to safely convert Firestore timestamp to ISO string
function timestampToISOString(timestamp: unknown): string | null {
  if (!timestamp || typeof timestamp !== 'object') {
    return null;
  }

  const ts = timestamp as { toDate?: () => Date };
  if (typeof ts.toDate === 'function') {
    try {
      const date = ts.toDate();
      return date.toISOString();
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * GET /api/admin/users
 * Fetches users for super_admin with pagination
 * Uses Admin SDK to bypass client-side Firestore rules
 * 
 * Query params:
 * - organizationId: filter by org (optional)
 * - limit: page size (default 50, max 100)
 * - startAfter: cursor for pagination (timestamp)
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/admin/users');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Verify admin authentication
  const authResult = await verifyAdminRequest(request);
  
  if (isAuthError(authResult)) {
    return createErrorResponse(authResult.error, authResult.status);
  }
  
  try {
    if (!adminDal) {
      return createErrorResponse('Server configuration error', 500);
    }
    
    // Parse query params for filtering and pagination
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const limitParam = searchParams.get('limit');
    const pageSize = Math.min(parseInt((limitParam !== '' && limitParam != null) ? limitParam : '50'), 100);
    const startAfter = searchParams.get('startAfter'); // ISO timestamp
    
    // Build query using Admin DAL
    const usersSnapshot = await adminDal.safeQuery('USERS', (ref) => {
      let query = ref.orderBy('createdAt', 'desc');
      
      if (organizationId) {
        query = query.where('organizationId', '==', organizationId);
      }
      
      // Add cursor if provided
      if (startAfter) {
        const cursorDate = new Date(startAfter);
        query = query.startAfter(cursorDate);
      }
      
      // Fetch one extra to check if there are more results
      return query.limit(pageSize + 1);
    });
    
    const hasMore = usersSnapshot.docs.length > pageSize;
    const docs = hasMore ? usersSnapshot.docs.slice(0, pageSize) : usersSnapshot.docs;

    const users: UserData[] = docs.map(doc => {
      const data = doc.data() as FirestoreUserData;
      return {
        id: doc.id,
        email: data.email ?? '',
        name: (data.name || data.displayName) ? (data.name ?? data.displayName ?? 'Unknown') : 'Unknown',
        role: data.role ?? 'member',
        organizationId: data.organizationId ?? '',
        createdAt: timestampToISOString(data.createdAt),
        updatedAt: timestampToISOString(data.updatedAt),
        lastLoginAt: timestampToISOString(data.lastLoginAt),
      };
    });
    
    // Get cursor for next page (last user's createdAt)
    const nextCursor = hasMore && users.length > 0 
      ? users[users.length - 1].createdAt 
      : null;
    
    logger.info('Admin fetched users', { 
      route: '/api/admin/users',
      admin: authResult.user.email, 
      count: users.length, 
      hasMore 
    });
    
    return createSuccessResponse({
      users,
      pagination: {
        count: users.length,
        hasMore,
        nextCursor,
      },
      fetchedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    logger.error('Admin users fetch error', error, { route: '/api/admin/users' });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to fetch users: ${errorMessage}`
        : 'Failed to fetch users',
      500
    );
  }
}

/**
 * PATCH /api/admin/users
 * Updates a user (super_admin only)
 */
export async function PATCH(request: NextRequest) {
  // Verify admin authentication  
  const authResult = await verifyAdminRequest(request);
  
  if (isAuthError(authResult)) {
    return createErrorResponse(authResult.error, authResult.status);
  }
  
  try {
    if (!adminDal) {
      return createErrorResponse('Server configuration error', 500);
    }

    const rawBody: unknown = await request.json();

    if (!isUpdateUserRequestBody(rawBody)) {
      return createErrorResponse('User ID is required', 400);
    }

    const body: UpdateUserRequestBody = rawBody;

    // Validate update fields
    const allowedFields: Array<keyof UpdateUserRequestBody> = ['name', 'role', 'organizationId', 'status'];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field !== 'userId' && body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return createErrorResponse('No valid update fields provided', 400);
    }

    updates.updatedAt = FieldValue.serverTimestamp();
    updates.updatedBy = authResult.user.uid;

    await adminDal.safeUpdateDoc('USERS', body.userId, updates, {
      audit: true,
      userId: authResult.user.uid,
    });

    logger.info('Admin updated user', {
      route: '/api/admin/users',
      admin: authResult.user.email,
      userId: body.userId,
      fields: Object.keys(updates)
    });

    return createSuccessResponse({
      success: true,
      userId: body.userId,
      updatedFields: Object.keys(updates).filter(k => k !== 'updatedAt' && k !== 'updatedBy')
    });

  } catch (error: unknown) {
    logger.error('Admin user update error', error, { route: '/api/admin/users' });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to update user: ${errorMessage}`
        : 'Failed to update user',
      500
    );
  }
}
