/**
 * CRM Event Triggers
 * Automatically triggers workflows when CRM records change
 */

import { logger } from '@/lib/logger/logger';
import type { RelatedEntityType } from '@/types/activity';

export type CRMEventType = 
  | 'lead_created'
  | 'lead_status_changed'
  | 'lead_score_changed'
  | 'deal_created'
  | 'deal_stage_changed'
  | 'deal_value_changed'
  | 'deal_won'
  | 'deal_lost'
  | 'contact_created'
  | 'contact_updated'
  | 'company_created';

export interface EntityChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface CRMEvent {
  eventType: CRMEventType;
  entityType: RelatedEntityType;
  entityId: string;
  changes?: EntityChange[];
  entityData?: Record<string, unknown>;
  triggeredAt: Date;
}

export interface WorkflowTriggerRule {
  id: string;
  name: string;
  enabled: boolean;
  eventType: CRMEventType;
  conditions?: TriggerCondition[];
  workflowId: string;
  workflowName: string;
}

export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'changed_to' | 'changed_from';
  value: unknown;
}

/**
 * Fire CRM event and trigger applicable workflows
 */
export async function fireCRMEvent(event: CRMEvent): Promise<void> {
  try {
    logger.info('CRM event fired', {
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
    });

    // Get workflows that should be triggered by this event
    const applicableWorkflows = await getApplicableWorkflows(event);

    if (applicableWorkflows.length === 0) {
      logger.debug('No workflows triggered for event', { eventType: event.eventType });
      return;
    }

    // Execute each workflow
    for (const workflowRule of applicableWorkflows) {
      try {
        await executeTriggeredWorkflow(workflowRule, event);
      } catch (error: unknown) {
        const err = error instanceof Error ? error : undefined;
        logger.error('Failed to execute triggered workflow', err, {
          workflowId: workflowRule.workflowId,
          eventType: event.eventType,
        });
      }
    }

  } catch (error: unknown) {
    const err = error instanceof Error ? error : undefined;
    logger.error('Failed to fire CRM event', err, {
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
    });
  }
}

/**
 * Get workflows that should be triggered by this event
 */
function getApplicableWorkflows(_event: CRMEvent): Promise<WorkflowTriggerRule[]> {
  // In production, this would query Firestore for workflow trigger rules
  // For now, return empty array (workflows need to be set up separately)

  // Example query structure:
  // const rules = await FirestoreService.getAll<WorkflowTriggerRule>(
  //   getSubCollection('workflowTriggers')
  // );

  // return rules.data.filter(rule => {
  //   if (!rule.enabled) return false;
  //   if (rule.eventType !== _event.eventType) return false;
  //   return _evaluateConditions(rule.conditions, _event);
  // });

  return Promise.resolve([]);
}

/**
 * Evaluate trigger conditions
 */
function _evaluateConditions(
  conditions: TriggerCondition[] | undefined,
  event: CRMEvent
): boolean {
  if (!conditions || conditions.length === 0) {return true;}

  return conditions.every(condition => {
    const entityValue = event.entityData?.[condition.field];
    const change = event.changes?.find(c => c.field === condition.field);

    switch (condition.operator) {
      case 'equals':
        return entityValue === condition.value;
      
      case 'not_equals':
        return entityValue !== condition.value;
      
      case 'greater_than':
        return typeof entityValue === 'number' && typeof condition.value === 'number'
          ? entityValue > condition.value
          : false;

      case 'less_than':
        return typeof entityValue === 'number' && typeof condition.value === 'number'
          ? entityValue < condition.value
          : false;
      
      case 'contains':
        return String(entityValue).toLowerCase().includes(String(condition.value).toLowerCase());
      
      case 'changed_to':
        return change?.newValue === condition.value;
      
      case 'changed_from':
        return change?.oldValue === condition.value;
      
      default:
        return false;
    }
  });
}

/**
 * Execute a triggered workflow
 */
async function executeTriggeredWorkflow(
  rule: WorkflowTriggerRule,
  event: CRMEvent
): Promise<void> {
  try {
    logger.info('Executing triggered workflow', {
      workflowId: rule.workflowId,
      eventType: event.eventType,
    });

    // Import workflow execution service and get workflow
    const { executeWorkflow } = await import('@/lib/workflows/workflow-executor');
    const { getWorkflow } = await import('@/lib/workflows/workflow-service');

    // Load the workflow
    const workflow = await getWorkflow(rule.workflowId);

    if (!workflow) {
      logger.error('Workflow not found for trigger', undefined, { workflowId: rule.workflowId });
      return;
    }
    
    // Execute the workflow with event context
    await executeWorkflow(
      workflow,
      {
        entityType: event.entityType,
        entityId: event.entityId,
        eventType: event.eventType,
        ...event.entityData,
      }
    );

    logger.info('Triggered workflow executed successfully', {
      workflowId: rule.workflowId,
    });

  } catch (error: unknown) {
    const err = error instanceof Error ? error : undefined;
    logger.error('Triggered workflow execution failed', err, {
      workflowId: rule.workflowId,
    });
    throw error;
  }
}

/**
 * Helper functions to fire specific CRM events
 */

export async function fireLeadCreated(
  leadId: string,
  leadData: Record<string, unknown>
): Promise<void> {
  await fireCRMEvent({
    eventType: 'lead_created',
    entityType: 'lead',
    entityId: leadId,
    entityData: leadData,
    triggeredAt: new Date(),
  });
}

export async function fireLeadStatusChanged(
  leadId: string,
  oldStatus: string,
  newStatus: string,
  leadData: Record<string, unknown>
): Promise<void> {
  await fireCRMEvent({
    eventType: 'lead_status_changed',
    entityType: 'lead',
    entityId: leadId,
    changes: [{
      field: 'status',
      oldValue: oldStatus,
      newValue: newStatus,
    }],
    entityData: leadData,
    triggeredAt: new Date(),
  });
}

export async function fireDealStageChanged(
  dealId: string,
  oldStage: string,
  newStage: string,
  dealData: Record<string, unknown>
): Promise<void> {
  // Check if deal was won or lost
  let eventType: CRMEventType = 'deal_stage_changed';
  if (newStage === 'closed_won') {
    eventType = 'deal_won';
  } else if (newStage === 'closed_lost') {
    eventType = 'deal_lost';
  }

  await fireCRMEvent({
    eventType,
    entityType: 'deal',
    entityId: dealId,
    changes: [{
      field: 'stage',
      oldValue: oldStage,
      newValue: newStage,
    }],
    entityData: dealData,
    triggeredAt: new Date(),
  });
}

export async function fireDealValueChanged(
  dealId: string,
  oldValue: number,
  newValue: number,
  dealData: Record<string, unknown>
): Promise<void> {
  // Only fire if value changed by more than 20%
  const percentChange = Math.abs((newValue - oldValue) / oldValue);
  if (percentChange > 0.20) {
    await fireCRMEvent({
      eventType: 'deal_value_changed',
      entityType: 'deal',
      entityId: dealId,
      changes: [{
        field: 'value',
        oldValue,
        newValue,
      }],
      entityData: dealData,
      triggeredAt: new Date(),
    });
  }
}

export async function fireLeadScoreChanged(
  leadId: string,
  oldScore: number,
  newScore: number,
  leadData: Record<string, unknown>
): Promise<void> {
  // Only fire if score crossed threshold (e.g., became "hot" or "cold")
  if ((oldScore < 75 && newScore >= 75) || (oldScore >= 75 && newScore < 75)) {
    await fireCRMEvent({
      eventType: 'lead_score_changed',
      entityType: 'lead',
      entityId: leadId,
      changes: [{
        field: 'score',
        oldValue: oldScore,
        newValue: newScore,
      }],
      entityData: leadData,
      triggeredAt: new Date(),
    });
  }
}

