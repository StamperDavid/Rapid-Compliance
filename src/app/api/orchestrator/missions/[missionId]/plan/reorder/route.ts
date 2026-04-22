/**
 * Plan Reorder Endpoint (M4)
 *
 * POST /api/orchestrator/missions/[missionId]/plan/reorder
 *
 * Reorders the steps in a draft plan. Body must include the FULL list
 * of stepIds in the new order — every existing step must appear exactly
 * once. Partial reorders are rejected to prevent accidental step loss.
 *
 * Body: { newOrder: string[] }
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { reorderPlannedSteps } from '@/lib/orchestrator/mission-persistence';
import { captureJasperPlanCorrection } from '@/lib/orchestrator/plan-edit-training-capture';

export const dynamic = 'force-dynamic';

const ReorderSchema = z.object({
  newOrder: z.array(z.string().min(1).max(200)).min(1).max(50),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> },
) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }
  const { user } = authResult;

  try {
    const { missionId } = await params;
    if (!missionId) {
      return NextResponse.json({ success: false, error: 'missionId is required' }, { status: 400 });
    }

    const body: unknown = await request.json();
    const parsed = ReorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const result = await reorderPlannedSteps(missionId, parsed.data.newOrder);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not reorder — mission may not be in plan-review status, or the new order does not contain every existing step exactly once.',
        },
        { status: 409 },
      );
    }

    // Fire-and-forget: capture the reorder as a Jasper training signal so
    // future plans of this shape are emitted in the operator's preferred order.
    void captureJasperPlanCorrection({
      missionId,
      stepId: null,
      actionType: 'reorder',
      before: result.before ?? null,
      after: result.after ?? null,
      graderUserId: user.uid,
    });

    return NextResponse.json({
      success: true,
      missionId,
      stepCount: parsed.data.newOrder.length,
      before: result.before,
      after: result.after,
    });
  } catch (err) {
    logger.error('[PlanAPI] reorder failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to reorder steps' }, { status: 500 });
  }
}
