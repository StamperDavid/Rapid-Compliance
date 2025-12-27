/**
 * Schema Change Tracker
 * Detects and publishes schema change events to enable automatic system adaptation
 */

import { Timestamp } from 'firebase/firestore';
import { Schema, SchemaField } from '@/types/schema';
import { logger } from '@/lib/logger/logger';

/**
 * Schema Change Event
 * Published whenever a schema or field changes
 */
export interface SchemaChangeEvent {
  id: string;
  organizationId: string;
  workspaceId: string;
  schemaId: string;
  timestamp: Timestamp;
  
  changeType: SchemaChangeType;
  
  // For field changes
  fieldId?: string;
  oldFieldName?: string;
  newFieldName?: string;
  oldFieldKey?: string;
  newFieldKey?: string;
  oldFieldType?: string;
  newFieldType?: string;
  
  // For schema changes
  oldSchemaName?: string;
  newSchemaName?: string;
  
  // Impact analysis
  affectedSystems: AffectedSystem[];
  
  // Processing status
  processed: boolean;
  processedAt?: Timestamp;
  
  // Metadata
  createdAt: Timestamp;
  createdBy?: string;
}

export type SchemaChangeType =
  | 'field_added'
  | 'field_renamed'
  | 'field_deleted'
  | 'field_type_changed'
  | 'field_key_changed'
  | 'schema_renamed'
  | 'schema_deleted';

export interface AffectedSystem {
  system: 'workflows' | 'integrations' | 'ecommerce' | 'ai_agent' | 'api' | 'forms' | 'views';
  itemsAffected: number;
  requiresUserAction: boolean;
  autoFixable: boolean;
  details?: string;
}

/**
 * Schema Change Detector
 * Compares old and new schemas to identify changes
 */
export class SchemaChangeDetector {
  /**
   * Detect changes between two schema versions
   */
  static detectChanges(
    oldSchema: Schema,
    newSchema: Schema,
    organizationId: string
  ): SchemaChangeEvent[] {
    const events: SchemaChangeEvent[] = [];
    
    // Check for schema-level changes
    if (oldSchema.name !== newSchema.name) {
      events.push(
        this.createSchemaRenameEvent(
          oldSchema,
          newSchema,
          organizationId
        )
      );
    }
    
    // Check for field changes
    const fieldChanges = this.detectFieldChanges(
      oldSchema.fields,
      newSchema.fields,
      organizationId,
      newSchema.workspaceId,
      newSchema.id
    );
    
    events.push(...fieldChanges);
    
    return events;
  }
  
  /**
   * Detect field-level changes
   */
  private static detectFieldChanges(
    oldFields: SchemaField[],
    newFields: SchemaField[],
    organizationId: string,
    workspaceId: string,
    schemaId: string
  ): SchemaChangeEvent[] {
    const events: SchemaChangeEvent[] = [];
    
    // Create maps for easier comparison
    const oldFieldsMap = new Map(oldFields.map(f => [f.id, f]));
    const newFieldsMap = new Map(newFields.map(f => [f.id, f]));
    
    // Check for deleted fields
    for (const oldField of oldFields) {
      if (!newFieldsMap.has(oldField.id)) {
        events.push(
          this.createFieldDeletedEvent(
            oldField,
            organizationId,
            workspaceId,
            schemaId
          )
        );
      }
    }
    
    // Check for added or modified fields
    for (const newField of newFields) {
      const oldField = oldFieldsMap.get(newField.id);
      
      if (!oldField) {
        // New field added
        events.push(
          this.createFieldAddedEvent(
            newField,
            organizationId,
            workspaceId,
            schemaId
          )
        );
      } else {
        // Check for modifications
        
        // Field renamed (label changed)
        if (oldField.label !== newField.label) {
          events.push(
            this.createFieldRenamedEvent(
              oldField,
              newField,
              organizationId,
              workspaceId,
              schemaId
            )
          );
        }
        
        // Field key changed (more critical than label)
        if (oldField.key !== newField.key) {
          events.push(
            this.createFieldKeyChangedEvent(
              oldField,
              newField,
              organizationId,
              workspaceId,
              schemaId
            )
          );
        }
        
        // Field type changed
        if (oldField.type !== newField.type) {
          events.push(
            this.createFieldTypeChangedEvent(
              oldField,
              newField,
              organizationId,
              workspaceId,
              schemaId
            )
          );
        }
      }
    }
    
    return events;
  }
  
  /**
   * Create schema rename event
   */
  private static createSchemaRenameEvent(
    oldSchema: Schema,
    newSchema: Schema,
    organizationId: string
  ): SchemaChangeEvent {
    const eventId = `sce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: eventId,
      organizationId,
      workspaceId: newSchema.workspaceId,
      schemaId: newSchema.id,
      timestamp: Timestamp.now(),
      changeType: 'schema_renamed',
      oldSchemaName: oldSchema.name,
      newSchemaName: newSchema.name,
      affectedSystems: this.analyzeSchemaRenameImpact(oldSchema.name, newSchema.name),
      processed: false,
      createdAt: Timestamp.now(),
    };
  }
  
  /**
   * Create field added event
   */
  private static createFieldAddedEvent(
    field: SchemaField,
    organizationId: string,
    workspaceId: string,
    schemaId: string
  ): SchemaChangeEvent {
    const eventId = `sce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: eventId,
      organizationId,
      workspaceId,
      schemaId,
      timestamp: Timestamp.now(),
      changeType: 'field_added',
      fieldId: field.id,
      newFieldName: field.label,
      newFieldKey: field.key,
      newFieldType: field.type,
      affectedSystems: [], // New fields don't break existing systems
      processed: false,
      createdAt: Timestamp.now(),
    };
  }
  
  /**
   * Create field renamed event
   */
  private static createFieldRenamedEvent(
    oldField: SchemaField,
    newField: SchemaField,
    organizationId: string,
    workspaceId: string,
    schemaId: string
  ): SchemaChangeEvent {
    const eventId = `sce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: eventId,
      organizationId,
      workspaceId,
      schemaId,
      timestamp: Timestamp.now(),
      changeType: 'field_renamed',
      fieldId: newField.id,
      oldFieldName: oldField.label,
      newFieldName: newField.label,
      oldFieldKey: oldField.key,
      newFieldKey: newField.key,
      affectedSystems: this.analyzeFieldRenameImpact(oldField.key, newField.key),
      processed: false,
      createdAt: Timestamp.now(),
    };
  }
  
  /**
   * Create field key changed event
   */
  private static createFieldKeyChangedEvent(
    oldField: SchemaField,
    newField: SchemaField,
    organizationId: string,
    workspaceId: string,
    schemaId: string
  ): SchemaChangeEvent {
    const eventId = `sce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: eventId,
      organizationId,
      workspaceId,
      schemaId,
      timestamp: Timestamp.now(),
      changeType: 'field_key_changed',
      fieldId: newField.id,
      oldFieldName: oldField.label,
      newFieldName: newField.label,
      oldFieldKey: oldField.key,
      newFieldKey: newField.key,
      affectedSystems: this.analyzeFieldKeyChangeImpact(oldField.key, newField.key),
      processed: false,
      createdAt: Timestamp.now(),
    };
  }
  
  /**
   * Create field deleted event
   */
  private static createFieldDeletedEvent(
    field: SchemaField,
    organizationId: string,
    workspaceId: string,
    schemaId: string
  ): SchemaChangeEvent {
    const eventId = `sce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: eventId,
      organizationId,
      workspaceId,
      schemaId,
      timestamp: Timestamp.now(),
      changeType: 'field_deleted',
      fieldId: field.id,
      oldFieldName: field.label,
      oldFieldKey: field.key,
      oldFieldType: field.type,
      affectedSystems: this.analyzeFieldDeletionImpact(field.key),
      processed: false,
      createdAt: Timestamp.now(),
    };
  }
  
  /**
   * Create field type changed event
   */
  private static createFieldTypeChangedEvent(
    oldField: SchemaField,
    newField: SchemaField,
    organizationId: string,
    workspaceId: string,
    schemaId: string
  ): SchemaChangeEvent {
    const eventId = `sce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: eventId,
      organizationId,
      workspaceId,
      schemaId,
      timestamp: Timestamp.now(),
      changeType: 'field_type_changed',
      fieldId: newField.id,
      oldFieldName: oldField.label,
      newFieldName: newField.label,
      oldFieldKey: oldField.key,
      newFieldKey: newField.key,
      oldFieldType: oldField.type,
      newFieldType: newField.type,
      affectedSystems: this.analyzeFieldTypeChangeImpact(oldField.type, newField.type),
      processed: false,
      createdAt: Timestamp.now(),
    };
  }
  
  /**
   * Analyze impact of schema rename
   */
  private static analyzeSchemaRenameImpact(
    oldName: string,
    newName: string
  ): AffectedSystem[] {
    const affected: AffectedSystem[] = [];
    
    // E-commerce could be affected if this is the product schema
    affected.push({
      system: 'ecommerce',
      itemsAffected: 0, // Will be determined by actual system check
      requiresUserAction: false,
      autoFixable: true,
      details: 'Product schema name changed',
    });
    
    // AI agent needs knowledge update
    affected.push({
      system: 'ai_agent',
      itemsAffected: 1,
      requiresUserAction: false,
      autoFixable: true,
      details: 'Schema name in agent knowledge needs update',
    });
    
    // Forms and views reference schema by ID, so not affected
    
    return affected;
  }
  
  /**
   * Analyze impact of field rename
   */
  private static analyzeFieldRenameImpact(
    oldKey: string,
    newKey: string
  ): AffectedSystem[] {
    const affected: AffectedSystem[] = [];
    
    // Workflows reference fields by key
    affected.push({
      system: 'workflows',
      itemsAffected: 0, // To be determined
      requiresUserAction: false,
      autoFixable: true,
      details: `Field key changed from '${oldKey}' to '${newKey}'`,
    });
    
    // Integrations may have field mappings
    affected.push({
      system: 'integrations',
      itemsAffected: 0,
      requiresUserAction: true, // User should review mappings
      autoFixable: false,
      details: 'Integration field mappings may need update',
    });
    
    // E-commerce field mappings
    affected.push({
      system: 'ecommerce',
      itemsAffected: 0,
      requiresUserAction: false,
      autoFixable: true,
      details: 'Product field mappings may need update',
    });
    
    return affected;
  }
  
  /**
   * Analyze impact of field key change (critical)
   */
  private static analyzeFieldKeyChangeImpact(
    oldKey: string,
    newKey: string
  ): AffectedSystem[] {
    // Field key changes are more critical than label changes
    return this.analyzeFieldRenameImpact(oldKey, newKey);
  }
  
  /**
   * Analyze impact of field deletion
   */
  private static analyzeFieldDeletionImpact(fieldKey: string): AffectedSystem[] {
    const affected: AffectedSystem[] = [];
    
    // All systems could be affected by field deletion
    affected.push({
      system: 'workflows',
      itemsAffected: 0,
      requiresUserAction: true,
      autoFixable: false,
      details: `Field '${fieldKey}' deleted - workflows may fail`,
    });
    
    affected.push({
      system: 'integrations',
      itemsAffected: 0,
      requiresUserAction: true,
      autoFixable: false,
      details: `Field '${fieldKey}' deleted - mappings need review`,
    });
    
    affected.push({
      system: 'ecommerce',
      itemsAffected: 0,
      requiresUserAction: true,
      autoFixable: false,
      details: `Field '${fieldKey}' deleted - product mappings need review`,
    });
    
    affected.push({
      system: 'forms',
      itemsAffected: 0,
      requiresUserAction: true,
      autoFixable: false,
      details: `Field '${fieldKey}' deleted - forms may need update`,
    });
    
    return affected;
  }
  
  /**
   * Analyze impact of field type change
   */
  private static analyzeFieldTypeChangeImpact(
    oldType: string,
    newType: string
  ): AffectedSystem[] {
    const affected: AffectedSystem[] = [];
    
    // Type changes can break data validation
    affected.push({
      system: 'workflows',
      itemsAffected: 0,
      requiresUserAction: true,
      autoFixable: false,
      details: `Field type changed from '${oldType}' to '${newType}' - may affect data processing`,
    });
    
    affected.push({
      system: 'api',
      itemsAffected: 0,
      requiresUserAction: true,
      autoFixable: false,
      details: `Field type change may affect API consumers`,
    });
    
    return affected;
  }
}

/**
 * Schema Change Event Publisher
 * Publishes events to Firestore for downstream processing
 */
export class SchemaChangeEventPublisher {
  /**
   * Publish schema change event
   */
  static async publishEvent(
    event: SchemaChangeEvent,
    db?: any
  ): Promise<void> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      
      const eventPath = `${COLLECTIONS.ORGANIZATIONS}/${event.organizationId}/schemaChangeEvents`;
      
      await FirestoreService.set(eventPath, event.id, event, false);
      
      logger.info('[Schema Change] Event published', {
        file: 'schema-change-tracker.ts',
        eventId: event.id,
        changeType: event.changeType,
        schemaId: event.schemaId,
        fieldId: event.fieldId,
      });
    } catch (error) {
      logger.error('[Schema Change] Failed to publish event', error, {
        file: 'schema-change-tracker.ts',
        eventId: event.id,
      });
      throw error;
    }
  }
  
  /**
   * Publish multiple events
   */
  static async publishEvents(events: SchemaChangeEvent[]): Promise<void> {
    for (const event of events) {
      await this.publishEvent(event);
    }
  }
  
  /**
   * Get unprocessed events for a schema
   */
  static async getUnprocessedEvents(
    organizationId: string,
    schemaId?: string
  ): Promise<SchemaChangeEvent[]> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      
      const eventPath = `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/schemaChangeEvents`;
      
      const filters: any[] = [
        { field: 'processed', operator: '==', value: false },
      ];
      
      if (schemaId) {
        filters.push({ field: 'schemaId', operator: '==', value: schemaId });
      }
      
      const events = await FirestoreService.getAll(eventPath, filters);
      
      return events as SchemaChangeEvent[];
    } catch (error) {
      logger.error('[Schema Change] Failed to get unprocessed events', error, {
        file: 'schema-change-tracker.ts',
      });
      return [];
    }
  }
  
  /**
   * Mark event as processed
   */
  static async markEventProcessed(
    organizationId: string,
    eventId: string
  ): Promise<void> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      
      const eventPath = `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/schemaChangeEvents`;
      
      const existing = await FirestoreService.get(eventPath, eventId);
      
      if (existing) {
        await FirestoreService.set(
          eventPath,
          eventId,
          {
            ...existing,
            processed: true,
            processedAt: Timestamp.now(),
          },
          false
        );
      }
    } catch (error) {
      logger.error('[Schema Change] Failed to mark event as processed', error, {
        file: 'schema-change-tracker.ts',
        eventId,
      });
    }
  }
}


