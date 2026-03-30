/**
 * API Authentication Middleware
 * Validates authentication tokens and user permissions for API routes
 *
 * Penthouse model: All users belong to PLATFORM_ID
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { type AccountRole, hasUnifiedPermission, type UnifiedPermissions } from '@/types/unified-rbac';

interface UserProfileData {
  role?: string;
}

const VALID_ROLES: readonly string[] = ['owner', 'admin', 'manager', 'member'];

function isValidRole(value: unknown): value is AccountRole {
  return typeof value === 'string' && VALID_ROLES.includes(value);
}

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  /** User's role: owner | admin | manager | member */
  role?: AccountRole;
}

/**
 * Extract and verify authentication token from request
 */
async function verifyAuthToken(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      logger.debug('[API Auth] No Bearer token in Authorization header', { file: 'api-auth.ts' });
      return null;
    }

    const token = authHeader.substring(7);
    logger.debug('[API Auth] Token received', { file: 'api-auth.ts', tokenLength: token.length });

    // Try to verify token using Firebase Admin SDK
    if (!adminAuth) {
      logger.debug('[API Auth] Admin Auth not available', { file: 'api-auth.ts' });
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Firebase Admin not configured. Skipping token verification in development.', { file: 'api-auth.ts' });
      }
      return null;
    }

    logger.debug('[API Auth] Verifying ID token...', { file: 'api-auth.ts' });
    const decodedToken = await adminAuth.verifyIdToken(token);
    logger.debug('[API Auth] Token verified', { file: 'api-auth.ts', email: decodedToken.email });

    // Extract role from custom claims with strict validation
    const claims: Record<string, unknown> = { role: undefined, ...decodedToken };
    const roleFromClaims = isValidRole(claims.role) ? claims.role : undefined;

    logger.debug('[API Auth] Token claims', {
      file: 'api-auth.ts',
      role: roleFromClaims,
    });

    // First try to get role from token claims (set via Firebase Auth custom claims)
    let role: AccountRole | undefined = roleFromClaims;

    // If no role in claims, try to fetch from Firestore
    if (!role) {
      logger.debug('[API Auth] No role in token claims, checking Firestore...', { file: 'api-auth.ts' });
      try {
        const { adminDb } = await import('../firebase/admin');
        if (adminDb) {
          const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
          if (userDoc.exists) {
            const userProfile = userDoc.data() as UserProfileData | undefined;
            const firestoreRole = userProfile?.role;
            role = isValidRole(firestoreRole) ? firestoreRole : undefined;
            logger.debug('[API Auth] User profile loaded via Admin SDK', {
              file: 'api-auth.ts',
              uid: decodedToken.uid,
              role,
            });
          }
        }
      } catch (adminError: unknown) {
        const errorMessage = adminError instanceof Error ? adminError.message : 'Unknown error';
        logger.debug('[API Auth] Admin SDK Firestore failed', { file: 'api-auth.ts', error: errorMessage });
        // role remains undefined — caller handles this gracefully
      }
    }

    logger.debug('[API Auth] Final auth result', { file: 'api-auth.ts', uid: decodedToken.uid, email: decodedToken.email, role });

    return {
      uid: decodedToken.uid,
      email: typeof decodedToken.email === 'string' ? decodedToken.email : null,
      emailVerified: decodedToken.email_verified === true,
      role,
    };
  } catch (error: unknown) {
    logger.error('Token verification failed:', error instanceof Error ? error : new Error(String(error)), { file: 'api-auth.ts' });
    return null;
  }
}

/**
 * Authentication middleware for API routes
 * Use this to protect API routes that require authentication
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const user = await verifyAuthToken(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  return { user };
}

/**
 * Optional authentication - returns user if authenticated, null otherwise
 */
export async function optionalAuth(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  try {
    const user = await verifyAuthToken(request);
    return user;
  } catch (_error: unknown) {
    return null;
  }
}

/**
 * Require specific role(s).
 * Uses 4-role RBAC: owner | admin | manager | member
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: AccountRole[]
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  // Check if user's role is in the allowed list
  if (!user.role || !allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  return { user };
}

/**
 * Require a specific granular permission from UnifiedPermissions.
 * Uses the 47-permission RBAC matrix to check access.
 * Owner role always passes (master key).
 */
export async function requirePermission(
  request: NextRequest,
  permission: keyof UnifiedPermissions
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  if (!hasUnifiedPermission(user.role, permission)) {
    logger.warn('Permission denied', {
      uid: user.uid,
      role: user.role,
      permission,
      file: 'api-auth.ts',
    });
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  return { user };
}

/**
 * Verify cron endpoint authentication using timing-safe comparison.
 * Returns null on success, or a NextResponse error on failure.
 *
 * Usage in cron routes:
 *   const authError = verifyCronAuth(request, '/api/cron/my-job');
 *   if (authError) return authError;
 */
export function verifyCronAuth(
  request: NextRequest,
  routeName: string
): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.error('CRON_SECRET not configured - rejecting request', new Error('Missing CRON_SECRET'), {
      route: routeName,
    });
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (!authHeader) {
    logger.error('Unauthorized cron access attempt — no auth header', new Error('Missing authorization'), {
      route: routeName,
      method: 'GET',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expected = `Bearer ${cronSecret}`;

  // Timing-safe comparison to prevent timing attacks
  if (authHeader.length !== expected.length) {
    logger.error('Unauthorized cron access attempt', new Error('Invalid cron secret'), {
      route: routeName,
      method: 'GET',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const a = encoder.encode(authHeader);
  const b = encoder.encode(expected);

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i];
  }

  if (mismatch !== 0) {
    logger.error('Unauthorized cron access attempt', new Error('Invalid cron secret'), {
      route: routeName,
      method: 'GET',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
