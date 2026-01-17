/**
 * Integration Field Mapper
 * Manages field mappings between internal CRM fields and external integration fields
 */

import { logger } from '@/lib/logger/logger';
import { FieldResolver } from '@/lib/schema/field-resolver';
import type { SchemaChangeEvent } from '@/lib/schema/schema-change-tracker';
import { executeCustomTransform } from './custom-transforms';
import type { QueryConstraint } from 'firebase/firestore';

/**
 * Integration Field Mapping
 * Maps internal CRM fields to external system fields
 */
export interface IntegrationFieldMapping {
  id: string;
  integrationId: string;
  integrationName: string; // 'salesforce', 'hubspot', 'shopify', etc.
  organizationId: string;
  workspaceId: string;
  
  // Schema this mapping applies to
  schemaId: string;
  schemaName: string;
  
  // Field mappings
  mappings: FieldMappingRule[];
  
  // Settings
  settings: {
    autoSync: boolean;
    syncDirection: 'one-way' | 'two-way' | 'inbound' | 'outbound';
    conflictResolution: 'local_wins' | 'remote_wins' | 'newest_wins' | 'manual';
  };
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastSyncedAt?: string;
}

/**
 * Field Mapping Rule
 */
export interface FieldMappingRule {
  id: string;
  
  // Internal field (CRM)
  localField: string; // Field key in schema
  localFieldLabel?: string; // Field label for display
  
  // External field (Integration)
  externalField: string; // Field name in external system
  externalFieldLabel?: string; // Field label for display
  
  // Mapping configuration
  required: boolean;
  readonly: boolean; // Don't sync changes to this field
  
  // Transformation
  transform?: FieldTransform;
  
  // Validation
  validationRules?: ValidationRule[];
}

/**
 * Field Transform
 */
export interface FieldTransform {
  type: 'uppercase' | 'lowercase' | 'trim' | 'phone' | 'currency' | 'date' | 'custom';
  format?: string; // For date/currency formatting
  customFunction?: string; // Custom transform function name
  params?: Record<string, unknown>; // Parameters for custom transform functions
  direction?: 'inbound' | 'outbound' | 'both'; // When to apply transform
}

/**
 * Validation Rule
 */
export interface ValidationRule {
  type: 'regex' | 'min' | 'max' | 'length' | 'enum';
  value: unknown;
  message?: string;
}

/**
 * Field Mapping Manager
 */
export class FieldMappingManager {
  /**
   * Create integration field mapping
   */
  static async createFieldMapping(
    mapping: Omit<IntegrationFieldMapping, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<IntegrationFieldMapping> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      
      const mappingId = `mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const fullMapping: IntegrationFieldMapping = {
        ...mapping,
        id: mappingId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const mappingsPath = `${COLLECTIONS.ORGANIZATIONS}/${mapping.organizationId}/integrationFieldMappings`;
      
      await FirestoreService.set(mappingsPath, mappingId, fullMapping, false);
      
      logger.info('[Field Mapper] Created field mapping', {
        file: 'field-mapper.ts',
        mappingId,
        integrationName: mapping.integrationName,
      });
      
      return fullMapping;
    } catch (error) {
      logger.error('[Field Mapper] Failed to create field mapping', error, {
        file: 'field-mapper.ts',
      });
      throw error;
    }
  }
  
  /**
   * Get field mapping for integration
   */
  static async getFieldMapping(
    organizationId: string,
    integrationId: string,
    schemaId?: string
  ): Promise<IntegrationFieldMapping | null> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const { where } = await import('firebase/firestore');
      
      const mappingsPath = `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrationFieldMappings`;
      
      const filters: QueryConstraint[] = [
        where('integrationId', '==', integrationId),
      ];
      
      if (schemaId) {
        filters.push(where('schemaId', '==', schemaId));
      }
      
      const mappings = await FirestoreService.getAll(mappingsPath, filters);
      
      return mappings.length > 0 ? (mappings[0] as IntegrationFieldMapping) : null;
    } catch (error) {
      logger.error('[Field Mapper] Failed to get field mapping', error, {
        file: 'field-mapper.ts',
        integrationId,
      });
      return null;
    }
  }
  
  /**
   * Update field mapping
   */
  static async updateFieldMapping(
    organizationId: string,
    mappingId: string,
    updates: Partial<IntegrationFieldMapping>
  ): Promise<void> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      
      const mappingsPath = `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrationFieldMappings`;
      
      const existing = await FirestoreService.get(mappingsPath, mappingId);
      
      if (!existing) {
        throw new Error(`Field mapping ${mappingId} not found`);
      }
      
      await FirestoreService.set(
        mappingsPath,
        mappingId,
        {
          ...existing,
          ...updates,
          updatedAt: new Date().toISOString(),
        },
        false
      );
      
      logger.info('[Field Mapper] Updated field mapping', {
        file: 'field-mapper.ts',
        mappingId,
      });
    } catch (error) {
      logger.error('[Field Mapper] Failed to update field mapping', error, {
        file: 'field-mapper.ts',
        mappingId,
      });
      throw error;
    }
  }
  
  /**
   * Adapt field mapping to schema changes
   */
  static async adaptToSchemaChange(
    event: SchemaChangeEvent
  ): Promise<void> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const { where } = await import('firebase/firestore');
      
      // Get all field mappings for this schema
      const mappingsPath = `${COLLECTIONS.ORGANIZATIONS}/${event.organizationId}/integrationFieldMappings`;
      const mappings = await FirestoreService.getAll(mappingsPath, [
        where('schemaId', '==', event.schemaId),
      ] as QueryConstraint[]);
      
      if (mappings.length === 0) {
        logger.info('[Field Mapper] No field mappings found for schema', {
          file: 'field-mapper.ts',
          schemaId: event.schemaId,
        });
        return;
      }
      
      // Update each mapping
      for (const mapping of mappings) {
        const fieldMapping = mapping as IntegrationFieldMapping;
        let updated = false;
        
        switch (event.changeType) {
          case 'field_renamed':
          case 'field_key_changed': {
            const oldKey = (event.oldFieldKey !== '' && event.oldFieldKey != null) ? event.oldFieldKey : 
              ((event.oldFieldName !== '' && event.oldFieldName != null) ? event.oldFieldName : '');
            const newKey = (event.newFieldKey !== '' && event.newFieldKey != null) ? event.newFieldKey :
              ((event.newFieldName !== '' && event.newFieldName != null) ? event.newFieldName : '');
            updated = await this.handleFieldRenameInMapping(
              fieldMapping,
              oldKey,
              newKey
            );
            break;
          }
          
          case 'field_deleted': {
            const deletedKey = (event.oldFieldKey !== '' && event.oldFieldKey != null) ? event.oldFieldKey :
              ((event.oldFieldName !== '' && event.oldFieldName != null) ? event.oldFieldName : '');
            updated = await this.handleFieldDeletionInMapping(
              fieldMapping,
              deletedKey
            );
            break;
          }
        }
        
        if (updated) {
          await this.updateFieldMapping(
            event.organizationId,
            fieldMapping.id,
            { mappings: fieldMapping.mappings }
          );
        }
      }
      
    } catch (error) {
      logger.error('[Field Mapper] Failed to adapt to schema change', error, {
        file: 'field-mapper.ts',
        eventId: event.id,
      });
    }
  }
  
  /**
   * Handle field rename in mapping
   */
  private static handleFieldRenameInMapping(
    mapping: IntegrationFieldMapping,
    oldFieldKey: string,
    newFieldKey: string
  ): Promise<boolean> {
    let updated = false;
    
    for (const rule of mapping.mappings) {
      if (rule.localField === oldFieldKey) {
        rule.localField = newFieldKey;
        updated = true;
        
        logger.info('[Field Mapper] Updated field mapping rule', {
          file: 'field-mapper.ts',
          mappingId: mapping.id,
          ruleId: rule.id,
          oldKey: oldFieldKey,
          newKey: newFieldKey,
        });
      }
    }
    
    return updated;
  }
  
  /**
   * Handle field deletion in mapping
   */
  private static handleFieldDeletionInMapping(
    mapping: IntegrationFieldMapping,
    deletedFieldKey: string
  ): Promise<boolean> {
    let updated = false;
    
    // Find rules using the deleted field
    const affectedRules = mapping.mappings.filter(
      rule => rule.localField === deletedFieldKey
    );
    
    if (affectedRules.length > 0) {
      // Mark as needing user action
      for (const rule of affectedRules) {
        rule.readonly = true; // Disable sync for this field
        updated = true;
        
        logger.warn('[Field Mapper] Field deleted - mapping disabled', {
          file: 'field-mapper.ts',
          mappingId: mapping.id,
          ruleId: rule.id,
          deletedField: deletedFieldKey,
        });
      }
    }
    
    return updated;
  }
  
  /**
   * Map local record to external format
   */
  static async mapLocalToExternal(
    localRecord: Record<string, unknown>,
    mapping: IntegrationFieldMapping,
    schema: Record<string, unknown>
  ): Promise<Record<string, any>> {
    const externalRecord: Record<string, unknown> = {};
    
    for (const rule of mapping.mappings) {
      if (rule.readonly && mapping.settings.syncDirection === 'outbound') {
        continue; // Skip readonly fields for outbound sync
      }
      
      // Get local value using field resolver
      const value = FieldResolver.getFieldValue(localRecord, rule.localField, schema);
      
      if (value === undefined || value === null) {
        if (rule.required) {
          logger.warn('[Field Mapper] Required field missing', {
            file: 'field-mapper.ts',
            field: rule.localField,
          });
        }
        continue;
      }
      
      // Apply transformation
      let transformedValue = value;
      if (rule.transform && this.shouldApplyTransform(rule.transform, 'outbound')) {
        transformedValue = await this.applyTransform(value, rule.transform);
      }
      
      // Validate
      if (rule.validationRules) {
        const valid = await this.validateValue(transformedValue, rule.validationRules);
        if (!valid) {
          logger.warn('[Field Mapper] Validation failed', {
            file: 'field-mapper.ts',
            field: rule.localField,
            value: transformedValue,
          });
          continue;
        }
      }
      
      externalRecord[rule.externalField] = transformedValue;
    }
    
    return externalRecord;
  }
  
  /**
   * Map external record to local format
   */
  static async mapExternalToLocal(
    externalRecord: Record<string, unknown>,
    mapping: IntegrationFieldMapping,
    schema: Record<string, unknown>
  ): Promise<Record<string, any>> {
    const localRecord: Record<string, unknown> = {};
    
    for (const rule of mapping.mappings) {
      if (rule.readonly && mapping.settings.syncDirection === 'inbound') {
        continue; // Skip readonly fields for inbound sync
      }
      
      const value = externalRecord[rule.externalField];
      
      if (value === undefined || value === null) {
        continue;
      }
      
      // Apply transformation
      let transformedValue = value;
      if (rule.transform && this.shouldApplyTransform(rule.transform, 'inbound')) {
        transformedValue = await this.applyTransform(value, rule.transform);
      }
      
      // Resolve local field (in case it was renamed)
      const resolvedField = await FieldResolver.resolveField(schema, rule.localField);
      
      if (!resolvedField) {
        logger.warn('[Field Mapper] Local field not found', {
          file: 'field-mapper.ts',
          field: rule.localField,
        });
        continue;
      }
      
      localRecord[resolvedField.fieldKey] = transformedValue;
    }
    
    return localRecord;
  }
  
  /**
   * Check if transform should be applied for direction
   */
  private static shouldApplyTransform(
    transform: FieldTransform,
    direction: 'inbound' | 'outbound'
  ): boolean {
    if (!transform.direction || transform.direction === 'both') {
      return true;
    }
    return transform.direction === direction;
  }
  
  /**
   * Apply field transformation
   */
  private static async applyTransform(
    value: unknown,
    transform: FieldTransform
  ): Promise<unknown> {
    switch (transform.type) {
      case 'uppercase':
        return String(value).toUpperCase();
      
      case 'lowercase':
        return String(value).toLowerCase();
      
      case 'trim':
        return String(value).trim();
      
      case 'phone':
        // Normalize phone number (remove non-digits)
        return String(value).replace(/\D/g, '');
      
      case 'currency': {
        // Format as currency
        const amount = parseFloat(value);
        return isNaN(amount) ? value : amount.toFixed(2);
      }
      
      case 'date': {
        // Format date
        if (transform.format) {
          // Apply date formatting (would use date-fns or similar)
          return new Date(value).toISOString();
        }
        return value;
      }
      
      case 'custom': {
        // Execute custom transform function from registry
        if (transform.customFunction) {
          const result = executeCustomTransform(
            transform.customFunction,
            value,
            transform.params
          );
          
          if (result.success) {
            return result.value;
          } else {
            logger.warn('[Field Mapper] Custom transform failed', {
              function: transform.customFunction,
              error: result.error,
              file: 'field-mapper.ts',
            });
          }
        }
        return value;
      }
      
      default:
        return value;
    }
  }
  
  /**
   * Validate value against rules
   */
  private static async validateValue(
    value: unknown,
    rules: ValidationRule[]
  ): Promise<boolean> {
    for (const rule of rules) {
      switch (rule.type) {
        case 'regex': {
          const regex = new RegExp(rule.value);
          if (!regex.test(String(value))) {
            return false;
          }
          break;
        }
        
        case 'min':
          if (Number(value) < Number(rule.value)) {
            return false;
          }
          break;
        
        case 'max':
          if (Number(value) > Number(rule.value)) {
            return false;
          }
          break;
        
        case 'length':
          if (String(value).length !== Number(rule.value)) {
            return false;
          }
          break;
        
        case 'enum':
          if (!Array.isArray(rule.value) || !rule.value.includes(value)) {
            return false;
          }
          break;
      }
    }
    
    return true;
  }
}

/**
 * Get default field mappings for common integrations
 */
export function getDefaultFieldMappings(
  integrationName: string
): Partial<Record<string, string>> {
  const mappings: Record<string, Partial<Record<string, string>>> = {
    salesforce: {
      'firstName': 'FirstName',
      'lastName': 'LastName',
      'email': 'Email',
      'phone': 'Phone',
      'company': 'Company',
      'title': 'Title',
      'address': 'Street',
      'city': 'City',
      'state': 'State',
      'zip': 'PostalCode',
      'country': 'Country',
    },
    hubspot: {
      'firstName': 'firstname',
      'lastName': 'lastname',
      'email': 'email',
      'phone': 'phone',
      'company': 'company',
      'title': 'jobtitle',
      'website': 'website',
      'address': 'address',
      'city': 'city',
      'state': 'state',
      'zip': 'zip',
    },
    shopify: {
      'name': 'title',
      'price': 'price',
      'description': 'body_html',
      'sku': 'sku',
      'inventory': 'inventory_quantity',
      'weight': 'weight',
      'images': 'images',
    },
  };
  
  return mappings[integrationName.toLowerCase()] ?? {};
}


