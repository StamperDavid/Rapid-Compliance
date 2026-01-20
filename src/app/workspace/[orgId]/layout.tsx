'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useFeatureVisibility } from '@/hooks/useFeatureVisibility';
import { MerchantOrchestrator } from '@/components/orchestrator';
import { isPlatformAdmin } from '@/types/permissions';

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const orgId = params.orgId as string;
  const { user } = useAuth();
  const { theme } = useOrgTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ADAPTIVE NAVIGATION - Filtered based on client's feature visibility settings
  const { filteredNav, hiddenCount, isLoading: navLoading } = useFeatureVisibility(orgId);

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : '#6366f1';
  const brandName = (theme?.branding?.companyName !== '' && theme?.branding?.companyName != null) ? theme.branding.companyName : 'AI CRM';

  // Determine if user is Platform Admin (God Mode)
  const isGodMode = isPlatformAdmin(user?.role);

  // Use adaptive navigation from hook
  const navSections = filteredNav;

  // Check if current path matches
  const isActive = (href: string) => {
    if (href === `/workspace/${orgId}/dashboard`) {
      return pathname === href || pathname === `/workspace/${orgId}`;
    }
    return pathname?.startsWith(href);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000000' }}>
      <AdminBar />

      {/* Mobile Header with Hamburger */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #1a1a1a',
        backgroundColor: '#0a0a0a',
      }} className="md:hidden flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            padding: '0.5rem',
            backgroundColor: '#1a1a1a',
            color: '#999',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '1.25rem',
          }}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <span style={{ color: '#fff', fontWeight: '600' }}>{brandName}</span>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 40,
            }}
            className="md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Left Sidebar - Shows all features for platform_admin via useFeatureVisibility */}
        <aside
          className={`
            fixed md:relative
            w-[260px]
            h-full
            bg-[#0a0a0a]
            border-r border-[#1a1a1a]
            flex flex-col
            z-50 md:z-auto
            transition-transform duration-300
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0
          `}
        >
          {/* God Mode Indicator for Platform Admin */}
          {isGodMode && (
            <div style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#1a1a1a',
              borderBottom: '1px solid #2a2a2a',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span style={{ fontSize: '1rem' }}>👑</span>
              <span style={{ color: primaryColor, fontSize: '0.6875rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                God Mode
              </span>
            </div>
          )}

          <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
            {/* Render all sections */}
            {navSections.map((section, sectionIdx) => (
              <div key={sectionIdx}>
                {sectionIdx > 0 && <div style={{ height: '1px', backgroundColor: '#1a1a1a', margin: '1rem 0' }} />}

                {/* Section Label */}
                <div style={{ padding: '0 1.25rem', marginBottom: '0.5rem', marginTop: sectionIdx > 0 ? '1rem' : '0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {section.title}
                  </span>
                </div>

                {/* Section Items */}
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      width: '100%',
                      padding: '0.875rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      backgroundColor: isActive(item.href) ? '#1a1a1a' : 'transparent',
                      color: isActive(item.href) ? primaryColor : '#999',
                      borderLeft: isActive(item.href) ? `3px solid ${primaryColor}` : '3px solid transparent',
                      fontSize: '0.875rem',
                      fontWeight: isActive(item.href) ? '600' : '400',
                      textDecoration: 'none'
                    }}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          {/* Hidden Features Indicator (not shown for Platform Admin) */}
          {hiddenCount > 0 && !navLoading && (
            <div style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid #1a1a1a',
              backgroundColor: '#0a0a0a',
            }}>
              <Link
                href={`/workspace/${orgId}/settings`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#666',
                  fontSize: '0.75rem',
                  textDecoration: 'none',
                }}
              >
                <span>👁️</span>
                <span>{hiddenCount} hidden feature{hiddenCount > 1 ? 's' : ''}</span>
              </Link>
            </div>
          )}

        </aside>

        {/* Main Content */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: '#000',
          width: '100%',
        }}
        className="md:ml-0"
        >
          {children}
        </main>
      </div>

      {/* Merchant AI Orchestrator - Floating Assistant */}
      <MerchantOrchestrator orgId={orgId} />
    </div>
  );
}






