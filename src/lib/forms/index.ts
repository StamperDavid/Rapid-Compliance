/**
 * Form Builder Module
 *
 * Complete form building, submission, and analytics system
 * Optimized for Firestore with penthouse architecture
 *
 * @module forms
 * @version 2.0.0
 */

import { getSubCollection } from '@/lib/firebase/collections';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Field types
  FormFieldType,
  FormFieldValidation,
  FormFieldOption,
  ConditionalLogic,
  ConditionalCondition,
  CRMFieldMapping,
  FieldMappingRule,
  FormFieldConfig,

  // Form types
  FormStatus,
  FormSettings,
  FormPage,
  FormBehavior,
  FormDefinition,

  // Submission types
  SubmissionStatus,
  FieldResponse,
  FileUploadReference,
  SignatureData,
  PageProgress,
  SubmissionMetadata,
  FormSubmission,
  OrchestratorAction,

  // View & Analytics types
  FormView,
  FormAnalyticsSummary,
  FormFieldAnalytics,

  // Template types
  FormTemplate,

  // Filter & Query types
  FormFilters,
  SubmissionFilters,
  AnalyticsDateRange,
  PaginationOptions,
  PaginatedResult,

  // API Response types
  FormWithFields,
  SubmissionExport,
  FormAnalyticsReport,
} from './types';

// ============================================================================
// DATABASE SERVICE EXPORTS
// ============================================================================

export {
  // Form CRUD
  createForm,
  getForm,
  getFormWithFields,
  updateForm,
  deleteForm,
  listForms,
  duplicateForm,

  // Field operations
  addFormField,
  updateFormField,
  deleteFormField,
  getFormFields,
  reorderFormFields,

  // Submission operations
  createSubmission,
  getSubmission,
  getSubmissionByResumeToken,
  getSubmissionByConfirmation,
  updateSubmission,
  listSubmissions,
  deleteSubmission,

  // View & Analytics
  trackFormView,
  markViewAsConverted,
  updateDailyAnalytics,
  getFormAnalytics,
  getFieldAnalytics,

  // Template operations
  createFormTemplate,
  createFormFromTemplate,
  listFormTemplates,
} from './form-db-service';

// ============================================================================
// LEGACY SERVICE EXPORTS (for backward compatibility)
// ============================================================================

export {
  createForm as createFormLegacy,
  getForm as getFormLegacy,
  updateForm as updateFormLegacy,
  deleteForm as deleteFormLegacy,
  listForms as listFormsLegacy,
  publishForm,
  duplicateForm as duplicateFormLegacy,
  createSubmission as createSubmissionLegacy,
  getSubmission as getSubmissionLegacy,
  listSubmissions as listSubmissionsLegacy,
  deleteSubmission as deleteSubmissionLegacy,
  trackFormView as trackFormViewLegacy,
  getPublicFormUrl,
  getFormEmbedCode,
} from './form-service';

// ============================================================================
// COLLECTION PATHS
// ============================================================================

/**
 * Firestore collection paths for the Form Builder module
 *
 * Structure:
 * - {platform}/workspaces/{workspaceId}/forms/{formId}
 * - {platform}/workspaces/{workspaceId}/forms/{formId}/fields/{fieldId}
 * - {platform}/workspaces/{workspaceId}/forms/{formId}/submissions/{submissionId}
 * - {platform}/workspaces/{workspaceId}/forms/{formId}/analytics/{date}
 * - {platform}/workspaces/{workspaceId}/forms/{formId}/fieldAnalytics/{fieldId_date}
 * - {platform}/workspaces/{workspaceId}/forms/{formId}/views/{viewId}
 * - {platform}/workspaces/{workspaceId}/formTemplates/{templateId}
 */
export const FORM_COLLECTION_PATHS = {
  forms: (workspaceId: string) =>
    `${getSubCollection('workspaces')}/${workspaceId}/forms`,

  form: (workspaceId: string, formId: string) =>
    `${getSubCollection('workspaces')}/${workspaceId}/forms/${formId}`,

  fields: (workspaceId: string, formId: string) =>
    `${getSubCollection('workspaces')}/${workspaceId}/forms/${formId}/fields`,

  submissions: (workspaceId: string, formId: string) =>
    `${getSubCollection('workspaces')}/${workspaceId}/forms/${formId}/submissions`,

  analytics: (workspaceId: string, formId: string) =>
    `${getSubCollection('workspaces')}/${workspaceId}/forms/${formId}/analytics`,

  fieldAnalytics: (workspaceId: string, formId: string) =>
    `${getSubCollection('workspaces')}/${workspaceId}/forms/${formId}/fieldAnalytics`,

  views: (workspaceId: string, formId: string) =>
    `${getSubCollection('workspaces')}/${workspaceId}/forms/${formId}/views`,

  templates: (workspaceId: string) =>
    `${getSubCollection('workspaces')}/${workspaceId}/formTemplates`,
} as const;

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default form settings */
export const DEFAULT_FORM_SETTINGS = {
  submitButtonText: 'Submit',
  showProgressBar: true,
  showPageNumbers: true,
  allowSaveDraft: false,
  confirmationType: 'message' as const,
  confirmationMessage: 'Thank you for your submission!',
  sendEmailNotification: false,
  sendAutoReply: false,
  showBranding: true,
  enableCaptcha: false,
  requireLogin: false,
};

/** Default form behavior */
export const DEFAULT_FORM_BEHAVIOR = {
  maxSubmissions: 0, // Unlimited
  allowMultipleSubmissions: true,
  showThankYouPage: true,
  enableSaveAndContinue: false,
};

/** Default CRM mapping */
export const DEFAULT_CRM_MAPPING = {
  enabled: false,
  entityType: 'lead' as const,
  fieldMappings: [],
  createNew: true,
  updateExisting: false,
};

/** Field type labels for UI */
export const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Single Line Text',
  textarea: 'Multi-Line Text',
  email: 'Email Address',
  phone: 'Phone Number',
  number: 'Number',
  currency: 'Currency',
  date: 'Date',
  datetime: 'Date & Time',
  time: 'Time',
  dropdown: 'Dropdown',
  multiselect: 'Multi-Select',
  radio: 'Radio Buttons',
  checkbox: 'Checkbox',
  file: 'File Upload',
  image: 'Image Upload',
  signature: 'E-Signature',
  rating: 'Rating',
  scale: 'Scale',
  address: 'Address',
  name: 'Full Name',
  hidden: 'Hidden Field',
  heading: 'Heading',
  paragraph: 'Paragraph',
  divider: 'Divider',
  pagebreak: 'Page Break',
};

/** Field categories for UI grouping */
export const FIELD_CATEGORIES = {
  basic: ['text', 'textarea', 'email', 'phone', 'number'],
  selection: ['dropdown', 'multiselect', 'radio', 'checkbox'],
  datetime: ['date', 'datetime', 'time'],
  advanced: ['file', 'image', 'signature', 'currency'],
  rating: ['rating', 'scale'],
  composite: ['address', 'name'],
  layout: ['heading', 'paragraph', 'divider', 'pagebreak'],
  special: ['hidden'],
} as const;

// ============================================================================
// CONDITIONAL LOGIC ENGINE
// ============================================================================

export {
  // Types
  type ConditionalEvaluationResult,
  type PageEvaluationResult,
  type FormConditionalState,
  type EvaluationContext,

  // Condition evaluation
  evaluateCondition,
  evaluateConditions,
  evaluateFormConditions,
  evaluateFieldConditions,
  evaluatePageConditions,

  // Navigation helpers
  getNextVisiblePage,
  getPreviousVisiblePage,
  isLastVisiblePage,
  isFirstVisiblePage,
  calculateProgress,

  // Validation helpers
  getRequiredVisibleFields,
  validatePageWithConditions,

  // Response helpers
  createResponsesMap,
  getVisibleResponses,

  // Dependency tracking
  buildDependencyGraph,
  getDependentFields,
  detectCircularDependencies,
} from './conditional-logic';

// ============================================================================
// CRM MAPPING SYSTEM
// ============================================================================

export {
  // Types
  type CRMEntityType,
  type CRMFieldDefinition,
  type CRMRecord,
  type CRMMappingResult,
  type CRMSyncResult,

  // Constants
  STANDARD_CRM_FIELDS,

  // Data transformations
  transformValue,
  formatPhoneNumber,
  parseName,
  parseAddress,

  // Mapping functions
  mapResponsesToCRM,
  findExistingRecord,
  createCRMRecord,
  updateCRMRecord,
  syncSubmissionToCRM,

  // Utilities
  getSuggestedMapping,
  validateMappings,
  generateDefaultMappings,
} from './crm-mapping';

// ============================================================================
// ORCHESTRATOR TRIGGER SYSTEM
// ============================================================================

export {
  // Types
  type ActionExecutionResult,
  type TriggerResult,
  type OrchestratorSignal,
  type WebhookPayload,

  // Main trigger functions
  triggerOrchestratorActions,
  onFormSubmit,
  registerFormSubmissionHandler,
} from './orchestrator-trigger';
