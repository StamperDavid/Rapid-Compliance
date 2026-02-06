'use client';

import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { MerchantOrchestrator } from '@/components/orchestrator';
import AdminSidebar from '@/components/admin/AdminSidebar';

/**
 * Penthouse Dashboard Layout
 * Penthouse layout using the unified SalesVelocity.ai Admin Sidebar.
 * Dark theme enforced. All routes (/leads, /deals, /analytics, etc.) flow through here.
 */
export default function PenthouseDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  useOrgTheme();

  // If no user, still render children (auth guards on individual pages handle redirects)
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      {user && <AdminSidebar />}

      {/* Main content area offset by sidebar width */}
      <main
        className={user ? 'md:ml-[280px]' : ''}
        style={{
          minHeight: '100vh',
          transition: 'margin-left 0.3s ease',
        }}
      >
        {children}
      </main>

      {/* Merchant AI Orchestrator - Floating Assistant */}
      <MerchantOrchestrator />
    </div>
  );
}
