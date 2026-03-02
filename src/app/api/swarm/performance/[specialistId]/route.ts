/**
 * Specialist Performance Detail API
 *
 * GET /api/swarm/performance/[specialistId] — single specialist with history
 * GET /api/swarm/performance/[specialistId]?period=30 — with period filter
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { getSpecialistMetrics, getSpecialistHistory } from '@/lib/agents/shared/specialist-metrics';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ specialistId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/swarm/performance/[specialistId]');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { specialistId } = await params;
    const { searchParams } = new URL(request.url);
    const periodDays = Math.max(1, Math.min(365, parseInt(searchParams.get('period') ?? '30', 10) || 30));

    const [metrics, history] = await Promise.all([
      getSpecialistMetrics(specialistId, periodDays),
      getSpecialistHistory(specialistId, 50),
    ]);

    if (!metrics && history.length === 0) {
      return errors.notFound(`No performance data found for specialist: ${specialistId}`);
    }

    logger.info('[SpecialistPerformanceAPI] Returning detail', {
      specialistId,
      entryCount: history.length,
    });

    return NextResponse.json({
      success: true,
      specialistId,
      metrics,
      history,
    });
  } catch (error) {
    logger.error(
      '[SpecialistPerformanceAPI] Failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to fetch specialist performance'
    );
  }
}
