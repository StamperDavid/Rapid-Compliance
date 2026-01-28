'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { useAdminTheme, ADMIN_THEME_SCOPE_CLASS } from '@/hooks/useAdminTheme';
import { AdminOrchestrator } from '@/components/orchestrator';
import UnifiedSidebar from '@/components/dashboard/UnifiedSidebar';
import { PLATFORM_INTERNAL_ORG_ID, workspaceRoutes } from '@/lib/routes/workspace-routes';

/**
 * Admin Layout - UNIFIED VERSION with ISOLATED THEMING
 *
 * THEME ISOLATION:
 * - Uses useAdminTheme() hook for Admin-specific theme settings
 * - Theme variables are scoped to the admin container via CSS custom properties
 * - Completely isolated from Client/Org themes (useOrgTheme does not affect Admin)
 * - Admin theme is loaded from platform-level Firestore settings
 *
 * ROLE-BASED ACCESS:
 * - Unauthenticated users → /admin-login
 * - Non-platform-admin users → /workspace/{orgId}/dashboard (with proper context)
 * - Platform admins → allowed through
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading: authLoading, isPlatformAdmin } = useUnifiedAuth();
  const { setContainerRef, primaryColor, brandName, loading: themeLoading } = useAdminTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const loading = authLoading || themeLoading;

  useEffect(() => {
    if (!authLoading && !user) {
      // Redirect to admin login if not authenticated
      router.push('/admin-login');
    }
    // Only platform_admin can access /admin routes
    // Non-admins are redirected to their workspace dashboard (with proper orgId context)
    if (!authLoading && user && !isPlatformAdmin()) {
      const userOrgId = user.tenantId ?? user.workspaceId;
      if (userOrgId) {
        // Redirect to user's workspace dashboard with proper context
        router.push(workspaceRoutes.dashboard(userOrgId));
      } else {
        // User has no org - redirect to onboarding or login
        router.push('/onboarding');
      }
    }
  }, [user, authLoading, router, isPlatformAdmin]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#000000',
        color: '#ffffff'
      }}>
        Loading...
      </div>
    );
  }

  if (!user || !isPlatformAdmin()) {
    return null;
  }

  return (
    <div
      ref={setContainerRef}
      className={ADMIN_THEME_SCOPE_CLASS}
      style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-background)' }}
    >
      {/* Unified Sidebar - Uses Admin theme via scoped CSS variables */}
      <UnifiedSidebar
        user={user}
        organizationId={PLATFORM_INTERNAL_ORG_ID}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        brandName={brandName}
        primaryColor={primaryColor}
        isAdminContext={true}
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

