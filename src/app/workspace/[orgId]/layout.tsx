'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
// STANDARD_SCHEMAS removed - unused

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const orgId = params.orgId as string;
  const { user: _user } = useAuth();
  const { theme } = useOrgTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : '#6366f1';
  const brandName = (theme?.branding?.companyName !== '' && theme?.branding?.companyName != null) ? theme.branding.companyName : 'AI CRM';
  const _logoUrl = theme?.branding?.logoUrl;

  // FULLY LOADED navigation - All features connected
  const navSections = [
    {
      title: 'Command Center',
      items: [
        { href: `/workspace/${orgId}/workforce`, icon: '🎛️', label: 'Workforce HQ' },
        { href: `/workspace/${orgId}/dashboard`, icon: '📊', label: 'Dashboard' },
        { href: `/workspace/${orgId}/conversations`, icon: '💬', label: 'Conversations' },
      ]
    },
    {
      title: 'CRM',
      items: [
        { href: `/workspace/${orgId}/leads`, icon: '🎯', label: 'Leads' },
        { href: `/workspace/${orgId}/deals`, icon: '💼', label: 'Deals' },
        { href: `/workspace/${orgId}/contacts`, icon: '👤', label: 'Contacts' },
        { href: `/workspace/${orgId}/living-ledger`, icon: '📒', label: 'Living Ledger' },
      ]
    },
    {
      title: 'Lead Gen',
      items: [
        { href: `/workspace/${orgId}/forms`, icon: '📋', label: 'Forms' },
        { href: `/workspace/${orgId}/leads/research`, icon: '🔬', label: 'Lead Research' },
        { href: `/workspace/${orgId}/lead-scoring`, icon: '⭐', label: 'Lead Scoring' },
      ]
    },
    {
      title: 'Outbound',
      items: [
        { href: `/workspace/${orgId}/outbound/sequences`, icon: '📧', label: 'Sequences' },
        { href: `/workspace/${orgId}/email/campaigns`, icon: '📮', label: 'Campaigns' },
        { href: `/workspace/${orgId}/email-writer`, icon: '✍️', label: 'Email Writer' },
        { href: `/workspace/${orgId}/nurture`, icon: '🌱', label: 'Nurture' },
        { href: `/workspace/${orgId}/calls`, icon: '📞', label: 'Calls' },
      ]
    },
    {
      title: 'Automation',
      items: [
        { href: `/workspace/${orgId}/workflows`, icon: '⚡', label: 'Workflows' },
        { href: `/workspace/${orgId}/ab-tests`, icon: '🧪', label: 'A/B Tests' },
      ]
    },
    {
      title: 'Content Factory',
      items: [
        { href: `/workspace/${orgId}/content/video`, icon: '🎬', label: 'Video Studio' },
        { href: `/workspace/${orgId}/social/campaigns`, icon: '📱', label: 'Social Media' },
        { href: `/workspace/${orgId}/proposals/builder`, icon: '📄', label: 'Proposals' },
        { href: `/workspace/${orgId}/battlecards`, icon: '🃏', label: 'Battlecards' },
      ]
    },
    {
      title: 'AI Workforce',
      items: [
        { href: `/workspace/${orgId}/settings/ai-agents/training`, icon: '🤖', label: 'Agent Training' },
        { href: `/workspace/${orgId}/voice/training`, icon: '🎙️', label: 'Voice AI Lab' },
        { href: `/workspace/${orgId}/social/training`, icon: '📢', label: 'Social AI Lab' },
        { href: `/workspace/${orgId}/seo/training`, icon: '🔍', label: 'SEO AI Lab' },
        { href: `/workspace/${orgId}/ai/datasets`, icon: '📚', label: 'Datasets' },
        { href: `/workspace/${orgId}/ai/fine-tuning`, icon: '🎯', label: 'Fine-Tuning' },
      ]
    },
    {
      title: 'E-Commerce',
      items: [
        { href: `/workspace/${orgId}/products`, icon: '📦', label: 'Products' },
        { href: `/workspace/${orgId}/analytics/ecommerce`, icon: '💰', label: 'Orders' },
        { href: `/workspace/${orgId}/settings/storefront`, icon: '🏪', label: 'Storefront' },
      ]
    },
    {
      title: 'Analytics',
      items: [
        { href: `/workspace/${orgId}/analytics`, icon: '📈', label: 'Overview' },
        { href: `/workspace/${orgId}/analytics/revenue`, icon: '💵', label: 'Revenue' },
        { href: `/workspace/${orgId}/analytics/pipeline`, icon: '🔄', label: 'Pipeline' },
        { href: `/workspace/${orgId}/sequences/analytics`, icon: '📊', label: 'Sequences' },
      ]
    },
    {
      title: 'Website',
      items: [
        { href: `/workspace/${orgId}/website/pages`, icon: '🌐', label: 'Pages' },
        { href: `/workspace/${orgId}/website/blog`, icon: '📝', label: 'Blog' },
        { href: `/workspace/${orgId}/website/domains`, icon: '🔗', label: 'Domains' },
        { href: `/workspace/${orgId}/website/seo`, icon: '🔎', label: 'SEO' },
        { href: `/workspace/${orgId}/website/settings`, icon: '🎨', label: 'Site Settings' },
      ]
    },
    {
      title: 'Settings',
      items: [
        { href: `/workspace/${orgId}/settings`, icon: '⚙️', label: 'Settings' },
        { href: `/workspace/${orgId}/integrations`, icon: '🔌', label: 'Integrations' },
        { href: `/workspace/${orgId}/settings/api-keys`, icon: '🔑', label: 'API Keys' },
      ]
    },
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

        {/* Left Sidebar - Minimal */}
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
    </div>
  );
}






