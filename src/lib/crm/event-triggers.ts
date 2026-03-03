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
 * Map CRM event type to workflow entity trigger type
 */
function mapCrmEventToTriggerType(eventType: CRMEventType): string | null {
  switch (eventType) {
    case 'lead_created':
    case 'deal_created':
    case 'contact_created':
    case 'company_created':
      return 'entity.created';
    case 'lead_status_changed':
    case 'lead_score_changed':
    case 'deal_stage_changed':
    case 'deal_value_changed':
    case 'deal_won':
    case 'deal_lost':
    case 'contact_updated':
      return 'entity.updated';
    default:
      return null;
  }
}

/**
 * Extract entity schema key from CRM event type
 */
function getEntitySchemaKey(eventType: CRMEventType): string {
  if (eventType.startsWith('lead_')) {
    return 'lead';
  }
  if (eventType.startsWith('deal_')) {
    return 'deal';
  }
  if (eventType.startsWith('contact_')) {
    return 'contact';
  }
  if (eventType.startsWith('company_')) {
    return 'company';
  }
  return '';
}

/**
 * Evaluate workflow conditions against entity data
 */
function evaluateWorkflowConditions(
  conditions: Array<{ field: string; operator: string; value: unknown; source?: string }>,
  operator: 'and' | 'or',
  entityData: Record<string, unknown>
): boolean {
  const results = conditions.map(cond => {
    const fieldValue = entityData[cond.field];
    switch (cond.operator) {
      case 'equals': return fieldValue === cond.value;
      case 'not_equals': return fieldValue !== cond.value;
      case 'contains': return String(fieldValue ?? '').toLowerCase().includes(String(cond.value).toLowerCase());
      case 'not_contains': return !String(fieldValue ?? '').toLowerCase().includes(String(cond.value).toLowerCase());
      case 'greater_than': return typeof fieldValue === 'number' && typeof cond.value === 'number' && fieldValue > cond.value;
      case 'less_than': return typeof fieldValue === 'number' && typeof cond.value === 'number' && fieldValue < cond.value;
      case 'is_empty': return fieldValue === null || fieldValue === undefined || fieldValue === '';
      case 'is_not_empty': return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
      case 'exists': return fieldValue !== undefined;
      case 'not_exists': return fieldValue === undefined;
      default: return true;
    }
  });

  return operator === 'and'
    ? results.every(Boolean)
    : results.some(Boolean);
}

/**
 * Get workflows that should be triggered by this event
 * Queries Firestore for active workflows whose trigger matches the CRM event
 */
async function getApplicableWorkflows(event: CRMEvent): Promise<WorkflowTriggerRule[]> {
  try {
    const { getWorkflows } = await import('@/lib/workflows/workflow-service');

    // Map CRM event type to workflow trigger type
    const triggerType = mapCrmEventToTriggerType(event.eventType);
    if (!triggerType) {
      return [];
    }

    // Query active workflows with matching trigger type
    const result = await getWorkflows({ status: 'active', triggerType });
    if (!result.data.length) {
      return [];
    }

    const entityKey = getEntitySchemaKey(event.eventType);
    const matching: WorkflowTriggerRule[] = [];

    for (const workflow of result.data) {
      const trigger = workflow.trigger as {
        type: string;
        schemaId?: string;
        specificFields?: string[];
      };

      // Verify schemaId matches entity type (case-insensitive partial match)
      if (trigger.schemaId && entityKey) {
        const schemaLower = trigger.schemaId.toLowerCase();
        if (!schemaLower.includes(entityKey)) {
          continue;
        }
      }

      // Check specific field triggers — only fire if a watched field changed
      if (trigger.specificFields?.length && event.changes?.length) {
        const changedFields = event.changes.map(c => c.field);
        const hasMatch = trigger.specificFields.some(f => changedFields.includes(f));
        if (!hasMatch) {
          continue;
        }
      }

      // Evaluate workflow conditions against entity data
      const conditions = workflow.conditions as Array<{
        field: string;
        operator: string;
        value: unknown;
        source?: string;
      }> | undefined;

      if (conditions?.length && event.entityData) {
        const condOp = workflow.conditionOperator ?? 'and';
        const passed = evaluateWorkflowConditions(conditions, condOp, event.entityData);
        if (!passed) {
          continue;
        }
      }

      matching.push({
        id: `trigger_${workflow.id}`,
        name: workflow.name,
        enabled: true,
        eventType: event.eventType,
        workflowId: workflow.id,
        workflowName: workflow.name,
      });
    }

    logger.info('Found applicable workflows for CRM event', {
      eventType: event.eventType,
      entityType: event.entityType,
      matchCount: matching.length,
    });

    return matching;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : undefined;
    logger.error('Failed to query applicable workflows', err, {
      eventType: event.eventType,
    });
    return [];
  }
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

