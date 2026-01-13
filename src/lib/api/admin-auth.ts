/**
 * Admin API Authentication Middleware
 * Centralized authentication for admin API routes
 *
 * Uses Firebase Custom Claims for authorization:
 * - tenant_id: Organization scope
 * - admin: Super admin flag for global access
 * - role: User's role within the platform
 */

import type { NextRequest } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { COLLECTIONS } from '@/lib/firebase/collections';
import {
  extractTenantClaims,
  hasAdminRole,
  isSuperAdmin,
  type TenantClaims,
} from '@/lib/auth/claims-validator';

export interface AdminUser {
  uid: string;
  email: string;
  role: 'super_admin' | 'admin';
  organizationId: string;
  isGlobalAdmin?: boolean;
  tenantId?: string | null;
}

export type AuthSuccess = {
  success: true;
  user: AdminUser;
};

export type AuthError = {
  success: false;
  error: string;
  status: 401 | 403;
};

export type AuthResult = AuthSuccess | AuthError;

export function isAuthError(result: AuthResult): result is AuthError {
  return result.success === false;
}

/**
 * Verify the request is from an authenticated admin (super_admin or admin).
 * Uses Firebase Custom Claims as the source of truth for authorization.
 *
 * @param request - The incoming request
 * @returns AuthResult with user data or error
 */
export async function verifyAdminRequest(request: NextRequest): Promise<AuthResult> {
  try {
    // Get the auth token from the request headers
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Missing or invalid Authorization header',
        status: 401,
      };
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token || token.length < 100) {
      return {
        success: false,
        error: 'Invalid token format',
        status: 401,
      };
    }

    if (!adminAuth) {
      return {
        success: false,
        error: 'Server configuration error',
        status: 401,
      };
    }

    // Verify the token and extract claims
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (tokenError: any) {
      logger.error('Token verification failed', tokenError, {
        code: tokenError.code,
        file: 'admin-auth.ts',
      });
      return {
        success: false,
        error:
          tokenError.code === 'auth/id-token-expired'
            ? 'Token expired - please re-authenticate'
            : 'Invalid authentication token',
        status: 401,
      };
    }

    // Extract tenant claims from the token (claims-based authorization)
    const claimsResult = extractTenantClaims(decodedToken);
    const claims: TenantClaims = claimsResult.claims;

    const userId = decodedToken.uid;

    if (!adminDb) {
      return {
        success: false,
        error: 'Server configuration error',
        status: 401,
      };
    }

    // Get user document to enrich with database role
    const userDoc = await adminDb.collection(COLLECTIONS.USERS).doc(userId).get();

    if (!userDoc.exists) {
      return {
        success: false,
        error: 'User not found in database',
        status: 403,
      };
    }

    const userData = userDoc.data()!;

    // Merge token claims with database role
    const effectiveRole = claims.role ?? userData.role;
    const effectiveClaims: TenantClaims = {
      ...claims,
      role: effectiveRole as TenantClaims['role'],
      tenant_id: claims.tenant_id ?? userData.organizationId ?? null,
    };

    // Check for admin roles using claims-based validation
    // Allow both super_admin and admin roles
    if (!hasAdminRole(effectiveClaims)) {
      logger.warn('Non-admin access attempt', {
        userId,
        role: effectiveClaims.role,
        tokenRole: claims.role,
        dbRole: userData.role,
        file: 'admin-auth.ts',
      });
      return {
        success: false,
        error: 'Admin access required',
        status: 403,
      };
    }

    // Determine if this is a super admin with global access
    const isGlobalAdmin = isSuperAdmin(effectiveClaims);

    return {
      success: true,
      user: {
        uid: userId,
        email: userData.email ?? decodedToken.email ?? '',
        role: (effectiveClaims.role as 'super_admin' | 'admin') ?? userData.role,
        organizationId:
          effectiveClaims.tenant_id ?? userData.organizationId ?? 'platform',
        isGlobalAdmin,
        tenantId: effectiveClaims.tenant_id,
      },
    };
  } catch (error: any) {
    logger.error('Admin auth error:', error, { file: 'admin-auth.ts' });
    return {
      success: false,
      error: 'Authentication failed',
      status: 401,
    };
  }
}

/**
 * Create standard error response with security headers
 */
export function createErrorResponse(error: string, status: number) {
  return new Response(
    JSON.stringify({ error }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    }
  );
}

/**
 * Create standard success response with security headers
 */
export function createSuccessResponse<T>(data: T, cacheMaxAge: number = 0) {
  return new Response(
    JSON.stringify(data),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': cacheMaxAge > 0 
          ? `private, max-age=${cacheMaxAge}` 
          : 'no-store, no-cache, must-revalidate',
      }
    }
  );
}

