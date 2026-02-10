import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { testIntegration } from '@/lib/integrations/integration-manager';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

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

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user: _user } = authResult;

    const result = await testIntegration(params.integrationId);

    return NextResponse.json({
      success: result.success,
      error: result.error,
    });
  } catch (error: unknown) {
    logger.error('Error testing integration', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations/test' });
    return errors.externalService('Integration', error instanceof Error ? error : undefined);
  }
}



















