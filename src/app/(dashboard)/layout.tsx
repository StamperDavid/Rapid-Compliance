'use client';

import { useAuth } from '@/hooks/useAuth';
import { MerchantOrchestrator } from '@/components/orchestrator';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

/**
 * Penthouse Dashboard Layout
 * Single-tenant layout using the unified RapidCompliance.US Admin Sidebar.
 * Dark theme enforced. All routes (/leads, /deals, /analytics, etc.) flow through here.
 */
export default function PenthouseDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const orgId = DEFAULT_ORG_ID;
  const { user } = useAuth();

  // If no user, still render children (auth guards on individual pages handle redirects)
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000' }}>
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
      <MerchantOrchestrator orgId={orgId} />
    </div>
  );
}
