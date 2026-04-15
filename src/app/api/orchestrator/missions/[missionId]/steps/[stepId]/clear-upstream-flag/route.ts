/**
 * Clear Upstream Flag Endpoint (M5)
 *
 * POST /api/orchestrator/missions/[missionId]/steps/[stepId]/clear-upstream-flag
 *
 * The operator looked at a downstream step after an upstream rerun,
 * decided the prior output is still valid, and clicked "Still good".
 * Removes the upstreamChanged flag without re-running the step. The
 * step keeps its existing toolResult.
 *
 * Use this when the downstream step doesn't actually depend on the
 * upstream output — e.g., research → blog post → social post: changing
 * the social post's args doesn't invalidate the blog post.
 *
 * Body: empty object {} — no parameters needed.
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { clearStepUpstreamFlag } from '@/lib/orchestrator/mission-persistence';

export const dynamic = 'force-dynamic';

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

    const ok = await clearStepUpstreamFlag(missionId, stepId);
    if (!ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not clear flag — mission may not exist, may be in plan-review status, or step may not be COMPLETED/FAILED',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, missionId, stepId });
  } catch (err) {
    logger.error('[StepAPI] clear-upstream-flag failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to clear flag' }, { status: 500 });
  }
}
