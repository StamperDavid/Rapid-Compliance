/**
 * Discovery Source Service — CRUD for configured scraping targets
 *
 * Sources define what to scrape, how often, and what to extract.
 * Pre-built templates provide one-click setup for common data sources.
 *
 * @module lib/intelligence/discovery-source-service
 */

import { adminDb } from '@/lib/firebase/admin';
import { getDiscoverySourcesCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import {
  generateDiscoveryId,
  type DiscoverySource,
  type DiscoverySourceSchedule,
} from '@/types/intelligence-discovery';

const LOG_PREFIX = '[DiscoverySourceService]';

function ensureDb() {
  if (!adminDb) {
    throw new Error(`${LOG_PREFIX} Admin Firestore not available`);
  }
  return adminDb;
}

// ============================================================================
// CRUD
// ============================================================================

export async function createSource(
  params: Omit<DiscoverySource, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  userId: string
): Promise<DiscoverySource> {
  const db = ensureDb();
  const now = new Date().toISOString();
  const id = generateDiscoveryId('src');

  const source: DiscoverySource = {
    ...params,
    id,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };

  await db.collection(getDiscoverySourcesCollection()).doc(id).set(source);

  logger.info(`${LOG_PREFIX} Source created`, { sourceId: id, name: params.name });
  return source;
}

export async function getSource(sourceId: string): Promise<DiscoverySource | null> {
  const db = ensureDb();
  const doc = await db.collection(getDiscoverySourcesCollection()).doc(sourceId).get();
  return doc.exists ? (doc.data() as DiscoverySource) : null;
}

export async function listSources(): Promise<DiscoverySource[]> {
  const db = ensureDb();
  const snap = await db
    .collection(getDiscoverySourcesCollection())
    .orderBy('createdAt', 'desc')
    .get();

  const sources: DiscoverySource[] = [];
  for (const doc of snap.docs) {
    sources.push(doc.data() as DiscoverySource);
  }
  return sources;
}

export async function updateSource(
  sourceId: string,
  updates: Partial<Omit<DiscoverySource, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> {
  const db = ensureDb();

  await db.collection(getDiscoverySourcesCollection()).doc(sourceId).update({
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  logger.info(`${LOG_PREFIX} Source updated`, { sourceId });
}

export async function deleteSource(sourceId: string): Promise<void> {
  const db = ensureDb();
  await db.collection(getDiscoverySourcesCollection()).doc(sourceId).delete();
  logger.info(`${LOG_PREFIX} Source deleted`, { sourceId });
}

export async function updateSourceSchedule(
  sourceId: string,
  schedule: Partial<DiscoverySourceSchedule>
): Promise<void> {
  const db = ensureDb();
  const doc = await db.collection(getDiscoverySourcesCollection()).doc(sourceId).get();

  if (!doc.exists) {
    logger.warn(`${LOG_PREFIX} Source not found for schedule update`, { sourceId });
    return;
  }

  const current = doc.data() as DiscoverySource;
  const mergedSchedule: DiscoverySourceSchedule = { ...current.schedule, ...schedule };

  await db.collection(getDiscoverySourcesCollection()).doc(sourceId).update({
    schedule: mergedSchedule,
    updatedAt: new Date().toISOString(),
  });
}

// ============================================================================
// SOURCE TEMPLATES — Pre-built configs for common data sources
// ============================================================================

export interface SourceTemplate {
  id: string;
  name: string;
  description: string;
  sourceType: DiscoverySource['sourceType'];
  baseUrl: string;
  urlPattern: string | null;
  extractionSchema: DiscoverySource['extractionSchema'];
  enrichmentHints: string[];
  defaultSchedule: DiscoverySourceSchedule;
  defaultEnrichmentDepth: DiscoverySource['enrichmentDepth'];
  defaultMaxRecords: number;
}

export const SOURCE_TEMPLATES: SourceTemplate[] = [
  {
    id: 'tpl-fmcsa-new-dot',
    name: 'FMCSA New DOT Numbers',
    description: 'Daily scrape of newly registered USDOT numbers from the Federal Motor Carrier Safety Administration.',
    sourceType: 'government_registry',
    baseUrl: 'https://safer.fmcsa.dot.gov',
    urlPattern: null,
    extractionSchema: [
      { fieldName: 'dot_number', fieldType: 'string', required: true, description: 'USDOT Number', extractionHint: 'DOT number, USDOT, carrier number' },
      { fieldName: 'company_name', fieldType: 'string', required: true, description: 'Legal business name', extractionHint: 'Legal Name, Company Name, DBA' },
      { fieldName: 'dba_name', fieldType: 'string', required: false, description: 'Doing Business As name', extractionHint: 'DBA, d/b/a, doing business as' },
      { fieldName: 'physical_address', fieldType: 'string', required: true, description: 'Physical address of the carrier', extractionHint: 'Physical Address, Street Address, Location' },
      { fieldName: 'mailing_address', fieldType: 'string', required: false, description: 'Mailing address if different', extractionHint: 'Mailing Address, PO Box' },
      { fieldName: 'phone', fieldType: 'string', required: false, description: 'Business phone number', extractionHint: 'Phone, Telephone, Tel' },
      { fieldName: 'owner_name', fieldType: 'string', required: false, description: 'Owner or principal name', extractionHint: 'Owner, Principal, Officer, Contact Name' },
      { fieldName: 'operation_type', fieldType: 'string', required: false, description: 'Type of operation (interstate/intrastate)', extractionHint: 'Operation Classification, Interstate, Intrastate, HHG, Private, For-Hire' },
      { fieldName: 'carrier_type', fieldType: 'string', required: false, description: 'Carrier classification', extractionHint: 'Carrier Operation, Property, Passenger, Broker' },
      { fieldName: 'fleet_size', fieldType: 'number', required: false, description: 'Number of power units', extractionHint: 'Power Units, Fleet Size, Trucks, Vehicles' },
      { fieldName: 'driver_count', fieldType: 'number', required: false, description: 'Number of drivers', extractionHint: 'Drivers, CDL Holders' },
      { fieldName: 'mc_number', fieldType: 'string', required: false, description: 'Motor Carrier number', extractionHint: 'MC Number, MC#, Motor Carrier' },
      { fieldName: 'registration_date', fieldType: 'date', required: false, description: 'Date the USDOT was issued', extractionHint: 'MCS-150 Date, Registration Date, Date Added' },
    ],
    enrichmentHints: ['google', 'linkedin', 'facebook', 'state_registry', 'google_business'],
    defaultSchedule: {
      frequency: 'daily',
      timeOfDay: '06:00',
      lastRunAt: null,
      nextRunAt: null,
      enabled: true,
    },
    defaultEnrichmentDepth: 'standard',
    defaultMaxRecords: 500,
  },
  {
    id: 'tpl-state-business-filings',
    name: 'State Business Filings',
    description: 'New business registrations from state Secretary of State databases.',
    sourceType: 'government_registry',
    baseUrl: '',
    urlPattern: null,
    extractionSchema: [
      { fieldName: 'business_name', fieldType: 'string', required: true, description: 'Registered business name', extractionHint: 'Business Name, Entity Name, Company Name' },
      { fieldName: 'entity_type', fieldType: 'string', required: false, description: 'LLC, Corp, Sole Prop, etc.', extractionHint: 'Entity Type, Organization Type, Business Type' },
      { fieldName: 'filing_date', fieldType: 'date', required: true, description: 'Date of filing', extractionHint: 'Filing Date, Registration Date, Formed Date' },
      { fieldName: 'registered_agent', fieldType: 'string', required: false, description: 'Registered agent name', extractionHint: 'Registered Agent, Agent Name, Statutory Agent' },
      { fieldName: 'principal_address', fieldType: 'string', required: false, description: 'Principal business address', extractionHint: 'Principal Address, Business Address' },
      { fieldName: 'officer_name', fieldType: 'string', required: false, description: 'Officer or director name', extractionHint: 'Officer, Director, Manager, Member, Organizer' },
      { fieldName: 'state', fieldType: 'string', required: true, description: 'State of registration', extractionHint: 'State, Jurisdiction' },
      { fieldName: 'filing_number', fieldType: 'string', required: false, description: 'State filing or entity number', extractionHint: 'Filing Number, Entity Number, Charter Number' },
    ],
    enrichmentHints: ['google', 'linkedin', 'state_registry'],
    defaultSchedule: {
      frequency: 'weekly',
      timeOfDay: '07:00',
      lastRunAt: null,
      nextRunAt: null,
      enabled: true,
    },
    defaultEnrichmentDepth: 'standard',
    defaultMaxRecords: 200,
  },
  {
    id: 'tpl-sam-gov',
    name: 'SAM.gov New Registrations',
    description: 'New government contractor registrations from the System for Award Management.',
    sourceType: 'government_registry',
    baseUrl: 'https://sam.gov',
    urlPattern: null,
    extractionSchema: [
      { fieldName: 'entity_name', fieldType: 'string', required: true, description: 'Legal business name', extractionHint: 'Legal Business Name, Entity Name' },
      { fieldName: 'uei', fieldType: 'string', required: true, description: 'Unique Entity Identifier', extractionHint: 'UEI, Unique Entity ID, SAM UEI' },
      { fieldName: 'cage_code', fieldType: 'string', required: false, description: 'CAGE/NCAGE Code', extractionHint: 'CAGE Code, NCAGE' },
      { fieldName: 'physical_address', fieldType: 'string', required: false, description: 'Physical address', extractionHint: 'Physical Address, Business Address' },
      { fieldName: 'naics_codes', fieldType: 'array', required: false, description: 'NAICS industry codes', extractionHint: 'NAICS, Industry Classification' },
      { fieldName: 'registration_date', fieldType: 'date', required: false, description: 'SAM registration date', extractionHint: 'Registration Date, Active Date' },
      { fieldName: 'poc_name', fieldType: 'string', required: false, description: 'Point of contact name', extractionHint: 'Point of Contact, POC, Contact Person' },
      { fieldName: 'poc_phone', fieldType: 'string', required: false, description: 'POC phone number', extractionHint: 'Phone, Contact Phone' },
      { fieldName: 'poc_email', fieldType: 'string', required: false, description: 'POC email', extractionHint: 'Email, Contact Email' },
    ],
    enrichmentHints: ['google', 'linkedin', 'website'],
    defaultSchedule: {
      frequency: 'weekly',
      timeOfDay: '08:00',
      lastRunAt: null,
      nextRunAt: null,
      enabled: true,
    },
    defaultEnrichmentDepth: 'basic',
    defaultMaxRecords: 100,
  },
];

export function getSourceTemplates(): SourceTemplate[] {
  return SOURCE_TEMPLATES;
}

export function getSourceTemplate(templateId: string): SourceTemplate | undefined {
  return SOURCE_TEMPLATES.find((t) => t.id === templateId);
}

/**
 * Create a source from a template with one click.
 * Users can override defaults before saving.
 */
export async function createSourceFromTemplate(
  templateId: string,
  userId: string,
  overrides?: Partial<Omit<DiscoverySource, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>
): Promise<DiscoverySource | null> {
  const template = getSourceTemplate(templateId);
  if (!template) {
    logger.warn(`${LOG_PREFIX} Template not found`, { templateId });
    return null;
  }

  return createSource(
    {
      name: overrides?.name ?? template.name,
      description: overrides?.description ?? template.description,
      sourceType: overrides?.sourceType ?? template.sourceType,
      baseUrl: overrides?.baseUrl ?? template.baseUrl,
      urlPattern: overrides?.urlPattern ?? template.urlPattern,
      extractionSchema: overrides?.extractionSchema ?? template.extractionSchema,
      enrichmentHints: overrides?.enrichmentHints ?? template.enrichmentHints,
      schedule: overrides?.schedule ?? template.defaultSchedule,
      enrichmentDepth: overrides?.enrichmentDepth ?? template.defaultEnrichmentDepth,
      maxRecordsPerRun: overrides?.maxRecordsPerRun ?? template.defaultMaxRecords,
      status: 'active',
      templateId,
    },
    userId
  );
}
