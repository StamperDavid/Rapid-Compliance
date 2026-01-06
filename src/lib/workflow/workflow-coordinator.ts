/**
 * Workflow Coordinator - Signal Bus Integration
 * 
 * SOVEREIGN CORPORATE BRAIN - EVENT-DRIVEN AUTOMATION
 * 
 * This coordinator connects workflows to the Signal Bus, enabling
 * real-time, event-driven automation across the sales process.
 * 
 * CAPABILITIES:
 * - Listens to Signal Bus for deal events
 * - Matches events to workflow triggers
 * - Executes workflows automatically
 * - Tracks workflow executions
 * - Manages workflow lifecycle
 * 
 * SIGNAL TYPES MONITORED:
 * - deal.scored - Deal score calculated/changed
 * - deal.tier.changed - Deal tier changed (hot/warm/cold/at-risk)
 * - deal.stage.changed - Deal moved to new stage
 * - deal.risk.detected - Risk factor identified
 * - deal.health.updated - Deal health score updated
 * 
 * INTEGRATION:
 * - Signal Bus for event detection
 * - Workflow Engine for execution
 * - Firestore for workflow storage
 * - DAL for data access
 */

import { logger } from '@/lib/logger/logger';
import { Timestamp } from 'firebase-admin/firestore';
import type { SalesSignal, SignalType } from '@/lib/orchestration/types';
import { WorkflowEngine, type WorkflowExecutionContext } from './workflow-engine';
import type {
  Workflow,
  WorkflowExecution,
  WorkflowTriggerType,
  WorkflowExecutionStatus,
} from './types';
import type { DealScore } from '@/lib/templates/deal-scoring-engine';
import type { BaseAgentDAL } from '@/lib/dal/BaseAgentDAL';

// ============================================================================
// WORKFLOW COORDINATOR
// ============================================================================

/**
 * Workflow Coordinator Configuration
 */
export interface WorkflowCoordinatorConfig {
  /**
   * Maximum concurrent workflow executions
   * Prevents overwhelming the system
   */
  maxConcurrentExecutions?: number;
  
  /**
   * Whether to execute workflows for test/development deals
   */
  executeForTestDeals?: boolean;
  
  /**
   * Dry run mode - evaluate triggers but don't execute actions
   */
  dryRun?: boolean;
}

/**
 * Workflow Coordinator
 * 
 * Orchestrates workflow executions based on Signal Bus events
 */
export class WorkflowCoordinator {
  private dal: BaseAgentDAL;
  private config: Required<WorkflowCoordinatorConfig>;
  private activeExecutions: Set<string> = new Set();
  
  constructor(
    dalInstance: BaseAgentDAL,
    config?: WorkflowCoordinatorConfig
  ) {
    this.dal = dalInstance;
    this.config = {
      maxConcurrentExecutions: config?.maxConcurrentExecutions ?? 10,
      executeForTestDeals: config?.executeForTestDeals ?? false,
      dryRun: config?.dryRun ?? false,
    };
    
    logger.info('WorkflowCoordinator initialized', {
      config: this.config,
    });
  }
  
  /**
   * Handle Signal Bus event
   * 
   * This is called by the Signal Bus when a relevant event occurs
   * 
   * @param signal - Signal from Signal Bus
   */
  async handleSignal(signal: SalesSignal): Promise<void> {
    try {
      logger.debug('Processing signal for workflows', {
        signalId: signal.id,
        signalType: signal.type,
        orgId: signal.orgId,
        dealId: (signal.metadata.dealId as string) || undefined,
      });
      
      // Map signal type to workflow trigger types
      const triggerTypes = this.mapSignalToTriggerTypes(signal.type);
      
      if (triggerTypes.length === 0) {
        logger.debug('Signal type not mapped to any workflow triggers', {
          signalType: signal.type,
        });
        return;
      }
      
      // Find workflows that match this trigger type
      const workflows = await this.findMatchingWorkflows(
        signal.orgId,
        signal.workspaceId || 'default',
        triggerTypes
      );
      
      if (workflows.length === 0) {
        logger.debug('No workflows found for trigger types', {
          triggerTypes,
          orgId: signal.orgId,
        });
        return;
      }
      
      logger.info('Found matching workflows for signal', {
        signalType: signal.type,
        workflowCount: workflows.length,
        workflowIds: workflows.map((w) => w.id),
      });
      
      // Build execution context from signal
      const context = this.buildExecutionContext(signal);
      
      // Execute each matching workflow
      for (const workflow of workflows) {
        await this.executeWorkflowFromSignal(workflow, context, signal);
      }
      
    } catch (error) {
      logger.error('Failed to handle signal for workflows', {
        error,
        signalId: signal.id,
        signalType: signal.type,
      });
    }
  }
  
  /**
   * Map Signal Bus signal type to workflow trigger types
   */
  private mapSignalToTriggerTypes(signalType: SignalType): WorkflowTriggerType[] {
    const mapping: Record<SignalType, WorkflowTriggerType[]> = {
      // Deal scoring signals
      'deal.scored': [
        'deal.score.changed',
        'deal.score.increased',
        'deal.score.decreased',
      ],
      'deal.tier.changed': [
        'deal.tier.changed',
        'deal.at_risk.detected',
        'deal.hot.detected',
      ],
      'deal.risk.detected': [
        'deal.risk.critical',
        'deal.risk.high',
      ],
      'deal.risk.critical': [
        'deal.risk.critical',
      ],
      'deal.risk.high': [
        'deal.risk.high',
      ],
      
      // Deal stage signals
      'deal.stage.changed': [
        'deal.stage.changed',
        'deal.stage.regressed',
      ],
      
      // Deal health signals
      'deal.health.updated': [
        'deal.score.changed',
        'deal.activity.low',
        'deal.activity.high',
      ],
      
      // Default: no mapping
      'lead.discovered': [],
      'lead.qualified': [],
      'lead.engaged': [],
      'lead.intent.high': [],
      'lead.intent.low': [],
      'lead.status.changed': [],
      'website.discovered': [],
      'website.updated': [],
      'website.technology.detected': [],
      'website.competitor.detected': [],
      'competitor.discovered': [],
      'competitor.updated': [],
      'competitor.weakness.detected': [],
      'battlecard.generated': [],
      'battlecard.updated': [],
      'email.opened': [],
      'email.clicked': [],
      'email.bounced': [],
      'email.replied': [],
      'email.generated': [],
      'email.sent': [],
      'email.delivery.failed': [],
      'email.variant.created': [],
      'sequence.started': [],
      'sequence.completed': [],
      'sequence.paused': [],
      'sequence.failed': [],
      'deal.created': [],
      'deal.won': [],
      'deal.lost': [],
      'deal.recommendations.generated': [],
      'deal.action.recommended': [],
      'onboarding.started': [],
      'onboarding.prefilled': [],
      'onboarding.completed': [],
      'onboarding.abandoned': [],
      'template.applied': [],
      'template.customized': [],
      'template.validation.failed': [],
      'forecast.updated': [],
      'quota.at_risk': [],
      'quota.achieved': [],
      'conversation.analyzed': [],
      'conversation.low_score': [],
      'conversation.red_flag': [],
      'conversation.coaching_needed': [],
      'conversation.competitor_mentioned': [],
      'conversation.objection_raised': [],
      'conversation.positive_signal': [],
      'conversation.follow_up_required': [],
      'conversation.sentiment_negative': [],
      'performance.analyzed': [],
      'performance.top_performer_identified': [],
      'performance.improvement_opportunity': [],
      'performance.coaching_priority_created': [],
      'performance.best_practice_extracted': [],
      'performance.trend_detected': [],
      'performance.leaderboard_updated': [],
      'performance.benchmark_changed': [],
      'performance.alert_triggered': [],
      'playbook.generated': [],
      'playbook.patterns_extracted': [],
      'playbook.activated': [],
      'playbook.used': [],
      'playbook.updated': [],
      'playbook.adoption_tracked': [],
      'playbook.effectiveness_measured': [],
      'playbook.archived': [],
      'playbook.pattern_identified': [],
      'sequence.analyzed': [],
      'sequence.pattern_detected': [],
      'sequence.underperforming': [],
      'sequence.optimization_needed': [],
      'sequence.optimal_timing_found': [],
      'sequence.ab_test_completed': [],
      'sequence.performance_decline': [],
      'sequence.best_practice_found': [],
      'sequence.metrics_updated': [],
      'coaching.insights.generated': [],
      'lead.routed': [],
      'workflow.executed': [],
      'slack.connected': [],
      'slack.disconnected': [],
      'slack.message.sent': [],
      'slack.message.failed': [],
      'slack.rate_limited': [],
      'system.error': [],
      'system.quota.warning': [],
      'system.quota.exceeded': [],
      'custom': [],
    };
    
    return mapping[signalType] || [];
  }
  
  /**
   * Build execution context from signal
   */
  private buildExecutionContext(signal: SalesSignal): WorkflowExecutionContext {
    const metadata = signal.metadata;
    
    // Extract deal score if present
    let dealScore: DealScore | undefined;
    if (metadata.score !== undefined) {
      dealScore = {
        dealId: (metadata.dealId as string) || '',
        score: metadata.score as number,
        closeProbability: (metadata.closeProbability as number) || 0,
        tier: (metadata.tier as 'hot' | 'warm' | 'cold' | 'at-risk') || 'warm',
        confidence: signal.confidence * 100,
        factors: [],
        riskFactors: [],
        recommendations: [],
        predictedCloseDate: metadata.predictedCloseDate ? new Date(metadata.predictedCloseDate as string) : null,
        predictedValue: (metadata.predictedValue as number) || 0,
        calculatedAt: new Date(),
      };
    }
    
    // Extract previous deal score if present
    let previousDealScore: DealScore | undefined;
    if (metadata.previousScore !== undefined) {
      previousDealScore = {
        dealId: (metadata.dealId as string) || '',
        score: metadata.previousScore as number,
        closeProbability: (metadata.previousCloseProbability as number) || 0,
        tier: (metadata.previousTier as 'hot' | 'warm' | 'cold' | 'at-risk') || 'warm',
        confidence: signal.confidence * 100,
        factors: [],
        riskFactors: [],
        recommendations: [],
        predictedCloseDate: null,
        predictedValue: 0,
        calculatedAt: new Date(),
      };
    }
    
    return {
      organizationId: signal.orgId,
      workspaceId: signal.workspaceId || 'default',
      dealId: (metadata.dealId as string) || undefined,
      deal: (metadata.deal as Record<string, unknown>) || undefined,
      dealScore,
      previousDealScore,
      triggeredBy: 'event',
      triggerData: {
        signal: signal.type,
        signalId: signal.id,
        signalMetadata: metadata,
        timestamp: signal.createdAt.toDate().toISOString(),
      },
    };
  }
  
  /**
   * Find workflows that match the trigger types
   */
  private async findMatchingWorkflows(
    organizationId: string,
    workspaceId: string,
    triggerTypes: WorkflowTriggerType[]
  ): Promise<Workflow[]> {
    try {
      // Get workflows collection
      const workflowsCollection = this.dal.getOrgSubCollection(
        organizationId,
        'workflows'
      );
      
      // In production, this would query Firestore with proper filters
      // For now, return empty array (workflows will be stored/retrieved in API layer)
      logger.debug('Querying workflows', {
        organizationId,
        workspaceId,
        triggerTypes,
      });
      
      // TODO: Implement Firestore query when workflows are stored
      // const q = query(
      //   workflowsCollection,
      //   where('status', '==', 'active'),
      //   where('trigger.type', 'in', triggerTypes)
      // );
      // const snapshot = await getDocs(q);
      // return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workflow));
      
      return [];
      
    } catch (error) {
      logger.error('Failed to find matching workflows', {
        error,
        organizationId,
        triggerTypes,
      });
      return [];
    }
  }
  
  /**
   * Execute workflow from signal
   */
  private async executeWorkflowFromSignal(
    workflow: Workflow,
    context: WorkflowExecutionContext,
    signal: SalesSignal
  ): Promise<void> {
    try {
      // Check concurrent execution limit
      if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
        logger.warn('Max concurrent executions reached, skipping workflow', {
          workflowId: workflow.id,
          activeExecutions: this.activeExecutions.size,
          maxConcurrentExecutions: this.config.maxConcurrentExecutions,
        });
        return;
      }
      
      // Check workflow settings
      if (!this.shouldExecuteWorkflow(workflow, context)) {
        logger.debug('Workflow execution skipped due to settings', {
          workflowId: workflow.id,
          workflowName: workflow.name,
        });
        return;
      }
      
      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      this.activeExecutions.add(executionId);
      
      try {
        // Execute workflow
        logger.info('Executing workflow from signal', {
          workflowId: workflow.id,
          workflowName: workflow.name,
          executionId,
          signalType: signal.type,
          dealId: context.dealId,
        });
        
        if (this.config.dryRun) {
          logger.info('[DRY RUN] Would execute workflow', {
            workflowId: workflow.id,
            context,
          });
          return;
        }
        
        const result = await WorkflowEngine.executeWorkflow(workflow, context);
        
        // Save execution record
        await this.saveExecutionRecord(workflow, context, result, executionId);
        
        // Update workflow stats
        await this.updateWorkflowStats(workflow, result);
        
        logger.info('Workflow execution completed from signal', {
          workflowId: workflow.id,
          executionId,
          success: result.success,
          actionsExecuted: result.actionsExecuted.length,
          durationMs: result.durationMs,
        });
        
      } finally {
        this.activeExecutions.delete(executionId);
      }
      
    } catch (error) {
      logger.error('Failed to execute workflow from signal', {
        error,
        workflowId: workflow.id,
        signalType: signal.type,
      });
    }
  }
  
  /**
   * Check if workflow should execute based on settings
   */
  private shouldExecuteWorkflow(
    workflow: Workflow,
    context: WorkflowExecutionContext
  ): boolean {
    const { settings } = workflow;
    
    // Check if execution on weekends is disabled
    if (settings.executeOnWeekends === false) {
      const day = new Date().getDay();
      if (day === 0 || day === 6) {
        logger.debug('Workflow skipped - weekends disabled', {
          workflowId: workflow.id,
        });
        return false;
      }
    }
    
    // Check cooldown period
    if (settings.cooldownMinutes && workflow.stats.lastExecutedAt) {
      const lastExecuted = workflow.stats.lastExecutedAt.toMillis();
      const cooldownMs = settings.cooldownMinutes * 60 * 1000;
      const elapsed = Date.now() - lastExecuted;
      
      if (elapsed < cooldownMs) {
        logger.debug('Workflow skipped - in cooldown period', {
          workflowId: workflow.id,
          cooldownMinutes: settings.cooldownMinutes,
          elapsedMinutes: Math.round(elapsed / 60000),
        });
        return false;
      }
    }
    
    // Check daily execution limit
    if (settings.maxExecutionsPerDay) {
      // In production, this would check today's execution count from Firestore
      // For now, we'll allow it
      logger.debug('Daily execution limit check skipped (TODO: implement)', {
        workflowId: workflow.id,
      });
    }
    
    return true;
  }
  
  /**
   * Save workflow execution record
   */
  private async saveExecutionRecord(
    workflow: Workflow,
    context: WorkflowExecutionContext,
    result: Awaited<ReturnType<typeof WorkflowEngine.executeWorkflow>>,
    executionId: string
  ): Promise<void> {
    try {
      const execution: WorkflowExecution = {
        id: executionId,
        workflowId: workflow.id,
        organizationId: context.organizationId,
        workspaceId: context.workspaceId,
        dealId: context.dealId,
        triggeredBy: context.triggeredBy,
        triggerData: context.triggerData,
        status: result.success ? 'completed' : 'failed',
        startedAt: Timestamp.fromDate(result.startedAt),
        completedAt: result.completedAt ? Timestamp.fromDate(result.completedAt) : undefined,
        durationMs: result.durationMs,
        actionsExecuted: result.actionsExecuted,
        error: result.error,
        errorStack: result.errorStack,
      };
      
      // Save to Firestore
      const executionsPath = `${this.dal.getColPath('organizations')}/${context.organizationId}/${this.dal.getSubColPath('workflow_executions')}`;
      
      await this.dal.safeSetDoc(
        executionsPath,
        executionId,
        execution
      );
      
      logger.debug('Workflow execution record saved', {
        executionId,
        workflowId: workflow.id,
      });
      
    } catch (error) {
      logger.error('Failed to save workflow execution record', {
        error,
        executionId,
        workflowId: workflow.id,
      });
    }
  }
  
  /**
   * Update workflow statistics
   */
  private async updateWorkflowStats(
    workflow: Workflow,
    result: Awaited<ReturnType<typeof WorkflowEngine.executeWorkflow>>
  ): Promise<void> {
    try {
      const stats = {
        totalExecutions: workflow.stats.totalExecutions + 1,
        successfulExecutions: workflow.stats.successfulExecutions + (result.success ? 1 : 0),
        failedExecutions: workflow.stats.failedExecutions + (result.success ? 0 : 1),
        lastExecutedAt: Timestamp.now(),
      };
      
      if (result.success) {
        stats['lastSuccessAt'] = Timestamp.now();
      } else {
        stats['lastFailureAt'] = Timestamp.now();
      }
      
      // Update average execution time
      const totalTime = workflow.stats.averageExecutionTimeMs * workflow.stats.totalExecutions;
      const newAverage = (totalTime + (result.durationMs || 0)) / (workflow.stats.totalExecutions + 1);
      stats['averageExecutionTimeMs'] = Math.round(newAverage);
      
      // Update workflow in Firestore
      const workflowsPath = `${this.dal.getColPath('organizations')}/${workflow.organizationId}/${this.dal.getSubColPath('workflows')}`;
      
      await this.dal.safeUpdateDoc(
        workflowsPath,
        workflow.id,
        { stats }
      );
      
      logger.debug('Workflow stats updated', {
        workflowId: workflow.id,
        stats,
      });
      
    } catch (error) {
      logger.error('Failed to update workflow stats', {
        error,
        workflowId: workflow.id,
      });
    }
  }
  
  /**
   * Execute workflow manually
   * 
   * @param workflowId - Workflow ID
   * @param context - Execution context
   * @returns Execution result
   */
  async executeWorkflowManually(
    workflowId: string,
    context: WorkflowExecutionContext
  ): Promise<Awaited<ReturnType<typeof WorkflowEngine.executeWorkflow>>> {
    logger.info('Executing workflow manually', {
      workflowId,
      organizationId: context.organizationId,
      dealId: context.dealId,
    });
    
    // Fetch workflow
    const workflowsPath = `${this.dal.getColPath('organizations')}/${context.organizationId}/${this.dal.getSubColPath('workflows')}`;
    
    const workflowSnap = await this.dal.safeGetDoc<Workflow>(
      workflowsPath,
      workflowId
    );
    
    if (!workflowSnap.exists()) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    const workflow = { ...workflowSnap.data(), id: workflowId } as Workflow;
    
    // Execute
    const result = await WorkflowEngine.executeWorkflow(workflow, context);
    
    // Save execution record
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await this.saveExecutionRecord(workflow, context, result, executionId);
    
    // Update stats
    await this.updateWorkflowStats(workflow, result);
    
    return result;
  }
}

export default WorkflowCoordinator;
