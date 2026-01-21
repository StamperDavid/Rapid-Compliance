'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { AdminOrchestrator } from '@/components/orchestrator';
import CommandCenterSidebar from '@/components/admin/CommandCenterSidebar';
import { PLATFORM_INTERNAL_ORG_ID } from '@/lib/routes/workspace-routes';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { adminUser, loading } = useAdminAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  useEffect(() => {
    if (!loading && !adminUser) {
      // Redirect to admin login if not authenticated
      router.push('/admin-login');
    }
  }, [adminUser, loading, router]);

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

  if (!adminUser) {
    return null;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-background)', flexDirection: 'column' }}>
      {/* Mobile Header with Hamburger */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }} className="md:hidden flex items-center justify-between">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            padding: '0.5rem',
            backgroundColor: 'var(--color-surface-elevated)',
            color: 'var(--color-text-secondary)',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '1.25rem',
          }}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <span style={{ color: 'var(--color-text-primary)', fontWeight: '600' }}>Platform Admin</span>
      </div>

      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 40,
            }}
            className="md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* CommandCenter Sidebar */}
        <CommandCenterSidebar
          organizationId={PLATFORM_INTERNAL_ORG_ID}
          adminUser={{
            displayName: adminUser.displayName,
            role: adminUser.role.replace('_', ' ').toUpperCase(),
          }}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
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
      </div>

      {/* Admin AI Orchestrator - Platform Master Architect */}
      <AdminOrchestrator />
    </div>
  );
}

