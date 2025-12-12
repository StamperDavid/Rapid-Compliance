'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { useAuth, usePermission } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

export default function SettingsPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [theme, setTheme] = React.useState<any>(null);
  
  const canManageAPIKeys = usePermission('canManageAPIKeys');
  const canManageTheme = usePermission('canManageTheme');
  const canManageOrganization = usePermission('canManageOrganization');
  const canViewAllUsers = usePermission('canViewAllUsers');
  const canManageBilling = usePermission('canManageBilling');
  const canManageIntegrations = usePermission('canManageIntegrations');

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      try {
        setTheme(JSON.parse(savedTheme));
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    }
  }, []);

  const brandName = theme?.branding?.companyName || 'AI CRM';
  const logoUrl = theme?.branding?.logoUrl;
  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  const settingsSections = [
    {
      title: 'Core Configuration',
      items: [
        { icon: '🔑', label: 'API Keys', description: 'Configure Firebase, AI, payment, and email services', href: `/workspace/${orgId}/settings/api-keys`, permission: canManageAPIKeys },
        { icon: '💳', label: 'Billing & Plans', description: 'Manage subscription, usage, and billing', href: `/workspace/${orgId}/settings/billing`, permission: canManageBilling },
      ]
    },
    {
      title: 'E-Commerce',
      items: [
        { icon: '🛒', label: 'Online Storefront', description: 'Enable store, choose products/services/both, customize theme, generate embed codes', href: `/workspace/${orgId}/settings/storefront`, permission: canManageOrganization },
      ]
    },
    {
      title: 'Email & SMS',
      items: [
        { icon: '📧', label: 'Email Templates', description: 'Customize email notifications and branding', href: `/workspace/${orgId}/settings/email-templates`, permission: canManageTheme },
        { icon: '📱', label: 'SMS Messages', description: 'Configure automated text messages with custom triggers', href: `/workspace/${orgId}/settings/sms-messages`, permission: canManageTheme },
      ]
    },
    {
      title: 'Customization',
      items: [
        { icon: '🎨', label: 'CRM Theme & Branding', description: 'White-label your CRM platform with custom colors and logo', href: `/workspace/${orgId}/settings/theme`, permission: canManageTheme },
      ]
    },
    {
      title: 'Users & Access',
      items: [
        { icon: '👥', label: 'Team Members', description: 'Invite users, manage roles and permissions', href: `/workspace/${orgId}/settings/users`, permission: canViewAllUsers },
        { icon: '🔐', label: 'Security', description: 'Two-factor auth, IP restrictions, audit logs', href: `/workspace/${orgId}/settings/security`, permission: canManageOrganization },
      ]
    },
    {
      title: 'Integrations',
      items: [
        { icon: '📊', label: 'Accounting Software', description: 'Sync invoices, payments, and customers to QuickBooks, Xero, FreshBooks, Wave', href: `/workspace/${orgId}/settings/accounting`, permission: canManageIntegrations },
        { icon: '🔌', label: 'Business Apps', description: 'Connect Slack, Zapier, and other third-party apps', href: `/workspace/${orgId}/settings/integrations`, permission: canManageIntegrations },
        { icon: '🌐', label: 'Webhooks', description: 'Configure webhooks for real-time event notifications', href: `/workspace/${orgId}/settings/webhooks`, permission: canManageIntegrations },
      ]
    },
    {
      title: 'Analytics & Reporting',
      items: [
        { icon: '📈', label: 'Analytics Dashboard', description: 'Revenue reports, pipeline analysis, forecasting, and win/loss', href: '/dashboard?view=revenue', permission: canManageOrganization },
      ]
    },
    {
      title: 'Outbound Sales',
      items: [
        { icon: '🚀', label: 'Subscription & Features', description: 'Manage plan, outbound features, and usage limits', href: `/workspace/${orgId}/settings/subscription`, permission: canManageBilling },
      ]
    },
    {
      title: 'Advanced',
      items: [
        { icon: '📋', label: 'Schema Editor', description: 'Create and manage custom entities and fields', href: `/workspace/${orgId}/schemas`, permission: canManageOrganization },
        { icon: '⚙️', label: 'Workflows', description: 'Automation rules and workflow configuration', href: `/workspace/${orgId}/settings/workflows`, permission: canManageOrganization },
        { icon: '🤖', label: 'AI Agents', description: 'Configure and train AI assistants', href: `/workspace/${orgId}/settings/ai-agents`, permission: canManageOrganization },
      ]
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000000' }}>
      <AdminBar />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Sidebar */}
        <div style={{ 
          width: sidebarOpen ? '260px' : '70px',
          backgroundColor: '#0a0a0a',
          borderRight: '1px solid #1a1a1a',
          transition: 'width 0.3s',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
            <Link
              href="/crm"
              style={{
                width: '100%',
                padding: '0.875rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: 'transparent',
                color: '#999',
                borderLeft: '3px solid transparent',
                fontSize: '0.875rem',
                fontWeight: '400',
                textDecoration: 'none'
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>🏠</span>
              {sidebarOpen && <span>Back to CRM</span>}
            </Link>

            {Object.entries(STANDARD_SCHEMAS).map(([key, schema]) => (
              <Link
                key={key}
                href={`/crm?view=${key}`}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: 'transparent',
                  color: '#999',
                  borderLeft: '3px solid transparent',
                  fontSize: '0.875rem',
                  fontWeight: '400',
                  textDecoration: 'none'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{schema.icon}</span>
                {sidebarOpen && <span>{schema.pluralName}</span>}
              </Link>
            ))}
          </nav>

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
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
              <Link href="/crm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                ← Back to CRM
              </Link>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Settings</h1>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>
                Manage your organization, users, integrations, and platform configuration
              </p>
            </div>

            {/* Organization Info Card */}
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '0.75rem', backgroundColor: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                  🏢
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>Demo Organization</h2>
                  <p style={{ color: '#666', fontSize: '0.875rem' }}>
                    {user?.email} • {user?.role && <span style={{ textTransform: 'capitalize', color: primaryColor, fontWeight: '600' }}>{user.role}</span>}
                  </p>
                </div>
                {canManageOrganization && (
                  <Link href={`/workspace/${orgId}/settings/organization`} style={{ padding: '0.625rem 1.25rem', backgroundColor: '#222', color: '#fff', borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500', border: '1px solid #333' }}>
                    Edit Details
                  </Link>
                )}
              </div>
            </div>

            {/* Settings Sections */}
            {settingsSections.map((section, sectionIdx) => {
              const visibleItems = section.items.filter(item => item.permission);
              if (visibleItems.length === 0) return null;

              return (
                <div key={sectionIdx} style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                    {section.title}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
                    {visibleItems.map((item, itemIdx) => (
                      <Link
                        key={itemIdx}
                        href={item.href}
                        style={{
                          display: 'flex',
                          gap: '1rem',
                          padding: '1.5rem',
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          borderRadius: '0.75rem',
                          textDecoration: 'none',
                          transition: 'all 0.2s',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = primaryColor;
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#333';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div style={{ fontSize: '2.5rem' }}>{item.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>{item.label}</div>
                          <div style={{ fontSize: '0.875rem', color: '#999', lineHeight: '1.4' }}>{item.description}</div>
                        </div>
                        <div style={{ color: '#666', fontSize: '1.25rem' }}>→</div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
