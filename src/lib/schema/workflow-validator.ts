/**
 * Workflow Validator
 * Validates workflows against schema changes and provides warnings
 */

import type { SchemaChangeEvent } from './schema-change-tracker';
import { logger } from '@/lib/logger/logger';
import type { Workflow } from '@/types/workflow';
import { FieldResolver } from './field-resolver';

/**
 * Validate workflows affected by schema change
 */
export async function validateWorkflowsForSchema(
  event: SchemaChangeEvent
): Promise<void> {
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    const { where } = await import('firebase/firestore');
    
    // Get all workflows for this workspace
    const workflowsPath = `${COLLECTIONS.ORGANIZATIONS}/${event.organizationId}/${COLLECTIONS.WORKSPACES}/${event.workspaceId}/workflows`;
    const workflows = await FirestoreService.getAll(workflowsPath, [
      where('status', '==', 'active'),
    ]);
    
    if (workflows.length === 0) {
      return;
    }
    
    // Get schema for field resolution
    const schema = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${event.organizationId}/${COLLECTIONS.WORKSPACES}/${event.workspaceId}/${COLLECTIONS.SCHEMAS}`,
      event.schemaId
    );
    
    if (!schema) {
      return;
    }
    
    // Check each workflow
    for (const workflowData of workflows) {
      const workflow = workflowData as Workflow;
      
      const validation = await validateWorkflow(workflow, schema, event);
      
      if (!validation.valid) {
        logger.warn('[Workflow Validator] Workflow affected by schema change', {
          file: 'workflow-validator.ts',
          workflowId: workflow.id,
          workflowName: workflow.name,
          warnings: validation.warnings,
        });
        
        // Create notification for user
        await createWorkflowWarningNotification(
          event.organizationId,
          event.workspaceId,
          workflow,
          validation.warnings
        );
      }
    }
    
  } catch (error) {
    logger.error('[Workflow Validator] Validation failed', error, {
      file: 'workflow-validator.ts',
      eventId: event.id,
    });
  }
}

/**
 * Validate a single workflow
 */
export async function validateWorkflow(
  workflow: Workflow,
  schema: any,
  event?: SchemaChangeEvent
): Promise<{
  valid: boolean;
  warnings: string[];
  errors: string[];
}> {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check if workflow uses this schema
  const usesSchema = workflowUsesSchema(workflow, schema.id);
  
  if (!usesSchema) {
    return { valid: true, warnings, errors };
  }
  
  // Validate trigger
  if (workflow.trigger.type.startsWith('entity.')) {
    const entityTrigger = workflow.trigger as any;
    if (entityTrigger.schemaId === schema.id) {
      if (entityTrigger.specificFields) {
        for (const fieldRef of entityTrigger.specificFields) {
          const resolved = await FieldResolver.resolveField(schema, fieldRef);
          if (!resolved) {
            errors.push(`Trigger field '${fieldRef}' not found in schema`);
          } else if (resolved.confidence < 0.8) {
            warnings.push(`Trigger field '${fieldRef}' has low confidence match`);
          }
        }
      }
    }
  }
  
  // Validate actions
  for (const action of workflow.actions) {
    if (action.type === 'create_entity' || action.type === 'update_entity') {
      const entityAction = action as any;
      
      if (entityAction.schemaId === schema.id) {
        // Validate field mappings
        for (const mapping of entityAction.fieldMappings || []) {
          const resolved = await FieldResolver.resolveField(schema, mapping.targetField);
          
          if (!resolved) {
            errors.push(
              `Action '${action.name}': Field '${mapping.targetField}' not found in schema`
            );
          } else if (resolved.confidence < 0.8) {
            warnings.push(
              `Action '${action.name}': Field '${mapping.targetField}' has low confidence match`
            );
          }
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Check if workflow uses a specific schema
 */
function workflowUsesSchema(workflow: Workflow, schemaId: string): boolean {
  // Check trigger
  if (workflow.trigger.type.startsWith('entity.')) {
    const entityTrigger = workflow.trigger as any;
    if (entityTrigger.schemaId === schemaId) {
      return true;
    }
  }
  
  // Check actions
  for (const action of workflow.actions) {
    if (action.type === 'create_entity' || action.type === 'update_entity' || action.type === 'delete_entity') {
      const entityAction = action as any;
      if (entityAction.schemaId === schemaId) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Create notification for workflow warnings
 */
async function createWorkflowWarningNotification(
  organizationId: string,
  workspaceId: string,
  workflow: Workflow,
  warnings: string[]
): Promise<void> {
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    
    const notificationPath = `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/notifications`;
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await FirestoreService.set(
      notificationPath,
      notificationId,
      {
        id: notificationId,
        organizationId,
        workspaceId,
        title: 'Workflow May Be Affected by Schema Changes',
        message: `Workflow "${workflow.name}" references fields that have changed. Please review: ${warnings.join(', ')}`,
        type: 'warning',
        category: 'workflow_validation',
        metadata: {
          workflowId: workflow.id,
          workflowName: workflow.name,
          warnings,
        },
        read: false,
        createdAt: new Date().toISOString(),
      },
      false
    );
    
  } catch (error) {
    logger.error('[Workflow Validator] Failed to create notification', error, {
      file: 'workflow-validator.ts',
    });
  }
}

/**
 * Get validation summary for all workflows
 */
export async function getWorkflowValidationSummary(
  organizationId: string,
  workspaceId: string
): Promise<{
  total: number;
  valid: number;
  withWarnings: number;
  withErrors: number;
  details: Array<{
    workflowId: string;
    workflowName: string;
    valid: boolean;
    warningCount: number;
    errorCount: number;
  }>;
}> {
  const summary = {
    total: 0,
    valid: 0,
    withWarnings: 0,
    withErrors: 0,
    details: [] as any[],
  };
  
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    
    const workflowsPath = `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/workflows`;
    const workflows = await FirestoreService.getAll(workflowsPath);
    
    const schemasPath = `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.SCHEMAS}`;
    const schemas = await FirestoreService.getAll(schemasPath);
    
    summary.total = workflows.length;
    
    for (const workflowData of workflows) {
      const workflow = workflowData as Workflow;
      
      // Find relevant schema
      const relevantSchema = schemas.find((s: any) => workflowUsesSchema(workflow, s.id));
      
      if (!relevantSchema) {
        summary.valid++;
        continue;
      }
      
      const validation = await validateWorkflow(workflow, relevantSchema);
      
      if (validation.valid && validation.warnings.length === 0) {
        summary.valid++;
      } else if (validation.errors.length > 0) {
        summary.withErrors++;
      } else if (validation.warnings.length > 0) {
        summary.withWarnings++;
      }
      
      summary.details.push({
        workflowId: workflow.id,
        workflowName: workflow.name,
        valid: validation.valid,
        warningCount: validation.warnings.length,
        errorCount: validation.errors.length,
      });
    }
    
  } catch (error) {
    logger.error('[Workflow Validator] Failed to get validation summary', error, {
      file: 'workflow-validator.ts',
    });
  }
  
  return summary;
}


