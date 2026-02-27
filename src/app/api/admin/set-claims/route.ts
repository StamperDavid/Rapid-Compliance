/**
 * Admin API: Set Firebase Custom Claims
 * Allows admin to set custom claims for role-based access control
 *
 * POST /api/admin/set-claims
 * Body: { userId: string, role: 'admin' }
 *
 * Security:
 * - Requires admin authentication
 * - Rate limited to prevent abuse
 * - All claim changes are audited
 * - Uses Firebase Admin SDK for server-side claim management
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminAuth } from '@/lib/firebase/admin';
import {
  verifyAdminRequest,
  createErrorResponse,
  createSuccessResponse,
  isAuthError,
} from '@/lib/api/admin-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

// ============================================================================
// SCHEMAS & TYPE DEFINITIONS
// ============================================================================

const SetClaimsSchema = z.object({
  userId: z.string().min(1),
  role: z.literal('admin'),
});

/**
 * Valid role types for the platform
 */
type RoleType = 'admin';

/**
 * Custom claims object structure
 */
interface CustomClaims {
  readonly admin: boolean;
  readonly role: RoleType;
}

/**
 * Success response structure
 */
interface SetClaimsResponse {
  readonly success: true;
  readonly userId: string;
  readonly claims: CustomClaims;
  readonly setBy: string;
  readonly setAt: string;
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

/**
 * POST /api/admin/set-claims
 * Sets custom claims on a Firebase user for RBAC
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimitMiddleware(
    request,
    '/api/admin/set-claims'
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const authResult = await verifyAdminRequest(request);

  if (isAuthError(authResult)) {
    logger.warn('Unauthorized claim modification attempt', {
      route: '/api/admin/set-claims',
      error: authResult.error,
    });
    return createErrorResponse(authResult.error, authResult.status);
  }

  // Admin access already verified by verifyAdminRequest

  try {
    if (!adminAuth) {
      logger.error('Firebase Admin Auth not initialized', new Error('adminAuth is null'), {
        route: '/api/admin/set-claims',
      });
      return createErrorResponse('Server configuration error', 500);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (parseError: unknown) {
      logger.warn('Invalid JSON in request body', {
        route: '/api/admin/set-claims',
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
      });
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    const parsed = SetClaimsSchema.safeParse(rawBody);
    if (!parsed.success) {
      return createErrorResponse(
        'Invalid request body. Required: userId (string), role (admin)',
        400
      );
    }

    const body = parsed.data;

    let targetUser;
    try {
      targetUser = await adminAuth.getUser(body.userId);
    } catch (userError: unknown) {
      const error = userError as { code?: string; message?: string };
      logger.warn('Target user not found for claim modification', {
        route: '/api/admin/set-claims',
        targetUserId: body.userId,
        error: error.message,
      });
      return createErrorResponse(
        error.code === 'auth/user-not-found'
          ? `User not found: ${body.userId}`
          : 'Failed to verify target user',
        404
      );
    }

    const claims: CustomClaims = {
      admin: true,
      role: body.role,
    };

    try {
      await adminAuth.setCustomUserClaims(body.userId, claims);
    } catch (claimsError: unknown) {
      logger.error(
        'Failed to set custom user claims',
        claimsError instanceof Error ? claimsError : new Error(String(claimsError)),
        {
          route: '/api/admin/set-claims',
          targetUserId: body.userId,
          role: body.role,
        }
      );
      return createErrorResponse(
        'Failed to set custom claims. Please try again.',
        500
      );
    }

    logger.info('Custom claims set successfully', {
      route: '/api/admin/set-claims',
      targetUserId: body.userId,
      targetUserEmail: targetUser.email ?? 'unknown',
      role: body.role,
      setBy: authResult.user.uid,
      setByEmail: authResult.user.email,
    });

    const response: SetClaimsResponse = {
      success: true,
      userId: body.userId,
      claims,
      setBy: authResult.user.uid,
      setAt: new Date().toISOString(),
    };

    return createSuccessResponse(response);
  } catch (error: unknown) {
    logger.error(
      'Unexpected error in set-claims API',
      error instanceof Error ? error : new Error(String(error)),
      {
        route: '/api/admin/set-claims',
        requestedBy: authResult.user.uid,
      }
    );

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to set claims: ${errorMessage}`
        : 'Failed to set custom claims',
      500
    );
  }
}
