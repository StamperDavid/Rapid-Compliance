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

export interface CRMEvent {
  eventType: CRMEventType;
  entityType: RelatedEntityType;
  entityId: string;
  organizationId: string;
  workspaceId: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  entityData?: any;
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
  value: any;
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
      } catch (error) {
        logger.error('Failed to execute triggered workflow', error, {
          workflowId: workflowRule.workflowId,
          eventType: event.eventType,
        });
      }
    }

  } catch (error: any) {
    logger.error('Failed to fire CRM event', error, { event });
  }
}

/**
 * Get workflows that should be triggered by this event
 */
async function getApplicableWorkflows(event: CRMEvent): Promise<WorkflowTriggerRule[]> {
  try {
    // In production, this would query Firestore for workflow trigger rules
    // For now, return empty array (workflows need to be set up separately)
    
    // Example query structure:
    // const rules = await FirestoreService.getAll<WorkflowTriggerRule>(
    //   `organizations/${event.organizationId}/workspaces/${event.workspaceId}/workflowTriggers`
    // );
    
    // return rules.data.filter(rule => {
    //   if (!rule.enabled) return false;
    //   if (rule.eventType !== event.eventType) return false;
    //   return evaluateConditions(rule.conditions, event);
    // });

    return [];
  } catch (error: any) {
    logger.error('Failed to get applicable workflows', error);
    return [];
  }
}

/**
 * Evaluate trigger conditions
 */
function evaluateConditions(
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
        return entityValue > condition.value;
      
      case 'less_than':
        return entityValue < condition.value;
      
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
    const workflow = await getWorkflow(event.organizationId, rule.workflowId);
    
    if (!workflow) {
      logger.error('Workflow not found for trigger', { workflowId: rule.workflowId });
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

  } catch (error: any) {
    logger.error('Triggered workflow execution failed', error, {
      workflowId: rule.workflowId,
    });
    throw error;
  }
}

/**
 * Helper functions to fire specific CRM events
 */

export async function fireLeadCreated(
  organizationId: string,
  workspaceId: string,
  leadId: string,
  leadData: any
): Promise<void> {
  await fireCRMEvent({
    eventType: 'lead_created',
    entityType: 'lead',
    entityId: leadId,
    organizationId,
    workspaceId,
    entityData: leadData,
    triggeredAt: new Date(),
  });
}

export async function fireLeadStatusChanged(
  organizationId: string,
  workspaceId: string,
  leadId: string,
  oldStatus: string,
  newStatus: string,
  leadData: any
): Promise<void> {
  await fireCRMEvent({
    eventType: 'lead_status_changed',
    entityType: 'lead',
    entityId: leadId,
    organizationId,
    workspaceId,
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
  organizationId: string,
  workspaceId: string,
  dealId: string,
  oldStage: string,
  newStage: string,
  dealData: any
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
    organizationId,
    workspaceId,
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
  organizationId: string,
  workspaceId: string,
  dealId: string,
  oldValue: number,
  newValue: number,
  dealData: any
): Promise<void> {
  // Only fire if value changed by more than 20%
  const percentChange = Math.abs((newValue - oldValue) / oldValue);
  if (percentChange > 0.20) {
    await fireCRMEvent({
      eventType: 'deal_value_changed',
      entityType: 'deal',
      entityId: dealId,
      organizationId,
      workspaceId,
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
  organizationId: string,
  workspaceId: string,
  leadId: string,
  oldScore: number,
  newScore: number,
  leadData: any
): Promise<void> {
  // Only fire if score crossed threshold (e.g., became "hot" or "cold")
  if ((oldScore < 75 && newScore >= 75) || (oldScore >= 75 && newScore < 75)) {
    await fireCRMEvent({
      eventType: 'lead_score_changed',
      entityType: 'lead',
      entityId: leadId,
      organizationId,
      workspaceId,
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

