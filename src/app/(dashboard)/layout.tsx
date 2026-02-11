'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { MerchantOrchestrator } from '@/components/orchestrator';
import AdminSidebar from '@/components/admin/AdminSidebar';
import ImpersonationBanner from '@/components/admin/ImpersonationBanner';
import { ToastProvider } from '@/hooks/useToast';

/**
 * Penthouse Dashboard Layout
 * Unified layout using the SalesVelocity.ai Command Center sidebar.
 * Dark theme enforced. All routes (/leads, /deals, /analytics, etc.) flow through here.
 *
 * Auth guard: redirects unauthenticated users to /login.
 */
export default function PenthouseDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUnifiedAuth();
  const router = useRouter();
  useOrgTheme();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // Show loading screen while auth state resolves
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--color-bg-main, #000)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid rgba(var(--color-primary-rgb), 0.2)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Loading...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Auth resolved but no user — redirect is in progress
  if (!user) {
    return null;
  }

  return (
    <ToastProvider>
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
        <ImpersonationBanner />
        <AdminSidebar />

        {/* Main content area offset by sidebar width */}
        <main
          id="main-content"
          tabIndex={-1}
          className="md:ml-[280px]"
          style={{
            minHeight: '100vh',
            transition: 'margin-left 0.3s ease',
            outline: 'none',
          }}
        >
          {children}
        </main>

        {/* Merchant AI Orchestrator - Floating Assistant */}
        <MerchantOrchestrator />
      </div>
    </ToastProvider>
  );
}
