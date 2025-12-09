/**
 * Admin API Authentication Middleware
 * Centralized authentication for admin API routes
 */

import { NextRequest } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

export interface AdminUser {
  uid: string;
  email: string;
  role: 'super_admin' | 'admin';
  organizationId: string;
}

export type AuthResult = {
  success: true;
  user: AdminUser;
} | {
  success: false;
  error: string;
  status: 401 | 403;
}

/**
 * Verify the request is from an authenticated super_admin
 * Returns the admin user data if successful, or an error response
 */
export async function verifyAdminRequest(request: NextRequest): Promise<AuthResult> {
  try {
    // Get the auth token from the request headers
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Missing or invalid Authorization header',
        status: 401
      };
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    if (!token || token.length < 100) {
      return {
        success: false,
        error: 'Invalid token format',
        status: 401
      };
    }
    
    // Verify the token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (tokenError: any) {
      console.error('Token verification failed:', tokenError.code);
      return {
        success: false,
        error: tokenError.code === 'auth/id-token-expired' 
          ? 'Token expired - please re-authenticate'
          : 'Invalid authentication token',
        status: 401
      };
    }
    
    const userId = decodedToken.uid;
    
    // Get user document to check role
    const userDoc = await adminDb.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return {
        success: false,
        error: 'User not found in database',
        status: 403
      };
    }
    
    const userData = userDoc.data()!;
    
    // Check for super_admin role
    if (userData.role !== 'super_admin') {
      console.warn(`Non-admin access attempt by user ${userId} with role ${userData.role}`);
      return {
        success: false,
        error: 'Super admin access required',
        status: 403
      };
    }
    
    return {
      success: true,
      user: {
        uid: userId,
        email: userData.email || decodedToken.email || '',
        role: userData.role,
        organizationId: userData.organizationId || 'platform'
      }
    };
    
  } catch (error: any) {
    console.error('Admin auth error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      status: 401
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

