/**
 * Schedule Trigger Handler
 * Handles scheduled workflow execution (cron jobs)
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import type { Workflow, ScheduleTrigger, WorkflowTriggerData } from '@/types/workflow';
import { executeWorkflow } from '../workflow-executor';
import { logger } from '@/lib/logger/logger';
import { CronExpressionParser } from 'cron-parser';
import {
  upsertSalesVelocityCalendarEvent,
  deleteSalesVelocityCalendarEvent,
} from '@/lib/integrations/google-calendar-service';

/**
 * Build a stable refId for the calendar mirror of a schedule trigger.
 * One refId per workflow — the next-run time is patched in place each
 * time the schedule fires + recomputes.
 */
function calendarRefIdForScheduleTrigger(workflowId: string): string {
  return `workflow-action-schedule-${workflowId}`;
}

/**
 * Mirror the next scheduled run of a workflow onto the connected Google
 * Calendar. Idempotent — re-runs patch the same event in place.
 * Failure is non-fatal (logged + swallowed).
 */
async function mirrorScheduleTriggerToCalendar(params: {
  workflow: Workflow;
  nextRunIso: string;
}): Promise<void> {
  try {
    const { workflow, nextRunIso } = params;
    const triggerName = (workflow.trigger as ScheduleTrigger | undefined)?.name ?? 'schedule';
    await upsertSalesVelocityCalendarEvent({
      refId: calendarRefIdForScheduleTrigger(workflow.id),
      summary: `Workflow: ${workflow.name}: ${triggerName}`,
      description:
        `Workflow: ${workflow.name}\n` +
        `Action: schedule.trigger\n` +
        `Workflow ID: ${workflow.id}\n` +
        `Will run: ${nextRunIso}`,
      startIso: nextRunIso,
      timeZone: 'America/New_York',
      category: 'workflow',
    });
  } catch (err) {
    logger.warn('[Schedule Trigger] Failed to mirror schedule to Google Calendar (non-fatal)', {
      workflowId: params.workflow.id,
      error: err instanceof Error ? err.message : String(err),
      file: 'schedule-trigger.ts',
    });
  }
}

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
  const nextRun = calculateNextRun(trigger.schedule);
  await FirestoreService.set(
    getSubCollection('scheduleTriggers'),
    workflow.id,
    {
      workflowId: workflow.id,
      schedule: trigger.schedule,
      registeredAt: new Date().toISOString(),
      nextRun,
    },
    false
  );

  logger.info(`[Schedule Trigger] Registered schedule config for workflow ${workflow.id}`, { file: 'schedule-trigger.ts' });

  // Ensure the cron polling endpoint knows about this schedule.
  // The internal cron route `/api/cron/workflow-scheduler` polls
  // executeScheduledWorkflows() on a 1-minute interval. Registering
  // the trigger in Firestore (done above) is sufficient — the cron
  // route will pick it up on its next tick.
  logger.info(
    `[Schedule Trigger] Workflow ${workflow.id} will execute via the /api/cron/workflow-scheduler polling route`,
    { file: 'schedule-trigger.ts', workflowId: workflow.id }
  );

  // Mirror the next scheduled run onto the connected Google Calendar so
  // the operator can see the upcoming workflow tick alongside their
  // other planned work. Non-fatal on failure.
  await mirrorScheduleTriggerToCalendar({ workflow, nextRunIso: nextRun });
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

      // Patch the calendar event in place with the recomputed next run
      // so the operator sees the rolling next-tick time. Non-fatal.
      await mirrorScheduleTriggerToCalendar({ workflow, nextRunIso: nextRun });
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

  // Remove the mirrored calendar event so paused / disabled / deleted
  // schedules disappear from the operator's calendar. Non-fatal.
  try {
    await deleteSalesVelocityCalendarEvent(calendarRefIdForScheduleTrigger(workflowId));
  } catch (err) {
    logger.warn('[Schedule Trigger] Failed to delete schedule calendar event (non-fatal)', {
      workflowId,
      error: err instanceof Error ? err.message : String(err),
      file: 'schedule-trigger.ts',
    });
  }

  logger.info(`[Schedule Trigger] Unregistered schedule config for workflow ${workflowId}`, { file: 'schedule-trigger.ts' });
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




















