// STATUS: FOUNDATION - Base class for all specialist agents
// Every specialist MUST extend this class

import type {
  AgentIdentity,
  AgentMessage,
  AgentReport,
  SpecialistConfig,
  Signal,
  AgentStatus
} from './types';

export abstract class BaseSpecialist {
  protected identity: AgentIdentity;
  protected config: SpecialistConfig;
  protected isInitialized: boolean = false;

  constructor(config: SpecialistConfig) {
    this.config = config;
    this.identity = config.identity;
  }

  /**
   * Initialize the specialist - load any required resources
   */
  abstract initialize(): Promise<void>;

  /**
   * The core execution logic - MUST be implemented with REAL functionality
   * Not just logging or returning empty objects
   */
  abstract execute(message: AgentMessage): Promise<AgentReport>;

  /**
   * Handle incoming signals from the Signal Bus
   */
  abstract handleSignal(signal: Signal): Promise<AgentReport>;

  /**
   * Generate a structured report for the manager
   */
  abstract generateReport(taskId: string, data: unknown): AgentReport;

  /**
   * Self-assessment - returns true if this agent has REAL functionality
   * Used for auditing shell vs functional agents
   */
  abstract hasRealLogic(): boolean;

  /**
   * Count lines of functional code (for auditing)
   */
  abstract getFunctionalLOC(): { functional: number; boilerplate: number };

  // Common utilities
  protected createReport(
    taskId: string,
    status: AgentReport['status'],
    data: unknown,
    errors?: string[]
  ): AgentReport {
    return {
      agentId: this.identity.id,
      timestamp: new Date(),
      taskId,
      status,
      data,
      errors,
    };
  }

  protected log(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
    const formattedMessage = `[${this.identity.name}] ${message}`;
    if (level === 'ERROR') {
      // Using dynamic import to avoid sync logger dependency
      void import('@/lib/logger/logger').then(({ logger }) => {
        logger.error(formattedMessage, new Error(message), { agent: this.identity.id });
      });
    } else if (level === 'WARN') {
      void import('@/lib/logger/logger').then(({ logger }) => {
        logger.warn(formattedMessage, { agent: this.identity.id });
      });
    } else {
      void import('@/lib/logger/logger').then(({ logger }) => {
        logger.info(formattedMessage, { agent: this.identity.id });
      });
    }
  }

  // Status helpers
  getStatus(): AgentStatus {
    return this.identity.status;
  }

  isGhost(): boolean {
    return this.identity.status === 'GHOST';
  }

  isShell(): boolean {
    return this.identity.status === 'SHELL';
  }

  isFunctional(): boolean {
    return this.identity.status === 'FUNCTIONAL' || this.identity.status === 'TESTED';
  }

  getIdentity(): AgentIdentity {
    return { ...this.identity };
  }
}
