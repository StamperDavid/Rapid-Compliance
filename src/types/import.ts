/**
 * CSV Import System Types
 * Smart data import with automatic schema detection and mapping
 */

export interface ImportSession {
  id: string;
  organizationId: string;
  
  // File info
  fileName: string;
  fileSize: number;
  uploadedAt: Date;
  
  // Import target
  targetEntity: string; // 'leads', 'companies', 'products', etc.
  createNewEntity: boolean;
  newEntityName?: string;
  
  // Data
  headers: string[];
  rows: unknown[][];
  totalRows: number;
  
  // Column mapping
  columnMappings: ColumnMapping[];
  
  // Schema changes
  schemaChanges: SchemaChange[];
  autoDetectedSchema?: DetectedSchema;
  
  // Status
  status: 'uploaded' | 'mapped' | 'validated' | 'importing' | 'completed' | 'failed';
  progress: number; // 0-100
  
  // Results
  importedCount: number;
  failedCount: number;
  errors: ImportError[];
  
  // Settings
  skipFirstRow: boolean;
  updateExisting: boolean;
  matchField?: string; // Field to match for updates (e.g., 'email', 'sku')
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ColumnMapping {
  csvColumn: string;
  csvColumnIndex: number;
  targetField: string;
  fieldType: string;
  isRequired: boolean;
  
  // Data transformation
  transform?: 'trim' | 'uppercase' | 'lowercase' | 'phone' | 'email' | 'currency' | 'date';
  defaultValue?: unknown;
  
  // Validation
  sampleValues: unknown[];
  detectedType: string;
  confidence: number; // 0-100
}

export interface SchemaChange {
  type: 'add_field' | 'modify_field' | 'create_entity';
  fieldName?: string;
  fieldType?: string;
  entityName?: string;
  description: string;
  autoApproved: boolean;
}

export interface DetectedSchema {
  entityName: string;
  fields: DetectedField[];
  confidence: number;
  suggestions: string[];
}

export interface DetectedField {
  name: string;
  type: string;
  required: boolean;
  confidence: number;
  reasoning: string;
  sampleValues: unknown[];
}

export interface ImportError {
  row: number;
  column?: string;
  message: string;
  value?: unknown;
  severity: 'error' | 'warning';
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: ImportError[];
  duration: number;
}

// Field type detection
export type DetectedFieldType = 
  | 'text'
  | 'number'
  | 'currency'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'boolean'
  | 'select';

export interface FieldTypeDetectionResult {
  type: DetectedFieldType;
  confidence: number;
  pattern?: string;
  uniqueValues?: unknown[];
}


