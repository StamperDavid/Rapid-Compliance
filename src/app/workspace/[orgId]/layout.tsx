'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import UnifiedSidebar from '@/components/dashboard/UnifiedSidebar';
import { MerchantOrchestrator } from '@/components/orchestrator';
import { ToastProvider } from '@/hooks/useToast';

/**
 * Workspace Layout - UNIFIED VERSION
 * Now uses UnifiedSidebar and useUnifiedAuth for consistent experience
 * This layout serves /workspace/[orgId]/* routes during migration period
 * NO "God Mode" indicator - role determines visibility naturally
 */
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const orgId = params.orgId as string;
  const { user, loading } = useUnifiedAuth();
  const { theme } = useOrgTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const primaryColor = useMemo(() => {
    return (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null)
      ? theme.colors.primary.main
      : '#6366f1';
  }, [theme?.colors?.primary?.main]);

  const brandName = useMemo(() => {
    return (theme?.branding?.companyName !== '' && theme?.branding?.companyName != null)
      ? theme.branding.companyName
      : 'AI CRM';
  }, [theme?.branding?.companyName]);

  // Convert user to UnifiedUser format for sidebar
  const unifiedUser = useMemo(() => {
    if (!user) {
      return null;
    }
    return {
      ...user,
      // Override tenantId with current workspace orgId
      tenantId: orgId,
    };
  }, [user, orgId]);

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

  if (!unifiedUser) {
    return null;
  }

  return (
    <ToastProvider>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000000' }}>
        <AdminBar />

        <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
          {/* Unified Sidebar - Role-based navigation, NO God Mode indicator */}
          <UnifiedSidebar
            user={unifiedUser}
            organizationId={orgId}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            brandName={brandName}
            primaryColor={primaryColor}
          />

          {/* Main Content */}
          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              backgroundColor: '#000',
              width: '100%',
              marginLeft: sidebarCollapsed ? '64px' : '280px',
              transition: 'margin-left 0.3s ease',
            }}
            className="md:ml-0"
          >
            {children}
          </main>
        </div>

        {/* Merchant AI Orchestrator - Floating Assistant */}
        <MerchantOrchestrator orgId={orgId} />
      </div>
    </ToastProvider>
  );
}






