/**
 * Swarm Improvement Requests API
 *
 * GET  /api/swarm/improvement-requests — list pending/all improvement requests
 * POST /api/swarm/improvement-requests — trigger improvement analysis for a specialist
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { getImprovementRequests, generateImprovementRequest } from '@/lib/agents/shared/specialist-improvement-generator';
import { CreateImprovementRequestSchema } from '@/lib/training/agent-training-validation';
import type { SpecialistImprovementRequest } from '@/types/training';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/swarm/improvement-requests');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') as SpecialistImprovementRequest['status'] | null;
    const limitParam = parseInt(searchParams.get('limit') ?? '50', 10) || 50;

    const requests = await getImprovementRequests(
      statusParam ?? undefined,
      Math.min(100, limitParam)
    );

    return NextResponse.json({
      success: true,
      requests,
      total: requests.length,
    });
  } catch (error) {
    logger.error(
      '[ImprovementRequestsAPI] GET failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to fetch improvement requests'
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/swarm/improvement-requests');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body = await request.json() as unknown;
    const parseResult = CreateImprovementRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request');
    }

    const { specialistId, specialistName } = parseResult.data;

    const result = await generateImprovementRequest(specialistId, specialistName);

    if (!result) {
      return NextResponse.json({
        success: true,
        message: 'Not enough data or no improvement patterns found',
        request: null,
      });
    }

    logger.info('[ImprovementRequestsAPI] Generated improvement request', {
      requestId: result.id,
      specialistId,
      changeCount: result.proposedChanges.length,
    });

    return NextResponse.json({
      success: true,
      request: result,
    }, { status: 201 });
  } catch (error) {
    logger.error(
      '[ImprovementRequestsAPI] POST failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to generate improvement request'
    );
  }
}
