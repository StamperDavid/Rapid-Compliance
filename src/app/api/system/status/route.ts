/**
 * System Status API Route
 *
 * Returns REAL agent telemetry for the Workforce Command Center. Nothing here
 * is hardcoded — every status, health, and metric is computed from a real
 * Firestore-backed source:
 *
 * - Roster + hierarchy:        `AGENT_REGISTRY` (real inventory of 72 agents)
 * - Execution counts/timing:   `agentPerformance` collection via
 *                              `getAllAgentExecutionSummaries` (real)
 * - Pirate verification:       `agentVerifications` collection via
 *                              `getAllVerifications` (real)
 * - Seeded / version / model:  active Golden Masters via `listActiveSpecialistGMs`
 *                              + `listActiveManagerGMs` (real; null = not seeded)
 *
 * Status is computed honestly per agent KIND:
 *  - deterministic agents (no LLM) report a "Deterministic" kind and only go
 *    red on real recent execution failures;
 *  - dispatcher managers (no LLM generation) report a "Dispatcher" kind and
 *    derive health from real delegation activity / errors;
 *  - LLM agents report green only when seeded AND verified AND no recent
 *    failures; amber when untested/idle; red on real failures.
 *
 * @module api/system/status
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import {
  AGENT_REGISTRY,
  type AgentDefinition,
  type AgentTier,
} from '@/lib/agents/agent-registry';
import {
  getAllAgentExecutionSummaries,
  type AgentExecutionSummary,
} from '@/lib/agents/shared/specialist-metrics';
import { getAllVerifications } from '@/lib/agents/shared/verification-ledger';
import { listActiveSpecialistGMs } from '@/lib/training/specialist-golden-master-service';
import { listActiveManagerGMs } from '@/lib/training/manager-golden-master-service';
import type { AgentVerificationRecord } from '@/types/training';

export type { AgentTier } from '@/lib/agents/agent-registry';

export const dynamic = 'force-dynamic';

// ============================================================================
// CONFIG
// ============================================================================

/**
 * Default runtime industry key. Every specialist file uses this exact key
 * (`DEFAULT_INDUSTRY_KEY = 'saas_sales_ops'`) for its active GM lookup, so the
 * telemetry roster must scope GM seeding checks to the same key.
 */
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';

/** Metrics window in days. */
const METRICS_PERIOD_DAYS = 30;

/**
 * Deterministic (non-LLM) specialists. These do not call an LLM and therefore
 * have no pirate-verification expectation. They are only "unhealthy" if they
 * have real recent execution failures.
 */
const DETERMINISTIC_AGENT_IDS = new Set<string>([
  'CATALOG_MANAGER',
  'PAYMENT_SPECIALIST',
  'PRICING_STRATEGIST',
  'VOICE_AI_SPECIALIST',
]);

/**
 * LLM agents that are known to not be pirate-verifiable yet. They must never
 * show green-by-default — they sit at amber with an explicit reason.
 */
const NOT_YET_VERIFIABLE_LLM_IDS = new Set<string>([
  'ASSET_GENERATOR',
  'SHOT_PLAN_PLANNER',
  'SCHEDULING_SPECIALIST',
  'MASTER_ORCHESTRATOR',
]);

// ============================================================================
// TYPES
// ============================================================================

/** Honest classification driving status semantics. */
export type AgentKind = 'llm' | 'dispatcher' | 'deterministic';

/** Real green/amber/red health for an agent. */
export type AgentHealth = 'HEALTHY' | 'DEGRADED' | 'IDLE';

/**
 * Frontend-compatible agent status, computed entirely from real sources.
 */
export interface SystemAgentStatus {
  id: string;
  name: string;
  role: string;
  tier: AgentTier;
  parentId: string | null;
  kind: AgentKind;
  /** Real health: green (HEALTHY) / amber (IDLE) / red (DEGRADED). */
  health: AgentHealth;
  /** Plain-English reason for the current health (shown as a tooltip). */
  statusReason: string;
  capabilities: string[];
  /** Real failure-mode strings from recent executions (may be empty). */
  errors: string[];

  // --- Real telemetry fields ---
  /** Pirate verification passed on the last run. */
  verified: boolean;
  /** ISO timestamp of last verification run, or null if never verified. */
  verifiedAt: string | null;
  /** ISO timestamp of most recent execution, or null. */
  lastExecutionAt: string | null;
  /** Real count of executions in the period. */
  executions: number;
  /** Real success rate in [0,1], or null when there is no execution data. */
  successRate: number | null;
  /** Real mean response time (ms), or null when no data. */
  avgResponseTimeMs: number | null;
  /** Whether an active Golden Master is seeded for this agent. */
  gmSeeded: boolean;
  /** Active GM version, or null when not seeded. */
  gmVersion: number | null;
}

/**
 * System status response for the Workforce Command Center.
 */
export interface SystemStatusResponse {
  success: true;
  timestamp: string;
  /** Derived from the real per-agent health distribution. */
  overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  agents: SystemAgentStatus[];
  hierarchy: {
    orchestrator: SystemAgentStatus | null;
    managers: SystemAgentStatus[];
    specialists: SystemAgentStatus[];
    standalone: SystemAgentStatus[];
  };
  metrics: {
    /** Real total agent count (registry). */
    totalAgents: number;
    /** Number of LLM agents (the only ones with a verification expectation). */
    llmAgents: number;
    /** Real count of LLM agents whose last pirate verification passed. */
    verifiedAgents: number;
    /** Real count of agents with recent execution failures. */
    agentsWithErrors: number;
    /** Real sum of executions across all agents in the period. */
    totalExecutions: number;
    /** Real aggregate success rate in [0,1], or null when no executions. */
    overallSuccessRate: number | null;
    /** Window the metrics cover, in days. */
    periodDays: number;
    byTier: {
      L1: { total: number; healthy: number };
      L2: { total: number; healthy: number };
      L3: { total: number; healthy: number };
      STANDALONE: { total: number; healthy: number };
    };
  };
}

export interface SystemStatusError {
  success: false;
  error: string;
  timestamp: string;
}

// ============================================================================
// CLASSIFICATION
// ============================================================================

/**
 * Classify an agent into one of the three honest kinds. L2 managers are
 * dispatchers (no LLM generation of their own). Deterministic specialists are
 * explicitly listed. Everything else that reasons via an LLM is `llm`.
 */
function classifyAgent(agent: AgentDefinition): AgentKind {
  if (DETERMINISTIC_AGENT_IDS.has(agent.id)) { return 'deterministic'; }
  if (agent.tier === 'L2') { return 'dispatcher'; }
  return 'llm';
}

// ============================================================================
// PER-AGENT STATUS COMPUTATION
// ============================================================================

interface StatusInputs {
  execution: AgentExecutionSummary | undefined;
  verification: AgentVerificationRecord | undefined;
  gm: { version: number; model: string | null } | undefined;
}

interface ComputedStatus {
  health: AgentHealth;
  statusReason: string;
}

/**
 * Compute honest health + a plain-English reason for an agent, branching on its
 * kind. Real failures always win (red); otherwise greens require positive
 * real signals and everything else falls to amber/idle.
 */
function computeHealth(
  agent: AgentDefinition,
  kind: AgentKind,
  inputs: StatusInputs,
): ComputedStatus {
  const { execution, verification, gm } = inputs;
  const recentFailures = execution?.recentFailures ?? 0;

  // Real recent failures => red, for every kind.
  if (recentFailures > 0) {
    return {
      health: 'DEGRADED',
      statusReason: `${recentFailures} recent execution failure${recentFailures === 1 ? '' : 's'}`,
    };
  }

  if (kind === 'deterministic') {
    // No LLM, no pirate expectation. Green when it has run cleanly; otherwise
    // neutral idle — never red just for being idle.
    if (execution && execution.totalExecutions > 0) {
      return {
        health: 'HEALTHY',
        statusReason: `Deterministic — ${execution.totalExecutions} clean execution${execution.totalExecutions === 1 ? '' : 's'}`,
      };
    }
    return { health: 'IDLE', statusReason: 'Deterministic — no recent activity' };
  }

  if (kind === 'dispatcher') {
    // Health from real delegation activity. Failures already handled above.
    if (execution && execution.totalExecutions > 0) {
      return {
        health: 'HEALTHY',
        statusReason: `Dispatcher — ${execution.totalExecutions} delegation${execution.totalExecutions === 1 ? '' : 's'}, no errors`,
      };
    }
    return { health: 'IDLE', statusReason: 'Dispatcher — no recent delegations' };
  }

  // --- LLM agents ---

  // Known-not-yet-verifiable LLM agents never go green by default.
  if (NOT_YET_VERIFIABLE_LLM_IDS.has(agent.id)) {
    return { health: 'IDLE', statusReason: 'Not yet verified' };
  }

  // A failed verification with an error is a real red signal.
  if (verification?.status === 'fail' && verification.error) {
    return {
      health: 'DEGRADED',
      statusReason: `Verification failed: ${verification.error}`,
    };
  }

  if (!gm) {
    return { health: 'IDLE', statusReason: 'No active Golden Master seeded' };
  }

  if (!verification) {
    return { health: 'IDLE', statusReason: 'Seeded but never verified' };
  }

  if (verification.status === 'fail') {
    // Fail without an error => no-data fail, treated as untested, not degraded.
    return { health: 'IDLE', statusReason: 'Verification could not run (no data)' };
  }

  // Seeded + verification pass + no recent failures => green.
  const verifiedAgo = relativeTime(verification.runAt);
  return {
    health: 'HEALTHY',
    statusReason: `Verified ${verifiedAgo}`,
  };
}

/**
 * Compact relative-time string (e.g. "2d ago"). Falls back to the raw ISO
 * value if it cannot be parsed.
 */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) { return iso; }
  const deltaMs = Date.now() - then;
  if (deltaMs < 0) { return 'just now'; }
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) { return 'just now'; }
  if (minutes < 60) { return `${minutes}m ago`; }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) { return `${hours}h ago`; }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ============================================================================
// ASSEMBLY
// ============================================================================

interface DataSources {
  executions: Map<string, AgentExecutionSummary>;
  verifications: Record<string, AgentVerificationRecord>;
  specialistGMs: Map<string, { version: number; model: string | null }>;
  managerGMs: Map<string, { version: number; model: string | null }>;
}

function buildAgentStatus(
  agent: AgentDefinition,
  sources: DataSources,
): SystemAgentStatus {
  const kind = classifyAgent(agent);
  const execution = sources.executions.get(agent.id);
  const verification = sources.verifications[agent.id];
  const gm = agent.tier === 'L2'
    ? sources.managerGMs.get(agent.id)
    : sources.specialistGMs.get(agent.id);

  const { health, statusReason } = computeHealth(agent, kind, {
    execution,
    verification,
    gm,
  });

  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    tier: agent.tier,
    parentId: agent.parentId,
    kind,
    health,
    statusReason,
    capabilities: agent.capabilities,
    errors: execution?.commonFailureModes.map((f) => f.mode) ?? [],
    verified: verification?.status === 'pass',
    verifiedAt: verification?.runAt ?? null,
    lastExecutionAt: execution?.lastExecutionAt ?? null,
    executions: execution?.totalExecutions ?? 0,
    successRate: execution?.successRate ?? null,
    avgResponseTimeMs: execution?.avgResponseTimeMs ?? null,
    gmSeeded: gm !== undefined,
    gmVersion: gm?.version ?? null,
  };
}

/**
 * Build the full real status response from the registry + the batched sources.
 */
function buildResponse(sources: DataSources): SystemStatusResponse {
  const allAgents: SystemAgentStatus[] = AGENT_REGISTRY.map((agent) =>
    buildAgentStatus(agent, sources),
  );

  const orchestrator = allAgents.find((a) => a.tier === 'L1') ?? null;
  const managers = allAgents.filter((a) => a.tier === 'L2');
  const specialists = allAgents.filter((a) => a.tier === 'L3');
  const standalone = allAgents.filter((a) => a.tier === 'STANDALONE');

  const llmAgents = allAgents.filter((a) => a.kind === 'llm');
  const verifiedAgents = llmAgents.filter((a) => a.verified).length;
  const agentsWithErrors = allAgents.filter((a) => a.health === 'DEGRADED').length;

  // Real aggregate success: sum approved / sum total across agents that ran.
  let totalExecutions = 0;
  let totalApproved = 0;
  for (const agent of allAgents) {
    if (agent.successRate === null) { continue; }
    totalExecutions += agent.executions;
    totalApproved += Math.round(agent.successRate * agent.executions);
  }
  const overallSuccessRate = totalExecutions > 0
    ? totalApproved / totalExecutions
    : null;

  const healthyCount = (list: SystemAgentStatus[]) =>
    list.filter((a) => a.health === 'HEALTHY').length;

  // Overall health from the real distribution.
  let overallHealth: SystemStatusResponse['overallHealth'] = 'HEALTHY';
  if (agentsWithErrors > 0) {
    overallHealth = agentsWithErrors >= 5 ? 'CRITICAL' : 'DEGRADED';
  }

  return {
    success: true,
    timestamp: new Date().toISOString(),
    overallHealth,
    agents: allAgents,
    hierarchy: { orchestrator, managers, specialists, standalone },
    metrics: {
      totalAgents: allAgents.length,
      llmAgents: llmAgents.length,
      verifiedAgents,
      agentsWithErrors,
      totalExecutions,
      overallSuccessRate,
      periodDays: METRICS_PERIOD_DAYS,
      byTier: {
        L1: {
          total: allAgents.filter((a) => a.tier === 'L1').length,
          healthy: healthyCount(allAgents.filter((a) => a.tier === 'L1')),
        },
        L2: { total: managers.length, healthy: healthyCount(managers) },
        L3: { total: specialists.length, healthy: healthyCount(specialists) },
        STANDALONE: { total: standalone.length, healthy: healthyCount(standalone) },
      },
    },
  };
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * GET /api/system/status
 *
 * Returns REAL system status. Requires admin authentication.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<SystemStatusResponse | SystemStatusError>> {
  const startTime = Date.now();

  try {
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error,
          timestamp: new Date().toISOString(),
        },
        { status: authResult.status },
      );
    }

    logger.info('[SystemStatus] Computing real agent telemetry', {
      PLATFORM_ID,
      adminId: authResult.user.uid,
      file: 'api/system/status/route.ts',
    });

    // Batch every real source: 3 collection reads total, not 72 round trips.
    const [executions, verifications, specialistGMs, managerGMList] =
      await Promise.all([
        getAllAgentExecutionSummaries(METRICS_PERIOD_DAYS),
        getAllVerifications(),
        listActiveSpecialistGMs(DEFAULT_INDUSTRY_KEY),
        listActiveManagerGMs(),
      ]);

    const managerGMs = new Map<string, { version: number; model: string | null }>();
    for (const gm of managerGMList) {
      const modelRaw = gm.config?.model;
      managerGMs.set(gm.managerId, {
        version: gm.version,
        model: typeof modelRaw === 'string' ? modelRaw : null,
      });
    }

    const specialistGMSummaries = new Map<string, { version: number; model: string | null }>();
    for (const [id, summary] of specialistGMs) {
      specialistGMSummaries.set(id, { version: summary.version, model: summary.model });
    }

    const response = buildResponse({
      executions,
      verifications,
      specialistGMs: specialistGMSummaries,
      managerGMs,
    });

    const duration = Date.now() - startTime;
    logger.info('[SystemStatus] Real status computed', {
      PLATFORM_ID,
      overallHealth: response.overallHealth,
      totalAgents: response.metrics.totalAgents,
      verifiedAgents: response.metrics.verifiedAgents,
      totalExecutions: response.metrics.totalExecutions,
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
      '[SystemStatus] Failed to compute system status',
      error instanceof Error ? error : new Error(errorMessage),
      { duration, file: 'api/system/status/route.ts' },
    );

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
