/**
 * API Authentication Middleware
 * Validates authentication tokens and user permissions for API routes
 */

import { NextResponse, type NextRequest } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';
import type { Auth } from 'firebase-admin/auth';

// Firebase Admin SDK (optional - only if configured)
let adminAuth: Auth | null = null;
let adminInitialized = false;

interface UserProfileData {
  role?: string;
  organizationId?: string;
}

async function initializeAdminAuth(): Promise<Auth | null> {
  if (adminInitialized) {
    return adminAuth;
  }

  if (typeof window !== 'undefined') {
    return null; // Client-side, skip
  }

  try {
    // Dynamically import firebase-admin (only if available)
    const admin = await import('firebase-admin');

    // Check if already initialized
    const existingApps = admin.apps;
    if (existingApps.length > 0 && existingApps[0]) {
      const authInstance = admin.auth(existingApps[0]);
      adminAuth = authInstance;
      adminInitialized = true;
      logger.info('[API Auth] Using existing Firebase Admin app', { file: 'api-auth.ts' });
      return authInstance;
    }

    // Get project ID from env
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      ?? process.env.FIREBASE_PROJECT_ID
      ?? 'ai-sales-platform-dev';

    // Initialize with service account or project ID
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const serviceAccount = serviceAccountKey
      ? (JSON.parse(serviceAccountKey) as Record<string, unknown>)
      : undefined;

    let app;
    if (serviceAccount) {
      logger.info('[API Auth] Initializing Firebase Admin with service account', { file: 'api-auth.ts' });
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Initialize with just project ID (works for emulator and some GCP scenarios)
      logger.info('[API Auth] Initializing Firebase Admin with project ID', { file: 'api-auth.ts', projectId });
      app = admin.initializeApp({
        projectId,
      });
    }

    const authInstance = admin.auth(app);
    adminAuth = authInstance;
    adminInitialized = true;
    return authInstance;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin:', error, { file: 'api-auth.ts' });
    adminInitialized = true; // Mark as initialized to prevent retries
    return null;
  }
}

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  organizationId?: string;
  role?: string;
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
    logger.debug('[API Auth] Initializing Admin Auth...', { file: 'api-auth.ts' });
    const auth = await initializeAdminAuth();

    if (!auth) {
      logger.debug('[API Auth] Admin Auth not available', { file: 'api-auth.ts' });
      // In development, if admin SDK is not configured, allow requests
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Firebase Admin not configured. Skipping token verification in development.', { file: 'api-auth.ts' });
        return null; // Will be handled by requireAuth
      }
      return null;
    }

    logger.debug('[API Auth] Verifying ID token...', { file: 'api-auth.ts' });
    const decodedToken = await auth.verifyIdToken(token);
    logger.debug('[API Auth] Token verified', { file: 'api-auth.ts', email: decodedToken.email });
    logger.debug('[API Auth] Token claims', {
      file: 'api-auth.ts',
      role: decodedToken.role,
      organizationId: decodedToken.organizationId,
      admin: decodedToken.admin,
    });

    // First try to get role from token claims (set via Firebase Auth custom claims)
    let role = decodedToken.role as string | undefined;
    let organizationId = decodedToken.organizationId as string | undefined;

    // If no role in claims, try to fetch from Firestore
    if (!role) {
      logger.debug('[API Auth] No role in token claims, checking Firestore...', { file: 'api-auth.ts' });
      try {
        const { adminDb } = await import('../firebase/admin');
        if (adminDb) {
          const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
          if (userDoc.exists) {
            const userProfile = userDoc.data() as UserProfileData | undefined;
            role = userProfile?.role;
            organizationId = organizationId ?? userProfile?.organizationId;
            logger.debug('[API Auth] User profile loaded via Admin SDK', {
              file: 'api-auth.ts',
              uid: decodedToken.uid,
              role,
              organizationId,
            });
          }
        }
      } catch (adminError) {
        const errorMessage = adminError instanceof Error ? adminError.message : 'Unknown error';
        logger.debug('[API Auth] Admin SDK Firestore failed', { file: 'api-auth.ts', error: errorMessage });
        // Try client SDK as last resort
        try {
          const userProfile = await FirestoreService.get('users', decodedToken.uid) as UserProfileData | null;
          if (userProfile) {
            role = userProfile.role;
            organizationId = organizationId ?? userProfile.organizationId;
            logger.debug('[API Auth] User profile loaded via client SDK', { file: 'api-auth.ts', role, organizationId });
          }
        } catch (clientError) {
          const clientErrorMessage = clientError instanceof Error ? clientError.message : 'Unknown error';
          logger.debug('[API Auth] Client SDK also failed', { file: 'api-auth.ts', error: clientErrorMessage });
        }
      }
    }

    logger.debug('[API Auth] Final auth result', { file: 'api-auth.ts', uid: decodedToken.uid, email: decodedToken.email, role, organizationId });

    return {
      uid: decodedToken.uid,
      email: decodedToken.email ?? null,
      emailVerified: decodedToken.email_verified ?? false,
      organizationId,
      role,
    };
  } catch (error) {
    logger.error('Token verification failed:', error, { file: 'api-auth.ts' });
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
  } catch (_error) {
    return null;
  }
}

/**
 * Require specific role
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  if (!user.role || !allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  return { user };
}

/**
 * Require organization membership
 */
export async function requireOrganization(
  request: NextRequest,
  organizationId?: string
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  // If organizationId is provided, verify user belongs to it
  if (organizationId && user.organizationId && user.organizationId !== organizationId) {
    return NextResponse.json(
      { success: false, error: 'Access denied to this organization' },
      { status: 403 }
    );
  }

  // For onboarding, allow users without organizationId if they're admin/owner
  // They're likely setting up their first organization
  if (!user.organizationId && !['admin', 'owner', 'super_admin'].includes(user.role ?? '')) {
    return NextResponse.json(
      { success: false, error: 'User must belong to an organization' },
      { status: 403 }
    );
  }

  return { user };
}
