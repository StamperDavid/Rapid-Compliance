/**
 * Admin API Authentication Middleware
 * Centralized authentication for admin API routes
 *
 * Uses Firebase Custom Claims for authorization:
 * - admin: Admin flag for full access
 * - role: User's binary role (admin | user)
 */

import type { NextRequest } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { COLLECTIONS } from '@/lib/firebase/collections';
import {
  extractAuthClaims,
  hasAdminRole,
  isAdminClaims,
  type AuthClaims,
} from '@/lib/auth/claims-validator';


export interface AdminUser {
  uid: string;
  email: string;
  role: 'admin';
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

interface UserData {
  email?: string;
  role?: string;
}

/**
 * Verify the request is from an authenticated admin.
 * Uses Firebase Custom Claims as the source of truth for authorization.
 *
 * @param request - The incoming request
 * @returns AuthResult with user data or error
 */
export async function verifyAdminRequest(request: NextRequest): Promise<AuthResult> {
  try {
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

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (tokenError: unknown) {
      const error = tokenError as { code?: string; message?: string };
      logger.error('Token verification failed', error instanceof Error ? error : new Error(String(tokenError)), {
        code: error.code,
        file: 'admin-auth.ts',
      });
      return {
        success: false,
        error:
          error.code === 'auth/id-token-expired'
            ? 'Token expired - please re-authenticate'
            : 'Invalid authentication token',
        status: 401,
      };
    }

    // Extract claims from the token
    const claimsResult = extractAuthClaims(decodedToken);
    const claims: AuthClaims = claimsResult.claims;

    const userId = decodedToken.uid;

    if (!adminDb) {
      return {
        success: false,
        error: 'Server configuration error',
        status: 401,
      };
    }

    // Check if user has admin role in token claims
    const hasAdminClaim = claims.role === 'admin';

    // Get user document to enrich with database role
    const userDoc = await adminDb.collection(COLLECTIONS.USERS).doc(userId).get();
    const rawUserData = userDoc.exists ? userDoc.data() : null;

    if (!userDoc.exists && !hasAdminClaim) {
      return {
        success: false,
        error: 'User not found in database',
        status: 403,
      };
    }

    const userData: UserData = rawUserData ? {
      email: rawUserData.email as string | undefined,
      role: rawUserData.role as string | undefined,
    } : {
      email: decodedToken.email,
      role: claims.role ?? undefined,
    };

    // Merge token claims with database role (token claims take precedence)
    const effectiveRole = claims.role ?? userData.role;
    const effectiveClaims: AuthClaims = {
      ...claims,
      role: effectiveRole as AuthClaims['role'],
    };

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

    if (isAdminClaims(effectiveClaims)) {
      logger.info('Admin access', {
        userId,
        email: userData.email,
        role: effectiveClaims.role,
        file: 'admin-auth.ts',
      });
    }

    return {
      success: true,
      user: {
        uid: userId,
        email: userData.email ?? decodedToken.email ?? '',
        role: 'admin',
      },
    };
  } catch (error: unknown) {
    logger.error('Admin auth error:', error instanceof Error ? error : new Error(String(error)), { file: 'admin-auth.ts' });
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
