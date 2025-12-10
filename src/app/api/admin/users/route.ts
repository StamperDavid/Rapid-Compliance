import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { 
  verifyAdminRequest, 
  createErrorResponse, 
  createSuccessResponse 
} from '@/lib/api/admin-auth';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
}

/**
 * GET /api/admin/users
 * Fetches all users for super_admin
 * Uses Admin SDK to bypass client-side Firestore rules
 */
export async function GET(request: NextRequest) {
  // Verify admin authentication
  const authResult = await verifyAdminRequest(request);
  
  if (!authResult.success) {
    const { error, status } = authResult;
    return createErrorResponse(error, status);
  }
  
  try {
    // Parse query params for filtering
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    
    // Build query
    let query = adminDb.collection('users').orderBy('createdAt', 'desc');
    
    if (organizationId) {
      query = query.where('organizationId', '==', organizationId);
    }
    
    const usersSnapshot = await query.limit(limit).get();
    
    const users: UserData[] = usersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email || '',
        name: data.name || data.displayName || 'Unknown',
        role: data.role || 'member',
        organizationId: data.organizationId || '',
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        lastLoginAt: data.lastLoginAt?.toDate?.()?.toISOString() || null,
      };
    });
    
    console.log(
      `📊 [Admin API] ${authResult.user.email} fetched ${users.length} users`
    );
    
    return createSuccessResponse({ 
      users,
      count: users.length,
      fetchedAt: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ [Admin API] Users fetch error:', error);
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to fetch users: ${error.message}`
        : 'Failed to fetch users',
      500
    );
  }
}

/**
 * PATCH /api/admin/users
 * Updates a user (super_admin only)
 */
export async function PATCH(request: NextRequest) {
  // Verify admin authentication  
  const authResult = await verifyAdminRequest(request);
  
  if (!authResult.success) {
    const { error, status } = authResult;
    return createErrorResponse(error, status);
  }
  
  try {
    const body = await request.json();
    
    if (!body.userId || typeof body.userId !== 'string') {
      return createErrorResponse('User ID is required', 400);
    }
    
    // Validate update fields
    const allowedFields = ['name', 'role', 'organizationId', 'status'];
    const updates: Record<string, unknown> = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return createErrorResponse('No valid update fields provided', 400);
    }
    
    updates.updatedAt = new Date();
    updates.updatedBy = authResult.user.uid;
    
    await adminDb.collection('users').doc(body.userId).update(updates);
    
    console.log(
      `📊 [Admin API] ${authResult.user.email} updated user ${body.userId}: ${Object.keys(updates).join(', ')}`
    );
    
    return createSuccessResponse({ 
      success: true,
      userId: body.userId,
      updatedFields: Object.keys(updates).filter(k => k !== 'updatedAt' && k !== 'updatedBy')
    });
    
  } catch (error: any) {
    console.error('❌ [Admin API] User update error:', error);
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to update user: ${error.message}`
        : 'Failed to update user',
      500
    );
  }
}
