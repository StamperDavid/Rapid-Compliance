/**
 * Flagged Sessions API
 *
 * GET /api/agent-performance/flagged-sessions — list flagged production sessions
 * GET /api/agent-performance/flagged-sessions?agentType=voice — filter by agent type
 * GET /api/agent-performance/flagged-sessions?limit=20 — limit results
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { ListFlaggedSessionsRequestSchema } from '@/lib/training/agent-training-validation';
import { getFlaggedSessions } from '@/lib/training/auto-flag-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent-performance/flagged-sessions');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const agentTypeParam = searchParams.get('agentType') ?? undefined;
    const limitParam = searchParams.get('limit') ?? undefined;

    const parseResult = ListFlaggedSessionsRequestSchema.safeParse({
      agentType: agentTypeParam,
      limit: limitParam,
    });
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request');
    }

    const { agentType, limit } = parseResult.data;

    const sessions = await getFlaggedSessions(agentType, limit, false);

    logger.info('[FlaggedSessionsAPI] Returning flagged sessions', {
      agentType: agentType ?? 'all',
      count: sessions.length,
    });

    return NextResponse.json({
      success: true,
      sessions,
      total: sessions.length,
      filters: {
        agentType: agentType ?? 'all',
        limit,
        includeProcessed: false,
      },
    });
  } catch (error) {
    logger.error(
      '[FlaggedSessionsAPI] Failed to fetch flagged sessions',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal(
      error instanceof Error ? error.message : 'Failed to fetch flagged sessions'
    );
  }
}
