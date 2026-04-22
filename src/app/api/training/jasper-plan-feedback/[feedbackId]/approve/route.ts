/**
 * Approve Jasper Plan-Edit API
 *
 * POST /api/training/jasper-plan-feedback/[feedbackId]/approve
 *
 * Human approved a Prompt Engineer proposal that was generated from an
 * operator plan edit. Creates a new versioned Jasper Golden Master with
 * the edit applied, deploys it atomically, invalidates the cache, and
 * marks the feedback `applied`.
 *
 * Body (optional):
 *   { proposedTextOverride?: string }
 *
 *   — if present, the operator hand-edited the Prompt Engineer's
 *   suggestion before accepting. Used as the proposedText instead of
 *   `proposal.afterSection`.
 *
 * Success response: { success: true, feedbackId, newVersionNumber }
 * Error responses:  { success: false, error, ... } with 400 / 404 / 409 / 422 / 500.
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { approveJasperPlanEdit } from '@/lib/training/jasper-plan-feedback-service';

export const dynamic = 'force-dynamic';

const ApproveBodySchema = z.object({
  proposedTextOverride: z.string().min(1).max(16000).optional(),
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
    // Body is optional — absent body means "approve as-is".
    let parsedBody: z.infer<typeof ApproveBodySchema> = {};

    const contentLength = request.headers.get('content-length');
    const hasBody = contentLength !== null && contentLength !== '0';
    if (hasBody) {
      let rawBody: unknown;
      try {
        rawBody = await request.json();
      } catch {
        rawBody = {};
      }
      const parsed = ApproveBodySchema.safeParse(rawBody ?? {});
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid request payload', details: parsed.error.flatten() },
          { status: 422 },
        );
      }
      parsedBody = parsed.data;
    }

    const override = parsedBody.proposedTextOverride
      ? { proposedText: parsedBody.proposedTextOverride }
      : undefined;

    const result = await approveJasperPlanEdit(feedbackId, user.uid, override);

    if (!result.success) {
      const lower = (result.error ?? '').toLowerCase();
      const status = lower.includes('not found')
        ? 404
        : lower.includes("not 'pending_review'") || lower.includes('cannot approve')
          ? 409
          : 500;
      logger.info('[JasperPlanFeedbackAPI] Approve rejected', {
        feedbackId,
        actorUid: user.uid,
        status,
        error: result.error,
      });
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? 'Approve failed',
          newVersionNumber: result.newVersionNumber,
        },
        { status },
      );
    }

    logger.info('[JasperPlanFeedbackAPI] Approved plan edit — Jasper GM updated', {
      feedbackId,
      actorUid: user.uid,
      newVersionNumber: result.newVersionNumber,
    });

    return NextResponse.json(
      {
        success: true,
        feedbackId,
        newVersionNumber: result.newVersionNumber,
      },
      { status: 200 },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(
      '[JasperPlanFeedbackAPI] Approve failed',
      err instanceof Error ? err : new Error(errorMessage),
      { feedbackId, actorUid: user.uid },
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
