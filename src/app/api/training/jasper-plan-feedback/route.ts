/**
 * Jasper Plan-Edit Feedback List API
 *
 * GET /api/training/jasper-plan-feedback
 *
 * Returns every `jasperPlanEditFeedback` record in status `pending_review`,
 * newest first, plus the total count across all statuses (pending + applied +
 * approved + rejected). The reviewer UI uses `pending` to render the review
 * queue and `total` for a badge/heuristic of overall training volume.
 *
 * Response: { success: true, pending: JasperPlanFeedbackRecord[], total: number }
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { listPendingJasperFeedback } from '@/lib/training/jasper-plan-feedback-service';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

const COLLECTION_NAME = 'jasperPlanEditFeedback';

/**
 * Count every document in the `jasperPlanEditFeedback` collection, regardless
 * of status. Uses Firestore's aggregate count query so we don't pay the cost
 * of reading every doc just to learn how many exist.
 */
async function countAllFeedback(): Promise<number> {
  if (!adminDb) {
    logger.warn('[JasperPlanFeedbackAPI] adminDb unavailable — total count = 0');
    return 0;
  }
  const snapshot = await adminDb
    .collection(getSubCollection(COLLECTION_NAME))
    .count()
    .get();
  return snapshot.data().count;
}

export async function GET(request: NextRequest) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }
  const { user } = authResult;

  try {
    const [pending, total] = await Promise.all([
      listPendingJasperFeedback(),
      countAllFeedback(),
    ]);

    logger.info('[JasperPlanFeedbackAPI] Listed pending feedback', {
      actorUid: user.uid,
      pendingCount: pending.length,
      totalCount: total,
    });

    return NextResponse.json({ success: true, pending, total });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(
      '[JasperPlanFeedbackAPI] List failed',
      err instanceof Error ? err : new Error(errorMessage),
      { actorUid: user.uid },
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
