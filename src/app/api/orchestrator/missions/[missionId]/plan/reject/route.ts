/**
 * Plan Reject Endpoint (M4)
 *
 * POST /api/orchestrator/missions/[missionId]/plan/reject
 *
 * Rejects a draft plan and moves the mission to FAILED with the
 * operator's reason. This is also the "scrap the whole mission" path
 * during plan review — there is no undo once rejected.
 *
 * Body: { reason?: string }
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rejectPlan } from '@/lib/orchestrator/mission-persistence';

export const dynamic = 'force-dynamic';

const RejectSchema = z.object({
  reason: z.string().min(1).max(2000).optional(),
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

    let parsed: { reason?: string } = {};
    try {
      const body: unknown = await request.json();
      const result = RejectSchema.safeParse(body);
      if (result.success) { parsed = result.data; }
    } catch {
      // Empty body is allowed — reason is optional
    }

    const ok = await rejectPlan(missionId, parsed.reason);
    if (!ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not reject — mission may not be in plan-review status, or it does not exist.',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, missionId, status: 'FAILED' });
  } catch (err) {
    logger.error('[PlanAPI] reject failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to reject plan' }, { status: 500 });
  }
}
