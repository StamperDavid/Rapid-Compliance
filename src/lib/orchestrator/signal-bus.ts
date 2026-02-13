// STATUS: PENTHOUSE MODE - SalesVelocity.ai Penthouse Model
// Flat global registry - no org isolation, no multi-org routing

import type {
  Signal,
  SignalHandler,
  AgentMessage,
  AgentReport,
} from '../agents/types';
import { logger } from '@/lib/logger/logger';
import { isSwarmPaused } from '@/lib/orchestration/swarm-control';

type SignalListener = (signal: Signal) => void;

// ============================================================================
// REGISTRY TYPES
// ============================================================================

/**
 * Signal history entry for telemetry and audit
 */
export interface SignalHistoryEntry {
  signal: Signal;
  processedAt: Date;
  targetAgentId: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  durationMs?: number;
  errorMessage?: string;
}

/**
 * Options for getHistory queries
 */
export interface SignalHistoryOptions {
  agentId?: string;           // Filter by agent ID
  limit?: number;             // Max entries to return (default: 100)
  offset?: number;            // Skip entries for pagination
  since?: Date;               // Only entries after this time
  until?: Date;               // Only entries before this time
  status?: SignalHistoryEntry['status']; // Filter by status
  signalType?: Signal['type']; // Filter by signal type
}

/**
 * Global registry - single flat container for all signal infrastructure
 */
interface Registry {
  handlers: Map<string, SignalHandler>;           // agentId -> handler
  listeners: Map<string, Set<SignalListener>>;    // agentId -> listeners
  hierarchy: Map<string, string>;                 // child -> parent
  children: Map<string, Set<string>>;             // parent -> children
  processedSignals: Set<string>;                  // deduplication cache
  pendingSignals: Signal[];                       // queue for async processing
  signalHistory: SignalHistoryEntry[];            // telemetry/audit log
}

// ============================================================================
// SIGNALBUS - PENTHOUSE FLAT BUS (SalesVelocity.ai)
// ============================================================================

/**
 * SignalBus - The nervous system of the Agent Swarm
 *
 * Single global registry. Agents subscribe and publish to one flat bus.
 *
 * Supports four signal types:
 * - BROADCAST: Send to all agents
 * - DIRECT: Send to specific agent
 * - BUBBLE_UP: Specialist -> Manager -> Jasper
 * - BUBBLE_DOWN: Jasper -> Manager -> Specialist
 */
export class SignalBus {
  private registry: Registry;

  private metrics = {
    totalSignalsSent: 0,
    totalSignalsFailed: 0,
  };

  private static readonly JASPER = 'JASPER';

  constructor() {
    this.registry = this.createRegistry();
    logger.info('[SignalBus] Initialized (penthouse flat bus)');
  }

  private createRegistry(): Registry {
    const registry: Registry = {
      handlers: new Map(),
      listeners: new Map(),
      hierarchy: new Map(),
      children: new Map(),
      processedSignals: new Set(),
      pendingSignals: [],
      signalHistory: [],
    };
    registry.children.set(SignalBus.JASPER, new Set());
    return registry;
  }

  // ==========================================================================
  // AGENT REGISTRATION
  // ==========================================================================

  /**
   * Register an agent in the hierarchy
   * @param agentId - The agent being registered
   * @param parentId - Parent agent (null = reports to Jasper)
   * @param handler - Signal handler for this agent
   */
  registerAgent(
    agentId: string,
    parentId: string | null,
    handler: SignalHandler
  ): void {
    this.registry.handlers.set(agentId, handler);

    if (parentId) {
      this.registry.hierarchy.set(agentId, parentId);
      if (!this.registry.children.has(parentId)) {
        this.registry.children.set(parentId, new Set());
      }
      this.registry.children.get(parentId)?.add(agentId);
    } else {
      this.registry.hierarchy.set(agentId, SignalBus.JASPER);
      this.registry.children.get(SignalBus.JASPER)?.add(agentId);
    }

    logger.debug('[SignalBus] Agent registered', {
      agentId,
      parentId: parentId ?? 'JASPER',
    });
  }

  /**
   * Unregister an agent from the hierarchy
   */
  unregisterAgent(agentId: string): void {
    const parent = this.registry.hierarchy.get(agentId);
    if (parent) {
      this.registry.children.get(parent)?.delete(agentId);
    }
    this.registry.hierarchy.delete(agentId);
    this.registry.handlers.delete(agentId);
    this.registry.listeners.delete(agentId);

    logger.debug('[SignalBus] Agent unregistered', { agentId });
  }

  // ==========================================================================
  // SUBSCRIPTION
  // ==========================================================================

  /**
   * Subscribe to signals for a specific agent
   * @param agentId - The agent to subscribe for
   * @param listener - Callback function for signals
   * @returns Unsubscribe function
   */
  subscribe(
    agentId: string,
    listener: SignalListener
  ): () => void {
    if (!this.registry.listeners.has(agentId)) {
      this.registry.listeners.set(agentId, new Set());
    }
    this.registry.listeners.get(agentId)?.add(listener);

    logger.debug('[SignalBus] Listener subscribed', { agentId });

    return () => {
      this.registry.listeners.get(agentId)?.delete(listener);
      logger.debug('[SignalBus] Listener unsubscribed', { agentId });
    };
  }

  // ==========================================================================
  // SIGNAL SENDING
  // ==========================================================================

  /**
   * Send a signal through the bus.
   * Now includes swarm control guard — when paused, signals are queued
   * rather than dropped, and will be processed when the swarm resumes.
   *
   * @param signal - The signal to send
   * @returns Reports from handlers
   */
  async send(signal: Signal): Promise<AgentReport[]> {
    // Deduplication check
    if (this.registry.processedSignals.has(signal.id)) {
      logger.warn(`[SignalBus] Duplicate signal ignored: ${signal.id}`, {
        requestId: signal.id,
      });
      return [];
    }

    // Swarm control guard — queue signals when paused (don't drop them)
    const paused = await isSwarmPaused();
    if (paused) {
      logger.warn('[SignalBus] Swarm paused — signal queued for later', {
        signalId: signal.id,
        type: signal.type,
        target: signal.target,
      });
      this.registry.pendingSignals.push(signal);
      return [{
        agentId: 'SIGNAL_BUS',
        timestamp: new Date(),
        taskId: signal.id,
        status: 'BLOCKED',
        data: { reason: 'SWARM_PAUSED', queued: true },
        errors: ['Swarm is globally paused — signal queued'],
      }];
    }

    // Max hops check
    if (signal.hops.length >= signal.maxHops) {
      logger.error(`[SignalBus] Signal exceeded max hops: ${signal.id}`, undefined, {
        requestId: signal.id,
      });
      return [{
        agentId: 'SIGNAL_BUS',
        timestamp: new Date(),
        taskId: signal.id,
        status: 'FAILED',
        data: null,
        errors: ['Signal exceeded maximum hop count'],
      }];
    }

    this.registry.processedSignals.add(signal.id);
    this.metrics.totalSignalsSent++;

    switch (signal.type) {
      case 'BROADCAST':
        return this.handleBroadcast(signal);
      case 'DIRECT':
        return this.handleDirect(signal);
      case 'BUBBLE_UP':
        return this.handleBubbleUp(signal);
      case 'BUBBLE_DOWN':
        return this.handleBubbleDown(signal);
      default:
        return [{
          agentId: 'SIGNAL_BUS',
          timestamp: new Date(),
          taskId: signal.id,
          status: 'FAILED',
          data: null,
          errors: [`Unknown signal type: ${signal.type}`],
        }];
    }
  }

  /**
   * Drain queued signals that were held during a pause.
   * Called when the swarm resumes to process pending work.
   */
  async drainPausedSignals(): Promise<{
    processed: number;
    failed: number;
    reports: AgentReport[];
  }> {
    const pending = [...this.registry.pendingSignals];
    this.registry.pendingSignals = [];

    if (pending.length === 0) { return { processed: 0, failed: 0, reports: [] }; }

    logger.info('[SignalBus] Draining queued signals after resume', {
      count: pending.length,
    });

    const allReports: AgentReport[] = [];
    let processed = 0;
    let failed = 0;

    for (const signal of pending) {
      try {
        const reports = await this.send(signal);
        allReports.push(...reports);
        const hasFailure = reports.some(r => r.status === 'FAILED');
        if (hasFailure) { failed++; } else { processed++; }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('[SignalBus] Failed to drain signal', error instanceof Error ? error : undefined, {
          signalId: signal.id,
          error: errorMsg,
        });
        failed++;
      }
    }

    logger.info('[SignalBus] Signal drain complete', { processed, failed });

    return { processed, failed, reports: allReports };
  }

  /**
   * BROADCAST - Send to all registered agents
   */
  private async handleBroadcast(signal: Signal): Promise<AgentReport[]> {
    const reports: AgentReport[] = [];

    for (const [agentId, handler] of this.registry.handlers) {
      if (handler.canHandle(signal)) {
        signal.hops.push(agentId);
        const startTime = Date.now();
        try {
          const report = await handler.handle(signal);
          const durationMs = Date.now() - startTime;
          reports.push(report);
          this.notifyListeners(agentId, signal);
          this.recordSignalHistory(
            signal,
            agentId,
            report.status === 'COMPLETED' ? 'SUCCESS' : 'FAILED',
            durationMs,
            report.errors?.join('; ')
          );
        } catch (error) {
          const durationMs = Date.now() - startTime;
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`[SignalBus] Handler error for ${agentId}`, error instanceof Error ? error : undefined, {
            error: errorMsg,
          });
          reports.push({
            agentId,
            timestamp: new Date(),
            taskId: signal.id,
            status: 'FAILED',
            data: null,
            errors: [errorMsg],
          });
          this.recordSignalHistory(signal, agentId, 'FAILED', durationMs, errorMsg);
        }
      }
    }

    return reports;
  }

  /**
   * DIRECT - Send to specific agent
   */
  private async handleDirect(signal: Signal): Promise<AgentReport[]> {
    const handler = this.registry.handlers.get(signal.target);

    if (!handler) {
      this.recordSignalHistory(signal, signal.target, 'FAILED', 0, 'Agent not found');
      return [{
        agentId: 'SIGNAL_BUS',
        timestamp: new Date(),
        taskId: signal.id,
        status: 'FAILED',
        data: null,
        errors: [`Agent not found: ${signal.target}`],
      }];
    }

    signal.hops.push(signal.target);
    this.notifyListeners(signal.target, signal);

    const startTime = Date.now();
    try {
      const report = await handler.handle(signal);
      const durationMs = Date.now() - startTime;
      this.recordSignalHistory(
        signal,
        signal.target,
        report.status === 'COMPLETED' ? 'SUCCESS' : 'FAILED',
        durationMs,
        report.errors?.join('; ')
      );
      return [report];
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.recordSignalHistory(signal, signal.target, 'FAILED', durationMs, errorMsg);
      return [{
        agentId: signal.target,
        timestamp: new Date(),
        taskId: signal.id,
        status: 'FAILED',
        data: null,
        errors: [errorMsg],
      }];
    }
  }

  /**
   * BUBBLE_UP - Specialist -> Manager -> Jasper
   */
  private async handleBubbleUp(signal: Signal): Promise<AgentReport[]> {
    const reports: AgentReport[] = [];
    let currentAgent = signal.origin;

    while (currentAgent && currentAgent !== SignalBus.JASPER) {
      const parent = this.registry.hierarchy.get(currentAgent);
      if (!parent) { break; }

      const handler = this.registry.handlers.get(parent);
      if (handler?.canHandle(signal)) {
        signal.hops.push(parent);
        try {
          const report = await handler.handle(signal);
          reports.push(report);
          this.notifyListeners(parent, signal);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`[SignalBus] Bubble-up handler error for ${parent}`, error instanceof Error ? error : undefined, {
            error: errorMsg,
          });
        }
      }

      currentAgent = parent;
    }

    return reports;
  }

  /**
   * BUBBLE_DOWN - Jasper -> Manager -> Specialist
   */
  private async handleBubbleDown(signal: Signal): Promise<AgentReport[]> {
    const reports: AgentReport[] = [];
    const startNode = signal.origin || SignalBus.JASPER;
    const targetPath = this.findPathToTarget(startNode, signal.target);

    if (!targetPath) {
      return [{
        agentId: 'SIGNAL_BUS',
        timestamp: new Date(),
        taskId: signal.id,
        status: 'FAILED',
        data: null,
        errors: [`No path from ${startNode} to ${signal.target}`],
      }];
    }

    for (const agentId of targetPath) {
      const handler = this.registry.handlers.get(agentId);
      if (handler?.canHandle(signal)) {
        signal.hops.push(agentId);
        try {
          const report = await handler.handle(signal);
          reports.push(report);
          this.notifyListeners(agentId, signal);

          if (report.status === 'BLOCKED' || report.status === 'FAILED') {
            break;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`[SignalBus] Bubble-down handler error for ${agentId}`, error instanceof Error ? error : undefined, {
            error: errorMsg,
          });
          break;
        }
      }
    }

    return reports;
  }

  /**
   * Find path from parent to descendant within hierarchy
   */
  private findPathToTarget(from: string, to: string): string[] | null {
    const queue: Array<{ node: string; path: string[] }> = [{ node: from, path: [] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) { break; }

      if (current.node === to) {
        return current.path;
      }

      if (visited.has(current.node)) { continue; }
      visited.add(current.node);

      const childNodes = this.registry.children.get(current.node);
      if (childNodes) {
        for (const child of childNodes) {
          queue.push({
            node: child,
            path: [...current.path, child],
          });
        }
      }
    }

    return null;
  }

  /**
   * Notify listeners for an agent
   */
  private notifyListeners(agentId: string, signal: Signal): void {
    const agentListeners = this.registry.listeners.get(agentId);
    if (agentListeners) {
      for (const listener of agentListeners) {
        try {
          listener(signal);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`[SignalBus] Listener error for ${agentId}`, error instanceof Error ? error : undefined, {
            error: errorMsg,
          });
        }
      }
    }
  }

  // ==========================================================================
  // SIGNAL CREATION HELPER
  // ==========================================================================

  /**
   * Create a signal
   */
  createSignal(
    type: Signal['type'],
    origin: string,
    target: string,
    message: AgentMessage
  ): Signal {
    return {
      id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type,
      origin,
      target,
      payload: message,
      hops: [],
      maxHops: 10,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000), // 1 minute TTL
    };
  }

  // ==========================================================================
  // LIFECYCLE MANAGEMENT
  // ==========================================================================

  /**
   * Reset the bus - clears all handlers, listeners, history
   */
  reset(): {
    cleanedHandlers: number;
    cleanedListeners: number;
    cleanedSignals: number;
  } {
    const stats = {
      cleanedHandlers: this.registry.handlers.size,
      cleanedListeners: Array.from(this.registry.listeners.values())
        .reduce((sum, set) => sum + set.size, 0),
      cleanedSignals: this.registry.processedSignals.size +
        this.registry.pendingSignals.length +
        this.registry.signalHistory.length,
    };

    this.registry = this.createRegistry();

    logger.info('[SignalBus] Registry reset', stats);

    return stats;
  }

  /**
   * Cleanup expired signals
   */
  cleanupExpiredSignals(): number {
    const now = Date.now();
    const initialSize = this.registry.pendingSignals.length;

    this.registry.pendingSignals = this.registry.pendingSignals.filter(
      signal => signal.expiresAt.getTime() > now
    );

    const cleaned = initialSize - this.registry.pendingSignals.length;

    if (cleaned > 0) {
      logger.debug('[SignalBus] Cleaned expired signals', { cleaned });
    }

    return cleaned;
  }

  // ==========================================================================
  // STATUS & MONITORING
  // ==========================================================================

  /**
   * Get swarm state
   */
  getSwarmState(): {
    registeredAgents: string[];
    hierarchy: Record<string, string>;
    pendingSignals: number;
    processedSignals: number;
  } {
    const hierarchyObj: Record<string, string> = {};
    for (const [child, parent] of this.registry.hierarchy) {
      hierarchyObj[child] = parent;
    }

    return {
      registeredAgents: Array.from(this.registry.handlers.keys()),
      hierarchy: hierarchyObj,
      pendingSignals: this.registry.pendingSignals.length,
      processedSignals: this.registry.processedSignals.size,
    };
  }

  /**
   * Get global metrics
   */
  getMetrics(): {
    totalSignalsSent: number;
    totalSignalsFailed: number;
  } {
    return { ...this.metrics };
  }

  /**
   * Visualize the hierarchy (debugging)
   */
  printHierarchy(): string {
    const lines: string[] = [
      '=== AGENT HIERARCHY ===',
      'JASPER (Root Orchestrator)',
    ];

    const printChildren = (parentId: string, indent: number): void => {
      const childSet = this.registry.children.get(parentId);
      if (!childSet) { return; }

      for (const childId of childSet) {
        const prefix = `${'  '.repeat(indent)}├─ `;
        const handler = this.registry.handlers.get(childId);
        const status = handler ? '✓' : '✗ GHOST';
        lines.push(`${prefix}${childId} [${status}]`);
        printChildren(childId, indent + 1);
      }
    };

    printChildren(SignalBus.JASPER, 1);
    return lines.join('\n');
  }

  // ==========================================================================
  // SIGNAL HISTORY & TELEMETRY
  // ==========================================================================

  /**
   * Record a signal in the history for telemetry/audit
   * @internal Used by signal handlers
   */
  recordSignalHistory(
    signal: Signal,
    targetAgentId: string,
    status: SignalHistoryEntry['status'],
    durationMs?: number,
    errorMessage?: string
  ): void {
    const entry: SignalHistoryEntry = {
      signal: { ...signal },
      processedAt: new Date(),
      targetAgentId,
      status,
      durationMs,
      errorMessage,
    };

    this.registry.signalHistory.unshift(entry);

    const MAX_HISTORY = 1000;
    if (this.registry.signalHistory.length > MAX_HISTORY) {
      this.registry.signalHistory = this.registry.signalHistory.slice(0, MAX_HISTORY);
    }
  }

  /**
   * Get signal history with efficient filtering
   *
   * @param options - Query options for filtering
   * @returns Filtered signal history entries
   */
  getHistory(options: SignalHistoryOptions = {}): {
    entries: SignalHistoryEntry[];
    total: number;
    hasMore: boolean;
  } {
    let filtered = this.registry.signalHistory;

    if (options.agentId) {
      filtered = filtered.filter(entry => entry.targetAgentId === options.agentId);
    }

    if (options.status) {
      filtered = filtered.filter(entry => entry.status === options.status);
    }

    if (options.signalType) {
      filtered = filtered.filter(entry => entry.signal.type === options.signalType);
    }

    if (options.since) {
      const sinceTime = options.since.getTime();
      filtered = filtered.filter(entry => entry.processedAt.getTime() >= sinceTime);
    }

    if (options.until) {
      const untilTime = options.until.getTime();
      filtered = filtered.filter(entry => entry.processedAt.getTime() <= untilTime);
    }

    const total = filtered.length;

    const offset = options.offset ?? 0;
    const limit = Math.min(options.limit ?? 100, 500);

    const paginated = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      entries: paginated,
      total,
      hasMore,
    };
  }

  /**
   * Get aggregated statistics for an agent's signal history
   */
  getAgentStats(agentId: string): {
    totalSignals: number;
    successCount: number;
    failureCount: number;
    pendingCount: number;
    averageDurationMs: number;
    lastActivity: Date | null;
  } {
    const agentHistory = this.registry.signalHistory.filter(e => e.targetAgentId === agentId);

    if (agentHistory.length === 0) {
      return {
        totalSignals: 0,
        successCount: 0,
        failureCount: 0,
        pendingCount: 0,
        averageDurationMs: 0,
        lastActivity: null,
      };
    }

    const successCount = agentHistory.filter(e => e.status === 'SUCCESS').length;
    const failureCount = agentHistory.filter(e => e.status === 'FAILED').length;
    const pendingCount = agentHistory.filter(e => e.status === 'PENDING').length;

    const durationsWithValue = agentHistory
      .filter(e => e.durationMs !== undefined)
      .map(e => e.durationMs as number);

    const averageDurationMs = durationsWithValue.length > 0
      ? durationsWithValue.reduce((sum, d) => sum + d, 0) / durationsWithValue.length
      : 0;

    return {
      totalSignals: agentHistory.length,
      successCount,
      failureCount,
      pendingCount,
      averageDurationMs: Math.round(averageDurationMs),
      lastActivity: agentHistory[0]?.processedAt ?? null,
    };
  }
}

// ============================================================================
// SINGLETON MANAGEMENT
// ============================================================================

let signalBusInstance: SignalBus | null = null;

export function getSignalBus(): SignalBus {
  signalBusInstance ??= new SignalBus();
  return signalBusInstance;
}

export function resetSignalBus(): void {
  if (signalBusInstance) {
    signalBusInstance.reset();
  }
  signalBusInstance = null;
  logger.info('[SignalBus] Instance reset');
}
