/**
 * Firebase Custom Claims Validator
 *
 * Provides claims-based authorization for strict multi-tenant isolation.
 * Uses Firebase ID Token claims as the source of truth for:
 * - tenant_id: Organization ID the user belongs to
 * - admin: Super admin flag for global read access
 * - role: User's role within the organization
 *
 * @module claims-validator
 */

import type { DecodedIdToken } from 'firebase-admin/auth';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface TenantClaims {
  /** Organization ID (tenant) the user belongs to */
  tenant_id: string | null;
  /** Super admin flag - grants global read access */
  admin: boolean;
  /** User's role within the organization */
  role: 'super_admin' | 'admin' | 'owner' | 'member' | 'viewer' | null;
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

/** Super admin email whitelist - these users get global read access */
const SUPER_ADMIN_EMAILS: string[] = [
  'dstamper@rapidcompliance.us',
];

/** Roles that grant admin-level access */
const ADMIN_ROLES = ['super_admin', 'admin'] as const;

// ============================================================================
// CLAIMS EXTRACTION
// ============================================================================

/**
 * Extract and validate tenant claims from a decoded Firebase ID token.
 *
 * Claims are expected in the token as:
 * - tenant_id: string (organization ID)
 * - admin: boolean (super admin flag)
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
    // Firebase custom claims are stored directly on the decoded token
    const tenantId = decodedToken.tenant_id as string | undefined;
    const isAdmin = decodedToken.admin === true;
    const role = (decodedToken.role as string | undefined) ?? null;

    // Check if user is in super admin whitelist
    const isWhitelistedAdmin = email ? SUPER_ADMIN_EMAILS.includes(email.toLowerCase()) : false;

    const claims: TenantClaims = {
      tenant_id: tenantId ?? null,
      admin: isAdmin || isWhitelistedAdmin,
      role: validateRole(role),
      email,
      uid,
    };

    logger.debug('Extracted tenant claims', {
      uid,
      email,
      hasTenantId: !!claims.tenant_id,
      isAdmin: claims.admin,
      role: claims.role,
      file: 'claims-validator.ts',
    });

    return {
      valid: true,
      claims,
    };
  } catch (error: any) {
    logger.error('Failed to extract tenant claims', error, { file: 'claims-validator.ts' });
    return {
      valid: false,
      claims: {
        tenant_id: null,
        admin: false,
        role: null,
        email: null,
        uid: decodedToken.uid,
      },
      error: error.message,
    };
  }
}

/**
 * Validate and normalize role string to expected values.
 */
function validateRole(role: string | null): TenantClaims['role'] {
  if (!role) {return null;}

  const normalizedRole = role.toLowerCase();
  switch (normalizedRole) {
    case 'super_admin':
    case 'superadmin':
      return 'super_admin';
    case 'admin':
      return 'admin';
    case 'owner':
      return 'owner';
    case 'member':
      return 'member';
    case 'viewer':
      return 'viewer';
    default:
      return null;
  }
}

// ============================================================================
// ACCESS CONTROL
// ============================================================================

/**
 * Check if user has access to a specific tenant/organization.
 *
 * Access is granted if:
 * 1. User is a super admin (global read access)
 * 2. User's tenant_id matches the requested organization
 *
 * @param claims - User's tenant claims
 * @param requestedOrgId - The organization ID being accessed
 * @returns TenantAccessResult with access determination
 */
export function checkTenantAccess(
  claims: TenantClaims,
  requestedOrgId: string | null
): TenantAccessResult {
  // Super admins have global read access
  if (claims.admin) {
    logger.debug('Global admin access granted', {
      uid: claims.uid,
      email: claims.email,
      requestedOrgId,
      file: 'claims-validator.ts',
    });

    return {
      allowed: true,
      reason: 'Super admin has global access',
      isGlobalAdmin: true,
    };
  }

  // No tenant_id in claims means user has no organization access
  if (!claims.tenant_id) {
    return {
      allowed: false,
      reason: 'User has no tenant_id claim',
      isGlobalAdmin: false,
    };
  }

  // No specific org requested - allow access to user's own org
  if (!requestedOrgId) {
    return {
      allowed: true,
      reason: 'No specific organization requested, using user tenant',
      isGlobalAdmin: false,
    };
  }

  // Check if user's tenant matches the requested org
  if (claims.tenant_id === requestedOrgId) {
    return {
      allowed: true,
      reason: 'User tenant matches requested organization',
      isGlobalAdmin: false,
    };
  }

  // Tenant mismatch - deny access
  logger.warn('Tenant access denied - ID mismatch', {
    uid: claims.uid,
    userTenant: claims.tenant_id,
    requestedOrg: requestedOrgId,
    file: 'claims-validator.ts',
  });

  return {
    allowed: false,
    reason: `Tenant mismatch: user belongs to ${claims.tenant_id}, requested ${requestedOrgId}`,
    isGlobalAdmin: false,
  };
}

/**
 * Check if user has admin-level role (super_admin or admin).
 *
 * @param claims - User's tenant claims
 * @returns true if user has admin role
 */
export function hasAdminRole(claims: TenantClaims): boolean {
  if (claims.admin) {return true;}
  if (!claims.role) {return false;}
  return (ADMIN_ROLES as readonly string[]).includes(claims.role);
}

/**
 * Check if user is a super admin (global platform administrator).
 *
 * Super admin is determined by:
 * 1. admin: true claim in the token
 * 2. Email in the SUPER_ADMIN_EMAILS whitelist
 * 3. role: 'super_admin' claim
 *
 * @param claims - User's tenant claims
 * @returns true if user is super admin
 */
export function isSuperAdmin(claims: TenantClaims): boolean {
  return claims.admin || claims.role === 'super_admin';
}

/**
 * Get the effective organization ID for a request.
 *
 * For super admins, returns null (can access all orgs).
 * For regular users, returns their tenant_id.
 *
 * @param claims - User's tenant claims
 * @returns Organization ID or null for global access
 */
export function getEffectiveOrgId(claims: TenantClaims): string | null {
  if (claims.admin) {
    return null; // Global access
  }
  return claims.tenant_id;
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
 *
 * @param orgId - Organization ID
 * @param role - User's role
 * @param isAdmin - Whether user is a super admin
 * @returns Claims object to set on the user
 */
export function buildCustomClaims(
  orgId: string,
  role: string,
  isAdmin: boolean = false
): FirebaseCustomClaims {
  return {
    tenant_id: orgId,
    organizationId: orgId, // Backwards compatibility
    role,
    admin: isAdmin,
  };
}

export default {
  extractTenantClaims,
  checkTenantAccess,
  hasAdminRole,
  isSuperAdmin,
  getEffectiveOrgId,
  buildCustomClaims,
  SUPER_ADMIN_EMAILS,
};
