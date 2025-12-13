/**
 * Firestore Trigger Listener
 * Listens for entity changes and triggers workflows
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { Workflow, EntityTrigger } from '@/types/workflow';
import { executeWorkflow } from '../workflow-engine';

/**
 * Register Firestore trigger for workflow
 * In production, this would set up Cloud Functions triggers
 */
export async function registerFirestoreTrigger(
  workflow: Workflow,
  organizationId: string,
  workspaceId: string
): Promise<void> {
  const trigger = workflow.trigger as EntityTrigger;
  
  if (!trigger || !trigger.type.startsWith('entity.')) {
    return; // Not an entity trigger
  }
  
  // Store trigger configuration in Firestore
  // In production, this would deploy a Cloud Function
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/workflowTriggers`,
    workflow.id,
    {
      workflowId: workflow.id,
      triggerType: trigger.type,
      schemaId: trigger.schemaId,
      organizationId,
      workspaceId,
      registeredAt: new Date().toISOString(),
    },
    false
  );
  
  console.log(`[Firestore Trigger] Registered trigger for workflow ${workflow.id}`);
}

/**
 * Handle entity change (called by Cloud Function or manual trigger)
 */
export async function handleEntityChange(
  organizationId: string,
  workspaceId: string,
  schemaId: string,
  changeType: 'created' | 'updated' | 'deleted',
  recordId: string,
  recordData: any
): Promise<void> {
  // Find workflows with matching triggers
  const { where } = await import('firebase/firestore');
  const triggers = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/workflowTriggers`,
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
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.WORKFLOWS}`,
    [where('status', '==', 'active')]
  );
  
  // Filter workflows that match this trigger
  const matchingWorkflows = workflows.filter((w: any) => {
    const trigger = w.trigger as EntityTrigger;
    return trigger?.type === `entity.${changeType}` && trigger?.schemaId === schemaId;
  });
  
  // Execute matching workflows
  for (const workflow of matchingWorkflows) {
    try {
      const triggerData = {
        organizationId,
        workspaceId,
        schemaId,
        recordId,
        record: recordData,
        changeType,
        ...recordData, // Flatten record data for easy access
      };
      
      await executeWorkflow(workflow as Workflow, triggerData);
    } catch (error) {
      console.error(`[Firestore Trigger] Error executing workflow ${workflow.id}:`, error);
      // Continue with other workflows
    }
  }
}

/**
 * Unregister Firestore trigger
 */
export async function unregisterFirestoreTrigger(
  workflowId: string,
  organizationId: string,
  workspaceId: string
): Promise<void> {
  await FirestoreService.delete(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/workflowTriggers`,
    workflowId
  );
  
  console.log(`[Firestore Trigger] Unregistered trigger for workflow ${workflowId}`);
}














