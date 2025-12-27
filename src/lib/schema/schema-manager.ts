/**
 * Schema Manager
 * Core system for creating, updating, and managing custom objects (schemas)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { Schema, SchemaField, SchemaRelation, FieldType } from '@/types/schema';

export class SchemaManager {
  private db: Firestore;
  private workspaceId: string;

  constructor(db: Firestore, workspaceId: string) {
    this.db = db;
    this.workspaceId = workspaceId;
  }

  /**
   * Get schemas collection ref
   */
  private getSchemasRef() {
    return collection(
      this.db,
      'workspaces',
      this.workspaceId,
      'schemas'
    );
  }

  /**
   * Get single schema ref
   */
  private getSchemaRef(schemaId: string) {
    return doc(this.db, 'workspaces', this.workspaceId, 'schemas', schemaId);
  }

  /**
   * Create a new schema (custom object)
   */
  async createSchema(schema: Partial<Schema>, userId: string): Promise<Schema> {
    const schemaId = this.generateSchemaId(schema.name!);
    
    const newSchema: Schema = {
      id: schemaId,
      workspaceId: this.workspaceId,
      name: schema.name!,
      pluralName: schema.pluralName || schema.name!,
      singularName: schema.singularName || schema.name!,
      description: schema.description,
      icon: schema.icon || '📋',
      color: schema.color || '#3B82F6',
      
      // Start with empty fields, user will add them
      fields: schema.fields || this.getDefaultFields(),
      
      // Set first field as primary
      primaryFieldId: schema.fields?.[0]?.id || 'field_name',
      
      relations: [],
      permissions: {
        create: ['admin', 'editor'],
        read: ['admin', 'editor', 'viewer'],
        update: ['admin', 'editor'],
        delete: ['admin']
      },
      settings: {
        allowAttachments: true,
        allowComments: true,
        allowActivityLog: true,
        enableVersioning: false
      },
      
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      createdBy: userId,
      status: 'active',
      version: 1
    };

    await setDoc(this.getSchemaRef(schemaId), newSchema);
    
    // Create collection for entities of this schema
    await this.initializeEntityCollection(schemaId);
    
    return newSchema;
  }

  /**
   * Get default fields for new schema
   */
  private getDefaultFields(): SchemaField[] {
    return [
      {
        id: 'field_name',
        key: 'name',
        label: 'Name',
        description: 'Primary identifier for this record',
        type: 'text',
        config: {
          type: 'text',
          maxLength: 255
        },
        required: true,
        unique: false,
        readonly: false,
        hidden: false,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      }
    ];
  }

  /**
   * Initialize entity collection with metadata doc
   */
  private async initializeEntityCollection(schemaId: string) {
    const metadataRef = doc(
      this.db,
      'workspaces',
      this.workspaceId,
      'entities',
      schemaId,
      '_metadata',
      'info'
    );
    
    await setDoc(metadataRef, {
      schemaId,
      createdAt: serverTimestamp(),
      recordCount: 0
    });
  }

  /**
   * Get all schemas
   */
  async getSchemas(): Promise<Schema[]> {
    const q = query(this.getSchemasRef(), where('status', '==', 'active'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => doc.data() as Schema);
  }

  /**
   * Get single schema
   */
  async getSchema(schemaId: string): Promise<Schema | null> {
    const docSnap = await getDoc(this.getSchemaRef(schemaId));
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return docSnap.data() as Schema;
  }

  /**
   * Update schema
   */
  async updateSchema(
    schemaId: string,
    updates: Partial<Schema>,
    userId: string
  ): Promise<void> {
    const schema = await this.getSchema(schemaId);
    
    if (!schema) {
      throw new Error(`Schema ${schemaId} not found`);
    }

    // Detect schema changes before updating
    const organizationId = await this.getOrganizationId();
    if (organizationId) {
      await this.detectAndPublishChanges(schema, updates, organizationId);
    }

    // Increment version if fields changed
    const version = updates.fields ? schema.version + 1 : schema.version;

    await updateDoc(this.getSchemaRef(schemaId), {
      ...updates,
      version,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });
  }

  /**
   * Detect and publish schema changes
   */
  private async detectAndPublishChanges(
    oldSchema: Schema,
    updates: Partial<Schema>,
    organizationId: string
  ): Promise<void> {
    try {
      // Create a new schema object with updates applied
      const newSchema: Schema = {
        ...oldSchema,
        ...updates,
      };

      // Detect changes
      const { SchemaChangeDetector } = await import('./schema-change-tracker');
      const events = SchemaChangeDetector.detectChanges(oldSchema, newSchema, organizationId);

      // Add events to debouncer (batches rapid changes)
      if (events.length > 0) {
        const { SchemaChangeDebouncer } = await import('./schema-change-debouncer');
        const debouncer = SchemaChangeDebouncer.getInstance(5000); // 5 second debounce
        
        for (const event of events) {
          await debouncer.addEvent(event);
        }
      }
    } catch (error) {
      // Log error but don't fail the update
      console.error('[Schema Manager] Failed to detect/publish changes:', error);
    }
  }

  /**
   * Get organization ID from workspace
   */
  private async getOrganizationId(): Promise<string | null> {
    try {
      const workspaceDoc = await getDoc(doc(this.db, 'workspaces', this.workspaceId));
      if (workspaceDoc.exists()) {
        return (workspaceDoc.data() as any).organizationId || null;
      }
      return null;
    } catch (error) {
      console.error('[Schema Manager] Failed to get organization ID:', error);
      return null;
    }
  }

  /**
   * Delete schema (soft delete)
   */
  async deleteSchema(schemaId: string, userId: string): Promise<void> {
    // Check for dependencies (relations)
    const relations = await this.getSchemaRelations(schemaId);
    
    if (relations.length > 0) {
      throw new Error(
        `Cannot delete schema. It has ${relations.length} active relations. ` +
        `Please remove relations first.`
      );
    }

    // Soft delete
    await updateDoc(this.getSchemaRef(schemaId), {
      status: 'archived',
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });
  }

  /**
   * Hard delete schema (permanent)
   * WARNING: This will delete all entity data
   */
  async hardDeleteSchema(schemaId: string): Promise<void> {
    // Delete all entities first
    await this.deleteAllEntities(schemaId);
    
    // Delete schema document
    await deleteDoc(this.getSchemaRef(schemaId));
  }

  /**
   * Add field to schema
   */
  async addField(
    schemaId: string,
    field: Omit<SchemaField, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<SchemaField> {
    const schema = await this.getSchema(schemaId);
    
    if (!schema) {
      throw new Error(`Schema ${schemaId} not found`);
    }

    // Generate field ID
    const fieldId = this.generateFieldId(field.key);
    
    // Create full field object
    const newField: SchemaField = {
      ...field,
      id: fieldId,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp
    };

    // Add to fields array
    const updatedFields = [...schema.fields, newField];

    await this.updateSchema(schemaId, { fields: updatedFields }, userId);
    
    return newField;
  }

  /**
   * Update field
   */
  async updateField(
    schemaId: string,
    fieldId: string,
    updates: Partial<SchemaField>,
    userId: string
  ): Promise<void> {
    const schema = await this.getSchema(schemaId);
    
    if (!schema) {
      throw new Error(`Schema ${schemaId} not found`);
    }

    const fieldIndex = schema.fields.findIndex(f => f.id === fieldId);
    
    if (fieldIndex === -1) {
      throw new Error(`Field ${fieldId} not found in schema ${schemaId}`);
    }

    const currentField = schema.fields[fieldIndex];

    // Track rename history if key or label changed
    if ((updates.key && updates.key !== currentField.key) || 
        (updates.label && updates.label !== currentField.label)) {
      const { FieldRenameManager } = await import('./field-rename-manager');
      
      const updatedField = FieldRenameManager.addRenameRecord(
        currentField,
        updates.key || currentField.key,
        updates.label || currentField.label,
        userId
      );
      
      updates = { ...updates, renameHistory: updatedField.renameHistory };
    }

    // Update field
    const updatedFields = [...schema.fields];
    updatedFields[fieldIndex] = {
      ...updatedFields[fieldIndex],
      ...updates,
      updatedAt: serverTimestamp() as Timestamp
    };

    await this.updateSchema(schemaId, { fields: updatedFields }, userId);
  }

  /**
   * Remove field from schema
   */
  async removeField(
    schemaId: string,
    fieldId: string,
    userId: string
  ): Promise<void> {
    const schema = await this.getSchema(schemaId);
    
    if (!schema) {
      throw new Error(`Schema ${schemaId} not found`);
    }

    // Don't allow removing primary field
    if (fieldId === schema.primaryFieldId) {
      throw new Error('Cannot remove primary field');
    }

    // Check for dependencies (lookups, rollups, etc.)
    const dependencies = this.findFieldDependencies(schema, fieldId);
    
    if (dependencies.length > 0) {
      throw new Error(
        `Cannot remove field. ${dependencies.length} other fields depend on it: ` +
        dependencies.map(f => f.label).join(', ')
      );
    }

    // Remove field
    const updatedFields = schema.fields.filter(f => f.id !== fieldId);

    await this.updateSchema(schemaId, { fields: updatedFields }, userId);
  }

  /**
   * Reorder fields
   */
  async reorderFields(
    schemaId: string,
    fieldIds: string[],
    userId: string
  ): Promise<void> {
    const schema = await this.getSchema(schemaId);
    
    if (!schema) {
      throw new Error(`Schema ${schemaId} not found`);
    }

    // Reorder fields based on fieldIds array
    const reorderedFields = fieldIds.map(id => 
      schema.fields.find(f => f.id === id)
    ).filter(Boolean) as SchemaField[];

    // Add any fields not in fieldIds to the end
    const remainingFields = schema.fields.filter(
      f => !fieldIds.includes(f.id)
    );

    const updatedFields = [...reorderedFields, ...remainingFields];

    await this.updateSchema(schemaId, { fields: updatedFields }, userId);
  }

  /**
   * Create relationship between schemas
   */
  async createRelation(
    relation: Omit<SchemaRelation, 'id' | 'createdAt'>,
    userId: string
  ): Promise<SchemaRelation> {
    const { fromSchemaId, toSchemaId } = relation;

    // Validate both schemas exist
    const fromSchema = await this.getSchema(fromSchemaId);
    const toSchema = await this.getSchema(toSchemaId);

    if (!fromSchema || !toSchema) {
      throw new Error('One or both schemas not found');
    }

    // Generate relation ID
    const relationId = this.generateRelationId(fromSchemaId, toSchemaId);

    const newRelation: SchemaRelation = {
      ...relation,
      id: relationId,
      createdAt: serverTimestamp() as Timestamp
    };

    // Add relation to from schema
    const fromUpdatedRelations = [...fromSchema.relations, newRelation];
    await this.updateSchema(fromSchemaId, { relations: fromUpdatedRelations }, userId);

    // If many-to-many or bidirectional, add reverse relation to toSchema
    if (relation.type === 'many-to-many' || relation.toFieldId) {
      const reverseRelation: SchemaRelation = {
        ...newRelation,
        fromSchemaId: toSchemaId,
        toSchemaId: fromSchemaId,
        fromFieldId: relation.toFieldId || relation.fromFieldId,
        toFieldId: relation.fromFieldId
      };

      const toUpdatedRelations = [...toSchema.relations, reverseRelation];
      await this.updateSchema(toSchemaId, { relations: toUpdatedRelations }, userId);
    }

    return newRelation;
  }

  /**
   * Remove relationship
   */
  async removeRelation(
    fromSchemaId: string,
    relationId: string,
    userId: string
  ): Promise<void> {
    const schema = await this.getSchema(fromSchemaId);
    
    if (!schema) {
      throw new Error(`Schema ${fromSchemaId} not found`);
    }

    const relation = schema.relations.find(r => r.id === relationId);
    
    if (!relation) {
      throw new Error(`Relation ${relationId} not found`);
    }

    // Remove relation
    const updatedRelations = schema.relations.filter(r => r.id !== relationId);
    await this.updateSchema(fromSchemaId, { relations: updatedRelations }, userId);

    // Remove reverse relation if exists
    const toSchema = await this.getSchema(relation.toSchemaId);
    if (toSchema) {
      const toUpdatedRelations = toSchema.relations.filter(
        r => !(r.fromSchemaId === relation.toSchemaId && r.toSchemaId === relation.fromSchemaId)
      );
      await this.updateSchema(relation.toSchemaId, { relations: toUpdatedRelations }, userId);
    }
  }

  /**
   * Get all relations for a schema
   */
  async getSchemaRelations(schemaId: string): Promise<SchemaRelation[]> {
    const schema = await this.getSchema(schemaId);
    
    if (!schema) {
      return [];
    }

    return schema.relations;
  }

  /**
   * Find dependencies on a field (for validation)
   */
  private findFieldDependencies(schema: Schema, fieldId: string): SchemaField[] {
    return schema.fields.filter(field => {
      // Check lookup fields
      if (field.type === 'lookup') {
        const config = field.config as any;
        return config.linkFieldId === fieldId || config.lookupFieldId === fieldId;
      }
      
      // Check rollup fields
      if (field.type === 'rollup') {
        const config = field.config as any;
        return config.linkFieldId === fieldId || config.rollupFieldId === fieldId;
      }
      
      // Check formula fields (basic check)
      if (field.type === 'formula') {
        const config = field.config as any;
        return config.formula?.includes(fieldId);
      }
      
      return false;
    });
  }

  /**
   * Delete all entities in a schema
   */
  private async deleteAllEntities(schemaId: string): Promise<void> {
    // This is a heavy operation - in production, use Cloud Functions or batch operations
    const entitiesRef = collection(
      this.db,
      'workspaces',
      this.workspaceId,
      'entities',
      schemaId,
      'records'
    );
    
    const snapshot = await getDocs(entitiesRef);
    
    // Delete in batches
    const batch = [];
    for (const doc of snapshot.docs) {
      batch.push(deleteDoc(doc.ref));
      
      // Execute in batches of 500
      if (batch.length >= 500) {
        await Promise.all(batch);
        batch.length = 0;
      }
    }
    
    if (batch.length > 0) {
      await Promise.all(batch);
    }
  }

  /**
   * Generate schema ID from name
   */
  private generateSchemaId(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    
    return `schema_${slug}_${Date.now()}`;
  }

  /**
   * Generate field ID from key
   */
  private generateFieldId(key: string): string {
    return `field_${key}_${Date.now()}`;
  }

  /**
   * Generate relation ID
   */
  private generateRelationId(fromId: string, toId: string): string {
    return `rel_${fromId}_${toId}_${Date.now()}`;
  }

  /**
   * Validate field type
   */
  validateFieldType(type: FieldType, config: any): boolean {
    // Add validation logic based on field type
    switch (type) {
      case 'text':
      case 'longText':
      case 'email':
      case 'url':
      case 'phoneNumber':
        return typeof config.maxLength === 'undefined' || typeof config.maxLength === 'number';
      
      case 'number':
      case 'currency':
      case 'percent':
        return typeof config.min === 'undefined' || typeof config.min === 'number';
      
      case 'singleSelect':
      case 'multiSelect':
        return Array.isArray(config.options) && config.options.length > 0;
      
      case 'linkToRecord':
        return typeof config.linkedSchemaId === 'string';
      
      case 'lookup':
        return typeof config.linkFieldId === 'string' && typeof config.lookupFieldId === 'string';
      
      case 'rollup':
        return typeof config.linkFieldId === 'string' && typeof config.rollupFieldId === 'string';
      
      case 'formula':
        return typeof config.formula === 'string';
      
      default:
        return true;
    }
  }

  /**
   * Clone schema (for templates)
   */
  async cloneSchema(
    sourceSchemaId: string,
    newName: string,
    userId: string
  ): Promise<Schema> {
    const sourceSchema = await this.getSchema(sourceSchemaId);
    
    if (!sourceSchema) {
      throw new Error(`Schema ${sourceSchemaId} not found`);
    }

    // Clone schema with new name
    const clonedSchema: Partial<Schema> = {
      ...sourceSchema,
      name: newName,
      pluralName: newName,
      singularName: newName,
      fields: sourceSchema.fields.map(field => ({
        ...field,
        id: this.generateFieldId(field.key),
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      })),
      relations: [] // Don't clone relations
    };

    delete (clonedSchema as any).id;

    return this.createSchema(clonedSchema, userId);
  }
}


