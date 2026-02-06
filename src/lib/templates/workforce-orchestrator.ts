/**
 * Workforce Orchestrator
 *
 * THE SOVEREIGN CORPORATE BRAIN - WORKFORCE DEPLOYMENT & STATE MANAGEMENT
 *
 * This module handles the deployment, activation, hibernation, and coordination
 * of specialized AI agents based on industry templates and organization configurations.
 *
 * RESPONSIBILITIES:
 * - Deploy workforce templates to organizations
 * - Manage agent states (active/hibernated/disabled)
 * - Handle platform connection status updates
 * - Coordinate cross-platform content distribution
 * - Emit signals for workforce state changes
 *
 * @module workforce-orchestrator
 * @version 1.0.0
 */

import { logger } from '@/lib/logger/logger';
import type { SignalEmissionResult } from '@/lib/orchestration/types';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import {
  type WorkforceTemplate,
  type WorkforcePlatform,
  type AgentDeploymentState,
  type OrganizationWorkforce,
  type OrganizationAgentState,
  type PlatformConnectionStatus,
  type AgentManual,
  getWorkforceTemplate,
  isPlatformActive,
  getHibernatedAgents,
  calculateWorkforceHealth,
} from './workforce-templates';

// ============================================================================
// ORCHESTRATOR TYPES
// ============================================================================

/**
 * Workforce deployment options
 */
export interface WorkforceDeploymentOptions {
  /**
   * Organization ID to deploy to
   */
  orgId: string;

  /**
   * Template ID to deploy
   */
  templateId: string;

  /**
   * Override default agent states
   */
  agentStateOverrides?: Partial<Record<WorkforcePlatform, AgentDeploymentState>>;

  /**
   * Initial platform connections
   */
  platformConnections?: Partial<Record<WorkforcePlatform, PlatformConnectionStatus>>;

  /**
   * Custom template overrides
   */
  templateOverrides?: Partial<WorkforceTemplate>;

  /**
   * Auto-activate agents when platforms connect
   */
  autoActivateOnConnect?: boolean;
}

/**
 * Agent activation result
 */
export interface AgentActivationResult {
  success: boolean;
  platform: WorkforcePlatform;
  previousState: AgentDeploymentState;
  newState: AgentDeploymentState;
  error?: string;
}

/**
 * Workforce state change event
 */
export interface WorkforceStateChangeEvent {
  orgId: string;
  platform: WorkforcePlatform;
  previousState: AgentDeploymentState;
  newState: AgentDeploymentState;
  reason: string;
  timestamp: Date;
}

/**
 * Platform connection event
 */
export interface PlatformConnectionEvent {
  orgId: string;
  platform: WorkforcePlatform;
  connected: boolean;
  accountId?: string;
  accountName?: string;
  timestamp: Date;
}

// ============================================================================
// WORKFORCE ORCHESTRATOR CLASS
// ============================================================================

/**
 * WorkforceOrchestrator - Manages specialized AI workforce deployment and state
 */
export class WorkforceOrchestrator {
  private workforceCache: Map<string, OrganizationWorkforce> = new Map();
  private stateChangeListeners: ((event: WorkforceStateChangeEvent) => void)[] = [];
  private connectionListeners: ((event: PlatformConnectionEvent) => void)[] = [];

  constructor(
    private signalEmitter?: (signal: {
      type: string;
      orgId: string;
      confidence: number;
      priority: 'High' | 'Medium' | 'Low';
      metadata: Record<string, unknown>;
    }) => Promise<SignalEmissionResult>
  ) {
    logger.info('WorkforceOrchestrator initialized');
  }

  // ==========================================================================
  // DEPLOYMENT METHODS
  // ==========================================================================

  /**
   * Deploy a workforce template to an organization
   */
  async deployWorkforce(options: WorkforceDeploymentOptions): Promise<OrganizationWorkforce> {
    const { orgId, templateId, agentStateOverrides, platformConnections, templateOverrides, autoActivateOnConnect: _autoActivateOnConnect = true } = options;

    // Get the template
    const template = getWorkforceTemplate(templateId);
    if (!template) {
      throw new Error(`Workforce template not found: ${templateId}`);
    }

    logger.info('Deploying workforce template', { orgId, templateId });

    // Initialize agent states from template defaults with overrides
    const agentStates: Record<WorkforcePlatform, OrganizationAgentState> = {} as Record<WorkforcePlatform, OrganizationAgentState>;

    for (const platform of Object.keys(template.defaultAgentStates) as WorkforcePlatform[]) {
      const defaultState = agentStateOverrides?.[platform] ?? template.defaultAgentStates[platform];
      agentStates[platform] = {
        state: defaultState,
        stateReason: defaultState === 'hibernated' ? 'Platform not connected' : 'Template default',
        stateChangedAt: new Date(),
        metrics: {
          totalContentGenerated: 0,
          totalEngagements: 0,
          lastActiveAt: null,
        },
      };
    }

    // Initialize platform connections
    const connections: Record<WorkforcePlatform, PlatformConnectionStatus> = {} as Record<WorkforcePlatform, PlatformConnectionStatus>;

    for (const platform of Object.keys(template.defaultAgentStates) as WorkforcePlatform[]) {
      connections[platform] = platformConnections?.[platform] ?? {
        connected: false,
        healthStatus: 'disconnected',
      };
    }

    // Create the organization workforce
    const workforce: OrganizationWorkforce = {
      orgId,
      templateId,
      agentStates,
      platformConnections: connections,
      templateOverrides,
      deployedAt: new Date(),
      lastActivityAt: new Date(),
    };

    // Cache the workforce
    this.workforceCache.set(orgId, workforce);

    // Emit deployment signal
    await this.emitWorkforceSignal('workforce.deployed', orgId, {
      templateId,
      activeAgents: Object.values(agentStates).filter(s => s.state === 'active').length,
      hibernatedAgents: Object.values(agentStates).filter(s => s.state === 'hibernated').length,
    });

    logger.info('Workforce deployed successfully', {
      orgId,
      templateId,
      activeAgents: Object.values(agentStates).filter(s => s.state === 'active').length,
    });

    return workforce;
  }

  /**
   * Get workforce for an organization
   */
  getWorkforce(orgId: string): OrganizationWorkforce | null {
    return this.workforceCache.get(orgId) ?? null;
  }

  // ==========================================================================
  // AGENT STATE MANAGEMENT - THE DORMANT STATE LOGIC
  // ==========================================================================

  /**
   * Activate a hibernated agent
   *
   * This is called when a platform is connected or manually activated.
   * The agent's Industry Template remains intact and is instantly available.
   */
  async activateAgent(
    orgId: string,
    platform: WorkforcePlatform,
    reason: string = 'Manual activation'
  ): Promise<AgentActivationResult> {
    const workforce = this.workforceCache.get(orgId);
    if (!workforce) {
      return {
        success: false,
        platform,
        previousState: 'hibernated',
        newState: 'hibernated',
        error: 'Workforce not found for organization',
      };
    }

    const currentState = workforce.agentStates[platform];
    if (!currentState) {
      return {
        success: false,
        platform,
        previousState: 'hibernated',
        newState: 'hibernated',
        error: 'Agent not found in workforce',
      };
    }

    const previousState = currentState.state;

    // Check if platform is connected
    const connection = workforce.platformConnections[platform];
    if (!connection?.connected && reason !== 'Force activation') {
      return {
        success: false,
        platform,
        previousState,
        newState: previousState,
        error: 'Cannot activate agent: platform not connected',
      };
    }

    // Update agent state
    currentState.state = 'active';
    currentState.stateReason = reason;
    currentState.stateChangedAt = new Date();
    workforce.lastActivityAt = new Date();

    // Emit state change event
    const event: WorkforceStateChangeEvent = {
      orgId,
      platform,
      previousState,
      newState: 'active',
      reason,
      timestamp: new Date(),
    };
    this.notifyStateChangeListeners(event);

    // Emit signal
    await this.emitWorkforceSignal('agent.activated', orgId, {
      platform,
      previousState,
      reason,
    });

    logger.info('Agent activated', { orgId, platform, previousState, reason });

    return {
      success: true,
      platform,
      previousState,
      newState: 'active',
    };
  }

  /**
   * Hibernate an agent
   *
   * This marks the agent as dormant but keeps the Industry Template
   * ready for instant re-activation. Used when:
   * - Platform is disconnected
   * - Admin manually hibernates
   * - Usage limits exceeded
   */
  async hibernateAgent(
    orgId: string,
    platform: WorkforcePlatform,
    reason: string = 'Manual hibernation'
  ): Promise<AgentActivationResult> {
    const workforce = this.workforceCache.get(orgId);
    if (!workforce) {
      return {
        success: false,
        platform,
        previousState: 'active',
        newState: 'active',
        error: 'Workforce not found for organization',
      };
    }

    const currentState = workforce.agentStates[platform];
    if (!currentState) {
      return {
        success: false,
        platform,
        previousState: 'active',
        newState: 'active',
        error: 'Agent not found in workforce',
      };
    }

    const previousState = currentState.state;

    // Update agent state
    currentState.state = 'hibernated';
    currentState.stateReason = reason;
    currentState.stateChangedAt = new Date();
    workforce.lastActivityAt = new Date();

    // Emit state change event
    const event: WorkforceStateChangeEvent = {
      orgId,
      platform,
      previousState,
      newState: 'hibernated',
      reason,
      timestamp: new Date(),
    };
    this.notifyStateChangeListeners(event);

    // Emit signal
    await this.emitWorkforceSignal('agent.hibernated', orgId, {
      platform,
      previousState,
      reason,
    });

    logger.info('Agent hibernated', { orgId, platform, previousState, reason });

    return {
      success: true,
      platform,
      previousState,
      newState: 'hibernated',
    };
  }

  /**
   * Disable an agent completely
   *
   * Unlike hibernation, this requires explicit re-enabling.
   * Used for compliance or administrative reasons.
   */
  async disableAgent(
    orgId: string,
    platform: WorkforcePlatform,
    reason: string = 'Administrative action'
  ): Promise<AgentActivationResult> {
    const workforce = this.workforceCache.get(orgId);
    if (!workforce) {
      return {
        success: false,
        platform,
        previousState: 'active',
        newState: 'active',
        error: 'Workforce not found for organization',
      };
    }

    const currentState = workforce.agentStates[platform];
    if (!currentState) {
      return {
        success: false,
        platform,
        previousState: 'active',
        newState: 'active',
        error: 'Agent not found in workforce',
      };
    }

    const previousState = currentState.state;

    // Update agent state
    currentState.state = 'disabled';
    currentState.stateReason = reason;
    currentState.stateChangedAt = new Date();
    workforce.lastActivityAt = new Date();

    // Emit signal
    await this.emitWorkforceSignal('agent.disabled', orgId, {
      platform,
      previousState,
      reason,
    });

    logger.warn('Agent disabled', { orgId, platform, previousState, reason });

    return {
      success: true,
      platform,
      previousState,
      newState: 'disabled',
    };
  }

  // ==========================================================================
  // PLATFORM CONNECTION MANAGEMENT
  // ==========================================================================

  /**
   * Handle platform connection
   *
   * When a platform is connected, the Orchestrator:
   * 1. Updates connection status
   * 2. Auto-activates hibernated agent if configured
   * 3. Emits connection signal
   */
  async handlePlatformConnected(
    orgId: string,
    platform: WorkforcePlatform,
    connectionInfo: {
      accountId: string;
      accountName: string;
    }
  ): Promise<void> {
    const workforce = this.workforceCache.get(orgId);
    if (!workforce) {
      logger.warn('Platform connected but workforce not found', { orgId, platform });
      return;
    }

    // Update connection status
    workforce.platformConnections[platform] = {
      connected: true,
      accountId: connectionInfo.accountId,
      accountName: connectionInfo.accountName,
      connectedAt: new Date(),
      lastSyncAt: new Date(),
      healthStatus: 'healthy',
    };

    // Notify connection listeners
    const event: PlatformConnectionEvent = {
      orgId,
      platform,
      connected: true,
      accountId: connectionInfo.accountId,
      accountName: connectionInfo.accountName,
      timestamp: new Date(),
    };
    this.notifyConnectionListeners(event);

    // Auto-activate if agent was hibernated
    const agentState = workforce.agentStates[platform];
    if (agentState?.state === 'hibernated') {
      await this.activateAgent(
        orgId,
        platform,
        `Platform connected: ${connectionInfo.accountName}`
      );
    }

    // Emit signal
    await this.emitWorkforceSignal('platform.connected', orgId, {
      platform,
      accountId: connectionInfo.accountId,
      accountName: connectionInfo.accountName,
    });

    logger.info('Platform connected', { orgId, platform, accountName: connectionInfo.accountName });
  }

  /**
   * Handle platform disconnection
   *
   * When a platform is disconnected, the Orchestrator:
   * 1. Updates connection status
   * 2. Hibernates the agent (preserves template)
   * 3. Emits disconnection signal
   */
  async handlePlatformDisconnected(
    orgId: string,
    platform: WorkforcePlatform,
    reason: string = 'User disconnected'
  ): Promise<void> {
    const workforce = this.workforceCache.get(orgId);
    if (!workforce) {
      logger.warn('Platform disconnected but workforce not found', { orgId, platform });
      return;
    }

    // Update connection status
    workforce.platformConnections[platform] = {
      connected: false,
      healthStatus: 'disconnected',
      errorMessage: reason,
    };

    // Notify connection listeners
    const event: PlatformConnectionEvent = {
      orgId,
      platform,
      connected: false,
      timestamp: new Date(),
    };
    this.notifyConnectionListeners(event);

    // Hibernate the agent (but preserve template for re-activation)
    const agentState = workforce.agentStates[platform];
    if (agentState?.state === 'active') {
      await this.hibernateAgent(orgId, platform, `Platform disconnected: ${reason}`);
    }

    // Emit signal
    await this.emitWorkforceSignal('platform.disconnected', orgId, {
      platform,
      reason,
    });

    logger.info('Platform disconnected', { orgId, platform, reason });
  }

  // ==========================================================================
  // AGENT MANUAL ACCESS
  // ==========================================================================

  /**
   * Get the agent manual for a specific platform
   *
   * This retrieves the "Environment Manual" (System Prompt + Tool Config)
   * for a specialized agent, with any organization-specific overrides applied.
   */
  getAgentManual(orgId: string, platform: WorkforcePlatform): AgentManual | null {
    const workforce = this.workforceCache.get(orgId);
    if (!workforce) {
      return null;
    }

    // Get the base template
    const template = getWorkforceTemplate(workforce.templateId);
    if (!template) {
      return null;
    }

    // Get base manual
    const baseManual = template.agentManuals[platform];
    if (!baseManual) {
      return null;
    }

    // Apply organization-specific overrides
    const agentState = workforce.agentStates[platform];
    if (agentState?.manualOverrides) {
      return {
        ...baseManual,
        ...agentState.manualOverrides,
      } as AgentManual;
    }

    return baseManual;
  }

  /**
   * Get all active agent manuals for an organization
   */
  getActiveAgentManuals(orgId: string): Map<WorkforcePlatform, AgentManual> {
    const result = new Map<WorkforcePlatform, AgentManual>();
    const workforce = this.workforceCache.get(orgId);

    if (!workforce) {
      return result;
    }

    for (const platform of Object.keys(workforce.agentStates) as WorkforcePlatform[]) {
      if (isPlatformActive(workforce, platform)) {
        const manual = this.getAgentManual(orgId, platform);
        if (manual) {
          result.set(platform, manual);
        }
      }
    }

    return result;
  }

  // ==========================================================================
  // WORKFORCE QUERIES
  // ==========================================================================

  /**
   * Get workforce health summary
   */
  getWorkforceHealth(orgId: string): {
    score: number;
    activeAgents: number;
    hibernatedAgents: number;
    disabledAgents: number;
    connectedPlatforms: number;
  } | null {
    const workforce = this.workforceCache.get(orgId);
    if (!workforce) {
      return null;
    }

    const health = calculateWorkforceHealth(workforce);
    const states = Object.values(workforce.agentStates);
    const connections = Object.values(workforce.platformConnections);

    return {
      score: health.score,
      activeAgents: states.filter(s => s.state === 'active').length,
      hibernatedAgents: states.filter(s => s.state === 'hibernated').length,
      disabledAgents: states.filter(s => s.state === 'disabled').length,
      connectedPlatforms: connections.filter(c => c.connected).length,
    };
  }

  /**
   * Get agents available for activation
   */
  getActivatableAgents(orgId: string): WorkforcePlatform[] {
    const workforce = this.workforceCache.get(orgId);
    if (!workforce) {
      return [];
    }

    return getHibernatedAgents(workforce).filter(platform => {
      const connection = workforce.platformConnections[platform];
      return connection?.connected === true;
    });
  }

  // ==========================================================================
  // EVENT LISTENERS
  // ==========================================================================

  /**
   * Subscribe to agent state changes
   */
  onAgentStateChange(listener: (event: WorkforceStateChangeEvent) => void): () => void {
    this.stateChangeListeners.push(listener);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter(l => l !== listener);
    };
  }

  /**
   * Subscribe to platform connection changes
   */
  onPlatformConnection(listener: (event: PlatformConnectionEvent) => void): () => void {
    this.connectionListeners.push(listener);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
    };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private notifyStateChangeListeners(event: WorkforceStateChangeEvent): void {
    for (const listener of this.stateChangeListeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('State change listener error', error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private notifyConnectionListeners(event: PlatformConnectionEvent): void {
    for (const listener of this.connectionListeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('Connection listener error', error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private async emitWorkforceSignal(
    type: string,
    orgId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    if (!this.signalEmitter) {
      return;
    }

    try {
      await this.signalEmitter({
        type: type as 'custom',
        orgId,
        confidence: 1.0,
        priority: 'Medium',
        metadata: {
          ...metadata,
          source: 'workforce-orchestrator',
        },
      });
    } catch (error) {
      logger.error('Failed to emit workforce signal', error instanceof Error ? error : new Error(String(error)), { type, orgId });
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let orchestratorInstance: WorkforceOrchestrator | null = null;

/**
 * Get the workforce orchestrator singleton
 */
export function getWorkforceOrchestrator(
  signalEmitter?: (signal: {
    type: string;
    orgId: string;
    confidence: number;
    priority: 'High' | 'Medium' | 'Low';
    metadata: Record<string, unknown>;
  }) => Promise<SignalEmissionResult>
): WorkforceOrchestrator {
  orchestratorInstance ??= new WorkforceOrchestrator(signalEmitter);
  return orchestratorInstance;
}

/**
 * Reset the orchestrator (for testing)
 */
export function resetWorkforceOrchestrator(): void {
  orchestratorInstance = null;
}

// ============================================================================
// INDUSTRY-DRIVEN TOOL SEEDING
// ============================================================================

/**
 * Get visual style seeds for an organization's workforce
 *
 * This retrieves the industry-specific visual configurations for
 * the Video Generator and Website Builder based on the selected template.
 */
export function getVisualStyleSeeds(): {
  videoSeeds: WorkforceTemplate['visualStyleSeeds']['videoSeeds'];
  webSeeds: WorkforceTemplate['visualStyleSeeds']['webSeeds'];
  brandDNA: WorkforceTemplate['visualStyleSeeds']['brandDNA'];
} | null {
  const orgId = DEFAULT_ORG_ID;
  const orchestrator = getWorkforceOrchestrator();
  const workforce = orchestrator.getWorkforce(orgId);

  if (!workforce) {
    return null;
  }

  const template = getWorkforceTemplate(workforce.templateId);
  if (!template) {
    return null;
  }

  // Apply any organization overrides
  const baseSeeds = template.visualStyleSeeds;
  const overrideSeeds = workforce.templateOverrides?.visualStyleSeeds;

  return {
    videoSeeds: { ...baseSeeds.videoSeeds, ...overrideSeeds?.videoSeeds },
    webSeeds: { ...baseSeeds.webSeeds, ...overrideSeeds?.webSeeds },
    brandDNA: { ...baseSeeds.brandDNA, ...overrideSeeds?.brandDNA },
  };
}

/**
 * Seed the Video Generator with industry-specific styles
 */
export function seedVideoGenerator(): {
  colorGrading: WorkforceTemplate['visualStyleSeeds']['videoSeeds']['colorGrading'];
  transitions: WorkforceTemplate['visualStyleSeeds']['videoSeeds']['transitions'];
  textOverlays: WorkforceTemplate['visualStyleSeeds']['videoSeeds']['textOverlays'];
  audioProfile: WorkforceTemplate['visualStyleSeeds']['videoSeeds']['audioProfile'];
  pacing: WorkforceTemplate['visualStyleSeeds']['videoSeeds']['pacing'];
} | null {
  const seeds = getVisualStyleSeeds();
  return seeds?.videoSeeds ?? null;
}

/**
 * Seed the Website Builder with industry-specific styles
 */
export function seedWebsiteBuilder(): {
  designSystem: string;
  colorPalette: WorkforceTemplate['visualStyleSeeds']['webSeeds']['colorPalette'];
  typography: WorkforceTemplate['visualStyleSeeds']['webSeeds']['typography'];
  layout: WorkforceTemplate['visualStyleSeeds']['webSeeds']['layout'];
  animations: WorkforceTemplate['visualStyleSeeds']['webSeeds']['animations'];
  components: WorkforceTemplate['visualStyleSeeds']['webSeeds']['components'];
} | null {
  const seeds = getVisualStyleSeeds();
  return seeds?.webSeeds ?? null;
}

logger.info('Workforce Orchestrator module loaded');
