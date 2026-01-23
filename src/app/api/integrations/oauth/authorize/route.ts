/**
 * OAuth Authorization URL Generator
 * GET /api/integrations/oauth/authorize
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { generateAuthUrl } from '@/lib/integrations/oauth-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/oauth/authorize');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const integrationId = searchParams.get('integrationId');
    const provider = searchParams.get('provider') as 'google' | 'microsoft' | 'slack';

    if (!integrationId || !provider) {
      return errors.badRequest('integrationId and provider required');
    }

    const { user } = authResult;
    const organizationId = user.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const workspaceIdForAuth = (workspaceId !== '' && workspaceId != null) ? workspaceId : undefined;
    const authUrl = await generateAuthUrl(organizationId, workspaceIdForAuth, integrationId, provider);

    return NextResponse.json({
      success: true,
      authUrl,
    });
  } catch (error) {
    const _errorMessage = error instanceof Error ? error.message : 'Failed to generate auth URL';
    logger.error('Error generating auth URL', error instanceof Error ? error : undefined, { route: '/api/integrations/oauth/authorize' });
    return errors.externalService('OAuth service', error instanceof Error ? error : undefined);
  }
}
