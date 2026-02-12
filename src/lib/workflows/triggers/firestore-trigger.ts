/**
 * Firestore Trigger Listener
 * Listens for entity changes and triggers workflows
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { Workflow, EntityTrigger } from '@/types/workflow';
import { executeWorkflow } from '../workflow-executor';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

/**
 * Register Firestore trigger for workflow
 * In production, this would set up Cloud Functions triggers
 */
export async function registerFirestoreTrigger(
  workflow: Workflow,
  workspaceId: string
): Promise<void> {
  const trigger = workflow.trigger as EntityTrigger;

  if (!trigger?.type.startsWith('entity.')) {
    return; // Not an entity trigger
  }

  // Store trigger configuration in Firestore
  // In production, this would deploy a Cloud Function
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.WORKSPACES}/${workspaceId}/workflowTriggers`,
    workflow.id,
    {
      workflowId: workflow.id,
      triggerType: trigger.type,
      schemaId: trigger.schemaId,
      workspaceId,
      registeredAt: new Date().toISOString(),
    },
    false
  );

  logger.info('Firestore Trigger Registered trigger for workflow workflow.id}', { file: 'firestore-trigger.ts' });
}

/**
 * Re-entry guard to prevent infinite workflow recursion.
 * Tracks active entity change processing to block cycles like:
 * Entity update → Workflow → Entity update → Workflow → ...
 */
const activeEntityChanges = new Set<string>();
const MAX_RECURSION_DEPTH = 3;
let currentDepth = 0;

/**
 * Handle entity change (called by Cloud Function or manual trigger)
 */
export async function handleEntityChange(
  workspaceId: string,
  schemaId: string,
  changeType: 'created' | 'updated' | 'deleted',
  recordId: string,
  recordData: Record<string, unknown>
): Promise<void> {
  // Re-entry guard: prevent infinite recursion
  const changeKey = `${workspaceId}:${schemaId}:${recordId}:${changeType}`;
  if (activeEntityChanges.has(changeKey)) {
    logger.warn('[Firestore Trigger] Blocked recursive workflow execution', {
      file: 'firestore-trigger.ts',
      changeKey,
      depth: currentDepth,
    });
    return;
  }

  if (currentDepth >= MAX_RECURSION_DEPTH) {
    logger.warn('[Firestore Trigger] Max workflow recursion depth reached', {
      file: 'firestore-trigger.ts',
      changeKey,
      depth: currentDepth,
    });
    return;
  }

  activeEntityChanges.add(changeKey);
  currentDepth++;

  try {
    // Find workflows with matching triggers
    const { where } = await import('firebase/firestore');
    const triggers = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.WORKSPACES}/${workspaceId}/workflowTriggers`,
      [
        where('triggerType', '==', `entity.${changeType}`),
        where('schemaId', '==', schemaId),
      ]
    );

    if (triggers.length === 0) {
      return; // No workflows to trigger
    }

    // Load workflows
    const workflows = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.WORKFLOWS}`,
      [where('status', '==', 'active')]
    );

    // Filter workflows that match this trigger
    const matchingWorkflows = workflows.filter((w: Record<string, unknown>) => {
      const trigger = w.trigger as EntityTrigger;
      return trigger?.type === `entity.${changeType}` && trigger?.schemaId === schemaId;
    });

    // Execute matching workflows
    for (const workflow of matchingWorkflows) {
      try {
        const triggerData = {
          workspaceId,
          schemaId,
          recordId,
          record: recordData,
          changeType,
          ...recordData, // Flatten record data for easy access
        };

        await executeWorkflow(workflow as Workflow, triggerData);
      } catch (error) {
        logger.error(`[Firestore Trigger] Error executing workflow ${workflow.id}`, error instanceof Error ? error : new Error(String(error)), { file: 'firestore-trigger.ts' });
        // Continue with other workflows
      }
    }
  } finally {
    activeEntityChanges.delete(changeKey);
    currentDepth--;
  }
}

/**
 * Unregister Firestore trigger
 */
export async function unregisterFirestoreTrigger(
  workflowId: string,
  workspaceId: string
): Promise<void> {
  await FirestoreService.delete(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.WORKSPACES}/${workspaceId}/workflowTriggers`,
    workflowId
  );

  logger.info('Firestore Trigger Unregistered trigger for workflow workflowId}', { file: 'firestore-trigger.ts' });
}






















