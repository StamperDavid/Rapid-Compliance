/**
 * Plan Edit-Step Endpoint (M4)
 *
 * POST /api/orchestrator/missions/[missionId]/plan/edit-step
 *
 * Edits a single step in a draft plan — operator can change the
 * one-line summary and/or the tool arguments. Mission must be in
 * PLAN_PENDING_APPROVAL status; step must be in PROPOSED status.
 *
 * Body: {
 *   stepId: string,
 *   updates: { summary?: string, toolArgs?: Record<string, unknown> }
 * }
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { updatePlannedStep } from '@/lib/orchestrator/mission-persistence';
import { captureJasperPlanCorrection } from '@/lib/orchestrator/plan-edit-training-capture';

export const dynamic = 'force-dynamic';

const EditStepSchema = z.object({
  stepId: z.string().min(1).max(200),
  updates: z.object({
    summary: z.string().min(1).max(500).optional(),
    toolArgs: z.record(z.unknown()).optional(),
  }).refine(
    (v) => v.summary !== undefined || v.toolArgs !== undefined,
    { message: 'updates must include at least one of: summary, toolArgs' },
  ),
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
    const parsed = EditStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const result = await updatePlannedStep(missionId, parsed.data.stepId, parsed.data.updates);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not edit step — mission may not be in plan-review status, step may not be in proposed status, or the IDs may not exist.',
        },
        { status: 409 },
      );
    }

    // Await the Prompt Engineer call so the popup can open inline with the
    // proposal as soon as the response lands. Yes, this means the API call
    // takes ~30-45s instead of ~200ms — the operator sees a spinner during
    // that wait, and the inline popup is the deliberate UX (vs the previous
    // banner-with-30s-poll design that the owner rejected).
    const jasperProposal = await captureJasperPlanCorrection({
      missionId,
      stepId: parsed.data.stepId,
      actionType: 'edit',
      before: result.before ?? null,
      after: result.after ?? null,
      graderUserId: user.uid,
    });

    return NextResponse.json({
      success: true,
      missionId,
      stepId: parsed.data.stepId,
      jasperProposal,
    });
  } catch (err) {
    logger.error('[PlanAPI] edit-step failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to edit step' }, { status: 500 });
  }
}
