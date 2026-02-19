/**
 * Workflow Automation Engine
 * 
 * SOVEREIGN CORPORATE BRAIN - INTELLIGENT AUTOMATION CORE
 * 
 * This engine powers intelligent, event-driven sales automation by:
 * - Evaluating triggers against deal events
 * - Executing automated actions when triggers match
 * - Tracking execution history and performance
 * - Integrating with Signal Bus for real-time reactivity
 * 
 * CAPABILITIES:
 * - Multi-step workflows with conditional logic
 * - Retry logic with exponential backoff
 * - Rate limiting and cooldown periods
 * - Comprehensive execution tracking
 * - Error handling and rollback
 * 
 * INTEGRATION:
 * - Signal Bus for event detection
 * - Deal Scoring for intelligent triggers
 * - Email Writer for automated outreach
 * - Firestore for persistence
 */

import { logger } from '@/lib/logger/logger';
import { Timestamp } from 'firebase/firestore';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { NotificationService } from '@/lib/notifications/notification-service';
import type {
  Workflow,
  WorkflowAction,
  TriggerCondition,
  ActionExecutionResult,
  EmailActionConfig,
  TaskActionConfig,
  DealActionConfig,
  NotificationActionConfig,
  WaitActionConfig,
} from './types';
import type { DealScore } from '@/lib/templates/deal-scoring-engine';

// ============================================================================
// WORKFLOW ENGINE
// ============================================================================

/**
 * Workflow execution context
 *
 * Provides all data needed for trigger evaluation and action execution
 */
export interface WorkflowExecutionContext {
  dealId?: string;
  deal?: Record<string, unknown>;
  dealScore?: DealScore;
  previousDealScore?: DealScore;
  triggeredBy: 'event' | 'schedule' | 'manual';
  triggerData: Record<string, unknown>;
  userId?: string;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  success: boolean;
  executionId?: string;
  workflow: Workflow;
  context: WorkflowExecutionContext;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  actionsExecuted: ActionExecutionResult[];
  error?: string;
  errorStack?: string;
}

/**
 * Workflow Engine
 * 
 * Core engine for evaluating and executing workflows
 */
export class WorkflowEngine {
  /**
   * Evaluate if a workflow trigger matches the current context
   * 
   * @param workflow - Workflow to evaluate
   * @param context - Execution context
   * @returns True if trigger matches, false otherwise
   */
  static evaluateTrigger(
    workflow: Workflow,
    context: WorkflowExecutionContext
  ): boolean {
    const { trigger } = workflow;
    const { conditions, conditionLogic } = trigger;
    
    logger.debug('Evaluating workflow trigger', {
      workflowId: workflow.id,
      triggerType: trigger.type,
      conditionsCount: conditions.length,
      conditionLogic,
    });
    
    // If no conditions, trigger always matches
    if (conditions.length === 0) {
      return true;
    }
    
    // Evaluate each condition
    const conditionResults = conditions.map((condition) =>
      this.evaluateCondition(condition, context)
    );
    
    // Apply logic (AND/OR)
    const triggerMatches =
      conditionLogic === 'AND'
        ? conditionResults.every((result) => result)
        : conditionResults.some((result) => result);
    
    logger.debug('Trigger evaluation result', {
      workflowId: workflow.id,
      triggerMatches,
      conditionResults: conditionResults.toString(),
    });
    
    return triggerMatches;
  }
  
  /**
   * Evaluate a single trigger condition
   * 
   * @param condition - Condition to evaluate
   * @param context - Execution context
   * @returns True if condition matches, false otherwise
   */
  static evaluateCondition(
    condition: TriggerCondition,
    context: WorkflowExecutionContext
  ): boolean {
    const { field, operator, value } = condition;
    
    // Get field value from context
    const fieldValue = this.getFieldValue(field, context);
    
    // Evaluate based on operator
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      
      case 'not_equals':
        return fieldValue !== value;
      
      case 'greater_than':
        return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value;
      
      case 'less_than':
        return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value;
      
      case 'greater_than_or_equal':
        return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue >= value;
      
      case 'less_than_or_equal':
        return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue <= value;
      
      case 'contains':
        return typeof fieldValue === 'string' && typeof value === 'string' && fieldValue.includes(value);
      
      case 'not_contains':
        return typeof fieldValue === 'string' && typeof value === 'string' && !fieldValue.includes(value);
      
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue as string);
      
      case 'not_in':
        return Array.isArray(value) && !value.includes(fieldValue as string);
      
      case 'is_null':
        return fieldValue === null || fieldValue === undefined;
      
      case 'is_not_null':
        return fieldValue !== null && fieldValue !== undefined;
      
      case 'changed_from':
        return this.getPreviousFieldValue(field, context) === value && fieldValue !== value;
      
      case 'changed_to':
        return fieldValue === value && this.getPreviousFieldValue(field, context) !== value;
      
      default:
        logger.warn('Unknown trigger operator', { operator });
        return false;
    }
  }
  
  /**
   * Get field value from execution context
   * 
   * Supports nested field access with dot notation (e.g., 'dealScore.score')
   */
  static getFieldValue(
    field: string,
    context: WorkflowExecutionContext
  ): unknown {
    const parts = field.split('.');
    let value: unknown = context;
    
    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      
      if (typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
  
  /**
   * Get previous field value (for changed_from/changed_to operators)
   */
  static getPreviousFieldValue(
    field: string,
    context: WorkflowExecutionContext
  ): unknown {
    // For deal score changes, use previousDealScore
    if (field.startsWith('dealScore.') && context.previousDealScore) {
      const scorePart = field.replace('dealScore.', '');
      return (context.previousDealScore as unknown as Record<string, unknown>)[scorePart];
    }
    
    // For other fields, check triggerData.previous
    const previousData = context.triggerData.previous as Record<string, unknown> | undefined;
    if (previousData) {
      const parts = field.split('.');
      let value: unknown = previousData;
      
      for (const part of parts) {
        if (value === null || value === undefined) {
          return undefined;
        }
        
        if (typeof value === 'object' && part in value) {
          value = (value as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }
      
      return value;
    }
    
    return undefined;
  }
  
  /**
   * Execute a workflow
   * 
   * @param workflow - Workflow to execute
   * @param context - Execution context
   * @returns Execution result
   */
  static async executeWorkflow(
    workflow: Workflow,
    context: WorkflowExecutionContext
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    
    logger.info('Executing workflow', {
      workflowId: workflow.id,
      workflowName: workflow.name,
      dealId: context.dealId,
      triggeredBy: context.triggeredBy,
    });
    
    const actionsExecuted: ActionExecutionResult[] = [];
    
    try {
      // Check if workflow is active
      if (workflow.status !== 'active') {
        throw new Error(`Workflow is not active (status: ${workflow.status})`);
      }
      
      // Evaluate trigger
      const triggerMatches = this.evaluateTrigger(workflow, context);
      
      if (!triggerMatches) {
        logger.info('Workflow trigger did not match', {
          workflowId: workflow.id,
          triggerType: workflow.trigger.type,
        });
        
        return {
          success: false,
          workflow,
          context,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          actionsExecuted,
          error: 'Trigger conditions not met',
        };
      }
      
      // Sort actions by order
      const sortedActions = [...workflow.actions].sort((a, b) => a.order - b.order);
      
      // Execute actions in sequence
      for (const action of sortedActions) {
        const actionResult = await this.executeAction(action, context, workflow);
        actionsExecuted.push(actionResult);
        
        // Stop execution if action failed and continueOnError is false
        if (actionResult.status === 'failed' && !action.continueOnError) {
          logger.warn('Workflow execution stopped due to action failure', {
            workflowId: workflow.id,
            actionId: action.id,
            actionType: action.type,
            error: actionResult.error,
          });
          
          break;
        }
      }
      
      const duration = Date.now() - startTime;
      const success = actionsExecuted.every((result) => result.status === 'success');
      
      logger.info('Workflow execution completed', {
        workflowId: workflow.id,
        success,
        actionsExecuted: actionsExecuted.length,
        durationMs: duration,
      });
      
      return {
        success,
        workflow,
        context,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs: duration,
        actionsExecuted,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Workflow execution failed', error instanceof Error ? error : new Error(String(error)), {
        workflowId: workflow.id,
        durationMs: duration,
      });
      
      return {
        success: false,
        workflow,
        context,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs: duration,
        actionsExecuted,
        error: errorMessage,
        errorStack,
      };
    }
  }
  
  /**
   * Execute a single action
   * 
   * @param action - Action to execute
   * @param context - Execution context
   * @param workflow - Parent workflow
   * @returns Action execution result
   */
  static async executeAction(
    action: WorkflowAction,
    context: WorkflowExecutionContext,
    workflow: Workflow
  ): Promise<ActionExecutionResult> {
    const startTime = Date.now();
    
    logger.debug('Executing workflow action', {
      workflowId: workflow.id,
      actionId: action.id,
      actionType: action.type,
      actionName: action.name,
    });
    
    try {
      // Execute action based on type
      let result: Record<string, unknown> = {};
      
      switch (action.type) {
        case 'email.send':
        case 'email.generate':
          result = await this.executeEmailAction(action, context);
          break;
        
        case 'task.create':
          result = await this.executeTaskAction(action, context);
          break;
        
        case 'deal.update':
        case 'deal.stage.change':
        case 'deal.tag.add':
        case 'deal.tag.remove':
          result = await this.executeDealAction(action, context);
          break;
        
        case 'notification.send':
        case 'notification.slack':
        case 'notification.email':
          result = await this.executeNotificationAction(action, context);
          break;
        
        case 'wait.delay':
        case 'wait.until':
          result = await this.executeWaitAction(action, context);
          break;
        
        default:
          throw new Error(`Unsupported action type: ${action.type}`);
      }
      
      const duration = Date.now() - startTime;
      
      logger.debug('Action executed successfully', {
        workflowId: workflow.id,
        actionId: action.id,
        actionType: action.type,
        durationMs: duration,
      });
      
      return {
        actionId: action.id,
        actionType: action.type,
        status: 'success',
        startedAt: Timestamp.fromDate(new Date(startTime)),
        completedAt: Timestamp.now(),
        durationMs: duration,
        result,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Action execution failed', error instanceof Error ? error : new Error(String(error)), {
        workflowId: workflow.id,
        actionId: action.id,
        actionType: action.type,
        durationMs: duration,
      });
      
      // Retry if configured
      if (action.retry && action.retry.maxAttempts > 1) {
        return this.executeActionWithRetry(action, context, workflow);
      }
      
      return {
        actionId: action.id,
        actionType: action.type,
        status: 'failed',
        startedAt: Timestamp.fromDate(new Date(startTime)),
        completedAt: Timestamp.now(),
        durationMs: duration,
        error: errorMessage,
      };
    }
  }
  
  /**
   * Execute action with retry logic
   */
  static async executeActionWithRetry(
    action: WorkflowAction,
    context: WorkflowExecutionContext,
    workflow: Workflow
  ): Promise<ActionExecutionResult> {
    const retry = action.retry;
    if (!retry) {
      // No retry config - return a failed result
      return {
        actionId: action.id,
        actionType: action.type,
        status: 'failed',
        startedAt: Timestamp.now(),
        completedAt: Timestamp.now(),
        durationMs: 0,
        error: 'Retry configuration missing',
      };
    }
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < retry.maxAttempts; attempt++) {
      try {
        logger.info('Retrying action execution', {
          workflowId: workflow.id,
          actionId: action.id,
          attempt: attempt + 1,
          maxAttempts: retry.maxAttempts,
        });

        // Wait before retry (with exponential backoff)
        if (attempt > 0) {
          const backoff = retry.backoffMultiplier ?? 1;
          const delay = retry.delayMs * Math.pow(backoff, attempt - 1);
          await new Promise<void>((resolve) => { setTimeout(resolve, delay); });
        }
        
        return await this.executeAction(action, context, workflow);
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn('Action retry failed', {
          workflowId: workflow.id,
          actionId: action.id,
          attempt: attempt + 1,
          error: lastError.message,
        });
      }
    }
    
    // All retries failed
    return {
      actionId: action.id,
      actionType: action.type,
      status: 'failed',
      startedAt: Timestamp.now(),
      completedAt: Timestamp.now(),
      durationMs: 0,
      error: (() => { const v = lastError?.message; return (v !== '' && v != null) ? v : 'All retry attempts failed'; })(),
      retryCount: retry.maxAttempts,
    };
  }
  
  // ============================================================================
  // ACTION HANDLERS (Implementations)
  // ============================================================================
  
  /**
   * Execute email action
   */
  static async executeEmailAction(
    action: WorkflowAction,
    context: WorkflowExecutionContext
  ): Promise<Record<string, unknown>> {
    // Import dynamically to avoid circular dependencies
    const { generateSalesEmail } = await import('@/lib/email-writer/email-writer-engine');

    const config = action.config as EmailActionConfig;
    
    // Resolve recipient
    const recipientEmail = config.recipientEmail ?? 
      this.getFieldValue((config.recipientField ?? 'deal.contactEmail'), context) as string;
    
    if (!recipientEmail) {
      throw new Error('No recipient email found');
    }
    
    // Generate email
    const result = await generateSalesEmail({
      userId:(context.userId !== '' && context.userId != null) ? context.userId : 'workflow-engine',
      emailType: config.emailType,
      dealId: context.dealId ?? '',
      dealScore: context.dealScore,
      recipientEmail,
      recipientName: this.getFieldValue('deal.contactName', context) as string,
      recipientTitle: this.getFieldValue('deal.contactTitle', context) as string,
      companyName: this.getFieldValue('deal.companyName', context) as string,
      tone: config.tone,
      length: config.length,
      includeCompetitive: config.includeCompetitive,
      includeSocialProof: config.includeSocialProof,
      customInstructions: config.customInstructions,
    });
    
    if (!result.success) {
      throw new Error((result.error !== '' && result.error != null) ? result.error : 'Email generation failed');
    }
    
    return {
      emailId: result.email?.id,
      subject: result.email?.subject,
      emailType: config.emailType,
      autoSent: config.autoSend ?? false,
    };
  }
  
  /**
   * Execute task action — creates a task in Firestore
   */
  static async executeTaskAction(
    action: WorkflowAction,
    context: WorkflowExecutionContext
  ): Promise<Record<string, unknown>> {
    const config = action.config as TaskActionConfig;

    // Resolve assignee
    const assignToUserId = config.assignToUserId ??
      this.getFieldValue((config.assignToField ?? 'deal.ownerId'), context) as string;

    if (!assignToUserId) {
      throw new Error('No assignee found for task');
    }

    // Calculate due date
    const dueDate = config.dueInDays
      ? new Date(Date.now() + config.dueInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const taskRecord = {
      id: taskId,
      title: config.title,
      assignedTo: assignToUserId,
      dealId: context.dealId ?? null,
      dueDate: dueDate?.toISOString() ?? null,
      priority: config.priority ?? 'medium',
      status: 'pending',
      source: 'workflow',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await FirestoreService.set(
      getSubCollection('tasks'),
      taskId,
      taskRecord
    );

    logger.info('Workflow created task', {
      taskId,
      title: config.title,
      assignToUserId,
      dealId: context.dealId,
    });

    return taskRecord;
  }
  
  /**
   * Execute deal action — updates deal fields in Firestore
   */
  static async executeDealAction(
    action: WorkflowAction,
    context: WorkflowExecutionContext
  ): Promise<Record<string, unknown>> {
    const config = action.config as DealActionConfig;

    if (!context.dealId) {
      throw new Error('No deal ID in context for deal action');
    }

    const operation = config.operation ?? 'set';
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (operation === 'set') {
      updateData[config.field] = config.value;
    } else if (operation === 'increment' && typeof config.value === 'number') {
      // Read current value and increment
      const deal = await FirestoreService.get<Record<string, unknown>>(
        getSubCollection('deals'),
        context.dealId
      );
      const currentValue = typeof deal?.[config.field] === 'number' ? (deal[config.field] as number) : 0;
      updateData[config.field] = currentValue + config.value;
    } else {
      updateData[config.field] = config.value;
    }

    await FirestoreService.update(
      getSubCollection('deals'),
      context.dealId,
      updateData
    );

    logger.info('Workflow updated deal', {
      dealId: context.dealId,
      field: config.field,
      operation,
    });

    return {
      dealId: context.dealId,
      field: config.field,
      value: config.value,
      operation,
      updatedAt: updateData.updatedAt,
    };
  }
  
  /**
   * Execute notification action — sends via NotificationService
   */
  static async executeNotificationAction(
    action: WorkflowAction,
    context: WorkflowExecutionContext
  ): Promise<Record<string, unknown>> {
    const config = action.config as NotificationActionConfig;

    // Resolve recipient
    const recipientId = config.recipientId ??
      this.getFieldValue((config.recipientField ?? 'deal.ownerId'), context) as string;

    if (!recipientId) {
      throw new Error('No recipient found for notification');
    }

    const notificationService = new NotificationService();
    const notification = await notificationService.sendNotification(
      recipientId,
      'workflow_notification',
      {
        title: config.title ?? 'Workflow Notification',
        message: config.message,
        dealId: context.dealId ?? '',
        channel: config.channel,
      },
      {
        channels: config.channel ? [config.channel as 'in_app' | 'email' | 'slack' | 'webhook' | 'sms'] : undefined,
      }
    );

    logger.info('Workflow sent notification', {
      notificationId: notification.id,
      channel: config.channel,
      recipientId,
      dealId: context.dealId,
    });

    return {
      notificationId: notification.id,
      channel: config.channel,
      recipientId,
      title: config.title,
      message: config.message,
      sentAt: new Date().toISOString(),
    };
  }
  
  /**
   * Execute wait action — persists scheduled wait to Firestore for cron-based resumption
   */
  static async executeWaitAction(
    action: WorkflowAction,
    _context: WorkflowExecutionContext
  ): Promise<Record<string, unknown>> {
    const config = action.config as WaitActionConfig;

    const waitId = `wait_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (config.type === 'delay') {
      const delayMs = (config.delayHours ?? 0) * 60 * 60 * 1000 +
                     (config.delayDays ?? 0) * 24 * 60 * 60 * 1000;
      const resumeAt = new Date(Date.now() + delayMs).toISOString();

      // Persist scheduled wait so a cron job can resume it
      await FirestoreService.set(
        getSubCollection('workflowWaits'),
        waitId,
        {
          id: waitId,
          workflowId: action.id,
          dealId: _context.dealId ?? null,
          waitType: 'delay',
          delayMs,
          resumeAt,
          status: 'waiting',
          createdAt: new Date().toISOString(),
        }
      );

      logger.info('Wait action scheduled', { waitId, delayMs, resumeAt });

      return { waitType: 'delay', waitId, delayMs, resumeAt };
    } else {
      const conditionDescription = config.condition
        ? `${config.condition.field} ${config.condition.operator} ${String(config.condition.value)}`
        : undefined;

      // Persist conditional wait
      await FirestoreService.set(
        getSubCollection('workflowWaits'),
        waitId,
        {
          id: waitId,
          workflowId: action.id,
          dealId: _context.dealId ?? null,
          waitType: 'until',
          condition: config.condition ?? null,
          conditionDescription: conditionDescription ?? null,
          maxWaitDays: config.maxWaitDays ?? null,
          expiresAt: config.maxWaitDays
            ? new Date(Date.now() + config.maxWaitDays * 24 * 60 * 60 * 1000).toISOString()
            : null,
          status: 'waiting',
          createdAt: new Date().toISOString(),
        }
      );

      logger.info('Wait-until action registered', { waitId, condition: conditionDescription });

      return { waitType: 'until', waitId, condition: conditionDescription, maxWaitDays: config.maxWaitDays };
    }
  }
}

export default WorkflowEngine;
