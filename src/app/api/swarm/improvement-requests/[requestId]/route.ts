/**
 * Specialist Improvement Request Detail API
 *
 * GET  /api/swarm/improvement-requests/[requestId] — get request details
 * PUT  /api/swarm/improvement-requests/[requestId] — review (approve/reject)
 * POST /api/swarm/improvement-requests/[requestId] — apply approved changes
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { getImprovementRequest } from '@/lib/agents/shared/specialist-improvement-generator';
import { reviewImprovementRequest, applyImprovementRequest } from '@/lib/agents/shared/specialist-improvement-applier';
import { ReviewImprovementRequestSchema, ApplyImprovementRequestSchema } from '@/lib/training/agent-training-validation';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/swarm/improvement-requests/[requestId]');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { requestId } = await params;

    const improvementRequest = await getImprovementRequest(requestId);
    if (!improvementRequest) {
      return errors.notFound(`Improvement request not found: ${requestId}`);
    }

    return NextResponse.json({
      success: true,
      request: improvementRequest,
    });
  } catch (error) {
    logger.error(
      '[ImprovementRequestDetailAPI] GET failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to fetch improvement request'
    );
  }
}

/**
 * PUT — Review: approve or reject
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/swarm/improvement-requests/[requestId]');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { requestId } = await params;

    const body = await request.json() as unknown;
    const parseResult = ReviewImprovementRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request');
    }

    const { action, notes } = parseResult.data;

    // Get reviewer identity from auth
    const reviewedBy = 'user' in authResult ? authResult.user.uid : 'unknown';

    const result = await reviewImprovementRequest(
      requestId,
      action === 'approve',
      reviewedBy,
      notes
    );

    if (!result) {
      return errors.notFound(`Improvement request not found or not in reviewable state: ${requestId}`);
    }

    logger.info('[ImprovementRequestDetailAPI] Reviewed', {
      requestId,
      action,
      reviewedBy,
    });

    return NextResponse.json({
      success: true,
      request: result,
    });
  } catch (error) {
    logger.error(
      '[ImprovementRequestDetailAPI] PUT failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to review improvement request'
    );
  }
}

/**
 * POST — Apply approved changes
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/swarm/improvement-requests/[requestId]');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { requestId } = await params;

    const body = await request.json() as unknown;
    const parseResult = ApplyImprovementRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request');
    }

    const result = await applyImprovementRequest(requestId);

    if (!result.success) {
      return errors.badRequest(result.error ?? 'Failed to apply improvement request');
    }

    logger.info('[ImprovementRequestDetailAPI] Applied', { requestId, goldenMasterVersion: result.goldenMasterVersion });

    return NextResponse.json({
      success: true,
      message: `Improvement request ${requestId} applied successfully`,
      goldenMasterVersion: result.goldenMasterVersion,
    });
  } catch (error) {
    logger.error(
      '[ImprovementRequestDetailAPI] POST failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to apply improvement request'
    );
  }
}
