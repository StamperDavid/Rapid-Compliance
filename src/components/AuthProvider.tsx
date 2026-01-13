'use client';

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import type { UserRole } from '@/types/permissions';
import { logger } from '@/lib/logger/logger';

// Static imports to avoid MIME type mismatches from dynamic import failures
// These will be tree-shaken if Firebase is not configured
import { onAuthStateChange } from '@/lib/auth/auth-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

interface AuthContextType {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    organizationId: string;
    workspaceId?: string;
  } | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

/**
 * AuthProvider - Manages user authentication state.
 *
 * Uses static imports for auth-service and firestore-service to prevent
 * MIME type mismatch errors that can occur with dynamic imports.
 *
 * Falls back to demo mode if Firebase is not configured.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Cleanup previous subscription if any
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!isFirebaseConfigured) {
      // Firebase not configured - use demo mode
      logger.warn('Firebase not configured. Running in demo mode.', { file: 'AuthProvider.tsx' });
      setUser({
        id: 'demo-user',
        email: 'admin@demo.com',
        displayName: 'Demo User',
        role: 'admin',
        organizationId: 'demo',
      });
      setLoading(false);
      return;
    }

    // Set up auth state listener with static imports
    try {
      const unsubscribe = onAuthStateChange(async (authUser) => {
        if (authUser) {
          try {
            const userProfile = await FirestoreService.get(COLLECTIONS.USERS, authUser.uid);

            // Use organizationId from user profile (set during account creation)
            const organizationId = userProfile?.organizationId ?? 'demo';

            // Extract display name with fallback chain
            let displayName = 'User';
            if (authUser.displayName !== '' && authUser.displayName != null) {
              displayName = authUser.displayName;
            } else if (userProfile?.displayName !== '' && userProfile?.displayName != null) {
              displayName = userProfile.displayName;
            } else if (userProfile?.name !== '' && userProfile?.name != null) {
              displayName = userProfile.name;
            }

            setUser({
              id: authUser.uid,
              email: authUser.email ?? '',
              displayName,
              role: (userProfile?.role as UserRole) ?? 'admin',
              organizationId,
              workspaceId: userProfile?.currentWorkspaceId,
            });
          } catch (error) {
            logger.error('Error loading user profile:', error, { file: 'AuthProvider.tsx' });
            setUser({
              id: authUser.uid,
              email: authUser.email ?? '',
              displayName: (authUser.displayName !== '' && authUser.displayName != null)
                ? authUser.displayName
                : 'User',
              role: 'admin',
              organizationId: 'demo',
            });
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      });

      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      logger.error('Error setting up auth listener:', error, { file: 'AuthProvider.tsx' });
      // Fall back to demo mode on error
      setUser({
        id: 'demo-user',
        email: 'admin@demo.com',
        displayName: 'Demo User',
        role: 'admin',
        organizationId: 'demo',
      });
      setLoading(false);
    }

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}

