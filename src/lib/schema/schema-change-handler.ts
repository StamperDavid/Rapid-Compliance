/**
 * Schema Change Handler
 * Centralized handler that coordinates all system adaptations when schemas change
 */

import type { FieldType } from '@/types/schema';
import {
  SchemaChangeEventPublisher,
  type SchemaChangeEvent,
} from './schema-change-tracker';
import { logger } from '@/lib/logger/logger';

/**
 * Process schema change events and trigger appropriate handlers
 */
export async function processSchemaChangeEvent(
  event: SchemaChangeEvent
): Promise<void> {
  logger.info('[Schema Change Handler] Processing event', {
    file: 'schema-change-handler.ts',
    eventId: event.id,
    changeType: event.changeType,
    schemaId: event.schemaId,
  });
  
  try {
    // STEP 1: Assess severity and handle UX
    const { SchemaChangeUXHandler } = await import('./schema-change-severity');
    await SchemaChangeUXHandler.handleSchemaChange(event);
    
    // STEP 2: Handle field type changes with conversion
    if (event.changeType === 'field_type_changed') {
      await handleFieldTypeChange(event);
    }
    
    // STEP 3: Run all system adaptation handlers in parallel
    const handlers = [
      handleWorkflowAdaptation(event),
      handleEcommerceAdaptation(event),
      handleAIAgentAdaptation(event),
      handleIntegrationAdaptation(event),
    ];
    
    await Promise.allSettled(handlers);
    
    // STEP 4: Mark event as processed
    await SchemaChangeEventPublisher.markEventProcessed(
      event.id
    );
    
    logger.info('[Schema Change Handler] Event processed successfully', {
      file: 'schema-change-handler.ts',
      eventId: event.id,
    });
    
  } catch (error) {
    logger.error('[Schema Change Handler] Failed to process event', error instanceof Error ? error : new Error(String(error)), {
      file: 'schema-change-handler.ts',
      eventId: event.id,
    });
  }
}

/**
 * Handle field type changes with smart conversion
 */
async function handleFieldTypeChange(event: SchemaChangeEvent): Promise<void> {
  if (!event.fieldId || !event.oldFieldType || !event.newFieldType) {
    return;
  }
  
  try {
    const { FieldTypeConverter } = await import('./field-type-converter');
    
    // Check if conversion is safe (auto-convertible)
    const isSafe = FieldTypeConverter.isSafeConversion(
      event.oldFieldType as FieldType,
      event.newFieldType as FieldType
    );

    if (isSafe) {
      // Auto-convert
      logger.info('[Schema Change Handler] Auto-converting field type', {
        file: 'schema-change-handler.ts',
        eventId: event.id,
        oldType: event.oldFieldType,
        newType: event.newFieldType,
      });

      await FieldTypeConverter.convertFieldType(
        event.schemaId,
        event.oldFieldKey ?? event.oldFieldName ?? '',
        event.oldFieldType as FieldType,
        event.newFieldType as FieldType
      );
    } else {
      // Complex conversion - requires preview and approval
      logger.info('[Schema Change Handler] Requesting approval for type conversion', {
        file: 'schema-change-handler.ts',
        eventId: event.id,
        oldType: event.oldFieldType,
        newType: event.newFieldType,
      });

      const preview = await FieldTypeConverter.generateConversionPreview(
        event.schemaId,
        event.oldFieldKey ?? event.oldFieldName ?? '',
        event.oldFieldType as FieldType,
        event.newFieldType as FieldType,
        10 // sample size
      );

      await FieldTypeConverter.createConversionApprovalRequest(
        event.schemaId,
        event.oldFieldKey ?? event.oldFieldName ?? '',
        event.newFieldName ?? event.oldFieldName ?? '',
        event.oldFieldType as FieldType,
        event.newFieldType as FieldType,
        preview
      );
    }
  } catch (error) {
    logger.error('[Schema Change Handler] Field type change handling failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'schema-change-handler.ts',
      eventId: event.id,
    });
  }
}

/**
 * Handle workflow adaptations
 */
async function handleWorkflowAdaptation(event: SchemaChangeEvent): Promise<void> {
  try {
    // Workflows use field resolver, so they adapt automatically
    // But we should validate affected workflows
    const { validateWorkflowsForSchema } = await import('./workflow-validator');
    await validateWorkflowsForSchema(event);
    
  } catch (error) {
    logger.error('[Schema Change Handler] Workflow adaptation failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'schema-change-handler.ts',
      eventId: event.id,
    });
  }
}

/**
 * Handle e-commerce adaptations
 */
async function handleEcommerceAdaptation(event: SchemaChangeEvent): Promise<void> {
  try {
    const { adaptEcommerceMappings } = await import('@/lib/ecommerce/mapping-adapter');
    await adaptEcommerceMappings(event);
    
  } catch (error) {
    logger.error('[Schema Change Handler] E-commerce adaptation failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'schema-change-handler.ts',
      eventId: event.id,
    });
  }
}

/**
 * Handle AI agent adaptations
 */
async function handleAIAgentAdaptation(event: SchemaChangeEvent): Promise<void> {
  try {
    const { handleSchemaChangeForAgent } = await import('@/lib/agent/knowledge-refresh-service');
    await handleSchemaChangeForAgent(event);
    
  } catch (error) {
    logger.error('[Schema Change Handler] AI agent adaptation failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'schema-change-handler.ts',
      eventId: event.id,
    });
  }
}

/**
 * Handle integration adaptations
 */
async function handleIntegrationAdaptation(event: SchemaChangeEvent): Promise<void> {
  try {
    const { FieldMappingManager } = await import('@/lib/integrations/field-mapper');
    await FieldMappingManager.adaptToSchemaChange(event);
    
  } catch (error) {
    logger.error('[Schema Change Handler] Integration adaptation failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'schema-change-handler.ts',
      eventId: event.id,
    });
  }
}

/**
 * Process all unprocessed schema change events
 */
export async function processUnprocessedEvents(): Promise<{
  processed: number;
  failed: number;
}> {
  let processed = 0;
  let failed = 0;

  try {
    const events = await SchemaChangeEventPublisher.getUnprocessedEvents();
    
    logger.info('[Schema Change Handler] Processing unprocessed events', {
      file: 'schema-change-handler.ts',
      count: events.length,
    });
    
    for (const event of events) {
      try {
        await processSchemaChangeEvent(event);
        processed++;
      } catch (error) {
        logger.error('[Schema Change Handler] Failed to process event', error instanceof Error ? error : new Error(String(error)), {
          file: 'schema-change-handler.ts',
          eventId: event.id,
        });
        failed++;
      }
    }
    
  } catch (error) {
    logger.error('[Schema Change Handler] Failed to get unprocessed events', error instanceof Error ? error : new Error(String(error)), {
      file: 'schema-change-handler.ts',
    });
  }
  
  return { processed, failed };
}

/**
 * Get schema change impact summary
 */
export async function getSchemaChangeImpactSummary(
  schemaId: string
): Promise<{
  totalChanges: number;
  byType: Record<string, number>;
  affectedSystems: {
    workflows: number;
    integrations: number;
    ecommerce: number;
    aiAgent: number;
  };
  recentChanges: SchemaChangeEvent[];
}> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    const { where } = await import('firebase/firestore');
    const { getSubCollection } = await import('@/lib/firebase/collections');

    const eventsPath = getSubCollection('schemaChangeEvents');
    
    // Get all events for this schema (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const events = await FirestoreService.getAll(eventsPath, [
      where('schemaId', '==', schemaId),
    ]);
    
    const schemaEvents = events as SchemaChangeEvent[];
    
    // Count by type
    const byType: Record<string, number> = {};
    for (const event of schemaEvents) {
      byType[event.changeType] = (byType[event.changeType] || 0) + 1;
    }
    
    // Count affected systems
    const affectedSystems = {
      workflows: 0,
      integrations: 0,
      ecommerce: 0,
      aiAgent: 0,
    };
    
    for (const event of schemaEvents) {
      for (const system of event.affectedSystems) {
        if (system.system === 'workflows') {affectedSystems.workflows += system.itemsAffected;}
        if (system.system === 'integrations') {affectedSystems.integrations += system.itemsAffected;}
        if (system.system === 'ecommerce') {affectedSystems.ecommerce += system.itemsAffected;}
        if (system.system === 'ai_agent') {affectedSystems.aiAgent += system.itemsAffected;}
      }
    }
    
    // Get 10 most recent changes
    const recentChanges = schemaEvents
      .sort((a, b) => {
        const timeA = a.timestamp?.toMillis?.() || 0;
        const timeB = b.timestamp?.toMillis?.() || 0;
        return timeB - timeA;
      })
      .slice(0, 10);
    
    return {
      totalChanges: schemaEvents.length,
      byType,
      affectedSystems,
      recentChanges,
    };
    
  } catch (error) {
    logger.error('[Schema Change Handler] Failed to get impact summary', error instanceof Error ? error : new Error(String(error)), {
      file: 'schema-change-handler.ts',
      schemaId,
    });

    return {
      totalChanges: 0,
      byType: {},
      affectedSystems: {
        workflows: 0,
        integrations: 0,
        ecommerce: 0,
        aiAgent: 0,
      },
      recentChanges: [],
    };
  }
}

