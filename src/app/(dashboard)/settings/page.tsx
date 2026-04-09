'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth, usePermission } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { Sliders } from 'lucide-react';
import { FEATURE_MODULES } from '@/lib/constants/feature-modules';
import { MODULE_ID_TO_SLUG, MODULE_EMOJI } from '@/lib/constants/module-settings';
import { PageTitle, SectionDescription } from '@/components/ui/typography';

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme } = useOrgTheme();

  const canManageAPIKeys = usePermission('canManageAPIKeys');
  const canManageTheme = usePermission('canManageTheme');
  const canManageOrganization = usePermission('canManageOrganization');
  const canViewAllUsers = usePermission('canViewAllUsers');
  const canManageBilling = usePermission('canManageBilling');
  const canManageIntegrations = usePermission('canManageIntegrations');
  const canAssignRecords = usePermission('canAssignRecords');

  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';

  // Build feature module cards — storefront links to its dedicated config page,
  // all others link to /settings/module/{slug}
  const featureModuleCards = FEATURE_MODULES.map((mod) => {
    const slug = MODULE_ID_TO_SLUG[mod.id];
    const href =
      mod.id === 'storefront'
        ? '/settings/storefront'
        : `/settings/module/${slug}`;
    return {
      icon: MODULE_EMOJI[mod.id],
      label: mod.label,
      description: mod.description,
      href,
      permission: canManageOrganization,
    };
  });

  const settingsSections = [
    {
      title: 'Core Configuration',
      items: [
        { icon: '🏢', label: 'Organization Profile', description: 'Company name, address, phone, website, industry, and social media', href: `/settings/organization`, permission: canManageOrganization },
        { icon: '🔑', label: 'API Keys', description: 'Configure Firebase, AI, payment, and email services', href: `/settings/api-keys`, permission: canManageAPIKeys },
        { icon: '💳', label: 'Billing & Plans', description: 'Manage subscription, usage, billing, and outbound feature limits', href: `/settings/billing`, permission: canManageBilling },
        { icon: '🎛️', label: 'Feature Toggles', description: 'Enable or disable platform modules for your organization', href: `/settings/features`, permission: canManageOrganization },
        { icon: '📅', label: 'Meeting Scheduler', description: 'Configure automated meeting booking with round-robin assignment and Zoom integration', href: `/settings/meeting-scheduler`, permission: canManageOrganization },
      ]
    },
    {
      title: 'Feature Modules',
      items: featureModuleCards,
    },
    {
      title: 'E-Commerce',
      items: [
        { icon: '🏷️', label: 'Promotions & Coupons', description: 'Create discount codes, manage AI-authorized offers, and track coupon performance', href: `/coupons`, permission: canManageOrganization },
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
        { icon: '🧬', label: 'Brand DNA', description: 'Define your brand identity for AI-powered email, social, and content generation', href: `/settings/brand-dna`, permission: canManageTheme },
        { icon: '🎬', label: 'Brand Kit', description: 'Logo watermark, brand colors, caption typography, and intro/outro for video', href: `/settings/brand-kit`, permission: canManageTheme },
        { icon: '🎵', label: 'Music Library', description: 'Upload and manage royalty-free background music tracks for video production', href: `/settings/music-library`, permission: canManageOrganization },
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
      title: 'Compliance & Admin',
      items: [
        { icon: '🛡️', label: 'Compliance Reports', description: 'Run audits, view compliance scores, and track regulatory adherence', href: `/compliance-reports`, permission: canManageOrganization },
        { icon: '📜', label: 'Audit Log', description: 'View system-wide audit trail of all user and system actions', href: `/website/audit-log`, permission: canManageOrganization },
        { icon: '🔀', label: 'Lead Routing', description: 'Configure automatic lead assignment rules and round-robin routing', href: `/settings/lead-routing`, permission: canAssignRecords },
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
      title: 'Advanced',
      items: [
        { icon: '📋', label: 'Schema Editor', description: 'Create and manage custom entities and fields', href: `/schemas`, permission: canManageOrganization },
      ]
    }
  ];

  return (
    <div className="p-8 space-y-6 overflow-y-auto">
      {/* Header */}
      <div>
        <PageTitle>Settings</PageTitle>
        <SectionDescription className="mt-1">
          Manage your organization, users, integrations, and platform configuration
        </SectionDescription>
      </div>

      {/* Organization Info Card */}
      <div className="bg-surface-elevated border border-border rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div
            className="w-15 h-15 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ width: '60px', height: '60px', backgroundColor: primaryColor }}
          >
            🏢
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground mb-1">Your Organization</h2>
            <p className="text-muted-foreground text-sm">
              {user?.email} • {user?.role && <span className="capitalize font-semibold" style={{ color: primaryColor }}>{user.role}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Features & Modules Card (admin/owner only) */}
      {(user?.role === 'admin' || user?.role === 'owner') && (
        <Link
          href="/settings/features"
          className="flex gap-4 p-6 bg-surface-elevated border-2 border-primary rounded-xl no-underline transition-all duration-200 hover:-translate-y-0.5 block"
        >
          <div
            className="w-15 h-15 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ width: '60px', height: '60px', background: 'var(--gradient-brand, var(--color-primary))' }}
          >
            <Sliders className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold text-foreground mb-1">
              Features &amp; Modules
            </div>
            <div className="text-sm text-muted-foreground leading-snug">
              Choose which features to enable, set up your API keys, and configure your workspace.
            </div>
          </div>
          <div className="text-primary text-xl flex items-center">→</div>
        </Link>
      )}

      {/* Settings Sections */}
      {settingsSections.map((section, sectionIdx) => {
        const visibleItems = section.items.filter(item => item.permission);
        if (visibleItems.length === 0) {return null;}

        return (
          <div key={sectionIdx}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              {section.title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleItems.map((item, itemIdx) => (
                <Link
                  key={itemIdx}
                  href={item.href}
                  className="flex gap-4 p-6 bg-surface-elevated border border-border rounded-xl no-underline transition-all duration-200 hover:-translate-y-0.5"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = primaryColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '';
                  }}
                >
                  <div className="text-4xl">{item.icon}</div>
                  <div className="flex-1">
                    <div className="text-base font-semibold text-foreground mb-1">{item.label}</div>
                    <div className="text-sm text-muted-foreground leading-snug">{item.description}</div>
                  </div>
                  <div className="text-muted-foreground text-xl">→</div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
