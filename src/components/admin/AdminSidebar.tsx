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
  BookOpen,
  Send,
  ListOrdered,
  FileText,
  Mail,
  Share2,
  FlaskConical,
  Video,
  Bot,
  GraduationCap,
  PhoneCall,
  Workflow,
  BarChart3,
  Activity,
  Globe,
  Film,
  Radar,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  ClipboardList,
  Database,
  Package,
  ShoppingCart,
  Store,
  PieChart,
  HelpCircle,
  Search,
  Trophy,
  AlertTriangle,
  PenLine,
  Plug,
  Shield,
  Eye,
  Compass,
  Gauge,
  Layers,
} from 'lucide-react';

// ============================================================================
// NAVIGATION CONFIG — role-gated via unified-rbac types
// ============================================================================

const NAV_SECTIONS: NavigationSection[] = [
  // ── Home ────────────────────────────────────────────────────────────
  {
    id: 'home',
    label: 'Home',
    icon: LayoutDashboard,
    allowedRoles: ['owner', 'admin', 'manager', 'member'],
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, iconColor: 'var(--color-primary)' },
      { id: 'team', label: 'Team', href: '/team/leaderboard', icon: Trophy, iconColor: 'var(--color-warning)' },
      { id: 'performance', label: 'Performance', href: '/performance', icon: Gauge, iconColor: 'var(--color-cyan)' },
      { id: 'onboarding', label: 'Onboarding', href: '/onboarding', icon: Compass, iconColor: 'var(--color-success)' },
    ],
  },
  // ── CRM ─────────────────────────────────────────────────────────────
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    allowedRoles: ['owner', 'admin', 'manager', 'member'],
    items: [
      { id: 'crm-hub', label: 'CRM', href: '/crm', icon: Users, iconColor: 'var(--color-primary)', requiredPermission: 'canViewLeads' },
      { id: 'deals', label: 'Deals / Pipeline', href: '/deals', icon: Handshake, iconColor: 'var(--color-secondary)', requiredPermission: 'canViewDeals' },
      { id: 'conversations', label: 'Conversations', href: '/conversations', icon: MessageSquare, iconColor: 'var(--color-success)', requiredPermission: 'canCreateRecords' },
      { id: 'living-ledger', label: 'Living Ledger', href: '/living-ledger', icon: BookOpen, iconColor: 'var(--color-warning)', requiredPermission: 'canViewAllRecords' },
      { id: 'lead-intel', label: 'Lead Intelligence', href: '/leads/research', icon: Search, iconColor: 'var(--color-primary)', requiredPermission: 'canViewLeads' },
      { id: 'coaching', label: 'Coaching', href: '/coaching', icon: GraduationCap, iconColor: 'var(--color-success)' },
      { id: 'playbook', label: 'Playbook', href: '/playbook', icon: BookOpen, iconColor: 'var(--color-secondary)' },
      { id: 'risk', label: 'Risk', href: '/risk', icon: AlertTriangle, iconColor: 'var(--color-error)' },
    ],
  },
  // ── Outreach (merged Lead Gen + Outbound + Workflows) ───────────────
  {
    id: 'outreach',
    label: 'Outreach',
    icon: Send,
    allowedRoles: ['owner', 'admin', 'manager'],
    items: [
      { id: 'outbound-hub', label: 'Outbound', href: '/outbound/sequences', icon: Send, iconColor: 'var(--color-primary)', requiredPermission: 'canManageLeads' },
      { id: 'sequences', label: 'Sequences', href: '/outbound/sequences', icon: ListOrdered, iconColor: 'var(--color-secondary)', requiredPermission: 'canManageLeads' },
      { id: 'email-campaigns', label: 'Campaigns', href: '/email/campaigns', icon: Mail, iconColor: 'var(--color-cyan)', requiredPermission: 'canManageEmailCampaigns' },
      { id: 'calls', label: 'Calls', href: '/calls', icon: PhoneCall, iconColor: 'var(--color-error)', requiredPermission: 'canAccessVoiceAgents' },
      { id: 'forms', label: 'Forms', href: '/forms', icon: ClipboardList, iconColor: 'var(--color-success)' },
      { id: 'workflows', label: 'Workflows', href: '/workflows', icon: Workflow, iconColor: 'var(--color-warning)', requiredPermission: 'canCreateWorkflows' },
      { id: 'email-studio', label: 'Email Studio', href: '/email-writer', icon: PenLine, iconColor: 'var(--color-primary)', requiredPermission: 'canManageEmailCampaigns' },
    ],
  },
  // ── Content (consolidated from Content Factory) ─────────────────────
  {
    id: 'content',
    label: 'Content',
    icon: Share2,
    allowedRoles: ['owner', 'admin', 'manager'],
    items: [
      { id: 'social-hub', label: 'Social Hub', href: '/social/command-center', icon: Activity, iconColor: 'var(--color-success)', requiredPermission: 'canManageSocialMedia' },
      { id: 'social-analytics', label: 'Social Analytics', href: '/social/analytics', icon: BarChart3, iconColor: 'var(--color-cyan)', requiredPermission: 'canManageSocialMedia' },
      { id: 'video-library', label: 'Video Library', href: '/content/video/library', icon: Film, iconColor: 'var(--color-primary)', requiredPermission: 'canManageSocialMedia' },
      { id: 'video-studio', label: 'Video Studio', href: '/content/video', icon: Video, iconColor: 'var(--color-primary)', requiredPermission: 'canManageSocialMedia' },
      { id: 'proposals', label: 'Proposals', href: '/proposals', icon: FileText, iconColor: 'var(--color-secondary)' },
    ],
  },
  // ── AI Workforce (consolidated) ─────────────────────────────────────
  {
    id: 'ai_workforce',
    label: 'AI Workforce',
    icon: Bot,
    allowedRoles: ['owner', 'admin', 'manager'],
    items: [
      { id: 'agent-registry', label: 'Agent Registry', href: '/workforce', icon: Bot, iconColor: 'var(--color-cyan)', requiredPermission: 'canDeployAIAgents' },
      { id: 'mission-control', label: 'Mission Control', href: '/mission-control', icon: Radar, iconColor: 'var(--color-primary)', requiredPermission: 'canDeployAIAgents' },
      { id: 'training-hub', label: 'Training Hub', href: '/settings/ai-agents/training', icon: GraduationCap, iconColor: 'var(--color-success)', requiredPermission: 'canTrainAIAgents' },
      { id: 'models', label: 'Models & Data', href: '/ai/datasets', icon: Database, iconColor: 'var(--color-primary)', requiredPermission: 'canManageAIAgents' },
    ],
  },
  // ── Commerce ────────────────────────────────────────────────────────
  {
    id: 'commerce',
    label: 'Commerce',
    icon: ShoppingCart,
    allowedRoles: ['owner', 'admin', 'manager', 'member'],
    items: [
      { id: 'products', label: 'Products', href: '/products', icon: Package, iconColor: 'var(--color-primary)', requiredPermission: 'canManageProducts' },
      { id: 'orders', label: 'Orders', href: '/orders', icon: ShoppingCart, iconColor: 'var(--color-secondary)', requiredPermission: 'canProcessOrders' },
      { id: 'storefront', label: 'Storefront', href: '/settings/storefront', icon: Store, iconColor: 'var(--color-warning)', requiredPermission: 'canManageEcommerce' },
    ],
  },
  // ── Website & SEO ──────────────────────────────────────────────────────
  {
    id: 'website',
    label: 'Website',
    icon: Globe,
    allowedRoles: ['owner', 'admin', 'manager'],
    items: [
      { id: 'website', label: 'Website', href: '/website/editor', icon: Globe, iconColor: 'var(--color-primary)', requiredPermission: 'canManageWebsite' },
      { id: 'seo', label: 'SEO', href: '/website/seo', icon: Search, iconColor: 'var(--color-success)', requiredPermission: 'canManageWebsite' },
    ],
  },
  // ── Analytics (consolidated — Revenue/Pipeline/Sales → tabs) ────────
  {
    id: 'analytics',
    label: 'Analytics',
    icon: PieChart,
    allowedRoles: ['owner', 'admin', 'manager', 'member'],
    items: [
      { id: 'analytics-overview', label: 'Overview', href: '/analytics', icon: PieChart, iconColor: 'var(--color-cyan)', requiredPermission: 'canViewReports' },
      { id: 'ab-testing', label: 'A/B Testing', href: '/ab-tests', icon: FlaskConical, iconColor: 'var(--color-success)' },
    ],
  },
  // ── System (owner-only admin tools) ───────────────────────────────────
  {
    id: 'system',
    label: 'System',
    icon: Shield,
    allowedRoles: ['owner'],
    items: [
      { id: 'system-health', label: 'System Health', href: '/system', icon: Activity, iconColor: 'var(--color-primary)' },
      { id: 'impersonate', label: 'Impersonate', href: '/system/impersonate', icon: Eye, iconColor: 'var(--color-warning)' },
      { id: 'schemas', label: 'Schemas', href: '/schemas', icon: Layers, iconColor: 'var(--color-cyan)' },
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Filter navigation by user role
  const filteredSections = useMemo(() => {
    if (!user?.role) {
      return [];
    }
    return filterNavigationByRole(NAV_SECTIONS, user.role);
  }, [user?.role]);

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
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }, []);

  const isActive = (href: string): boolean => {
    if (!pathname) { return false; }
    if (href === '/dashboard') { return pathname === '/dashboard'; }
    // Social Hub matches all /social/* except /social/analytics (separate item)
    if (href === '/social/command-center') {
      return pathname.startsWith('/social/') &&
        !pathname.startsWith('/social/analytics') &&
        !pathname.startsWith('/social/training');
    }
    // Training Hub matches all AI agent config + training labs
    if (href === '/settings/ai-agents/training') {
      return pathname.startsWith('/settings/ai-agents/') ||
        pathname.startsWith('/voice/training') ||
        pathname.startsWith('/social/training') ||
        pathname.startsWith('/seo/training');
    }
    // Models & Data matches all /ai/* paths
    if (href === '/ai/datasets') {
      return pathname.startsWith('/ai/');
    }
    // Analytics overview matches all analytics sub-pages
    if (href === '/analytics') {
      return pathname === '/analytics' ||
        pathname.startsWith('/analytics/') ||
        pathname.startsWith('/sequences/analytics');
    }
    // Lead Intelligence matches all lead intel hub pages
    if (href === '/leads/research') {
      return pathname.startsWith('/leads/research') ||
        pathname.startsWith('/lead-scoring') ||
        pathname.startsWith('/scraper');
    }
    // Coaching matches all coaching pages + playbook
    if (href === '/coaching') {
      return pathname.startsWith('/coaching') ||
        pathname.startsWith('/playbook');
    }
    // Agent Registry matches /workforce
    if (href === '/workforce') {
      return pathname.startsWith('/workforce') ||
        pathname === '/ai-agents';
    }
    // CRM hub matches /crm, /leads, /contacts
    if (href === '/crm') {
      return pathname === '/crm' ||
        pathname.startsWith('/crm?') ||
        pathname === '/leads' ||
        pathname === '/contacts';
    }
    // Email Studio matches email writer + nurture + email builder + templates
    if (href === '/email-writer') {
      return pathname.startsWith('/email-writer') ||
        pathname.startsWith('/nurture') ||
        pathname.startsWith('/marketing/email-builder') ||
        pathname === '/templates';
    }
    // Team matches leaderboard + tasks + performance
    if (href === '/team/leaderboard') {
      return pathname.startsWith('/team/') ||
        pathname.startsWith('/performance');
    }
    // SEO matches /website/seo/* and /seo/* (training)
    if (href === '/website/seo') {
      return pathname.startsWith('/website/seo') || pathname.startsWith('/seo/');
    }
    // Website matches all /website/* except SEO sub-pages
    if (href === '/website/editor') {
      return pathname.startsWith('/website/') && !pathname.startsWith('/website/seo');
    }
    // System health — exact match only (don't match /system/impersonate)
    if (href === '/system') {
      return pathname === '/system';
    }
    // Proposals matches list and builder
    if (href === '/proposals') {
      return pathname.startsWith('/proposals');
    }
    // Playbook — exact match
    if (href === '/playbook') {
      return pathname === '/playbook';
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
