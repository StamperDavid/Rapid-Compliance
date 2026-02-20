/**
 * Unified Authentication Hook
 * Single source of truth for authentication in SalesVelocity.ai
 *
 * 4-Role RBAC: owner | admin | manager | member
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
  ROLE_HIERARCHY,
  getUnifiedPermissions,
  isAdmin,
} from '@/types/unified-rbac';
import { logger } from '@/lib/logger/logger';

/**
 * API response from /api/admin/verify
 */
interface AdminVerifyResponse {
  email?: string;
  name?: string;
  role?: string;
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
  isAdminUser: () => boolean;
  isAtLeastRole: (minimumRole: AccountRole) => boolean;
  getIdToken: () => Promise<string | null>;
}

/**
 * Map legacy/stored role strings to the 4-role AccountRole.
 */
function toAccountRole(role: string | undefined | null): AccountRole {
  if (!role) {
    return 'member';
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
    default:
      return 'member';
  }
}

/**
 * Verify if user is an admin via the admin API
 */
async function verifyAdmin(
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

    const displayName = adminData.name ?? 'Admin';
    const email = adminData.email ?? firebaseUserEmail ?? '';
    const role = toAccountRole(adminData.role ?? 'admin');

    logger.info('Admin authenticated', {
      email,
      role,
      file: 'useUnifiedAuth.ts',
    });

    return {
      id: firebaseUserId,
      email,
      displayName,
      role,
      status: 'active',
      mfaEnabled: false,
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
    };
  } catch (error) {
    logger.error(
      'Error verifying admin:',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'useUnifiedAuth.ts' }
    );
    return null;
  }
}

/**
 * Load user profile from Firestore
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

    const role = toAccountRole(rawProfile.role);

    const displayName =
      rawProfile.displayName ??
      rawProfile.name ??
      firebaseUserDisplayName ??
      'User';

    const email = firebaseUserEmail ?? '';

    logger.info('User authenticated', {
      userId: firebaseUserId,
      email,
      role,
      file: 'useUnifiedAuth.ts',
    });

    return {
      id: firebaseUserId,
      email,
      displayName,
      role,
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
 * SalesVelocity authentication flow:
 * 1. Checks Firebase auth state
 * 2. If authenticated:
 *    a. Attempts to verify as admin via /api/admin/verify
 *    b. If not admin, loads from Firestore USERS collection
 *    c. Returns UnifiedUser with 4-role RBAC
 */
export function useUnifiedAuth(): UseUnifiedAuthReturn {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<UnifiedPermissions | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setUser(null);
      setPermissions(null);
      setLoading(false);
      logger.warn('Firebase not configured - user unauthenticated', {
        file: 'useUnifiedAuth.ts',
      });
      return;
    }

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
          const idToken = await firebaseUser.getIdToken();

          // Check admin status first
          const adminUser = await verifyAdmin(
            firebaseUser.uid,
            firebaseUser.email,
            idToken
          );

          if (adminUser) {
            setUser(adminUser);
            setPermissions(getUnifiedPermissions(adminUser.role));
            setLoading(false);
            logger.info('Admin authenticated - permissions granted', {
              userId: firebaseUser.uid,
              role: adminUser.role,
              file: 'useUnifiedAuth.ts',
            });
            return;
          }

          // Not admin - load user profile
          const userProfile = await loadUserProfile(
            firebaseUser.uid,
            firebaseUser.email,
            firebaseUser.displayName
          );

          if (userProfile) {
            setUser(userProfile);
            setPermissions(getUnifiedPermissions(userProfile.role));
            setLoading(false);
            return;
          }

          // No valid profile found
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

  const hasPermission = useCallback(
    (permission: keyof UnifiedPermissions): boolean => {
      if (!permissions) {
        return false;
      }
      return permissions[permission];
    },
    [permissions]
  );

  const isAdminUser = useCallback((): boolean => {
    return isAdmin(user?.role);
  }, [user?.role]);

  const isAtLeastRole = useCallback(
    (minimumRole: AccountRole): boolean => {
      if (!user?.role) {
        return false;
      }
      return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[minimumRole];
    },
    [user]
  );

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!auth?.currentUser) {
      return null;
    }
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  }, []);

  return {
    user,
    loading,
    permissions,
    hasPermission,
    isAdminUser,
    isAtLeastRole,
    getIdToken,
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
