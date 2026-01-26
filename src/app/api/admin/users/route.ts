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

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Firestore timestamp interface
 */
interface FirestoreTimestamp {
  toDate(): Date;
}

/**
 * Raw Firestore user document data (all fields optional as stored in DB)
 */
interface FirestoreUserData {
  readonly email?: string;
  readonly name?: string;
  readonly displayName?: string;
  readonly role?: string;
  readonly organizationId?: string;
  readonly createdAt?: FirestoreTimestamp | Timestamp;
  readonly updatedAt?: FirestoreTimestamp | Timestamp;
  readonly lastLoginAt?: FirestoreTimestamp | Timestamp;
}

/**
 * Validated user data for API response
 */
interface UserData {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly organizationId: string;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly lastLoginAt: string | null;
}

/**
 * Request body for updating a user
 */
interface UpdateUserRequestBody {
  readonly userId: string;
  readonly name?: string;
  readonly role?: string;
  readonly organizationId?: string;
  readonly status?: string;
}

/**
 * Validated update fields that will be written to Firestore
 */
interface ValidatedUpdateFields {
  name?: string;
  role?: string;
  organizationId?: string;
  status?: string;
  updatedAt: ReturnType<typeof FieldValue.serverTimestamp>;
  updatedBy: string;
}

/**
 * GET response with pagination
 */
interface GetUsersResponse {
  readonly users: readonly UserData[];
  readonly pagination: {
    readonly count: number;
    readonly hasMore: boolean;
    readonly nextCursor: string | null;
  };
  readonly fetchedAt: string;
}

/**
 * PATCH response
 */
interface UpdateUserResponse {
  readonly success: true;
  readonly userId: string;
  readonly updatedFields: readonly string[];
}

// ============================================================================
// TYPE GUARDS & VALIDATORS
// ============================================================================

/**
 * Type guard for update user request body
 * Validates that the body has required userId field
 */
function isUpdateUserRequestBody(body: unknown): body is UpdateUserRequestBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const obj = body as Record<string, unknown>;
  return typeof obj.userId === 'string' && obj.userId.length > 0;
}

/**
 * Type guard for objects with toDate method (Firestore Timestamps)
 */
function hasToDateMethod(value: unknown): value is { toDate: () => Date } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as Record<string, unknown>).toDate === 'function'
  );
}

/**
 * Safely convert Firestore timestamp to ISO string
 * Returns null if conversion fails or timestamp is invalid
 */
function timestampToISOString(timestamp: unknown): string | null {
  if (!timestamp) {
    return null;
  }

  if (!hasToDateMethod(timestamp)) {
    return null;
  }

  try {
    const date = timestamp.toDate();
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  } catch (error: unknown) {
    logger.warn('Failed to convert timestamp', {
      error: error instanceof Error ? error.message : 'Unknown error',
      route: '/api/admin/users'
    });
    return null;
  }
}

/**
 * Transform Firestore user data to validated UserData
 * Provides safe defaults for all required fields
 */
function transformFirestoreUser(docId: string, data: FirestoreUserData): UserData {
  return {
    id: docId,
    email: data.email ?? '',
    name: (data.name ?? data.displayName) ?? 'Unknown',
    role: data.role ?? 'member',
    organizationId: data.organizationId ?? '',
    createdAt: timestampToISOString(data.createdAt),
    updatedAt: timestampToISOString(data.updatedAt),
    lastLoginAt: timestampToISOString(data.lastLoginAt),
  };
}

/**
 * GET /api/admin/users
 * Fetches users for platform_admin with pagination
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

    // Transform Firestore documents to validated UserData objects
    const users: readonly UserData[] = docs.map(doc => {
      const data = doc.data() as FirestoreUserData;
      return transformFirestoreUser(doc.id, data);
    });

    // Get cursor for next page (last user's createdAt)
    const lastUser = users.length > 0 ? users[users.length - 1] : null;
    const nextCursor = hasMore && lastUser ? lastUser.createdAt : null;
    
    logger.info('Admin fetched users', {
      route: '/api/admin/users',
      admin: authResult.user.email,
      count: users.length,
      hasMore
    });

    const response: GetUsersResponse = {
      users,
      pagination: {
        count: users.length,
        hasMore,
        nextCursor,
      },
      fetchedAt: new Date().toISOString()
    };

    return createSuccessResponse(response);

  } catch (error: unknown) {
    logger.error('Admin users fetch error', error instanceof Error ? error : new Error(String(error)), { route: '/api/admin/users' });
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
 * Updates a user (platform_admin only)
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

    // Build validated update object with only provided fields
    const partialUpdates: Partial<Omit<ValidatedUpdateFields, 'updatedAt' | 'updatedBy'>> = {};

    if (body.name !== undefined) {
      partialUpdates.name = body.name;
    }
    if (body.role !== undefined) {
      partialUpdates.role = body.role;
    }
    if (body.organizationId !== undefined) {
      partialUpdates.organizationId = body.organizationId;
    }
    if (body.status !== undefined) {
      partialUpdates.status = body.status;
    }

    const updateFieldNames = Object.keys(partialUpdates) as Array<keyof typeof partialUpdates>;

    if (updateFieldNames.length === 0) {
      return createErrorResponse('No valid update fields provided', 400);
    }

    // Create final updates object with audit fields
    const updates: ValidatedUpdateFields & Partial<Omit<ValidatedUpdateFields, 'updatedAt' | 'updatedBy'>> = {
      ...partialUpdates,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: authResult.user.uid,
    };

    await adminDal.safeUpdateDoc('USERS', body.userId, updates, {
      audit: true,
      userId: authResult.user.uid,
    });

    logger.info('Admin updated user', {
      route: '/api/admin/users',
      admin: authResult.user.email,
      userId: body.userId,
      fields: updateFieldNames
    });

    const response: UpdateUserResponse = {
      success: true,
      userId: body.userId,
      updatedFields: updateFieldNames
    };

    return createSuccessResponse(response);

  } catch (error: unknown) {
    logger.error('Admin user update error', error instanceof Error ? error : new Error(String(error)), { route: '/api/admin/users' });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to update user: ${errorMessage}`
        : 'Failed to update user',
      500
    );
  }
}
