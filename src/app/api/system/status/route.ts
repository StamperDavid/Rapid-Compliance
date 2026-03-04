/**
 * System Status API Route
 *
 * Returns live telemetry from the MASTER_ORCHESTRATOR including:
 * - Full agent registry with tier information (L1/L2/L3/STANDALONE)
 * - Agent health status
 * - Active saga counts
 * - Command success rates
 * - Recent insights
 *
 * Agent counts are derived from the dynamic registry in @/lib/agents/agent-registry.
 *
 * @module api/system/status
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import {
  getMasterOrchestrator,
  type SwarmStatus,
} from '@/lib/agents/orchestrator/manager';
import type { AgentStatus } from '@/lib/agents/types';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import {
  AGENT_REGISTRY,
  type AgentDefinition,
  type AgentTier,
} from '@/lib/agents/agent-registry';

export type { AgentTier } from '@/lib/agents/agent-registry';

export const dynamic = 'force-dynamic';

/**
 * Frontend-compatible agent status for UI rendering
 */
export interface SystemAgentStatus {
  id: string;
  name: string;
  role: string;
  tier: AgentTier;
  parentId: string | null;
  status: 'FUNCTIONAL' | 'SHELL' | 'GHOST' | 'EXECUTING';
  lastActivity: string;
  health: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  activeWorkloads: number;
  capabilities: string[];
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
  hierarchy: {
    orchestrator: SystemAgentStatus | null;
    managers: SystemAgentStatus[];
    specialists: SystemAgentStatus[];
    standalone: SystemAgentStatus[];
  };
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
    byTier: {
      L1: { total: number; functional: number };
      L2: { total: number; functional: number };
      L3: { total: number; functional: number };
      STANDALONE: { total: number; functional: number };
    };
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
 * Get live status for a manager from SwarmStatus
 */
function getManagerLiveStatus(
  managerId: string,
  swarmStatus: SwarmStatus
): { status: AgentStatus; health: 'HEALTHY' | 'DEGRADED' | 'OFFLINE'; activeWorkloads: number; errors: string[] } {
  const brief = swarmStatus.managers.find(m => m.managerId === managerId);
  if (brief) {
    return {
      status: brief.status,
      health: brief.health,
      activeWorkloads: brief.activeWorkloads,
      errors: brief.errors,
    };
  }
  // Default for managers not in live status (should not happen)
  return { status: 'FUNCTIONAL', health: 'HEALTHY', activeWorkloads: 0, errors: [] };
}

/**
 * Transform AgentDefinition + live status to SystemAgentStatus
 */
function transformAgentDefinition(
  agent: AgentDefinition,
  liveStatus: { status: AgentStatus; health: 'HEALTHY' | 'DEGRADED' | 'OFFLINE'; activeWorkloads: number; errors: string[] }
): SystemAgentStatus {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    tier: agent.tier,
    parentId: agent.parentId,
    status: mapAgentStatus(liveStatus.status, liveStatus.activeWorkloads),
    lastActivity: new Date().toISOString(),
    health: liveStatus.health,
    activeWorkloads: liveStatus.activeWorkloads,
    capabilities: agent.capabilities,
    errors: liveStatus.errors,
  };
}

/**
 * Transform full SwarmStatus to SystemStatusResponse with all registered agents
 */
function transformSwarmStatus(swarmStatus: SwarmStatus): SystemStatusResponse {
  const allAgents: SystemAgentStatus[] = [];

  // Process all agents from the registry
  for (const agentDef of AGENT_REGISTRY) {
    let liveStatus: { status: AgentStatus; health: 'HEALTHY' | 'DEGRADED' | 'OFFLINE'; activeWorkloads: number; errors: string[] };

    if (agentDef.tier === 'STANDALONE') {
      // Standalone agents - always FUNCTIONAL, independent of swarm
      liveStatus = {
        status: 'FUNCTIONAL',
        health: 'HEALTHY',
        activeWorkloads: 0,
        errors: [],
      };
    } else if (agentDef.tier === 'L1') {
      // Orchestrator - use overall swarm health
      liveStatus = {
        status: 'FUNCTIONAL',
        health: swarmStatus.overallHealth === 'CRITICAL' ? 'DEGRADED' :
                swarmStatus.overallHealth === 'OFFLINE' ? 'OFFLINE' : 'HEALTHY',
        activeWorkloads: swarmStatus.activeSagas,
        errors: [],
      };
    } else if (agentDef.tier === 'L2') {
      // Manager - get live status from swarm
      liveStatus = getManagerLiveStatus(agentDef.id, swarmStatus);
    } else {
      // Specialist (L3) - derive status from parent manager
      const parentManager = swarmStatus.managers.find(m => m.managerId === agentDef.parentId);
      if (parentManager) {
        // Specialists inherit health from parent, all are FUNCTIONAL per SSOT
        liveStatus = {
          status: 'FUNCTIONAL',
          health: parentManager.health,
          activeWorkloads: 0, // Specialists track individual workloads differently
          errors: [],
        };
      } else {
        liveStatus = { status: 'FUNCTIONAL', health: 'HEALTHY', activeWorkloads: 0, errors: [] };
      }
    }

    allAgents.push(transformAgentDefinition(agentDef, liveStatus));
  }

  // Organize by hierarchy
  const orchestrator = allAgents.find(a => a.tier === 'L1') ?? null;
  const managers = allAgents.filter(a => a.tier === 'L2');
  const specialists = allAgents.filter(a => a.tier === 'L3');
  const standalone = allAgents.filter(a => a.tier === 'STANDALONE');

  // Calculate metrics
  const functionalAgents = allAgents.filter(
    a => a.status === 'FUNCTIONAL' || a.status === 'EXECUTING'
  ).length;
  const executingAgents = allAgents.filter(a => a.status === 'EXECUTING').length;

  // Metrics by tier
  const l1Agents = allAgents.filter(a => a.tier === 'L1');
  const l2Agents = allAgents.filter(a => a.tier === 'L2');
  const l3Agents = allAgents.filter(a => a.tier === 'L3');
  const standaloneAgents = allAgents.filter(a => a.tier === 'STANDALONE');

  return {
    success: true,
    timestamp: swarmStatus.timestamp instanceof Date
      ? swarmStatus.timestamp.toISOString()
      : String(swarmStatus.timestamp),
    overallHealth: swarmStatus.overallHealth,
    agents: allAgents,
    hierarchy: {
      orchestrator,
      managers,
      specialists,
      standalone,
    },
    metrics: {
      totalAgents: allAgents.length,
      functionalAgents,
      executingAgents,
      activeSagas: swarmStatus.activeSagas,
      completedSagas: swarmStatus.completedSagas,
      failedSagas: swarmStatus.failedSagas,
      totalCommands: swarmStatus.totalCommands,
      successRate: swarmStatus.successRate,
      averageResponseTimeMs: swarmStatus.averageResponseTimeMs,
      byTier: {
        L1: {
          total: l1Agents.length,
          functional: l1Agents.filter(a => a.status === 'FUNCTIONAL' || a.status === 'EXECUTING').length,
        },
        L2: {
          total: l2Agents.length,
          functional: l2Agents.filter(a => a.status === 'FUNCTIONAL' || a.status === 'EXECUTING').length,
        },
        L3: {
          total: l3Agents.length,
          functional: l3Agents.filter(a => a.status === 'FUNCTIONAL' || a.status === 'EXECUTING').length,
        },
        STANDALONE: {
          total: standaloneAgents.length,
          functional: standaloneAgents.filter(a => a.status === 'FUNCTIONAL' || a.status === 'EXECUTING').length,
        },
      },
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

    logger.info('[SystemStatus] Fetching swarm status', {
      PLATFORM_ID,
      adminId: authResult.user.uid,
      file: 'api/system/status/route.ts',
    });

    // Get the Master Orchestrator instance
    const orchestrator = getMasterOrchestrator();

    // Initialize if not already done
    await orchestrator.initialize();

    // Fetch live swarm status
    const swarmStatus = await orchestrator.getSwarmStatus();

    // Transform to frontend-compatible response
    const response = transformSwarmStatus(swarmStatus);

    const duration = Date.now() - startTime;
    logger.info('[SystemStatus] Status retrieved successfully', {
      PLATFORM_ID,
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
