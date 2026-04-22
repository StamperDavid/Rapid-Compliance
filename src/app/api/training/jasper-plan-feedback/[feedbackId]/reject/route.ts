/**
 * Reject Jasper Plan-Edit API
 *
 * POST /api/training/jasper-plan-feedback/[feedbackId]/reject
 *
 * Human rejected a Prompt Engineer proposal that was generated from an
 * operator plan edit. Marks the feedback record `rejected` with the
 * supplied reason. Jasper's Golden Master is NOT modified — the
 * "no grades = no GM changes" standing rule applies: a rejected proposal
 * is a non-event for the GM.
 *
 * Body (optional):
 *   { reason?: string }
 *
 * Success response: { success: true, feedbackId }
 * Error responses:  { success: false, error } with 400 / 404 / 409 / 422 / 500.
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rejectJasperPlanEdit } from '@/lib/training/jasper-plan-feedback-service';

export const dynamic = 'force-dynamic';

const RejectBodySchema = z.object({
  reason: z.string().min(1).max(2000).optional(),
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
    // Body is optional — absent body means "reject with no reason".
    let parsedBody: z.infer<typeof RejectBodySchema> = {};

    const contentLength = request.headers.get('content-length');
    const hasBody = contentLength !== null && contentLength !== '0';
    if (hasBody) {
      let rawBody: unknown;
      try {
        rawBody = await request.json();
      } catch {
        rawBody = {};
      }
      const parsed = RejectBodySchema.safeParse(rawBody ?? {});
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid request payload', details: parsed.error.flatten() },
          { status: 422 },
        );
      }
      parsedBody = parsed.data;
    }

    const result = await rejectJasperPlanEdit(feedbackId, user.uid, parsedBody.reason);

    if (!result.success) {
      const lower = (result.error ?? '').toLowerCase();
      const status = lower.includes('not found')
        ? 404
        : lower.includes("not 'pending_review'") || lower.includes('cannot reject')
          ? 409
          : 500;
      logger.info('[JasperPlanFeedbackAPI] Reject not applied', {
        feedbackId,
        actorUid: user.uid,
        status,
        error: result.error,
      });
      return NextResponse.json(
        { success: false, error: result.error ?? 'Reject failed' },
        { status },
      );
    }

    logger.info('[JasperPlanFeedbackAPI] Rejected plan edit proposal', {
      feedbackId,
      actorUid: user.uid,
      hasReason: Boolean(parsedBody.reason),
    });

    return NextResponse.json(
      { success: true, feedbackId },
      { status: 200 },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(
      '[JasperPlanFeedbackAPI] Reject failed',
      err instanceof Error ? err : new Error(errorMessage),
      { feedbackId, actorUid: user.uid },
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
