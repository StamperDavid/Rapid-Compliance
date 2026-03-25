'use client';

/**
 * Admin Sidebar Component
 * SalesVelocity.ai - Penthouse Admin Navigation
 *
 * Consolidated 8-section sidebar (down from 13). Sub-pages are accessed
 * via tab navigation within parent pages. Settings and Academy are in
 * the sidebar footer. Role-based filtering via unified-rbac types.
 */

import React, { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { useFeatureModules } from '@/hooks/useFeatureModules';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useEntityConfig } from '@/hooks/useEntityConfig';
import {
  type NavigationSection,
  type NavigationItem,
  filterNavigationByRole,
} from '@/types/unified-rbac';
import {
  LayoutDashboard,
  Users,
  Handshake,
  MessageSquare,
  Send,
  ListOrdered,
  FileText,
  Mail,
  Megaphone,
  FlaskConical,
  Video,
  Bot,
  PhoneCall,
  Workflow,
  Activity,
  Globe,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  ClipboardList,
  Package,
  PieChart,
  HelpCircle,
  PenLine,
  Plug,
  Shield,
  Building2,
  TrendingUp,
  // Catalog icons
  ShoppingCart,
  Tag,
  Repeat,
  // Entity page icons
  ScrollText,
  CheckSquare,
  Clock,
  MailOpen,
  Receipt,
  CreditCard,
  LayoutTemplate,
  BookOpen,
  Link2,
  Radar,
  Rocket,
} from 'lucide-react';

// ============================================================================
// NAVIGATION CONFIG — role-gated via unified-rbac types
// ============================================================================

const NAV_SECTIONS: NavigationSection[] = [
  // ── Dashboard (standalone — no section header) ─────────────────────
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    allowedRoles: ['owner', 'admin', 'manager', 'member'],
    standalone: true,
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, iconColor: 'var(--color-primary)' },
    ],
  },
  // ── CRM (5 items) ──────────────────────────────────────────────────
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    allowedRoles: ['owner', 'admin', 'manager', 'member'],
    items: [
      { id: 'leads', label: 'Leads', href: '/leads', icon: Users, iconColor: 'var(--color-primary)', requiredPermission: 'canViewLeads', featureModuleId: 'crm_pipeline' },
      { id: 'contacts', label: 'Contacts', href: '/contacts', icon: Users, iconColor: 'var(--color-info)', requiredPermission: 'canViewLeads', featureModuleId: 'crm_pipeline' },
      { id: 'companies', label: 'Companies', href: '/entities/companies', icon: Building2, iconColor: 'var(--color-secondary)', requiredPermission: 'canViewLeads', featureModuleId: 'crm_pipeline' },
      { id: 'deals', label: 'Deals', href: '/deals', icon: Handshake, iconColor: 'var(--color-warning)', requiredPermission: 'canViewDeals', featureModuleId: 'crm_pipeline' },
      { id: 'conversations', label: 'Conversations', href: '/conversations', icon: MessageSquare, iconColor: 'var(--color-success)', requiredPermission: 'canCreateRecords', featureModuleId: 'conversations' },
      { id: 'quotes', label: 'Quotes', href: '/entities/quotes', icon: ScrollText, iconColor: 'var(--color-info)', featureModuleId: 'crm_pipeline', entityId: 'quotes' },
      { id: 'invoices', label: 'Invoices', href: '/entities/invoices', icon: Receipt, iconColor: 'var(--color-info)', featureModuleId: 'crm_pipeline', entityId: 'invoices' },
      { id: 'payments', label: 'Payments', href: '/entities/payments', icon: CreditCard, iconColor: 'var(--color-success)', featureModuleId: 'crm_pipeline', entityId: 'payments' },
      { id: 'tasks', label: 'Tasks', href: '/entities/tasks', icon: CheckSquare, iconColor: 'var(--color-warning)' },
      { id: 'activities', label: 'Activities', href: '/entities/activities', icon: Clock, iconColor: 'var(--color-secondary)', featureModuleId: 'crm_pipeline' },
      { id: 'proposals', label: 'Proposals', href: '/proposals', icon: FileText, iconColor: 'var(--color-secondary)', featureModuleId: 'proposals_docs' },
      { id: 'intelligence-hub', label: 'Intelligence Hub', href: '/intelligence/discovery', icon: Radar, iconColor: 'var(--color-cyan)', requiredPermission: 'canManageLeads' },
    ],
  },
  // ── Outreach (4 items — Forms & Workflows moved to Marketing) ──────
  {
    id: 'outreach',
    label: 'Outreach',
    icon: Send,
    allowedRoles: ['owner', 'admin', 'manager'],
    items: [
      { id: 'sequences', label: 'Sequences', href: '/outbound/sequences', icon: ListOrdered, iconColor: 'var(--color-secondary)', requiredPermission: 'canManageLeads', featureModuleId: 'email_outreach' },
      { id: 'email-campaigns', label: 'Campaigns', href: '/email/campaigns', icon: Mail, iconColor: 'var(--color-cyan)', requiredPermission: 'canManageEmailCampaigns', featureModuleId: 'email_outreach' },
      { id: 'email-studio', label: 'Email Studio', href: '/email-writer', icon: PenLine, iconColor: 'var(--color-primary)', requiredPermission: 'canManageEmailCampaigns', featureModuleId: 'email_outreach' },
      { id: 'calls', label: 'Calls', href: '/calls', icon: PhoneCall, iconColor: 'var(--color-error)', requiredPermission: 'canAccessVoiceAgents', featureModuleId: 'email_outreach' },
      { id: 'email-templates', label: 'Email Templates', href: '/entities/email_templates', icon: MailOpen, iconColor: 'var(--color-info)', featureModuleId: 'email_outreach' },
    ],
  },
  // ── Marketing (5 items — renamed from Content) ─────────────────────
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    allowedRoles: ['owner', 'admin', 'manager'],
    items: [
      { id: 'campaigns', label: 'Campaigns', href: '/campaigns', icon: Rocket, iconColor: 'var(--color-accent)' },
      { id: 'social-hub', label: 'Social Hub', href: '/social/command-center', icon: Activity, iconColor: 'var(--color-success)', requiredPermission: 'canManageSocialMedia', featureModuleId: 'social_media' },
      { id: 'video', label: 'Content Generator', href: '/content/video', icon: Video, iconColor: 'var(--color-primary)', requiredPermission: 'canManageSocialMedia', featureModuleId: 'video_production' },
      { id: 'forms', label: 'Forms', href: '/forms', icon: ClipboardList, iconColor: 'var(--color-success)', featureModuleId: 'forms_surveys' },
      { id: 'workflows', label: 'Workflows', href: '/workflows', icon: Workflow, iconColor: 'var(--color-warning)', requiredPermission: 'canCreateWorkflows', featureModuleId: 'workflows' },
    ],
  },
  // ── Catalog (products, services, orders, coupons, subscriptions) ────
  {
    id: 'catalog',
    label: 'Catalog',
    icon: Package,
    allowedRoles: ['owner', 'admin', 'manager', 'member'],
    items: [
      { id: 'products', label: 'Products', href: '/products', icon: Package, iconColor: 'var(--color-primary)', requiredPermission: 'canManageProducts' },
      { id: 'services', label: 'Services', href: '/products/services', icon: Package, iconColor: 'var(--color-secondary)' },
      { id: 'orders', label: 'Orders', href: '/orders', icon: ShoppingCart, iconColor: 'var(--color-warning)', requiredPermission: 'canProcessOrders' },
      { id: 'coupons', label: 'Coupons', href: '/entities/coupons', icon: Tag, iconColor: 'var(--color-accent)' },
      { id: 'subscriptions', label: 'Subscriptions', href: '/entities/subscriptions', icon: Repeat, iconColor: 'var(--color-cyan)' },
    ],
  },
  // ── Website (storefront is now a page type within the builder, accessed via Store tab) ─
  {
    id: 'website',
    label: 'Website',
    icon: Globe,
    allowedRoles: ['owner', 'admin', 'manager'],
    items: [
      { id: 'website', label: 'Website', href: '/website/editor', icon: Globe, iconColor: 'var(--color-primary)', requiredPermission: 'canManageWebsite', featureModuleId: 'website_builder' },
      { id: 'pages', label: 'Pages', href: '/entities/pages', icon: LayoutTemplate, iconColor: 'var(--color-info)', featureModuleId: 'website_builder' },
      { id: 'blog-posts', label: 'Blog Posts', href: '/entities/blog_posts', icon: BookOpen, iconColor: 'var(--color-secondary)', featureModuleId: 'website_builder' },
      { id: 'domains', label: 'Domains', href: '/entities/domains', icon: Link2, iconColor: 'var(--color-cyan)', featureModuleId: 'website_builder' },
    ],
  },
  // ── AI Workforce (1 hub item — 5 items collapsed) ─────────────────
  {
    id: 'ai_workforce',
    label: 'AI Workforce',
    icon: Bot,
    allowedRoles: ['owner', 'admin', 'manager'],
    items: [
      { id: 'ai-workforce', label: 'AI Workforce', href: '/workforce', icon: Bot, iconColor: 'var(--color-cyan)', requiredPermission: 'canDeployAIAgents' },
    ],
  },
  // ── Analytics & Growth (3 items — Growth collapsed to 1 hub) ───────
  {
    id: 'analytics',
    label: 'Analytics & Growth',
    icon: PieChart,
    allowedRoles: ['owner', 'admin', 'manager', 'member'],
    items: [
      { id: 'analytics-overview', label: 'Overview', href: '/analytics', icon: PieChart, iconColor: 'var(--color-cyan)', requiredPermission: 'canViewReports' },
      { id: 'growth', label: 'Growth', href: '/growth/command-center', icon: TrendingUp, iconColor: 'var(--color-success)', requiredPermission: 'canViewReports' },
      { id: 'ab-testing', label: 'A/B Testing', href: '/ab-tests', icon: FlaskConical, iconColor: 'var(--color-success)', featureModuleId: 'advanced_analytics' },
    ],
  },
  // ── System (1 hub item — owner only) ───────────────────────────────
  {
    id: 'system',
    label: 'System',
    icon: Shield,
    allowedRoles: ['owner'],
    items: [
      { id: 'system', label: 'System', href: '/system', icon: Shield, iconColor: 'var(--color-primary)' },
    ],
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 64;

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useUnifiedAuth();
  const { isModuleEnabled } = useFeatureModules();
  const { isEntityEnabled } = useEntityConfig();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Filter navigation: role-based → feature-based → remove empty sections
  const filteredSections = useMemo(() => {
    if (!user?.role) {
      return [];
    }
    const roleSections = filterNavigationByRole(NAV_SECTIONS, user.role);

    // Apply feature module + entity config filtering
    return roleSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item: NavigationItem) => {
          // Feature module gate
          if (item.featureModuleId && !isModuleEnabled(item.featureModuleId)) { return false; }
          // Entity config gate
          if (item.entityId && !isEntityEnabled(item.entityId)) { return false; }
          return true;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [user?.role, isModuleEnabled, isEntityEnabled]);

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const handleMobileToggle = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      // If the key has been explicitly set before, simply invert it.
      if (sectionId in prev) {
        return { ...prev, [sectionId]: !prev[sectionId] };
      }
      // First click on a section that was never toggled — it's currently
      // in its default state (collapsed unless it has an active item).
      // Force it to the opposite: expanded (false = not collapsed).
      return { ...prev, [sectionId]: false };
    });
  }, []);

  const isActive = (href: string): boolean => {
    if (!pathname) { return false; }

    // Dashboard hub — dashboard + all tab destinations (executive briefing, workforce, team)
    if (href === '/dashboard') {
      return pathname === '/dashboard' ||
        pathname.startsWith('/executive-briefing') ||
        pathname.startsWith('/workforce') ||
        pathname.startsWith('/team/') ||
        pathname.startsWith('/performance') ||
        pathname.startsWith('/coaching') ||
        pathname === '/playbook';
    }

    // Catalog hub — products + all tab destinations (services, orders, coupons, subscriptions)
    if (href === '/products') {
      return pathname === '/products' ||
        pathname.startsWith('/products/') ||
        pathname.startsWith('/orders') ||
        pathname.startsWith('/entities/coupons') ||
        pathname.startsWith('/entities/subscriptions');
    }

    // Leads hub — leads list, intelligence, scoring, scraper
    if (href === '/leads') {
      return pathname === '/leads' ||
        pathname.startsWith('/leads/') ||
        pathname.startsWith('/lead-scoring') ||
        pathname.startsWith('/scraper') ||
        pathname.startsWith('/entities/leads');
    }

    // Contacts
    if (href === '/contacts') { return pathname.startsWith('/contacts'); }

    // Companies
    if (href === '/entities/companies') { return pathname.startsWith('/entities/companies'); }

    // Deals hub — deals list + risk
    if (href === '/deals') {
      return pathname.startsWith('/deals') || pathname.startsWith('/risk');
    }

    // Email Studio — email writer + nurture + email builder + templates
    if (href === '/email-writer') {
      return pathname.startsWith('/email-writer') ||
        pathname.startsWith('/nurture') ||
        pathname.startsWith('/marketing/email-builder') ||
        pathname === '/templates';
    }

    // Social Hub — all /social/* (analytics now absorbed as tab)
    if (href === '/social/command-center') {
      return pathname.startsWith('/social/') && !pathname.startsWith('/social/training');
    }

    // Content Generator hub — video, image, editor, library, voice lab
    if (href === '/content/video') {
      return pathname.startsWith('/content/');
    }

    // Proposals hub — list + builder
    if (href === '/proposals') { return pathname.startsWith('/proposals'); }

    // Website hub — all /website/* (SEO absorbed as tab)
    if (href === '/website/editor') {
      return pathname.startsWith('/website/');
    }

    // AI Workforce hub — workforce, mission control, training, models
    if (href === '/workforce') {
      return pathname.startsWith('/workforce') ||
        pathname.startsWith('/mission-control') ||
        pathname.startsWith('/settings/ai-agents/') ||
        pathname.startsWith('/voice/training') ||
        pathname.startsWith('/social/training') ||
        pathname.startsWith('/seo/training') ||
        pathname.startsWith('/ai/') ||
        pathname === '/ai-agents';
    }

    // Analytics overview — all analytics sub-pages
    if (href === '/analytics') {
      return pathname === '/analytics' ||
        pathname.startsWith('/analytics/') ||
        pathname.startsWith('/sequences/analytics') ||
        pathname.startsWith('/compliance-reports') ||
        pathname.startsWith('/battlecards');
    }

    // Growth hub — all /growth/*
    if (href === '/growth/command-center') {
      return pathname.startsWith('/growth/');
    }

    // System hub — system health, impersonate, schemas
    if (href === '/system') {
      return pathname === '/system' ||
        pathname.startsWith('/system/') ||
        pathname === '/schemas';
    }

    return pathname.startsWith(href);
  };

  const currentWidth = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-surface-paper z-40 md:hidden"
          onClick={handleMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-50 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
        style={{
          width: currentWidth,
          backgroundColor: 'var(--color-bg-paper)',
          borderRight: '1px solid var(--color-border-light)',
        }}
      >
        {/* Header / Branding */}
        <div
          style={{
            padding: isCollapsed ? '1.25rem 0.75rem' : '1.5rem 1.25rem',
            borderBottom: '1px solid var(--color-border-light)',
            backgroundColor: 'var(--color-bg-elevated)',
          }}
        >
          {!isCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '0.5rem',
                  background: 'var(--gradient-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontSize: '0.875rem',
                  flexShrink: 0,
                }}
              >
                RC
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  SalesVelocity.ai
                </div>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--color-primary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Command Center
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '0.5rem',
                background: 'var(--gradient-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                fontSize: '0.875rem',
                margin: '0 auto',
              }}
            >
              RC
            </div>
          )}

          {/* Collapse Toggle (desktop) */}
          <button
            type="button"
            className="hidden md:flex"
            onClick={handleToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '0.75rem',
              width: 28,
              height: 28,
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border-light)',
              backgroundColor: 'var(--color-bg-elevated)',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-disabled)',
            }}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>

          {/* Mobile Close */}
          <button
            type="button"
            className="md:hidden"
            onClick={handleMobileClose}
            aria-label="Close sidebar"
            style={{
              position: 'absolute',
              top: '1rem',
              right: '0.75rem',
              width: 28,
              height: 28,
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border-light)',
              backgroundColor: 'var(--color-bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-disabled)',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav
          aria-label="Main navigation"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.5rem 0',
          }}
        >
          {filteredSections.map((section) => {
            const activeItem = section.items.find((item: NavigationItem) => isActive(item.href));
            const hasActiveItem = !!activeItem;
            const isSectionCollapsed = collapsedSections[section.id] ?? !hasActiveItem;

            // Standalone sections: render single item as a direct link (no header, no collapse)
            if (section.standalone && section.items.length === 1) {
              const item = section.items[0];
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <div key={section.id} style={{ marginBottom: '0.25rem' }}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    title={isCollapsed ? item.label : undefined}
                    onClick={handleMobileClose}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: isCollapsed ? '0.625rem 0' : '0.625rem 1.25rem',
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      textDecoration: 'none',
                      backgroundColor: active ? 'rgba(var(--color-primary-rgb), 0.08)' : 'transparent',
                      borderLeft: active ? '3px solid var(--color-primary)' : '3px solid transparent',
                      color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      transition: 'all 0.15s ease',
                      marginTop: '0.5rem',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.backgroundColor = 'rgba(var(--color-primary-rgb), 0.04)';
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                      }
                    }}
                  >
                    <Icon
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: active ? item.iconColor : 'var(--color-text-disabled)' }}
                    />
                    {!isCollapsed && (
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: active ? 600 : 400,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.label}
                      </span>
                    )}
                  </Link>
                </div>
              );
            }

            return (
              <div key={section.id} style={{ marginBottom: '0.25rem' }}>
                {/* Section Header */}
                {!isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={!isSectionCollapsed}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '0.5rem 1.25rem',
                      marginTop: '0.5rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: hasActiveItem ? 'var(--color-primary)' : 'var(--color-text-disabled)',
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      <section.icon className="w-3.5 h-3.5" />
                      {section.label}
                    </span>
                    {isSectionCollapsed ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronUp className="w-3 h-3" />
                    )}
                  </button>
                ) : (
                  <div
                    style={{
                      height: 1,
                      backgroundColor: 'var(--color-border-light)',
                      margin: '0.5rem 0.75rem',
                    }}
                  />
                )}

                {/* Active page indicator when section is collapsed */}
                {isSectionCollapsed && hasActiveItem && activeItem && !isCollapsed && (() => {
                  const ActiveIcon = activeItem.icon;
                  return (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.5rem 1.25rem',
                        backgroundColor: 'rgba(var(--color-primary-rgb), 0.08)',
                        borderLeft: '3px solid var(--color-primary)',
                      }}
                    >
                      <ActiveIcon
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: activeItem.iconColor }}
                      />
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {activeItem.label}
                      </span>
                    </div>
                  );
                })()}

                {/* Section Items */}
                {!isSectionCollapsed &&
                  section.items.map((item: NavigationItem) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        title={isCollapsed ? item.label : undefined}
                        onClick={handleMobileClose}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: isCollapsed ? '0.625rem 0' : '0.625rem 1.25rem',
                          justifyContent: isCollapsed ? 'center' : 'flex-start',
                          textDecoration: 'none',
                          backgroundColor: active ? 'rgba(var(--color-primary-rgb), 0.08)' : 'transparent',
                          borderLeft: active ? '3px solid var(--color-primary)' : '3px solid transparent',
                          color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.backgroundColor = 'rgba(var(--color-primary-rgb), 0.04)';
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                          }
                        }}
                      >
                        <Icon
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: active ? item.iconColor : 'var(--color-text-disabled)' }}
                        />
                        {!isCollapsed && (
                          <span
                            style={{
                              fontSize: '0.8125rem',
                              fontWeight: active ? 600 : 400,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.label}
                          </span>
                        )}
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </nav>

        {/* Footer — Settings & Academy quick access */}
        <div
          style={{
            padding: '0.5rem 1.25rem 0.75rem',
            borderTop: '1px solid var(--color-border-light)',
            backgroundColor: 'var(--color-bg-elevated)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: isCollapsed ? '0' : '0.25rem', justifyContent: isCollapsed ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
            <Link
              href="/settings/integrations"
              title="Integrations"
              onClick={handleMobileClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.5rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                color: pathname?.startsWith('/settings/integrations') ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                backgroundColor: pathname?.startsWith('/settings/integrations') ? 'rgba(var(--color-primary-rgb), 0.08)' : 'transparent',
                transition: 'all 0.15s ease',
                flex: isCollapsed ? 'none' : 1,
              }}
              onMouseEnter={(e) => {
                if (!pathname?.startsWith('/settings/integrations')) {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--color-primary-rgb), 0.04)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!pathname?.startsWith('/settings/integrations')) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }
              }}
            >
              <Plug className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Integrations</span>}
            </Link>
            <Link
              href="/settings"
              title="Settings"
              onClick={handleMobileClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.5rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                color: pathname?.startsWith('/settings') ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                backgroundColor: pathname?.startsWith('/settings') ? 'rgba(var(--color-primary-rgb), 0.08)' : 'transparent',
                transition: 'all 0.15s ease',
                flex: isCollapsed ? 'none' : 1,
              }}
              onMouseEnter={(e) => {
                if (!pathname?.startsWith('/settings')) {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--color-primary-rgb), 0.04)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!pathname?.startsWith('/settings')) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }
              }}
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Settings</span>}
            </Link>
            <Link
              href="/academy"
              title="Academy & Help"
              onClick={handleMobileClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.5rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                color: pathname?.startsWith('/academy') ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                backgroundColor: pathname?.startsWith('/academy') ? 'rgba(var(--color-primary-rgb), 0.08)' : 'transparent',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!pathname?.startsWith('/academy')) {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--color-primary-rgb), 0.04)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!pathname?.startsWith('/academy')) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }
              }}
            >
              <HelpCircle className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Help</span>}
            </Link>
            <ThemeToggle collapsed={isCollapsed} />
          </div>
          {!isCollapsed && (
            <div
              style={{
                fontSize: '0.625rem',
                color: 'var(--color-text-disabled)',
                marginTop: '0.375rem',
                paddingLeft: '0.5rem',
              }}
            >
              SalesVelocity.ai
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Toggle Button */}
      <button
        type="button"
        className="md:hidden fixed bottom-4 left-4 z-40"
        onClick={handleMobileToggle}
        aria-label="Toggle sidebar"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary)',
          boxShadow: '0 4px 12px rgba(var(--color-primary-rgb), 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: 'none',
        }}
      >
        {mobileOpen ? (
          <X className="w-6 h-6" style={{ color: 'var(--color-text-primary)' }} />
        ) : (
          <Menu className="w-6 h-6" style={{ color: 'var(--color-text-primary)' }} />
        )}
      </button>
    </>
  );
}
