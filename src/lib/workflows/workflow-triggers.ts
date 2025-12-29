/**
 * Workflow Trigger Listeners
 * Handles listening for workflow triggers and executing workflows
 * MOCK IMPLEMENTATION - Ready for backend integration
 */

import { Workflow, WorkflowTrigger } from '@/types/workflow';
import { executeWorkflowImpl as executeWorkflow } from './workflow-engine';

/**
 * Trigger workflow manually
 * Called by event listeners when trigger conditions are met
 */
export async function triggerWorkflow(
  workflow: Workflow,
  triggerData: any
): Promise<void> {
  // Workflow execution:
  // 1. Verify trigger matches workflow trigger config
  // 2. Execute workflow
  // 3. Log execution

  await executeWorkflow(workflow, triggerData);
}

/**
 * Handle entity created event
 * Called by entity service when new entities are created
 */
export async function handleEntityCreated(
  schemaId: string,
  entityData: any,
  workflows: Workflow[]
): Promise<void> {
  const matchingWorkflows = workflows.filter(w => {
    if (w.trigger.type === 'entity.created' && (w.trigger as any).schemaId === schemaId) {
      return true;
    }
    return false;
  });

  for (const workflow of matchingWorkflows) {
    if (workflow.settings.enabled) {
      await triggerWorkflow(workflow, {
        entity: entityData,
        schemaId,
        event: 'entity.created',
      });
    }
  }
}

/**
 * Handle entity updated event
 */
export async function handleEntityUpdated(
  schemaId: string,
  entityData: any,
  previousData: any,
  workflows: Workflow[]
): Promise<void> {
  const matchingWorkflows = workflows.filter(w => {
    if (w.trigger.type === 'entity.updated' && (w.trigger as any).schemaId === schemaId) {
      // Check if specific fields are required
      const specificFields = (w.trigger as any).specificFields;
      if (specificFields && specificFields.length > 0) {
        // Only trigger if specified fields changed
        const fieldsChanged = specificFields.some((field: string) => {
          return getNestedValue(entityData, field) !== getNestedValue(previousData, field);
        });
        if (!fieldsChanged) {
          return false;
        }
      }
      return true;
    }
    return false;
  });

  for (const workflow of matchingWorkflows) {
    if (workflow.settings.enabled) {
      await triggerWorkflow(workflow, {
        entity: entityData,
        previousEntity: previousData,
        schemaId,
        event: 'entity.updated',
      });
    }
  }
}

/**
 * Handle entity deleted event
 */
export async function handleEntityDeleted(
  schemaId: string,
  entityData: any,
  workflows: Workflow[]
): Promise<void> {
  const matchingWorkflows = workflows.filter(w => {
    if (w.trigger.type === 'entity.deleted' && (w.trigger as any).schemaId === schemaId) {
      return true;
    }
    return false;
  });

  for (const workflow of matchingWorkflows) {
    if (workflow.settings.enabled) {
      await triggerWorkflow(workflow, {
        entity: entityData,
        schemaId,
        event: 'entity.deleted',
      });
    }
  }
}

/**
 * Handle schedule trigger
 * Called by scheduled jobs (cron) at specified intervals
 */
export async function handleScheduleTrigger(
  scheduleType: 'daily' | 'weekly' | 'monthly' | 'hourly',
  workflows: Workflow[]
): Promise<void> {
  const matchingWorkflows = workflows.filter(w => {
    if (w.trigger.type === 'schedule') {
      const schedule = (w.trigger as any).schedule;
      return schedule === scheduleType || schedule === 'schedule.daily' || schedule === 'schedule.weekly';
    }
    return false;
  });

  for (const workflow of matchingWorkflows) {
    if (workflow.settings.enabled) {
      await triggerWorkflow(workflow, {
        scheduleType,
        event: 'schedule',
        timestamp: new Date(),
      });
    }
  }
}

/**
 * Handle webhook trigger
 * Called by webhook endpoint when external systems send data
 */
export async function handleWebhookTrigger(
  webhookId: string,
  payload: any,
  workflows: Workflow[]
): Promise<void> {
  const matchingWorkflows = workflows.filter(w => {
    if (w.trigger.type === 'webhook') {
      return (w.trigger as any).webhookId === webhookId;
    }
    return false;
  });

  for (const workflow of matchingWorkflows) {
    if (workflow.settings.enabled) {
      await triggerWorkflow(workflow, {
        webhookId,
        payload,
        event: 'webhook',
      });
    }
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}






















