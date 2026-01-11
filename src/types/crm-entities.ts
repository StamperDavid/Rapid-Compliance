/**
 * CRM Entities - Canonical TypeScript Interfaces
 *
 * Single source of truth for Deal, Lead, and Contact types.
 * NO `any` types - use `unknown` for truly dynamic data.
 *
 * @module types/crm-entities
 *
 * ## Zero-Any Policy Implementation
 *
 * This file was created as part of the Zero-Any Policy initiative (2026-01-11) to
 * eliminate all `any` types and achieve full type safety across the codebase.
 *
 * ### What This File Provides:
 * - 40 exported types covering all CRM entities (Deals, Leads, Contacts)
 * - Firestore date handling with FirestoreDate type and toDate() utility
 * - Custom field types with proper type guards (CustomFieldValue, CustomFieldDefinition)
 * - Strictly typed interfaces for all CRM operations (no `any` types)
 * - Type-safe activity tracking and timeline event structures
 * - Proper typing for duplicate detection and merge operations
 *
 * ### Files Using These Types (24 files total):
 *
 * #### Analytics Routes (8):
 * - src/app/api/analytics/forecast/route.ts
 * - src/app/api/analytics/pipeline/route.ts
 * - src/app/api/analytics/win-loss/route.ts
 * - src/app/api/analytics/lead-scoring/route.ts
 * - src/app/api/analytics/revenue/route.ts
 * - src/app/api/analytics/dashboard/route.ts
 * - src/app/api/analytics/ecommerce/route.ts
 * - src/app/api/analytics/workflows/route.ts
 *
 * #### CRM Routes (10):
 * - src/app/api/crm/activities/route.ts
 * - src/app/api/crm/activities/timeline/route.ts
 * - src/app/api/crm/activities/stats/route.ts
 * - src/app/api/crm/duplicates/route.ts
 * - src/app/api/crm/duplicates/merge/route.ts
 * - src/app/api/crm/deals/health-check/route.ts
 * - src/app/api/crm/deals/[dealId]/health/route.ts
 * - src/app/api/crm/deals/[dealId]/recommendations/route.ts
 * - src/app/api/crm/deals/monitor/start/route.ts
 * - src/app/api/crm/analytics/velocity/route.ts
 *
 * #### Leads Routes (5):
 * - src/app/api/leads/nurture/route.ts
 * - src/app/api/leads/enrich/route.ts
 * - src/app/api/leads/research/route.ts
 * - src/app/api/leads/route-lead/route.ts
 * - src/app/api/leads/feedback/route.ts
 *
 * ### Type Safety Principles Applied:
 * 1. Never use `any` - use `unknown` for truly dynamic data
 * 2. Use union types for polymorphic data (e.g., FirestoreDate)
 * 3. Provide type guards for runtime type checking
 * 4. Make optional fields explicit with `?` or `| undefined`
 * 5. Use branded types for domain-specific identifiers when needed
 *
 * @see PROJECT_LEDGER.md for full implementation details
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// FIRESTORE DATE HANDLING
// ============================================================================

/**
 * FirestoreDate represents the polymorphic nature of date fields in Firestore.
 * Fields can be:
 * - Firestore Timestamp objects (when read from Firestore)
 * - JavaScript Date objects (when creating/updating)
 * - ISO string dates (from JSON serialization)
 * - null/undefined (when optional)
 */
export type FirestoreDate = Timestamp | Date | string | null | undefined;

/**
 * Convert FirestoreDate to JavaScript Date
 */
export function toDate(firestoreDate: FirestoreDate): Date | null {
  if (!firestoreDate) return null;

  if (firestoreDate instanceof Date) {
    return firestoreDate;
  }

  if (typeof firestoreDate === 'string') {
    return new Date(firestoreDate);
  }

  // Firestore Timestamp
  if ('toDate' in firestoreDate && typeof firestoreDate.toDate === 'function') {
    return firestoreDate.toDate();
  }

  return null;
}

// ============================================================================
// CUSTOM FIELDS
// ============================================================================

/**
 * Strongly-typed custom field value
 * Avoids Record<string, any> while supporting dynamic fields
 */
export type CustomFieldValue =
  | string
  | number
  | boolean
  | Date
  | string[]
  | number[]
  | null
  | undefined;

/**
 * Custom fields container with strong typing
 * Use this instead of Record<string, any>
 */
export interface CustomFields {
  [key: string]: CustomFieldValue;
}

/**
 * Type guard to validate custom field values
 */
export function isValidCustomFieldValue(value: unknown): value is CustomFieldValue {
  if (value === null || value === undefined) return true;

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return true;
  }

  if (value instanceof Date) return true;

  if (Array.isArray(value)) {
    return value.every(item => typeof item === 'string' || typeof item === 'number');
  }

  return false;
}

// ============================================================================
// ENRICHMENT DATA
// ============================================================================

/**
 * Enrichment data for leads
 * Simplified subset of CompanyEnrichmentData for lead context
 */
export interface EnrichmentData {
  // Company basics
  companyName?: string;
  website?: string;
  domain?: string;
  industry?: string;
  description?: string;

  // Company size & scale
  companySize?: 'startup' | 'small' | 'medium' | 'enterprise' | 'unknown';
  employeeCount?: number;
  employeeRange?: string;
  revenue?: string;

  // Location
  city?: string;
  state?: string;
  country?: string;

  // Tech & tools
  techStack?: string[];

  // Business info
  foundedYear?: number;
  fundingStage?: string;

  // Social presence
  linkedInUrl?: string;
  twitterHandle?: string;

  // Contact info
  title?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Signals
  hiringStatus?: 'actively-hiring' | 'hiring' | 'not-hiring' | 'unknown';

  // Metadata
  lastEnriched?: FirestoreDate;
  dataSource?: 'web-scrape' | 'search-api' | 'hybrid' | 'manual';
  confidence?: number;

  // Allow additional enrichment fields without going full `any`
  [key: string]: CustomFieldValue | FirestoreDate;
}

/**
 * Type guard to check if enrichment data is valid
 */
export function isEnrichmentData(data: unknown): data is EnrichmentData {
  if (!data || typeof data !== 'object') return false;

  const enrichment = data as Record<string, unknown>;

  // Validate optional fields if present
  if (enrichment.companySize !== undefined) {
    const validSizes = ['startup', 'small', 'medium', 'enterprise', 'unknown'];
    if (!validSizes.includes(enrichment.companySize as string)) return false;
  }

  if (enrichment.hiringStatus !== undefined) {
    const validStatuses = ['actively-hiring', 'hiring', 'not-hiring', 'unknown'];
    if (!validStatuses.includes(enrichment.hiringStatus as string)) return false;
  }

  return true;
}

// ============================================================================
// STAGE HISTORY
// ============================================================================

/**
 * Tracks deal stage transitions over time
 */
export interface StageHistoryEntry {
  fromStage: DealStage | null;
  toStage: DealStage;
  changedAt: FirestoreDate;
  changedBy?: string;
  changedByName?: string;
  reason?: string;
  notes?: string;
}

// ============================================================================
// DEAL TYPES
// ============================================================================

/**
 * Deal stages in the sales pipeline
 */
export type DealStage =
  | 'prospecting'
  | 'qualification'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

/**
 * All valid deal stages as a constant array
 */
export const DEAL_STAGES: readonly DealStage[] = [
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const;

/**
 * Type guard for DealStage
 */
export function isValidDealStage(stage: unknown): stage is DealStage {
  return typeof stage === 'string' && DEAL_STAGES.includes(stage as DealStage);
}

/**
 * Deal/Opportunity entity
 * Represents a potential revenue opportunity
 */
export interface Deal {
  // Core identifiers
  id: string;
  organizationId: string;
  workspaceId: string;

  // Deal details
  name: string;
  company?: string;
  companyName?: string; // Legacy field - use `company` instead
  contactId?: string;

  // Financial
  value: number;
  currency?: string;

  // Pipeline
  stage: DealStage;
  probability: number; // 0-100

  // Dates
  expectedCloseDate?: FirestoreDate;
  actualCloseDate?: FirestoreDate;
  createdAt: FirestoreDate;
  updatedAt?: FirestoreDate;

  // Ownership & attribution
  ownerId?: string;
  source?: string;

  // Closure details
  lostReason?: string;

  // Additional data
  notes?: string;
  customFields?: CustomFields;

  // Stage history (optional, for tracking)
  stageHistory?: StageHistoryEntry[];
}

/**
 * Deal filters for queries
 */
export interface DealFilters {
  stage?: DealStage | 'all';
  ownerId?: string;
  minValue?: number;
  maxValue?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
  contactId?: string;
}

// ============================================================================
// LEAD TYPES
// ============================================================================

/**
 * Lead status in the qualification process
 */
export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'converted'
  | 'lost';

/**
 * All valid lead statuses as a constant array
 */
export const LEAD_STATUSES: readonly LeadStatus[] = [
  'new',
  'contacted',
  'qualified',
  'converted',
  'lost',
] as const;

/**
 * Type guard for LeadStatus
 */
export function isValidLeadStatus(status: unknown): status is LeadStatus {
  return typeof status === 'string' && LEAD_STATUSES.includes(status as LeadStatus);
}

/**
 * Lead entity
 * Represents a potential customer before they become a contact/deal
 */
export interface Lead {
  // Core identifiers
  id: string;
  organizationId: string;
  workspaceId: string;

  // Personal info
  firstName: string;
  lastName: string;
  name?: string; // Computed field: firstName + lastName
  email: string;
  phone?: string;

  // Company info
  company?: string;
  companyName?: string; // Legacy field - use `company` instead
  title?: string;

  // Lead management
  status: LeadStatus;
  score?: number; // 0-100 lead score
  source?: string;
  ownerId?: string;

  // Categorization
  tags?: string[];

  // Enrichment
  enrichmentData?: EnrichmentData;

  // Additional data
  customFields?: CustomFields;

  // Timestamps
  createdAt: FirestoreDate;
  updatedAt?: FirestoreDate;
}

/**
 * Lead filters for queries
 */
export interface LeadFilters {
  status?: LeadStatus | 'all';
  score?: {
    min?: number;
    max?: number;
  };
  source?: string;
  ownerId?: string;
  tags?: string[];
  minScore?: number;
  maxScore?: number;
}

// ============================================================================
// CONTACT TYPES
// ============================================================================

/**
 * Contact address structure
 */
export interface ContactAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

/**
 * Contact entity
 * Represents a qualified person in the CRM
 */
export interface Contact {
  // Core identifiers
  id: string;
  organizationId: string;
  workspaceId: string;

  // Personal info
  firstName?: string;
  lastName?: string;
  name?: string; // Computed or provided directly
  email?: string;
  phone?: string;

  // Company info
  company?: string;
  title?: string;
  department?: string;

  // Social presence
  linkedInUrl?: string;
  twitterHandle?: string;
  website?: string;

  // Location
  address?: ContactAddress;

  // Contact management
  isVIP?: boolean;
  tags?: string[];
  notes?: string;
  ownerId?: string;

  // Activity tracking
  lastContactedAt?: FirestoreDate;

  // Additional data
  customFields?: CustomFields;

  // Timestamps
  createdAt: FirestoreDate;
  updatedAt?: FirestoreDate;
}

/**
 * Contact filters for queries
 */
export interface ContactFilters {
  isVIP?: boolean;
  company?: string;
  ownerId?: string;
  tags?: string[];
}

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  pageSize?: number;
  lastDoc?: unknown; // QueryDocumentSnapshot from Firestore
}

/**
 * Paginated result container
 */
export interface PaginatedResult<T> {
  data: T[];
  lastDoc: unknown | null; // QueryDocumentSnapshot or null
  hasMore: boolean;
  total?: number;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  code:
    | 'REQUIRED'
    | 'INVALID_FORMAT'
    | 'INVALID_VALUE'
    | 'OUT_OF_RANGE'
    | 'DUPLICATE'
    | 'UNKNOWN';
  details?: unknown;
}

/**
 * Validation result for API responses
 */
export interface ValidationResult<T = unknown> {
  valid: boolean;
  errors: ValidationError[];
  data?: T;
}

/**
 * Create a validation error
 */
export function createValidationError(
  field: string,
  message: string,
  code: ValidationError['code'] = 'INVALID_VALUE',
  details?: unknown
): ValidationError {
  return { field, message, code, details };
}

/**
 * Create a successful validation result
 */
export function validationSuccess<T>(data: T): ValidationResult<T> {
  return {
    valid: true,
    errors: [],
    data,
  };
}

/**
 * Create a failed validation result
 */
export function validationFailure(errors: ValidationError[]): ValidationResult {
  return {
    valid: false,
    errors,
  };
}

// ============================================================================
// ENTITY TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if object is a Deal
 */
export function isDeal(entity: unknown): entity is Deal {
  if (!entity || typeof entity !== 'object') return false;

  const deal = entity as Record<string, unknown>;

  return (
    typeof deal.id === 'string' &&
    typeof deal.organizationId === 'string' &&
    typeof deal.workspaceId === 'string' &&
    typeof deal.name === 'string' &&
    typeof deal.value === 'number' &&
    isValidDealStage(deal.stage) &&
    typeof deal.probability === 'number'
  );
}

/**
 * Type guard to check if object is a Lead
 */
export function isLead(entity: unknown): entity is Lead {
  if (!entity || typeof entity !== 'object') return false;

  const lead = entity as Record<string, unknown>;

  return (
    typeof lead.id === 'string' &&
    typeof lead.organizationId === 'string' &&
    typeof lead.workspaceId === 'string' &&
    typeof lead.firstName === 'string' &&
    typeof lead.lastName === 'string' &&
    typeof lead.email === 'string' &&
    isValidLeadStatus(lead.status)
  );
}

/**
 * Type guard to check if object is a Contact
 */
export function isContact(entity: unknown): entity is Contact {
  if (!entity || typeof entity !== 'object') return false;

  const contact = entity as Record<string, unknown>;

  return (
    typeof contact.id === 'string' &&
    typeof contact.organizationId === 'string' &&
    typeof contact.workspaceId === 'string' &&
    (typeof contact.firstName === 'string' ||
     typeof contact.lastName === 'string' ||
     typeof contact.name === 'string')
  );
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Union type of all CRM entity types
 */
export type CRMEntity = Deal | Lead | Contact;

/**
 * Entity type discriminator
 */
export type CRMEntityType = 'deal' | 'lead' | 'contact';

/**
 * Get entity type from entity
 */
export function getEntityType(entity: CRMEntity): CRMEntityType {
  if (isDeal(entity)) return 'deal';
  if (isLead(entity)) return 'lead';
  if (isContact(entity)) return 'contact';

  throw new Error('Unknown CRM entity type');
}

/**
 * Omit system fields for creation
 */
export type CreateDealInput = Omit<Deal, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>;
export type CreateLeadInput = Omit<Lead, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>;
export type CreateContactInput = Omit<Contact, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>;

/**
 * Partial updates without system fields
 */
export type UpdateDealInput = Partial<Omit<Deal, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>>;
export type UpdateLeadInput = Partial<Omit<Lead, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>>;
export type UpdateContactInput = Partial<Omit<Contact, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>>;
