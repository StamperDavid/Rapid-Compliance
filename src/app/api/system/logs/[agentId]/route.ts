/**
 * Agent Telemetry Logs API
 * STATUS: PRODUCTION-READY (SINGLE-TENANT)
 *
 * GET /api/system/logs/[agentId]
 * Fetches real-time telemetry from SignalBus history for a specific agent
 *
 * SECURITY:
 * - Requires admin authentication
 * - Validates agentId against AGENT_IDS registry
 *
 * FEATURES:
 * - Paginated log retrieval with efficient filtering
 * - Time-range queries (since/until)
 * - Status filtering (SUCCESS/FAILED/PENDING)
 * - Signal type filtering
 * - Aggregated statistics per agent
 *
 * @module api/system/logs/[agentId]
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';

// SignalBus and Agent Registry
import { getSignalBus, type SignalHistoryEntry, type SignalHistoryOptions } from '@/lib/orchestrator/signal-bus';
import { isValidAgentId } from '@/lib/agents/agent-factory';

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Log entry formatted for API response
 */
interface LogEntry {
  signalId: string;
  signalType: string;
  origin: string;
  target: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  processedAt: string;
  durationMs: number | null;
  errorMessage: string | null;
  payload: Record<string, unknown> | null;
}

/**
 * Agent logs response
 */
interface AgentLogsResponse {
  success: true;
  agentId: string;
  logs: LogEntry[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
  stats: {
    totalSignals: number;
    successCount: number;
    failureCount: number;
    pendingCount: number;
    averageDurationMs: number;
    lastActivity: string | null;
  };
  timestamp: string;
}

interface AgentLogsError {
  success: false;
  error: string;
  timestamp: string;
}

// ============================================================================
// QUERY PARAMETER SCHEMA
// ============================================================================

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  status: z.enum(['SUCCESS', 'FAILED', 'PENDING']).optional(),
  signalType: z.enum(['BROADCAST', 'DIRECT', 'BUBBLE_UP', 'BUBBLE_DOWN']).optional(),
  includePayload: z.coerce.boolean().optional().default(false),
});

// ============================================================================
// TRANSFORM HELPER
// ============================================================================

/**
 * Transform SignalHistoryEntry to API-friendly LogEntry
 */
function transformLogEntry(entry: SignalHistoryEntry, includePayload: boolean): LogEntry {
  return {
    signalId: entry.signal.id,
    signalType: entry.signal.type,
    origin: entry.signal.origin,
    target: entry.targetAgentId,
    status: entry.status,
    processedAt: entry.processedAt.toISOString(),
    durationMs: entry.durationMs ?? null,
    errorMessage: entry.errorMessage ?? null,
    payload: includePayload ? (entry.signal.payload as unknown as Record<string, unknown>) : null,
  };
}

// ============================================================================
// ROUTE PARAMS TYPE
// ============================================================================

interface RouteParams {
  params: Promise<{
    agentId: string;
  }>;
}

// ============================================================================
// GET HANDLER
// ============================================================================

/**
 * GET /api/system/logs/[agentId]
 * Fetch telemetry logs for a specific agent
 *
 * @requires Admin authentication
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<AgentLogsResponse | AgentLogsError>> {
  const startTime = Date.now();

  try {
    // ========================================================================
    // AUTHENTICATION
    // ========================================================================
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error,
          timestamp: new Date().toISOString(),
        },
        { status: authResult.status }
      );
    }

    // ========================================================================
    // EXTRACT AND VALIDATE AGENT ID
    // ========================================================================
    const { agentId } = await params;

    if (!agentId || !isValidAgentId(agentId)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid agent ID: ${agentId}. Must be one of the 47 registered agents.`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // PARSE QUERY PARAMETERS
    // ========================================================================
    const { searchParams } = new URL(request.url);
    const queryResult = querySchema.safeParse({
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      since: searchParams.get('since'),
      until: searchParams.get('until'),
      status: searchParams.get('status'),
      signalType: searchParams.get('signalType'),
      includePayload: searchParams.get('includePayload'),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Query parameter validation failed: ${queryResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { limit, offset, since, until, status, signalType, includePayload } = queryResult.data;

    logger.info(`[AgentLogs] Fetching logs for agent ${agentId}`, {
      limit,
      offset,
      adminId: authResult.user.uid,
      file: 'api/system/logs/[agentId]/route.ts',
    });

    // ========================================================================
    // FETCH FROM SIGNAL BUS
    // ========================================================================
    const signalBus = getSignalBus();

    // Build query options
    const historyOptions: SignalHistoryOptions = {
      agentId,
      limit,
      offset,
      status: status,
      signalType: signalType,
    };

    if (since) {
      historyOptions.since = new Date(since);
    }
    if (until) {
      historyOptions.until = new Date(until);
    }

    // Get filtered history
    const historyResult = signalBus.getHistory(historyOptions);

    // Get agent statistics
    const stats = signalBus.getAgentStats(agentId);

    // Transform entries to API format
    const logs = historyResult.entries.map(entry => transformLogEntry(entry, includePayload));

    const duration = Date.now() - startTime;

    logger.info(`[AgentLogs] Retrieved ${logs.length} logs for agent ${agentId}`, {
      total: historyResult.total,
      duration,
      file: 'api/system/logs/[agentId]/route.ts',
    });

    // ========================================================================
    // BUILD RESPONSE
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        agentId,
        logs,
        pagination: {
          total: historyResult.total,
          offset,
          limit,
          hasMore: historyResult.hasMore,
        },
        stats: {
          totalSignals: stats?.totalSignals ?? 0,
          successCount: stats?.successCount ?? 0,
          failureCount: stats?.failureCount ?? 0,
          pendingCount: stats?.pendingCount ?? 0,
          averageDurationMs: stats?.averageDurationMs ?? 0,
          lastActivity: stats?.lastActivity?.toISOString() ?? null,
        },
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Response-Time': `${duration}ms`,
        },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      '[AgentLogs] Error fetching agent logs',
      error instanceof Error ? error : new Error(errorMessage),
      {
        file: 'api/system/logs/[agentId]/route.ts',
      }
    );

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
