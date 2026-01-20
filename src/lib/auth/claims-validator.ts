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
  /** Legacy admin flag - deprecated, use role-based checks instead */
  admin: boolean;
  /** User's role within the organization */
  role: 'platform_admin' | 'super_admin' | 'admin' | 'owner' | 'member' | 'viewer' | null;
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

/** Roles that grant admin-level access within an organization */
const ADMIN_ROLES = ['platform_admin', 'super_admin', 'admin'] as const;

/** Platform-level admin roles - these have full RBAC permissions but NO org bypass */
export const PLATFORM_ADMIN_ROLES = ['platform_admin', 'super_admin'] as const;

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
    // Firebase custom claims are stored directly on the decoded token
    const tenantId = decodedToken.tenant_id as string | undefined;
    const isAdmin = decodedToken.admin === true;
    const role = (decodedToken.role as string | undefined) ?? null;

    const validatedRole = validateRole(role);

    const claims: TenantClaims = {
      tenant_id: tenantId ?? null,
      admin: isAdmin, // Legacy field - kept for backwards compatibility
      role: validatedRole,
      email,
      uid,
    };

    logger.debug('Extracted tenant claims', {
      uid,
      email,
      hasTenantId: !!claims.tenant_id,
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
        tenant_id: null,
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
 * Validate and normalize role string to expected values.
 */
function validateRole(role: string | null): TenantClaims['role'] {
  if (!role) {return null;}

  const normalizedRole = role.toLowerCase();
  switch (normalizedRole) {
    case 'platform_admin':
    case 'platformadmin':
      return 'platform_admin';
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
 * Unified access control - ALL users must belong to an organization.
 * Access is granted if:
 * 1. User's tenant_id matches the requested organization
 * 2. No specific org requested - uses user's own org
 *
 * @param claims - User's tenant claims
 * @param requestedOrgId - The organization ID being accessed
 * @returns TenantAccessResult with access determination
 */
export function checkTenantAccess(
  claims: TenantClaims,
  requestedOrgId: string | null
): TenantAccessResult {
  // No tenant_id in claims means user has no organization access
  if (!claims.tenant_id) {
    logger.debug('User has no tenant_id', {
      uid: claims.uid,
      email: claims.email,
      role: claims.role,
      file: 'claims-validator.ts',
    });

    return {
      allowed: false,
      reason: 'User has no tenant_id claim - must belong to an organization',
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

  // Tenant mismatch - deny access (applies to ALL roles including platform_admin)
  logger.warn('Tenant access denied - ID mismatch', {
    uid: claims.uid,
    userTenant: claims.tenant_id,
    requestedOrg: requestedOrgId,
    role: claims.role,
    file: 'claims-validator.ts',
  });

  return {
    allowed: false,
    reason: `Tenant mismatch: user belongs to ${claims.tenant_id}, requested ${requestedOrgId}`,
    isGlobalAdmin: false,
  };
}

/**
 * Check if user has admin-level role within their organization.
 * Admin roles have elevated permissions but still respect org boundaries.
 *
 * @param claims - User's tenant claims
 * @returns true if user has admin role
 */
export function hasAdminRole(claims: TenantClaims): boolean {
  if (!claims.role) {return false;}
  return (ADMIN_ROLES as readonly string[]).includes(claims.role);
}

/**
 * Check if user has platform-level admin role.
 * These roles have full RBAC permissions within their organization.
 * Note: This does NOT grant cross-org access.
 *
 * @param claims - User's tenant claims
 * @returns true if user has platform admin role
 */
export function isSuperAdmin(claims: TenantClaims): boolean {
  return claims.role === 'super_admin' || claims.role === 'platform_admin';
}

/**
 * Check if user has platform admin role.
 * Platform admin has full RBAC permissions within their organization.
 * IMPORTANT: This does NOT bypass organization isolation.
 *
 * @param claims - User's tenant claims
 * @returns true if user is platform admin
 */
export function isPlatformAdminClaims(claims: TenantClaims): boolean {
  return claims.role === 'platform_admin' || claims.role === 'super_admin';
}

/**
 * Get the effective organization ID for a request.
 * All users must operate within their assigned organization.
 *
 * @param claims - User's tenant claims
 * @returns Organization ID (null if user has no organization)
 */
export function getEffectiveOrgId(claims: TenantClaims): string | null {
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

const claimsValidator = {
  extractTenantClaims,
  checkTenantAccess,
  hasAdminRole,
  isSuperAdmin,
  isPlatformAdminClaims,
  getEffectiveOrgId,
  buildCustomClaims,
  PLATFORM_ADMIN_ROLES,
};

export default claimsValidator;
