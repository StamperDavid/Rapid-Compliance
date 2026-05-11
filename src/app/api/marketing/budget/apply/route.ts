/**
 * Marketing Budget — Apply a recommendation.
 *
 * POST /api/marketing/budget/apply
 *   Body: {
 *     snapshotId: string;     // the snapshot the recommendation came from
 *     platform: string;       // recommendation.platform key
 *     confirmed: true;        // operator's second click of the two-step
 *   }
 *
 * Two-step confirmation is enforced CLIENT-SIDE (the budget page button
 * arms on first click, fires on second). Server-side we also require
 * `confirmed: true` to refuse stray API calls that bypass the UI.
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { getLatestSnapshot } from '@/lib/marketing/budget-snapshot-service';
import { applyRecommendation } from '@/lib/marketing/budget-apply-service';
import { adminDb } from '@/lib/firebase/admin';
import { getMarketingBudgetSnapshotsCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  snapshotId: z.string().min(1).optional(),
  platform: z.string().min(1).max(80),
  /**
   * Optional override for `recommendation.recommendedSpendUsd`. If the
   * operator edited the amount in the page before clicking Apply, the page
   * sends the edited value here and the service uses it instead.
   */
  overrideSpendUsd: z.number().nonnegative().max(10_000_000).optional(),
  confirmed: z.literal(true),
});

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) {return auth;}

  try {
    const body: unknown = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload (did you set confirmed=true?)', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    // Load the snapshot the recommendation came from. If snapshotId is
    // provided, use that; otherwise fall back to the latest.
    let snapshot;
    if (parsed.data.snapshotId && adminDb) {
      const ref = adminDb.collection(getMarketingBudgetSnapshotsCollection()).doc(parsed.data.snapshotId);
      const snap = await ref.get();
      if (!snap.exists) {
        return NextResponse.json({ success: false, error: 'Snapshot not found' }, { status: 404 });
      }
      const data = snap.data() as { inputs?: unknown; result?: { recommendations: unknown[] } } | undefined;
      const inputs = data?.inputs;
      const result = data?.result;
      if (!inputs || !result) {
        return NextResponse.json({ success: false, error: 'Snapshot malformed (missing inputs or result)' }, { status: 500 });
      }
      snapshot = { id: snap.id, inputs, result } as unknown as Awaited<ReturnType<typeof getLatestSnapshot>>;
    } else {
      snapshot = await getLatestSnapshot();
    }

    if (!snapshot) {
      return NextResponse.json({ success: false, error: 'No snapshot to apply against. Run an analysis first.' }, { status: 400 });
    }

    const recommendation = snapshot.result.recommendations.find(
      (r) => r.platform.toLowerCase() === parsed.data.platform.toLowerCase(),
    );
    if (!recommendation) {
      return NextResponse.json(
        { success: false, error: `No recommendation for platform "${parsed.data.platform}" in this snapshot` },
        { status: 404 },
      );
    }

    // If the operator edited the recommended amount in the UI, swap it in
    // before handing off to the apply service. Preserves the rest of the
    // recommendation (rationale, action type, manual-mission flag).
    const effectiveRecommendation = typeof parsed.data.overrideSpendUsd === 'number'
      ? { ...recommendation, recommendedSpendUsd: parsed.data.overrideSpendUsd }
      : recommendation;

    const applyResult = await applyRecommendation(effectiveRecommendation, { windowDays: snapshot.inputs.windowDays });

    logger.info('[BudgetApplyAPI] apply complete', {
      platform: recommendation.platform,
      outcome: applyResult.outcome,
      userId: auth.user.uid,
      snapshotId: snapshot.id,
    });

    const httpStatus =
      applyResult.outcome === 'auto_applied' || applyResult.outcome === 'manual_mission_required'
        ? 200
        : applyResult.outcome === 'not_configured'
          ? 400
          : applyResult.outcome === 'no_active_campaigns'
            ? 409
            : 500;

    return NextResponse.json({ success: applyResult.outcome === 'auto_applied' || applyResult.outcome === 'manual_mission_required', result: applyResult }, { status: httpStatus });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[BudgetApplyAPI] apply failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
