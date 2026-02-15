/**
 * AI Agent Knowledge Refresh Service
 * Automatically updates AI agent knowledge when schemas change
 */

import type { SchemaChangeEvent } from '@/lib/schema/schema-change-tracker';
import { logger } from '@/lib/logger/logger';
import { where } from 'firebase/firestore';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getSubCollection } from '@/lib/firebase/collections';

/**
 * Schema types that are relevant to AI agent knowledge
 */
/** Golden Master data structure */
interface GoldenMasterData {
  id: string;
  systemPrompt: string;
  version: number;
}

const AGENT_RELEVANT_SCHEMAS = [
  'products',
  'services',
  'leads',
  'contacts',
  'companies',
  'orders',
  'quotes',
  'inventory',
];

/**
 * Handle schema change for AI agent
 */
export async function handleSchemaChangeForAgent(
  event: SchemaChangeEvent
): Promise<void> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');

    // Get schema to check if it's relevant to agent
    const schema = await FirestoreService.get(
      getSubCollection('schemas'),
      event.schemaId
    );
    
    if (!schema) {
      logger.warn('[AI Agent Refresh] Schema not found', {
        file: 'knowledge-refresh-service.ts',
        schemaId: event.schemaId,
      });
      return;
    }
    
    interface SchemaNameData {
      name?: string;
    }
    const schemaNameData = schema as SchemaNameData;
    const schemaNameLower = schemaNameData.name?.toLowerCase();
    const schemaName = (schemaNameLower !== '' && schemaNameLower != null) ? schemaNameLower : '';
    const isRelevant = isAgentRelevantSchema(schemaName);
    
    if (!isRelevant) {
      logger.info('[AI Agent Refresh] Schema not relevant to agent', {
        file: 'knowledge-refresh-service.ts',
        schemaName,
      });
      return;
    }
    
    // Determine if we need to trigger full knowledge recompilation
    const requiresRecompilation = shouldRecompileKnowledge(event);

    if (requiresRecompilation) {
      await recompileAgentKnowledge();

      // Notify user of the update
      await notifySchemaChange({
        title: 'AI Agent Updated',
        message: `Your AI agent's knowledge has been updated to reflect recent schema changes to ${schemaName}.`,
        type: 'info',
        eventId: event.id,
      });
    } else {
      // Just log for minor changes
      logger.info('[AI Agent Refresh] Minor schema change - no recompilation needed', {
        file: 'knowledge-refresh-service.ts',
        changeType: event.changeType,
      });
    }

  } catch (error) {
    logger.error('[AI Agent Refresh] Failed to handle schema change', error instanceof Error ? error : new Error(String(error)), {
      file: 'knowledge-refresh-service.ts',
      eventId: event.id,
    });
  }
}

/**
 * Check if schema is relevant to AI agent knowledge
 */
export function isAgentRelevantSchema(schemaName: string): boolean {
  const normalized = schemaName.toLowerCase().trim();
  
  // Check against known relevant schemas
  for (const relevantSchema of AGENT_RELEVANT_SCHEMAS) {
    if (normalized.includes(relevantSchema) || relevantSchema.includes(normalized)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Determine if schema change requires knowledge recompilation
 */
function shouldRecompileKnowledge(event: SchemaChangeEvent): boolean {
  // These changes require recompilation
  const criticalChanges = [
    'field_renamed',
    'field_key_changed',
    'field_deleted',
    'schema_renamed',
    'field_type_changed',
  ];
  
  return criticalChanges.includes(event.changeType);
}

/**
 * Recompile agent knowledge base
 */
export async function recompileAgentKnowledge(): Promise<void> {
  try {
    logger.info('[AI Agent Refresh] Starting knowledge recompilation', {
      file: 'knowledge-refresh-service.ts',
    });

    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

    // Get current Golden Master
    const goldenMastersPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/goldenMasters`;
    const goldenMasters = await FirestoreService.getAll<GoldenMasterData>(goldenMastersPath, [
      where('status', '==', 'active'),
    ]);

    if (goldenMasters.length === 0) {
      logger.warn('[AI Agent Refresh] No active Golden Master found', {
        file: 'knowledge-refresh-service.ts',
      });
      return;
    }

    const goldenMaster = goldenMasters[0];

    // Get all schemas
    const schemasPath = getSubCollection('schemas');
    const schemas = await FirestoreService.getAll<SchemaRecord>(schemasPath, [
      where('status', '==', 'active'),
    ]);

    // Recompile system prompt with updated schema information
    const updatedSystemPrompt = compileSystemPromptWithSchemas(
      goldenMaster.systemPrompt,
      schemas
    );

    // Update Golden Master with new system prompt
    await FirestoreService.set(
      goldenMastersPath,
      goldenMaster.id,
      {
        ...goldenMaster,
        systemPrompt: updatedSystemPrompt,
        version: goldenMaster.version + 1,
        lastUpdated: new Date().toISOString(),
        lastSchemaSync: new Date().toISOString(),
      },
      false
    );

    logger.info('[AI Agent Refresh] Knowledge recompilation complete', {
      file: 'knowledge-refresh-service.ts',
      goldenMasterId: goldenMaster.id,
      newVersion: goldenMaster.version + 1,
    });

  } catch (error) {
    logger.error('[AI Agent Refresh] Failed to recompile knowledge', error instanceof Error ? error : new Error(String(error)), {
      file: 'knowledge-refresh-service.ts',
    });
    throw error;
  }
}

/** Schema field structure */
interface SchemaField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  hidden?: boolean;
}

/** Schema structure from Firestore */
interface SchemaRecord {
  name: string;
  description?: string;
  fields: SchemaField[];
  status?: string;
}

/**
 * Compile system prompt with current schema information
 */
function compileSystemPromptWithSchemas(
  basePrompt: string,
  schemas: SchemaRecord[]
): string {
  // Build schema documentation
  const schemaDocumentation = schemas
    .filter(schema => isAgentRelevantSchema(schema.name))
    .map(schema => {
      const fields = schema.fields
        .filter((f) => !f.hidden)
        .map((f) => `  - ${f.label} (${f.key}): ${f.type}${f.required ? ' [required]' : ''}`)
        .join('\n');
      
      return `
## ${schema.name}
Description: ${(schema.description !== '' && schema.description != null) ? schema.description : 'No description provided'}

Available fields:
${fields}
`;
    })
    .join('\n');
  
  // Check if prompt already has schema section
  const schemaMarker = '<!-- SCHEMA_DOCUMENTATION -->';
  
  if (basePrompt.includes(schemaMarker)) {
    // Replace existing schema documentation
    const beforeMarker = basePrompt.split(schemaMarker)[0];
    const afterMarker = basePrompt.split(schemaMarker).slice(2).join(schemaMarker);
    
    return `${beforeMarker}${schemaMarker}\n${schemaDocumentation}\n${schemaMarker}${afterMarker}`;
  } else {
    // Append schema documentation
    return `${basePrompt}\n\n${schemaMarker}\n# Data Schemas\n\nYou have access to the following data schemas:\n\n${schemaDocumentation}\n${schemaMarker}`;
  }
}

/**
 * Notify user of schema change affecting AI agent
 */
async function notifySchemaChange(
  notification: {
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success';
    eventId: string;
  }
): Promise<void> {
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

    const notificationPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/notifications`;
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await FirestoreService.set(
      notificationPath,
      notificationId,
      {
        id: notificationId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        category: 'schema_change',
        metadata: {
          eventId: notification.eventId,
          source: 'ai_agent_refresh',
        },
        read: false,
        createdAt: new Date().toISOString(),
      },
      false
    );

    logger.info('[AI Agent Refresh] Notification sent', {
      file: 'knowledge-refresh-service.ts',
      notificationId,
    });

  } catch (error) {
    logger.error('[AI Agent Refresh] Failed to send notification', error instanceof Error ? error : new Error(String(error)), {
      file: 'knowledge-refresh-service.ts',
    });
  }
}

/**
 * Get schema change impact on AI agent
 */
export async function getSchemaChangeImpactOnAgent(
  event: SchemaChangeEvent
): Promise<{
  affectsAgent: boolean;
  requiresRecompilation: boolean;
  impactLevel: 'none' | 'low' | 'medium' | 'high';
  description: string;
}> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');

    const schema = await FirestoreService.get(
      getSubCollection('schemas'),
      event.schemaId
    );
    
    if (!schema) {
      return {
        affectsAgent: false,
        requiresRecompilation: false,
        impactLevel: 'none',
        description: 'Schema not found',
      };
    }
    
    interface SchemaDataForImpact {
      name?: string;
    }
    const schemaDataForImpact = schema as SchemaDataForImpact;
    const schemaNameLowerForImpact = schemaDataForImpact.name?.toLowerCase();
    const schemaName = (schemaNameLowerForImpact !== '' && schemaNameLowerForImpact != null) ? schemaNameLowerForImpact : '';
    const isRelevant = isAgentRelevantSchema(schemaName);
    
    if (!isRelevant) {
      return {
        affectsAgent: false,
        requiresRecompilation: false,
        impactLevel: 'none',
        description: `Schema '${schemaName}' is not used by the AI agent`,
      };
    }
    
    const requiresRecompilation = shouldRecompileKnowledge(event);
    
    // Determine impact level
    let impactLevel: 'none' | 'low' | 'medium' | 'high' = 'low';
    let description = '';
    
    switch (event.changeType) {
      case 'field_deleted':
        impactLevel = 'high';
        description = `Field '${event.oldFieldName}' was deleted. Agent may reference outdated field.`;
        break;
      
      case 'field_renamed':
      case 'field_key_changed':
        impactLevel = 'medium';
        description = `Field renamed from '${event.oldFieldName}' to '${event.newFieldName}'. Agent knowledge will be updated.`;
        break;
      
      case 'field_type_changed':
        impactLevel = 'medium';
        description = `Field '${event.newFieldName}' type changed from '${event.oldFieldType}' to '${event.newFieldType}'.`;
        break;
      
      case 'schema_renamed':
        impactLevel = 'medium';
        description = `Schema renamed from '${event.oldSchemaName}' to '${event.newSchemaName}'.`;
        break;
      
      case 'field_added':
        impactLevel = 'low';
        description = `New field '${event.newFieldName}' added. Agent can now access this field.`;
        break;
      
      default:
        impactLevel = 'low';
        description = 'Minor schema change detected.';
    }
    
    return {
      affectsAgent: isRelevant,
      requiresRecompilation,
      impactLevel,
      description,
    };

  } catch (error) {
    logger.error('[AI Agent Refresh] Failed to assess impact', error instanceof Error ? error : new Error(String(error)), {
      file: 'knowledge-refresh-service.ts',
      eventId: event.id,
    });

    return {
      affectsAgent: false,
      requiresRecompilation: false,
      impactLevel: 'none',
      description: 'Error assessing impact',
    };
  }
}

/**
 * Manually trigger AI agent knowledge refresh
 */
export async function manuallyRefreshAgentKnowledge(): Promise<{
  success: boolean;
  message: string;
  newVersion?: number;
}> {
  try {
    await recompileAgentKnowledge();

    return {
      success: true,
      message: 'AI agent knowledge refreshed successfully',
    };
  } catch (error) {
    logger.error('[AI Agent Refresh] Manual refresh failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'knowledge-refresh-service.ts',
    });

    return {
      success: false,
      message: `Failed to refresh agent knowledge: ${error}`,
    };
  }
}


