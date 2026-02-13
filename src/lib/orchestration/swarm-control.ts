/**
 * Swarm Control — Global Kill Switch & Per-Agent Controls
 *
 * Provides platform-wide control over the AI agent swarm:
 * - Global pause/resume (freezes ALL agent execution)
 * - Per-manager pause (freeze individual managers)
 * - Per-agent pause (freeze individual specialists)
 *
 * State is persisted in Firestore at:
 *   organizations/{orgId}/settings/swarm_control
 *
 * All orchestration entry points (EventRouter, MasterOrchestrator,
 * SignalBus, BaseManager) check swarm control state before executing.
 *
 * @module orchestration/swarm-control
 */

import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Swarm control state persisted in Firestore
 */
export interface SwarmControlState {
  /** Global pause — freezes ALL agent activity when true */
  globalPause: boolean;
  /** Timestamp when global pause was activated */
  globalPauseAt?: string;
  /** Who activated the global pause */
  globalPauseBy?: string;
  /** Individually paused manager IDs */
  pausedManagers: string[];
  /** Individually paused agent/specialist IDs */
  pausedAgents: string[];
  /** Last updated timestamp */
  updatedAt: string;
  /** Last updated by */
  updatedBy: string;
}

/**
 * Default state when no Firestore document exists
 */
const DEFAULT_STATE: SwarmControlState = {
  globalPause: false,
  pausedManagers: [],
  pausedAgents: [],
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

// ============================================================================
// IN-MEMORY CACHE (with TTL)
// ============================================================================

/** Cache container to avoid race condition lint warnings on module-level variables */
const cache: { state: SwarmControlState | null; timestamp: number } = {
  state: null,
  timestamp: 0,
};
const CACHE_TTL_MS = 5_000; // 5 seconds — balance between freshness and Firestore reads

/**
 * Update the cache with fresh state
 */
function updateCache(state: SwarmControlState): void {
  cache.state = state;
  cache.timestamp = Date.now();
}

/**
 * Invalidate the in-memory cache (called after writes)
 */
function invalidateCache(): void {
  cache.state = null;
  cache.timestamp = 0;
}

// ============================================================================
// FIRESTORE PATH
// ============================================================================

function swarmControlDocPath(): string {
  return `organizations/${PLATFORM_ID}/settings/swarm_control`;
}

// ============================================================================
// CORE API
// ============================================================================

/**
 * Get the current swarm control state.
 * Uses a short-lived in-memory cache to avoid hammering Firestore
 * on every signal/event dispatch.
 */
export async function getSwarmControlState(): Promise<SwarmControlState> {
  // Return cached state if fresh
  if (cache.state && (Date.now() - cache.timestamp) < CACHE_TTL_MS) {
    return cache.state;
  }

  if (!adminDb) {
    logger.warn('[SwarmControl] Firestore not available — returning default state');
    return DEFAULT_STATE;
  }

  try {
    const docRef = adminDb.doc(swarmControlDocPath());
    const doc = await docRef.get();

    if (!doc.exists) {
      // Initialize default state in Firestore
      await docRef.set(DEFAULT_STATE);
      updateCache(DEFAULT_STATE);
      return DEFAULT_STATE;
    }

    const state = doc.data() as SwarmControlState;
    updateCache(state);
    return state;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[SwarmControl] Failed to read state', error instanceof Error ? error : undefined, {
      error: errorMsg,
    });
    // On error, return cached state if available, otherwise default
    return cache.state ?? DEFAULT_STATE;
  }
}

/**
 * Pause the entire swarm (global kill switch)
 */
export async function pauseSwarm(pausedBy: string = 'user'): Promise<SwarmControlState> {
  const state = await getSwarmControlState();
  const updated: SwarmControlState = {
    ...state,
    globalPause: true,
    globalPauseAt: new Date().toISOString(),
    globalPauseBy: pausedBy,
    updatedAt: new Date().toISOString(),
    updatedBy: pausedBy,
  };

  await persistState(updated);
  logger.info('[SwarmControl] GLOBAL PAUSE ACTIVATED', { pausedBy });
  return updated;
}

/**
 * Resume the entire swarm
 */
export async function resumeSwarm(resumedBy: string = 'user'): Promise<SwarmControlState> {
  const state = await getSwarmControlState();
  const updated: SwarmControlState = {
    ...state,
    globalPause: false,
    globalPauseAt: undefined,
    globalPauseBy: undefined,
    updatedAt: new Date().toISOString(),
    updatedBy: resumedBy,
  };

  await persistState(updated);
  logger.info('[SwarmControl] GLOBAL PAUSE RELEASED', { resumedBy });
  return updated;
}

/**
 * Pause a specific manager
 */
export async function pauseManager(
  managerId: string,
  pausedBy: string = 'user'
): Promise<SwarmControlState> {
  const state = await getSwarmControlState();
  const pausedManagers = new Set(state.pausedManagers);
  pausedManagers.add(managerId);

  const updated: SwarmControlState = {
    ...state,
    pausedManagers: Array.from(pausedManagers),
    updatedAt: new Date().toISOString(),
    updatedBy: pausedBy,
  };

  await persistState(updated);
  logger.info('[SwarmControl] Manager paused', { managerId, pausedBy });
  return updated;
}

/**
 * Resume a specific manager
 */
export async function resumeManager(
  managerId: string,
  resumedBy: string = 'user'
): Promise<SwarmControlState> {
  const state = await getSwarmControlState();
  const pausedManagers = new Set(state.pausedManagers);
  pausedManagers.delete(managerId);

  const updated: SwarmControlState = {
    ...state,
    pausedManagers: Array.from(pausedManagers),
    updatedAt: new Date().toISOString(),
    updatedBy: resumedBy,
  };

  await persistState(updated);
  logger.info('[SwarmControl] Manager resumed', { managerId, resumedBy });
  return updated;
}

/**
 * Pause a specific agent/specialist
 */
export async function pauseAgent(
  agentId: string,
  pausedBy: string = 'user'
): Promise<SwarmControlState> {
  const state = await getSwarmControlState();
  const pausedAgents = new Set(state.pausedAgents);
  pausedAgents.add(agentId);

  const updated: SwarmControlState = {
    ...state,
    pausedAgents: Array.from(pausedAgents),
    updatedAt: new Date().toISOString(),
    updatedBy: pausedBy,
  };

  await persistState(updated);
  logger.info('[SwarmControl] Agent paused', { agentId, pausedBy });
  return updated;
}

/**
 * Resume a specific agent/specialist
 */
export async function resumeAgent(
  agentId: string,
  resumedBy: string = 'user'
): Promise<SwarmControlState> {
  const state = await getSwarmControlState();
  const pausedAgents = new Set(state.pausedAgents);
  pausedAgents.delete(agentId);

  const updated: SwarmControlState = {
    ...state,
    pausedAgents: Array.from(pausedAgents),
    updatedAt: new Date().toISOString(),
    updatedBy: resumedBy,
  };

  await persistState(updated);
  logger.info('[SwarmControl] Agent resumed', { agentId, resumedBy });
  return updated;
}

// ============================================================================
// GUARD FUNCTIONS — Used by orchestration components
// ============================================================================

/**
 * Check if the swarm is globally paused.
 * Used by EventRouter, MasterOrchestrator, and SignalBus before dispatching.
 */
export async function isSwarmPaused(): Promise<boolean> {
  const state = await getSwarmControlState();
  return state.globalPause;
}

/**
 * Check if a specific manager is paused (either globally or individually).
 * Used by BaseManager.execute() before processing.
 */
export async function isManagerPaused(managerId: string): Promise<boolean> {
  const state = await getSwarmControlState();
  if (state.globalPause) { return true; }
  return state.pausedManagers.includes(managerId);
}

/**
 * Check if a specific agent is paused (globally, by manager, or individually).
 */
export async function isAgentPaused(agentId: string, managerId?: string): Promise<boolean> {
  const state = await getSwarmControlState();
  if (state.globalPause) { return true; }
  if (managerId && state.pausedManagers.includes(managerId)) { return true; }
  return state.pausedAgents.includes(agentId);
}

// ============================================================================
// INTERNAL
// ============================================================================

/**
 * Persist state to Firestore and invalidate cache
 */
async function persistState(state: SwarmControlState): Promise<void> {
  if (!adminDb) {
    logger.warn('[SwarmControl] Firestore not available — state not persisted');
    // Still update local cache so in-process checks work
    updateCache(state);
    return;
  }

  try {
    const docRef = adminDb.doc(swarmControlDocPath());
    await docRef.set(state);
    invalidateCache();
    // Update cache with the written state
    updateCache(state);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[SwarmControl] Failed to persist state', error instanceof Error ? error : undefined, {
      error: errorMsg,
    });
  }
}
