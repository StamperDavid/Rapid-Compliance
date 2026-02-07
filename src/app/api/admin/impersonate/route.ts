/**
 * Admin Impersonation API
 * Owner-only endpoint to manage user impersonation sessions
 *
 * POST   - Start an impersonation session
 * DELETE - End an impersonation session
 * GET    - List impersonation sessions
 *
 * Security:
 * - Owner role required (canImpersonateUsers permission)
 * - All sessions audited in Firestore
 * - Reason required for compliance
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import {
  verifyAdminRequest,
  createErrorResponse,
  createSuccessResponse,
  isAuthError,
} from '@/lib/api/admin-auth';
import { adminDb } from '@/lib/firebase/admin';
import { adminDal } from '@/lib/firebase/admin-dal';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { hasUnifiedPermission, type AccountRole } from '@/types/unified-rbac';

export const dynamic = 'force-dynamic';

// ============================================================================
// REQUEST VALIDATION SCHEMAS
// ============================================================================

const StartImpersonationSchema = z.object({
  targetUserId: z.string().min(1, 'Target user ID is required'),
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500, 'Reason too long'),
});

const EndImpersonationSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface FirestoreUserData {
  readonly email?: string;
  readonly name?: string;
  readonly displayName?: string;
  readonly role?: string;
  readonly organizationId?: string;
  readonly status?: string;
}

interface ImpersonationSessionData {
  readonly sessionId: string;
  readonly ownerId: string;
  readonly ownerEmail: string;
  readonly targetUserId: string;
  readonly targetUserEmail: string;
  readonly targetUserName: string;
  readonly targetUserRole: string;
  readonly reason: string;
  readonly status: 'active' | 'ended';
  readonly startedAt: ReturnType<typeof FieldValue.serverTimestamp>;
  readonly endedAt: ReturnType<typeof FieldValue.serverTimestamp> | null;
}

interface SessionResponse {
  readonly sessionId: string;
  readonly ownerId: string;
  readonly ownerEmail: string;
  readonly targetUserId: string;
  readonly targetUserEmail: string;
  readonly targetUserName: string;
  readonly targetUserRole: string;
  readonly reason: string;
  readonly status: string;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

const SESSIONS_COLLECTION = 'impersonationSessions';

function getSessionsCollection() {
  if (!adminDb) {
    throw new Error('Firebase Admin not initialized');
  }
  return adminDb.collection(SESSIONS_COLLECTION);
}

function timestampToISO(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const dateObj = value as { toDate: () => Date };
    try {
      return dateObj.toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Verify the requesting user has the owner role (canImpersonateUsers)
 */
async function verifyOwnerPermission(request: NextRequest) {
  const authResult = await verifyAdminRequest(request);

  if (isAuthError(authResult)) {
    return { success: false as const, error: authResult.error, status: authResult.status };
  }

  // Get user's actual role from Firestore to check owner permission
  if (!adminDb) {
    return { success: false as const, error: 'Server configuration error', status: 500 as const };
  }

  const userDoc = await adminDb.collection(COLLECTIONS.USERS).doc(authResult.user.uid).get();
  const userData = userDoc.exists ? (userDoc.data() as FirestoreUserData) : null;
  const effectiveRole = (userData?.role ?? 'member') as AccountRole;

  if (!hasUnifiedPermission(effectiveRole, 'canImpersonateUsers')) {
    logger.warn('Non-owner attempted impersonation', {
      userId: authResult.user.uid,
      email: authResult.user.email,
      role: effectiveRole,
      route: '/api/admin/impersonate',
    });
    return { success: false as const, error: 'Only the owner can impersonate users', status: 403 as const };
  }

  return {
    success: true as const,
    user: { ...authResult.user, role: effectiveRole },
  };
}

// ============================================================================
// POST - Start impersonation session
// ============================================================================

export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/admin/impersonate');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const permResult = await verifyOwnerPermission(request);
  if (!permResult.success) {
    return createErrorResponse(permResult.error, permResult.status);
  }

  try {
    const rawBody: unknown = await request.json();
    const validation = StartImpersonationSchema.safeParse(rawBody);

    if (!validation.success) {
      return createErrorResponse(
        `Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`,
        400
      );
    }

    const { targetUserId, reason } = validation.data;
    const owner = permResult.user;

    // Prevent self-impersonation
    if (targetUserId === owner.uid) {
      return createErrorResponse('Cannot impersonate yourself', 400);
    }

    // Look up target user
    if (!adminDal) {
      return createErrorResponse('Server configuration error', 500);
    }

    const targetDoc = await adminDal.safeGetDoc('USERS', targetUserId);
    if (!targetDoc.exists) {
      return createErrorResponse('Target user not found', 404);
    }

    const targetData = targetDoc.data() as FirestoreUserData;

    // Don't allow impersonating another owner
    if (targetData.role === 'owner') {
      return createErrorResponse('Cannot impersonate the owner account', 400);
    }

    // Check for existing active session
    const activeSessions = await getSessionsCollection()
      .where('ownerId', '==', owner.uid)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!activeSessions.empty) {
      return createErrorResponse(
        'An active impersonation session already exists. End it before starting a new one.',
        409
      );
    }

    // Create session
    const sessionId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const sessionData: ImpersonationSessionData = {
      sessionId,
      ownerId: owner.uid,
      ownerEmail: owner.email,
      targetUserId,
      targetUserEmail: targetData.email ?? '',
      targetUserName: (targetData.name ?? targetData.displayName) ?? 'Unknown',
      targetUserRole: targetData.role ?? 'member',
      reason,
      status: 'active',
      startedAt: FieldValue.serverTimestamp(),
      endedAt: null,
    };

    await getSessionsCollection().doc(sessionId).set(sessionData);

    // Audit log
    await adminDal.safeAddDoc('AUDIT_LOGS', {
      action: 'impersonation_started',
      performedBy: owner.email,
      performedByUid: owner.uid,
      targetUserId,
      targetEmail: targetData.email ?? '',
      reason,
      sessionId,
      timestamp: FieldValue.serverTimestamp(),
    }, { audit: false, userId: owner.uid });

    logger.info('Impersonation session started', {
      sessionId,
      ownerEmail: owner.email,
      targetUserId,
      targetEmail: targetData.email,
      reason,
      route: '/api/admin/impersonate',
    });

    return createSuccessResponse({
      success: true,
      session: {
        sessionId,
        targetUserId,
        targetUserEmail: targetData.email ?? '',
        targetUserName: (targetData.name ?? targetData.displayName) ?? 'Unknown',
        targetUserRole: targetData.role ?? 'member',
        reason,
        status: 'active',
      },
      message: 'Impersonation session started',
    });
  } catch (error: unknown) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error('Impersonation start error', errorObj, { route: '/api/admin/impersonate' });
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to start impersonation: ${errorObj.message}`
        : 'Failed to start impersonation session',
      500
    );
  }
}

// ============================================================================
// DELETE - End impersonation session
// ============================================================================

export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/admin/impersonate');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const permResult = await verifyOwnerPermission(request);
  if (!permResult.success) {
    return createErrorResponse(permResult.error, permResult.status);
  }

  try {
    const rawBody: unknown = await request.json();
    const validation = EndImpersonationSchema.safeParse(rawBody);

    if (!validation.success) {
      return createErrorResponse(
        `Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`,
        400
      );
    }

    const { sessionId } = validation.data;
    const owner = permResult.user;

    const sessionDoc = await getSessionsCollection().doc(sessionId).get();
    if (!sessionDoc.exists) {
      return createErrorResponse('Session not found', 404);
    }

    const sessionData = sessionDoc.data() as Record<string, unknown>;

    if (sessionData.status === 'ended') {
      return createErrorResponse('Session already ended', 400);
    }

    // Verify the session belongs to this owner
    if (sessionData.ownerId !== owner.uid) {
      return createErrorResponse('Not authorized to end this session', 403);
    }

    await getSessionsCollection().doc(sessionId).update({
      status: 'ended',
      endedAt: FieldValue.serverTimestamp(),
    });

    // Audit log
    if (adminDal) {
      await adminDal.safeAddDoc('AUDIT_LOGS', {
        action: 'impersonation_ended',
        performedBy: owner.email,
        performedByUid: owner.uid,
        targetUserId: sessionData.targetUserId,
        targetEmail: sessionData.targetUserEmail,
        sessionId,
        timestamp: FieldValue.serverTimestamp(),
      }, { audit: false, userId: owner.uid });
    }

    logger.info('Impersonation session ended', {
      sessionId,
      ownerEmail: owner.email,
      route: '/api/admin/impersonate',
    });

    return createSuccessResponse({
      success: true,
      sessionId,
      message: 'Impersonation session ended',
    });
  } catch (error: unknown) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error('Impersonation end error', errorObj, { route: '/api/admin/impersonate' });
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to end impersonation: ${errorObj.message}`
        : 'Failed to end impersonation session',
      500
    );
  }
}

// ============================================================================
// GET - List impersonation sessions
// ============================================================================

export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/admin/impersonate');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const permResult = await verifyOwnerPermission(request);
  if (!permResult.success) {
    return createErrorResponse(permResult.error, permResult.status);
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // 'active', 'ended', or null for all
    const limitParam = searchParams.get('limit');
    const pageSize = Math.min(parseInt(limitParam ?? '20', 10), 50);

    let query = getSessionsCollection().orderBy('startedAt', 'desc');

    if (statusFilter === 'active' || statusFilter === 'ended') {
      query = query.where('status', '==', statusFilter);
    }

    query = query.limit(pageSize);
    const snapshot = await query.get();

    const sessions: SessionResponse[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        sessionId: (data.sessionId as string) ?? doc.id,
        ownerId: (data.ownerId as string) ?? '',
        ownerEmail: (data.ownerEmail as string) ?? '',
        targetUserId: (data.targetUserId as string) ?? '',
        targetUserEmail: (data.targetUserEmail as string) ?? '',
        targetUserName: (data.targetUserName as string) ?? 'Unknown',
        targetUserRole: (data.targetUserRole as string) ?? 'member',
        reason: (data.reason as string) ?? '',
        status: (data.status as string) ?? 'unknown',
        startedAt: timestampToISO(data.startedAt),
        endedAt: timestampToISO(data.endedAt),
      };
    });

    logger.info('Impersonation sessions listed', {
      count: sessions.length,
      statusFilter,
      ownerEmail: permResult.user.email,
      route: '/api/admin/impersonate',
    });

    return createSuccessResponse({
      sessions,
      count: sessions.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error('Impersonation list error', errorObj, { route: '/api/admin/impersonate' });
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to list sessions: ${errorObj.message}`
        : 'Failed to list impersonation sessions',
      500
    );
  }
}
