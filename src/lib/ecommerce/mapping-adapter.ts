/**
 * E-Commerce Mapping Adapter
 * Automatically updates e-commerce field mappings when schemas change
 */

import { SchemaChangeEvent } from '@/lib/schema/schema-change-tracker';
import { EcommerceConfig, ProductFieldMappings } from '@/types/ecommerce';
import { logger } from '@/lib/logger/logger';
import { FieldResolver } from '@/lib/schema/field-resolver';

/**
 * Adapt e-commerce mappings to schema changes
 */
export async function adaptEcommerceMappings(
  event: SchemaChangeEvent
): Promise<void> {
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    
    // Get e-commerce config for this workspace
    const configPath = `${COLLECTIONS.ORGANIZATIONS}/${event.organizationId}/${COLLECTIONS.WORKSPACES}/${event.workspaceId}/ecommerceConfig`;
    const configs = await FirestoreService.getAll(configPath);
    
    if (configs.length === 0) {
      logger.info('[E-Commerce Adapter] No e-commerce config found', {
        file: 'mapping-adapter.ts',
        workspaceId: event.workspaceId,
      });
      return;
    }
    
    const config = configs[0] as EcommerceConfig;
    
    // Check if this schema change affects the product schema
    if (config.productSchema !== event.schemaId) {
      logger.info('[E-Commerce Adapter] Schema change does not affect product schema', {
        file: 'mapping-adapter.ts',
        eventSchemaId: event.schemaId,
        productSchemaId: config.productSchema,
      });
      return;
    }
    
    // Handle different types of changes
    let updated = false;
    const mappings = config.productMappings;
    
    switch (event.changeType) {
      case 'field_renamed':
      case 'field_key_changed':
        updated = await handleFieldRename(
          mappings,
          event.oldFieldKey || event.oldFieldName || '',
          event.newFieldKey || event.newFieldName || ''
        );
        break;
      
      case 'field_deleted':
        updated = await handleFieldDeletion(
          mappings,
          event.oldFieldKey || event.oldFieldName || '',
          event.organizationId,
          event.workspaceId,
          event.schemaId
        );
        break;
      
      case 'field_type_changed':
        // Log warning but don't change mapping
        logger.warn('[E-Commerce Adapter] Field type changed - manual review recommended', {
          file: 'mapping-adapter.ts',
          fieldId: event.fieldId,
          oldType: event.oldFieldType,
          newType: event.newFieldType,
        });
        break;
    }
    
    // Save updated config if changes were made
    if (updated) {
      await FirestoreService.set(configPath, config.id, {
        ...config,
        productMappings: mappings,
        updatedAt: new Date(),
      }, false);
      
      logger.info('[E-Commerce Adapter] Mappings updated successfully', {
        file: 'mapping-adapter.ts',
        configId: config.id,
        eventType: event.changeType,
      });
    }
  } catch (error) {
    logger.error('[E-Commerce Adapter] Failed to adapt mappings', error, {
      file: 'mapping-adapter.ts',
      eventId: event.id,
    });
  }
}

/**
 * Handle field rename in mappings
 */
async function handleFieldRename(
  mappings: ProductFieldMappings,
  oldFieldKey: string,
  newFieldKey: string
): Promise<boolean> {
  let updated = false;
  
  // Check each mapping field
  const mappingFields: (keyof ProductFieldMappings)[] = [
    'name',
    'price',
    'description',
    'images',
    'sku',
    'category',
    'variants',
    'inventory',
    'weight',
    'dimensions',
    'slug',
    'metaTitle',
    'metaDescription',
  ];
  
  for (const field of mappingFields) {
    if (mappings[field] === oldFieldKey) {
      (mappings as any)[field] = newFieldKey;
      updated = true;
      
      logger.info('[E-Commerce Adapter] Updated mapping', {
        file: 'mapping-adapter.ts',
        mappingField: field,
        oldKey: oldFieldKey,
        newKey: newFieldKey,
      });
    }
  }
  
  // Check custom fields
  if (mappings.customFields) {
    for (const [displayName, fieldKey] of Object.entries(mappings.customFields)) {
      if (fieldKey === oldFieldKey) {
        mappings.customFields[displayName] = newFieldKey;
        updated = true;
      }
    }
  }
  
  return updated;
}

/**
 * Handle field deletion - try to find alternative field
 */
async function handleFieldDeletion(
  mappings: ProductFieldMappings,
  deletedFieldKey: string,
  organizationId: string,
  workspaceId: string,
  schemaId: string
): Promise<boolean> {
  let updated = false;
  
  // Get schema for field resolution
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  const schema = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.SCHEMAS}`,
    schemaId
  );
  
  if (!schema) {
    logger.error('[E-Commerce Adapter] Schema not found', {
      file: 'mapping-adapter.ts',
      schemaId,
    });
    return false;
  }
  
  // Try to find replacement fields for critical mappings
  const criticalMappings = {
    name: ['title', 'product_name', 'item_name', 'display_name'],
    price: ['cost', 'amount', 'rate', 'hourly_rate', 'pricing'],
    description: ['desc', 'details', 'summary', 'about'],
    images: ['image', 'photo', 'pictures', 'gallery'],
  };
  
  for (const [mappingKey, alternatives] of Object.entries(criticalMappings)) {
    const currentMapping = (mappings as any)[mappingKey];
    
    if (currentMapping === deletedFieldKey) {
      // Try to find an alternative field
      const resolved = await FieldResolver.resolveField(schema as any, {
        aliases: alternatives,
      });
      
      if (resolved && resolved.confidence >= 0.5) {
        (mappings as any)[mappingKey] = resolved.fieldKey;
        updated = true;
        
        logger.info('[E-Commerce Adapter] Found replacement field', {
          file: 'mapping-adapter.ts',
          mappingKey,
          deletedField: deletedFieldKey,
          newField: resolved.fieldKey,
          confidence: resolved.confidence,
        });
      } else {
        logger.warn('[E-Commerce Adapter] Critical mapping lost - no replacement found', {
          file: 'mapping-adapter.ts',
          mappingKey,
          deletedField: deletedFieldKey,
        });
      }
    }
  }
  
  return updated;
}

/**
 * Validate e-commerce mappings against current schema
 */
export async function validateEcommerceMappings(
  config: EcommerceConfig,
  organizationId: string,
  workspaceId: string
): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Get product schema
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    const schema = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.SCHEMAS}`,
      config.productSchema
    );
    
    if (!schema) {
      errors.push(`Product schema '${config.productSchema}' not found`);
      return { valid: false, errors, warnings };
    }
    
    // Validate required mappings
    const requiredMappings: (keyof ProductFieldMappings)[] = [
      'name',
      'price',
      'description',
      'images',
    ];
    
    for (const required of requiredMappings) {
      const fieldKey = config.productMappings[required];
      
      if (!fieldKey) {
        errors.push(`Required mapping '${required}' is not configured`);
        continue;
      }
      
      const resolved = await FieldResolver.resolveField(schema, fieldKey);
      
      if (!resolved) {
        errors.push(`Field '${fieldKey}' for mapping '${required}' not found in schema`);
      } else if (resolved.confidence < 0.8) {
        warnings.push(
          `Field '${fieldKey}' for mapping '${required}' has low confidence match (${resolved.confidence})`
        );
      }
    }
    
    // Validate optional mappings
    const optionalMappings: (keyof ProductFieldMappings)[] = [
      'sku',
      'category',
      'inventory',
      'weight',
    ];
    
    for (const optional of optionalMappings) {
      const fieldKey = config.productMappings[optional];
      
      if (fieldKey) {
        const resolved = await FieldResolver.resolveField(schema, fieldKey);
        
        if (!resolved) {
          warnings.push(`Optional field '${fieldKey}' for mapping '${optional}' not found in schema`);
        }
      }
    }
    
  } catch (error) {
    errors.push(`Validation failed: ${error}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Auto-configure e-commerce mappings based on schema
 */
export async function autoConfigureEcommerceMappings(
  organizationId: string,
  workspaceId: string,
  schemaId: string
): Promise<Partial<ProductFieldMappings>> {
  const mappings: Partial<ProductFieldMappings> = {};
  
  try {
    // Get schema
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    const schema = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.SCHEMAS}`,
      schemaId
    );
    
    if (!schema) {
      throw new Error(`Schema ${schemaId} not found`);
    }
    
    // Try to auto-detect common fields
    const fieldMappings = {
      name: ['name', 'title', 'product_name', 'item_name'],
      price: ['price', 'cost', 'amount', 'rate', 'hourly_rate'],
      description: ['description', 'desc', 'details', 'summary'],
      images: ['images', 'image', 'photos', 'gallery'],
      sku: ['sku', 'product_code', 'item_code'],
      category: ['category', 'type', 'classification'],
      inventory: ['inventory', 'stock', 'quantity', 'qty'],
      weight: ['weight'],
      dimensions: ['dimensions', 'size'],
    };
    
    for (const [mappingKey, aliases] of Object.entries(fieldMappings)) {
      const resolved = await FieldResolver.resolveField(schema, {
        aliases,
      });
      
      if (resolved && resolved.confidence >= 0.5) {
        (mappings as any)[mappingKey] = resolved.fieldKey;
        
        logger.info('[E-Commerce Adapter] Auto-configured mapping', {
          file: 'mapping-adapter.ts',
          mappingKey,
          fieldKey: resolved.fieldKey,
          confidence: resolved.confidence,
        });
      }
    }
    
  } catch (error) {
    logger.error('[E-Commerce Adapter] Failed to auto-configure mappings', error, {
      file: 'mapping-adapter.ts',
      schemaId,
    });
  }
  
  return mappings;
}

/**
 * Get e-commerce field value with mapping resolution
 */
export async function getEcommerceFieldValue(
  product: any,
  mappingKey: keyof ProductFieldMappings,
  config: EcommerceConfig,
  schema?: any
): Promise<any> {
  const fieldKey = config.productMappings[mappingKey];
  
  if (!fieldKey) {
    return undefined;
  }
  
  // Use field resolver for flexible value retrieval
  return FieldResolver.getFieldValue(product, fieldKey, schema);
}


