import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { moveDealToStage } from '@/lib/crm/deal-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const DEAL_STAGES = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const;

const moveStageSchema = z.object({
  stage: z.enum(DEAL_STAGES),
});

/**
 * POST /api/deals/[dealId]/stage - Move deal to a new stage
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = moveStageSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const { stage } = bodyResult.data;
    const deal = await moveDealToStage(dealId, stage);

    return NextResponse.json({ success: true, deal });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to move deal stage';
    logger.error('Failed to move deal stage', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
