/**
 * Platform-level organization configuration and utilities
 * @module lib/constants/platform
 */

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
