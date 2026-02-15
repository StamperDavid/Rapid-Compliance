/**
 * Schedule Trigger Handler
 * Handles scheduled workflow execution (cron jobs)
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import type { Workflow, ScheduleTrigger, WorkflowTriggerData } from '@/types/workflow';
import { executeWorkflow } from '../workflow-executor';
import { logger } from '@/lib/logger/logger';
import { CronExpressionParser } from 'cron-parser';

/**
 * Register schedule trigger
 * In production, this would set up Cloud Scheduler
 */
export async function registerScheduleTrigger(
  workflow: Workflow
): Promise<void> {
  const trigger = workflow.trigger as ScheduleTrigger;

  if (trigger?.type !== 'schedule') {
    return;
  }

  // Store schedule configuration
  const { getSubCollection } = await import('@/lib/firebase/collections');
  await FirestoreService.set(
    getSubCollection('scheduleTriggers'),
    workflow.id,
    {
      workflowId: workflow.id,
      schedule: trigger.schedule,
      registeredAt: new Date().toISOString(),
      nextRun: calculateNextRun(trigger.schedule),
    },
    false
  );

  logger.info('Schedule Trigger Registered schedule for workflow workflow.id}', { file: 'schedule-trigger.ts' });
}

/**
 * Calculate next run time from schedule
 */
function calculateNextRun(schedule: ScheduleTrigger['schedule']): string {
  const now = new Date();

  if (schedule.type === 'interval') {
    const interval = schedule.interval;
    if (!interval) {
      logger.error('[Schedule] Interval schedule missing interval configuration', new Error('Missing interval'), {
        file: 'schedule-trigger.ts'
      });
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }

    let milliseconds = interval.value;

    switch (interval.unit) {
      case 'minutes':
        milliseconds *= 60 * 1000;
        break;
      case 'hours':
        milliseconds *= 60 * 60 * 1000;
        break;
      case 'days':
        milliseconds *= 24 * 60 * 60 * 1000;
        break;
      case 'weeks':
        milliseconds *= 7 * 24 * 60 * 60 * 1000;
        break;
      case 'months':
        milliseconds *= 30 * 24 * 60 * 60 * 1000; // Approximate
        break;
    }

    return new Date(now.getTime() + milliseconds).toISOString();
  } else if (schedule.type === 'cron') {
    try {
      const cronExpression = schedule.cron;
      if (!cronExpression) {
        throw new Error('Cron schedule missing cron expression');
      }
      
      // Validate and parse cron expression
      const interval = CronExpressionParser.parse(cronExpression, {
        currentDate: now,
        tz: 'UTC' // Or get from organization settings
      });
      
      // Get next occurrence
      const next = interval.next();
      return next?.toISOString() ?? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    } catch (error) {
      logger.error('[Schedule] Invalid cron expression', error instanceof Error ? error : new Error(String(error)), {
        cron: schedule.cron,
        file: 'schedule-trigger.ts'
      });
      
      // Fallback to 1 day from now if invalid
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
  }
  
  return now.toISOString();
}

/**
 * Execute scheduled workflows
 * This would be called by Cloud Scheduler or a cron job
 */
export async function executeScheduledWorkflows(): Promise<void> {
  const now = new Date().toISOString();

  // Find all schedule triggers that are due
  const { where, orderBy, limit } = await import('firebase/firestore');
  const { getSubCollection } = await import('@/lib/firebase/collections');

  const triggers = await FirestoreService.getAll(
    getSubCollection('scheduleTriggers'),
    [
      where('nextRun', '<=', now),
      orderBy('nextRun', 'asc'),
      limit(100), // Process in batches
    ]
  );

  for (const trigger of triggers) {
    try {
      // Type guard for trigger data
      if (!trigger || typeof trigger !== 'object') {
        continue;
      }

      // Ensure workflowId exists
      const workflowId = 'workflowId' in trigger && typeof trigger.workflowId === 'string'
        ? trigger.workflowId
        : null;

      if (!workflowId) {
        continue;
      }

      // Load workflow
      const workflowDoc = await FirestoreService.get(
        getSubCollection('workflows'),
        workflowId
      );

      // Type guard for workflow document
      if (!workflowDoc || typeof workflowDoc !== 'object') {
        continue;
      }

      const workflow = workflowDoc as Workflow;
      if (workflow.status !== 'active') {
        continue; // Skip inactive workflows
      }

      const scheduleData = 'schedule' in trigger && trigger.schedule as Record<string, unknown>;
      const scheduleTypeRaw = scheduleData && typeof scheduleData === 'object' && 'type' in scheduleData
        ? scheduleData.type as string
        : 'unknown';

      // Map schedule type to valid WorkflowTriggerData scheduleType
      const validScheduleTypes = ['daily', 'weekly', 'monthly', 'hourly'] as const;
      const scheduleType: 'daily' | 'weekly' | 'monthly' | 'hourly' | undefined =
        validScheduleTypes.includes(scheduleTypeRaw as typeof validScheduleTypes[number])
          ? (scheduleTypeRaw as typeof validScheduleTypes[number])
          : undefined;

      // Execute workflow with proper typing
      const triggerData: WorkflowTriggerData = {
        scheduledAt: now,
        scheduleType,
      };

      await executeWorkflow(workflow, triggerData);

      // Update next run time
      const scheduleTrigger = workflow.trigger as ScheduleTrigger;
      const nextRun = calculateNextRun(scheduleTrigger.schedule);

      await FirestoreService.set(
        getSubCollection('scheduleTriggers'),
        workflowId,
        {
          ...trigger,
          nextRun,
          lastRun: now,
        },
        false
      );
    } catch (error) {
      const workflowId = trigger && typeof trigger === 'object' && 'workflowId' in trigger && typeof trigger.workflowId === 'string'
        ? trigger.workflowId
        : 'unknown';
      logger.error(`[Schedule Trigger] Error executing workflow ${workflowId}`, error instanceof Error ? error : new Error(String(error)), { file: 'schedule-trigger.ts' });
      // Continue with other workflows
    }
  }
}

/**
 * Unregister schedule trigger
 */
export async function unregisterScheduleTrigger(
  workflowId: string
): Promise<void> {
  const { getSubCollection } = await import('@/lib/firebase/collections');
  await FirestoreService.delete(
    getSubCollection('scheduleTriggers'),
    workflowId
  );

  logger.info('Schedule Trigger Unregistered schedule for workflow workflowId}', { file: 'schedule-trigger.ts' });
}

/**
 * Validate cron expression
 */
export function validateCronExpression(cron: string): { valid: boolean; error?: string } {
  try {
    CronExpressionParser.parse(cron);
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid cron expression'
    };
  }
}




















