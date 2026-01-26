/**
 * Admin API: Set Firebase Custom Claims
 * Allows platform_admin to set custom claims for role-based access control
 *
 * POST /api/admin/set-claims
 * Body: { userId: string, role: 'platform_admin' | 'platform_admin' | 'admin', tenantId?: string }
 *
 * Security:
 * - Requires platform_admin authentication
 * - Rate limited to prevent abuse
 * - All claim changes are audited
 * - Uses Firebase Admin SDK for server-side claim management
 */

import type { NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import {
  verifyAdminRequest,
  createErrorResponse,
  createSuccessResponse,
  isAuthError,
} from '@/lib/api/admin-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Valid role types for the platform
 */
type RoleType = 'platform_admin'   | 'admin';

/**
 * Request body for setting custom claims
 */
interface SetClaimsRequestBody {
  readonly userId: string;
  readonly role: RoleType;
  readonly tenantId?: string;
}

/**
 * Custom claims object structure
 */
interface CustomClaims {
  readonly tenant_id: string;
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
// TYPE GUARDS & VALIDATORS
// ============================================================================

/**
 * Type guard for valid role types
 */
function isValidRole(role: unknown): role is RoleType {
  return (
    typeof role === 'string' &&
    (role === 'platform_admin' || role === 'platform_admin' || role === 'admin')
  );
}

/**
 * Type guard for set claims request body
 * Validates required fields and types
 */
function isSetClaimsRequestBody(body: unknown): body is SetClaimsRequestBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const obj = body as Record<string, unknown>;

  // userId must be a non-empty string
  if (typeof obj.userId !== 'string' || obj.userId.length === 0) {
    return false;
  }

  // role must be a valid RoleType
  if (!isValidRole(obj.role)) {
    return false;
  }

  // tenantId is optional, but if provided must be a string
  if (obj.tenantId !== undefined && typeof obj.tenantId !== 'string') {
    return false;
  }

  return true;
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

/**
 * POST /api/admin/set-claims
 * Sets custom claims on a Firebase user for RBAC
 *
 * Security considerations:
 * - Only platform_admin can set claims
 * - Claims include tenant_id for multi-tenancy
 * - All role changes are logged for audit trail
 * - Rate limited to prevent abuse
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting (strict for admin endpoints)
  const rateLimitResponse = await rateLimitMiddleware(
    request,
    '/api/admin/set-claims'
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Verify the requester is a platform_admin
  const authResult = await verifyAdminRequest(request);

  if (isAuthError(authResult)) {
    logger.warn('Unauthorized claim modification attempt', {
      route: '/api/admin/set-claims',
      error: authResult.error,
    });
    return createErrorResponse(authResult.error, authResult.status);
  }

  // Enforce platform_admin requirement for claim modification
  if (!authResult.user.isPlatformAdmin) {
    logger.warn('Non-platform-admin attempted to set claims', {
      route: '/api/admin/set-claims',
      userId: authResult.user.uid,
      userRole: authResult.user.role,
    });
    return createErrorResponse(
      'Platform admin access required to set custom claims',
      403
    );
  }

  try {
    // Validate Firebase Admin SDK is available
    if (!adminAuth) {
      logger.error('Firebase Admin Auth not initialized', new Error('adminAuth is null'), {
        route: '/api/admin/set-claims',
      });
      return createErrorResponse('Server configuration error', 500);
    }

    // Parse and validate request body
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

    if (!isSetClaimsRequestBody(rawBody)) {
      return createErrorResponse(
        'Invalid request body. Required: userId (string), role (platform_admin|platform_admin|admin), tenantId (string, optional)',
        400
      );
    }

    const body: SetClaimsRequestBody = rawBody;

    // Verify target user exists before setting claims
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

    // Construct custom claims object
    const claims: CustomClaims = {
      tenant_id: body.tenantId ?? 'platform-admin',
      admin: true, // All admin roles have this flag
      role: body.role,
    };

    // Set custom claims on the target user
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
          tenantId: body.tenantId,
        }
      );
      return createErrorResponse(
        'Failed to set custom claims. Please try again.',
        500
      );
    }

    // Log successful claim modification for audit trail
    logger.info('Custom claims set successfully', {
      route: '/api/admin/set-claims',
      targetUserId: body.userId,
      targetUserEmail: targetUser.email ?? 'unknown',
      role: body.role,
      tenantId: claims.tenant_id,
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
