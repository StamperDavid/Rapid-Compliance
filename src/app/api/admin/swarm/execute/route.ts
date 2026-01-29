/**
 * Admin Swarm Agent Execution API
 * POST to execute functional agents from the Swarm Control Center
 * Implements circuit breaker pattern and error reporting
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';

// Import functional agents
import { getMarketingManager, type CampaignGoal } from '@/lib/agents/marketing/manager';
import { getCompetitorResearcher, type CompetitorSearchRequest } from '@/lib/agents/intelligence/competitor/specialist';
import { getTikTokExpert, type TikTokRequest } from '@/lib/agents/marketing/tiktok/specialist';
import type { AgentMessage, AgentReport } from '@/lib/agents/types';

// Request validation schema
const executeSchema = z.object({
  agentId: z.enum(['MARKETING_MANAGER', 'COMPETITOR_RESEARCHER', 'TIKTOK_EXPERT']),
  taskId: z.string().min(1),
  payload: z.record(z.unknown()),
});

// Circuit breaker state (in-memory for now - could be Redis in production)
const circuitBreakers = new Map<string, {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}>();

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute

/**
 * Check if circuit breaker is open
 */
function isCircuitOpen(agentId: string): boolean {
  const breaker = circuitBreakers.get(agentId);
  if (!breaker) {
    return false;
  }

  // Check if cooldown period has passed
  if (breaker.isOpen && Date.now() - breaker.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
    breaker.isOpen = false;
    breaker.failures = 0;
    return false;
  }

  return breaker.isOpen;
}

/**
 * Record a failure for circuit breaker
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
 * Record success and reset circuit breaker
 */
function recordSuccess(agentId: string): void {
  circuitBreakers.set(agentId, {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
  });
}

/**
 * POST /api/admin/swarm/execute
 * Execute a functional agent with given payload
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify admin authentication
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Parse and validate request body
    const body: unknown = await request.json();
    const validation = executeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          errors: validation.error.errors.map(e => e.message),
        },
        { status: 400 }
      );
    }

    const { agentId, taskId, payload } = validation.data;

    // Check circuit breaker
    if (isCircuitOpen(agentId)) {
      const breaker = circuitBreakers.get(agentId);
      const cooldownRemaining = breaker
        ? Math.ceil((CIRCUIT_BREAKER_RESET_MS - (Date.now() - breaker.lastFailure)) / 1000)
        : 0;

      logger.warn(`[SwarmExecute] Circuit breaker OPEN for ${agentId}`, {
        cooldownRemaining,
        file: 'admin/swarm/execute/route.ts',
      });

      return NextResponse.json(
        {
          success: false,
          error: `Circuit breaker OPEN for agent ${agentId}`,
          errors: [`Agent has failed ${CIRCUIT_BREAKER_THRESHOLD} times. Cooldown: ${cooldownRemaining}s remaining.`],
          circuitBreaker: {
            isOpen: true,
            failures: breaker?.failures ?? 0,
            cooldownRemaining,
          },
        },
        { status: 503 }
      );
    }

    logger.info(`[SwarmExecute] Executing agent ${agentId}`, {
      taskId,
      adminId: authResult.user.uid,
      file: 'admin/swarm/execute/route.ts',
    });

    // Create the agent message
    const message: AgentMessage = {
      id: taskId,
      timestamp: new Date(),
      from: 'ADMIN_DASHBOARD',
      to: agentId,
      type: 'COMMAND',
      priority: 'NORMAL',
      payload,
      requiresResponse: true,
      traceId: taskId,
    };

    let report: AgentReport;

    // Execute the appropriate agent
    // Note: payload is validated by Zod schema, but we need to cast through unknown for TypeScript
    switch (agentId) {
      case 'MARKETING_MANAGER': {
        const manager = getMarketingManager();
        await manager.initialize();
        const campaignPayload = payload as unknown as CampaignGoal;
        message.payload = campaignPayload;
        report = await manager.execute(message);
        break;
      }

      case 'COMPETITOR_RESEARCHER': {
        const researcher = getCompetitorResearcher();
        await researcher.initialize();
        const researchPayload = payload as unknown as CompetitorSearchRequest;
        message.payload = researchPayload;
        report = await researcher.execute(message);
        break;
      }

      case 'TIKTOK_EXPERT': {
        const expert = getTikTokExpert();
        await expert.initialize();
        const tiktokPayload = payload as unknown as TikTokRequest;
        message.payload = tiktokPayload;
        report = await expert.execute(message);
        break;
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Unknown agent ID',
            errors: [`Agent ${agentId} is not executable or does not exist`],
          },
          { status: 400 }
        );
    }

    const duration = Date.now() - startTime;

    // Process agent report
    if (report.status === 'COMPLETED') {
      recordSuccess(agentId);

      logger.info(`[SwarmExecute] Agent ${agentId} completed successfully`, {
        taskId,
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
      });
    }

    // Handle failure or blocked status
    recordFailure(agentId);

    logger.error(
      `[SwarmExecute] Agent ${agentId} failed`,
      new Error(report.errors?.join('; ') ?? 'Unknown error'),
      {
        taskId,
        status: report.status,
        errors: report.errors,
        duration,
        file: 'admin/swarm/execute/route.ts',
      }
    );

    const breaker = circuitBreakers.get(agentId);

    return NextResponse.json(
      {
        success: false,
        agentId,
        taskId,
        status: report.status,
        errors: report.errors ?? ['Agent execution failed'],
        duration,
        timestamp: report.timestamp.toISOString(),
        circuitBreaker: {
          isOpen: breaker?.isOpen ?? false,
          failures: breaker?.failures ?? 0,
          threshold: CIRCUIT_BREAKER_THRESHOLD,
        },
      },
      { status: 500 }
    );
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Try to extract agentId from the body for circuit breaker tracking
    try {
      const body = await request.clone().json() as { agentId?: string };
      if (body.agentId && typeof body.agentId === 'string') {
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
        error: 'Internal server error',
        errors: [errorMessage],
        duration,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/swarm/execute
 * Get circuit breaker status for all agents
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const functionalAgents = ['MARKETING_MANAGER', 'COMPETITOR_RESEARCHER', 'TIKTOK_EXPERT'];

    const circuitBreakerStatus = functionalAgents.map(agentId => {
      const breaker = circuitBreakers.get(agentId);
      return {
        agentId,
        isOpen: breaker?.isOpen ?? false,
        failures: breaker?.failures ?? 0,
        lastFailure: breaker?.lastFailure ? new Date(breaker.lastFailure).toISOString() : null,
        cooldownRemaining: breaker?.isOpen
          ? Math.max(0, Math.ceil((CIRCUIT_BREAKER_RESET_MS - (Date.now() - (breaker.lastFailure || 0))) / 1000))
          : 0,
      };
    });

    return NextResponse.json({
      success: true,
      functionalAgents,
      circuitBreakers: circuitBreakerStatus,
      threshold: CIRCUIT_BREAKER_THRESHOLD,
      cooldownMs: CIRCUIT_BREAKER_RESET_MS,
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
