/**
 * Single Deliverable API — Update a specific deliverable (approve/reject/feedback)
 *
 * PATCH /api/campaigns/[campaignId]/deliverables/[deliverableId]
 *
 * Authentication: Required
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { UpdateDeliverableSchema, type DeliverableType } from '@/types/campaign';
import {
  getCampaign,
  getDeliverable,
  updateDeliverable,
} from '@/lib/campaign/campaign-service';
import { autoFlagForTraining } from '@/lib/training/auto-flag-service';
import type { AgentDomain } from '@/types/training';

export const dynamic = 'force-dynamic';

/**
 * Map deliverable types to the agent domain that produced them.
 * Rejected deliverables flag the PRODUCING agent's Golden Master for training.
 */
const DELIVERABLE_TO_AGENT_DOMAIN: Partial<Record<DeliverableType, AgentDomain>> = {
  blog: 'seo',
  video: 'video',
  social_post: 'social',
  email: 'email',
  image: 'video',
  landing_page: 'seo',
};

// ============================================================================
// PATCH — Update deliverable status (approve/reject/feedback)
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string; deliverableId: string }> }
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { campaignId, deliverableId } = await params;

    if (!campaignId || !deliverableId) {
      return NextResponse.json(
        { success: false, error: 'campaignId and deliverableId are required' },
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

    const deliverable = await getDeliverable(campaignId, deliverableId);
    if (!deliverable) {
      return NextResponse.json(
        { success: false, error: 'Deliverable not found' },
        { status: 404 }
      );
    }

    const body: unknown = await request.json();
    const parsed = UpdateDeliverableSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await updateDeliverable(
      campaignId,
      deliverableId,
      parsed.data,
      authResult.user.uid
    );

    // Route rejected/revision deliverables to the producing agent's training pipeline
    const newStatus = parsed.data.status;
    if (newStatus === 'rejected' || newStatus === 'revision_requested') {
      const agentDomain = DELIVERABLE_TO_AGENT_DOMAIN[deliverable.type];
      if (agentDomain) {
        const score = newStatus === 'rejected' ? 20 : 40; // rejected=1 star, revision=2 stars
        const issues = parsed.data.feedback
          ? [parsed.data.feedback]
          : [`Deliverable ${newStatus}: ${deliverable.title}`];
        autoFlagForTraining(deliverableId, agentDomain, score, issues).catch((flagErr) => {
          logger.warn('Failed to flag deliverable for training', {
            deliverableId,
            agentDomain,
            error: flagErr instanceof Error ? flagErr.message : String(flagErr),
          });
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error(
      'Deliverable update failed',
      error instanceof Error ? error : undefined,
      { route: '/api/campaigns/[campaignId]/deliverables/[deliverableId]' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update deliverable' },
      { status: 500 }
    );
  }
}
