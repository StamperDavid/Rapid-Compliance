/**
 * Workflow Trigger Listeners
 * Handles listening for workflow triggers and executing workflows
 */

import type { Workflow, WorkflowTriggerData } from '@/types/workflow';
import { executeWorkflowImpl as executeWorkflow } from './workflow-engine';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

/**
 * Trigger workflow manually
 * Called by event listeners when trigger conditions are met
 */
export async function triggerWorkflow(
  workflow: Workflow,
  triggerData: WorkflowTriggerData
): Promise<void> {
  // Workflow execution:
  // 1. Verify trigger matches workflow trigger config
  // 2. Execute workflow
  // 3. Log execution

  await executeWorkflow(workflow, triggerData);
}

/**
 * Log workflow event to Firestore
 */
async function logWorkflowEvent(
  eventType: string,
  schemaId: string,
  entityId: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const eventRecord = {
      eventType,
      entityType: schemaId,
      entityId,
      data,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/workflowEvents`,
      eventId,
      eventRecord,
      false
    );
  } catch (error) {
    logger.error('Failed to log workflow event', error instanceof Error ? error : new Error(String(error)), {
      eventType,
      schemaId,
      entityId,
    });
  }
}

/**
 * Handle entity created event
 * Called by entity service when new entities are created
 */
export async function handleEntityCreated(
  schemaId: string,
  entityData: Record<string, unknown>,
  workflows: Workflow[]
): Promise<void> {
  const entityId = (entityData.id as string | undefined) ?? 'unknown';

  await logWorkflowEvent('entity.created', schemaId, entityId, entityData);

  const matchingWorkflows = workflows.filter(w => {
    if (w.trigger.type === 'entity.created') {
      const trigger = w.trigger;
      return trigger.schemaId === schemaId;
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
  entityData: Record<string, unknown>,
  previousData: Record<string, unknown>,
  workflows: Workflow[]
): Promise<void> {
  const entityId = (entityData.id as string | undefined) ?? 'unknown';

  await logWorkflowEvent('entity.updated', schemaId, entityId, {
    current: entityData,
    previous: previousData,
  });

  const matchingWorkflows = workflows.filter(w => {
    if (w.trigger.type === 'entity.updated') {
      const trigger = w.trigger;
      if (trigger.schemaId !== schemaId) {
        return false;
      }

      // Check if specific fields are required
      const specificFields = trigger.specificFields;
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
  entityData: Record<string, unknown>,
  workflows: Workflow[]
): Promise<void> {
  const entityId = (entityData.id as string | undefined) ?? 'unknown';

  await logWorkflowEvent('entity.deleted', schemaId, entityId, entityData);

  const matchingWorkflows = workflows.filter(w => {
    if (w.trigger.type === 'entity.deleted') {
      const trigger = w.trigger;
      return trigger.schemaId === schemaId;
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

interface ScheduleTypeMapping {
  daily: string;
  weekly: string;
  monthly: string;
  hourly: string;
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
      const trigger = w.trigger;
      const schedule = trigger.schedule;

      // Check if schedule matches the schedule type
      if (schedule.type === 'interval' && schedule.interval) {
        const intervalUnit = schedule.interval.unit;
        const intervalValue = schedule.interval.value;

        // Map schedule type to interval unit
        const scheduleMapping: ScheduleTypeMapping = {
          daily: 'days',
          weekly: 'weeks',
          monthly: 'months',
          hourly: 'hours'
        };

        return intervalUnit === scheduleMapping[scheduleType] && intervalValue === 1;
      }

      // For cron-based schedules, we would need to parse the cron expression
      // This is a simplified check - in production you'd use a cron parser
      if (schedule.type === 'cron' && schedule.cron) {
        return false; // Requires cron parser implementation
      }

      return false;
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
  payload: Record<string, unknown>,
  workflows: Workflow[]
): Promise<void> {
  const matchingWorkflows = workflows.filter(w => {
    if (w.trigger.type === 'webhook') {
      const trigger = w.trigger;
      return trigger.webhookUrl === webhookId;
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
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => 
    (current as Record<string, unknown>)?.[key], obj);
}






















