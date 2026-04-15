/**
 * Per-Step Plan Unapprove Endpoint (M3.7)
 *
 * POST /api/orchestrator/missions/[missionId]/plan/unapprove-step
 *
 * The operator clicked the Approve button on a step they previously
 * approved (toggle off). Sets operatorApproved=false on the targeted
 * step. Mission must be in PLAN_PENDING_APPROVAL.
 *
 * Body: { stepId: string }
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { unapprovePlanStep } from '@/lib/orchestrator/mission-persistence';

export const dynamic = 'force-dynamic';

const UnapproveStepSchema = z.object({
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
    const parsed = UnapproveStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const ok = await unapprovePlanStep(missionId, parsed.data.stepId);
    if (!ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not unapprove step — mission may not be in plan-review status, or step may not be in proposed status',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, missionId, stepId: parsed.data.stepId, approved: false });
  } catch (err) {
    logger.error('[PlanAPI] unapprove-step failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to unapprove step' }, { status: 500 });
  }
}
