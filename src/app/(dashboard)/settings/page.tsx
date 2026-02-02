'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import React from 'react';
import Link from 'next/link';
import { useAuth, usePermission } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';

export default function SettingsPage() {
  const { user } = useAuth();
  const _orgId = DEFAULT_ORG_ID;
  const { theme } = useOrgTheme();
  
  const canManageAPIKeys = usePermission('canManageAPIKeys');
  const canManageTheme = usePermission('canManageTheme');
  const canManageOrganization = usePermission('canManageOrganization');
  const canViewAllUsers = usePermission('canViewAllUsers');
  const canManageBilling = usePermission('canManageBilling');
  const canManageIntegrations = usePermission('canManageIntegrations');

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  const settingsSections = [
    {
      title: 'Core Configuration',
      items: [
        { icon: '🔑', label: 'API Keys', description: 'Configure Firebase, AI, payment, and email services', href: `/settings/api-keys`, permission: canManageAPIKeys },
        { icon: '💳', label: 'Billing & Plans', description: 'Manage subscription, usage, and billing', href: `/settings/billing`, permission: canManageBilling },
      ]
    },
    {
      title: 'E-Commerce',
      items: [
        { icon: '🛒', label: 'Online Storefront', description: 'Enable store, choose products/services/both, customize theme, generate embed codes', href: `/settings/storefront`, permission: canManageOrganization },
        { icon: '🏷️', label: 'Promotions & Coupons', description: 'Create discount codes, manage AI-authorized offers, and track coupon performance', href: `/settings/promotions`, permission: canManageOrganization },
      ]
    },
    {
      title: 'Email & SMS',
      items: [
        { icon: '📧', label: 'Email Templates', description: 'Customize email notifications and branding', href: `/settings/email-templates`, permission: canManageTheme },
        { icon: '📱', label: 'SMS Messages', description: 'Configure automated text messages with custom triggers', href: `/settings/sms-messages`, permission: canManageTheme },
      ]
    },
    {
      title: 'Customization',
      items: [
        { icon: '🎨', label: 'CRM Theme & Branding', description: 'White-label your CRM platform with custom colors and logo', href: `/settings/theme`, permission: canManageTheme },
      ]
    },
    {
      title: 'Users & Access',
      items: [
        { icon: '👥', label: 'Team Members', description: 'Invite users, manage roles and permissions', href: `/settings/users`, permission: canViewAllUsers },
        { icon: '🔐', label: 'Security', description: 'Two-factor auth, IP restrictions, audit logs', href: `/settings/security`, permission: canManageOrganization },
      ]
    },
    {
      title: 'Integrations',
      items: [
        { icon: '📊', label: 'Accounting Software', description: 'Sync invoices, payments, and customers to QuickBooks, Xero, FreshBooks, Wave', href: `/settings/accounting`, permission: canManageIntegrations },
        { icon: '🔌', label: 'Business Apps', description: 'Connect Slack, Zapier, and other third-party apps', href: `/settings/integrations`, permission: canManageIntegrations },
        { icon: '🌐', label: 'Webhooks', description: 'Configure webhooks for real-time event notifications', href: `/settings/webhooks`, permission: canManageIntegrations },
        { icon: '🔧', label: 'Custom Tools', description: 'Add external apps and tools as sandboxed iframes in your workspace', href: `/settings/custom-tools`, permission: canManageOrganization },
      ]
    },
    {
      title: 'Analytics & Reporting',
      items: [
        { icon: '📈', label: 'Analytics Dashboard', description: 'Revenue reports, pipeline analysis, forecasting, and win/loss', href: `/analytics`, permission: canManageOrganization },
      ]
    },
    {
      title: 'Outbound Sales',
      items: [
        { icon: '🚀', label: 'Subscription & Features', description: 'Manage plan, outbound features, and usage limits', href: `/settings/subscription`, permission: canManageBilling },
      ]
    },
    {
      title: 'Advanced',
      items: [
        { icon: '📋', label: 'Schema Editor', description: 'Create and manage custom entities and fields', href: `/schemas`, permission: canManageOrganization },
        { icon: '⚙️', label: 'Workflows', description: 'Automation rules and workflow configuration', href: `/settings/workflows`, permission: canManageOrganization },
        { icon: '🤖', label: 'AI Agents', description: 'Configure and train AI assistants', href: `/settings/ai-agents`, permission: canManageOrganization },
      ]
    }
  ];

  return (
    <div style={{ padding: '2rem', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
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
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>Your Organization</h2>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>
                {user?.email} • {user?.role && <span style={{ textTransform: 'capitalize', color: primaryColor, fontWeight: '600' }}>{user.role}</span>}
              </p>
            </div>
            {canManageOrganization && (
              <Link href={`/settings/organization`} style={{ padding: '0.625rem 1.25rem', backgroundColor: '#222', color: '#fff', borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500', border: '1px solid #333' }}>
                Edit Details
              </Link>
            )}
          </div>
        </div>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIdx) => {
          const visibleItems = section.items.filter(item => item.permission);
          if (visibleItems.length === 0) {return null;}

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
  );
}
