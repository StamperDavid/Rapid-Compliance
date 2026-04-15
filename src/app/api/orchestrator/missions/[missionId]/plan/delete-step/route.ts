/**
 * Plan Delete-Step Endpoint (M4)
 *
 * POST /api/orchestrator/missions/[missionId]/plan/delete-step
 *
 * Removes a single step from a draft plan. Mission must be in
 * PLAN_PENDING_APPROVAL status. Cannot delete the last remaining step
 * — operator should reject the whole plan instead via /plan/reject.
 *
 * Body: { stepId: string }
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { deletePlannedStep } from '@/lib/orchestrator/mission-persistence';

export const dynamic = 'force-dynamic';

const DeleteStepSchema = z.object({
  stepId: z.string().min(1).max(200),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> },
) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }

  try {
    const { missionId } = await params;
    if (!missionId) {
      return NextResponse.json({ success: false, error: 'missionId is required' }, { status: 400 });
    }

    const body: unknown = await request.json();
    const parsed = DeleteStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const ok = await deletePlannedStep(missionId, parsed.data.stepId);
    if (!ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not delete step — mission may not be in plan-review status, the step may not exist, or this is the last step (reject the whole plan instead).',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, missionId, deletedStepId: parsed.data.stepId });
  } catch (err) {
    logger.error('[PlanAPI] delete-step failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to delete step' }, { status: 500 });
  }
}
