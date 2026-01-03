import { NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import {
  getIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegration,
  syncIntegration,
} from '@/lib/integrations/integration-manager';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * GET /api/integrations/[integrationId] - Get integration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations');
    if (rateLimitResponse) return rateLimitResponse;

    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    if (!user.organizationId) {
      return errors.badRequest('Organization ID required');
    }

    const integration = await getIntegration(user.organizationId, params.integrationId);

    if (!integration) {
      return errors.notFound('Integration not found');
    }

    return NextResponse.json({
      success: true,
      integration,
    });
  } catch (error: any) {
    logger.error('Error fetching integration', error, { route: '/api/integrations' });
    return errors.database('Failed to fetch integration', error);
  }
}

/**
 * PATCH /api/integrations/[integrationId] - Update integration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { user } = authResult;

    if (!user.organizationId) {
      return errors.badRequest('Organization ID required');
    }

    await updateIntegration(user.organizationId, params.integrationId, body);

    return NextResponse.json({
      success: true,
      message: 'Integration updated',
    });
  } catch (error: any) {
    logger.error('Error updating integration', error, { route: '/api/integrations' });
    return errors.database('Failed to update integration', error);
  }
}

/**
 * DELETE /api/integrations/[integrationId] - Delete integration
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    if (!user.organizationId) {
      return errors.badRequest('Organization ID required');
    }

    await deleteIntegration(user.organizationId, params.integrationId);

    return NextResponse.json({
      success: true,
      message: 'Integration deleted',
    });
  } catch (error: any) {
    logger.error('Error deleting integration', error, { route: '/api/integrations' });
    return errors.database('Failed to delete integration', error);
  }
}



















