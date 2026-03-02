/**
 * Agent Performance Detail API
 *
 * GET /api/agent-performance/[agentId] — performance aggregation for a specific agent
 * GET /api/agent-performance/[agentId]?period=last_30_days — with period filter
 *
 * Returns the agent rep profile, performance aggregation, and trend data.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { GetAgentPerformanceRequestSchema } from '@/lib/training/agent-training-validation';
import { getAgentRepProfile } from '@/lib/agents/agent-rep-profiles';
import { getAgentAggregation, getAgentTrend } from '@/lib/agents/shared/performance-tracker';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent-performance/[agentId]');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { agentId } = await params;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period') ?? 'last_30_days';

    const parseResult = GetAgentPerformanceRequestSchema.safeParse({
      agentId,
      period: periodParam,
    });
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request');
    }

    // 1. Load agent rep profile
    const agentProfile = await getAgentRepProfile(agentId);
    if (!agentProfile) {
      return errors.notFound(`Agent rep profile not found: ${agentId}`);
    }

    // 2. Get performance aggregation
    const aggregation = await getAgentAggregation(agentId, parseResult.data.period);

    // 3. Get trend data (last 4 periods)
    const trend = await getAgentTrend(agentId, 4);

    logger.info('[AgentPerformanceAPI] Returning agent performance', {
      agentId,
      agentType: agentProfile.agentType,
      period: parseResult.data.period,
    });

    return NextResponse.json({
      success: true,
      agent: {
        agentId: agentProfile.agentId,
        agentType: agentProfile.agentType,
        agentName: agentProfile.agentName,
        goldenMasterId: agentProfile.goldenMasterId ?? null,
        thresholds: agentProfile.performanceThresholds,
      },
      performance: aggregation,
      trend,
    });
  } catch (error) {
    logger.error(
      '[AgentPerformanceAPI] Failed to fetch agent performance',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to fetch agent performance'
    );
  }
}
