import type { NextRequest } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import {
  verifyAdminRequest,
  createErrorResponse,
  createSuccessResponse,
  isAuthError
} from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';

interface OrganizationData {
  name?: string;
}

/**
 * DELETE /api/admin/organizations/[orgId]
 * Deletes a single organization (platform_admin only)
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

  // Only platform_admins can delete organizations
  if (authResult.user.role !== 'platform_admin') {
    return createErrorResponse('Only platform_admins can delete organizations', 403);
  }

  try {
    if (!adminDal) {
      return createErrorResponse('Server configuration error', 500);
    }

    const { orgId } = params;

    if (!orgId) {
      return createErrorResponse('Organization ID is required', 400);
    }

    // Check if organization exists
    const orgDoc = await adminDal.safeGetDoc('ORGANIZATIONS', orgId);

    if (!orgDoc.exists) {
      return createErrorResponse('Organization not found', 404);
    }

    const orgData = orgDoc.data() as OrganizationData | undefined;
    const orgDataName = orgData?.name;
    const orgName = (orgDataName !== '' && orgDataName != null) ? orgDataName : 'Unknown';

    // Delete the organization
    await adminDal.safeDeleteDoc('ORGANIZATIONS', orgId, {
      audit: true,
      userId: authResult.user.uid,
    });

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

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Admin organization delete error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/admin/organizations/[orgId]',
      orgId: params.orgId
    });
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to delete organization: ${errorMessage}`
        : 'Failed to delete organization',
      500
    );
  }
}
