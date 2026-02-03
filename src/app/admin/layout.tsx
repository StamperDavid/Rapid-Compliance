'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { adminUser, loading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !adminUser) {
      router.replace('/admin-login');
    }
  }, [loading, adminUser, router]);

  if (loading) {
    return (
      <div
        className="admin-theme-scope"
        style={{
          minHeight: '100vh',
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid #333',
              borderTopColor: '#6366f1',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <p style={{ color: '#999', fontSize: '0.875rem' }}>Verifying admin access...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!adminUser) {
    return null;
  }

  return (
    <div className="admin-theme-scope" style={{ minHeight: '100vh', backgroundColor: '#000' }}>
      {children}
    </div>
  );
}
