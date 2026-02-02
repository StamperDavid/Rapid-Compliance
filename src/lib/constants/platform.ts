/**
 * Platform-level organization configuration and utilities
 * @module lib/constants/platform
 */

/**
 * Single-tenant default organization ID
 * PENTHOUSE MODEL: Hardcoded to 'salesvelocity' for single-tenant deployment
 * Used throughout the application to identify the single organization
 */
export const DEFAULT_ORG_ID = 'salesvelocity' as const;

/**
 * Configuration shape for platform organization objects
 */
export type PlatformOrgConfig = {
  /** Unique identifier for the organization */
  id: string;
  /** Display name of the organization */
  name: string;
  /** Flag indicating if this is a platform-level organization */
  isPlatformOrg: boolean;
  /** Flag indicating if this organization has internal admin privileges */
  isInternalAdmin: boolean;
};

/**
 * Master platform admin organization configuration
 * This organization has elevated privileges for platform-wide operations
 */
export const PLATFORM_MASTER_ORG: PlatformOrgConfig = {
  id: 'platform-admin',
  name: 'Platform Admin',
  isPlatformOrg: true,
  isInternalAdmin: true,
} as const;

/**
 * Checks if a given organization ID matches the platform admin organization
 *
 * @param orgId - The organization ID to check
 * @returns True if the orgId matches the platform admin ID, false otherwise
 *
 * @example
 * ```typescript
 * if (isPlatformOrg(currentOrgId)) {
 *   // Grant platform-level access
 * }
 * ```
 */
export function isPlatformOrg(orgId: string): boolean {
  return orgId === PLATFORM_MASTER_ORG.id;
}

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
