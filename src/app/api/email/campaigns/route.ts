import { NextRequest, NextResponse } from 'next/server';
import { createCampaign, sendCampaign, getCampaignStats, listCampaigns } from '@/lib/email/campaign-manager';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { campaignActionSchema, validateInput, organizationIdSchema } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const campaignId = searchParams.get('campaignId');

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Validate organizationId format
    const orgValidation = organizationIdSchema.safeParse(organizationId);
    if (!orgValidation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid organizationId format' },
        { status: 400 }
      );
    }

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    if (campaignId) {
      // Get specific campaign stats
      const stats = await getCampaignStats(campaignId);
      if (!stats) {
        return NextResponse.json(
          { success: false, error: 'Campaign not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, stats });
    } else {
      // List all campaigns
      const campaigns = await listCampaigns(organizationId);
      return NextResponse.json({ success: true, campaigns });
    }
  } catch (error: any) {
    console.error('Campaign fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/email/campaigns');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body = await request.json();
    const validation = validateInput(campaignActionSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { action, campaign, campaignId, organizationId } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    if (action === 'create') {
      if (!campaign) {
        return NextResponse.json(
          { success: false, error: 'Campaign data is required' },
          { status: 400 }
        );
      }

      const newCampaign = await createCampaign({
        ...campaign,
        organizationId,
        createdBy: user.uid,
      });
      return NextResponse.json({ success: true, campaign: newCampaign });
    }

    if (action === 'send') {
      if (!campaignId) {
        return NextResponse.json(
          { success: false, error: 'campaignId is required' },
          { status: 400 }
        );
      }

      const result = await sendCampaign(campaignId);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use: create or send' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Campaign processing error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process campaign' },
      { status: 500 }
    );
  }
}

