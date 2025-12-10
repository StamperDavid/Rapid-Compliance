import { NextRequest } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { createErrorResponse, createSuccessResponse } from '@/lib/api/admin-auth';

/**
 * POST /api/admin/verify
 * Verifies that the authenticated user is a super_admin or admin
 * Returns user data if authorized
 */
export async function POST(request: NextRequest) {
  try {
    // Get the auth token from the request headers
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse('Missing or invalid Authorization header', 401);
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    if (!token || token.length < 100) {
      return createErrorResponse('Invalid token format', 401);
    }
    
    // Verify the token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (tokenError: any) {
      console.error('Token verification failed:', tokenError.code);
      return createErrorResponse(
        tokenError.code === 'auth/id-token-expired' 
          ? 'Token expired - please re-authenticate'
          : 'Invalid authentication token',
        401
      );
    }
    
    const userId = decodedToken.uid;
    
    // Get user document to check role
    const userDoc = await adminDb.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return createErrorResponse('User not found in database', 403);
    }
    
    const userData = userDoc.data()!;
    
    // Check for admin roles
    const adminRoles = ['super_admin', 'admin'];
    if (!adminRoles.includes(userData.role)) {
      console.warn(`Non-admin login attempt by user ${userId} with role ${userData.role}`);
      return createErrorResponse(
        'Admin access required. Please contact your platform administrator.',
        403
      );
    }
    
    console.log(`✅ Admin verified: ${userData.email} (${userData.role})`);
    
    return createSuccessResponse({
      uid: userId,
      email: userData.email || decodedToken.email,
      name: userData.name || userData.displayName || 'Admin User',
      role: userData.role,
      organizationId: userData.organizationId || 'platform',
      verified: true
    });
    
  } catch (error: any) {
    console.error('Admin verify error:', error);
    return createErrorResponse('Verification failed', 500);
  }
}


