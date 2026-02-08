/**
 * Firebase Custom Claims Validator
 *
 * Penthouse authorization using Firebase ID Token claims.
 * Claims structure:
 * - role: User's role (owner | admin | manager | member)
 *
 * @module claims-validator
 */

import type { DecodedIdToken } from 'firebase-admin/auth';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { type AccountRole } from '@/types/unified-rbac';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthClaims {
  /** Legacy admin flag - kept for backwards compatibility with Firebase */
  admin: boolean;
  /** User's role: owner | admin | manager | member */
  role: AccountRole | null;
  /** User's email */
  email: string | null;
  /** User ID */
  uid: string;
}

export interface ClaimsValidationResult {
  valid: boolean;
  claims: AuthClaims;
  error?: string;
}

export interface AccessResult {
  allowed: boolean;
  reason: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Roles that grant admin-level access */
const ADMIN_ROLES: readonly AccountRole[] = ['owner', 'admin'] as const;

// ============================================================================
// CLAIMS EXTRACTION
// ============================================================================

/**
 * Extract and validate claims from a decoded Firebase ID token.
 *
 * @param decodedToken - The decoded Firebase ID token
 * @returns ClaimsValidationResult with extracted claims
 */
export function extractAuthClaims(decodedToken: DecodedIdToken): ClaimsValidationResult {
  try {
    const uid = decodedToken.uid;
    const email = decodedToken.email ?? null;

    const isAdminFlag = decodedToken.admin === true;
    const role = (decodedToken.role as string | undefined) ?? null;

    const validatedRole = validateRole(role);

    const claims: AuthClaims = {
      admin: isAdminFlag,
      role: validatedRole,
      email,
      uid,
    };

    logger.debug('Extracted auth claims', {
      uid,
      email,
      role: claims.role,
      file: 'claims-validator.ts',
    });

    return {
      valid: true,
      claims,
    };
  } catch (error: unknown) {
    logger.error('Failed to extract auth claims', error instanceof Error ? error : new Error(String(error)), { file: 'claims-validator.ts' });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      claims: {
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
 * Validate and normalize role string to 4-role RBAC.
 * Maps legacy role strings to the canonical AccountRole values.
 */
function validateRole(role: string | null): AccountRole | null {
  if (!role) {
    return null;
  }

  switch (role.toLowerCase()) {
    case 'owner':
      return 'owner';
    case 'superadmin':
    case 'super_admin':
    case 'admin':
    case 'platform_admin':
      return 'admin';
    case 'manager':
    case 'team_lead':
      return 'manager';
    case 'employee':
    case 'member':
    case 'viewer':
    case 'user':
      return 'member';
    default:
      return null;
  }
}

// ============================================================================
// ACCESS CONTROL
// ============================================================================

/**
 * Check if user has access.
 * Requires both authentication (uid) and a valid role assignment.
 *
 * @param claims - User's auth claims
 * @returns AccessResult with access determination
 */
export function checkAccess(claims: AuthClaims): AccessResult {
  if (!claims.uid) {
    return {
      allowed: false,
      reason: 'No authenticated user',
    };
  }

  if (!claims.role) {
    logger.warn('Authenticated user has no role assigned', {
      uid: claims.uid,
      email: claims.email,
      file: 'claims-validator.ts',
    });
    return {
      allowed: false,
      reason: 'No role assigned',
    };
  }

  return {
    allowed: true,
    reason: `Authenticated as ${claims.role}`,
  };
}

/**
 * Check if user has admin-level role (owner or admin).
 *
 * @param claims - User's auth claims
 * @returns true if user has admin-level role
 */
export function hasAdminRole(claims: AuthClaims): boolean {
  if (!claims.role) {
    return false;
  }
  return ADMIN_ROLES.includes(claims.role);
}

/**
 * Check if user is admin (full system access).
 *
 * @param claims - User's auth claims
 * @returns true if user is owner or admin
 */
export function isAdminClaims(claims: AuthClaims): boolean {
  return claims.role === 'owner' || claims.role === 'admin';
}

/**
 * Get the effective organization ID.
 * Penthouse model: Always returns PLATFORM_ID.
 */
export function getEffectiveOrgId(): string {
  return PLATFORM_ID;
}

// ============================================================================
// FIREBASE CUSTOM CLAIMS HELPER
// ============================================================================

/**
 * Interface for setting custom claims on a user.
 * Use this with Firebase Admin Auth: adminAuth.setCustomUserClaims(uid, claims)
 */
export interface FirebaseCustomClaims {
  admin?: boolean;
  role?: string;
}

/**
 * Build custom claims object for a user.
 *
 * @param role - User's role (owner | admin | manager | member)
 * @returns Claims object to set on the user
 */
export function buildCustomClaims(role: AccountRole): FirebaseCustomClaims {
  return {
    role,
    admin: role === 'owner' || role === 'admin',
  };
}

const claimsValidator = {
  extractAuthClaims,
  checkAccess,
  hasAdminRole,
  isAdminClaims,
  getEffectiveOrgId,
  buildCustomClaims,
};

export default claimsValidator;
