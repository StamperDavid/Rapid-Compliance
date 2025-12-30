import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { 
  verifyAdminRequest, 
  createErrorResponse, 
  createSuccessResponse,
  isAuthError
} from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';

/**
 * DELETE /api/admin/organizations/[orgId]
 * Deletes a single organization (super_admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  // Verify admin authentication
  const authResult = await verifyAdminRequest(request);
  
  if (isAuthError(authResult)) {
    return createErrorResponse(authResult.error, authResult.status);
  }
  
  // Only super_admins can delete organizations
  if (authResult.user.role !== 'super_admin') {
    return createErrorResponse('Only super_admins can delete organizations', 403);
  }
  
  try {
    const { orgId } = params;
    
    if (!orgId) {
      return createErrorResponse('Organization ID is required', 400);
    }
    
    // Check if organization exists
    const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
    
    if (!orgDoc.exists) {
      return createErrorResponse('Organization not found', 404);
    }
    
    const orgData = orgDoc.data();
    const orgName = orgData?.name || 'Unknown';
    
    // Delete the organization
    await adminDb.collection('organizations').doc(orgId).delete();
    
    logger.info('Admin deleted organization', {
      route: '/api/admin/organizations/[orgId]',
      admin: authResult.user.email,
      orgId,
      orgName
    });
    
    return createSuccessResponse({
      message: `Successfully deleted organization: ${orgName}`,
      orgId,
      orgName
    });
    
  } catch (error: any) {
    logger.error('Admin organization delete error', error, { 
      route: '/api/admin/organizations/[orgId]',
      orgId: params.orgId
    });
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to delete organization: ${error.message}`
        : 'Failed to delete organization',
      500
    );
  }
}
