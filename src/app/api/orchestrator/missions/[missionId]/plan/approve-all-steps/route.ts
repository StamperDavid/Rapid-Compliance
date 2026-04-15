/**
 * Approve All Plan Steps Endpoint (M3.7)
 *
 * POST /api/orchestrator/missions/[missionId]/plan/approve-all-steps
 *
 * The operator clicked the "Approve all steps" shortcut button at the
 * top of the plan review UI. Sets operatorApproved=true on every
 * PROPOSED step in the mission in a single transaction. Mission must
 * be in PLAN_PENDING_APPROVAL.
 *
 * Body: empty object {} — no parameters needed.
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { approveAllPlanSteps } from '@/lib/orchestrator/mission-persistence';

export const dynamic = 'force-dynamic';

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

    const ok = await approveAllPlanSteps(missionId);
    if (!ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not approve steps — mission may not be in plan-review status',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, missionId });
  } catch (err) {
    logger.error('[PlanAPI] approve-all-steps failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to approve all steps' }, { status: 500 });
  }
}
