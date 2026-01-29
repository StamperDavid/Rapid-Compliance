/**
 * Admin Swarm Agent Execution API
 * STATUS: PRODUCTION-READY (Full 47-Agent Support)
 *
 * POST to execute any functional agent from the Swarm Control Center
 * Implements circuit breaker pattern, multi-tenant isolation, and error reporting
 *
 * KEY FEATURES:
 * - Dynamic agent instantiation via AgentFactory registry
 * - Supports all 47 agents (1 orchestrator + 9 managers + 37 specialists)
 * - Per-agent circuit breakers with automatic cooldown
 * - Tenant-scoped execution for multi-tenant safety
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';

// Agent Factory and Registry
import {
  getAgentInstance,
  isValidAgentId,
  getAllAgentIds,
} from '@/lib/agents/agent-factory';
import { AGENT_IDS, type AgentId } from '@/lib/agents/index';
import type { AgentMessage, AgentReport } from '@/lib/agents/types';

// ============================================================================
// STANDARDIZED AGENT COMMAND INTERFACE
// ============================================================================

/**
 * Standardized interface for agent execution commands
 */
export interface AgentCommand {
  agentId: AgentId;
  taskId: string;
  tenantId: string;
  payload: Record<string, unknown>;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  traceId?: string;
}

/**
 * Response interface for agent execution
 */
export interface AgentExecutionResponse {
  success: boolean;
  agentId: string;
  taskId: string;
  status: AgentReport['status'];
  data?: unknown;
  errors?: string[];
  duration: number;
  timestamp: string;
  circuitBreaker?: {
    isOpen: boolean;
    failures: number;
    cooldownRemaining?: number;
    threshold?: number;
  };
}

// ============================================================================
// REQUEST VALIDATION SCHEMA
// ============================================================================

/**
 * Dynamic Zod schema that validates against all 47 agent IDs
 * No hardcoded enum - uses runtime registry for validation
 */
const executeSchema = z.object({
  agentId: z.string().min(1).refine(
    (val): val is AgentId => isValidAgentId(val),
    { message: 'Invalid agent ID. Must be one of the 47 registered agents.' }
  ),
  taskId: z.string().min(1, 'taskId is required'),
  tenantId: z.string().min(1, 'tenantId is required for multi-tenant isolation'),
  payload: z.record(z.unknown()),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional().default('NORMAL'),
  traceId: z.string().optional(),
});

// ============================================================================
// CIRCUIT BREAKER IMPLEMENTATION
// ============================================================================

/**
 * Circuit breaker state tracking per agent
 * In-memory implementation - consider Redis for distributed deployments
 */
const circuitBreakers = new Map<string, {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}>();

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute cooldown

/**
 * Check if circuit breaker is open for an agent
 */
function isCircuitOpen(agentId: string): boolean {
  const breaker = circuitBreakers.get(agentId);
  if (!breaker) {
    return false;
  }

  // Auto-reset after cooldown period
  if (breaker.isOpen && Date.now() - breaker.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
    breaker.isOpen = false;
    breaker.failures = 0;
    logger.info(`[SwarmExecute] Circuit breaker RESET for agent ${agentId}`, {
      file: 'admin/swarm/execute/route.ts',
    });
    return false;
  }

  return breaker.isOpen;
}

/**
 * Record a failure and potentially open the circuit breaker
 */
function recordFailure(agentId: string): void {
  const breaker = circuitBreakers.get(agentId) ?? {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
  };

  breaker.failures += 1;
  breaker.lastFailure = Date.now();

  if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    breaker.isOpen = true;
    logger.warn(`[SwarmExecute] Circuit breaker OPENED for agent ${agentId}`, {
      failures: breaker.failures,
      file: 'admin/swarm/execute/route.ts',
    });
  }

  circuitBreakers.set(agentId, breaker);
}

/**
 * Record success and reset the circuit breaker
 */
function recordSuccess(agentId: string): void {
  circuitBreakers.set(agentId, {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
  });
}

/**
 * Get circuit breaker status for an agent
 */
function getCircuitBreakerStatus(agentId: string): {
  isOpen: boolean;
  failures: number;
  lastFailure: string | null;
  cooldownRemaining: number;
} {
  const breaker = circuitBreakers.get(agentId);
  return {
    isOpen: breaker?.isOpen ?? false,
    failures: breaker?.failures ?? 0,
    lastFailure: breaker?.lastFailure ? new Date(breaker.lastFailure).toISOString() : null,
    cooldownRemaining: breaker?.isOpen
      ? Math.max(0, Math.ceil((CIRCUIT_BREAKER_RESET_MS - (Date.now() - (breaker.lastFailure || 0))) / 1000))
      : 0,
  };
}

// ============================================================================
// POST HANDLER - Execute Agent
// ============================================================================

/**
 * POST /api/admin/swarm/execute
 * Execute any valid agent from the 47-agent swarm
 *
 * @requires Admin authentication
 * @requires tenantId for multi-tenant isolation
 */
export async function POST(request: NextRequest): Promise<NextResponse<AgentExecutionResponse>> {
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
          agentId: '',
          taskId: '',
          status: 'FAILED' as const,
          errors: [authResult.error],
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        { status: authResult.status }
      );
    }

    // ========================================================================
    // REQUEST VALIDATION
    // ========================================================================
    const body: unknown = await request.json();
    const validation = executeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          agentId: '',
          taskId: '',
          status: 'FAILED' as const,
          errors: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { agentId, taskId, tenantId, payload, priority, traceId } = validation.data;

    // ========================================================================
    // CIRCUIT BREAKER CHECK
    // ========================================================================
    if (isCircuitOpen(agentId)) {
      const cbStatus = getCircuitBreakerStatus(agentId);

      logger.warn(`[SwarmExecute] Circuit breaker OPEN for ${agentId}`, {
        cooldownRemaining: cbStatus.cooldownRemaining,
        file: 'admin/swarm/execute/route.ts',
      });

      return NextResponse.json(
        {
          success: false,
          agentId,
          taskId,
          status: 'BLOCKED' as const,
          errors: [`Circuit breaker OPEN. Agent has failed ${CIRCUIT_BREAKER_THRESHOLD} times. Cooldown: ${cbStatus.cooldownRemaining}s remaining.`],
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          circuitBreaker: {
            isOpen: true,
            failures: cbStatus.failures,
            cooldownRemaining: cbStatus.cooldownRemaining,
            threshold: CIRCUIT_BREAKER_THRESHOLD,
          },
        },
        { status: 503 }
      );
    }

    // ========================================================================
    // AGENT INSTANTIATION VIA FACTORY
    // ========================================================================
    const agent = getAgentInstance(agentId);

    if (!agent) {
      logger.error(`[SwarmExecute] Agent not found in factory: ${agentId}`, undefined, {
        file: 'admin/swarm/execute/route.ts',
      });

      return NextResponse.json(
        {
          success: false,
          agentId,
          taskId,
          status: 'FAILED' as const,
          errors: [`Agent ${agentId} not found in factory registry`],
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    logger.info(`[SwarmExecute] Executing agent ${agentId}`, {
      taskId,
      tenantId,
      adminId: authResult.user.uid,
      priority,
      file: 'admin/swarm/execute/route.ts',
    });

    // ========================================================================
    // AGENT EXECUTION
    // ========================================================================

    // Initialize the agent
    await agent.initialize();

    // Create the standardized agent message
    const message: AgentMessage = {
      id: taskId,
      timestamp: new Date(),
      from: 'ADMIN_DASHBOARD',
      to: agentId,
      type: 'COMMAND',
      priority: priority ?? 'NORMAL',
      payload: {
        ...payload,
        tenantId, // Inject tenantId for multi-tenant scoping
      },
      requiresResponse: true,
      traceId: traceId ?? taskId,
    };

    // Execute the agent
    const report: AgentReport = await agent.execute(message);
    const duration = Date.now() - startTime;

    // ========================================================================
    // PROCESS RESULT
    // ========================================================================
    if (report.status === 'COMPLETED') {
      recordSuccess(agentId);

      logger.info(`[SwarmExecute] Agent ${agentId} completed successfully`, {
        taskId,
        tenantId,
        duration,
        file: 'admin/swarm/execute/route.ts',
      });

      return NextResponse.json({
        success: true,
        agentId,
        taskId,
        status: 'COMPLETED',
        data: report.data,
        duration,
        timestamp: report.timestamp.toISOString(),
        circuitBreaker: getCircuitBreakerStatus(agentId),
      });
    }

    // Handle failure, blocked, or other statuses
    recordFailure(agentId);

    logger.error(
      `[SwarmExecute] Agent ${agentId} execution failed`,
      new Error(report.errors?.join('; ') ?? 'Unknown error'),
      {
        taskId,
        tenantId,
        status: report.status,
        errors: report.errors,
        duration,
        file: 'admin/swarm/execute/route.ts',
      }
    );

    return NextResponse.json(
      {
        success: false,
        agentId,
        taskId,
        status: report.status,
        errors: report.errors ?? ['Agent execution failed'],
        duration,
        timestamp: report.timestamp.toISOString(),
        circuitBreaker: getCircuitBreakerStatus(agentId),
      },
      { status: 500 }
    );
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Try to track failure for circuit breaker
    try {
      const body = await request.clone().json() as { agentId?: string };
      if (body.agentId && typeof body.agentId === 'string' && isValidAgentId(body.agentId)) {
        recordFailure(body.agentId);
      }
    } catch {
      // Ignore JSON parse errors
    }

    logger.error(
      '[SwarmExecute] Unexpected error during agent execution',
      error instanceof Error ? error : new Error(errorMessage),
      {
        duration,
        file: 'admin/swarm/execute/route.ts',
      }
    );

    return NextResponse.json(
      {
        success: false,
        agentId: '',
        taskId: '',
        status: 'FAILED' as const,
        errors: [errorMessage],
        duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET HANDLER - Circuit Breaker Status
// ============================================================================

/**
 * GET /api/admin/swarm/execute
 * Get circuit breaker status for all 47 agents
 *
 * @requires Admin authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Get all 47 agent IDs from the registry
    const allAgentIds = getAllAgentIds();

    // Build circuit breaker status for all agents
    const circuitBreakerStatuses = allAgentIds.map(agentId => ({
      agentId,
      ...getCircuitBreakerStatus(agentId),
    }));

    // Summarize by status
    const openBreakers = circuitBreakerStatuses.filter(cb => cb.isOpen);
    const degradedAgents = circuitBreakerStatuses.filter(cb => cb.failures > 0 && !cb.isOpen);

    return NextResponse.json({
      success: true,
      summary: {
        totalAgents: allAgentIds.length,
        healthy: allAgentIds.length - openBreakers.length - degradedAgents.length,
        degraded: degradedAgents.length,
        circuitOpen: openBreakers.length,
      },
      circuitBreakers: circuitBreakerStatuses,
      configuration: {
        threshold: CIRCUIT_BREAKER_THRESHOLD,
        cooldownMs: CIRCUIT_BREAKER_RESET_MS,
      },
      availableAgents: Object.keys(AGENT_IDS),
    });
  } catch (error: unknown) {
    logger.error(
      '[SwarmExecute] GET failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'admin/swarm/execute/route.ts' }
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
