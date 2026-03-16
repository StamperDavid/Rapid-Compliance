/**
 * Campaign Deliverables API — Add and list deliverables for a campaign
 *
 * POST /api/campaigns/[campaignId]/deliverables — Add a deliverable
 * GET  /api/campaigns/[campaignId]/deliverables — List deliverables
 *
 * Authentication: Required
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { CreateDeliverableSchema } from '@/types/campaign';
import {
  getCampaign,
  addDeliverable,
  listDeliverables,
} from '@/lib/campaign/campaign-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// POST — Add a deliverable to a campaign
// ============================================================================

export async function POST(
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
    const parsed = CreateDeliverableSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const deliverableId = await addDeliverable(campaignId, parsed.data);

    return NextResponse.json(
      { success: true, data: { deliverableId } },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error(
      'Deliverable creation failed',
      error instanceof Error ? error : undefined,
      { route: '/api/campaigns/[campaignId]/deliverables' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to add deliverable' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET — List deliverables for a campaign
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

    const deliverables = await listDeliverables(campaignId);

    return NextResponse.json({
      success: true,
      data: { deliverables },
    });
  } catch (error: unknown) {
    logger.error(
      'Deliverable list failed',
      error instanceof Error ? error : undefined,
      { route: '/api/campaigns/[campaignId]/deliverables' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to list deliverables' },
      { status: 500 }
    );
  }
}
