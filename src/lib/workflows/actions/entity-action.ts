/**
 * Entity Action Executor
 * Executes entity CRUD actions in workflows
 */

// FirestoreService and COLLECTIONS imported dynamically where needed
import type { CreateEntityAction, UpdateEntityAction, DeleteEntityAction } from '@/types/workflow';
import type { Schema } from '@/types/schema';
import { logger } from '@/lib/logger/logger';

/**
 * Type guard to check if value is a record with an id field
 */
function hasIdField(value: unknown): value is { id: string } {
  return typeof value === 'object' && value !== null && 'id' in value && typeof (value as Record<string, unknown>).id === 'string';
}

/**
 * Interface for transform config
 */
interface TransformConfig {
  type: string;
}

/**
 * Interface for query filter
 */
interface QueryFilter {
  field: string;
  operator: string;
  value: unknown;
}

/**
 * Interface for query config
 */
interface QueryConfig {
  filters?: QueryFilter[];
  limit?: number;
}

/**
 * Execute create entity action
 */
export async function executeCreateEntityAction(
  action: CreateEntityAction,
  triggerData: Record<string, unknown>,
  organizationId: string,
  workspaceId: string
): Promise<Record<string, unknown>> {
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
  const entityData: Record<string, unknown> = {};

  for (const mapping of action.fieldMappings) {
    let value: unknown;
    
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
        value = FieldResolver.getFieldValue(triggerData, mapping.sourceField ?? '');
        break;
      case 'variable': {
        // Get from workflow variables stored in triggerData._variables
        const variables = ((triggerData._variables ?? triggerData.variables) ?? {}) as Record<string, unknown>;
        value = FieldResolver.getFieldValue(variables, mapping.sourceField ?? '');
        // Fallback to trigger data if not found in variables
        if (value === undefined) {
          value = FieldResolver.getFieldValue(triggerData, mapping.sourceField ?? '');
        }
        break;
      }
      case 'ai':
        // Generate using AI
        value = await generateWithAI({
          field: resolvedTarget.fieldKey,
          prompt:(mapping.aiPrompt !== '' && mapping.aiPrompt != null) ? mapping.aiPrompt : `Generate a value for field "${resolvedTarget.fieldLabel}"`,
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
  
  const entityName = schema.name ?? action.schemaId;
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
  triggerData: Record<string, unknown>,
  organizationId: string,
  workspaceId: string
): Promise<Record<string, unknown>> {
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
    const triggerRecordId = triggerData?.recordId ?? triggerData?.id;
    if (!triggerRecordId || typeof triggerRecordId !== 'string') {
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
    recordIds = queryResults
      .filter(hasIdField)
      .map((r) => r.id);
    if (recordIds.length === 0) {
      throw new Error('No records found matching query');
    }
  }

  // Build update data from field mappings with dynamic field resolution
  const updateData: Record<string, unknown> = {};
  const { FieldResolver } = await import('@/lib/schema/field-resolver');

  for (const mapping of action.fieldMappings) {
    let value: unknown;
    
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
        value = FieldResolver.getFieldValue(triggerData, mapping.sourceField ?? '');
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
  triggerData: Record<string, unknown>,
  organizationId: string,
  workspaceId: string
): Promise<Record<string, unknown>> {
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
    const triggerRecordId = triggerData?.recordId ?? triggerData?.id;
    if (!triggerRecordId || typeof triggerRecordId !== 'string') {
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
    recordIds = queryResults
      .filter(hasIdField)
      .map((r) => r.id);
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
  triggerData: Record<string, unknown>,
  organizationId: string
): Promise<Record<string, unknown>> {
  // Type guard to check if action has workspaceId
  const actionWithWorkspaceId = action as unknown as Record<string, unknown>;
  const workspaceIdFromTrigger = triggerData?.workspaceId;
  const workspaceIdFromAction = actionWithWorkspaceId?.workspaceId;
  const workspaceId = workspaceIdFromTrigger ?? workspaceIdFromAction;

  if (!workspaceId || typeof workspaceId !== 'string') {
    throw new Error('Workspace ID required for entity actions');
  }

  if (action.type === 'create_entity') {
    return executeCreateEntityAction(action, triggerData, organizationId, workspaceId);
  } else if (action.type === 'update_entity') {
    return executeUpdateEntityAction(action, triggerData, organizationId, workspaceId);
  } else if (action.type === 'delete_entity') {
    return executeDeleteEntityAction(action, triggerData, organizationId, workspaceId);
  } else {
    const exhaustiveCheck: never = action;
    const unknownAction = exhaustiveCheck as { type?: unknown };
    throw new Error(`Unknown entity action type: ${String(unknownAction.type)}`);
  }
}

/**
 * Apply field transform
 */
function applyTransform(value: unknown, transform: unknown): unknown {
  // Type guard for transform config
  if (typeof transform !== 'object' || transform === null) {
    return value;
  }

  const transformConfig = transform as TransformConfig;

  switch (transformConfig.type) {
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
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return undefined;
  }

  return path.split('.').reduce<unknown>((current, key) => {
    if (typeof current === 'object' && current !== null) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Generate value using AI
 */
async function generateWithAI(params: {
  field: string;
  prompt: string;
  context: Record<string, unknown>;
}): Promise<string> {
  const { field, prompt, context } = params;

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
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[Entity Action] AI generation failed', error instanceof Error ? error : new Error(String(error)), { file: 'entity-action.ts' });
    return `[AI Error: ${errorMsg}]`;
  }
}

/**
 * Query entities based on criteria
 */
async function queryEntities(params: {
  entityPath: string;
  query: unknown;
  triggerData: Record<string, unknown>;
}): Promise<unknown[]> {
  const { entityPath, query, triggerData } = params;
  const { FirestoreService: FS } = await import('@/lib/db/firestore-service');
  const { where } = await import('firebase/firestore');
  type WhereFilterOp = import('firebase/firestore').WhereFilterOp;

  // Type guard for query config
  if (typeof query !== 'object' || query === null) {
    return [];
  }

  const queryConfig = query as QueryConfig;

  // Build Firestore query from criteria
  const filters: ReturnType<typeof where>[] = [];

  if (queryConfig.filters && Array.isArray(queryConfig.filters)) {
    for (const filter of queryConfig.filters) {
      let value = filter.value;

      // Resolve dynamic values
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const path = value.slice(2, -2).trim();
        value = getNestedValue(triggerData, path);
      }

      const operator = mapOperator(filter.operator) as WhereFilterOp;
      filters.push(where(filter.field, operator, value));
    }
  }

  // Get matching records
  const results = await FS.getAll(entityPath, filters);

  // Apply limit if specified
  if (queryConfig.limit && typeof queryConfig.limit === 'number') {
    return results.slice(0, queryConfig.limit);
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

