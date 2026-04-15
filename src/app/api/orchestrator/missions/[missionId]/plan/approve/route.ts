/**
 * Plan Approve Endpoint (M3.6 corrected design)
 *
 * POST /api/orchestrator/missions/[missionId]/plan/approve
 *
 * The operator approved a draft plan. Mission must be in
 * PLAN_PENDING_APPROVAL status. M3.7 will require every step to be
 * individually approved (operatorApproved=true) before this endpoint
 * accepts the call. Until M3.7 ships its UI, this endpoint sets every
 * step's operatorApproved to true automatically as a temporary bridge.
 *
 * After approval:
 *   1. Flip mission status PLAN_PENDING_APPROVAL → IN_PROGRESS
 *   2. Run the entire plan via runMissionToCompletion (sequential
 *      execution with auto-retry on first failure)
 *   3. Mission ends in COMPLETED, FAILED, or AWAITING_APPROVAL (halted
 *      at a step that failed twice — operator can rerun or scrap)
 *
 * The HTTP request stays open for the entire mission duration. For
 * dev that's fine — there is no timeout. Production hosting (Vercel)
 * would need waitUntil or a background queue.
 *
 * Body: empty object {} — no parameters needed.
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  approvePlan,
  getMission,
  approveAllPlanStepsTemporary,
} from '@/lib/orchestrator/mission-persistence';
import { runMissionToCompletion } from '@/lib/orchestrator/step-runner';

export const dynamic = 'force-dynamic';

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

    // M3.6 BRIDGE: auto-approve every step before the plan-approve
    // flip. M3.7 will replace this with a hard gate that REFUSES the
    // call if any step is still unapproved. Until then we let the
    // operator approve the plan with a single click and infer per-step
    // approval. This bridge call is safe because the only callers of
    // /plan/approve are operators with owner/admin role — they're
    // implicitly approving everything by hitting the button.
    await approveAllPlanStepsTemporary(missionId);

    // Step 1: flip status from PLAN_PENDING_APPROVAL → IN_PROGRESS.
    const flipped = await approvePlan(missionId);
    if (!flipped) {
      return NextResponse.json(
        { success: false, error: 'Could not approve — mission is not in plan-review status or does not exist.' },
        { status: 409 },
      );
    }

    // Step 2: load the mission for runner context.
    const mission = await getMission(missionId);
    if (!mission) {
      return NextResponse.json(
        { success: false, error: 'Mission disappeared after approve flip — Firestore inconsistency' },
        { status: 500 },
      );
    }

    // Step 3: run every approved step to completion. The runner does
    // its own sequential loop with retry; this is one call.
    const runResult = await runMissionToCompletion({
      missionId,
      userId: user.uid,
      conversationId: mission.conversationId,
      userPrompt: mission.userPrompt,
    });

    return NextResponse.json({
      success: runResult.success,
      missionId,
      finalStatus: runResult.finalStatus,
      stepsRun: runResult.stepsRun,
      stepsFailed: runResult.stepsFailed,
      ...(runResult.haltedAtStepId ? { haltedAtStepId: runResult.haltedAtStepId } : {}),
      ...(runResult.error ? { error: runResult.error } : {}),
    });
  } catch (err) {
    logger.error('[PlanAPI] approve failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to approve plan' }, { status: 500 });
  }
}
