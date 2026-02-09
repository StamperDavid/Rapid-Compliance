/**
 * CRM Field Mapping System
 *
 * Maps form field responses to CRM entities (leads, contacts, deals, companies).
 * Handles data transformation, entity creation, and updates.
 *
 * CAPABILITIES:
 * - Map form fields to any CRM entity field
 * - Transform data during mapping (uppercase, lowercase, format)
 * - Create new CRM records from submissions
 * - Update existing records (match by email, phone, etc.)
 * - Handle composite fields (name, address)
 *
 * @module forms/crm-mapping
 * @version 1.0.0
 */

import {
  collection,
  doc,
  getDoc as _getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

// Helper to ensure db is available
function getDb() {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  return db;
}
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import type {
  FormSubmission,
  FieldResponse,
  CRMFieldMapping,
  FieldMappingRule,
} from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * CRM entity types
 */
export type CRMEntityType = 'lead' | 'contact' | 'deal' | 'company' | 'custom';

/**
 * Standard CRM field definitions
 */
export interface CRMFieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'date' | 'currency' | 'select' | 'multiselect';
  required?: boolean;
  entity: CRMEntityType;
}

/**
 * CRM record structure
 */
export interface CRMRecord {
  id: string;
  entityType: CRMEntityType;
  workspaceId: string;
  data: Record<string, unknown>;
  source: 'form' | 'import' | 'manual' | 'api';
  sourceFormId?: string;
  sourceSubmissionId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Mapping result
 */
export interface CRMMappingResult {
  success: boolean;
  entityType: CRMEntityType;
  recordId?: string;
  action: 'created' | 'updated' | 'matched' | 'skipped';
  errors?: string[];
  mappedFields: Record<string, unknown>;
}

/**
 * Complete sync result for a submission
 */
export interface CRMSyncResult {
  submissionId: string;
  success: boolean;
  results: CRMMappingResult[];
  errors: string[];
  syncedAt: Timestamp;
}

// ============================================================================
// STANDARD CRM FIELDS
// ============================================================================

/**
 * Standard fields for each entity type
 */
export const STANDARD_CRM_FIELDS: Record<CRMEntityType, CRMFieldDefinition[]> = {
  lead: [
    { name: 'firstName', label: 'First Name', type: 'text', entity: 'lead' },
    { name: 'lastName', label: 'Last Name', type: 'text', entity: 'lead' },
    { name: 'email', label: 'Email', type: 'email', required: true, entity: 'lead' },
    { name: 'phone', label: 'Phone', type: 'phone', entity: 'lead' },
    { name: 'company', label: 'Company', type: 'text', entity: 'lead' },
    { name: 'title', label: 'Job Title', type: 'text', entity: 'lead' },
    { name: 'website', label: 'Website', type: 'text', entity: 'lead' },
    { name: 'source', label: 'Lead Source', type: 'select', entity: 'lead' },
    { name: 'status', label: 'Status', type: 'select', entity: 'lead' },
    { name: 'notes', label: 'Notes', type: 'text', entity: 'lead' },
    { name: 'street', label: 'Street Address', type: 'text', entity: 'lead' },
    { name: 'city', label: 'City', type: 'text', entity: 'lead' },
    { name: 'state', label: 'State/Province', type: 'text', entity: 'lead' },
    { name: 'zip', label: 'Zip/Postal Code', type: 'text', entity: 'lead' },
    { name: 'country', label: 'Country', type: 'text', entity: 'lead' },
  ],
  contact: [
    { name: 'firstName', label: 'First Name', type: 'text', required: true, entity: 'contact' },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true, entity: 'contact' },
    { name: 'email', label: 'Email', type: 'email', required: true, entity: 'contact' },
    { name: 'phone', label: 'Phone', type: 'phone', entity: 'contact' },
    { name: 'mobile', label: 'Mobile', type: 'phone', entity: 'contact' },
    { name: 'company', label: 'Company', type: 'text', entity: 'contact' },
    { name: 'title', label: 'Job Title', type: 'text', entity: 'contact' },
    { name: 'department', label: 'Department', type: 'text', entity: 'contact' },
  ],
  deal: [
    { name: 'name', label: 'Deal Name', type: 'text', required: true, entity: 'deal' },
    { name: 'value', label: 'Deal Value', type: 'currency', entity: 'deal' },
    { name: 'stage', label: 'Stage', type: 'select', entity: 'deal' },
    { name: 'probability', label: 'Probability', type: 'number', entity: 'deal' },
    { name: 'closeDate', label: 'Expected Close Date', type: 'date', entity: 'deal' },
    { name: 'notes', label: 'Notes', type: 'text', entity: 'deal' },
  ],
  company: [
    { name: 'name', label: 'Company Name', type: 'text', required: true, entity: 'company' },
    { name: 'website', label: 'Website', type: 'text', entity: 'company' },
    { name: 'industry', label: 'Industry', type: 'select', entity: 'company' },
    { name: 'size', label: 'Company Size', type: 'select', entity: 'company' },
    { name: 'revenue', label: 'Annual Revenue', type: 'currency', entity: 'company' },
    { name: 'phone', label: 'Phone', type: 'phone', entity: 'company' },
    { name: 'street', label: 'Street Address', type: 'text', entity: 'company' },
    { name: 'city', label: 'City', type: 'text', entity: 'company' },
    { name: 'state', label: 'State/Province', type: 'text', entity: 'company' },
    { name: 'zip', label: 'Zip/Postal Code', type: 'text', entity: 'company' },
    { name: 'country', label: 'Country', type: 'text', entity: 'company' },
  ],
  custom: [],
};

// ============================================================================
// DATA TRANSFORMATIONS
// ============================================================================

/**
 * Transform a value based on the transformation type
 */
export function transformValue(
  value: unknown,
  transformation?: 'none' | 'uppercase' | 'lowercase' | 'trim' | 'capitalize'
): unknown {
  if (value == null) {return value;}

  const strValue = String(value);

  switch (transformation) {
    case 'uppercase':
      return strValue.toUpperCase();
    case 'lowercase':
      return strValue.toLowerCase();
    case 'trim':
      return strValue.trim();
    case 'capitalize':
      return strValue.charAt(0).toUpperCase() + strValue.slice(1).toLowerCase();
    case 'none':
    default:
      return value;
  }
}

/**
 * Format a phone number
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Format based on length
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  return phone; // Return original if format unknown
}

/**
 * Parse a name field into components
 */
export function parseName(
  fullName: string
): { firstName: string; lastName: string; middleName?: string } {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

/**
 * Parse an address field into components
 */
export function parseAddress(address: string): Record<string, string> {
  // This is a simplified parser - in production, use a proper address parsing library
  const lines = address.split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length === 0) {return {};}

  const result: Record<string, string> = {};

  if (lines.length >= 1) {result.street = lines[0];}
  if (lines.length >= 2) {
    // Try to parse city, state, zip from second line
    const lastLine = lines[lines.length - 1];
    const cityStateZip = lastLine.match(/^(.+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/i);

    if (cityStateZip) {
      result.city = cityStateZip[1];
      result.state = cityStateZip[2];
      result.zip = cityStateZip[3];
    } else {
      result.city = lastLine;
    }
  }

  return result;
}

// ============================================================================
// MAPPING ENGINE
// ============================================================================

/**
 * Map form responses to CRM data based on mapping configuration
 */
export function mapResponsesToCRM(
  responses: FieldResponse[],
  mapping: CRMFieldMapping
): Record<string, unknown> {
  const crmData: Record<string, unknown> = {};

  // Create a lookup map for responses by field ID
  const responseMap = new Map<string, FieldResponse>();
  for (const response of responses) {
    responseMap.set(response.fieldId, response);
  }

  // Process each mapping rule
  for (const rule of mapping.fieldMappings) {
    const response = responseMap.get(rule.formFieldId);

    if (response?.value == null) {
      continue;
    }

    // Transform the value
    const transformedValue = transformValue(response.value, rule.transformation);

    // Handle composite fields
    if (response.fieldType === 'name' && typeof transformedValue === 'string') {
      const nameParts = parseName(transformedValue);
      if (rule.crmFieldName === 'fullName') {
        Object.assign(crmData, nameParts);
      } else {
        crmData[rule.crmFieldName] = transformedValue;
      }
    } else if (response.fieldType === 'address' && typeof transformedValue === 'string') {
      const addressParts = parseAddress(transformedValue);
      if (rule.crmFieldName === 'fullAddress') {
        Object.assign(crmData, addressParts);
      } else {
        crmData[rule.crmFieldName] = transformedValue;
      }
    } else {
      crmData[rule.crmFieldName] = transformedValue;
    }
  }

  return crmData;
}

// ============================================================================
// CRM OPERATIONS
// ============================================================================

/**
 * Get collection path for CRM entity
 */
function getCRMCollectionPath(
  workspaceId: string,
  entityType: CRMEntityType
): string {
  return `${getSubCollection('workspaces')}/${workspaceId}/${entityType}s`;
}

/**
 * Find existing CRM record by matching field
 */
export async function findExistingRecord(
  workspaceId: string,
  entityType: CRMEntityType,
  matchingField: string,
  matchingValue: unknown
): Promise<CRMRecord | null> {
  if (!matchingValue) {return null;}

  const collectionPath = getCRMCollectionPath(workspaceId, entityType);
  const collectionRef = collection(getDb(), collectionPath);

  const q = query(
    collectionRef,
    where(`data.${matchingField}`, '==', matchingValue)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {return null;}

  return snapshot.docs[0].data() as CRMRecord;
}

/**
 * Create a new CRM record
 */
export async function createCRMRecord(
  workspaceId: string,
  entityType: CRMEntityType,
  data: Record<string, unknown>,
  sourceFormId?: string,
  sourceSubmissionId?: string
): Promise<CRMRecord> {
  const collectionPath = getCRMCollectionPath(workspaceId, entityType);
  const recordRef = doc(collection(getDb(), collectionPath));
  const recordId = recordRef.id;

  const record: CRMRecord = {
    id: recordId,
    entityType,
    workspaceId,
    data,
    source: 'form',
    sourceFormId,
    sourceSubmissionId,
    // Cast required: serverTimestamp() returns FieldValue, resolved to Timestamp on write
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await setDoc(recordRef, record);

  logger.info('CRM record created', {
    workspaceId,
    entityType,
    recordId,
    sourceFormId,
  });

  return { ...record, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
}

/**
 * Update an existing CRM record
 */
export async function updateCRMRecord(
  workspaceId: string,
  entityType: CRMEntityType,
  recordId: string,
  data: Record<string, unknown>
): Promise<void> {
  const collectionPath = getCRMCollectionPath(workspaceId, entityType);
  const recordRef = doc(getDb(), collectionPath, recordId);

  await updateDoc(recordRef, {
    data: {
      ...data,
    },
    updatedAt: serverTimestamp(),
  });

  logger.info('CRM record updated', {
    workspaceId,
    entityType,
    recordId,
  });
}

// ============================================================================
// SYNC ENGINE
// ============================================================================

/**
 * Sync a form submission to CRM
 */
export async function syncSubmissionToCRM(
  submission: FormSubmission,
  mapping: CRMFieldMapping
): Promise<CRMSyncResult> {
  const result: CRMSyncResult = {
    submissionId: submission.id,
    success: true,
    results: [],
    errors: [],
    syncedAt: Timestamp.now(),
  };

  // Skip if mapping is disabled
  if (!mapping.enabled) {
    result.results.push({
      success: true,
      entityType: mapping.entityType,
      action: 'skipped',
      mappedFields: {},
    });
    return result;
  }

  try {
    // Map responses to CRM data
    const crmData = mapResponsesToCRM(submission.responses, mapping);

    if (Object.keys(crmData).length === 0) {
      result.errors.push('No fields mapped to CRM');
      result.success = false;
      return result;
    }

    const entityType = mapping.entityType as CRMEntityType;
    let mappingResult: CRMMappingResult;

    // Check for existing record if matching field specified
    let existingRecord: CRMRecord | null = null;
    if (mapping.matchingField && crmData[mapping.matchingField]) {
      existingRecord = await findExistingRecord(
        submission.workspaceId,
        entityType,
        mapping.matchingField,
        crmData[mapping.matchingField]
      );
    }

    if (existingRecord && mapping.updateExisting) {
      // Update existing record
      await updateCRMRecord(
        submission.workspaceId,
        entityType,
        existingRecord.id,
        { ...existingRecord.data, ...crmData }
      );

      mappingResult = {
        success: true,
        entityType,
        recordId: existingRecord.id,
        action: 'updated',
        mappedFields: crmData,
      };
    } else if (existingRecord && !mapping.updateExisting) {
      // Found but not updating
      mappingResult = {
        success: true,
        entityType,
        recordId: existingRecord.id,
        action: 'matched',
        mappedFields: crmData,
      };
    } else if (mapping.createNew) {
      // Create new record
      const newRecord = await createCRMRecord(
        submission.workspaceId,
        entityType,
        crmData,
        submission.formId,
        submission.id
      );

      mappingResult = {
        success: true,
        entityType,
        recordId: newRecord.id,
        action: 'created',
        mappedFields: crmData,
      };
    } else {
      // No matching record and not creating new
      mappingResult = {
        success: true,
        entityType,
        action: 'skipped',
        mappedFields: crmData,
      };
    }

    result.results.push(mappingResult);
  } catch (error) {
    result.success = false;
    result.errors.push(String(error));
    logger.error('CRM sync failed', error instanceof Error ? error : new Error(String(error)), {
      submissionId: submission.id,
    });
  }

  return result;
}

// ============================================================================
// MAPPING BUILDER UTILITIES
// ============================================================================

/**
 * Get suggested CRM field mappings based on form field type and name
 */
export function getSuggestedMapping(
  fieldName: string,
  fieldType: string,
  entityType: CRMEntityType
): string | null {
  const standardFields = STANDARD_CRM_FIELDS[entityType] || [];
  const normalizedName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Direct name matches
  const nameMatches: Record<string, string[]> = {
    firstname: ['firstName'],
    lastname: ['lastName'],
    email: ['email'],
    phone: ['phone'],
    mobile: ['mobile'],
    company: ['company', 'name'],
    companyname: ['company', 'name'],
    jobtitle: ['title'],
    title: ['title'],
    website: ['website'],
    address: ['street'],
    city: ['city'],
    state: ['state'],
    zip: ['zip'],
    zipcode: ['zip'],
    postalcode: ['zip'],
    country: ['country'],
    notes: ['notes'],
    comments: ['notes'],
    industry: ['industry'],
    revenue: ['revenue'],
  };

  const possibleMatches = nameMatches[normalizedName];
  if (possibleMatches) {
    for (const match of possibleMatches) {
      if (standardFields.some((f) => f.name === match)) {
        return match;
      }
    }
  }

  // Type-based suggestions
  if (fieldType === 'email') {return 'email';}
  if (fieldType === 'phone') {return 'phone';}

  return null;
}

/**
 * Validate CRM field mappings
 */
export function validateMappings(
  mapping: CRMFieldMapping
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!mapping.entityType) {
    errors.push('Entity type is required');
  }

  if (mapping.entityType === 'custom' && !mapping.entityName) {
    errors.push('Entity name is required for custom entities');
  }

  if (!mapping.fieldMappings || mapping.fieldMappings.length === 0) {
    errors.push('At least one field mapping is required');
  }

  // Check for required fields
  const standardFields = STANDARD_CRM_FIELDS[mapping.entityType] || [];
  const requiredFields = standardFields.filter((f) => f.required);
  const mappedFields = new Set(mapping.fieldMappings.map((m) => m.crmFieldName));

  for (const required of requiredFields) {
    if (!mappedFields.has(required.name)) {
      errors.push(`Required field "${required.label}" is not mapped`);
    }
  }

  // Check for duplicate mappings
  const seenCRMFields = new Set<string>();
  for (const rule of mapping.fieldMappings) {
    if (seenCRMFields.has(rule.crmFieldName)) {
      errors.push(`Duplicate mapping for field "${rule.crmFieldName}"`);
    }
    seenCRMFields.add(rule.crmFieldName);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate default mappings based on form fields
 */
export function generateDefaultMappings(
  fields: { id: string; name: string; type: string }[],
  entityType: CRMEntityType
): FieldMappingRule[] {
  const mappings: FieldMappingRule[] = [];

  for (const field of fields) {
    const suggestedCRMField = getSuggestedMapping(field.name, field.type, entityType);

    if (suggestedCRMField) {
      mappings.push({
        formFieldId: field.id,
        crmFieldName: suggestedCRMField,
        transformation: 'none',
      });
    }
  }

  return mappings;
}
