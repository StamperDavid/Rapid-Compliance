'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useFeatureVisibility } from '@/hooks/useFeatureVisibility';
import { MerchantOrchestrator } from '@/components/orchestrator';
import { isSuperAdmin } from '@/types/permissions';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

/**
 * Penthouse Dashboard Layout
 * Single-tenant layout that uses DEFAULT_ORG_ID instead of dynamic [orgId]
 * All workspace routes are flattened under /(dashboard)/
 */
export default function PenthouseDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const orgId = DEFAULT_ORG_ID;
  const { user } = useAuth();
  const { theme } = useOrgTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ADAPTIVE NAVIGATION - Filtered based on client's feature visibility settings
  const { filteredNav, hiddenCount, isLoading: navLoading } = useFeatureVisibility(orgId);

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : '#6366f1';
  const brandName = (theme?.branding?.companyName !== '' && theme?.branding?.companyName != null) ? theme.branding.companyName : 'AI CRM';

  // Determine if user is Super Admin (full access)
  const isGodMode = isSuperAdmin(user?.role);

  // Use adaptive navigation from hook
  const navSections = filteredNav;

  // Check if current path matches - updated for flat routes
  const isActive = (href: string) => {
    // Convert old workspace paths to flat paths for comparison
    const flatHref = href.replace(/^\/workspace\/[^/]+/, '');
    const flatPathname = pathname?.replace(/^\/workspace\/[^/]+/, '') ?? '';

    if (flatHref === '/dashboard' || flatHref === '') {
      return flatPathname === '/dashboard' || flatPathname === '';
    }
    return flatPathname?.startsWith(flatHref);
  };

  // Convert workspace hrefs to flat hrefs
  const toFlatHref = (href: string) => {
    return href.replace(/^\/workspace\/[^/]+/, '');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      <AdminBar />

      {/* Mobile Header with Hamburger */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid var(--color-border-main)',
        backgroundColor: 'var(--color-bg-paper)',
      }} className="md:hidden flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            padding: '0.5rem',
            backgroundColor: 'var(--color-bg-elevated)',
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
            flex flex-col
            z-50 md:z-auto
            transition-transform duration-300
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0
          `}
          style={{
            backgroundColor: 'var(--color-bg-paper)',
            borderRight: '1px solid var(--color-border-main)',
          }}
        >
          {/* God Mode Indicator for Platform Admin */}
          {isGodMode && (
            <div style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: 'var(--color-bg-elevated)',
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
                {sectionIdx > 0 && <div style={{ height: '1px', backgroundColor: 'var(--color-border-main)', margin: '1rem 0' }} />}

                {/* Section Label */}
                <div style={{ padding: '0 1.25rem', marginBottom: '0.5rem', marginTop: sectionIdx > 0 ? '1rem' : '0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {section.title}
                  </span>
                </div>

                {/* Section Items */}
                {section.items.map((item) => {
                  const flatHref = toFlatHref(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={flatHref || '/dashboard'}
                      className={`
                        w-full flex items-center gap-3 text-sm no-underline transition-colors
                        ${isActive(item.href)
                          ? 'font-semibold'
                          : 'font-normal hover:bg-[var(--color-bg-elevated)]'
                        }
                      `}
                      style={{
                        padding: '0.875rem 1.25rem',
                        backgroundColor: isActive(item.href) ? 'var(--color-bg-elevated)' : undefined,
                        color: isActive(item.href) ? primaryColor : '#999',
                        borderLeft: isActive(item.href) ? `3px solid ${primaryColor}` : '3px solid transparent',
                        ['--hover-color' as string]: primaryColor,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive(item.href)) {
                          e.currentTarget.style.color = primaryColor;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive(item.href)) {
                          e.currentTarget.style.color = '#999';
                        }
                      }}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Hidden Features Indicator (not shown for Platform Admin) */}
          {hiddenCount > 0 && !navLoading && (
            <div style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid var(--color-border-main)',
              backgroundColor: 'var(--color-bg-paper)',
            }}>
              <Link
                href="/settings"
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
          backgroundColor: 'var(--color-bg-main)',
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
