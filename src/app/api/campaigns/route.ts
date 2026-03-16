/**
 * Campaigns API — Create and list campaigns
 *
 * POST /api/campaigns — Create a new campaign
 * GET  /api/campaigns — List campaigns with optional filters
 *
 * Authentication: Required
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  CreateCampaignSchema,
  CAMPAIGN_STATUSES,
  type CampaignStatus,
} from '@/types/campaign';
import {
  createCampaign,
  listCampaigns,
} from '@/lib/campaign/campaign-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// POST — Create a new campaign
// ============================================================================

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body: unknown = await request.json();
    const parsed = CreateCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const campaignId = await createCampaign(parsed.data);

    return NextResponse.json(
      { success: true, data: { campaignId } },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error(
      'Campaign creation failed',
      error instanceof Error ? error : undefined,
      { route: '/api/campaigns' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET — List campaigns with optional filters
// ============================================================================

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const startAfterParam = searchParams.get('startAfter');

    let status: CampaignStatus | undefined;
    if (statusParam) {
      const validStatuses: readonly string[] = CAMPAIGN_STATUSES;
      if (!validStatuses.includes(statusParam)) {
        return NextResponse.json(
          { success: false, error: `Invalid status. Must be one of: ${CAMPAIGN_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      status = statusParam as CampaignStatus;
    }

    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 20), 50) : 20;

    const { campaigns, hasMore } = await listCampaigns({
      status,
      limit,
      startAfter: startAfterParam ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { campaigns, hasMore },
    });
  } catch (error: unknown) {
    logger.error(
      'Campaign list failed',
      error instanceof Error ? error : undefined,
      { route: '/api/campaigns' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to list campaigns' },
      { status: 500 }
    );
  }
}
