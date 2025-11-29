/**
 * Entity Action Executor
 * Executes entity CRUD actions in workflows
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { CreateEntityAction, UpdateEntityAction, DeleteEntityAction } from '@/types/workflow';

/**
 * Execute create entity action
 */
export async function executeCreateEntityAction(
  action: CreateEntityAction,
  triggerData: any,
  organizationId: string,
  workspaceId: string
): Promise<any> {
  // Build entity data from field mappings
  const entityData: Record<string, any> = {};
  
  for (const mapping of action.fieldMappings) {
    let value: any;
    
    switch (mapping.source) {
      case 'static':
        value = mapping.staticValue;
        break;
      case 'trigger':
        value = getNestedValue(triggerData, mapping.sourceField || '');
        break;
      case 'variable':
        // TODO: Get from workflow variables
        value = getNestedValue(triggerData, mapping.sourceField || '');
        break;
      case 'ai':
        // TODO: Generate using AI
        value = '[AI Generated]';
        break;
      default:
        value = null;
    }
    
    // Apply transform if specified
    if (mapping.transform && value !== null && value !== undefined) {
      value = applyTransform(value, mapping.transform);
    }
    
    entityData[mapping.targetField] = value;
  }
  
  // Get entity name from schema
  const { FirestoreService: FS, COLLECTIONS: COL } = await import('@/lib/db/firestore-service');
  const schema = await FS.get(
    `${COL.ORGANIZATIONS}/${organizationId}/${COL.WORKSPACES}/${workspaceId}/${COL.SCHEMAS}`,
    action.schemaId
  );
  
  if (!schema) {
    throw new Error(`Schema ${action.schemaId} not found`);
  }
  
  const entityName = (schema as any).name || action.schemaId;
  const entityPath = `${COL.ORGANIZATIONS}/${organizationId}/${COL.WORKSPACES}/${workspaceId}/entities/${entityName}`;
  
  const recordId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await FS.set(entityPath, recordId, {
    ...entityData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, false);
  
  return { recordId, success: true };
}

/**
 * Execute update entity action
 */
export async function executeUpdateEntityAction(
  action: UpdateEntityAction,
  triggerData: any,
  organizationId: string,
  workspaceId: string
): Promise<any> {
  // Get schema
  const { FirestoreService: FS, COLLECTIONS: COL } = await import('@/lib/db/firestore-service');
  const schema = await FS.get(
    `${COL.ORGANIZATIONS}/${organizationId}/${COL.WORKSPACES}/${workspaceId}/${COL.SCHEMAS}`,
    action.schemaId
  );
  
  if (!schema) {
    throw new Error(`Schema ${action.schemaId} not found`);
  }
  
  const entityName = (schema as any).name || action.schemaId;
  const entityPath = `${COL.ORGANIZATIONS}/${organizationId}/${COL.WORKSPACES}/${workspaceId}/entities/${entityName}`;
  
  // Determine which record(s) to update
  let recordIds: string[] = [];
  
  if (action.targetRecord === 'trigger') {
    const triggerRecordId = triggerData?.recordId || triggerData?.id;
    if (!triggerRecordId) {
      throw new Error('No record ID in trigger data');
    }
    recordIds = [triggerRecordId];
  } else if (action.targetRecord === 'specific' && action.entityId) {
    recordIds = [action.entityId];
  } else if (action.targetRecord === 'query' && action.query) {
    // TODO: Query entities
    throw new Error('Query-based update not yet implemented');
  }
  
  // Build update data from field mappings
  const updateData: Record<string, any> = {};
  
  for (const mapping of action.fieldMappings) {
    let value: any;
    
    switch (mapping.source) {
      case 'static':
        value = mapping.staticValue;
        break;
      case 'trigger':
        value = getNestedValue(triggerData, mapping.sourceField || '');
        break;
      default:
        value = null;
    }
    
    if (mapping.transform && value !== null && value !== undefined) {
      value = applyTransform(value, mapping.transform);
    }
    
    updateData[mapping.targetField] = value;
  }
  
  // Update records
  for (const recordId of recordIds) {
    const existing = await FS.get(entityPath, recordId);
    if (!existing) {
      throw new Error(`Record ${recordId} not found`);
    }
    
    await FS.set(entityPath, recordId, {
      ...existing,
      ...updateData,
      updatedAt: new Date().toISOString(),
    }, false);
  }
  
  return { recordIds, success: true };
}

/**
 * Execute delete entity action
 */
export async function executeDeleteEntityAction(
  action: DeleteEntityAction,
  triggerData: any,
  organizationId: string,
  workspaceId: string
): Promise<any> {
  // Get schema
  const { FirestoreService: FS, COLLECTIONS: COL } = await import('@/lib/db/firestore-service');
  const schema = await FS.get(
    `${COL.ORGANIZATIONS}/${organizationId}/${COL.WORKSPACES}/${workspaceId}/${COL.SCHEMAS}`,
    action.schemaId
  );
  
  if (!schema) {
    throw new Error(`Schema ${action.schemaId} not found`);
  }
  
  const entityName = (schema as any).name || action.schemaId;
  const entityPath = `${COL.ORGANIZATIONS}/${organizationId}/${COL.WORKSPACES}/${workspaceId}/entities/${entityName}`;
  
  // Determine which record(s) to delete
  let recordIds: string[] = [];
  
  if (action.targetRecord === 'trigger') {
    const triggerRecordId = triggerData?.recordId || triggerData?.id;
    if (!triggerRecordId) {
      throw new Error('No record ID in trigger data');
    }
    recordIds = [triggerRecordId];
  } else if (action.targetRecord === 'specific' && action.entityId) {
    recordIds = [action.entityId];
  } else if (action.targetRecord === 'query' && action.query) {
    // TODO: Query entities
    throw new Error('Query-based delete not yet implemented');
  }
  
  // Delete records
  for (const recordId of recordIds) {
    if (action.softDelete) {
      // Soft delete: mark as deleted
      const existing = await FS.get(entityPath, recordId);
      if (existing) {
        await FS.set(entityPath, recordId, {
          ...existing,
          deleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, false);
      }
    } else {
      // Hard delete
      await FS.delete(entityPath, recordId);
    }
  }
  
  return { recordIds, success: true };
}

/**
 * Execute entity action (router)
 */
export async function executeEntityAction(
  action: CreateEntityAction | UpdateEntityAction | DeleteEntityAction,
  triggerData: any,
  organizationId: string
): Promise<any> {
  const workspaceId = triggerData?.workspaceId || (action as any).workspaceId;
  if (!workspaceId) {
    throw new Error('Workspace ID required for entity actions');
  }
  
  if (action.type === 'create_entity') {
    return executeCreateEntityAction(action, triggerData, organizationId, workspaceId);
  } else if (action.type === 'update_entity') {
    return executeUpdateEntityAction(action, triggerData, organizationId, workspaceId);
  } else if (action.type === 'delete_entity') {
    return executeDeleteEntityAction(action, triggerData, organizationId, workspaceId);
  } else {
    const actionType = (action as any).type;
    throw new Error(`Unknown entity action type: ${actionType}`);
  }
}

/**
 * Apply field transform
 */
function applyTransform(value: any, transform: any): any {
  switch (transform.type) {
    case 'uppercase':
      return String(value).toUpperCase();
    case 'lowercase':
      return String(value).toLowerCase();
    case 'trim':
      return String(value).trim();
    default:
      return value;
  }
}

/**
 * Resolve variables in config
 */
function resolveVariables(config: any, triggerData: any): any {
  if (typeof config === 'string') {
    return config.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = getNestedValue(triggerData, path.trim());
      return value !== undefined ? String(value) : match;
    });
  } else if (Array.isArray(config)) {
    return config.map(item => resolveVariables(item, triggerData));
  } else if (config && typeof config === 'object') {
    const resolved: any = {};
    for (const key in config) {
      resolved[key] = resolveVariables(config[key], triggerData);
    }
    return resolved;
  }
  return config;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

