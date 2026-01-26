/**
 * Admin Authentication Hook
 * For admin platform access control
 */

'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { auth } from '@/lib/firebase/config';
import { ADMIN_ROLE_PERMISSIONS, type AdminRole, type AdminUser, type AdminPermissions } from '@/types/admin'
import { logger } from '@/lib/logger/logger';

interface AdminVerifyResponse {
  email?: string;
  name?: string;
  role?: string;
}

export function useAdminAuth() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      void (async () => {
        if (firebaseUser) {
          try {
            // Get the ID token
            const token = await firebaseUser.getIdToken();

            // Verify admin status via API
            const response = await fetch('/api/admin/verify', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            if (response.ok) {
              const userData = await response.json() as AdminVerifyResponse;

              // Type guard for role
              const userRole = (userData.role && typeof userData.role === 'string')
                ? userData.role as AdminRole
                : 'admin' as AdminRole;

              // Create admin user session
              const adminUserData: AdminUser = {
                id: firebaseUser.uid,
                email: firebaseUser.email ?? userData.email ?? '',
                displayName: (userData.name || firebaseUser.displayName !== '' && userData.name || firebaseUser.displayName != null) ? userData.name ?? firebaseUser.displayName ?? 'Admin User' : 'Admin User',
                role: userRole,
                permissions: ADMIN_ROLE_PERMISSIONS[userRole] || ADMIN_ROLE_PERMISSIONS.admin,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                status: 'active',
                mfaEnabled: false,
              };

              logger.info('✅ Admin authenticated', {
                email: adminUserData.email,
                role: adminUserData.role,
                file: 'useAdminAuth.ts'
              });
              setAdminUser(adminUserData);
            } else {
              // User is logged in to Firebase but not an admin
              logger.info('❌ User is not an admin', { file: 'useAdminAuth.ts' });
              setAdminUser(null);
            }
          } catch (error) {
            logger.error('Error verifying admin status:', error instanceof Error ? error : new Error(String(error)), { file: 'useAdminAuth.ts' });
            setAdminUser(null);
          }
        } else {
          // No Firebase user logged in
          logger.info('📊 No Firebase user logged in', { file: 'useAdminAuth.ts' });
          setAdminUser(null);
        }
        setLoading(false);
      })();
    });

    return () => unsubscribe();
  }, []);

  const hasPermission = (permission: keyof AdminPermissions): boolean => {
    if (!adminUser) {return false;}
    return adminUser.permissions[permission];
  };

  /**
   * Check if user has platform admin role
   * @deprecated Use isPlatformAdmin() instead - super_admin has been renamed to platform_admin
   */
  const isSuperAdmin = (): boolean => {
    return adminUser?.role === 'platform_admin';
  };

  const isPlatformAdmin = (): boolean => {
    return adminUser?.role === 'platform_admin';
  };

  return {
    adminUser,
    setAdminUser,
    loading,
    hasPermission,
    isSuperAdmin,
    isPlatformAdmin,
  };
}

export function useAdminPermission(permission: keyof AdminPermissions): boolean {
  const { hasPermission } = useAdminAuth();
  return hasPermission(permission);
}
