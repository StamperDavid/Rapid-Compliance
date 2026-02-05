/**
 * Platform-level organization configuration and utilities
 * @module lib/constants/platform
 */

/**
 * Penthouse default organization ID
 * PENTHOUSE MODEL: Hardcoded to 'rapid-compliance-root' for penthouse deployment
 * Identity: SalesVelocity.ai — the ONLY organization in the system
 * This is NOT a multi-org platform
 */
export const DEFAULT_ORG_ID = 'rapid-compliance-root' as const;

/**
 * Penthouse organization configuration
 * SalesVelocity is a single company, NOT a multi-org platform
 */
export const COMPANY_CONFIG = {
  id: DEFAULT_ORG_ID,
  name: 'SalesVelocity.ai',
} as const;

/**
 * Checks if a given organization ID matches the default penthouse organization
 *
 * @param orgId - The organization ID to check
 * @returns True if the orgId matches the default org ID, false otherwise
 */
export function isDefaultOrg(orgId: string): boolean {
  return orgId === DEFAULT_ORG_ID;
}

/**
 * Returns the default organization ID for penthouse model
 * This function centralizes the org ID retrieval for easier migration
 */
export function getDefaultOrgId(): string {
  return DEFAULT_ORG_ID;
}
