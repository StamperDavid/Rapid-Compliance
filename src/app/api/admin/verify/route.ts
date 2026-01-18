export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminDal } from '@/lib/firebase/admin-dal';
import { adminAuth } from '@/lib/firebase/admin';
import { createErrorResponse, createSuccessResponse } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import {
  extractTenantClaims,
  hasAdminRole,
  isSuperAdmin,
  type TenantClaims,
} from '@/lib/auth/claims-validator';

/**
 * Firestore user document structure
 */
interface FirestoreUserData {
  email?: string;
  name?: string;
  displayName?: string;
  role?: string;
  organizationId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLoginAt?: unknown;
}

/**
 * Verified admin response payload
 */
interface VerifyResponseData {
  uid: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  verified: boolean;
  claims: {
    isGlobalAdmin: boolean;
    tenantId: string | null;
    hasAdminClaim: boolean;
  };
}

/**
 * Firebase Auth error structure
 */
interface FirebaseAuthError extends Error {
  code?: string;
}

/**
 * POST /api/admin/verify
 * Verifies that the authenticated user is a super_admin or admin.
 * Uses Firebase Custom Claims as the source of truth for authorization.
 *
 * Claims-Based Authorization:
 * - Parses tenant_id claim for organization scope
 * - Checks admin: true claim for global read access
 * - Validates role claim for admin-level access
 *
 * Returns user data including tenant claims if authorized.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/admin/verify');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get the auth token from the request headers
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return createErrorResponse('Missing or invalid Authorization header', 401);
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token || token.length < 100) {
      return createErrorResponse('Invalid token format', 401);
    }

    if (!adminAuth) {
      return createErrorResponse('Admin authentication not initialized', 500);
    }

    // Verify the token and extract claims
    let decodedToken: DecodedIdToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error: unknown) {
      const tokenError = error as FirebaseAuthError;
      logger.warn('Token verification failed', { route: '/api/admin/verify', code: tokenError.code });
      return createErrorResponse(
        tokenError.code === 'auth/id-token-expired'
          ? 'Token expired - please re-authenticate'
          : 'Invalid authentication token',
        401
      );
    }

    // Extract tenant claims from the token (claims-based authorization)
    const claimsResult = extractTenantClaims(decodedToken);
    const claims: TenantClaims = claimsResult.claims;

    const userId = decodedToken.uid;

    if (!adminDal) {
      return createErrorResponse('Server configuration error', 500);
    }

    // Get user document to enrich with database role
    const userDoc = await adminDal.safeGetDoc<FirestoreUserData>('USERS', userId);

    if (!userDoc.exists) {
      return createErrorResponse('User not found in database', 403);
    }

    const userData = userDoc.data();

    if (!userData) {
      return createErrorResponse('User data is missing', 500);
    }

    // Merge token claims with database role
    // Token claims take precedence, but we fall back to database role if claims are missing
    const effectiveRole = claims.role ?? userData.role;
    const effectiveClaims: TenantClaims = {
      ...claims,
      role: effectiveRole as TenantClaims['role'],
      tenant_id: claims.tenant_id ?? userData.organizationId ?? null,
    };

    // Check for admin roles using claims-based validation
    if (!hasAdminRole(effectiveClaims)) {
      logger.warn('Non-admin login attempt', {
        route: '/api/admin/verify',
        userId,
        role: effectiveClaims.role,
        tokenRole: claims.role,
        dbRole: userData.role,
      });
      return createErrorResponse(
        'Admin access required. Please contact your platform administrator.',
        403
      );
    }

    // Determine if this is a super admin with global access
    const isGlobalAdmin = isSuperAdmin(effectiveClaims);

    logger.info('Admin verified via claims', {
      route: '/api/admin/verify',
      email: effectiveClaims.email ?? userData.email,
      role: effectiveClaims.role,
      isGlobalAdmin,
      tenantId: effectiveClaims.tenant_id,
    });

    // Build verified response with safe fallbacks
    const responseData: VerifyResponseData = {
      uid: userId,
      email: userData.email ?? decodedToken.email ?? '',
      name: (userData.name && userData.name !== '')
        ? userData.name
        : (userData.displayName && userData.displayName !== '')
          ? userData.displayName
          : 'Admin User',
      role: effectiveClaims.role ?? userData.role ?? 'admin',
      organizationId: effectiveClaims.tenant_id ?? userData.organizationId ?? 'platform',
      verified: true,
      // Include claims metadata for frontend
      claims: {
        isGlobalAdmin,
        tenantId: effectiveClaims.tenant_id,
        hasAdminClaim: claims.admin ?? false,
      },
    };

    return createSuccessResponse<VerifyResponseData>(responseData);

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Admin verify error', err, { route: '/api/admin/verify' });
    return createErrorResponse('Verification failed', 500);
  }
}










