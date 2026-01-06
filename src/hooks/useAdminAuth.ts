/**
 * Admin Authentication Hook
 * For admin platform access control
 */

'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import type { AdminRole, AdminUser, AdminPermissions } from '@/types/admin';
import { ADMIN_ROLE_PERMISSIONS } from '@/types/admin'
import { logger } from '@/lib/logger/logger';;

export function useAdminAuth() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
            const userData = await response.json();
            
            // Create admin user session
            const adminUserData: AdminUser = {
              id: firebaseUser.uid,
              email: firebaseUser.email || userData.email,
              displayName: userData.name || firebaseUser.displayName || 'Admin User',
              role: userData.role as AdminRole,
              permissions: ADMIN_ROLE_PERMISSIONS[userData.role as AdminRole] || ADMIN_ROLE_PERMISSIONS.admin,
              createdAt: new Date() as any,
              updatedAt: new Date() as any,
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
          logger.error('Error verifying admin status:', error, { file: 'useAdminAuth.ts' });
          setAdminUser(null);
        }
      } else {
        // No Firebase user logged in
        logger.info('📊 No Firebase user logged in', { file: 'useAdminAuth.ts' });
        setAdminUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const hasPermission = (permission: keyof AdminPermissions): boolean => {
    if (!adminUser) {return false;}
    return adminUser.permissions[permission];
  };

  const isSuperAdmin = (): boolean => {
    return adminUser?.role === 'super_admin';
  };

  return {
    adminUser,
    setAdminUser,
    loading,
    hasPermission,
    isSuperAdmin,
  };
}

export function useAdminPermission(permission: keyof AdminPermissions): boolean {
  const { hasPermission } = useAdminAuth();
  return hasPermission(permission);
}
