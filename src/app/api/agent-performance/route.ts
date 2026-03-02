/**
 * Agent Performance List API
 *
 * GET /api/agent-performance — list all agent rep profiles with performance data
 * GET /api/agent-performance?agentType=chat — filter by agent type
 *
 * Returns each agent's profile, aggregated performance, and flagged session count.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { listAgentRepProfiles } from '@/lib/agents/agent-rep-profiles';
import { getAgentAggregation } from '@/lib/agents/shared/performance-tracker';
import { getFlaggedSessions } from '@/lib/training/auto-flag-service';
import type { AgentDomain } from '@/types/training';

export const dynamic = 'force-dynamic';

const VALID_AGENT_TYPES = ['chat', 'voice', 'email', 'social', 'seo'];

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent-performance');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);
    const agentTypeParam = searchParams.get('agentType');

    // Validate agentType filter if provided
    const agentTypeFilter = agentTypeParam && VALID_AGENT_TYPES.includes(agentTypeParam)
      ? agentTypeParam as AgentDomain
      : undefined;

    // 1. List all agent rep profiles
    const profiles = await listAgentRepProfiles(agentTypeFilter);

    // 2. Fetch performance and flagged counts in parallel
    const results = await Promise.all(
      profiles.map(async (profile) => {
        const [aggregation, flaggedSessions] = await Promise.all([
          getAgentAggregation(profile.agentId, '30').catch(() => null),
          getFlaggedSessions(profile.agentType, 100, false).catch(() => []),
        ]);

        return {
          agent: {
            agentId: profile.agentId,
            agentType: profile.agentType,
            agentName: profile.agentName,
            goldenMasterId: profile.goldenMasterId ?? null,
            thresholds: profile.performanceThresholds,
          },
          performance: aggregation,
          flaggedSessionCount: flaggedSessions.length,
        };
      })
    );

    // 3. Total flagged across all types
    const totalFlagged = results.reduce((sum, r) => sum + r.flaggedSessionCount, 0);

    logger.info('[AgentPerformanceAPI] Returning agent performance list', {
      count: results.length,
      totalFlagged,
    });

    return NextResponse.json({
      success: true,
      agents: results,
      total: results.length,
      totalFlagged,
    });
  } catch (error) {
    logger.error(
      '[AgentPerformanceAPI] Failed to list agent performance',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to list agent performance'
    );
  }
}
