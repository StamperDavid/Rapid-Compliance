import { NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { generateAuthUrl } from '@/lib/integrations/oauth-service';

/**
 * GET /api/integrations/oauth/authorize - Generate OAuth authorization URL
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const integrationId = searchParams.get('integrationId');
    const provider = searchParams.get('provider') as 'google' | 'microsoft' | 'slack';

    if (!integrationId || !provider) {
      return NextResponse.json(
        { success: false, error: 'integrationId and provider required' },
        { status: 400 }
      );
    }

    const { user } = authResult;
    const organizationId = user.organizationId;

    const authUrl = await generateAuthUrl(organizationId, workspaceId || undefined, integrationId, provider);

    return NextResponse.json({
      success: true,
      authUrl,
    });
  } catch (error: any) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}

