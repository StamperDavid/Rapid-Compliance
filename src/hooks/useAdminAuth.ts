/**
 * Admin Authentication Hook
 * For admin platform access control
 */

'use client';

import { useState } from 'react';
import type { AdminRole, AdminUser, AdminPermissions } from '@/types/admin';
import { ADMIN_ROLE_PERMISSIONS } from '@/types/admin';

// Demo mode: default super admin (created immediately, no async loading)
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

export function useAdminAuth() {
  // In demo mode, we start with the admin user already set (no loading state)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(defaultAdmin);
  const [loading, setLoading] = useState(false); // No loading in demo mode

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

