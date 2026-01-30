'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { logger } from '@/lib/logger/logger';
import {
  Shield,
  ArrowLeft,
  Building2,
  Users,
  CreditCard,
  Palette,
  Lock,
  Plug,
  Webhook,
  Wrench,
  FileText,
  BarChart3,
  Zap,
  AlertTriangle,
  ExternalLink,
  Eye
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { Organization } from '@/types/organization';

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

interface SettingsItem {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  description: string;
  href: string;
  category: 'view' | 'manage';
  dangerLevel?: 'safe' | 'caution' | 'danger';
}

/**
 * Admin Support View: Organization Settings
 *
 * This page allows platform admins to view and manage settings
 * for any tenant organization without leaving the admin context.
 * Jasper and UnifiedSidebar remain mounted throughout navigation.
 */
export default function AdminOrgSettingsPage() {
  const { hasPermission } = useAdminAuth();
  const params = useParams();
  const orgId = params.id as string;

  // Organization data for header context
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  // God Mode permission check
  const canManageAllOrganizations = hasPermission('canEditOrganizations');

  // Admin theme colors
  const primaryColor = '#6366f1';
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  // Load organization details for context header
  useEffect(() => {
    async function loadOrganization() {
      try {
        setLoading(true);
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const org = await FirestoreService.get<Organization>(COLLECTIONS.ORGANIZATIONS, orgId);
        setOrganization(org);
      } catch (error) {
        logger.error('Failed to load organization:', error instanceof Error ? error : new Error(String(error)), { file: 'admin/organizations/[id]/settings/page.tsx' });
      } finally {
        setLoading(false);
      }
    }
    void loadOrganization();
  }, [orgId]);

  // Settings sections available to admin support view
  // Uses workspace routes with explicit read-only indication where appropriate
  const settingsSections: SettingsSection[] = [
    {
      title: 'Organization',
      items: [
        {
          icon: Building2,
          iconColor: '#6366f1',
          label: 'Organization Details',
          description: 'View company info, contact details, and business settings',
          href: `/admin/organizations/${orgId}/edit`,
          category: 'manage',
          dangerLevel: 'safe'
        },
        {
          icon: Users,
          iconColor: '#8b5cf6',
          label: 'Team Members',
          description: 'View users, roles, and access permissions for this organization',
          href: `/workspace/${orgId}/settings/users`,
          category: 'view',
          dangerLevel: 'caution'
        },
      ]
    },
    {
      title: 'Billing & Subscriptions',
      items: [
        {
          icon: CreditCard,
          iconColor: '#10b981',
          label: 'Billing & Plans',
          description: 'View subscription status, usage metrics, and payment history',
          href: `/workspace/${orgId}/settings/billing`,
          category: 'view',
          dangerLevel: 'safe'
        },
        {
          icon: BarChart3,
          iconColor: '#3b82f6',
          label: 'Usage Analytics',
          description: 'View API usage, storage consumption, and quota utilization',
          href: `/workspace/${orgId}/analytics`,
          category: 'view',
          dangerLevel: 'safe'
        },
      ]
    },
    {
      title: 'Customization',
      items: [
        {
          icon: Palette,
          iconColor: '#f59e0b',
          label: 'Theme & Branding',
          description: 'View white-label settings, logo, and color configuration',
          href: `/workspace/${orgId}/settings/theme`,
          category: 'view',
          dangerLevel: 'safe'
        },
        {
          icon: FileText,
          iconColor: '#ec4899',
          label: 'Email Templates',
          description: 'View customized email notifications and branding',
          href: `/workspace/${orgId}/settings/email-templates`,
          category: 'view',
          dangerLevel: 'safe'
        },
      ]
    },
    {
      title: 'Security & Access',
      items: [
        {
          icon: Lock,
          iconColor: '#ef4444',
          label: 'Security Settings',
          description: 'View 2FA status, IP restrictions, and audit logs',
          href: `/workspace/${orgId}/settings/security`,
          category: 'view',
          dangerLevel: 'caution'
        },
        {
          icon: Zap,
          iconColor: '#f97316',
          label: 'API Keys',
          description: 'View configured service keys and API credentials',
          href: `/workspace/${orgId}/settings/api-keys`,
          category: 'view',
          dangerLevel: 'danger'
        },
      ]
    },
    {
      title: 'Integrations',
      items: [
        {
          icon: Plug,
          iconColor: '#22c55e',
          label: 'Connected Integrations',
          description: 'Manage third-party service connections and OAuth apps',
          href: `/admin/organizations/${orgId}/integrations`,
          category: 'manage',
          dangerLevel: 'caution'
        },
        {
          icon: Webhook,
          iconColor: '#0ea5e9',
          label: 'Webhooks',
          description: 'View configured webhook endpoints and event subscriptions',
          href: `/workspace/${orgId}/settings/webhooks`,
          category: 'view',
          dangerLevel: 'caution'
        },
        {
          icon: Wrench,
          iconColor: '#a855f7',
          label: 'Custom Tools',
          description: 'View sandboxed iframe applications and external tools',
          href: `/workspace/${orgId}/settings/custom-tools`,
          category: 'view',
          dangerLevel: 'safe'
        },
      ]
    },
  ];

  const getDangerBadge = (level: string) => {
    switch (level) {
      case 'danger':
        return {
          text: 'Sensitive',
          bg: '#ef444420',
          border: '#ef444440',
          color: '#f87171'
        };
      case 'caution':
        return {
          text: 'Caution',
          bg: '#f59e0b20',
          border: '#f59e0b40',
          color: '#fbbf24'
        };
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>
          Loading organization settings...
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Organization Not Found
          </h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            The organization you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/admin/organizations"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: primaryColor,
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '0.5rem',
              fontWeight: '500'
            }}
          >
            Back to Organizations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Back Navigation */}
        <Link
          href={`/admin/organizations/${orgId}`}
          style={{
            color: '#666',
            textDecoration: 'none',
            fontSize: '0.875rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem'
          }}
        >
          <ArrowLeft style={{ width: '16px', height: '16px' }} />
          Back to Organization
        </Link>

        {/* God Mode Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: '#1a1a2e',
            border: `1px solid ${primaryColor}40`,
            borderRadius: '0.75rem',
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.5rem',
              backgroundColor: `${primaryColor}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Shield style={{ width: '20px', height: '20px', color: primaryColor }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>
              Admin Support View
            </div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>
              Managing settings for: {organization.name}
            </div>
          </div>
          {canManageAllOrganizations && (
            <div style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: '#10b98120',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              color: '#10b981',
              fontWeight: '600'
            }}>
              Full Access
            </div>
          )}
        </motion.div>

        {/* Warning Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            backgroundColor: '#f59e0b10',
            border: '1px solid #f59e0b30',
            borderRadius: '0.75rem',
            padding: '1rem 1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem'
          }}
        >
          <AlertTriangle style={{ width: '20px', height: '20px', color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fbbf24', marginBottom: '0.25rem' }}>
              Support Mode Active
            </div>
            <div style={{ fontSize: '0.75rem', color: '#d4a574', lineHeight: 1.5 }}>
              Some links navigate to workspace views where you can inspect tenant data. Actions taken may be logged in the organization&apos;s audit trail.
            </div>
          </div>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '2rem' }}
        >
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
            Organization Settings
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            View and manage configuration for {organization.name}
          </p>
        </motion.div>

        {/* Organization Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '0.75rem',
                backgroundColor: primaryColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem'
              }}
            >
              <Building2 style={{ width: '32px', height: '32px', color: '#fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
                {organization.name}
              </h2>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>
                {organization.slug} • <span style={{ textTransform: 'capitalize', color: primaryColor, fontWeight: '600' }}>{organization.plan}</span> Plan
              </p>
            </div>
            <Link
              href={`/admin/organizations/${orgId}/edit`}
              style={{
                padding: '0.625rem 1.25rem',
                backgroundColor: '#222',
                color: '#fff',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: '500',
                border: '1px solid #333'
              }}
            >
              Edit Details
            </Link>
          </div>
        </motion.div>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIdx) => (
          <motion.div
            key={sectionIdx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + sectionIdx * 0.05 }}
            style={{ marginBottom: '2rem' }}
          >
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#666',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '1rem'
              }}
            >
              {section.title}
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '1rem'
              }}
            >
              {section.items.map((item, itemIdx) => {
                const Icon = item.icon;
                const dangerBadge = getDangerBadge(item.dangerLevel ?? 'safe');
                const isExternal = item.href.startsWith('/workspace/');

                return (
                  <Link
                    key={itemIdx}
                    href={item.href}
                    style={{
                      display: 'flex',
                      gap: '1rem',
                      padding: '1.5rem',
                      backgroundColor: bgPaper,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '0.75rem',
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = item.iconColor;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = borderColor;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '0.75rem',
                        backgroundColor: `${item.iconColor}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Icon style={{ width: '24px', height: '24px', color: item.iconColor }} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>
                          {item.label}
                        </div>
                        {dangerBadge && (
                          <span
                            style={{
                              padding: '0.125rem 0.5rem',
                              backgroundColor: dangerBadge.bg,
                              border: `1px solid ${dangerBadge.border}`,
                              borderRadius: '9999px',
                              fontSize: '0.625rem',
                              color: dangerBadge.color,
                              fontWeight: '600',
                              textTransform: 'uppercase'
                            }}
                          >
                            {dangerBadge.text}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#999', lineHeight: '1.4' }}>
                        {item.description}
                      </div>
                    </div>

                    {/* Action Indicator */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                      {item.category === 'view' ? (
                        <Eye style={{ width: '16px', height: '16px', color: '#666' }} />
                      ) : (
                        <span style={{ color: '#666', fontSize: '1.25rem' }}>→</span>
                      )}
                      {isExternal && (
                        <ExternalLink style={{ width: '12px', height: '12px', color: '#666' }} />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        ))}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '1rem',
            padding: '1.5rem',
            marginTop: '2rem'
          }}
        >
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '1rem'
            }}
          >
            Quick Actions
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <Link
              href={`/admin/organizations/${orgId}/edit`}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#222',
                color: '#fff',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: '500',
                border: '1px solid #333',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Building2 style={{ width: '14px', height: '14px' }} />
              Edit Organization
            </Link>
            <Link
              href={`/admin/organizations/${orgId}/integrations`}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#222',
                color: '#fff',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: '500',
                border: '1px solid #333',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Plug style={{ width: '14px', height: '14px' }} />
              Manage Integrations
            </Link>
            <Link
              href={`/admin/organizations/${orgId}`}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#222',
                color: '#fff',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: '500',
                border: '1px solid #333',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <BarChart3 style={{ width: '14px', height: '14px' }} />
              View Overview
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
