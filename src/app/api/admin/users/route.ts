import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { 
  verifyAdminRequest, 
  createErrorResponse, 
  createSuccessResponse,
  isAuthError
} from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';

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
 * Fetches users for super_admin with pagination
 * Uses Admin SDK to bypass client-side Firestore rules
 * 
 * Query params:
 * - organizationId: filter by org (optional)
 * - limit: page size (default 50, max 100)
 * - startAfter: cursor for pagination (timestamp)
 */
export async function GET(request: NextRequest) {
  // Verify admin authentication
  const authResult = await verifyAdminRequest(request);
  
  if (isAuthError(authResult)) {
    return createErrorResponse(authResult.error, authResult.status);
  }
  
  try {
    // Parse query params for filtering and pagination
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const pageSize = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const startAfter = searchParams.get('startAfter'); // ISO timestamp
    
    // Build query
    let query = adminDb.collection('users').orderBy('createdAt', 'desc');
    
    if (organizationId) {
      query = query.where('organizationId', '==', organizationId);
    }
    
    // Add cursor if provided
    if (startAfter) {
      const cursorDate = new Date(startAfter);
      query = query.startAfter(cursorDate);
    }
    
    // Fetch one extra to check if there are more results
    const usersSnapshot = await query.limit(pageSize + 1).get();
    
    const hasMore = usersSnapshot.docs.length > pageSize;
    const docs = hasMore ? usersSnapshot.docs.slice(0, pageSize) : usersSnapshot.docs;
    
    const users: UserData[] = docs.map(doc => {
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
    
    // Get cursor for next page (last user's createdAt)
    const nextCursor = hasMore && users.length > 0 
      ? users[users.length - 1].createdAt 
      : null;
    
    logger.info('Admin fetched users', { 
      route: '/api/admin/users',
      admin: authResult.user.email, 
      count: users.length, 
      hasMore 
    });
    
    return createSuccessResponse({ 
      users,
      pagination: {
        count: users.length,
        hasMore,
        nextCursor,
      },
      fetchedAt: new Date().toISOString()
    });
    
  } catch (error: any) {
    logger.error('Admin users fetch error', error, { route: '/api/admin/users' });
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
  
  if (isAuthError(authResult)) {
    return createErrorResponse(authResult.error, authResult.status);
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
    
    logger.info('Admin updated user', {
      route: '/api/admin/users',
      admin: authResult.user.email,
      userId: body.userId,
      fields: Object.keys(updates)
    });
    
    return createSuccessResponse({ 
      success: true,
      userId: body.userId,
      updatedFields: Object.keys(updates).filter(k => k !== 'updatedAt' && k !== 'updatedBy')
    });
    
  } catch (error: any) {
    logger.error('Admin user update error', error, { route: '/api/admin/users' });
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to update user: ${error.message}`
        : 'Failed to update user',
      500
    );
  }
}
