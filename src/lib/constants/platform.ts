/**
 * Platform-level organization configuration and utilities
 * @module lib/constants/platform
 */

/**
 * Single-tenant default organization ID
 * PENTHOUSE MODEL: Hardcoded to 'rapid-compliance' for single-tenant deployment
 * This is the ONLY organization in the system - we are NOT a multi-tenant platform
 */
export const DEFAULT_ORG_ID = 'rapid-compliance' as const;

/**
 * Single-tenant organization configuration
 * Rapid Compliance is a single company, NOT a multi-tenant platform
 */
export const COMPANY_CONFIG = {
  id: DEFAULT_ORG_ID,
  name: 'Rapid Compliance',
} as const;

/**
 * Checks if a given organization ID matches the default single-tenant organization
 *
 * @param orgId - The organization ID to check
 * @returns True if the orgId matches the default org ID, false otherwise
 */
export function isDefaultOrg(orgId: string): boolean {
  return orgId === DEFAULT_ORG_ID;
}

/**
 * Returns the default organization ID for single-tenant mode
 * This function centralizes the org ID retrieval for easier migration
 */
export function getDefaultOrgId(): string {
  return DEFAULT_ORG_ID;
}
