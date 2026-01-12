import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { testIntegration } from '@/lib/integrations/integration-manager';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * POST /api/integrations/[integrationId]/test - Test integration connection
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/test');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    if (!user.organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const result = await testIntegration(user.organizationId, params.integrationId);

    return NextResponse.json({
      success: result.success,
      error: result.error,
    });
  } catch (error: any) {
    logger.error('Error testing integration', error, { route: '/api/integrations/test' });
    return errors.externalService('Integration', error instanceof Error ? error : undefined);
  }
}



















