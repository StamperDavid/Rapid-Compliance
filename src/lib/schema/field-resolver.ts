/**
 * Field Resolver
 * Dynamically resolves field references to actual fields in schemas
 * Supports exact matches, aliases, and type-based fallbacks
 */

import { Schema, SchemaField, FieldType } from '@/types/schema';
import { logger } from '@/lib/logger/logger';

/**
 * Field Query
 * Flexible field reference that can match by name, type, or aliases
 */
export type FieldQuery = {
  name?: string;
  type?: FieldType;
  aliases?: string[];
  key?: string;
};

/**
 * Resolved Field
 * Result of field resolution with confidence score
 */
export interface ResolvedField {
  fieldId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: FieldType;
  field: SchemaField;
  confidence: number; // 1.0 = exact match, 0.8 = alias, 0.5 = type match
  matchType: 'exact_key' | 'exact_label' | 'alias' | 'type' | 'fuzzy';
}

/**
 * Field Resolver
 */
export class FieldResolver {
  /**
   * Resolve field name to actual field in schema (Synchronous)
   * Use when schema is already loaded in memory
   * Supports: exact match, aliases, type-based fallback
   */
  static resolveFieldSync(
    schema: Schema,
    fieldReference: string | FieldQuery
  ): ResolvedField | null {
    // Convert string reference to query
    const query: FieldQuery = typeof fieldReference === 'string'
      ? { name: fieldReference, key: fieldReference }
      : fieldReference;
    
    // Try exact key match first (highest confidence)
    if (query.key) {
      const exactKeyMatch = this.findByExactKey(schema, query.key);
      if (exactKeyMatch) {
        return {
          fieldId: exactKeyMatch.id,
          fieldKey: exactKeyMatch.key,
          fieldLabel: exactKeyMatch.label,
          fieldType: exactKeyMatch.type,
          field: exactKeyMatch,
          confidence: 1.0,
          matchType: 'exact_key',
        };
      }
    }
    
    // Try exact label match
    if (query.name) {
      const exactLabelMatch = this.findByExactLabel(schema, query.name);
      if (exactLabelMatch) {
        return {
          fieldId: exactLabelMatch.id,
          fieldKey: exactLabelMatch.key,
          fieldLabel: exactLabelMatch.label,
          fieldType: exactLabelMatch.type,
          field: exactLabelMatch,
          confidence: 0.95,
          matchType: 'exact_label',
        };
      }
    }
    
    // Try alias match
    if (query.aliases && query.aliases.length > 0) {
      const aliasMatch = this.findByAliases(schema, query.aliases);
      if (aliasMatch) {
        return {
          fieldId: aliasMatch.id,
          fieldKey: aliasMatch.key,
          fieldLabel: aliasMatch.label,
          fieldType: aliasMatch.type,
          field: aliasMatch,
          confidence: 0.8,
          matchType: 'alias',
        };
      }
    }
    
    // Try type match (if looking for any field of a specific type)
    if (query.type) {
      const typeMatch = this.findByType(schema, query.type);
      if (typeMatch) {
        return {
          fieldId: typeMatch.id,
          fieldKey: typeMatch.key,
          fieldLabel: typeMatch.label,
          fieldType: typeMatch.type,
          field: typeMatch,
          confidence: 0.5,
          matchType: 'type',
        };
      }
    }
    
    // Try fuzzy match as last resort
    if (query.name || query.key) {
      const searchTerm = query.name || query.key || '';
      const fuzzyMatch = this.findByFuzzyMatch(schema, searchTerm);
      if (fuzzyMatch) {
        return {
          fieldId: fuzzyMatch.id,
          fieldKey: fuzzyMatch.key,
          fieldLabel: fuzzyMatch.label,
          fieldType: fuzzyMatch.type,
          field: fuzzyMatch,
          confidence: 0.6,
          matchType: 'fuzzy',
        };
      }
    }
    
    // No match found
    return null;
  }

  /**
   * Resolve field name to actual field in schema (Asynchronous)
   * Use when schema might need to be fetched from database
   * Supports: exact match, aliases, type-based fallback
   */
  static async resolveField(
    schema: Schema,
    fieldReference: string | FieldQuery
  ): Promise<ResolvedField | null> {
    // For now, just call sync version
    // In future, this could fetch additional data if needed
    return this.resolveFieldSync(schema, fieldReference);
  }

  /**
   * Resolve field with common aliases (Synchronous)
   */
  static resolveFieldWithCommonAliasesSync(
    schema: Schema,
    fieldReference: string
  ): ResolvedField | null {
    const commonAliases = this.getCommonAliases(fieldReference);
    
    return this.resolveFieldSync(schema, {
      name: fieldReference,
      key: fieldReference,
      aliases: commonAliases,
    });
  }

  /**
   * Resolve field with common aliases (Asynchronous - DEPRECATED, use sync version)
   */
  static async resolveFieldWithCommonAliases(
    schema: Schema,
    fieldReference: string
  ): Promise<ResolvedField | null> {
    return this.resolveFieldWithCommonAliasesSync(schema, fieldReference);
  }
  
  /**
   * Get field value from entity record using flexible resolution
   */
  static getFieldValue(
    record: any,
    fieldReference: string | ResolvedField,
    schema?: Schema
  ): any {
    // If we have a resolved field, use its key
    if (typeof fieldReference !== 'string') {
      const resolved = fieldReference as ResolvedField;
      return this.getNestedValue(record, resolved.fieldKey);
    }
    
    // Try direct access first
    const directValue = this.getNestedValue(record, fieldReference);
    if (directValue !== undefined) {
      return directValue;
    }
    
    // Try common variations
    const variations = [
      fieldReference,
      fieldReference.toLowerCase(),
      this.camelCase(fieldReference),
      this.snakeCase(fieldReference),
    ];
    
    for (const variation of variations) {
      const value = this.getNestedValue(record, variation);
      if (value !== undefined) {
        return value;
      }
    }
    
    return undefined;
  }
  
  /**
   * Set field value in entity record
   */
  static setFieldValue(
    record: any,
    fieldReference: string | ResolvedField,
    value: any
  ): void {
    const fieldKey = typeof fieldReference === 'string'
      ? fieldReference
      : fieldReference.fieldKey;
    
    this.setNestedValue(record, fieldKey, value);
  }
  
  /**
   * Find field by exact key match
   */
  private static findByExactKey(schema: Schema, key: string): SchemaField | null {
    return schema.fields.find(f => f.key === key) || null;
  }
  
  /**
   * Find field by exact label match
   */
  private static findByExactLabel(schema: Schema, label: string): SchemaField | null {
    return schema.fields.find(f => f.label === label) || null;
  }
  
  /**
   * Find field by aliases
   */
  private static findByAliases(schema: Schema, aliases: string[]): SchemaField | null {
    for (const alias of aliases) {
      const field = schema.fields.find(
        f => f.key === alias || f.label === alias
      );
      if (field) {
        return field;
      }
    }
    return null;
  }
  
  /**
   * Find field by type
   */
  private static findByType(schema: Schema, type: FieldType): SchemaField | null {
    // Find first non-hidden field of this type
    return schema.fields.find(f => f.type === type && !f.hidden) || null;
  }
  
  /**
   * Find field by fuzzy match (case-insensitive, partial match)
   */
  private static findByFuzzyMatch(schema: Schema, searchTerm: string): SchemaField | null {
    const normalizedSearch = searchTerm.toLowerCase().replace(/[_\s-]/g, '');
    
    // Try to find field where key or label contains the search term
    const matches = schema.fields.filter(f => {
      const normalizedKey = f.key.toLowerCase().replace(/[_\s-]/g, '');
      const normalizedLabel = f.label.toLowerCase().replace(/[_\s-]/g, '');
      
      return normalizedKey.includes(normalizedSearch) ||
             normalizedLabel.includes(normalizedSearch) ||
             normalizedSearch.includes(normalizedKey) ||
             normalizedSearch.includes(normalizedLabel);
    });
    
    // Return first match
    return matches.length > 0 ? matches[0] : null;
  }
  
  /**
   * Get common aliases for a field name
   */
  private static getCommonAliases(fieldName: string): string[] {
    const aliases: string[] = [];
    
    // Common field name mappings
    const aliasMap: Record<string, string[]> = {
      'price': ['cost', 'amount', 'rate', 'hourly_rate', 'pricing', 'value'],
      'name': ['title', 'product_name', 'item_name', 'display_name', 'label'],
      'description': ['desc', 'details', 'summary', 'about', 'info'],
      'email': ['email_address', 'contact_email', 'e_mail'],
      'phone': ['phone_number', 'telephone', 'contact_number', 'mobile'],
      'address': ['street_address', 'location', 'address_line_1'],
      'company': ['company_name', 'organization', 'business', 'employer'],
      'website': ['url', 'web_address', 'site', 'homepage'],
      'status': ['state', 'stage', 'lifecycle_stage'],
      'category': ['type', 'classification', 'group'],
      'quantity': ['qty', 'amount', 'count', 'stock'],
      'sku': ['product_code', 'item_code', 'part_number'],
      'image': ['images', 'photo', 'picture', 'thumbnail'],
      'date': ['created_at', 'created_date', 'timestamp'],
    };
    
    const normalized = fieldName.toLowerCase();
    
    // Check if this field has known aliases
    for (const [key, values] of Object.entries(aliasMap)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        aliases.push(...values);
      }
    }
    
    // Add case variations
    aliases.push(
      this.camelCase(fieldName),
      this.snakeCase(fieldName),
      this.kebabCase(fieldName)
    );
    
    return [...new Set(aliases)]; // Remove duplicates
  }
  
  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    if (!path) return undefined;
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  /**
   * Set nested value in object using dot notation
   */
  private static setNestedValue(obj: any, path: string, value: any): void {
    if (!path) return;
    
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    let current = obj;
    for (const key of keys) {
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
  }
  
  /**
   * Convert string to camelCase
   */
  private static camelCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/[_\s-](.)/g, (_, char) => char.toUpperCase());
  }
  
  /**
   * Convert string to snake_case
   */
  private static snakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/[_\s-]+/g, '_')
      .replace(/^_/, '');
  }
  
  /**
   * Convert string to kebab-case
   */
  private static kebabCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/[_\s-]+/g, '-')
      .replace(/^-/, '');
  }
  
  /**
   * Validate if a field reference exists in schema
   */
  static async validateFieldReference(
    schema: Schema,
    fieldReference: string
  ): Promise<{
    valid: boolean;
    field?: ResolvedField;
    suggestions?: string[];
  }> {
    const resolved = await this.resolveField(schema, fieldReference);
    
    if (resolved && resolved.confidence >= 0.8) {
      return {
        valid: true,
        field: resolved,
      };
    }
    
    // Generate suggestions
    const suggestions = this.generateFieldSuggestions(schema, fieldReference);
    
    return {
      valid: false,
      suggestions,
    };
  }
  
  /**
   * Generate field suggestions for invalid reference
   */
  private static generateFieldSuggestions(
    schema: Schema,
    invalidReference: string
  ): string[] {
    const normalized = invalidReference.toLowerCase();
    
    // Find fields with similar names
    const similar = schema.fields
      .filter(f => {
        const fieldNorm = f.key.toLowerCase();
        const labelNorm = f.label.toLowerCase();
        
        return fieldNorm.includes(normalized) ||
               labelNorm.includes(normalized) ||
               normalized.includes(fieldNorm) ||
               normalized.includes(labelNorm);
      })
      .map(f => f.key)
      .slice(0, 5);
    
    if (similar.length > 0) {
      return similar;
    }
    
    // Return most commonly used fields as fallback
    return schema.fields
      .filter(f => !f.hidden)
      .slice(0, 5)
      .map(f => f.key);
  }
  
  /**
   * Resolve multiple field references at once
   */
  static async resolveMultipleFields(
    schema: Schema,
    fieldReferences: string[]
  ): Promise<Map<string, ResolvedField | null>> {
    const results = new Map<string, ResolvedField | null>();
    
    for (const ref of fieldReferences) {
      const resolved = await this.resolveField(schema, ref);
      results.set(ref, resolved);
    }
    
    return results;
  }
  
  /**
   * Get field mapping with automatic resolution
   */
  static async createFieldMapping(
    sourceSchema: Schema,
    targetSchema: Schema,
    sourceFieldRef: string,
    targetFieldRef: string
  ): Promise<{
    sourceField: ResolvedField | null;
    targetField: ResolvedField | null;
    compatible: boolean;
    warnings?: string[];
  }> {
    const sourceField = await this.resolveField(sourceSchema, sourceFieldRef);
    const targetField = await this.resolveField(targetSchema, targetFieldRef);
    
    const warnings: string[] = [];
    
    // Check compatibility
    let compatible = true;
    
    if (!sourceField) {
      warnings.push(`Source field '${sourceFieldRef}' not found in schema '${sourceSchema.name}'`);
      compatible = false;
    }
    
    if (!targetField) {
      warnings.push(`Target field '${targetFieldRef}' not found in schema '${targetSchema.name}'`);
      compatible = false;
    }
    
    if (sourceField && targetField) {
      // Check type compatibility
      if (!this.areTypesCompatible(sourceField.fieldType, targetField.fieldType)) {
        warnings.push(
          `Type mismatch: ${sourceField.fieldType} → ${targetField.fieldType} may lose data`
        );
      }
    }
    
    return {
      sourceField,
      targetField,
      compatible,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
  
  /**
   * Check if two field types are compatible for mapping
   */
  private static areTypesCompatible(sourceType: FieldType, targetType: FieldType): boolean {
    // Same type is always compatible
    if (sourceType === targetType) {
      return true;
    }
    
    // Define compatible type groups
    const textTypes: FieldType[] = ['text', 'longText', 'email', 'url', 'phoneNumber'];
    const numericTypes: FieldType[] = ['number', 'currency', 'percent'];
    const dateTypes: FieldType[] = ['date', 'dateTime', 'time'];
    
    // Check if both types are in the same group
    if (textTypes.includes(sourceType) && textTypes.includes(targetType)) {
      return true;
    }
    
    if (numericTypes.includes(sourceType) && numericTypes.includes(targetType)) {
      return true;
    }
    
    if (dateTypes.includes(sourceType) && dateTypes.includes(targetType)) {
      return true;
    }
    
    // Text can accept almost anything
    if (textTypes.includes(targetType)) {
      return true;
    }
    
    return false;
  }
}

/**
 * Field Resolver Cache
 * Cache resolved fields to improve performance
 */
export class FieldResolverCache {
  private static cache = new Map<string, ResolvedField | null>();
  private static cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private static cacheTimestamps = new Map<string, number>();
  
  /**
   * Get cached resolution
   */
  static get(schemaId: string, fieldReference: string): ResolvedField | null | undefined {
    const key = `${schemaId}:${fieldReference}`;
    const timestamp = this.cacheTimestamps.get(key);
    
    if (timestamp && Date.now() - timestamp < this.cacheExpiry) {
      return this.cache.get(key);
    }
    
    // Expired
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
    
    return undefined;
  }
  
  /**
   * Set cached resolution
   */
  static set(schemaId: string, fieldReference: string, resolved: ResolvedField | null): void {
    const key = `${schemaId}:${fieldReference}`;
    this.cache.set(key, resolved);
    this.cacheTimestamps.set(key, Date.now());
  }
  
  /**
   * Clear cache for a schema
   */
  static clearSchema(schemaId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${schemaId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    }
  }
  
  /**
   * Clear entire cache
   */
  static clear(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }
}

