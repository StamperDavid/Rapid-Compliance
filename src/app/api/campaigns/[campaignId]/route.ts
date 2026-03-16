/**
 * Single Campaign API — Get or update a specific campaign
 *
 * GET   /api/campaigns/[campaignId] — Fetch campaign with its deliverables
 * PATCH /api/campaigns/[campaignId] — Update campaign fields
 *
 * Authentication: Required
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { UpdateCampaignSchema } from '@/types/campaign';
import {
  getCampaign,
  updateCampaign,
  listDeliverables,
} from '@/lib/campaign/campaign-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET — Fetch campaign with deliverables
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { campaignId } = await params;

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: 'campaignId is required' },
        { status: 400 }
      );
    }

    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Include deliverables in the response
    const deliverables = await listDeliverables(campaignId);

    return NextResponse.json({
      success: true,
      data: { ...campaign, deliverableItems: deliverables },
    });
  } catch (error: unknown) {
    logger.error(
      'Campaign fetch failed',
      error instanceof Error ? error : undefined,
      { route: '/api/campaigns/[campaignId]' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch campaign' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH — Update campaign
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { campaignId } = await params;

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: 'campaignId is required' },
        { status: 400 }
      );
    }

    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const body: unknown = await request.json();
    const parsed = UpdateCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await updateCampaign(campaignId, parsed.data);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error(
      'Campaign update failed',
      error instanceof Error ? error : undefined,
      { route: '/api/campaigns/[campaignId]' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update campaign' },
      { status: 500 }
    );
  }
}
