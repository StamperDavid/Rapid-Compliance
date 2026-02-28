/**
 * Jasper Command Authority
 *
 * Phase 8 of Autonomous Business Operations.
 * Upgrades Jasper from task submitter to command authority with:
 * - 8a: Briefing System — reads executive cycle reports for "while you were away" summaries
 * - 8b: Approval Gateway — queues high-impact actions for human approval
 * - 8c: Command Authority — issues orders to any Manager
 *
 * @module orchestrator/jasper-command-authority
 */

import { getMemoryVault } from '@/lib/agents/shared/memory-vault';
import { getSignalBus } from '@/lib/orchestrator/signal-bus';
import { AGENT_IDS } from '@/lib/agents';
import { logger } from '@/lib/logger/logger';
import type { AgentMessage } from '@/lib/agents/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Executive briefing for user upon login
 */
export interface ExecutiveBriefing {
  briefingId: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  summary: string;
  highlights: BriefingHighlight[];
  pendingApprovals: PendingApproval[];
  departmentSummaries: DepartmentSummary[];
  metrics: BriefingMetrics;
}

export interface BriefingHighlight {
  department: string;
  type: 'SUCCESS' | 'WARNING' | 'ACTION_REQUIRED' | 'INFO';
  title: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DepartmentSummary {
  department: string;
  managerId: string;
  status: 'HEALTHY' | 'NEEDS_ATTENTION' | 'CRITICAL';
  actionsCompleted: number;
  actionsPending: number;
  keyMetric: string;
  keyMetricValue: string;
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export interface BriefingMetrics {
  totalOperationalCycles: number;
  totalActionsExecuted: number;
  successRate: number;
  inboundRepliesProcessed: number;
  leadsAdvanced: number;
  contentProduced: number;
  reviewsResponded: number;
}

/**
 * Pending approval for human review
 */
export interface PendingApproval {
  approvalId: string;
  createdAt: Date;
  requestedBy: string;
  type: 'REVIEW_RESPONSE' | 'LARGE_CAMPAIGN' | 'PRICING_CHANGE' | 'LOW_CONFIDENCE_ACTION' | 'ESCALATION';
  description: string;
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  context: Record<string, unknown>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  expiresAt?: Date;
}

/**
 * Command that Jasper can issue to any Manager
 */
export interface JasperCommand {
  commandId: string;
  issuedAt: Date;
  targetManager: string;
  command: string;
  parameters: Record<string, unknown>;
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL';
  requiresConfirmation: boolean;
}

/**
 * Result of a Jasper command execution
 */
export interface CommandResult {
  commandId: string;
  status: 'EXECUTED' | 'QUEUED' | 'FAILED' | 'REQUIRES_APPROVAL';
  response?: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// JASPER COMMAND AUTHORITY CLASS
// ============================================================================

/**
 * JasperCommandAuthority - Upgrades Jasper to command authority
 *
 * Provides executive briefing, approval gateway, and command issuance.
 */
export class JasperCommandAuthority {
  private pendingApprovals: PendingApproval[] = [];
  private commandHistory: JasperCommand[] = [];

  private readonly MANAGER_IDS = [
    AGENT_IDS.INTELLIGENCE_MANAGER,
    AGENT_IDS.MARKETING_MANAGER,
    AGENT_IDS.BUILDER_MANAGER,
    AGENT_IDS.COMMERCE_MANAGER,
    AGENT_IDS.OUTREACH_MANAGER,
    AGENT_IDS.CONTENT_MANAGER,
    AGENT_IDS.ARCHITECT_MANAGER,
    AGENT_IDS.REVENUE_DIRECTOR,
    AGENT_IDS.REPUTATION_MANAGER,
  ] as const;

  /** Standalone agents that produce strategic briefings for executive summaries */
  private readonly BRIEFING_SOURCES = [
    AGENT_IDS.GROWTH_STRATEGIST,
  ] as const;

  // ==========================================================================
  // 8a. BRIEFING SYSTEM
  // ==========================================================================

  /**
   * Generate an executive briefing for the user
   */
  async generateExecutiveBriefing(): Promise<ExecutiveBriefing> {
    await Promise.resolve(); // Satisfy async requirement
    const vault = getMemoryVault();
    const now = new Date();
    const periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

    // Build department summaries
    const departmentSummaries = await this.buildDepartmentSummaries();

    // Build briefing metrics
    const metrics = await this.buildBriefingMetrics();

    // Pull Growth Strategist strategic briefings for executive context
    const strategyEntries = await vault.query('JASPER', {
      category: 'STRATEGY',
      createdBy: 'GROWTH_STRATEGIST',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 1,
    });
    const latestStrategy = strategyEntries[0]?.value as Record<string, unknown> | undefined;

    // Build highlights from recent activity
    const highlights = this.buildHighlights(departmentSummaries);

    // Add Growth Strategist highlight if available
    if (latestStrategy?.executiveSummary) {
      highlights.unshift({
        department: 'Growth Strategy',
        type: 'INFO',
        title: 'Growth Strategist Briefing',
        description: String(latestStrategy.executiveSummary),
        impact: 'HIGH',
      });
    }

    // Generate natural language summary
    const summary = this.generateBriefingSummary(highlights, metrics);

    const briefing: ExecutiveBriefing = {
      briefingId: `brief_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      generatedAt: now,
      periodStart,
      periodEnd: now,
      summary,
      highlights,
      pendingApprovals: this.getPendingApprovals(),
      departmentSummaries,
      metrics,
    };

    logger.info('[JasperCommandAuthority] Executive briefing generated', {
      briefingId: briefing.briefingId,
      highlightCount: highlights.length,
      pendingApprovals: briefing.pendingApprovals.length,
    });

    // Store briefing in MemoryVault for historical access
    vault.write('WORKFLOW', `briefing_${briefing.briefingId}`, briefing, 'JASPER', {
      tags: ['executive-briefing', 'command-authority'],
      priority: 'HIGH',
    });

    return briefing;
  }

  /**
   * Build department summaries from MemoryVault data
   */
  private async buildDepartmentSummaries(): Promise<DepartmentSummary[]> {
    const vault = getMemoryVault();
    const summaries: DepartmentSummary[] = [];

    for (const managerId of this.MANAGER_IDS) {
      // Read performance data for this manager
      const performanceEntries = await vault.query('JASPER', {
        category: 'PERFORMANCE',
        createdBy: managerId,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: 10,
      });

      // Read workflow data for this manager
      const workflowEntries = await vault.query('JASPER', {
        category: 'WORKFLOW',
        createdBy: managerId,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: 10,
      });

      // Determine status based on recent activity
      const recentActivity = performanceEntries.length + workflowEntries.length;
      let status: DepartmentSummary['status'] = 'HEALTHY';
      if (recentActivity < 3) {
        status = 'NEEDS_ATTENTION';
      }
      if (recentActivity === 0) {
        status = 'CRITICAL';
      }

      // Extract metrics from performance entries
      const actionsCompleted = workflowEntries.filter(
        e => e.metadata.status === 'COMPLETED'
      ).length;
      const actionsPending = workflowEntries.filter(
        e => e.metadata.status === 'PENDING' || e.metadata.status === 'IN_PROGRESS'
      ).length;

      // Determine key metric based on manager type
      const { keyMetric, keyMetricValue } = this.extractKeyMetric(
        managerId,
        performanceEntries
      );

      // Determine trend (simplified - could be more sophisticated)
      const trend: DepartmentSummary['trend'] = recentActivity > 5 ? 'UP' : 'STABLE';

      summaries.push({
        department: this.getDepartmentName(managerId),
        managerId,
        status,
        actionsCompleted,
        actionsPending,
        keyMetric,
        keyMetricValue,
        trend,
      });
    }

    return summaries;
  }

  /**
   * Build aggregated metrics from MemoryVault
   */
  private async buildBriefingMetrics(): Promise<BriefingMetrics> {
    const vault = getMemoryVault();

    // Query all recent workflow entries
    const workflowEntries = await vault.query('JASPER', {
      category: 'WORKFLOW',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 100,
    });

    // Query all recent performance entries
    const performanceEntries = await vault.query('JASPER', {
      category: 'PERFORMANCE',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 100,
    });

    // Count operational cycles (unique cycle IDs)
    const cycleIds = new Set<string>();
    workflowEntries.forEach(entry => {
      if (entry.metadata.cycleId) {
        cycleIds.add(entry.metadata.cycleId as string);
      }
    });

    // Count completed actions
    const completedActions = workflowEntries.filter(
      e => e.metadata.status === 'COMPLETED'
    ).length;

    // Calculate success rate
    const totalActions = workflowEntries.filter(
      e => e.metadata.status === 'COMPLETED' || e.metadata.status === 'FAILED'
    ).length;
    const successRate = totalActions > 0 ? completedActions / totalActions : 1.0;

    // Extract specific metrics from performance entries
    let inboundRepliesProcessed = 0;
    let leadsAdvanced = 0;
    let contentProduced = 0;
    let reviewsResponded = 0;

    performanceEntries.forEach(entry => {
      const value = entry.value as Record<string, unknown>;
      if (value.inboundReplies) {
        inboundRepliesProcessed += Number(value.inboundReplies) || 0;
      }
      if (value.leadsAdvanced) {
        leadsAdvanced += Number(value.leadsAdvanced) || 0;
      }
      if (value.contentProduced) {
        contentProduced += Number(value.contentProduced) || 0;
      }
      if (value.reviewsResponded) {
        reviewsResponded += Number(value.reviewsResponded) || 0;
      }
    });

    return {
      totalOperationalCycles: cycleIds.size,
      totalActionsExecuted: completedActions,
      successRate: Math.round(successRate * 100) / 100,
      inboundRepliesProcessed,
      leadsAdvanced,
      contentProduced,
      reviewsResponded,
    };
  }

  /**
   * Build highlights from department summaries
   */
  private buildHighlights(summaries: DepartmentSummary[]): BriefingHighlight[] {
    const highlights: BriefingHighlight[] = [];

    summaries.forEach(summary => {
      // Critical status → WARNING highlight
      if (summary.status === 'CRITICAL') {
        highlights.push({
          department: summary.department,
          type: 'WARNING',
          title: `${summary.department} requires attention`,
          description: `No recent activity detected. System may need review.`,
          impact: 'HIGH',
        });
      }

      // High completion rate → SUCCESS highlight
      if (summary.actionsCompleted > 5 && summary.trend === 'UP') {
        highlights.push({
          department: summary.department,
          type: 'SUCCESS',
          title: `${summary.department} momentum building`,
          description: `${summary.actionsCompleted} actions completed. ${summary.keyMetric}: ${summary.keyMetricValue}`,
          impact: 'MEDIUM',
        });
      }

      // Pending actions → INFO highlight
      if (summary.actionsPending > 3) {
        highlights.push({
          department: summary.department,
          type: 'INFO',
          title: `${summary.department} has ${summary.actionsPending} pending actions`,
          description: `Work in progress. ${summary.keyMetric}: ${summary.keyMetricValue}`,
          impact: 'LOW',
        });
      }
    });

    // Sort by impact (HIGH → MEDIUM → LOW)
    highlights.sort((a, b) => {
      const impactOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return impactOrder[b.impact] - impactOrder[a.impact];
    });

    // Limit to top 10 highlights
    return highlights.slice(0, 10);
  }

  /**
   * Generate natural-language briefing summary
   */
  private generateBriefingSummary(
    highlights: BriefingHighlight[],
    metrics: BriefingMetrics
  ): string {
    const parts: string[] = [];

    // Opening statement
    if (metrics.totalOperationalCycles > 0) {
      parts.push(
        `While you were away, the system processed ${metrics.totalOperationalCycles} operational cycle${metrics.totalOperationalCycles === 1 ? '' : 's'}.`
      );
    } else {
      parts.push('No operational cycles have run since your last login.');
    }

    // Inbound activity
    if (metrics.inboundRepliesProcessed > 0) {
      parts.push(
        `${metrics.inboundRepliesProcessed} inbound repl${metrics.inboundRepliesProcessed === 1 ? 'y' : 'ies'} processed${metrics.leadsAdvanced > 0 ? ` — ${metrics.leadsAdvanced} interested lead${metrics.leadsAdvanced === 1 ? '' : 's'} advanced to outreach` : ''}.`
      );
    }

    // Content production
    if (metrics.contentProduced > 0) {
      parts.push(`${metrics.contentProduced} piece${metrics.contentProduced === 1 ? '' : 's'} of content produced.`);
    }

    // Review responses
    if (metrics.reviewsResponded > 0) {
      parts.push(`${metrics.reviewsResponded} review${metrics.reviewsResponded === 1 ? '' : 's'} responded to.`);
    }

    // Success rate
    if (metrics.totalActionsExecuted > 0) {
      const successPercent = Math.round(metrics.successRate * 100);
      parts.push(`Overall success rate: ${successPercent}%.`);
    }

    // Key highlights
    const criticalHighlights = highlights.filter(h => h.type === 'WARNING');
    if (criticalHighlights.length > 0) {
      parts.push(
        `${criticalHighlights.length} department${criticalHighlights.length === 1 ? '' : 's'} require${criticalHighlights.length === 1 ? 's' : ''} attention.`
      );
    }

    return parts.join(' ');
  }

  /**
   * Extract key metric for a manager
   */
  private extractKeyMetric(
    managerId: string,
    entries: Array<{ value: unknown; metadata: Record<string, unknown> }>
  ): { keyMetric: string; keyMetricValue: string } {
    if (entries.length === 0) {
      return { keyMetric: 'Activity', keyMetricValue: 'No recent data' };
    }

    const latestEntry = entries[0];
    const value = latestEntry.value as Record<string, unknown>;

    // Map manager IDs to their key metrics
    const metricMap: Record<string, { key: string; label: string }> = {
      [AGENT_IDS.INTELLIGENCE_MANAGER]: { key: 'insightsGenerated', label: 'Insights' },
      [AGENT_IDS.MARKETING_MANAGER]: { key: 'campaignsLaunched', label: 'Campaigns' },
      [AGENT_IDS.OUTREACH_MANAGER]: { key: 'messagesProcessed', label: 'Messages' },
      [AGENT_IDS.CONTENT_MANAGER]: { key: 'contentCreated', label: 'Content Pieces' },
      [AGENT_IDS.REPUTATION_MANAGER]: { key: 'reviewsHandled', label: 'Reviews' },
      [AGENT_IDS.REVENUE_DIRECTOR]: { key: 'leadsQualified', label: 'Leads' },
    };

    const metric = metricMap[managerId] || { key: 'actionsCompleted', label: 'Actions' };
    const metricValue = value[metric.key] ?? 0;

    return {
      keyMetric: metric.label,
      keyMetricValue: String(metricValue),
    };
  }

  /**
   * Get human-readable department name from manager ID
   */
  private getDepartmentName(managerId: string): string {
    const nameMap: Record<string, string> = {
      [AGENT_IDS.INTELLIGENCE_MANAGER]: 'Intelligence',
      [AGENT_IDS.MARKETING_MANAGER]: 'Marketing',
      [AGENT_IDS.BUILDER_MANAGER]: 'Builder',
      [AGENT_IDS.COMMERCE_MANAGER]: 'Commerce',
      [AGENT_IDS.OUTREACH_MANAGER]: 'Outreach',
      [AGENT_IDS.CONTENT_MANAGER]: 'Content',
      [AGENT_IDS.ARCHITECT_MANAGER]: 'Architect',
      [AGENT_IDS.REVENUE_DIRECTOR]: 'Revenue',
      [AGENT_IDS.REPUTATION_MANAGER]: 'Reputation',
    };
    return nameMap[managerId] || managerId;
  }

  // ==========================================================================
  // 8b. APPROVAL GATEWAY
  // ==========================================================================

  /**
   * Queue an action for human approval
   */
  queueForApproval(
    approval: Omit<PendingApproval, 'approvalId' | 'status' | 'createdAt'>
  ): string {
    const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();

    const pendingApproval: PendingApproval = {
      ...approval,
      approvalId,
      status: 'PENDING',
      createdAt: now,
    };

    this.pendingApprovals.push(pendingApproval);

    // Write to MemoryVault for persistence
    const vault = getMemoryVault();
    vault.write('WORKFLOW', `approval_${approvalId}`, pendingApproval, 'JASPER', {
      tags: ['approval', 'pending', approval.type],
      priority: approval.urgency === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
    });

    logger.info('[JasperCommandAuthority] Approval queued', {
      approvalId,
      type: approval.type,
      urgency: approval.urgency,
      requestedBy: approval.requestedBy,
    });

    return approvalId;
  }

  /**
   * Process an approval decision
   */
  async processApproval(
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason?: string
  ): Promise<CommandResult> {
    const approval = this.pendingApprovals.find(a => a.approvalId === approvalId);

    if (!approval) {
      return {
        commandId: approvalId,
        status: 'FAILED',
        error: 'Approval not found',
      };
    }

    // Update approval status
    approval.status = decision;

    // Remove from pending queue
    this.pendingApprovals = this.pendingApprovals.filter(a => a.approvalId !== approvalId);

    // Write decision to MemoryVault
    const vault = getMemoryVault();
    vault.write('WORKFLOW', `approval_${approvalId}_decision`, {
      approvalId,
      decision,
      reason,
      processedAt: new Date(),
    }, 'JASPER', {
      tags: ['approval', 'decision', decision.toLowerCase()],
      priority: 'HIGH',
      overwrite: true,
    });

    if (decision === 'APPROVED') {
      // Send DIRECT signal to requesting manager
      const signalBus = getSignalBus();
      const message: AgentMessage = {
        id: `msg_${Date.now()}`,
        timestamp: new Date(),
        from: 'JASPER',
        to: approval.requestedBy,
        type: 'COMMAND',
        priority: 'HIGH',
        payload: {
          command: 'APPROVAL_GRANTED',
          approvalId,
          context: approval.context,
        },
        requiresResponse: false,
        traceId: `trace_${approvalId}`,
      };

      const signal = signalBus.createSignal('DIRECT', 'JASPER', approval.requestedBy, message);
      await signalBus.send(signal);

      logger.info('[JasperCommandAuthority] Approval granted', {
        approvalId,
        requestedBy: approval.requestedBy,
      });

      return {
        commandId: approvalId,
        status: 'EXECUTED',
        response: { decision, approvalId },
      };
    } else {
      // Write rejection to MemoryVault
      vault.write('WORKFLOW', `approval_${approvalId}_rejected`, {
        approvalId,
        reason,
        rejectedAt: new Date(),
      }, 'JASPER', {
        tags: ['approval', 'rejected'],
        priority: 'MEDIUM',
      });

      logger.info('[JasperCommandAuthority] Approval rejected', {
        approvalId,
        reason,
      });

      return {
        commandId: approvalId,
        status: 'EXECUTED',
        response: { decision, approvalId, reason },
      };
    }
  }

  /**
   * Get all pending approvals
   */
  getPendingApprovals(): PendingApproval[] {
    // Clean expired approvals
    const now = new Date();
    this.pendingApprovals = this.pendingApprovals.filter(approval => {
      if (approval.expiresAt && approval.expiresAt < now) {
        approval.status = 'EXPIRED';
        return false;
      }
      return approval.status === 'PENDING';
    });

    return [...this.pendingApprovals];
  }

  /**
   * Determine if an action requires approval
   */
  shouldRequireApproval(action: {
    type: string;
    confidence: number;
    recipientCount?: number;
    amount?: number;
  }): boolean {
    // Review responses (1-2 stars) → require approval
    if (action.type === 'review_response' && action.confidence < 70) {
      return true;
    }

    // Large campaigns (> 100 recipients) → require approval
    if (action.recipientCount && action.recipientCount > 100) {
      return true;
    }

    // Pricing changes → require approval
    if (action.type === 'pricing_change') {
      return true;
    }

    // Low confidence actions (< 80%) → require approval
    if (action.confidence < 80) {
      return true;
    }

    // Large amounts → require approval
    if (action.amount && action.amount > 1000) {
      return true;
    }

    return false;
  }

  // ==========================================================================
  // 8c. COMMAND AUTHORITY
  // ==========================================================================

  /**
   * Issue a command to any manager
   */
  async issueCommand(
    targetManager: string,
    command: string,
    parameters: Record<string, unknown>,
    priority: JasperCommand['priority'] = 'NORMAL'
  ): Promise<CommandResult> {
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();

    const jasperCommand: JasperCommand = {
      commandId,
      issuedAt: now,
      targetManager,
      command,
      parameters,
      priority,
      requiresConfirmation: false,
    };

    // Store in command history
    this.commandHistory.push(jasperCommand);

    // Send DIRECT signal via SignalBus
    const signalBus = getSignalBus();
    const message: AgentMessage = {
      id: `msg_${commandId}`,
      timestamp: now,
      from: 'JASPER',
      to: targetManager,
      type: 'COMMAND',
      priority: priority === 'CRITICAL' ? 'CRITICAL' : priority === 'HIGH' ? 'HIGH' : 'NORMAL',
      payload: {
        commandId,
        command,
        parameters,
      },
      requiresResponse: true,
      traceId: `trace_${commandId}`,
    };

    const signal = signalBus.createSignal('DIRECT', 'JASPER', targetManager, message);

    try {
      const reports = await signalBus.send(signal);

      // Store command in MemoryVault
      const vault = getMemoryVault();
      vault.write('WORKFLOW', `command_${commandId}`, jasperCommand, 'JASPER', {
        tags: ['command', 'issued', targetManager],
        priority: priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      });

      logger.info('[JasperCommandAuthority] Command issued', {
        commandId,
        targetManager,
        command,
        priority,
      });

      if (reports.length > 0 && reports[0].status === 'COMPLETED') {
        return {
          commandId,
          status: 'EXECUTED',
          response: reports[0].data as Record<string, unknown>,
        };
      }

      return {
        commandId,
        status: 'QUEUED',
        response: { message: 'Command queued for execution' },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('[JasperCommandAuthority] Command failed', error instanceof Error ? error : undefined, {
        commandId,
        targetManager,
        error: errorMsg,
      });

      return {
        commandId,
        status: 'FAILED',
        error: errorMsg,
      };
    }
  }

  /**
   * Override a manager's autonomous decision
   */
  async overrideAutonomousDecision(
    targetManager: string,
    overrideType: string,
    details: Record<string, unknown>
  ): Promise<CommandResult> {
    const vault = getMemoryVault();

    // Write override to MemoryVault as STRATEGY
    vault.write('STRATEGY', `override_${targetManager}_${Date.now()}`, {
      overrideType,
      details,
      issuedAt: new Date(),
    }, 'JASPER', {
      tags: ['jasper-override', overrideType, targetManager],
      priority: 'CRITICAL',
    });

    // Send DIRECT signal to target manager
    const commandResult = await this.issueCommand(
      targetManager,
      'OVERRIDE_DECISION',
      {
        overrideType,
        details,
      },
      'CRITICAL'
    );

    logger.info('[JasperCommandAuthority] Decision override issued', {
      targetManager,
      overrideType,
      commandId: commandResult.commandId,
    });

    return commandResult;
  }

  /**
   * Set a strategic objective for a manager
   */
  async setObjective(
    targetManager: string,
    objective: string,
    timeframe: string,
    target: string
  ): Promise<CommandResult> {
    const vault = getMemoryVault();

    // Write objective to MemoryVault as STRATEGY
    vault.write('STRATEGY', `objective_${targetManager}_${Date.now()}`, {
      objective,
      timeframe,
      target,
      issuedAt: new Date(),
    }, 'JASPER', {
      tags: ['quarterly-objective', targetManager],
      priority: 'HIGH',
    });

    // Send DIRECT signal to target manager
    const commandResult = await this.issueCommand(
      targetManager,
      'SET_OBJECTIVE',
      {
        objective,
        timeframe,
        target,
      },
      'HIGH'
    );

    logger.info('[JasperCommandAuthority] Objective set', {
      targetManager,
      objective,
      timeframe,
      target,
      commandId: commandResult.commandId,
    });

    return commandResult;
  }

  /**
   * Get recent command history
   */
  getCommandHistory(limit = 50): JasperCommand[] {
    return this.commandHistory.slice(-limit);
  }
}

// ============================================================================
// SINGLETON MANAGEMENT
// ============================================================================

let instance: JasperCommandAuthority | null = null;

export function getJasperCommandAuthority(): JasperCommandAuthority {
  instance ??= new JasperCommandAuthority();
  return instance;
}

export function resetJasperCommandAuthority(): void {
  instance = null;
  logger.info('[JasperCommandAuthority] Instance reset');
}
