/**
 * Edit Step Output Endpoint (M6)
 *
 * POST /api/orchestrator/missions/[missionId]/steps/[stepId]/edit-output
 *
 * The operator clicked "Edit output directly" and pasted in their own
 * text. Replaces the step's toolResult with the new text and sets the
 * manuallyEdited audit flag.
 *
 * Does NOT fire the Prompt Engineer. Does NOT change any specialist's
 * instructions. This is a quick-fix path for tweaks too minor to train
 * the agent on. For changes worth training, use the StepGradeWidget
 * (M2b) instead.
 *
 * Body: { newToolResult: string } — the operator's replacement text.
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { manuallyEditStepOutput } from '@/lib/orchestrator/mission-persistence';

export const dynamic = 'force-dynamic';

const EditOutputSchema = z.object({
  newToolResult: z.string().min(1).max(200000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string; stepId: string }> },
) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }

  try {
    const { missionId, stepId } = await params;
    if (!missionId || !stepId) {
      return NextResponse.json(
        { success: false, error: 'missionId and stepId are required' },
        { status: 400 },
      );
    }

    const body: unknown = await request.json();
    const parsed = EditOutputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const ok = await manuallyEditStepOutput(missionId, stepId, parsed.data.newToolResult);
    if (!ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not edit output — mission may not exist, may be in plan-review status, or step may not be COMPLETED/FAILED',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, missionId, stepId, manuallyEdited: true });
  } catch (err) {
    logger.error('[StepAPI] edit-output failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to edit output' }, { status: 500 });
  }
}
