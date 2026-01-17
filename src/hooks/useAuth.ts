/**
 * Permission Check Hook
 * Client-side hook for checking user permissions
 * Now uses Firebase Auth
 */

'use client';

import { useState, useEffect } from 'react';
import { hasPermission, type UserRole, type RolePermissions } from '@/types/permissions';
import { onAuthStateChange, type AuthUser } from '@/lib/auth/auth-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';

interface UserProfile {
  organizationId?: string;
  displayName?: string;
  name?: string;
  role?: string;
  currentWorkspaceId?: string;
}

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  organizationId: string;
  workspaceId?: string;
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if Firebase is configured
    import('@/lib/firebase/config').then(({ isFirebaseConfigured }) => {
      if (!isFirebaseConfigured) {
        // Demo mode - use demo user with admin permissions
        setUser({
          id: 'demo-user',
          email: 'admin@demo.com',
          displayName: 'Demo Admin',
          role: 'admin', // Admin role has canAccessSettings = true
          organizationId: 'demo',
        });
        setLoading(false);
        return;
      }

      // Firebase is configured - use real auth
      const unsubscribe = onAuthStateChange((authUser: AuthUser | null) => {
        void (async () => {
          if (authUser) {
            try {
              // Load user profile from Firestore to get role and organization
              const rawProfile: unknown = await FirestoreService.get(COLLECTIONS.USERS, authUser.uid);
              const userProfile = rawProfile as UserProfile | null;

              // Use organizationId from user profile (set during account creation)
              const userProfileOrgId = userProfile?.organizationId;
              const organizationId = (userProfileOrgId !== '' && userProfileOrgId != null) ? userProfileOrgId : 'demo';

              const userProfileName = userProfile?.name;
              const userProfileDisplayName = userProfile?.displayName;
              const roleValue = userProfile?.role;
              setUser({
                id: authUser.uid,
                email: authUser.email ?? '',
                displayName: authUser.displayName ?? userProfileDisplayName ?? (userProfileName ?? 'User'),
                role: (typeof roleValue === 'string' ? roleValue as UserRole : 'admin'),
                organizationId: organizationId,
                workspaceId: userProfile?.currentWorkspaceId,
              });
            } catch (error) {
              logger.error('Error loading user profile:', error instanceof Error ? error : undefined, { file: 'useAuth.ts' });
              // Fallback to basic user info with admin role
              setUser({
                id: authUser.uid,
                email: authUser.email ?? '',
                displayName:(authUser.displayName !== '' && authUser.displayName != null) ? authUser.displayName : 'User',
                role: 'admin', // Default to admin so settings are accessible
                organizationId: 'demo',
              });
            }
          } else {
            // No auth user - use demo mode
            setUser({
              id: 'demo-user',
              email: 'admin@demo.com',
              displayName: 'Demo Admin',
              role: 'admin',
              organizationId: 'demo',
            });
          }
          setLoading(false);
        })();
      });

      return () => unsubscribe();
    }).catch((error: unknown) => {
      logger.error('Error checking Firebase config:', error as Error, { file: 'useAuth.ts' });
      // Fallback to demo mode
      setUser({
        id: 'demo-user',
        email: 'admin@demo.com',
        displayName: 'Demo Admin',
        role: 'admin',
        organizationId: 'demo',
      });
      setLoading(false);
    });
  }, []);

  return { user, setUser, loading };
}

export function usePermission(permission: keyof RolePermissions): boolean {
  const { user } = useAuth();
  if (!user) {return false;}
  return hasPermission(user.role, permission);
}

export function useRole(): UserRole | null {
  const { user } = useAuth();
  return user?.role ?? null;
}


