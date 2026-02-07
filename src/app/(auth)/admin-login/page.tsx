'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { logger } from '@/lib/logger/logger';
import { createMockTimestamp } from '@/lib/utils/firestore-utils';

interface FirebaseError {
  code: string;
  message: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAdminUser, adminUser } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  // Check if Firebase Auth is available
  useEffect(() => {
    if (auth) {
      setIsFirebaseReady(true);
    }
  }, []);

  // Redirect if already logged in as admin
  useEffect(() => {
    if (adminUser) {
      router.push('/dashboard');
    }
  }, [adminUser, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Check if Firebase is available
    if (!auth) {
      setError('Firebase Auth is not configured. Please check your Firebase setup.');
      setLoading(false);
      return;
    }

    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      logger.info('✅ Firebase Auth successful', { email: user.email, file: 'page.tsx' });
      
      // Verify user is an admin by checking their Firestore document
      const token = await user.getIdToken();
      
      // Call API to verify admin status and get user data
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? 'Not authorized as admin');
      }
      
      const userData = await response.json() as { name?: string; role: string };

      // Create admin user session - binary RBAC, all admin panel users are 'admin'
      const adminUserData = {
        id: user.uid,
        email: user.email ?? email,
        displayName: userData.name ?? user.displayName ?? 'Admin User',
        role: 'admin' as const,
        permissions: {
          canViewUsers: true,
          canCreateUsers: true,
          canEditUsers: true,
          canSuspendUsers: true,
          canDeleteUsers: true,
          canViewSettings: true,
          canManageSettings: true,
          canManageIntegrations: true,
          canManageAPIKeys: true,
          canViewSystemHealth: true,
          canManageFeatureFlags: true,
          canViewAuditLogs: true,
          canExportData: true,
          canImportData: true,
          canViewAnalytics: true,
        },
        createdAt: createMockTimestamp(),
        updatedAt: createMockTimestamp(),
        status: 'active' as const,
        mfaEnabled: false,
      };

      // Set admin user via hook
      setAdminUser(adminUserData);
      
      // Redirect to admin dashboard
      router.push('/dashboard');
      
    } catch (err) {
      const error = err as FirebaseError;
      const logError = err instanceof Error ? err : new Error(String(err));
      logger.error('Login error:', logError, { file: 'page.tsx' });
      
      // Map Firebase error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/invalid-email': 'Invalid email address',
        'auth/invalid-credential': 'Invalid email or password',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later',
        'auth/network-request-failed': 'Network error. Please check your connection',
      };
      
      setError(errorMessages[error.code] ?? error.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const borderColor = 'var(--color-border-light)';
  const primaryColor = 'var(--color-primary)';

  return (
    <div className="flex justify-center items-center min-h-screen bg-surface-main p-8">
      <div
        className="w-full max-w-[400px] bg-surface-elevated rounded-xl p-8"
        style={{ border: `1px solid ${borderColor}` }}
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            Admin Login
          </h1>
          <p className="text-sm text-text-disabled">
            Platform administration access
          </p>
        </div>

        {!isFirebaseReady && (
          <div
            className="p-3 rounded-lg text-sm mb-4"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
              color: 'var(--color-warning-light)',
            }}
          >
            ⚠️ Firebase Auth is initializing...
          </div>
        )}

        {error && (
          <div
            className="p-3 rounded-lg text-sm mb-4"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-error) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-error) 30%, transparent)',
              color: 'var(--color-error-light)',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={(e) => { void handleLogin(e); }} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2 text-text-secondary">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full py-2.5 px-4 bg-surface-paper rounded-lg text-text-primary text-sm"
              style={{
                border: `1px solid ${borderColor}`,
                opacity: loading ? 0.5 : 1
              }}
              placeholder="admin@platform.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-text-secondary">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full py-2.5 px-4 bg-surface-paper rounded-lg text-text-primary text-sm"
              style={{
                border: `1px solid ${borderColor}`,
                opacity: loading ? 0.5 : 1
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !isFirebaseReady}
            className="w-full py-3 px-6 text-text-primary border-none rounded-lg text-sm font-semibold mt-2"
            style={{
              backgroundColor: loading || !isFirebaseReady ? 'var(--color-neutral-600)' : primaryColor,
              cursor: loading || !isFirebaseReady ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-surface-paper rounded-lg">
          <div className="text-xs text-text-disabled leading-6">
            <strong>Admin Access:</strong> This login requires an admin account.
            Contact your system administrator if you need access.
          </div>
        </div>
      </div>
    </div>
  );
}
