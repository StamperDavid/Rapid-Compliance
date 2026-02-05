export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminDal } from '@/lib/firebase/admin-dal';
import { adminAuth } from '@/lib/firebase/admin';
import { createErrorResponse, createSuccessResponse } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import {
  extractAuthClaims,
  hasAdminRole,
  isAdminClaims,
  type AuthClaims,
} from '@/lib/auth/claims-validator';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

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
    isAdmin: boolean;
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
 * Verifies that the authenticated user is an admin.
 * Uses Firebase Custom Claims as the source of truth for authorization.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/admin/verify');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

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

    // Extract claims from the token
    const claimsResult = extractAuthClaims(decodedToken);
    const claims: AuthClaims = claimsResult.claims;

    const userId = decodedToken.uid;

    if (!adminDal) {
      return createErrorResponse('Server configuration error', 500);
    }

    const userDoc = await adminDal.safeGetDoc<FirestoreUserData>('USERS', userId);

    if (!userDoc.exists) {
      return createErrorResponse('User not found in database', 403);
    }

    const userData = userDoc.data();

    if (!userData) {
      return createErrorResponse('User data is missing', 500);
    }

    // Merge token claims with database role
    const effectiveRole = claims.role ?? userData.role;
    const effectiveClaims: AuthClaims = {
      ...claims,
      role: effectiveRole as AuthClaims['role'],
    };

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

    const isAdminUser = isAdminClaims(effectiveClaims);

    logger.info('Admin verified via claims', {
      route: '/api/admin/verify',
      email: effectiveClaims.email ?? userData.email,
      role: effectiveClaims.role,
      isAdmin: isAdminUser,
    });

    const responseData: VerifyResponseData = {
      uid: userId,
      email: userData.email ?? decodedToken.email ?? '',
      name: (userData.name && userData.name !== '')
        ? userData.name
        : (userData.displayName && userData.displayName !== '')
          ? userData.displayName
          : 'Admin User',
      role: effectiveClaims.role ?? userData.role ?? 'admin',
      organizationId: DEFAULT_ORG_ID,
      verified: true,
      claims: {
        isAdmin: isAdminUser,
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
