/**
 * Company Entity - Canonical TypeScript Interface
 *
 * Represents a business entity in the CRM.
 * Contacts, Deals, and Quotes link back to companies.
 *
 * @module types/company
 */

import type { FirestoreDate, CustomFields } from './crm-entities';

// ============================================================================
// COMPANY TYPES
// ============================================================================

/**
 * Company size classification
 */
export type CompanySize =
  | 'startup'
  | 'small'
  | 'medium'
  | 'enterprise'
  | 'unknown';

/**
 * Company status in the CRM
 */
export type CompanyStatus =
  | 'prospect'
  | 'active'
  | 'inactive'
  | 'churned';

export const COMPANY_STATUSES: readonly CompanyStatus[] = [
  'prospect',
  'active',
  'inactive',
  'churned',
] as const;

export const COMPANY_SIZES: readonly CompanySize[] = [
  'startup',
  'small',
  'medium',
  'enterprise',
  'unknown',
] as const;

/**
 * Company address structure
 */
export interface CompanyAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

/**
 * Company entity
 * Represents a business organization in the CRM
 */
export interface Company {
  // Core identifiers
  id: string;

  // Company details
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  industry?: string;
  description?: string;

  // Size & scale
  size?: CompanySize;
  employeeCount?: number;
  annualRevenue?: number;
  currency?: string;

  // Location
  address?: CompanyAddress;

  // Classification
  status: CompanyStatus;
  tags?: string[];

  // Social presence
  linkedInUrl?: string;
  twitterHandle?: string;
  facebookUrl?: string;

  // Ownership
  ownerId?: string;

  // Additional data
  notes?: string;
  customFields?: CustomFields;

  // Timestamps
  createdAt: FirestoreDate;
  updatedAt?: FirestoreDate;
}

/**
 * Company filters for queries
 */
export interface CompanyFilters {
  status?: CompanyStatus | 'all';
  industry?: string;
  size?: CompanySize;
  ownerId?: string;
  tags?: string[];
}

/**
 * Omit system fields for creation
 */
export type CreateCompanyInput = Omit<Company, 'id' | 'createdAt'>;

/**
 * Partial updates without system fields
 */
export type UpdateCompanyInput = Partial<Omit<Company, 'id' | 'createdAt'>>;

/**
 * Type guard to check if object is a Company
 */
export function isCompany(entity: unknown): entity is Company {
  if (!entity || typeof entity !== 'object') { return false; }
  const comp = entity as Record<string, unknown>;
  return (
    typeof comp.id === 'string' &&
    typeof comp.name === 'string' &&
    typeof comp.status === 'string' &&
    COMPANY_STATUSES.includes(comp.status as CompanyStatus)
  );
}
