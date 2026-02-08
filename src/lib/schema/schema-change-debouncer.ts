/**
 * Schema Change Debouncer
 * Batches rapid schema changes to avoid multiple recompilations
 */

import type { SchemaChangeEvent } from './schema-change-tracker';
import type { Schema, SchemaField } from '@/types/schema';
import { processSchemaChangeEvent } from './schema-change-handler';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

/**
 * Schema Change Debouncer
 * Collects events and processes them in batches
 */
export class SchemaChangeDebouncer {
  private static instance: SchemaChangeDebouncer;
  private pendingEvents: Map<string, SchemaChangeEvent[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private debounceMs: number;
  
  private constructor(debounceMs: number = 5000) {
    this.debounceMs = debounceMs;
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(debounceMs: number = 5000): SchemaChangeDebouncer {
    if (!SchemaChangeDebouncer.instance) {
      SchemaChangeDebouncer.instance = new SchemaChangeDebouncer(debounceMs);
    }
    return SchemaChangeDebouncer.instance;
  }
  
  /**
   * Add event to debounce queue
   */
  addEvent(event: SchemaChangeEvent): void {
    const key = this.getEventKey(event);

    // Add event to pending list
    const events = this.pendingEvents.get(key) ?? [];
    events.push(event);
    this.pendingEvents.set(key, events);

    logger.info('[Schema Change Debouncer] Event queued', {
      file: 'schema-change-debouncer.ts',
      eventId: event.id,
      queueKey: key,
      queueSize: events.length,
    });

    // Clear existing timer
    const existingTimer = this.timers.get(key);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      void this.processBatch(key);
    }, this.debounceMs);

    this.timers.set(key, timer);
  }
  
  /**
   * Process batched events
   */
  private async processBatch(key: string): Promise<void> {
    const events = this.pendingEvents.get(key) ?? [];
    
    if (events.length === 0) {
      return;
    }
    
    logger.info('[Schema Change Debouncer] Processing batch', {
      file: 'schema-change-debouncer.ts',
      queueKey: key,
      eventCount: events.length,
    });
    
    try {
      // Coalesce similar events
      const coalesced = this.coalesceEvents(events);
      
      logger.info('[Schema Change Debouncer] Events coalesced', {
        file: 'schema-change-debouncer.ts',
        original: events.length,
        coalesced: coalesced.length,
      });
      
      // Process all coalesced events
      for (const event of coalesced) {
        try {
          await processSchemaChangeEvent(event);
        } catch (error) {
          logger.error('[Schema Change Debouncer] Failed to process event', error instanceof Error ? error : new Error(String(error)), {
            file: 'schema-change-debouncer.ts',
            eventId: event.id,
          });
        }
      }
      
      logger.info('[Schema Change Debouncer] Batch processing complete', {
        file: 'schema-change-debouncer.ts',
        queueKey: key,
      });
      
    } catch (error) {
      logger.error('[Schema Change Debouncer] Batch processing failed', error instanceof Error ? error : new Error(String(error)), {
        file: 'schema-change-debouncer.ts',
        queueKey: key,
      });
    } finally {
      // Clear
      this.pendingEvents.delete(key);
      this.timers.delete(key);
    }
  }
  
  /**
   * Coalesce similar events
   * Merges multiple renames of the same field, etc.
   */
  private coalesceEvents(events: SchemaChangeEvent[]): SchemaChangeEvent[] {
    const coalescedMap = new Map<string, SchemaChangeEvent>();
    
    for (const event of events) {
      const key = this.getCoalesceKey(event);
      
      const existing = coalescedMap.get(key);
      
      if (existing) {
        // Merge events (keep latest)
        if (event.changeType === 'field_renamed' || event.changeType === 'field_key_changed') {
          // For renames, track original name to final name
          coalescedMap.set(key, {
            ...event,
            oldFieldKey:existing.oldFieldKey ?? event.oldFieldKey,
            oldFieldName:existing.oldFieldName ?? event.oldFieldName,
          });
        } else {
          // For other types, keep latest
          coalescedMap.set(key, event);
        }
      } else {
        coalescedMap.set(key, event);
      }
    }
    
    return Array.from(coalescedMap.values());
  }
  
  /**
   * Get event key for grouping
   */
  private getEventKey(event: SchemaChangeEvent): string {
    return `${PLATFORM_ID}:${event.schemaId}`;
  }
  
  /**
   * Get coalesce key for deduplication
   */
  private getCoalesceKey(event: SchemaChangeEvent): string {
    return `${event.changeType}:${(event.fieldId !== '' && event.fieldId != null) ? event.fieldId : 'schema'}`;
  }
  
  /**
   * Set debounce duration
   */
  setDebounceMs(ms: number): void {
    this.debounceMs = ms;
  }
  
  /**
   * Get current debounce duration
   */
  getDebounceMs(): number {
    return this.debounceMs;
  }
  
  /**
   * Flush all pending events immediately
   */
  async flush(): Promise<void> {
    logger.info('[Schema Change Debouncer] Flushing all pending events', {
      file: 'schema-change-debouncer.ts',
      queueCount: this.pendingEvents.size,
    });
    
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    // Process all batches
    const keys = Array.from(this.pendingEvents.keys());
    for (const key of keys) {
      await this.processBatch(key);
    }
  }
  
  /**
   * Get pending event count
   */
  getPendingCount(): number {
    let count = 0;
    for (const events of this.pendingEvents.values()) {
      count += events.length;
    }
    return count;
  }
  
  /**
   * Clear all pending events without processing
   */
  clear(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.pendingEvents.clear();
    this.timers.clear();
    
    logger.info('[Schema Change Debouncer] Cleared all pending events', {
      file: 'schema-change-debouncer.ts',
    });
  }
}

/**
 * Manual Batch Updater
 * For explicit batch operations
 */
export interface SchemaChange {
  type: 'field_update' | 'field_add' | 'field_delete' | 'schema_update';
  fieldId?: string;
  field?: Partial<SchemaField>;
  updates?: Partial<Schema> | Partial<SchemaField>;
}

export class SchemaBatchUpdater {
  private changes: SchemaChange[] = [];
  private schemaId: string;
  private workspaceId: string;

  constructor(workspaceId: string, schemaId: string) {
    this.workspaceId = workspaceId;
    this.schemaId = schemaId;
  }
  
  /**
   * Start batch
   */
  startBatch(): void {
    this.changes = [];
    logger.info('[Schema Batch Updater] Batch started', {
      file: 'schema-change-debouncer.ts',
      schemaId: this.schemaId,
    });
  }
  
  /**
   * Queue field update
   */
  queueFieldUpdate(fieldId: string, updates: Partial<SchemaField>): void {
    this.changes.push({
      type: 'field_update',
      fieldId,
      updates,
    });
  }
  
  /**
   * Queue field addition
   */
  queueFieldAdd(field: Partial<SchemaField>): void {
    this.changes.push({
      type: 'field_add',
      field,
    });
  }
  
  /**
   * Queue field deletion
   */
  queueFieldDelete(fieldId: string): void {
    this.changes.push({
      type: 'field_delete',
      fieldId,
    });
  }
  
  /**
   * Queue schema update
   */
  queueSchemaUpdate(updates: Partial<Schema>): void {
    this.changes.push({
      type: 'schema_update',
      updates,
    });
  }
  
  /**
   * Commit batch
   */
  async commitBatch(_userId: string): Promise<void> {
    if (this.changes.length === 0) {
      logger.warn('[Schema Batch Updater] No changes to commit', {
        file: 'schema-change-debouncer.ts',
      });
      return;
    }
    
    logger.info('[Schema Batch Updater] Committing batch', {
      file: 'schema-change-debouncer.ts',
      schemaId: this.schemaId,
      changeCount: this.changes.length,
    });
    
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const { PLATFORM_ID } = await import('@/lib/constants/platform');

      // Get current schema
      const schemaData = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.WORKSPACES}/${this.workspaceId}/${COLLECTIONS.SCHEMAS}`,
        this.schemaId
      );

      if (schemaData === null) {
        throw new Error(`Schema ${this.schemaId} not found`);
      }

      let updatedSchema: Schema = { ...schemaData } as Schema;

      // Apply all changes
      for (const change of this.changes) {
        updatedSchema = this.applyChange(updatedSchema, change);
      }

      // Save schema with version increment
      const newVersion = (updatedSchema.version ?? 1) + 1;
      const updatedAt = new Date().toISOString();
      updatedSchema = {
        ...updatedSchema,
        version: newVersion,
        updatedAt: updatedAt as unknown as Schema['updatedAt'],
      };

      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.WORKSPACES}/${this.workspaceId}/${COLLECTIONS.SCHEMAS}`,
        this.schemaId,
        updatedSchema,
        false
      );

      // Publish single batch event
      const { SchemaChangeEventPublisher } = await import('./schema-change-tracker');
      const { Timestamp } = await import('firebase/firestore');
      await SchemaChangeEventPublisher.publishEvent({
        id: `sce_batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workspaceId: this.workspaceId,
        schemaId: this.schemaId,
        timestamp: Timestamp.now(),
        changeType: 'field_renamed', // Generic type for batch
        affectedSystems: [],
        processed: false,
        createdAt: Timestamp.now(),
      });
      
      logger.info('[Schema Batch Updater] Batch committed successfully', {
        file: 'schema-change-debouncer.ts',
        schemaId: this.schemaId,
        changeCount: this.changes.length,
      });
      
      // Clear changes
      this.changes = [];
      
    } catch (error) {
      logger.error('[Schema Batch Updater] Batch commit failed', error instanceof Error ? error : new Error(String(error)), {
        file: 'schema-change-debouncer.ts',
        schemaId: this.schemaId,
      });
      throw error;
    }
  }
  
  /**
   * Apply single change to schema
   */
  private applyChange(schema: Schema, change: SchemaChange): Schema {
    const updatedSchema: Schema = { ...schema };

    switch (change.type) {
      case 'field_update':
        if (change.fieldId !== undefined && change.updates !== undefined) {
          const fieldIndex = updatedSchema.fields.findIndex((f) => f.id === change.fieldId);
          if (fieldIndex !== -1) {
            updatedSchema.fields[fieldIndex] = {
              ...updatedSchema.fields[fieldIndex],
              ...(change.updates as Partial<SchemaField>),
            };
          }
        }
        break;

      case 'field_add':
        if (change.field !== undefined) {
          updatedSchema.fields.push(change.field as SchemaField);
        }
        break;

      case 'field_delete':
        if (change.fieldId !== undefined) {
          updatedSchema.fields = updatedSchema.fields.filter((f) => f.id !== change.fieldId);
        }
        break;

      case 'schema_update':
        if (change.updates !== undefined) {
          Object.assign(updatedSchema, change.updates);
        }
        break;
    }

    return updatedSchema;
  }
  
  /**
   * Get pending change count
   */
  getChangeCount(): number {
    return this.changes.length;
  }
  
  /**
   * Cancel batch
   */
  cancel(): void {
    this.changes = [];
    logger.info('[Schema Batch Updater] Batch cancelled', {
      file: 'schema-change-debouncer.ts',
      schemaId: this.schemaId,
    });
  }
}



