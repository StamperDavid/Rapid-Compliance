// STATUS: FUNCTIONAL - The communication backbone for the Agent Swarm
// Handles hierarchical message passing: Jasper → Manager → Specialist

import type {
  Signal,
  SignalHandler,
  AgentMessage,
  AgentReport,
  SwarmState as _SwarmState
} from '../agents/types';

type SignalListener = (signal: Signal) => void;

/**
 * SignalBus - The nervous system of the Agent Swarm
 *
 * Supports four signal types:
 * - BROADCAST: Send to all agents
 * - DIRECT: Send to specific agent
 * - BUBBLE_UP: Specialist → Manager → Jasper
 * - BUBBLE_DOWN: Jasper → Manager → Specialist
 */
export class SignalBus {
  private handlers: Map<string, SignalHandler> = new Map();
  private listeners: Map<string, Set<SignalListener>> = new Map();
  private pendingSignals: Signal[] = [];
  private processedSignals: Set<string> = new Set();
  private hierarchy: Map<string, string> = new Map(); // child -> parent
  private children: Map<string, Set<string>> = new Map(); // parent -> children

  // The chain of command
  private static readonly JASPER = 'JASPER';

  constructor() {
    // Initialize Jasper as root
    this.children.set(SignalBus.JASPER, new Set());
  }

  /**
   * Register an agent in the hierarchy
   */
  registerAgent(agentId: string, parentId: string | null, handler: SignalHandler): void {
    this.handlers.set(agentId, handler);

    if (parentId) {
      this.hierarchy.set(agentId, parentId);

      if (!this.children.has(parentId)) {
        this.children.set(parentId, new Set());
      }
      this.children.get(parentId)?.add(agentId);
    } else {
      // Direct report to Jasper
      this.hierarchy.set(agentId, SignalBus.JASPER);
      this.children.get(SignalBus.JASPER)?.add(agentId);
    }

    // Agent registered: agentId → parentId ?? 'JASPER'
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    const parent = this.hierarchy.get(agentId);
    if (parent) {
      this.children.get(parent)?.delete(agentId);
    }
    this.hierarchy.delete(agentId);
    this.handlers.delete(agentId);
    this.listeners.delete(agentId);
  }

  /**
   * Subscribe to signals for a specific agent
   */
  subscribe(agentId: string, listener: SignalListener): () => void {
    if (!this.listeners.has(agentId)) {
      this.listeners.set(agentId, new Set());
    }
    this.listeners.get(agentId)?.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(agentId)?.delete(listener);
    };
  }

  /**
   * Send a signal through the bus
   */
  async send(signal: Signal): Promise<AgentReport[]> {
    if (this.processedSignals.has(signal.id)) {
      console.warn(`[SignalBus] Duplicate signal ignored: ${signal.id}`);
      return [];
    }

    if (signal.hops.length >= signal.maxHops) {
      console.error(`[SignalBus] Signal exceeded max hops: ${signal.id}`);
      return [{
        agentId: 'SIGNAL_BUS',
        timestamp: new Date(),
        taskId: signal.id,
        status: 'FAILED',
        data: null,
        errors: ['Signal exceeded maximum hop count'],
      }];
    }

    this.processedSignals.add(signal.id);

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
   * BROADCAST - Send to all registered agents
   */
  private async handleBroadcast(signal: Signal): Promise<AgentReport[]> {
    const reports: AgentReport[] = [];

    for (const [agentId, handler] of this.handlers) {
      if (handler.canHandle(signal)) {
        signal.hops.push(agentId);
        const report = await handler.handle(signal);
        reports.push(report);
        this.notifyListeners(agentId, signal);
      }
    }

    return reports;
  }

  /**
   * DIRECT - Send to specific agent
   */
  private async handleDirect(signal: Signal): Promise<AgentReport[]> {
    const handler = this.handlers.get(signal.target);

    if (!handler) {
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
    return [await handler.handle(signal)];
  }

  /**
   * BUBBLE_UP - Specialist → Manager → Jasper
   * Used for reporting results up the chain
   */
  private async handleBubbleUp(signal: Signal): Promise<AgentReport[]> {
    const reports: AgentReport[] = [];
    let currentAgent = signal.origin;

    while (currentAgent && currentAgent !== SignalBus.JASPER) {
      const parent = this.hierarchy.get(currentAgent);
      if (!parent) {break;}

      const handler = this.handlers.get(parent);
      if (handler?.canHandle(signal)) {
        signal.hops.push(parent);
        const report = await handler.handle(signal);
        reports.push(report);
        this.notifyListeners(parent, signal);
      }

      currentAgent = parent;
    }

    return reports;
  }

  /**
   * BUBBLE_DOWN - Jasper → Manager → Specialist
   * Used for delegating tasks down the chain
   *
   * Example: Jasper sends "analyze competitor" → Marketing Manager → SEO Expert
   */
  private async handleBubbleDown(signal: Signal): Promise<AgentReport[]> {
    const reports: AgentReport[] = [];

    // Start from Jasper or the specified origin
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

    // Traverse down the hierarchy
    for (const agentId of targetPath) {
      const handler = this.handlers.get(agentId);
      if (handler?.canHandle(signal)) {
        signal.hops.push(agentId);
        const report = await handler.handle(signal);
        reports.push(report);
        this.notifyListeners(agentId, signal);

        // If any handler blocks the signal, stop propagation
        if (report.status === 'BLOCKED' || report.status === 'FAILED') {
          break;
        }
      }
    }

    return reports;
  }

  /**
   * Find path from parent to descendant
   */
  private findPathToTarget(from: string, to: string): string[] | null {
    const _path: string[] = [];
    const queue: Array<{ node: string; path: string[] }> = [{ node: from, path: [] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) { break; }

      if (current.node === to) {
        return current.path;
      }

      if (visited.has(current.node)) {continue;}
      visited.add(current.node);

      const childNodes = this.children.get(current.node);
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
    const agentListeners = this.listeners.get(agentId);
    if (agentListeners) {
      for (const listener of agentListeners) {
        try {
          listener(signal);
        } catch (error) {
          console.error(`[SignalBus] Listener error for ${agentId}:`, error);
        }
      }
    }
  }

  /**
   * Create a signal helper
   */
  createSignal(
    type: Signal['type'],
    origin: string,
    target: string,
    message: AgentMessage
  ): Signal {
    return {
      id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

  /**
   * Get the current state of the swarm
   */
  getSwarmState(): {
    registeredAgents: string[];
    hierarchy: Record<string, string>;
    pendingSignals: number;
    processedSignals: number;
  } {
    const hierarchyObj: Record<string, string> = {};
    for (const [child, parent] of this.hierarchy) {
      hierarchyObj[child] = parent;
    }

    return {
      registeredAgents: Array.from(this.handlers.keys()),
      hierarchy: hierarchyObj,
      pendingSignals: this.pendingSignals.length,
      processedSignals: this.processedSignals.size,
    };
  }

  /**
   * Visualize the hierarchy (for debugging)
   */
  printHierarchy(): string {
    const lines: string[] = ['=== AGENT HIERARCHY ===', 'JASPER (Root Orchestrator)'];

    const printChildren = (parentId: string, indent: number): void => {
      const childSet = this.children.get(parentId);
      if (!childSet) {return;}

      for (const childId of childSet) {
        const prefix = `${'  '.repeat(indent)  }├─ `;
        const handler = this.handlers.get(childId);
        const status = handler ? '✓' : '✗ GHOST';
        lines.push(`${prefix}${childId} [${status}]`);
        printChildren(childId, indent + 1);
      }
    };

    printChildren(SignalBus.JASPER, 1);
    return lines.join('\n');
  }
}

// Singleton instance
let signalBusInstance: SignalBus | null = null;

export function getSignalBus(): SignalBus {
  signalBusInstance ??= new SignalBus();
  return signalBusInstance;
}

export function resetSignalBus(): void {
  signalBusInstance = null;
}
