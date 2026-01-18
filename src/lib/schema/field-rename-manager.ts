/**
 * Field Rename Manager
 * Manages field rename history and rollback functionality
 */

import type { Schema, SchemaField, FieldRenameRecord } from '@/types/schema';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';

/**
 * Field Rename Manager
 */
export class FieldRenameManager {
  /**
   * Add rename record to field history
   */
  static addRenameRecord(
    field: SchemaField,
    newKey: string,
    newLabel: string,
    userId: string,
    reason?: string
  ): SchemaField {
    const renameHistory = field.renameHistory ?? [];
    
    const renameRecord: FieldRenameRecord = {
      timestamp: Timestamp.now(),
      oldKey: field.key,
      newKey: newKey,
      oldLabel: field.label,
      newLabel: newLabel,
      renamedBy: userId,
      reason,
    };
    
    renameHistory.push(renameRecord);
    
    return {
      ...field,
      key: newKey,
      label: newLabel,
      renameHistory,
      updatedAt: Timestamp.now(),
    };
  }
  
  /**
   * Get rename history for a field
   */
  static getRenameHistory(field: SchemaField): FieldRenameRecord[] {
    return field.renameHistory ?? [];
  }
  
  /**
   * Get field name at specific version
   */
  static getFieldNameAtVersion(
    field: SchemaField,
    version: number
  ): { key: string; label: string } | null {
    const history = this.getRenameHistory(field);
    
    if (version < 0 || version >= history.length) {
      return null;
    }
    
    const record = history[version];
    return {
      key: record.oldKey,
      label: record.oldLabel,
    };
  }
  
  /**
   * Rollback field to previous name
   */
  static async rollbackField(
    organizationId: string,
    workspaceId: string,
    schemaId: string,
    fieldId: string,
    toVersion: number,
    userId: string
  ): Promise<void> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      
      // Get schema
      const schema = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.SCHEMAS}`,
        schemaId
      ) as Schema;
      
      if (!schema) {
        throw new Error(`Schema ${schemaId} not found`);
      }
      
      // Find field
      const fieldIndex = schema.fields.findIndex(f => f.id === fieldId);
      if (fieldIndex === -1) {
        throw new Error(`Field ${fieldId} not found`);
      }
      
      const field = schema.fields[fieldIndex];
      const history = this.getRenameHistory(field);
      
      if (!history || history.length === 0) {
        throw new Error('No rename history found');
      }
      
      if (toVersion < 0 || toVersion >= history.length) {
        throw new Error(`Invalid version ${toVersion}. History has ${history.length} entries.`);
      }
      
      // Get target version
      const targetRecord = history[toVersion];
      
      logger.info('[Field Rename Manager] Rolling back field', {
        file: 'field-rename-manager.ts',
        fieldId,
        currentKey: field.key,
        targetKey: targetRecord.oldKey,
        toVersion,
      });
      
      // Create rollback record
      const rollbackRecord: FieldRenameRecord = {
        timestamp: Timestamp.now(),
        oldKey: field.key,
        newKey: targetRecord.oldKey,
        oldLabel: field.label,
        newLabel: targetRecord.oldLabel,
        renamedBy: userId,
        reason: `Rollback to version ${toVersion}`,
      };
      
      // Update field
      const updatedField: SchemaField = {
        ...field,
        key: targetRecord.oldKey,
        label: targetRecord.oldLabel,
        renameHistory: [...history, rollbackRecord],
        updatedAt: Timestamp.now(),
      };
      
      // Update schema
      const updatedFields = [...schema.fields];
      updatedFields[fieldIndex] = updatedField;
      
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.SCHEMAS}`,
        schemaId,
        {
          ...schema,
          fields: updatedFields,
          version: schema.version + 1,
          updatedAt: Timestamp.now(),
        },
        false
      );
      
      logger.info('[Field Rename Manager] Rollback complete', {
        file: 'field-rename-manager.ts',
        fieldId,
        newKey: targetRecord.oldKey,
      });
      
    } catch (error) {
      logger.error('[Field Rename Manager] Rollback failed', error instanceof Error ? error : new Error(String(error)), {
        file: 'field-rename-manager.ts',
        fieldId,
        toVersion,
      });
      throw error;
    }
  }
  
  /**
   * Get all aliases for a field (current + historical names)
   */
  static getAllAliases(field: SchemaField): string[] {
    const aliases = new Set<string>();
    
    // Add current key
    aliases.add(field.key);
    
    // Add all historical keys
    const history = this.getRenameHistory(field);
    for (const record of history) {
      aliases.add(record.oldKey);
      aliases.add(record.newKey);
    }
    
    return Array.from(aliases);
  }
  
  /**
   * Check if field was ever named a certain way
   */
  static wasEverNamed(field: SchemaField, searchKey: string): boolean {
    // Check current name
    if (field.key === searchKey) {
      return true;
    }
    
    // Check history
    const history = this.getRenameHistory(field);
    for (const record of history) {
      if (record.oldKey === searchKey || record.newKey === searchKey) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get rename timeline for a field
   */
  static getRenameTimeline(field: SchemaField): Array<{
    version: number;
    key: string;
    label: string;
    timestamp: Timestamp;
    renamedBy: string;
    reason?: string;
  }> {
    const timeline = [];
    const history = this.getRenameHistory(field);
    
    for (let i = 0; i < history.length; i++) {
      const record = history[i];
      timeline.push({
        version: i,
        key: record.newKey,
        label: record.newLabel,
        timestamp: record.timestamp,
        renamedBy: record.renamedBy,
        reason: record.reason,
      });
    }
    
    // Add current version
    if (history.length > 0) {
      timeline.push({
        version: history.length,
        key: field.key,
        label: field.label,
        timestamp: field.updatedAt,
        renamedBy: history[history.length - 1].renamedBy,
        reason: 'Current version',
      });
    }
    
    return timeline;
  }
  
  /**
   * Create notification for field rollback
   */
  static async notifyFieldRollback(
    organizationId: string,
    workspaceId: string,
    schemaId: string,
    schemaName: string,
    field: SchemaField,
    oldKey: string,
    newKey: string
  ): Promise<void> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      
      const notificationPath = `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/notifications`;
      const notificationId = `notif_rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await FirestoreService.set(
        notificationPath,
        notificationId,
        {
          id: notificationId,
          organizationId,
          workspaceId,
          title: 'Field Rolled Back',
          message: `Field "${field.label}" in schema "${schemaName}" was rolled back from "${oldKey}" to "${newKey}"`,
          type: 'info',
          category: 'field_rollback',
          metadata: {
            schemaId,
            fieldId: field.id,
            oldKey,
            newKey,
          },
          read: false,
          createdAt: new Date().toISOString(),
        },
        false
      );
      
    } catch (error) {
      logger.error('[Field Rename Manager] Failed to create rollback notification', error instanceof Error ? error : new Error(String(error)), {
        file: 'field-rename-manager.ts',
      });
    }
  }
}



