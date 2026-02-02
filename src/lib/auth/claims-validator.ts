/**
 * Firebase Custom Claims Validator
 *
 * Single-tenant authorization using Firebase ID Token claims.
 * Claims structure:
 * - tenant_id: Always DEFAULT_ORG_ID in single-tenant mode
 * - role: User's role (superadmin | admin | manager | employee)
 *
 * @module claims-validator
 */

import type { DecodedIdToken } from 'firebase-admin/auth';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import { type AccountRole, type LegacyAccountRole, migrateLegacyRole } from '@/types/unified-rbac';

// ============================================================================
// TYPES
// ============================================================================

export interface TenantClaims {
  /** Organization ID - always DEFAULT_ORG_ID in single-tenant mode */
  tenant_id: string;
  /** Legacy admin flag - deprecated, use role-based checks instead */
  admin: boolean;
  /** User's role using 4-level RBAC: superadmin | admin | manager | employee */
  role: AccountRole | null;
  /** User's email */
  email: string | null;
  /** User ID */
  uid: string;
}

export interface ClaimsValidationResult {
  valid: boolean;
  claims: TenantClaims;
  error?: string;
}

export interface TenantAccessResult {
  allowed: boolean;
  reason: string;
  isGlobalAdmin: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Roles that grant admin-level access */
const ADMIN_ROLES = ['superadmin', 'admin'] as const;

/** Superadmin role - full system access */
export const SUPERADMIN_ROLES = ['superadmin'] as const;

/** @deprecated Use SUPERADMIN_ROLES instead */
export const PLATFORM_ADMIN_ROLES = SUPERADMIN_ROLES;

// ============================================================================
// CLAIMS EXTRACTION
// ============================================================================

/**
 * Extract and validate tenant claims from a decoded Firebase ID token.
 *
 * Claims are expected in the token as:
 * - tenant_id: string (organization ID)
 * - admin: boolean (legacy admin flag)
 * - role: string (user role)
 *
 * @param decodedToken - The decoded Firebase ID token
 * @returns ClaimsValidationResult with extracted claims
 */
export function extractTenantClaims(decodedToken: DecodedIdToken): ClaimsValidationResult {
  try {
    const uid = decodedToken.uid;
    const email = decodedToken.email ?? null;

    // Extract custom claims from the token
    const isAdmin = decodedToken.admin === true;
    const role = (decodedToken.role as string | undefined) ?? null;

    const validatedRole = validateRole(role);

    // Single-tenant mode: always use DEFAULT_ORG_ID
    const claims: TenantClaims = {
      tenant_id: DEFAULT_ORG_ID,
      admin: isAdmin, // Legacy field - kept for backwards compatibility
      role: validatedRole,
      email,
      uid,
    };

    logger.debug('Extracted tenant claims', {
      uid,
      email,
      tenant_id: claims.tenant_id,
      role: claims.role,
      file: 'claims-validator.ts',
    });

    return {
      valid: true,
      claims,
    };
  } catch (error: unknown) {
    logger.error('Failed to extract tenant claims', error instanceof Error ? error : new Error(String(error)), { file: 'claims-validator.ts' });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      claims: {
        tenant_id: DEFAULT_ORG_ID,
        admin: false,
        role: null,
        email: null,
        uid: decodedToken.uid,
      },
      error: errorMessage,
    };
  }
}

/**
 * Validate and normalize role string to 4-level RBAC.
 * Migrates legacy roles (platform_admin, owner) to superadmin.
 */
function validateRole(role: string | null): AccountRole | null {
  if (!role) {return null;}

  const normalizedRole = role.toLowerCase();

  // Direct 4-level RBAC roles
  switch (normalizedRole) {
    case 'superadmin':
    case 'super_admin':
      return 'superadmin';
    case 'admin':
      return 'admin';
    case 'manager':
      return 'manager';
    case 'employee':
      return 'employee';
  }

  // Migrate legacy roles
  const legacyRoleMap: Record<string, LegacyAccountRole> = {
    platform_admin: 'platform_admin',
    platformadmin: 'platform_admin',
    owner: 'owner',
    member: 'employee', // member → employee
    viewer: 'employee', // viewer → employee
  };

  const legacyRole = legacyRoleMap[normalizedRole];
  if (legacyRole) {
    return migrateLegacyRole(legacyRole);
  }

  return null;
}

// ============================================================================
// ACCESS CONTROL
// ============================================================================

/**
 * Check if user has access to the organization.
 *
 * Single-tenant mode: All authenticated users have access to DEFAULT_ORG_ID.
 * Access control is now purely role-based within the single organization.
 *
 * @param claims - User's tenant claims
 * @param _requestedOrgId - Ignored in single-tenant mode (always DEFAULT_ORG_ID)
 * @returns TenantAccessResult with access determination
 */
export function checkTenantAccess(
  claims: TenantClaims,
  _requestedOrgId: string | null
): TenantAccessResult {
  const isSuperadmin = claims.role === 'superadmin';

  // All authenticated users have access in single-tenant mode
  if (claims.uid) {
    return {
      allowed: true,
      reason: 'Single-tenant mode: authenticated user has organization access',
      isGlobalAdmin: isSuperadmin,
    };
  }

  logger.warn('Unauthenticated access attempt', {
    uid: claims.uid,
    email: claims.email,
    file: 'claims-validator.ts',
  });

  return {
    allowed: false,
    reason: 'User is not authenticated',
    isGlobalAdmin: false,
  };
}

/**
 * Check if user has admin-level role (superadmin or admin).
 *
 * @param claims - User's tenant claims
 * @returns true if user has admin role
 */
export function hasAdminRole(claims: TenantClaims): boolean {
  if (!claims.role) {return false;}
  return (ADMIN_ROLES as readonly string[]).includes(claims.role);
}

/**
 * Check if user has superadmin role (full system access).
 *
 * @param claims - User's tenant claims
 * @returns true if user is superadmin
 */
export function isSuperadminClaims(claims: TenantClaims): boolean {
  return claims.role === 'superadmin';
}

/**
 * @deprecated Use isSuperadminClaims() instead
 */
export function isSuperAdmin(claims: TenantClaims): boolean {
  return isSuperadminClaims(claims);
}

/**
 * @deprecated Use isSuperadminClaims() instead
 */
export function isPlatformAdminClaims(claims: TenantClaims): boolean {
  return isSuperadminClaims(claims);
}

/**
 * Get the effective organization ID.
 * Single-tenant mode: Always returns DEFAULT_ORG_ID.
 *
 * @param _claims - User's tenant claims (unused in single-tenant mode)
 * @returns DEFAULT_ORG_ID
 */
export function getEffectiveOrgId(_claims: TenantClaims): string {
  return DEFAULT_ORG_ID;
}

// ============================================================================
// FIREBASE CUSTOM CLAIMS HELPER
// ============================================================================

/**
 * Interface for setting custom claims on a user.
 * Use this with Firebase Admin Auth: adminAuth.setCustomUserClaims(uid, claims)
 */
export interface FirebaseCustomClaims {
  tenant_id?: string;
  admin?: boolean;
  role?: string;
  organizationId?: string; // Alias for tenant_id for backwards compatibility
}

/**
 * Build custom claims object for a user.
 * Single-tenant mode: Always uses DEFAULT_ORG_ID.
 *
 * @param role - User's role (superadmin | admin | manager | employee)
 * @param isAdmin - Whether user is a superadmin (sets legacy admin flag)
 * @returns Claims object to set on the user
 */
export function buildCustomClaims(
  role: AccountRole,
  isAdmin: boolean = false
): FirebaseCustomClaims {
  return {
    tenant_id: DEFAULT_ORG_ID,
    organizationId: DEFAULT_ORG_ID, // Backwards compatibility
    role,
    admin: isAdmin || role === 'superadmin',
  };
}

const claimsValidator = {
  extractTenantClaims,
  checkTenantAccess,
  hasAdminRole,
  isSuperAdmin,
  isSuperadminClaims,
  isPlatformAdminClaims,
  getEffectiveOrgId,
  buildCustomClaims,
  SUPERADMIN_ROLES,
  PLATFORM_ADMIN_ROLES,
};

export default claimsValidator;
