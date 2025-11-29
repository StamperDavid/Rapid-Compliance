'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import type { UserRole } from '@/types/permissions';

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
      console.warn('Firebase not configured. Running in demo mode.');
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
              
              // Get user's organization membership
              const orgMemberships = await dbModule.FirestoreService.getAll(dbModule.COLLECTIONS.ORGANIZATIONS, []);
              const defaultOrg = orgMemberships[0] || { id: 'demo', name: 'Demo Organization' };
              
              setUser({
                id: authUser.uid,
                email: authUser.email || '',
                displayName: authUser.displayName || userProfile?.displayName || 'User',
                role: (userProfile?.role as UserRole) || 'admin',
                organizationId: userProfile?.currentOrganizationId || defaultOrg.id,
                workspaceId: userProfile?.currentWorkspaceId,
              });
            } catch (error) {
              console.error('Error loading user profile:', error);
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
        console.error('Error loading Firestore service:', error);
        setLoading(false);
      });
    }).catch((error) => {
      console.error('Error loading auth service:', error);
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

