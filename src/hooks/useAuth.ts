/**
 * Permission Check Hook
 * Client-side hook for checking user permissions
 * Now uses Firebase Auth
 *
 * SECURITY: Demo mode is restricted to development environment only
 */

'use client';

import { useState, useEffect } from 'react';
import { hasPermission, type UserRole, type RolePermissions } from '@/types/permissions';
import { onAuthStateChange, type AuthUser } from '@/lib/auth/auth-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

interface UserProfile {
  displayName?: string;
  name?: string;
  role?: string;
}

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  organizationId: string;
}

/**
 * Check if demo mode is allowed (development environment only)
 */
const isDemoModeAllowed = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if Firebase is configured
    import('@/lib/firebase/config').then(({ isFirebaseConfigured }) => {
      if (!isFirebaseConfigured) {
        // Demo mode - ONLY allowed in development environment
        if (isDemoModeAllowed()) {
          setUser({
            id: 'demo-user',
            email: 'admin@demo.com',
            displayName: 'Demo Admin',
            role: 'admin',
            organizationId: DEFAULT_ORG_ID,
          });
        } else {
          // In production, no Firebase config means unauthenticated
          logger.warn('Firebase not configured in production - user unauthenticated', { file: 'useAuth.ts' });
          setUser(null);
        }
        setLoading(false);
        return;
      }

      // Firebase is configured - use real auth
      const unsubscribe = onAuthStateChange((authUser: AuthUser | null) => {
        void (async () => {
          if (authUser) {
            try {
              // Load user profile from Firestore to get role
              const rawProfile: unknown = await FirestoreService.get(COLLECTIONS.USERS, authUser.uid);
              const userProfile = rawProfile as UserProfile | null;

              const userProfileName = userProfile?.name;
              const userProfileDisplayName = userProfile?.displayName;
              const roleValue = userProfile?.role;
              setUser({
                id: authUser.uid,
                email: authUser.email ?? '',
                displayName: authUser.displayName ?? userProfileDisplayName ?? (userProfileName ?? 'User'),
                role: (typeof roleValue === 'string' ? roleValue as UserRole : 'admin'),
                organizationId: DEFAULT_ORG_ID,
              });
            } catch (error) {
              logger.error('Error loading user profile:', error instanceof Error ? error : new Error(String(error)), { file: 'useAuth.ts' });
              // Fallback - only grant demo access in development
              if (isDemoModeAllowed()) {
                setUser({
                  id: authUser.uid,
                  email: authUser.email ?? '',
                  displayName: (authUser.displayName !== '' && authUser.displayName != null) ? authUser.displayName : 'User',
                  role: 'admin',
                  organizationId: DEFAULT_ORG_ID,
                });
              } else {
                // In production, profile load failure means limited access
                setUser({
                  id: authUser.uid,
                  email: authUser.email ?? '',
                  displayName: (authUser.displayName !== '' && authUser.displayName != null) ? authUser.displayName : 'User',
                  role: 'user', // Minimal access role in production
                  organizationId: DEFAULT_ORG_ID,
                });
              }
            }
          } else {
            // No auth user - demo mode only in development
            if (isDemoModeAllowed()) {
              setUser({
                id: 'demo-user',
                email: 'admin@demo.com',
                displayName: 'Demo Admin',
                role: 'admin',
                organizationId: DEFAULT_ORG_ID,
              });
            } else {
              // In production, no auth = unauthenticated
              setUser(null);
            }
          }
          setLoading(false);
        })();
      });

      return () => unsubscribe();
    }).catch((error: unknown) => {
      logger.error('Error checking Firebase config:', error instanceof Error ? error : new Error(String(error)), { file: 'useAuth.ts' });
      // Fallback - only to demo mode in development
      if (isDemoModeAllowed()) {
        setUser({
          id: 'demo-user',
          email: 'admin@demo.com',
          displayName: 'Demo Admin',
          role: 'admin',
          organizationId: DEFAULT_ORG_ID,
        });
      } else {
        // In production, config error means unauthenticated
        setUser(null);
      }
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
