import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { generateAuthUrl } from '@/lib/integrations/oauth-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * GET /api/integrations/oauth/authorize - Generate OAuth authorization URL
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/oauth/authorize');
    if (rateLimitResponse) {return rateLimitResponse;}

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
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }


    const authUrl = await generateAuthUrl(organizationId, workspaceId || undefined, integrationId, provider);

    return NextResponse.json({
      success: true,
      authUrl,
    });
  } catch (error: any) {
    logger.error('Error generating auth URL', error, { route: '/api/integrations/oauth/authorize' });
    return errors.externalService('OAuth service', error);
  }
}



















