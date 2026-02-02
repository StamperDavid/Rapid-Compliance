/**
 * Unified Authentication Hook
 * Single source of truth for authentication in single-tenant mode
 *
 * 4-Level RBAC: superadmin | admin | manager | employee
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { auth, isFirebaseConfigured } from '@/lib/firebase/config';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import {
  type AccountRole,
  type UnifiedUser,
  type UnifiedPermissions,
  ACCOUNT_ROLE_HIERARCHY,
  getUnifiedPermissions,
  isSuperadminRole,
} from '@/types/unified-rbac';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

/**
 * API response from /api/admin/verify
 */
interface AdminVerifyResponse {
  email?: string;
  name?: string;
  role?: string;
  tenantId?: string;
}

/**
 * User profile stored in Firestore USERS collection
 */
interface FirestoreUserProfile {
  displayName?: string;
  name?: string;
  role?: string;
  status?: 'active' | 'suspended' | 'pending';
  mfaEnabled?: boolean;
  createdAt?: Timestamp;
  lastLoginAt?: Timestamp;
  avatarUrl?: string;
}

/**
 * Unified authentication hook return type
 */
export interface UseUnifiedAuthReturn {
  user: UnifiedUser | null;
  loading: boolean;
  permissions: UnifiedPermissions | null;
  hasPermission: (permission: keyof UnifiedPermissions) => boolean;
  isSuperadmin: () => boolean;
  isAtLeastRole: (minimumRole: AccountRole) => boolean;
  /** @deprecated Use isSuperadmin instead */
  isPlatformAdmin: () => boolean;
}

/**
 * REMOVED: createDemoUser()
 * Per Project Constitution (GROUND_TRUTH_DISCOVERY.md Part XIII):
 * - Demo user fallbacks mask authentication issues
 * - If user is not authenticated, return null (not a fake user)
 * - Platform admins must be verified via /api/admin/verify
 * - Tenant users must have valid profile in Firestore
 */

/**
 * Verify if user is a superadmin via the admin API
 */
async function verifySuperadmin(
  firebaseUserId: string,
  firebaseUserEmail: string | null,
  idToken: string
): Promise<UnifiedUser | null> {
  try {
    const response = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const adminData = (await response.json()) as AdminVerifyResponse;

    // Superadmin verified
    const displayName = adminData.name ?? 'Superadmin';
    const email = adminData.email ?? firebaseUserEmail ?? '';

    logger.info('✅ Superadmin authenticated', {
      email,
      tenantId: DEFAULT_ORG_ID,
      file: 'useUnifiedAuth.ts',
    });

    return {
      id: firebaseUserId,
      email,
      displayName,
      role: 'superadmin',
      tenantId: DEFAULT_ORG_ID,
      status: 'active',
      mfaEnabled: false,
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
    };
  } catch (error) {
    logger.error(
      'Error verifying superadmin:',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'useUnifiedAuth.ts' }
    );
    return null;
  }
}

/**
 * Load user profile from Firestore
 * Single-tenant mode: always uses DEFAULT_ORG_ID
 */
async function loadUserProfile(
  firebaseUserId: string,
  firebaseUserEmail: string | null,
  firebaseUserDisplayName: string | null
): Promise<UnifiedUser | null> {
  try {
    const rawProfile = await FirestoreService.get<FirestoreUserProfile>(
      COLLECTIONS.USERS,
      firebaseUserId
    );

    if (!rawProfile) {
      logger.warn('No user profile found in Firestore', {
        userId: firebaseUserId,
        file: 'useUnifiedAuth.ts',
      });
      return null;
    }

    // Parse role with validation (4-level RBAC)
    const roleValue = rawProfile.role;
    let role: AccountRole;

    if (
      roleValue === 'superadmin' ||
      roleValue === 'admin' ||
      roleValue === 'manager' ||
      roleValue === 'employee'
    ) {
      role = roleValue as AccountRole;
    } else if (roleValue === 'owner' || roleValue === 'platform_admin') {
      // Legacy role migration
      role = 'superadmin';
    } else {
      // Default to employee if role is invalid/missing
      logger.warn('Invalid role in user profile, defaulting to employee', {
        userId: firebaseUserId,
        providedRole: roleValue,
        file: 'useUnifiedAuth.ts',
      });
      role = 'employee';
    }

    const displayName =
      rawProfile.displayName ??
      rawProfile.name ??
      firebaseUserDisplayName ??
      'User';

    const email = firebaseUserEmail ?? '';

    logger.info('✅ User authenticated', {
      userId: firebaseUserId,
      email,
      role,
      tenantId: DEFAULT_ORG_ID,
      file: 'useUnifiedAuth.ts',
    });

    return {
      id: firebaseUserId,
      email,
      displayName,
      role,
      tenantId: DEFAULT_ORG_ID,
      avatarUrl: rawProfile.avatarUrl,
      status: rawProfile.status ?? 'active',
      mfaEnabled: rawProfile.mfaEnabled ?? false,
      createdAt: rawProfile.createdAt,
      lastLoginAt: rawProfile.lastLoginAt,
    };
  } catch (error) {
    logger.error(
      'Error loading user profile:',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'useUnifiedAuth.ts' }
    );
    return null;
  }
}

/**
 * Unified Authentication Hook
 *
 * Single-tenant authentication flow:
 * 1. Checks Firebase auth state
 * 2. If authenticated:
 *    a. Attempts to verify as superadmin via /api/admin/verify
 *    b. If not superadmin, loads from Firestore USERS collection
 *    c. Returns UnifiedUser with role (always DEFAULT_ORG_ID)
 *
 * @returns UseUnifiedAuthReturn with user, permissions, and helper functions
 */
export function useUnifiedAuth(): UseUnifiedAuthReturn {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<UnifiedPermissions | null>(null);

  useEffect(() => {
    // Check if Firebase is configured
    if (!isFirebaseConfigured || !auth) {
      setUser(null);
      setPermissions(null);
      setLoading(false);
      logger.warn('Firebase not configured - user unauthenticated', {
        file: 'useUnifiedAuth.ts',
      });
      return;
    }

    // Firebase is configured - use real auth
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      void (async () => {
        if (!firebaseUser) {
          setUser(null);
          setPermissions(null);
          setLoading(false);
          logger.info('No Firebase user - unauthenticated', {
            file: 'useUnifiedAuth.ts',
          });
          return;
        }

        try {
          // Get Firebase ID token for API calls
          const idToken = await firebaseUser.getIdToken();

          // Check superadmin status first
          const superadminUser = await verifySuperadmin(
            firebaseUser.uid,
            firebaseUser.email,
            idToken
          );

          if (superadminUser) {
            // User is superadmin - grant full permissions
            setUser(superadminUser);
            setPermissions(getUnifiedPermissions('superadmin'));
            setLoading(false);
            logger.info('Superadmin authenticated - full permissions granted', {
              userId: firebaseUser.uid,
              file: 'useUnifiedAuth.ts',
            });
            return;
          }

          // Not a superadmin - load user profile
          const userProfile = await loadUserProfile(
            firebaseUser.uid,
            firebaseUser.email,
            firebaseUser.displayName
          );

          if (userProfile) {
            // User is valid
            setUser(userProfile);
            setPermissions(getUnifiedPermissions(userProfile.role));
            setLoading(false);
            return;
          }

          // No valid profile found - user is authenticated but not provisioned
          logger.error(
            'Firebase user has no profile - not provisioned',
            new Error('User not provisioned'),
            {
              userId: firebaseUser.uid,
              email: firebaseUser.email,
              file: 'useUnifiedAuth.ts',
            }
          );

          setUser(null);
          setPermissions(null);
          setLoading(false);
        } catch (error) {
          logger.error(
            'Error in unified auth state change:',
            error instanceof Error ? error : new Error(String(error)),
            { file: 'useUnifiedAuth.ts' }
          );

          setUser(null);
          setPermissions(null);
          setLoading(false);
        }
      })();
    });

    return () => unsubscribe();
  }, []);

  // Helper: Check if user has a specific permission
  const hasPermission = useCallback(
    (permission: keyof UnifiedPermissions): boolean => {
      if (!permissions) {
        return false;
      }
      return permissions[permission];
    },
    [permissions]
  );

  // Helper: Check if user is superadmin
  const isSuperadmin = useCallback((): boolean => {
    return isSuperadminRole(user?.role);
  }, [user?.role]);

  // @deprecated Use isSuperadmin instead
  const isPlatformAdmin = isSuperadmin;

  // Helper: Check if user is at least a certain role level
  const isAtLeastRole = useCallback(
    (minimumRole: AccountRole): boolean => {
      if (!user) {
        return false;
      }
      return ACCOUNT_ROLE_HIERARCHY[user.role] >= ACCOUNT_ROLE_HIERARCHY[minimumRole];
    },
    [user]
  );

  return {
    user,
    loading,
    permissions,
    hasPermission,
    isSuperadmin,
    isPlatformAdmin,
    isAtLeastRole,
  };
}

/**
 * Hook to check a specific permission
 */
export function useUnifiedPermission(permission: keyof UnifiedPermissions): boolean {
  const { hasPermission } = useUnifiedAuth();
  return hasPermission(permission);
}

/**
 * Hook to get the current user's role
 */
export function useUnifiedRole(): AccountRole | null {
  const { user } = useUnifiedAuth();
  return user?.role ?? null;
}

/**
 * Hook to get the organization ID
 * Single-tenant mode: always returns DEFAULT_ORG_ID if authenticated
 */
export function useUnifiedTenantId(): string | null {
  const { user } = useUnifiedAuth();
  return user ? DEFAULT_ORG_ID : null;
}
