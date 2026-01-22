/**
 * Unified Authentication Hook
 * Single source of truth for authentication across platform admin and tenant users
 *
 * This hook replaces:
 * - useAdminAuth.ts (platform admin authentication)
 * - useAuth.ts (tenant user authentication)
 */

'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { auth, isFirebaseConfigured } from '@/lib/firebase/config';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import {
  type AccountRole,
  type UnifiedUser,
  type UnifiedPermissions,
  getUnifiedPermissions,
  isPlatformAdminRole,
} from '@/types/unified-rbac';
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
  organizationId?: string;
  tenantId?: string;
  displayName?: string;
  name?: string;
  role?: string;
  currentWorkspaceId?: string;
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
  isPlatformAdmin: () => boolean;
  isAtLeastRole: (minimumRole: AccountRole) => boolean;
}

/**
 * Create a demo user for development/demo mode
 */
function createDemoUser(): UnifiedUser {
  return {
    id: 'demo-user',
    email: 'admin@demo.com',
    displayName: 'Demo Admin',
    role: 'owner',
    tenantId: 'demo-org',
    status: 'active',
    mfaEnabled: false,
    createdAt: Timestamp.now(),
    lastLoginAt: Timestamp.now(),
  };
}

/**
 * Verify if user is a platform admin via the admin API
 */
async function verifyPlatformAdmin(
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

    // Platform admin verified
    const displayName = adminData.name ?? 'Platform Admin';
    const email = adminData.email ?? firebaseUserEmail ?? '';

    // Platform admins may have a tenantId in their profile if they want a default view
    // Otherwise it defaults to null (platform-level view)
    const tenantId = adminData.tenantId ?? null;

    logger.info('✅ Platform admin authenticated', {
      email,
      tenantId: tenantId ?? 'platform-level',
      file: 'useUnifiedAuth.ts',
    });

    return {
      id: firebaseUserId,
      email,
      displayName,
      role: 'platform_admin',
      tenantId,
      status: 'active',
      mfaEnabled: false,
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
    };
  } catch (error) {
    logger.error(
      'Error verifying platform admin:',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'useUnifiedAuth.ts' }
    );
    return null;
  }
}

/**
 * Load tenant user profile from Firestore
 */
async function loadTenantUserProfile(
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

    // Extract tenant ID (prefer tenantId, fallback to organizationId for legacy data)
    const tenantId = rawProfile.tenantId ?? rawProfile.organizationId;

    if (!tenantId) {
      logger.error(
        'User profile missing tenantId/organizationId',
        new Error('Missing tenant ID'),
        {
          userId: firebaseUserId,
          file: 'useUnifiedAuth.ts',
        }
      );
      return null;
    }

    // Parse role with validation
    const roleValue = rawProfile.role;
    let role: AccountRole;

    if (
      roleValue === 'owner' ||
      roleValue === 'admin' ||
      roleValue === 'manager' ||
      roleValue === 'employee'
    ) {
      role = roleValue as AccountRole;
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

    logger.info('✅ Tenant user authenticated', {
      userId: firebaseUserId,
      email,
      role,
      tenantId,
      file: 'useUnifiedAuth.ts',
    });

    return {
      id: firebaseUserId,
      email,
      displayName,
      role,
      tenantId,
      workspaceId: rawProfile.currentWorkspaceId,
      avatarUrl: rawProfile.avatarUrl,
      status: rawProfile.status ?? 'active',
      mfaEnabled: rawProfile.mfaEnabled ?? false,
      createdAt: rawProfile.createdAt,
      lastLoginAt: rawProfile.lastLoginAt,
    };
  } catch (error) {
    logger.error(
      'Error loading tenant user profile:',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'useUnifiedAuth.ts' }
    );
    return null;
  }
}

/**
 * Unified Authentication Hook
 *
 * Handles both platform admin and tenant user authentication:
 * 1. Checks Firebase auth state
 * 2. If authenticated:
 *    a. Attempts to verify as platform_admin via /api/admin/verify
 *    b. If not platform_admin, loads from Firestore USERS collection
 *    c. Returns UnifiedUser with role and tenantId
 * 3. If not authenticated, uses demo mode (if Firebase not configured)
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
      // Demo mode - use demo user
      const demoUser = createDemoUser();
      setUser(demoUser);
      setPermissions(getUnifiedPermissions(demoUser.role));
      setLoading(false);
      logger.info('Using demo mode (Firebase not configured)', {
        file: 'useUnifiedAuth.ts',
      });
      return;
    }

    // Firebase is configured - use real auth
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      void (async () => {
        if (!firebaseUser) {
          // No Firebase user - use demo mode
          const demoUser = createDemoUser();
          setUser(demoUser);
          setPermissions(getUnifiedPermissions(demoUser.role));
          setLoading(false);
          logger.info('No Firebase user, using demo mode', {
            file: 'useUnifiedAuth.ts',
          });
          return;
        }

        try {
          // Get Firebase ID token for API calls
          const idToken = await firebaseUser.getIdToken();

          // Step 1: Try to verify as platform admin
          const platformAdminUser = await verifyPlatformAdmin(
            firebaseUser.uid,
            firebaseUser.email,
            idToken
          );

          if (platformAdminUser) {
            // User is platform admin
            setUser(platformAdminUser);
            setPermissions(getUnifiedPermissions('platform_admin'));
            setLoading(false);
            return;
          }

          // Step 2: Load as tenant user from Firestore
          const tenantUser = await loadTenantUserProfile(
            firebaseUser.uid,
            firebaseUser.email,
            firebaseUser.displayName
          );

          if (tenantUser) {
            // User is tenant user
            setUser(tenantUser);
            setPermissions(getUnifiedPermissions(tenantUser.role));
            setLoading(false);
            return;
          }

          // Step 3: Fallback - create basic user profile
          logger.warn('Could not load user profile, using fallback', {
            userId: firebaseUser.uid,
            file: 'useUnifiedAuth.ts',
          });

          const fallbackUser: UnifiedUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            displayName: firebaseUser.displayName ?? 'User',
            role: 'employee',
            tenantId: 'demo-org', // Fallback tenant
            status: 'active',
            mfaEnabled: false,
            createdAt: Timestamp.now(),
            lastLoginAt: Timestamp.now(),
          };

          setUser(fallbackUser);
          setPermissions(getUnifiedPermissions('employee'));
          setLoading(false);
        } catch (error) {
          logger.error(
            'Error in unified auth state change:',
            error instanceof Error ? error : new Error(String(error)),
            { file: 'useUnifiedAuth.ts' }
          );

          // Fallback to demo mode on error
          const demoUser = createDemoUser();
          setUser(demoUser);
          setPermissions(getUnifiedPermissions(demoUser.role));
          setLoading(false);
        }
      })();
    });

    return () => unsubscribe();
  }, []);

  // Helper: Check if user has a specific permission
  const hasPermission = (permission: keyof UnifiedPermissions): boolean => {
    if (!permissions) {
      return false;
    }
    return permissions[permission];
  };

  // Helper: Check if user is platform admin
  const isPlatformAdmin = (): boolean => {
    return isPlatformAdminRole(user?.role);
  };

  // Helper: Check if user is at least a certain role level
  const isAtLeastRole = (minimumRole: AccountRole): boolean => {
    if (!user) {
      return false;
    }

    const roleHierarchy: Record<AccountRole, number> = {
      platform_admin: 5,
      owner: 4,
      admin: 3,
      manager: 2,
      employee: 1,
    };

    return roleHierarchy[user.role] >= roleHierarchy[minimumRole];
  };

  return {
    user,
    loading,
    permissions,
    hasPermission,
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
 * Hook to get the current user's tenant ID
 */
export function useUnifiedTenantId(): string | null {
  const { user } = useUnifiedAuth();
  return user?.tenantId ?? null;
}
