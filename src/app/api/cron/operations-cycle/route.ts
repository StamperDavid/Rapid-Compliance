/**
 * Company Operations Cycle Cron Endpoint
 *
 * Runs the business autonomously between human interactions.
 * This is the nervous system of SalesVelocity.ai — the platform runs itself.
 *
 * THREE CYCLES:
 * - OPERATIONAL (every 4 hours): Intelligence, Revenue, Marketing, Outreach, Reputation
 * - STRATEGIC (every 24 hours): Manager KPI reports, cross-department signals
 * - EXECUTIVE (weekly): Orchestrator aggregates all reports, generates executive briefing
 *
 * Authentication: Bearer token via CRON_SECRET
 *
 * GET /api/cron/operations-cycle?cycle=operational|strategic|executive
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { getSignalBus } from '@/lib/orchestrator/signal-bus';
import { AGENT_IDS } from '@/lib/agents';
import { getMemoryVault } from '@/lib/agents/shared/memory-vault';
import type { AgentMessage } from '@/lib/agents/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for full cycle execution

// ============================================================================
// TYPES
// ============================================================================

interface CycleStep {
  id: string;
  name: string;
  targetAgent: string;
  command: string;
  priority: AgentMessage['priority'];
}

interface StepResult {
  id: string;
  name: string;
  targetAgent: string;
  status: 'success' | 'failed';
  durationMs?: number;
  error?: string;
}

interface CycleResponse {
  success: boolean;
  cycle: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  steps: StepResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
  crossDepartmentSignals?: number;
}

type CycleType = 'operational' | 'strategic' | 'executive';

// ============================================================================
// CYCLE DEFINITIONS
// ============================================================================

const OPERATIONAL_CYCLE: CycleStep[] = [
  {
    id: 'op-1',
    name: 'Intelligence: Check Market Signals',
    targetAgent: AGENT_IDS.INTELLIGENCE_MANAGER,
    command: 'SCAN_MARKET',
    priority: 'NORMAL',
  },
  {
    id: 'op-2',
    name: 'Revenue: Progress Pipeline',
    targetAgent: AGENT_IDS.REVENUE_DIRECTOR,
    command: 'PROGRESS_PIPELINE',
    priority: 'HIGH',
  },
  {
    id: 'op-3',
    name: 'Marketing: Check Growth Metrics',
    targetAgent: AGENT_IDS.MARKETING_MANAGER,
    command: 'CHECK_GROWTH_METRICS',
    priority: 'NORMAL',
  },
  {
    id: 'op-4',
    name: 'Outreach: Process Pending Replies',
    targetAgent: AGENT_IDS.OUTREACH_MANAGER,
    command: 'PROCESS_REPLIES',
    priority: 'NORMAL',
  },
  {
    id: 'op-5',
    name: 'Reputation: Check New Reviews',
    targetAgent: AGENT_IDS.REPUTATION_MANAGER,
    command: 'CHECK_REVIEWS',
    priority: 'NORMAL',
  },
];

const STRATEGIC_CYCLE: CycleStep[] = [
  {
    id: 'strat-1',
    name: 'Marketing Manager: Full KPI Report via Growth Analyst',
    targetAgent: AGENT_IDS.MARKETING_MANAGER,
    command: 'GENERATE_KPI_REPORT',
    priority: 'HIGH',
  },
  {
    id: 'strat-2',
    name: 'Revenue Director: Pipeline Health Analysis',
    targetAgent: AGENT_IDS.REVENUE_DIRECTOR,
    command: 'ANALYZE_PIPELINE_HEALTH',
    priority: 'HIGH',
  },
  {
    id: 'strat-3',
    name: 'Marketing Manager: Content Performance Review',
    targetAgent: AGENT_IDS.MARKETING_MANAGER,
    command: 'REVIEW_CONTENT_PERFORMANCE',
    priority: 'HIGH',
  },
  {
    id: 'strat-4',
    name: 'Intelligence Manager: Market Shift Briefing',
    targetAgent: AGENT_IDS.INTELLIGENCE_MANAGER,
    command: 'MARKET_SHIFT_BRIEFING',
    priority: 'HIGH',
  },
  {
    id: 'strat-5',
    name: 'Architect Manager: UX/Funnel Optimization Review',
    targetAgent: AGENT_IDS.ARCHITECT_MANAGER,
    command: 'OPTIMIZATION_REVIEW',
    priority: 'NORMAL',
  },
  {
    id: 'strat-6',
    name: 'Builder Manager: Asset Performance Review',
    targetAgent: AGENT_IDS.BUILDER_MANAGER,
    command: 'ASSET_REVIEW',
    priority: 'NORMAL',
  },
  {
    id: 'strat-7',
    name: 'Commerce Manager: Pricing & Inventory Review',
    targetAgent: AGENT_IDS.COMMERCE_MANAGER,
    command: 'COMMERCE_REVIEW',
    priority: 'NORMAL',
  },
  {
    id: 'strat-8',
    name: 'Outreach Manager: Sequence Performance Review',
    targetAgent: AGENT_IDS.OUTREACH_MANAGER,
    command: 'SEQUENCE_REVIEW',
    priority: 'NORMAL',
  },
  {
    id: 'strat-9',
    name: 'Content Manager: Content Calendar Review',
    targetAgent: AGENT_IDS.CONTENT_MANAGER,
    command: 'CALENDAR_REVIEW',
    priority: 'NORMAL',
  },
];

const EXECUTIVE_CYCLE: CycleStep[] = [
  {
    id: 'exec-1',
    name: 'Orchestrator: Aggregate Department Reports',
    targetAgent: AGENT_IDS.MASTER_ORCHESTRATOR,
    command: 'AGGREGATE_REPORTS',
    priority: 'CRITICAL',
  },
  {
    id: 'exec-2',
    name: 'Orchestrator: Compare Against Quarterly Objectives',
    targetAgent: AGENT_IDS.MASTER_ORCHESTRATOR,
    command: 'COMPARE_OBJECTIVES',
    priority: 'CRITICAL',
  },
  {
    id: 'exec-3',
    name: 'Orchestrator: Generate Executive Briefing',
    targetAgent: AGENT_IDS.MASTER_ORCHESTRATOR,
    command: 'GENERATE_EXECUTIVE_BRIEFING',
    priority: 'CRITICAL',
  },
  {
    id: 'exec-4',
    name: 'Orchestrator: Identify Underperforming Departments',
    targetAgent: AGENT_IDS.MASTER_ORCHESTRATOR,
    command: 'IDENTIFY_UNDERPERFORMERS',
    priority: 'HIGH',
  },
];

// ============================================================================
// CYCLE EXECUTION
// ============================================================================

/**
 * Execute a single cycle step
 */
async function executeStep(step: CycleStep): Promise<StepResult> {
  const startTime = Date.now();
  const signalBus = getSignalBus();

  try {
    // Create an AgentMessage for this command
    const message: AgentMessage = {
      id: `msg_${step.id}_${Date.now()}`,
      timestamp: new Date(),
      from: 'OPERATIONS_CYCLE_CRON',
      to: step.targetAgent,
      type: 'COMMAND',
      priority: step.priority,
      payload: {
        command: step.command,
        context: {
          cycleType: 'autonomous',
          triggeredBy: 'cron',
        },
      },
      requiresResponse: true,
      traceId: `trace_${step.id}_${Date.now()}`,
    };

    // Create and send a DIRECT signal
    const signal = signalBus.createSignal(
      'DIRECT',
      'OPERATIONS_CYCLE_CRON',
      step.targetAgent,
      message
    );

    const reports = await signalBus.send(signal);

    const durationMs = Date.now() - startTime;

    // Check if the signal succeeded
    const allSucceeded = reports.every(r => r.status === 'COMPLETED');

    if (allSucceeded) {
      return {
        id: step.id,
        name: step.name,
        targetAgent: step.targetAgent,
        status: 'success',
        durationMs,
      };
    } else {
      const errors = reports.flatMap(r => r.errors ?? []);
      return {
        id: step.id,
        name: step.name,
        targetAgent: step.targetAgent,
        status: 'failed',
        durationMs,
        error: errors.join('; ') || 'Unknown error',
      };
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Step ${step.id} failed`, error instanceof Error ? error : new Error(errorMsg), {
      stepId: step.id,
      targetAgent: step.targetAgent,
    });

    return {
      id: step.id,
      name: step.name,
      targetAgent: step.targetAgent,
      status: 'failed',
      durationMs,
      error: errorMsg,
    };
  }
}

/**
 * Execute a complete cycle
 */
async function executeCycle(cycleType: CycleType): Promise<{
  steps: StepResult[];
  crossDepartmentSignals?: number;
}> {
  let cycleSteps: CycleStep[] = [];

  switch (cycleType) {
    case 'operational':
      cycleSteps = OPERATIONAL_CYCLE;
      break;
    case 'strategic':
      cycleSteps = STRATEGIC_CYCLE;
      break;
    case 'executive':
      cycleSteps = EXECUTIVE_CYCLE;
      break;
  }

  const results: StepResult[] = [];

  // Run MemoryVault TTL cleanup during operational cycles (every 4h)
  if (cycleType === 'operational') {
    try {
      const vault = getMemoryVault();
      const cleaned = await vault.cleanExpired();
      if (cleaned > 0) {
        logger.info('[MemoryVault] TTL cleanup', { cleaned, cycleType });
      }
    } catch (error) {
      logger.error('[MemoryVault] TTL cleanup failed',
        error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Execute each step sequentially
  for (const step of cycleSteps) {
    const result = await executeStep(step);
    results.push(result);

    // If a critical step fails, log but continue
    if (result.status === 'failed' && step.priority === 'CRITICAL') {
      const errorMsg = result.error ?? 'Unknown error';
      logger.error(`CRITICAL step failed: ${step.name}`, new Error(errorMsg), {
        stepId: step.id,
        cycleType,
      });
    }
  }

  // For strategic cycle, also check cross-department signals
  let crossDepartmentSignals = 0;
  if (cycleType === 'strategic') {
    try {
      const memoryVault = getMemoryVault();
      const signalResults = await memoryVault.query('OPERATIONS_CYCLE_CRON', {
        category: 'SIGNAL',
      });
      crossDepartmentSignals = signalResults.length;

      if (signalResults.length > 0) {
        logger.info('Cross-department signals detected', {
          count: signalResults.length,
          cycleType,
        });
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to check cross-department signals', errorObj, {
        cycleType,
      });
    }
  }

  return {
    steps: results,
    crossDepartmentSignals,
  };
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

/**
 * GET /api/cron/operations-cycle
 * Run the company operations cycle
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        logger.error('Unauthorized cron access attempt', new Error('Invalid cron secret'), {
          route: '/api/cron/operations-cycle',
          method: 'GET',
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Get cycle type from query params (default to operational)
    const { searchParams } = new URL(request.url);
    const cycleParam = searchParams.get('cycle') ?? 'operational';
    const cycleType = ['operational', 'strategic', 'executive'].includes(cycleParam)
      ? (cycleParam as CycleType)
      : 'operational';

    logger.info('Starting operations cycle', {
      route: '/api/cron/operations-cycle',
      method: 'GET',
      cycleType,
    });

    const startedAt = new Date();
    const startTime = Date.now();

    // Execute the cycle
    const { steps, crossDepartmentSignals } = await executeCycle(cycleType);

    const completedAt = new Date();
    const durationMs = Date.now() - startTime;

    // Calculate summary
    const summary = {
      total: steps.length,
      succeeded: steps.filter(s => s.status === 'success').length,
      failed: steps.filter(s => s.status === 'failed').length,
    };

    logger.info(`Operations cycle completed: ${summary.succeeded}/${summary.total} steps succeeded`, {
      cycleType,
      durationMs,
    });

    const response: CycleResponse = {
      success: summary.failed === 0,
      cycle: cycleType,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      steps,
      summary,
      crossDepartmentSignals,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error('Operations cycle error', errorObj, {
      route: '/api/cron/operations-cycle',
      method: 'GET',
    });

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
