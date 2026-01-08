import type { NextRequest } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { adminAuth } from '@/lib/firebase/admin';
import { createErrorResponse, createSuccessResponse } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * POST /api/admin/verify
 * Verifies that the authenticated user is a super_admin or admin
 * Returns user data if authorized
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

    // Verify the token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (tokenError: any) {
      logger.warn('Token verification failed', { route: '/api/admin/verify', code: tokenError.code });
      return createErrorResponse(
        tokenError.code === 'auth/id-token-expired' 
          ? 'Token expired - please re-authenticate'
          : 'Invalid authentication token',
        401
      );
    }
    
    const userId = decodedToken.uid;
    
    if (!adminDal) {
      return createErrorResponse('Server configuration error', 500);
    }
    
    // Get user document to check role using Admin DAL
    const userDoc = await adminDal.safeGetDoc('USERS', userId);
    
    if (!userDoc.exists) {
      return createErrorResponse('User not found in database', 403);
    }
    
    const userData = userDoc.data()!;
    
    // Check for admin roles
    const adminRoles = ['super_admin', 'admin'];
    if (!adminRoles.includes(userData.role)) {
      logger.warn('Non-admin login attempt', { route: '/api/admin/verify', userId, role: userData.role });
      return createErrorResponse(
        'Admin access required. Please contact your platform administrator.',
        403
      );
    }
    
    logger.info('Admin verified', { route: '/api/admin/verify', email: userData.email, role: userData.role });
    
    return createSuccessResponse({
      uid: userId,
      email:userData.email ?? decodedToken.email,
      name:(userData.name || userData.displayName !== '' && userData.name || userData.displayName != null) ? userData.name ?? userData.displayName: 'Admin User',
      role: userData.role,
      organizationId:(userData.organizationId !== '' && userData.organizationId != null) ? userData.organizationId : 'platform',
      verified: true
    });
    
  } catch (error: any) {
    logger.error('Admin verify error', error, { route: '/api/admin/verify' });
    return createErrorResponse('Verification failed', 500);
  }
}










