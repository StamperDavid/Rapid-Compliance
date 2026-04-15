/**
 * Plan Approve Endpoint (M3.7 — hard gate enforced)
 *
 * POST /api/orchestrator/missions/[missionId]/plan/approve
 *
 * The operator approved a draft plan and wants to run it. Mission
 * must be in PLAN_PENDING_APPROVAL status. EVERY step must be
 * individually approved (operatorApproved=true) before this endpoint
 * accepts the call — the operator approves steps via the per-step
 * "Approve" buttons in the plan review UI, or via the "Approve all
 * steps" shortcut button.
 *
 * If any step is still unapproved, this endpoint returns 409 with a
 * list of unapproved step IDs. The plan view UI uses this to disable
 * the "Run plan" button until every step is approved or deleted.
 *
 * After all steps approved:
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

    // M3.7 HARD GATE: every step must be individually approved before
    // the plan can run. Refuse with 409 if any step is unapproved so
    // the UI can show the operator which steps still need attention.
    const planMission = await getMission(missionId);
    if (!planMission) {
      return NextResponse.json(
        { success: false, error: 'Mission not found' },
        { status: 404 },
      );
    }
    if (planMission.status !== 'PLAN_PENDING_APPROVAL') {
      return NextResponse.json(
        { success: false, error: 'Mission is not in plan-review status' },
        { status: 409 },
      );
    }
    const unapprovedStepIds = planMission.steps
      .filter((s) => s.status === 'PROPOSED' && s.operatorApproved !== true)
      .map((s) => s.stepId);
    if (unapprovedStepIds.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `${unapprovedStepIds.length} step${unapprovedStepIds.length === 1 ? '' : 's'} not yet approved. Approve every step in the plan view (or click "Approve all steps") before running the plan.`,
          unapprovedStepIds,
        },
        { status: 409 },
      );
    }

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
