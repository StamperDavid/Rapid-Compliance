'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';
  const brandName = theme?.branding?.companyName || 'AI CRM';
  const logoUrl = theme?.branding?.logoUrl;

  // Minimal navigation - just core CRM + Conversations
  const navItems = [
    { href: `/workspace/${orgId}/dashboard`, icon: '📊', label: 'Dashboard' },
    { href: `/workspace/${orgId}/conversations`, icon: '💬', label: 'Conversations' },
  ];

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

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Sidebar - Minimal */}
        <div style={{ 
          width: sidebarOpen ? '260px' : '70px',
          backgroundColor: '#0a0a0a',
          borderRight: '1px solid #1a1a1a',
          transition: 'width 0.3s',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
            {/* Main Navigation */}
            {navItems.map((item) => (
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
              >
                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            ))}

            {/* Divider */}
            <div style={{ height: '1px', backgroundColor: '#1a1a1a', margin: '1rem 0' }} />

            {/* CRM Section Label */}
            <div style={{ padding: '0 1.25rem', marginBottom: '0.5rem' }}>
              {sidebarOpen && (
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  CRM
                </span>
              )}
            </div>

            {/* CRM Entities */}
            {Object.entries(STANDARD_SCHEMAS).map(([key, schema]) => (
              <Link
                key={key}
                href={`/workspace/${orgId}/entities/${key}`}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: pathname?.includes(`/entities/${key}`) ? '#1a1a1a' : 'transparent',
                  color: pathname?.includes(`/entities/${key}`) ? primaryColor : '#999',
                  borderLeft: pathname?.includes(`/entities/${key}`) ? `3px solid ${primaryColor}` : '3px solid transparent',
                  fontSize: '0.875rem',
                  fontWeight: pathname?.includes(`/entities/${key}`) ? '600' : '400',
                  textDecoration: 'none'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{schema.icon}</span>
                {sidebarOpen && <span>{schema.pluralName}</span>}
              </Link>
            ))}
          </nav>

          {/* Sidebar Toggle */}
          <div style={{ padding: '1rem', borderTop: '1px solid #1a1a1a' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#1a1a1a',
                color: '#999',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              {sidebarOpen ? '← Collapse' : '→'}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main style={{ flex: 1, overflowY: 'auto', backgroundColor: '#000' }}>
          {children}
        </main>
      </div>
    </div>
  );
}





