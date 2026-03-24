/**
 * Intelligence Discovery Types
 *
 * Core types for the Intelligence Discovery Hub — a general-purpose data
 * intelligence system that scrapes seed data from primary sources (e.g. FMCSA,
 * state tax boards) and enriches it across multiple secondary sources.
 *
 * Firestore Collections (all under organizations/{PLATFORM_ID}/):
 *   - discovery_sources     — configured scraping targets
 *   - discovery_operations   — individual scrape runs
 *   - discovery_findings     — entities discovered + enrichment data
 *   - discovery_actions      — granular audit log of every step
 *
 * @module types/intelligence-discovery
 */

import { z } from 'zod';

// ============================================================================
// ENUMS & LITERALS
// ============================================================================

export const DISCOVERY_SOURCE_TYPES = [
  'government_registry',
  'business_directory',
  'social_platform',
  'search_engine',
  'public_api',
  'news_source',
  'custom',
] as const;
export type DiscoverySourceType = (typeof DISCOVERY_SOURCE_TYPES)[number];

export const ENRICHMENT_DEPTH_LEVELS = ['basic', 'standard', 'deep'] as const;
export type EnrichmentDepth = (typeof ENRICHMENT_DEPTH_LEVELS)[number];

export const SCHEDULE_FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
] as const;
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

export const OPERATION_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'paused',
] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];

export const ENRICHMENT_STATUSES = [
  'pending',
  'in_progress',
  'enriched',
  'partial',
  'failed',
] as const;
export type EnrichmentStatus = (typeof ENRICHMENT_STATUSES)[number];

export const APPROVAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'converted',
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const ACTION_TYPES = [
  'scrape',
  'search',
  'extract',
  'enrich',
  'validate',
  'error',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_STATUSES = [
  'running',
  'completed',
  'failed',
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const OPERATION_TRIGGERS = [
  'schedule',
  'manual',
  'jasper',
] as const;
export type OperationTrigger = (typeof OPERATION_TRIGGERS)[number];

// ============================================================================
// FIELD DEFINITION — Schema for what to extract from a source
// ============================================================================

export interface FieldDefinition {
  fieldName: string;
  fieldType: 'string' | 'number' | 'boolean' | 'date' | 'array';
  required: boolean;
  description: string;
  extractionHint: string;
}

export const FieldDefinitionSchema = z.object({
  fieldName: z.string().min(1),
  fieldType: z.enum(['string', 'number', 'boolean', 'date', 'array']),
  required: z.boolean(),
  description: z.string().min(1),
  extractionHint: z.string().min(1),
});

// ============================================================================
// DISCOVERY SOURCE — A configured scraping target
// ============================================================================

export interface DiscoverySourceSchedule {
  frequency: ScheduleFrequency;
  timeOfDay: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  enabled: boolean;
}

export const DiscoverySourceScheduleSchema = z.object({
  frequency: z.enum(SCHEDULE_FREQUENCIES),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string().nullable(),
  enabled: z.boolean(),
});

export interface DiscoverySource {
  id: string;
  name: string;
  description: string;
  sourceType: DiscoverySourceType;
  baseUrl: string;
  urlPattern: string | null;
  extractionSchema: FieldDefinition[];
  enrichmentHints: string[];
  schedule: DiscoverySourceSchedule;
  enrichmentDepth: EnrichmentDepth;
  maxRecordsPerRun: number;
  status: 'active' | 'inactive' | 'error';
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export const DiscoverySourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  sourceType: z.enum(DISCOVERY_SOURCE_TYPES),
  baseUrl: z.string().url(),
  urlPattern: z.string().nullable(),
  extractionSchema: z.array(FieldDefinitionSchema),
  enrichmentHints: z.array(z.string()),
  schedule: DiscoverySourceScheduleSchema,
  enrichmentDepth: z.enum(ENRICHMENT_DEPTH_LEVELS),
  maxRecordsPerRun: z.number().int().min(1).max(10000),
  status: z.enum(['active', 'inactive', 'error']),
  templateId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
});

// Schema for creating a source (id, timestamps, createdBy auto-generated)
export const CreateDiscoverySourceSchema = DiscoverySourceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

// Schema for updating a source (all fields optional)
export const UpdateDiscoverySourceSchema = CreateDiscoverySourceSchema.partial();

// ============================================================================
// DISCOVERY OPERATION — A single scrape run
// ============================================================================

export interface OperationStats {
  totalFound: number;
  totalEnriched: number;
  totalFailed: number;
  totalApproved: number;
  totalRejected: number;
  enrichmentProgress: number;
}

export const OperationStatsSchema = z.object({
  totalFound: z.number().int().min(0),
  totalEnriched: z.number().int().min(0),
  totalFailed: z.number().int().min(0),
  totalApproved: z.number().int().min(0),
  totalRejected: z.number().int().min(0),
  enrichmentProgress: z.number().min(0).max(100),
});

export interface DiscoveryOperationConfig {
  maxRecords: number;
  enrichmentDepth: EnrichmentDepth;
  enableMultiHop: boolean;
  secondarySources: string[];
}

export const DiscoveryOperationConfigSchema = z.object({
  maxRecords: z.number().int().min(1).max(10000),
  enrichmentDepth: z.enum(ENRICHMENT_DEPTH_LEVELS),
  enableMultiHop: z.boolean(),
  secondarySources: z.array(z.string()),
});

export interface DiscoveryOperation {
  id: string;
  sourceId: string;
  sourceName: string;
  status: OperationStatus;
  triggeredBy: OperationTrigger;
  config: DiscoveryOperationConfig;
  stats: OperationStats;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export const DiscoveryOperationSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  sourceName: z.string().min(1),
  status: z.enum(OPERATION_STATUSES),
  triggeredBy: z.enum(OPERATION_TRIGGERS),
  config: DiscoveryOperationConfigSchema,
  stats: OperationStatsSchema,
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
});

// Schema for creating an operation
export const CreateOperationSchema = z.object({
  sourceId: z.string().min(1),
  config: DiscoveryOperationConfigSchema.optional(),
});

// ============================================================================
// ENRICHMENT SOURCE RESULT — What a single secondary source yielded
// ============================================================================

export interface EnrichmentSourceResult {
  sourceName: string;
  url: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  fieldsFound: string[];
  data: Record<string, string>;
  confidence: number;
  durationMs: number;
}

export const EnrichmentSourceResultSchema = z.object({
  sourceName: z.string().min(1),
  url: z.string(),
  status: z.enum(['success', 'partial', 'failed', 'skipped']),
  fieldsFound: z.array(z.string()),
  data: z.record(z.string(), z.string()),
  confidence: z.number().min(0).max(100),
  durationMs: z.number().int().min(0),
});

// ============================================================================
// DISCOVERY FINDING — A single discovered entity with enrichment data
// ============================================================================

export interface ContactInfo {
  phones: string[];
  emails: string[];
  socialMedia: Record<string, string>;
  website: string | null;
  additionalContacts: Array<{
    name: string;
    title: string;
    phone: string | null;
    email: string | null;
  }>;
}

export const ContactInfoSchema = z.object({
  phones: z.array(z.string()),
  emails: z.array(z.string()),
  socialMedia: z.record(z.string(), z.string()),
  website: z.string().nullable(),
  additionalContacts: z.array(z.object({
    name: z.string(),
    title: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
  })),
});

export interface DiscoveryFinding {
  id: string;
  operationId: string;
  sourceId: string;
  seedData: Record<string, string>;
  enrichedData: ContactInfo;
  enrichmentStatus: EnrichmentStatus;
  enrichmentSources: EnrichmentSourceResult[];
  confidenceScores: Record<string, number>;
  overallConfidence: number;
  approvalStatus: ApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionNotes: string | null;
  leadId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DiscoveryFindingSchema = z.object({
  id: z.string().min(1),
  operationId: z.string().min(1),
  sourceId: z.string().min(1),
  seedData: z.record(z.string(), z.string()),
  enrichedData: ContactInfoSchema,
  enrichmentStatus: z.enum(ENRICHMENT_STATUSES),
  enrichmentSources: z.array(EnrichmentSourceResultSchema),
  confidenceScores: z.record(z.string(), z.number()),
  overallConfidence: z.number().min(0).max(100),
  approvalStatus: z.enum(APPROVAL_STATUSES),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  rejectionNotes: z.string().nullable(),
  leadId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Schema for updating approval status
export const UpdateFindingApprovalSchema = z.object({
  approvalStatus: z.enum(['approved', 'rejected']),
  rejectionNotes: z.string().max(1000).optional(),
});

// Schema for bulk approval
export const BulkApprovalSchema = z.object({
  findingIds: z.array(z.string().min(1)).min(1).max(500),
  approvalStatus: z.enum(['approved', 'rejected']),
  rejectionNotes: z.string().max(1000).optional(),
});

// ============================================================================
// DISCOVERY ACTION — Granular audit log entry
// ============================================================================

export interface DiscoveryActionData {
  extractedFields: Record<string, string> | null;
  rawContentSize: number | null;
  extractedContentSize: number | null;
  confidence: number | null;
  errorMessage: string | null;
  summary: string | null;
}

export const DiscoveryActionDataSchema = z.object({
  extractedFields: z.record(z.string(), z.string()).nullable(),
  rawContentSize: z.number().int().nullable(),
  extractedContentSize: z.number().int().nullable(),
  confidence: z.number().min(0).max(100).nullable(),
  errorMessage: z.string().nullable(),
  summary: z.string().nullable(),
});

export interface DiscoveryAction {
  id: string;
  operationId: string;
  findingId: string | null;
  actionType: ActionType;
  sourceUrl: string;
  targetUrl: string | null;
  status: ActionStatus;
  data: DiscoveryActionData;
  durationMs: number | null;
  startedAt: string;
  completedAt: string | null;
}

export const DiscoveryActionSchema = z.object({
  id: z.string().min(1),
  operationId: z.string().min(1),
  findingId: z.string().nullable(),
  actionType: z.enum(ACTION_TYPES),
  sourceUrl: z.string(),
  targetUrl: z.string().nullable(),
  status: z.enum(ACTION_STATUSES),
  data: DiscoveryActionDataSchema,
  durationMs: z.number().int().nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
});

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

export const ListOperationsQuerySchema = z.object({
  status: z.enum(OPERATION_STATUSES).optional(),
  sourceId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startAfter: z.string().optional(),
});

export const ListFindingsQuerySchema = z.object({
  enrichmentStatus: z.enum(ENRICHMENT_STATUSES).optional(),
  approvalStatus: z.enum(APPROVAL_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  startAfter: z.string().optional(),
});

export const ListActionsQuerySchema = z.object({
  operationId: z.string().min(1),
  findingId: z.string().optional(),
  since: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function generateDiscoveryId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

export function createEmptyContactInfo(): ContactInfo {
  return {
    phones: [],
    emails: [],
    socialMedia: {},
    website: null,
    additionalContacts: [],
  };
}

export function createEmptyOperationStats(): OperationStats {
  return {
    totalFound: 0,
    totalEnriched: 0,
    totalFailed: 0,
    totalApproved: 0,
    totalRejected: 0,
    enrichmentProgress: 0,
  };
}

export function createEmptyActionData(): DiscoveryActionData {
  return {
    extractedFields: null,
    rawContentSize: null,
    extractedContentSize: null,
    confidence: null,
    errorMessage: null,
    summary: null,
  };
}
