/**
 * Form Builder Types
 * Complete type definitions for form definitions, submissions, and analytics
 * Optimized for Firestore structure
 *
 * COLLECTION STRUCTURE (via getSubCollection helper):
 * {platform}/forms/{formId}
 * {platform}/forms/{formId}/fields/{fieldId}
 * {platform}/forms/{formId}/submissions/{submissionId}
 * {platform}/forms/{formId}/analytics/{date}
 * {platform}/forms/{formId}/fieldAnalytics/{fieldId_date}
 * {platform}/forms/{formId}/views/{viewId}
 * {platform}/formTemplates/{templateId}
 *
 * @module forms/types
 * @version 2.0.0
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// FORM FIELD TYPES
// ============================================================================

/** Supported form field types */
export type FormFieldType =
  | 'text'           // Single line text
  | 'textarea'       // Multi-line text
  | 'email'          // Email with validation
  | 'phone'          // Phone number
  | 'number'         // Numeric input
  | 'currency'       // Currency with formatting
  | 'date'           // Date picker
  | 'datetime'       // Date + time picker
  | 'time'           // Time picker
  | 'dropdown'       // Single select dropdown
  | 'multiselect'    // Multiple select
  | 'radio'          // Radio buttons
  | 'checkbox'       // Single checkbox or checkbox group
  | 'file'           // File upload
  | 'image'          // Image upload
  | 'signature'      // E-signature capture
  | 'rating'         // Star rating
  | 'scale'          // Linear scale (1-10)
  | 'address'        // Address composite field
  | 'name'           // Full name composite field
  | 'hidden'         // Hidden field (for tracking)
  | 'heading'        // Section heading (display only)
  | 'paragraph'      // Paragraph text (display only)
  | 'divider'        // Visual divider
  | 'pagebreak';     // Multi-step page break

/** Field validation rules */
export interface FormFieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;             // For numbers
  max?: number;             // For numbers
  pattern?: string;         // Regex pattern
  customMessage?: string;   // Custom error message
  maxFileSize?: number;     // In bytes for file uploads
  allowedFileTypes?: string[]; // MIME types for file uploads
  maxFiles?: number;        // Max files for multi-upload
}

/** Options for select-type fields */
export interface FormFieldOption {
  label: string;
  value: string;
  selected?: boolean;       // Default selected
  disabled?: boolean;
  image?: string;           // Optional image URL
}

/** Conditional logic for field visibility */
export interface ConditionalLogic {
  enabled: boolean;
  action: 'show' | 'hide';
  logicType: 'all' | 'any'; // All conditions or any condition
  conditions: ConditionalCondition[];
}

export interface ConditionalCondition {
  fieldId: string;          // Source field to check
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'greater_than'
    | 'less_than'
    | 'is_empty'
    | 'is_not_empty'
    | 'starts_with'
    | 'ends_with';
  value: string | number | boolean | string[];
}

/** CRM field mapping configuration */
export interface CRMFieldMapping {
  enabled: boolean;
  entityType: 'lead' | 'contact' | 'deal' | 'custom';
  entityName?: string;      // For custom entities
  fieldMappings: FieldMappingRule[];
  createNew: boolean;       // Create new record if not found
  updateExisting: boolean;  // Update existing record if found
  matchingField?: string;   // Field to match existing records (e.g., 'email')
}

export interface FieldMappingRule {
  formFieldId: string;
  crmFieldName: string;
  transformation?: 'none' | 'uppercase' | 'lowercase' | 'trim' | 'capitalize';
}

/**
 * Individual form field configuration
 * Stored in subcollection: forms/{formId}/fields/{fieldId}
 */
export interface FormFieldConfig {
  id: string;
  formId: string;

  // Field definition
  type: FormFieldType;
  label: string;
  name: string;             // Machine name for submissions (indexed)
  placeholder?: string;
  helpText?: string;
  defaultValue?: string | number | boolean | string[];

  // Layout - enables efficient ordering queries
  order: number;            // Sort order within page (indexed)
  pageIndex: number;        // Which page (0-indexed) for multi-step (indexed)
  width: 'full' | 'half' | 'third' | 'quarter';

  // Options for select-type fields
  options?: FormFieldOption[];

  // Validation
  validation?: FormFieldValidation;

  // Conditional logic
  conditionalLogic?: ConditionalLogic;

  // CRM mapping for this specific field
  crmMapping?: {
    entityField: string;
    transform?: string;
  };

  // Styling
  cssClass?: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// FORM DEFINITION
// ============================================================================

/** Form status */
export type FormStatus = 'draft' | 'published' | 'archived' | 'scheduled';

/** Form settings */
export interface FormSettings {
  // Submission settings
  submitButtonText: string;
  showProgressBar: boolean;
  showPageNumbers: boolean;
  allowSaveDraft: boolean;

  // Confirmation
  confirmationType: 'message' | 'redirect' | 'page';
  confirmationMessage?: string;
  redirectUrl?: string;
  confirmationPageId?: string;

  // Notifications
  sendEmailNotification: boolean;
  notificationEmails?: string[];
  sendAutoReply: boolean;
  autoReplySubject?: string;
  autoReplyMessage?: string;
  autoReplyFromName?: string;

  // Limits
  limitSubmissions?: number;
  limitPerUser?: number;
  closeOnDate?: Timestamp;

  // Branding
  showBranding: boolean;
  customCss?: string;
  customJs?: string;

  // Security
  enableCaptcha: boolean;
  captchaType?: 'recaptcha' | 'hcaptcha' | 'turnstile';
  requireLogin: boolean;
  allowedDomains?: string[];  // Email domain restrictions

  // SEO
  metaTitle?: string;
  metaDescription?: string;

  // Scheduling
  scheduledPublishDate?: Timestamp;
  scheduledCloseDate?: Timestamp;
}

/** Multi-step page configuration - embedded in form document */
export interface FormPage {
  id: string;
  title: string;
  description?: string;
  order: number;
  conditionalLogic?: ConditionalLogic;
}

/** Form behavior configuration */
export interface FormBehavior {
  maxSubmissions: number;    // 0 = unlimited
  maxSubmissionsPerUser?: number;
  expiresAt?: Timestamp;
  allowMultipleSubmissions: boolean;
  showThankYouPage: boolean;
  thankYouMessage?: string;
  enableSaveAndContinue: boolean;
  saveAndContinueExpiry?: number; // Days
}

/**
 * Form definition document
 * Path: {platform}/forms/{formId}
 *
 * INDEX STRATEGY:
 * - Composite: (status, createdAt DESC) - List published forms
 * - Composite: (status, updatedAt DESC) - Recently modified
 * - Composite: (createdBy, createdAt DESC) - User's forms
 * - Single: name (for search)
 */
export interface FormDefinition {
  id: string;

  // Basic info
  name: string;                 // Indexed for search
  description?: string;
  status: FormStatus;           // Indexed
  version: number;              // Increment on publish
  category?: string;            // For organization

  // Structure - pages embedded, fields in subcollection
  pages: FormPage[];

  // Settings & Behavior
  settings: FormSettings;
  behavior: FormBehavior;

  // CRM integration
  crmMapping: CRMFieldMapping;

  // Workflow triggers
  workflowTriggers?: string[];

  // Analytics tracking
  trackingEnabled: boolean;

  // Access control
  publicAccess: boolean;
  embedAllowedDomains?: string[];
  shareableLink?: string;

  // Ownership
  createdBy: string;            // Indexed
  lastModifiedBy: string;

  // Timestamps - all indexed for sorting
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;

  // Denormalized counters (updated via increment)
  fieldCount: number;
  submissionCount: number;
  viewCount: number;
}

// ============================================================================
// FORM SUBMISSIONS
// ============================================================================

/** Submission status */
export type SubmissionStatus =
  | 'partial'      // Saved but not submitted
  | 'pending'      // Submitted, awaiting processing
  | 'processing'   // CRM sync in progress
  | 'completed'    // Fully processed
  | 'failed';      // Processing failed

/** Individual field response */
export interface FieldResponse {
  fieldId: string;
  fieldName: string;        // Denormalized for easier queries
  fieldType: FormFieldType;
  value: unknown;               // Varies by field type
  displayValue?: string;    // Human-readable version
}

/** File upload reference */
export interface FileUploadReference {
  id: string;
  fieldId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  downloadUrl: string;
  uploadedAt: Timestamp;
}

/** E-signature data */
export interface SignatureData {
  fieldId: string;
  signatureImage: string;   // Storage URL (not base64 - too large)
  signedAt: Timestamp;
  ipAddress?: string;
  userAgent?: string;
  signatureType: 'drawn' | 'typed' | 'uploaded';
  typedName?: string;
}

/** Page completion tracking */
export interface PageProgress {
  pageId: string;
  pageIndex: number;
  completed: boolean;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  timeSpentSeconds?: number;
}

/** Submission metadata for tracking */
export interface SubmissionMetadata {
  // Session
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: 'desktop' | 'tablet' | 'mobile';
  browser?: string;
  os?: string;

  // Location (from IP)
  country?: string;
  region?: string;
  city?: string;

  // Attribution
  source?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;

  // User (if authenticated)
  userId?: string;
  userEmail?: string;
}

/**
 * Form submission document
 * Path: {platform}/forms/{formId}/submissions/{submissionId}
 *
 * INDEX STRATEGY:
 * - Composite: (status, submittedAt DESC) - Filter by status
 * - Composite: (formVersion, submittedAt DESC) - Version analysis
 * - Single: submittedAt DESC - Chronological listing
 * - Single: linkedLeadId - CRM lookup
 * - Single: linkedContactId - CRM lookup
 * - Single: confirmationNumber - Lookup by confirmation
 * - Composite: (indexedEmail, submittedAt DESC) - Find by email
 */
export interface FormSubmission {
  id: string;
  formId: string;
  formVersion: number;          // Indexed

  // Status
  status: SubmissionStatus;     // Indexed

  // Responses stored as array for consistency
  responses: FieldResponse[];

  // Indexed fields for querying - extracted from responses
  // This denormalization enables efficient queries without loading all responses
  indexedEmail?: string;        // Indexed
  indexedPhone?: string;
  indexedName?: string;
  indexedCompany?: string;

  // Confirmation
  confirmationNumber: string;   // Indexed - unique per form

  // Files and signatures
  files?: FileUploadReference[];
  signatures?: SignatureData[];

  // Multi-step progress
  pageProgress?: PageProgress[];
  currentPageIndex?: number;
  completionPercent?: number;

  // Partial submission support
  isPartial: boolean;
  resumeToken?: string;         // Indexed for lookup

  // CRM linking
  linkedLeadId?: string;        // Indexed
  linkedContactId?: string;     // Indexed
  linkedDealId?: string;
  linkedRecordId?: string;
  linkedEntityType?: string;
  crmSyncStatus?: 'pending' | 'synced' | 'failed';
  crmSyncError?: string;
  crmSyncedAt?: Timestamp;

  // Workflow processing
  workflowsTriggered?: string[];
  workflowStatus?: Record<string, 'pending' | 'running' | 'completed' | 'failed'>;

  // Tracking metadata
  metadata: SubmissionMetadata;

  // Timing
  startedAt?: Timestamp;
  submittedAt: Timestamp;       // Indexed
  lastSavedAt?: Timestamp;
  completionTimeSeconds?: number;

  // Orchestrator actions (for follow-up)
  orchestratorActions?: OrchestratorAction[];
}

/** Orchestrator action reference */
export interface OrchestratorAction {
  type: 'email' | 'sms' | 'workflow' | 'notification' | 'crm_update';
  status: 'pending' | 'completed' | 'failed';
  triggeredAt: Timestamp;
  completedAt?: Timestamp;
  error?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// FORM VIEW TRACKING
// ============================================================================

/**
 * Form view event - short-lived for analytics aggregation
 * Path: {platform}/forms/{formId}/views/{viewId}
 *
 * These documents should have TTL cleanup (7-30 days)
 * Analytics are aggregated into FormAnalyticsSummary documents
 *
 * INDEX STRATEGY:
 * - Composite: (sessionId, viewedAt) - Session tracking
 * - Single: viewedAt - Time-based cleanup
 */
export interface FormView {
  id: string;
  formId: string;

  // Timing
  viewedAt: Timestamp;          // Indexed
  timeOnPage?: number;          // milliseconds

  // Session
  sessionId: string;            // Indexed
  visitorId?: string;           // Anonymous tracking

  // Conversion tracking
  converted: boolean;
  submissionId?: string;

  // Context
  metadata: Partial<SubmissionMetadata>;

  // TTL field for automatic cleanup
  expiresAt?: Timestamp;
}

// ============================================================================
// FORM ANALYTICS
// ============================================================================

/**
 * Daily analytics aggregation
 * Path: {platform}/forms/{formId}/analytics/{date}
 *
 * Document ID format: YYYY-MM-DD for easy range queries
 *
 * INDEX STRATEGY:
 * - Single: date - Range queries
 */
export interface FormAnalyticsSummary {
  id: string;                   // Format: YYYY-MM-DD
  formId: string;
  date: string;                 // Indexed - YYYY-MM-DD format

  // View metrics
  views: number;
  uniqueViews: number;

  // Submission metrics
  submissions: number;
  partialSubmissions: number;
  completedSubmissions: number;

  // Conversion
  conversionRate: number;       // (submissions / views) * 100
  completionRate: number;       // (completedSubmissions / submissions) * 100

  // Time metrics (in seconds)
  totalCompletionTime: number;  // Sum for averaging
  averageCompletionTime: number;
  minCompletionTime: number;
  maxCompletionTime: number;

  // Device breakdown
  byDevice: {
    desktop: number;
    tablet: number;
    mobile: number;
  };

  // Source breakdown
  bySource: Record<string, number>;
  byReferrer: Record<string, number>;

  // Geographic breakdown
  byCountry: Record<string, number>;

  // UTM tracking
  byUtmSource: Record<string, number>;
  byUtmMedium: Record<string, number>;
  byUtmCampaign: Record<string, number>;

  // Multi-step drop-off
  pageDropOff?: Record<string, number>;

  // Metadata
  lastUpdated: Timestamp;
}

/**
 * Field-level analytics
 * Path: {platform}/forms/{formId}/fieldAnalytics/{fieldId_date}
 *
 * Document ID format: {fieldId}_{YYYY-MM-DD}
 */
export interface FormFieldAnalytics {
  id: string;
  formId: string;
  fieldId: string;
  fieldName: string;
  date: string;                 // YYYY-MM-DD

  // Completion metrics
  impressions: number;          // Times field was shown
  completions: number;          // Times field was filled
  completionRate: number;       // (completions / impressions) * 100

  // For choice fields - option selection counts
  optionCounts?: Record<string, number>;

  // Time metrics (in seconds)
  totalTimeSpent: number;
  averageTimeSpent: number;

  // Error tracking
  validationErrors: number;
  errorsByType?: Record<string, number>;

  // Metadata
  lastUpdated: Timestamp;
}

// ============================================================================
// FORM TEMPLATES
// ============================================================================

/**
 * Form template for reusable form structures
 * Path: {platform}/formTemplates/{templateId}
 */
export interface FormTemplate {
  id: string;

  name: string;
  description?: string;
  category: string;
  thumbnail?: string;

  // Template data - full form structure snapshot
  formData: {
    pages: FormPage[];
    settings: Partial<FormSettings>;
    behavior: Partial<FormBehavior>;
    crmMapping?: Partial<CRMFieldMapping>;
  };

  // Fields stored as array in template (not subcollection)
  fields: Omit<FormFieldConfig, 'formId' | 'createdAt' | 'updatedAt'>[];

  // Template metadata
  isSystem: boolean;
  isPublic: boolean;
  usageCount: number;

  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// FILTER & QUERY TYPES
// ============================================================================

export interface FormFilters {
  status?: FormStatus;
  createdBy?: string;
  category?: string;
  search?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface SubmissionFilters {
  status?: SubmissionStatus;
  formVersion?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
  email?: string;
  linkedLeadId?: string;
  linkedContactId?: string;
  isPartial?: boolean;
}

export interface AnalyticsDateRange {
  start: Date;
  end: Date;
  groupBy?: 'day' | 'week' | 'month';
}

export interface PaginationOptions {
  pageSize?: number;
  cursor?: string;              // Last document ID
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface FormWithFields extends FormDefinition {
  fields: FormFieldConfig[];
}

export interface SubmissionExport {
  formId: string;
  formName: string;
  exportedAt: Date;
  submissions: Array<{
    id: string;
    confirmationNumber: string;
    submittedAt: Date;
    status: SubmissionStatus;
    responses: Record<string, unknown>;  // fieldName -> value
    metadata: SubmissionMetadata;
  }>;
}

export interface FormAnalyticsReport {
  formId: string;
  formName: string;
  dateRange: AnalyticsDateRange;
  summary: {
    totalViews: number;
    totalSubmissions: number;
    conversionRate: number;
    averageCompletionTime: number;
  };
  dailyData: FormAnalyticsSummary[];
  fieldAnalytics: FormFieldAnalytics[];
  topSources: Array<{ source: string; count: number }>;
  deviceBreakdown: { desktop: number; tablet: number; mobile: number };
}
