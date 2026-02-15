import type { Timestamp } from 'firebase/firestore';

/**
 * Schema Definition
 * Defines the structure of an entity (like an Airtable Base)
 */
export interface Schema {
  id: string;

  // Basic info
  name: string; // e.g., "Leads", "Products", "Orders"
  pluralName: string; // e.g., "Leads", "Products", "Orders"
  singularName: string; // e.g., "Lead", "Product", "Order"
  description?: string;
  icon?: string; // emoji or icon name
  color?: string; // hex color for UI
  
  // Fields
  fields: SchemaField[];
  
  // Primary field (display field)
  primaryFieldId: string;
  
  // Relations to other schemas
  relations: SchemaRelation[];
  
  // Default view
  defaultViewId?: string;
  
  // Permissions
  permissions: {
    create: string[]; // roles
    read: string[];
    update: string[];
    delete: string[];
  };
  
  // Settings
  settings: {
    allowAttachments: boolean;
    allowComments: boolean;
    allowActivityLog: boolean;
    enableVersioning: boolean;
  };
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  
  // Status
  status: 'active' | 'archived';
  version: number; // Schema versioning for migrations
}

/**
 * Schema Field
 * Individual field in a schema (like Airtable column)
 */
export interface SchemaField {
  id: string;
  key: string; // Machine-readable key (lowercase, no spaces)
  label: string; // Human-readable label
  description?: string;
  
  // Type
  type: FieldType;
  config: FieldConfig; // Type-specific configuration
  
  // Validation
  required: boolean;
  unique: boolean;
  defaultValue?: unknown;
  validation?: FieldValidation;
  
  // UI
  readonly: boolean;
  hidden: boolean;
  width?: number; // Column width in table view
  
  // Lookup/Reference
  lookupEntity?: string; // For lookup fields, the entity name to lookup
  
  // Conditional display
  conditionalDisplay?: ConditionalLogic;
  
  // Rename history for rollback
  renameHistory?: FieldRenameRecord[];
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Field Rename Record
 * Tracks field rename history for rollback capability
 */
export interface FieldRenameRecord {
  timestamp: Timestamp;
  oldKey: string;
  newKey: string;
  oldLabel: string;
  newLabel: string;
  renamedBy: string; // User ID who made the change
  reason?: string; // Optional reason for rename
}

/**
 * Field Types (Airtable-inspired)
 */
export type FieldType =
  // Basic types
  | 'text'
  | 'longText'
  | 'number'
  | 'currency'
  | 'percent'
  | 'email'
  | 'url'
  | 'phoneNumber'
  
  // Selection types
  | 'singleSelect'
  | 'multiSelect'
  | 'checkbox'
  | 'rating'
  
  // Date/Time types
  | 'date'
  | 'dateTime'
  | 'time'
  | 'duration'
  
  // Relationship types
  | 'linkToRecord'  // Foreign key
  | 'lookup'        // Pull field from linked record
  | 'rollup'        // Aggregate linked records
  
  // Media types
  | 'attachment'
  | 'image'
  
  // Advanced types
  | 'formula'
  | 'autoNumber'
  | 'barcode'
  | 'button'
  
  // AI types
  | 'aiGenerated'
  | 'aiClassification'
  | 'aiSentiment'
  
  // User types
  | 'createdBy'
  | 'createdTime'
  | 'lastModifiedBy'
  | 'lastModifiedTime';

/**
 * Field Configuration
 * Type-specific settings
 */
export type FieldConfig =
  | TextFieldConfig
  | NumberFieldConfig
  | CurrencyFieldConfig
  | SelectFieldConfig
  | DateFieldConfig
  | LinkToRecordConfig
  | LookupConfig
  | RollupConfig
  | FormulaConfig
  | AIFieldConfig
  | AttachmentConfig
  | RatingConfig;

export interface TextFieldConfig {
  type: 'text' | 'longText' | 'email' | 'url' | 'phoneNumber';
  maxLength?: number;
  minLength?: number;
  pattern?: string; // regex
  placeholder?: string;
  richText?: boolean; // for longText
}

export interface NumberFieldConfig {
  type: 'number';
  min?: number;
  max?: number;
  precision?: number; // decimal places
  format?: 'decimal' | 'integer';
}

export interface CurrencyFieldConfig {
  type: 'currency' | 'percent';
  currency?: string; // USD, EUR, etc.
  precision?: number;
  symbol?: string;
}

export interface SelectFieldConfig {
  type: 'singleSelect' | 'multiSelect';
  options: SelectOption[];
  allowCustom?: boolean; // Allow users to add new options
}

export interface SelectOption {
  id: string;
  label: string;
  color?: string; // hex color for badges
  order: number;
}

export interface DateFieldConfig {
  type: 'date' | 'dateTime' | 'time' | 'duration';
  format?: string; // date format string
  includeTime?: boolean;
  timeZone?: string;
}

export interface LinkToRecordConfig {
  type: 'linkToRecord';
  linkedSchemaId: string;
  linkType: 'one-to-many' | 'many-to-many';
  reverseFieldId?: string; // Field in linked schema that links back
  allowLinkingMultiple: boolean;
}

export interface LookupConfig {
  type: 'lookup';
  linkFieldId: string; // Field in this schema that links to another
  lookupFieldId: string; // Field in linked schema to display
}

export interface RollupConfig {
  type: 'rollup';
  linkFieldId: string; // Field in this schema that links to another
  rollupFieldId: string; // Field in linked schema to aggregate
  aggregateFunction: AggregateFunction;
}

export type AggregateFunction =
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'countUnique'
  | 'percentFilled'
  | 'percentEmpty';

export interface FormulaConfig {
  type: 'formula';
  formula: string; // JavaScript-like formula
  outputType: 'text' | 'number' | 'date' | 'boolean';
}

export interface AIFieldConfig {
  type: 'aiGenerated' | 'aiClassification' | 'aiSentiment';
  prompt?: string; // Template for AI
  model?: string;
  sourceFields?: string[]; // Fields to use as input
  categories?: string[]; // For classification
}

export interface AttachmentConfig {
  type: 'attachment' | 'image';
  maxFiles?: number;
  maxFileSize?: number; // MB
  allowedFileTypes?: string[]; // mime types
}

export interface RatingConfig {
  type: 'rating';
  maxRating: number; // e.g., 5 for 5 stars
  icon?: string; // star, heart, etc.
}

/**
 * Field Validation
 */
export interface FieldValidation {
  rules: ValidationRule[];
  errorMessage?: string;
}

export interface ValidationRule {
  type: 'regex' | 'min' | 'max' | 'length' | 'custom';
  value: unknown;
  message?: string;
}

/**
 * Conditional Logic
 * Show/hide fields based on other field values
 */
export interface ConditionalLogic {
  conditions: Condition[];
  operator: 'and' | 'or'; // How to combine conditions
  action: 'show' | 'hide';
}

export interface Condition {
  fieldId: string;
  operator: ConditionOperator;
  value: unknown;
}

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual';

/**
 * Schema Relation
 * Define relationships between schemas
 */
export interface SchemaRelation {
  id: string;
  fromSchemaId: string;
  toSchemaId: string;
  type: 'one-to-many' | 'many-to-many' | 'one-to-one';
  
  // Field IDs
  fromFieldId: string;
  toFieldId?: string;
  
  // Cascade behavior
  onDelete: 'cascade' | 'setNull' | 'restrict';
  
  // Metadata
  createdAt: Timestamp;
}

/**
 * Schema Template
 * Pre-built schemas for common use cases
 */
export interface SchemaTemplate {
  id: string;
  name: string;
  description: string;
  industry: string;
  category: string;
  
  // Preview
  icon: string;
  thumbnail?: string;
  
  // Template data
  schemas: Partial<Schema>[]; // Array of schemas to create
  sampleData?: Record<string, unknown>[]; // Sample records
  
  // AI agent template
  agentTemplate?: {
    name: string;
    systemPrompt: string;
    personality: string;
  };
  
  // Metadata
  isPopular: boolean;
  usageCount: number;
  createdAt: Timestamp;
}


