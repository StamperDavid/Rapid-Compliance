/**
 * Permission Check Hook
 * Client-side hook for checking user permissions
 */

'use client';

import { useState, useEffect } from 'react';
import type { UserRole } from '@/types/permissions';
import { hasPermission, type RolePermissions } from '@/types/permissions';

export function useAuth() {
  // In production, this would come from Firebase Auth
  // For now, using localStorage for demo
  const [user, setUser] = useState<{
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    organizationId: string;
  } | null>(null);

  useEffect(() => {
    // Load from localStorage or auth context
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      setUser(JSON.parse(stored));
    } else {
      // Default demo user
      setUser({
        id: 'demo-user',
        email: 'admin@demo.com',
        displayName: 'Admin User',
        role: 'admin',
        organizationId: 'demo'
      });
    }
  }, []);

  return { user, setUser };
}

export function usePermission(permission: keyof RolePermissions): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return hasPermission(user.role, permission);
}

export function useRole(): UserRole | null {
  const { user } = useAuth();
  return user?.role || null;
}


