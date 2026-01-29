/**
 * System Status API Route
 *
 * Returns live telemetry from the MASTER_ORCHESTRATOR including:
 * - Manager health status
 * - Active saga counts
 * - Command success rates
 * - Recent insights
 *
 * This bridges the gap between the 47 backend agents and the Dashboard UI.
 *
 * @module api/system/status
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import {
  getMasterOrchestrator,
  type SwarmStatus,
  type ManagerBrief,
} from '@/lib/agents/orchestrator/manager';
import type { AgentStatus } from '@/lib/agents/types';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// RESPONSE TYPES - Frontend-optimized shapes
// ============================================================================

/**
 * Frontend-compatible agent status for UI rendering
 */
export interface SystemAgentStatus {
  id: string;
  name: string;
  status: 'FUNCTIONAL' | 'SHELL' | 'GHOST' | 'EXECUTING';
  lastActivity: string;
  health: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  activeWorkloads: number;
  errors: string[];
}

/**
 * System status response for Dashboard consumption
 */
export interface SystemStatusResponse {
  success: true;
  timestamp: string;
  overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE';
  agents: SystemAgentStatus[];
  metrics: {
    totalAgents: number;
    functionalAgents: number;
    executingAgents: number;
    activeSagas: number;
    completedSagas: number;
    failedSagas: number;
    totalCommands: number;
    successRate: number;
    averageResponseTimeMs: number;
  };
  insights: Array<{
    id: string;
    type: string;
    title: string;
    summary: string;
    confidence: number;
    createdAt: string;
  }>;
}

export interface SystemStatusError {
  success: false;
  error: string;
  timestamp: string;
}

// ============================================================================
// MAPPING UTILITIES
// ============================================================================

/**
 * Human-readable names for manager IDs
 */
const MANAGER_NAMES: Record<string, string> = {
  MARKETING_MANAGER: 'Marketing Manager',
  REVENUE_DIRECTOR: 'Revenue Director',
  ARCHITECT_MANAGER: 'Architect Manager',
  BUILDER_MANAGER: 'Builder Manager',
  CONTENT_MANAGER: 'Content Manager',
  OUTREACH_MANAGER: 'Outreach Manager',
  COMMERCE_MANAGER: 'Commerce Manager',
  REPUTATION_MANAGER: 'Reputation Manager',
  INTELLIGENCE_MANAGER: 'Intelligence Manager',
};

/**
 * Map backend AgentStatus to frontend display status
 * Backend: 'GHOST' | 'UNBUILT' | 'SHELL' | 'FUNCTIONAL' | 'TESTED'
 * Frontend: 'FUNCTIONAL' | 'SHELL' | 'GHOST' | 'EXECUTING'
 */
function mapAgentStatus(
  backendStatus: AgentStatus,
  activeWorkloads: number
): 'FUNCTIONAL' | 'SHELL' | 'GHOST' | 'EXECUTING' {
  // If agent has active workloads, it's executing
  if (activeWorkloads > 0) {
    return 'EXECUTING';
  }

  switch (backendStatus) {
    case 'FUNCTIONAL':
    case 'TESTED':
      return 'FUNCTIONAL';
    case 'SHELL':
    case 'UNBUILT':
      return 'SHELL';
    case 'GHOST':
    default:
      return 'GHOST';
  }
}

/**
 * Transform backend ManagerBrief to frontend SystemAgentStatus
 */
function transformManagerBrief(brief: ManagerBrief): SystemAgentStatus {
  return {
    id: brief.managerId,
    name: MANAGER_NAMES[brief.managerId] ?? brief.managerId,
    status: mapAgentStatus(brief.status, brief.activeWorkloads),
    lastActivity: brief.lastActivity instanceof Date
      ? brief.lastActivity.toISOString()
      : String(brief.lastActivity),
    health: brief.health,
    activeWorkloads: brief.activeWorkloads,
    errors: brief.errors,
  };
}

/**
 * Transform full SwarmStatus to SystemStatusResponse
 */
function transformSwarmStatus(swarmStatus: SwarmStatus): SystemStatusResponse {
  const agents = swarmStatus.managers.map(transformManagerBrief);
  const functionalAgents = agents.filter(
    a => a.status === 'FUNCTIONAL' || a.status === 'EXECUTING'
  ).length;
  const executingAgents = agents.filter(a => a.status === 'EXECUTING').length;

  return {
    success: true,
    timestamp: swarmStatus.timestamp instanceof Date
      ? swarmStatus.timestamp.toISOString()
      : String(swarmStatus.timestamp),
    overallHealth: swarmStatus.overallHealth,
    agents,
    metrics: {
      totalAgents: agents.length,
      functionalAgents,
      executingAgents,
      activeSagas: swarmStatus.activeSagas,
      completedSagas: swarmStatus.completedSagas,
      failedSagas: swarmStatus.failedSagas,
      totalCommands: swarmStatus.totalCommands,
      successRate: swarmStatus.successRate,
      averageResponseTimeMs: swarmStatus.averageResponseTimeMs,
    },
    insights: swarmStatus.insights.map(insight => ({
      id: insight.id,
      type: insight.value?.type ?? 'UNKNOWN',
      title: insight.value?.title ?? 'Untitled',
      summary: insight.value?.summary ?? '',
      confidence: insight.value?.confidence ?? 0,
      createdAt: insight.createdAt instanceof Date
        ? insight.createdAt.toISOString()
        : String(insight.createdAt),
    })),
  };
}

// ============================================================================
// API HANDLERS
// ============================================================================

/**
 * GET /api/system/status
 *
 * Returns live system status from the MASTER_ORCHESTRATOR
 * Requires admin authentication
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<SystemStatusResponse | SystemStatusError>> {
  const startTime = Date.now();

  try {
    // Verify admin authentication
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

    // Get tenant ID from query params or auth context
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') ?? authResult.user.tenantId ?? 'default';

    logger.info('[SystemStatus] Fetching swarm status', {
      tenantId,
      adminId: authResult.user.uid,
      file: 'api/system/status/route.ts',
    });

    // Get the Master Orchestrator instance
    const orchestrator = getMasterOrchestrator();

    // Initialize if not already done
    await orchestrator.initialize();

    // Fetch live swarm status
    const swarmStatus = await orchestrator.getSwarmStatus(tenantId);

    // Transform to frontend-compatible response
    const response = transformSwarmStatus(swarmStatus);

    const duration = Date.now() - startTime;
    logger.info('[SystemStatus] Status retrieved successfully', {
      tenantId,
      overallHealth: response.overallHealth,
      agentCount: response.agents.length,
      duration,
      file: 'api/system/status/route.ts',
    });

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Response-Time': `${duration}ms`,
      },
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      '[SystemStatus] Failed to fetch system status',
      error instanceof Error ? error : new Error(errorMessage),
      {
        duration,
        file: 'api/system/status/route.ts',
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
