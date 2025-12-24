'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { logger } from '@/lib/logger/logger';;

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
      router.push('/admin');
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
      
      // Verify user is a super_admin by checking their Firestore document
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
        const data = await response.json();
        throw new Error(data.error || 'Not authorized as admin');
      }
      
      const userData = await response.json();
      
      // Create admin user session
      const adminUserData = {
        id: user.uid,
        email: user.email || email,
        displayName: userData.name || user.displayName || 'Admin User',
        role: userData.role as 'super_admin' | 'admin',
        permissions: {
          canViewOrganizations: true,
          canCreateOrganizations: true,
          canEditOrganizations: true,
          canSuspendOrganizations: true,
          canDeleteOrganizations: userData.role === 'super_admin',
          canViewUsers: true,
          canCreateUsers: true,
          canEditUsers: true,
          canSuspendUsers: true,
          canDeleteUsers: userData.role === 'super_admin',
          canImpersonateUsers: true,
          canViewBilling: true,
          canManageSubscriptions: true,
          canProcessRefunds: userData.role === 'super_admin',
          canViewPaymentHistory: true,
          canViewSystemHealth: true,
          canManageFeatureFlags: userData.role === 'super_admin',
          canViewAuditLogs: true,
          canManageSystemSettings: userData.role === 'super_admin',
          canAccessSupportTools: true,
          canExportData: true,
          canViewUsageAnalytics: true,
          canManageIntegrations: true,
          canManageTemplates: true,
          canManageCompliance: true,
        },
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
        status: 'active' as const,
        mfaEnabled: false,
      };

      // Set admin user via hook
      setAdminUser(adminUserData);
      
      // Redirect to admin dashboard
      router.push('/admin');
      
    } catch (err: any) {
      logger.error('Login error:', err, { file: 'page.tsx' });
      
      // Map Firebase error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/invalid-email': 'Invalid email address',
        'auth/invalid-credential': 'Invalid email or password',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later',
        'auth/network-request-failed': 'Network error. Please check your connection',
      };
      
      setError(errorMessages[err.code] || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#000',
      padding: '2rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: bgPaper,
        border: `1px solid ${borderColor}`,
        borderRadius: '0.75rem',
        padding: '2rem'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
            Admin Login
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#666' }}>
            Platform administration access
          </p>
        </div>

        {!isFirebaseReady && (
          <div style={{
            padding: '0.75rem',
            backgroundColor: '#78350f',
            border: '1px solid #92400e',
            borderRadius: '0.5rem',
            color: '#fbbf24',
            fontSize: '0.875rem',
            marginBottom: '1rem'
          }}>
            ⚠️ Firebase Auth is initializing...
          </div>
        )}

        {error && (
          <div style={{
            padding: '0.75rem',
            backgroundColor: '#7f1d1d',
            border: '1px solid #991b1b',
            borderRadius: '0.5rem',
            color: '#fca5a5',
            fontSize: '0.875rem',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#999' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem',
                opacity: loading ? 0.5 : 1
              }}
              placeholder="admin@platform.com"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#999' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem',
                opacity: loading ? 0.5 : 1
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !isFirebaseReady}
            style={{
              width: '100%',
              padding: '0.75rem 1.5rem',
              backgroundColor: loading || !isFirebaseReady ? '#4b5563' : primaryColor,
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: loading || !isFirebaseReady ? 'not-allowed' : 'pointer',
              marginTop: '0.5rem'
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#0a0a0a', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', lineHeight: '1.5' }}>
            <strong>Super Admin Access:</strong> This login requires a super_admin account.
            Contact your platform administrator if you need access.
          </div>
        </div>
      </div>
    </div>
  );
}
