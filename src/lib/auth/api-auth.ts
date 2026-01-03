/**
 * API Authentication Middleware
 * Validates authentication tokens and user permissions for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';;

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
      return adminAuth;
    }

    // Initialize with service account or use default credentials
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : undefined;

    let app;
    if (serviceAccount) {
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Use default credentials (for GCP deployment)
      app = admin.initializeApp();
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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);

    // Try to verify token using Firebase Admin SDK
    const auth = await initializeAdminAuth();
    
    if (!auth) {
      // In development, if admin SDK is not configured, allow requests
      if (process.env.NODE_ENV === 'development') {
        logger.warn('⚠️ Firebase Admin not configured. Skipping token verification in development.', { file: 'api-auth.ts' });
        return null; // Will be handled by requireAuth
      }
      return null;
    }

    const decodedToken = await auth.verifyIdToken(token);

    // Get user profile from Firestore
    const userProfile = await FirestoreService.get('users', decodedToken.uid);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      emailVerified: decodedToken.email_verified || false,
      organizationId: userProfile?.organizationId,
      role: userProfile?.role,
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

  // In development, allow bypass if Firebase Admin is not configured
  if (!user && process.env.NODE_ENV === 'development') {
    logger.warn('⚠️ Development mode: Allowing unauthenticated request', { file: 'api-auth.ts' });
    return {
      user: {
        uid: 'dev-user',
        email: 'dev@example.com',
        emailVerified: true,
        organizationId: 'dev-org',
        role: 'admin',
      },
    };
  }

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
  if (!user.organizationId && !['admin', 'owner', 'super_admin'].includes(user.role || '')) {
    return NextResponse.json(
      { success: false, error: 'User must belong to an organization' },
      { status: 403 }
    );
  }

  return { user };
}

