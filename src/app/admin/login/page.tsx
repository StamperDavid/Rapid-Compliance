'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAdminUser } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // In production, this would authenticate with Firebase Auth
      // For demo, accept any credentials
      if (email && password) {
        // Create admin user session
        const adminUser = {
          id: 'admin-1',
          email: email,
          displayName: 'Admin User',
          role: 'super_admin' as const,
          permissions: {
            canViewOrganizations: true,
            canCreateOrganizations: true,
            canEditOrganizations: true,
            canSuspendOrganizations: true,
            canDeleteOrganizations: true,
            canViewUsers: true,
            canCreateUsers: true,
            canEditUsers: true,
            canSuspendUsers: true,
            canDeleteUsers: true,
            canImpersonateUsers: true,
            canViewBilling: true,
            canManageSubscriptions: true,
            canProcessRefunds: true,
            canViewPaymentHistory: true,
            canViewSystemHealth: true,
            canManageFeatureFlags: true,
            canViewAuditLogs: true,
            canManageSystemSettings: true,
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

        // Set admin user via hook (no localStorage needed)
        setAdminUser(adminUser);
        router.push('/admin');
      } else {
        setError('Please enter email and password');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem'
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
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem'
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem 1.5rem',
              backgroundColor: loading ? '#4b5563' : primaryColor,
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '0.5rem'
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#0a0a0a', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', lineHeight: '1.5' }}>
            <strong>Demo Mode:</strong> Enter any email and password to login.
          </div>
        </div>
      </div>
    </div>
  );
}

