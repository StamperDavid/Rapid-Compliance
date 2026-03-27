import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import {
  verifyAdminRequest,
  createErrorResponse,
  createSuccessResponse,
  isAuthError
} from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

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
  readonly status?: string;
}

/**
 * Validated update fields that will be written to Firestore
 */
interface ValidatedUpdateFields {
  name?: string;
  role?: string;
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
// SCHEMAS & VALIDATORS
// ============================================================================

const UpdateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
});

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

  // Handle Firestore Timestamp objects
  if (hasToDateMethod(timestamp)) {
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

  // Handle plain ISO strings
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }

  // Handle Firestore admin Timestamp serialized as { _seconds, _nanoseconds }
  const ts = timestamp as Record<string, unknown>;
  if (typeof ts._seconds === 'number') {
    return new Date(ts._seconds * 1000).toISOString();
  }

  return null;
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
    createdAt: timestampToISOString(data.createdAt),
    updatedAt: timestampToISOString(data.updatedAt),
    lastLoginAt: timestampToISOString(data.lastLoginAt),
  };
}

/**
 * GET /api/admin/users
 * Fetches users for admin with pagination
 * Uses Admin SDK to bypass client-side Firestore rules
 *
 * Query params:
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
    const limitParam = searchParams.get('limit');
    const pageSize = Math.min(parseInt((limitParam !== '' && limitParam != null) ? limitParam : '50'), 100);
    const startAfter = searchParams.get('startAfter'); // ISO timestamp

    // Fetch ALL users without orderBy to avoid Firestore mixed-type issues
    // (some docs have Timestamp createdAt, others have string — Firestore
    // orderBy separates them into type-buckets, which can silently exclude docs).
    // We sort client-side after filtering out system/agent users.
    const usersSnapshot = await adminDal.safeQuery('USERS', (ref) => {
      return ref.limit(500);
    });

    // Filter out system agent users (not real team members)
    const humanDocs = usersSnapshot.docs.filter((doc) => {
      const id = doc.id;
      const data = doc.data() as FirestoreUserData;
      // Exclude agent service accounts and demo data
      const isAgent = id.startsWith('agent_') || (data.email ?? '').includes('@ai-agent.');
      return !isAgent;
    });

    // Transform and sort by createdAt descending (handles mixed timestamp types)
    const allUsers: UserData[] = humanDocs.map((doc) => {
      const data = doc.data() as FirestoreUserData;
      return transformFirestoreUser(doc.id, data);
    });

    allUsers.sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });

    // Apply pagination
    const startIndex = startAfter
      ? allUsers.findIndex((u) => u.createdAt === startAfter) + 1
      : 0;
    const paged = allUsers.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < allUsers.length;
    const users: readonly UserData[] = paged;

    // Get cursor for next page
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
 * Updates a user (admin only)
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

    const parsed = UpdateUserSchema.safeParse(rawBody);
    if (!parsed.success) {
      return createErrorResponse('User ID is required', 400);
    }

    const body: UpdateUserRequestBody = parsed.data;

    // Build validated update object with only provided fields
    const partialUpdates: Partial<Omit<ValidatedUpdateFields, 'updatedAt' | 'updatedBy'>> = {};

    if (body.name !== undefined) {
      partialUpdates.name = body.name;
    }
    if (body.role !== undefined) {
      partialUpdates.role = body.role;
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

    // Propagate role change to Firebase Auth custom claims so the JWT
    // reflects the new role immediately (not just after re-login)
    if (body.role !== undefined) {
      try {
        const adminAuth = getAuth();
        const isAdminRole = body.role === 'owner' || body.role === 'admin';
        await adminAuth.setCustomUserClaims(body.userId, {
          role: body.role,
          admin: isAdminRole,
        });
        logger.info('Firebase claims updated for role change', {
          route: '/api/admin/users',
          userId: body.userId,
          newRole: body.role,
        });
      } catch (claimsErr) {
        // Log but don't fail the response — Firestore is the source of truth
        logger.warn('Failed to update Firebase claims after role change', {
          route: '/api/admin/users',
          userId: body.userId,
          error: claimsErr instanceof Error ? claimsErr.message : String(claimsErr),
        });
      }
    }

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

/**
 * DELETE /api/admin/users
 * Removes a user (admin/owner only)
 * Deletes the Firestore profile and disables the Firebase Auth account
 */
export async function DELETE(request: NextRequest) {
  const authResult = await verifyAdminRequest(request);

  if (isAuthError(authResult)) {
    return createErrorResponse(authResult.error, authResult.status);
  }

  try {
    if (!adminDal) {
      return createErrorResponse('Server configuration error', 500);
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || userId.length === 0) {
      return createErrorResponse('userId query parameter is required', 400);
    }

    // Prevent self-deletion
    if (userId === authResult.user.uid) {
      return createErrorResponse('Cannot remove yourself', 400);
    }

    // Prevent deleting owners (only another owner can remove an owner)
    const targetUserDoc = await adminDal.safeGetDoc('USERS', userId);
    if (!targetUserDoc.exists) {
      return createErrorResponse('User not found', 404);
    }

    const targetUserData = targetUserDoc.data();
    const targetRole = typeof targetUserData?.role === 'string' ? targetUserData.role : 'member';

    // Check if the requesting admin is an owner (look up their Firestore profile)
    if (targetRole === 'owner') {
      const adminDoc = await adminDal.safeGetDoc('USERS', authResult.user.uid);
      const adminData = adminDoc.exists ? adminDoc.data() : null;
      const adminRole = typeof adminData?.role === 'string' ? adminData.role : 'admin';
      if (adminRole !== 'owner') {
        return createErrorResponse('Only an owner can remove another owner', 403);
      }
    }

    // Disable the Firebase Auth account (don't delete — preserves audit trail)
    try {
      const adminAuth = getAuth();
      await adminAuth.updateUser(userId, { disabled: true });
    } catch (authError) {
      logger.warn('Failed to disable Firebase Auth user (may not exist)', {
        userId,
        error: authError instanceof Error ? authError.message : String(authError),
      });
    }

    // Mark user as removed in Firestore (soft delete with audit trail)
    await adminDal.safeUpdateDoc('USERS', userId, {
      status: 'removed',
      removedAt: FieldValue.serverTimestamp(),
      removedBy: authResult.user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    }, {
      audit: true,
      userId: authResult.user.uid,
    });

    logger.info('Admin removed user', {
      route: '/api/admin/users',
      admin: authResult.user.email,
      removedUserId: userId,
      removedUserRole: targetRole,
    });

    return createSuccessResponse({
      success: true,
      userId,
      message: 'User removed successfully',
    });

  } catch (error: unknown) {
    logger.error('Admin user delete error', error instanceof Error ? error : new Error(String(error)), { route: '/api/admin/users' });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to remove user: ${errorMessage}`
        : 'Failed to remove user',
      500
    );
  }
}
