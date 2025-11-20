'use client';

import Link from 'next/link';
import AdminBar from '@/components/AdminBar';
import { useAuth, usePermission } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

export default function SettingsPage() {
  const { user } = useAuth();
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
        { icon: '🏢', label: 'Organization', description: 'Company name, details, and general settings', href: '/workspace/demo/settings/organization', permission: canManageOrganization },
        { icon: '🔑', label: 'API Keys', description: 'Configure Firebase, AI, payment, and email services', href: '/workspace/demo/settings/api-keys', permission: canManageAPIKeys },
        { icon: '💳', label: 'Billing & Plans', description: 'Manage subscription, usage, and billing', href: '/workspace/demo/settings/billing', permission: canManageBilling },
      ]
    },
    {
      title: 'Customization',
      items: [
        { icon: '🎨', label: 'Theme & Branding', description: 'White-label your platform with custom colors, logo, and styling', href: '/workspace/demo/settings/theme', permission: canManageTheme },
        { icon: '📧', label: 'Email Templates', description: 'Customize email notifications and branding', href: '/workspace/demo/settings/email-templates', permission: canManageTheme },
        { icon: '🌐', label: 'Custom Domain', description: 'Connect your custom domain for white-labeling', href: '/workspace/demo/settings/domain', permission: canManageOrganization },
      ]
    },
    {
      title: 'Users & Access',
      items: [
        { icon: '👥', label: 'Team Members', description: 'Invite users, manage roles and permissions', href: '/workspace/demo/settings/users', permission: canViewAllUsers },
        { icon: '🔐', label: 'Security', description: 'Two-factor auth, IP restrictions, audit logs', href: '/workspace/demo/settings/security', permission: canManageOrganization },
        { icon: '🔔', label: 'Notifications', description: 'Configure email and push notification preferences', href: '/workspace/demo/settings/notifications', permission: true },
      ]
    },
    {
      title: 'Integrations',
      items: [
        { icon: '🔌', label: 'Integrations', description: 'Connect Slack, Zapier, and other third-party apps', href: '/workspace/demo/settings/integrations', permission: canManageIntegrations },
        { icon: '🌐', label: 'Webhooks', description: 'Configure webhooks for real-time event notifications', href: '/workspace/demo/settings/webhooks', permission: canManageIntegrations },
        { icon: '🔑', label: 'API Access', description: 'Generate API keys for external integrations', href: '/workspace/demo/settings/api-access', permission: canManageOrganization },
      ]
    },
    {
      title: 'Advanced',
      items: [
        { icon: '📋', label: 'Schema Editor', description: 'Create and manage custom entities and fields', href: '/workspace/demo/schemas', permission: canManageOrganization },
        { icon: '📊', label: 'Data & Import', description: 'Import/export data, manage schemas', href: '/import', permission: true },
        { icon: '⚙️', label: 'Workflows', description: 'Automation rules and workflow configuration', href: '/workspace/demo/settings/workflows', permission: canManageOrganization },
        { icon: '🤖', label: 'AI Agents', description: 'Configure and train AI assistants', href: '/workspace/demo/settings/ai-agents', permission: canManageOrganization },
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
              href="/dashboard"
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
              <span style={{ fontSize: '1.25rem' }}>📊</span>
              {sidebarOpen && <span>Dashboard</span>}
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
              <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', marginBottom: '1.5rem' }}>
                {logoUrl ? (
                  <img src={logoUrl} alt={brandName} style={{ maxHeight: '40px', maxWidth: '150px', objectFit: 'contain' }} />
                ) : (
                  <>
                    <span style={{ fontSize: '1.5rem' }}>🚀</span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#fff' }}>{brandName}</span>
                  </>
                )}
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
                  <Link href="/workspace/demo/settings/organization" style={{ padding: '0.625rem 1.25rem', backgroundColor: '#222', color: '#fff', borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500', border: '1px solid #333' }}>
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

// Import React at top
import React from 'react';

