/**
 * Per-Step Plan Approve Endpoint (M3.7)
 *
 * POST /api/orchestrator/missions/[missionId]/plan/approve-step
 *
 * The operator clicked the Approve button on a single step in the
 * plan review UI. Sets operatorApproved=true on the targeted step.
 * Mission must be in PLAN_PENDING_APPROVAL; step must be in PROPOSED.
 *
 * Body: { stepId: string }
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { approvePlanStep } from '@/lib/orchestrator/mission-persistence';

export const dynamic = 'force-dynamic';

const ApproveStepSchema = z.object({
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
    const parsed = ApproveStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const ok = await approvePlanStep(missionId, parsed.data.stepId);
    if (!ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not approve step — mission may not be in plan-review status, or step may not be in proposed status',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, missionId, stepId: parsed.data.stepId, approved: true });
  } catch (err) {
    logger.error('[PlanAPI] approve-step failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to approve step' }, { status: 500 });
  }
}
