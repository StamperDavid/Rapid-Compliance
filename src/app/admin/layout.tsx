'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { MerchantOrchestrator } from '@/components/orchestrator';

/**
 * Admin Layout
 * Wraps all /admin/* pages with auth guard and sidebar navigation.
 * SalesVelocity.ai Penthouse model.
 */
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
          backgroundColor: 'var(--color-bg-main)',
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
              border: '3px solid var(--color-border-light)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Verifying admin access...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!adminUser) {
    return null;
  }

  return (
    <div className="admin-theme-scope" style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      <AdminSidebar />

      {/* Main content area offset by sidebar width */}
      <main
        className="md:ml-[280px]"
        style={{
          minHeight: '100vh',
          transition: 'margin-left 0.3s ease',
        }}
      >
        {children}
      </main>

      <MerchantOrchestrator />
    </div>
  );
}
