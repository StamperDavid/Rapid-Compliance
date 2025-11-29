/**
 * Admin Authentication Hook
 * For admin platform access control
 */

'use client';

import { useState, useEffect } from 'react';
import type { AdminRole, AdminUser, AdminPermissions } from '@/types/admin';
import { ADMIN_ROLE_PERMISSIONS } from '@/types/admin';

export function useAdminAuth() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load admin user from auth context
    // In production, this would come from Firebase Auth with custom claims
    // For now, check if user is authenticated and has admin role
    const loadAdminUser = async () => {
      try {
        // Check if we're in demo mode or have Firebase configured
        const { isFirebaseConfigured } = await import('@/lib/firebase/config');
        
        if (!isFirebaseConfigured()) {
          // Demo mode: set default super admin
          const defaultAdmin: AdminUser = {
            id: 'admin-1',
            email: 'admin@platform.com',
            displayName: 'Super Admin',
            role: 'super_admin',
            permissions: ADMIN_ROLE_PERMISSIONS.super_admin,
            createdAt: new Date() as any,
            updatedAt: new Date() as any,
            status: 'active',
            mfaEnabled: false,
          };
          setAdminUser(defaultAdmin);
        } else {
          // Production: get from Firebase Auth with custom claims
          // This would check the user's role from Firebase Auth
          // For now, set default admin (will be replaced with actual auth check)
          const defaultAdmin: AdminUser = {
            id: 'admin-1',
            email: 'admin@platform.com',
            displayName: 'Super Admin',
            role: 'super_admin',
            permissions: ADMIN_ROLE_PERMISSIONS.super_admin,
            createdAt: new Date() as any,
            updatedAt: new Date() as any,
            status: 'active',
            mfaEnabled: false,
          };
          setAdminUser(defaultAdmin);
        }
      } catch (error) {
        console.error('Failed to load admin user:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAdminUser();
  }, []);

  const hasPermission = (permission: keyof AdminPermissions): boolean => {
    if (!adminUser) return false;
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

