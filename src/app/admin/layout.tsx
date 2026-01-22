'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { AdminOrchestrator } from '@/components/orchestrator';
import UnifiedSidebar from '@/components/dashboard/UnifiedSidebar';
import { PLATFORM_INTERNAL_ORG_ID } from '@/lib/routes/workspace-routes';

/**
 * Admin Layout - UNIFIED VERSION
 * Now uses UnifiedSidebar and useUnifiedAuth for consistent experience
 * This layout serves /admin/* routes during migration period
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading, isPlatformAdmin } = useUnifiedAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      // Redirect to admin login if not authenticated
      router.push('/admin-login');
    }
    // Only platform_admin can access /admin routes
    if (!loading && user && !isPlatformAdmin()) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isPlatformAdmin]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text-primary)'
      }}>
        Loading...
      </div>
    );
  }

  if (!user || !isPlatformAdmin()) {
    return null;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-background)' }}>
      {/* Unified Sidebar - Role-based navigation */}
      <UnifiedSidebar
        user={user}
        organizationId={PLATFORM_INTERNAL_ORG_ID}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        brandName="Platform Admin"
        primaryColor="#6366f1"
      />

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          backgroundColor: 'var(--color-background)',
          width: '100%',
          marginLeft: sidebarCollapsed ? '64px' : '280px',
          transition: 'margin-left 0.3s ease',
        }}
        className="md:ml-0"
      >
        {children}
      </main>

      {/* Admin AI Orchestrator - Platform Master Architect */}
      <AdminOrchestrator />
    </div>
  );
}

