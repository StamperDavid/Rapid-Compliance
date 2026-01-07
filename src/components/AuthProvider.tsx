'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import type { UserRole } from '@/types/permissions'
import { logger } from '@/lib/logger/logger';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    // Dynamically import auth service only if Firebase is configured
    import('@/lib/auth/auth-service').then((authModule) => {
      import('@/lib/db/firestore-service').then((dbModule) => {
        const unsubscribe = authModule.onAuthStateChange(async (authUser) => {
          if (authUser) {
            try {
              const userProfile = await dbModule.FirestoreService.get(dbModule.COLLECTIONS.USERS, authUser.uid);
              
              // Use organizationId from user profile (set during account creation)
              const organizationId = userProfile?.organizationId || 'demo';
              
              setUser({
                id: authUser.uid,
                email: authUser.email || '',
                displayName: authUser.displayName || userProfile?.displayName || userProfile?.name || 'User',
                role: (userProfile?.role as UserRole) || 'admin',
                organizationId: organizationId,
                workspaceId: userProfile?.currentWorkspaceId,
              });
            } catch (error) {
              logger.error('Error loading user profile:', error, { file: 'AuthProvider.tsx' });
              setUser({
                id: authUser.uid,
                email: authUser.email || '',
                displayName: authUser.displayName || 'User',
                role: 'admin',
                organizationId: 'demo',
              });
            }
          } else {
            setUser(null);
          }
          setLoading(false);
        });

        return () => unsubscribe();
      }).catch((error) => {
        logger.error('Error loading Firestore service:', error, { file: 'AuthProvider.tsx' });
        setLoading(false);
      });
    }).catch((error) => {
      logger.error('Error loading auth service:', error, { file: 'AuthProvider.tsx' });
      setLoading(false);
    });
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

