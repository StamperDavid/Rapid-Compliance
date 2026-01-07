/**
 * Entity Action Executor
 * Executes entity CRUD actions in workflows
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { CreateEntityAction, UpdateEntityAction, DeleteEntityAction } from '@/types/workflow';
import type { Schema } from '@/types/schema';
import { logger } from '@/lib/logger/logger';

/**
 * Execute create entity action
 */
export async function executeCreateEntityAction(
  action: CreateEntityAction,
  triggerData: any,
  organizationId: string,
  workspaceId: string
): Promise<any> {
  // Get schema for field resolution
  const { FirestoreService: FS, COLLECTIONS: COL } = await import('@/lib/db/firestore-service');
  const schemaData = await FS.get(
    `${COL.ORGANIZATIONS}/${organizationId}/${COL.WORKSPACES}/${workspaceId}/${COL.SCHEMAS}`,
    action.schemaId
  );
  
  if (!schemaData) {
    throw new Error(`Schema ${action.schemaId} not found`);
  }
  
  const schema = schemaData as Schema;
  
  // Build entity data from field mappings with dynamic field resolution
  const entityData: Record<string, any> = {};
  
  for (const mapping of action.fieldMappings) {
    let value: any;
    
    // Resolve target field using field resolver
    const { FieldResolver } = await import('@/lib/schema/field-resolver');
    const resolvedTarget = await FieldResolver.resolveFieldWithCommonAliases(
      schema,
      mapping.targetField
    );
    
    if (!resolvedTarget) {
      logger.warn('[Entity Action] Target field not found in schema', {
        file: 'entity-action.ts',
        targetField: mapping.targetField,
        schemaId: action.schemaId,
      });
      continue; // Skip this mapping
    }
    
    switch (mapping.source) {
      case 'static':
        value = mapping.staticValue;
        break;
      case 'trigger':
        // Use field resolver to get value with flexible matching
        value = FieldResolver.getFieldValue(triggerData, mapping.sourceField || '');
        break;
      case 'variable': {
        // Get from workflow variables stored in triggerData._variables
        const variables = (triggerData?._variables || triggerData?.variables) ?? {};
        value = FieldResolver.getFieldValue(variables, mapping.sourceField || '');
        // Fallback to trigger data if not found in variables
        if (value === undefined) {
          value = FieldResolver.getFieldValue(triggerData, mapping.sourceField || '');
        }
        break;
      }
      case 'ai':
        // Generate using AI
        value = await generateWithAI({
          organizationId,
          field: resolvedTarget.fieldKey,
          prompt: mapping.aiPrompt || `Generate a value for field "${resolvedTarget.fieldLabel}"`,
          context: triggerData,
        });
        break;
      default:
        value = null;
    }
    
    // Apply transform if specified
    if (mapping.transform && value !== null && value !== undefined) {
      value = applyTransform(value, mapping.transform);
    }
    
    // Use resolved field key instead of original reference
    entityData[resolvedTarget.fieldKey] = value;
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
  const schemaData = await FS.get(
    `${COL.ORGANIZATIONS}/${organizationId}/${COL.WORKSPACES}/${workspaceId}/${COL.SCHEMAS}`,
    action.schemaId
  );
  
  if (!schemaData) {
    throw new Error(`Schema ${action.schemaId} not found`);
  }
  
  const schema = schemaData as Schema;
  const entityName = schema.name || action.schemaId;
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
    // Query entities matching the criteria
    const queryResults = await queryEntities({
      entityPath,
      query: action.query,
      triggerData,
    });
    recordIds = queryResults.map((r: any) => r.id);
    if (recordIds.length === 0) {
      throw new Error('No records found matching query');
    }
  }
  
  // Build update data from field mappings with dynamic field resolution
  const updateData: Record<string, any> = {};
  const { FieldResolver } = await import('@/lib/schema/field-resolver');
  
  for (const mapping of action.fieldMappings) {
    let value: any;
    
    // Resolve target field
    const resolvedTarget = await FieldResolver.resolveFieldWithCommonAliases(
      schema,
      mapping.targetField
    );
    
    if (!resolvedTarget) {
      logger.warn('[Entity Action] Target field not found in schema for update', {
        file: 'entity-action.ts',
        targetField: mapping.targetField,
        schemaId: action.schemaId,
      });
      continue;
    }
    
    switch (mapping.source) {
      case 'static':
        value = mapping.staticValue;
        break;
      case 'trigger':
        value = FieldResolver.getFieldValue(triggerData, mapping.sourceField || '');
        break;
      default:
        value = null;
    }
    
    if (mapping.transform && value !== null && value !== undefined) {
      value = applyTransform(value, mapping.transform);
    }
    
    updateData[resolvedTarget.fieldKey] = value;
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
  const schemaData = await FS.get(
    `${COL.ORGANIZATIONS}/${organizationId}/${COL.WORKSPACES}/${workspaceId}/${COL.SCHEMAS}`,
    action.schemaId
  );
  
  if (!schemaData) {
    throw new Error(`Schema ${action.schemaId} not found`);
  }
  
  const schema = schemaData as Schema;
  const entityName = schema.name || action.schemaId;
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
    // Query entities matching the criteria
    const queryResults = await queryEntities({
      entityPath,
      query: action.query,
      triggerData,
    });
    recordIds = queryResults.map((r: any) => r.id);
    if (recordIds.length === 0) {
      logger.info('[Entity Action] No records found matching query for delete', { file: 'entity-action.ts' });
      return { recordIds: [], success: true, message: 'No records matched query' };
    }
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

/**
 * Generate value using AI
 */
async function generateWithAI(params: {
  organizationId: string;
  field: string;
  prompt: string;
  context: any;
}): Promise<string> {
  const { organizationId, field, prompt, context } = params;
  
  try {
    const { sendUnifiedChatMessage } = await import('@/lib/ai/unified-ai-service');
    
    // Build context-aware prompt
    const fullPrompt = `You are helping generate data for a workflow automation.

Field to generate: ${field}
Instructions: ${prompt}

Context data:
${JSON.stringify(context, null, 2).slice(0, 2000)}

Generate ONLY the value for this field. Do not include any explanation or formatting - just the raw value.`;

    const response = await sendUnifiedChatMessage({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: fullPrompt }],
      temperature: 0.7,
      maxTokens: 500,
    });
    
    return response.text.trim();
  } catch (error) {
    logger.error('[Entity Action] AI generation failed:', error, { file: 'entity-action.ts' });
    return `[AI Error: ${error}]`;
  }
}

/**
 * Query entities based on criteria
 */
async function queryEntities(params: {
  entityPath: string;
  query: any;
  triggerData: any;
}): Promise<any[]> {
  const { entityPath, query, triggerData } = params;
  const { FirestoreService: FS } = await import('@/lib/db/firestore-service');
  
  // Build Firestore query from criteria
  const filters: any[] = [];
  
  if (query.filters && Array.isArray(query.filters)) {
    for (const filter of query.filters) {
      let value = filter.value;
      
      // Resolve dynamic values
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const path = value.slice(2, -2).trim();
        value = getNestedValue(triggerData, path);
      }
      
      filters.push({
        field: filter.field,
        operator: mapOperator(filter.operator),
        value,
      });
    }
  }
  
  // Get matching records
  const results = await FS.getAll(entityPath, filters);
  
  // Apply limit if specified
  if (query.limit && typeof query.limit === 'number') {
    return results.slice(0, query.limit);
  }
  
  return results;
}

/**
 * Map query operator to Firestore operator
 */
function mapOperator(op: string): string {
  const operatorMap: Record<string, string> = {
    'equals': '==',
    'not_equals': '!=',
    'greater_than': '>',
    'less_than': '<',
    'greater_than_or_equals': '>=',
    'less_than_or_equals': '<=',
    'contains': 'array-contains',
    'in': 'in',
    'not_in': 'not-in',
  };
  return operatorMap[op] || '==';
}

