import { NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { syncIntegration } from '@/lib/integrations/integration-manager';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * POST /api/integrations/[integrationId]/sync - Sync integration data
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/sync');
    if (rateLimitResponse) return rateLimitResponse;

    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const result = await syncIntegration(user.organizationId, params.integrationId);

    return NextResponse.json({
      success: result.success,
      synced: result.synced,
      error: result.error,
    });
  } catch (error: any) {
    logger.error('Error syncing integration', error, { route: '/api/integrations/sync' });
    return errors.externalService('Integration', error);
  }
}



















