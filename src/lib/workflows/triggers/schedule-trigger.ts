/**
 * Schedule Trigger Handler
 * Handles scheduled workflow execution (cron jobs)
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { Workflow, ScheduleTrigger } from '@/types/workflow';
import { executeWorkflow } from '../workflow-executor';
import { logger } from '@/lib/logger/logger';
import cronParser from 'cron-parser';

/**
 * Register schedule trigger
 * In production, this would set up Cloud Scheduler
 */
export async function registerScheduleTrigger(
  workflow: Workflow,
  organizationId: string,
  workspaceId: string
): Promise<void> {
  const trigger = workflow.trigger as ScheduleTrigger;
  
  if (trigger?.type !== 'schedule') {
    return;
  }
  
  // Store schedule configuration
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/scheduleTriggers`,
    workflow.id,
    {
      workflowId: workflow.id,
      schedule: trigger.schedule,
      organizationId,
      workspaceId,
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
    const interval = schedule.interval!;
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
      const cronExpression = schedule.cron!;
      
      // Validate and parse cron expression
      const interval = cronParser.parseExpression(cronExpression, {
        currentDate: now,
        tz: 'UTC' // Or get from organization settings
      });
      
      // Get next occurrence
      const next = interval.next().toDate();
      return next.toISOString();
    } catch (error) {
      logger.error('[Schedule] Invalid cron expression', error, {
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
  
  // Get all organizations
  const orgs = await FirestoreService.getAll(COLLECTIONS.ORGANIZATIONS, []);
  
  for (const org of orgs) {
    const workspaces = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${org.id}/${COLLECTIONS.WORKSPACES}`,
      []
    );
    
    for (const workspace of workspaces) {
      const triggers = await FirestoreService.getAll(
        `${COLLECTIONS.ORGANIZATIONS}/${org.id}/${COLLECTIONS.WORKSPACES}/${workspace.id}/scheduleTriggers`,
        [
          where('nextRun', '<=', now),
          orderBy('nextRun', 'asc'),
          limit(100), // Process in batches
        ]
      );
      
      for (const trigger of triggers) {
        try {
          // Load workflow
          const workflow = await FirestoreService.get(
            `${COLLECTIONS.ORGANIZATIONS}/${org.id}/${COLLECTIONS.WORKSPACES}/${workspace.id}/${COLLECTIONS.WORKFLOWS}`,
            trigger.workflowId
          );
          
          if (!workflow || (workflow as any).status !== 'active') {
            continue; // Skip inactive workflows
          }
          
          // Execute workflow
          const triggerData = {
            organizationId: org.id,
            workspaceId: workspace.id,
            scheduledAt: now,
            scheduleType: (trigger as any).schedule.type,
          };
          
          await executeWorkflow(workflow as Workflow, triggerData);
          
          // Update next run time
          const scheduleTrigger = workflow.trigger as ScheduleTrigger;
          const nextRun = calculateNextRun(scheduleTrigger.schedule);
          
          await FirestoreService.set(
            `${COLLECTIONS.ORGANIZATIONS}/${org.id}/${COLLECTIONS.WORKSPACES}/${workspace.id}/scheduleTriggers`,
            trigger.workflowId,
            {
              ...trigger,
              nextRun,
              lastRun: now,
            },
            false
          );
        } catch (error) {
          logger.error('[Schedule Trigger] Error executing workflow ${trigger.workflowId}:', error, { file: 'schedule-trigger.ts' });
          // Continue with other workflows
        }
      }
    }
  }
}

/**
 * Unregister schedule trigger
 */
export async function unregisterScheduleTrigger(
  workflowId: string,
  organizationId: string,
  workspaceId: string
): Promise<void> {
  await FirestoreService.delete(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/scheduleTriggers`,
    workflowId
  );
  
  logger.info('Schedule Trigger Unregistered schedule for workflow workflowId}', { file: 'schedule-trigger.ts' });
}

/**
 * Validate cron expression
 */
export function validateCronExpression(cron: string): { valid: boolean; error?: string } {
  try {
    cronParser.parseExpression(cron);
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid cron expression'
    };
  }
}




















