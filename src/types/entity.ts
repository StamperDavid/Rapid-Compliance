import type { Timestamp } from 'firebase/firestore';
import type { WorkflowState } from './workflow-state';

/**
 * Entity Record
 * A single record in a schema (like an Airtable row)
 * Note: Actual data structure is dynamic based on schema
 */
export interface EntityRecord {
  id: string;
  schemaId: string;
  workspaceId: string;
  
  // System fields (always present)
  _meta: EntityMetadata;
  
  // Dynamic fields based on schema
  [key: string]: unknown;
}

export interface EntityMetadata {
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  version: number; // For versioning/conflict resolution
  
  // Soft delete
  deletedAt?: Timestamp;
  deletedBy?: string;
  
  // Activity tracking
  lastViewedAt?: Timestamp;
  lastViewedBy?: string;
  
  // Tags & classification
  tags?: string[];
  starred?: boolean;
  
  // AI metadata
  aiGenerated?: boolean;
  aiLastProcessedAt?: Timestamp;
  
  // Workflow state (for automation pipeline)
  workflow?: WorkflowState;
}

/**
 * Entity Activity
 * Track all changes to a record
 */
export interface EntityActivity {
  id: string;
  entityId: string;
  schemaId: string;
  workspaceId: string;
  
  // Activity details
  type: ActivityType;
  action: string; // Human-readable description
  
  // User
  userId: string;
  userEmail: string;
  userName: string;
  
  // Changes
  changes?: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  
  // Context
  metadata?: Record<string, unknown>;
  
  // Timestamp
  timestamp: Timestamp;
}

export type ActivityType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'restored'
  | 'commented'
  | 'attachment_added'
  | 'attachment_removed'
  | 'linked'
  | 'unlinked'
  | 'status_changed'
  | 'assigned'
  | 'ai_processed';

/**
 * Entity Comment
 * Comments on records
 */
export interface EntityComment {
  id: string;
  entityId: string;
  schemaId: string;
  workspaceId: string;
  
  // Comment
  content: string;
  richContent?: unknown; // For rich text editor
  
  // User
  userId: string;
  userEmail: string;
  userName: string;
  userAvatar?: string;
  
  // Mentions
  mentions?: string[]; // userIds
  
  // Thread
  parentCommentId?: string; // For replies
  
  // Attachments
  attachments?: CommentAttachment[];
  
  // Metadata
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  editedAt?: Timestamp;
  
  // Status
  deleted?: boolean;
  deletedAt?: Timestamp;
}

export interface CommentAttachment {
  id: string;
  name: string;
  url: string;
  type: string; // mime type
  size: number; // bytes
}

/**
 * Entity Relationship
 * Track linked records
 */
export interface EntityRelationship {
  id: string;
  
  // Source
  fromEntityId: string;
  fromSchemaId: string;
  
  // Target
  toEntityId: string;
  toSchemaId: string;
  
  // Relationship type
  relationId: string; // References SchemaRelation
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
}

/**
 * Entity Export
 * Export job configuration and status
 */
export interface EntityExport {
  id: string;
  workspaceId: string;
  schemaId: string;
  
  // Export config
  format: 'csv' | 'xlsx' | 'json' | 'pdf';
  filters?: EntityFilter[]; // View filters to apply
  fields?: string[]; // Specific fields to export
  
  // Output
  fileUrl?: string; // Cloud Storage URL
  fileSize?: number;
  recordCount?: number;
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  progress?: number; // 0-100
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  completedAt?: Timestamp;
  expiresAt?: Timestamp; // Auto-delete exports after X days
}

/**
 * Entity Import
 * Import job configuration and status
 */
export interface EntityImport {
  id: string;
  workspaceId: string;
  schemaId: string;
  
  // Import config
  sourceFileUrl: string;
  format: 'csv' | 'xlsx' | 'json';
  mapping: FieldMapping[]; // Map file columns to schema fields
  
  // Options
  options: {
    updateExisting: boolean; // Update records if they exist
    matchField?: string; // Field to match existing records
    skipErrors: boolean; // Continue on row errors
  };
  
  // Results
  stats?: {
    totalRows: number;
    successCount: number;
    errorCount: number;
    skippedCount: number;
  };
  errors?: ImportError[];
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number; // 0-100
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  completedAt?: Timestamp;
}

export interface FieldMapping {
  sourceColumn: string; // Column name in import file
  targetField: string; // Field key in schema
  transform?: string; // Transformation function
}

export interface ImportError {
  row: number;
  field?: string;
  error: string;
  value?: unknown;
}

/**
 * Entity View Filter
 * Saved filter configuration
 */
export interface EntityFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
  conjunction?: 'and' | 'or'; // How to combine with next filter
}

export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'in'
  | 'notIn'
  | 'between'
  | 'isTrue'
  | 'isFalse';

/**
 * Entity Sort
 * Saved sort configuration
 */
export interface EntitySort {
  field: string;
  direction: 'asc' | 'desc';
  order: number; // For multi-column sorting
}

/**
 * Entity Group
 * Group records by field value
 */
export interface EntityGroup {
  field: string;
  order: 'asc' | 'desc';
  hideEmpty?: boolean; // Hide empty groups
  collapsed?: string[]; // IDs of collapsed groups
}


