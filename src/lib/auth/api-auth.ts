/**
 * API Authentication Middleware
 * Validates authentication tokens and user permissions for API routes
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';

// Firebase Admin SDK (optional - only if configured)
let adminAuth: any = null;
let adminInitialized = false;

async function initializeAdminAuth() {
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
      adminAuth = admin.auth(existingApps[0]);
      adminInitialized = true;
      console.log('[API Auth] Using existing Firebase Admin app');
      return adminAuth;
    }

    // Get project ID from env
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      || process.env.FIREBASE_PROJECT_ID
      || 'ai-sales-platform-dev';

    // Initialize with service account or project ID
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : undefined;

    let app;
    if (serviceAccount) {
      console.log('[API Auth] Initializing Firebase Admin with service account');
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Initialize with just project ID (works for emulator and some GCP scenarios)
      console.log('[API Auth] Initializing Firebase Admin with project ID:', projectId);
      app = admin.initializeApp({
        projectId,
      });
    }

    adminAuth = admin.auth(app);
    adminInitialized = true;
    return adminAuth;
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
      console.log('[API Auth] No Bearer token in Authorization header');
      return null;
    }

    const token = authHeader.substring(7);
    console.log('[API Auth] Token received, length:', token.length);

    // Try to verify token using Firebase Admin SDK
    console.log('[API Auth] Initializing Admin Auth...');
    const auth = await initializeAdminAuth();

    if (!auth) {
      console.log('[API Auth] Admin Auth not available');
      // In development, if admin SDK is not configured, allow requests
      if (process.env.NODE_ENV === 'development') {
        logger.warn('⚠️ Firebase Admin not configured. Skipping token verification in development.', { file: 'api-auth.ts' });
        return null; // Will be handled by requireAuth
      }
      return null;
    }

    console.log('[API Auth] Verifying ID token...');
    const decodedToken = await auth.verifyIdToken(token);
    console.log('[API Auth] Token verified for:', decodedToken.email);
    console.log('[API Auth] Token claims:', {
      role: decodedToken.role,
      organizationId: decodedToken.organizationId,
      admin: decodedToken.admin,
    });

    // First try to get role from token claims (set via Firebase Auth custom claims)
    let role = decodedToken.role as string | undefined;
    let organizationId = decodedToken.organizationId as string | undefined;

    // If no role in claims, try to fetch from Firestore
    if (!role) {
      console.log('[API Auth] No role in token claims, checking Firestore...');
      try {
        const { adminDb } = await import('../firebase/admin');
        if (adminDb) {
          const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
          if (userDoc.exists) {
            const userProfile = userDoc.data();
            role = userProfile?.role;
            organizationId = organizationId || userProfile?.organizationId;
            console.log('[API Auth] User profile loaded via Admin SDK:', {
              uid: decodedToken.uid,
              role,
              organizationId,
            });
          }
        }
      } catch (adminError: any) {
        console.log('[API Auth] Admin SDK Firestore failed:', adminError.message);
        // Try client SDK as last resort
        try {
          const userProfile = await FirestoreService.get('users', decodedToken.uid);
          if (userProfile) {
            role = userProfile.role;
            organizationId = organizationId || userProfile.organizationId;
            console.log('[API Auth] User profile loaded via client SDK:', { role, organizationId });
          }
        } catch (clientError: any) {
          console.log('[API Auth] Client SDK also failed:', clientError.message);
        }
      }
    }

    console.log('[API Auth] Final auth result:', { uid: decodedToken.uid, email: decodedToken.email, role, organizationId });

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
  } catch (error) {
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

