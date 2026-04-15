/**
 * Reject Prompt Edit API
 *
 * POST /api/training/feedback/[feedbackId]/reject
 *
 * Human rejected the Prompt Engineer's proposed edit. Marks the feedback
 * record as discarded with the rejection reason. Does NOT modify any
 * specialist Golden Master — the "no grades = no GM changes" standing
 * rule applies here: a rejected grade is a non-event for the GM.
 *
 * Body: { reason: string } — the human's reason for rejecting the edit.
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rejectPromptEdit } from '@/lib/training/grade-submission-service';

export const dynamic = 'force-dynamic';

const RejectEditSchema = z.object({
  reason: z.string().min(5).max(2000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ feedbackId: string }> },
) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }
  const { user } = authResult;

  const { feedbackId } = await params;
  if (!feedbackId) {
    return NextResponse.json(
      { success: false, error: 'feedbackId is required' },
      { status: 400 },
    );
  }

  try {
    const body: unknown = await request.json();
    const parsed = RejectEditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const result = await rejectPromptEdit({
      feedbackId,
      reason: parsed.data.reason,
      rejecterUserId: user.uid,
    });

    if (result.status === 'ERROR') {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Reject failed' },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: true, status: result.status });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      '[GradeSpecialistAPI] Reject failed',
      error instanceof Error ? error : new Error(errorMessage),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
