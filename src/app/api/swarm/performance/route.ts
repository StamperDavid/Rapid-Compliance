/**
 * Swarm Performance API
 *
 * GET /api/swarm/performance — all specialists with aggregated metrics
 * GET /api/swarm/performance?period=30 — with period filter (days)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { getAllSpecialistMetrics, identifyLowPerformers } from '@/lib/agents/shared/specialist-metrics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/swarm/performance');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);
    const periodDays = Math.max(1, Math.min(365, parseInt(searchParams.get('period') ?? '30', 10) || 30));

    const [allMetrics, lowPerformers] = await Promise.all([
      getAllSpecialistMetrics(periodDays),
      identifyLowPerformers(periodDays),
    ]);

    // Compute summary stats
    const totalExecutions = allMetrics.reduce((sum, m) => sum + m.totalExecutions, 0);
    const overallSuccessRate = totalExecutions > 0
      ? allMetrics.reduce((sum, m) => sum + m.successRate * m.totalExecutions, 0) / totalExecutions
      : 0;

    logger.info('[SwarmPerformanceAPI] Returning metrics', {
      specialistCount: allMetrics.length,
      totalExecutions,
      lowPerformerCount: lowPerformers.length,
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalSpecialists: allMetrics.length,
        totalExecutions,
        overallSuccessRate: Math.round(overallSuccessRate * 1000) / 1000,
        lowPerformerCount: lowPerformers.length,
        periodDays,
      },
      specialists: allMetrics,
      lowPerformers: lowPerformers.map(lp => lp.agentId),
    });
  } catch (error) {
    logger.error(
      '[SwarmPerformanceAPI] Failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to fetch swarm performance'
    );
  }
}
