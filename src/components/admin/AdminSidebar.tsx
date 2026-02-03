'use client';

/**
 * Admin Sidebar Component
 * SalesVelocity.ai - Penthouse Admin Navigation
 *
 * Full command-center sidebar exposing all 51 AI agents, 130+ routes,
 * and 215+ API endpoints across CRM, Sales, Marketing, AI, and more.
 * Single-tenant: all links use static routes with rapid-compliance-root identity.
 */

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Handshake,
  Contact,
  MessageSquare,
  BookOpen,
  Send,
  ListOrdered,
  FileText,
  Swords,
  Mail,
  Share2,
  FlaskConical,
  Video,
  Bot,
  GraduationCap,
  UserCog,
  Phone,
  PhoneCall,
  Workflow,
  Route,
  ShieldCheck,
  ScrollText,
  TrendingUp,
  BarChart3,
  Activity,
  Target,
  Globe,
  FileEdit,
  Search,
  Link2,
  Settings,
  UsersRound,
  Plug,
  KeyRound,
  Palette,
  Lock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  ClipboardList,
  Microscope,
  PenTool,
  Sprout,
  Megaphone,
  SearchCode,
  Database,
  Sliders,
  Package,
  ShoppingCart,
  Store,
  PieChart,
  LineChart,
  BookOpenText,
  Cog,
  Monitor,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// NAVIGATION CONFIG
// ============================================================================

interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  iconColor: string;
}

interface AdminNavSection {
  id: string;
  label: string;
  items: AdminNavItem[];
}

const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  // ── Command Center ──────────────────────────────────────────────────
  {
    id: 'command-center',
    label: 'Command Center',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/admin', icon: LayoutDashboard, iconColor: 'var(--color-primary)' },
      { id: 'workforce-hq', label: 'Workforce HQ', href: '/admin/workforce', icon: Monitor, iconColor: 'var(--color-secondary)' },
    ],
  },
  // ── CRM ─────────────────────────────────────────────────────────────
  {
    id: 'crm',
    label: 'CRM',
    items: [
      { id: 'leads', label: 'Leads', href: '/leads', icon: Users, iconColor: 'var(--color-primary)' },
      { id: 'deals', label: 'Deals / Pipeline', href: '/deals', icon: Handshake, iconColor: 'var(--color-secondary)' },
      { id: 'contacts', label: 'Contacts', href: '/contacts', icon: Contact, iconColor: 'var(--color-cyan)' },
      { id: 'conversations', label: 'Conversations', href: '/conversations', icon: MessageSquare, iconColor: 'var(--color-success)' },
      { id: 'living-ledger', label: 'Living Ledger', href: '/admin/living-ledger', icon: BookOpen, iconColor: 'var(--color-warning)' },
    ],
  },
  // ── Lead Gen ────────────────────────────────────────────────────────
  {
    id: 'lead-gen',
    label: 'Lead Gen',
    items: [
      { id: 'forms', label: 'Forms', href: '/forms', icon: ClipboardList, iconColor: 'var(--color-primary)' },
      { id: 'lead-research', label: 'Lead Research', href: '/leads/research', icon: Microscope, iconColor: 'var(--color-secondary)' },
      { id: 'lead-scoring', label: 'Lead Scoring', href: '/lead-scoring', icon: Target, iconColor: 'var(--color-success)' },
    ],
  },
  // ── Outbound / Sales ────────────────────────────────────────────────
  {
    id: 'outbound',
    label: 'Outbound',
    items: [
      { id: 'outbound-hub', label: 'Outbound', href: '/outbound', icon: Send, iconColor: 'var(--color-primary)' },
      { id: 'sequences', label: 'Sequences', href: '/outbound/sequences', icon: ListOrdered, iconColor: 'var(--color-secondary)' },
      { id: 'email-campaigns', label: 'Campaigns', href: '/email/campaigns', icon: Mail, iconColor: 'var(--color-cyan)' },
      { id: 'email-writer', label: 'Email Writer', href: '/email-writer', icon: PenTool, iconColor: 'var(--color-success)' },
      { id: 'nurture', label: 'Nurture', href: '/nurture', icon: Sprout, iconColor: 'var(--color-warning)' },
      { id: 'calls', label: 'Calls', href: '/calls', icon: PhoneCall, iconColor: 'var(--color-error)' },
    ],
  },
  // ── Content Factory ─────────────────────────────────────────────────
  {
    id: 'content-factory',
    label: 'Content Factory',
    items: [
      { id: 'video-studio', label: 'Video Studio', href: '/content/video', icon: Video, iconColor: 'var(--color-primary)' },
      { id: 'social-media', label: 'Social Media', href: '/social/campaigns', icon: Share2, iconColor: 'var(--color-secondary)' },
      { id: 'proposals', label: 'Proposals', href: '/proposals/builder', icon: FileText, iconColor: 'var(--color-cyan)' },
      { id: 'battlecards', label: 'Battlecards', href: '/battlecards', icon: Swords, iconColor: 'var(--color-warning)' },
    ],
  },
  // ── AI Workforce ────────────────────────────────────────────────────
  {
    id: 'ai-workforce',
    label: 'AI Workforce',
    items: [
      { id: 'agent-registry', label: 'Agent Registry', href: '/admin/ai-agents', icon: Bot, iconColor: 'var(--color-cyan)' },
      { id: 'training-center', label: 'Training Center', href: '/settings/ai-agents/training', icon: GraduationCap, iconColor: 'var(--color-success)' },
      { id: 'agent-persona', label: 'Agent Persona', href: '/settings/ai-agents/persona', icon: UserCog, iconColor: 'var(--color-secondary)' },
      { id: 'voice-ai', label: 'Voice AI Lab', href: '/voice/training', icon: Phone, iconColor: 'var(--color-warning)' },
      { id: 'social-ai', label: 'Social AI Lab', href: '/social/training', icon: Megaphone, iconColor: 'var(--color-accent)' },
      { id: 'seo-ai', label: 'SEO AI Lab', href: '/seo/training', icon: SearchCode, iconColor: 'var(--color-teal)' },
      { id: 'datasets', label: 'Datasets', href: '/ai/datasets', icon: Database, iconColor: 'var(--color-primary)' },
      { id: 'fine-tuning', label: 'Fine-Tuning', href: '/ai/fine-tuning', icon: Sliders, iconColor: 'var(--color-orange)' },
    ],
  },
  // ── Automation ──────────────────────────────────────────────────────
  {
    id: 'automation',
    label: 'Automation',
    items: [
      { id: 'workflows', label: 'Workflows', href: '/workflows', icon: Workflow, iconColor: 'var(--color-primary)' },
      { id: 'ab-testing', label: 'A/B Testing', href: '/ab-tests', icon: FlaskConical, iconColor: 'var(--color-success)' },
      { id: 'lead-routing', label: 'Lead Routing', href: '/settings/lead-routing', icon: Route, iconColor: 'var(--color-secondary)' },
    ],
  },
  // ── E-Commerce ──────────────────────────────────────────────────────
  {
    id: 'ecommerce',
    label: 'E-Commerce',
    items: [
      { id: 'products', label: 'Products', href: '/products', icon: Package, iconColor: 'var(--color-primary)' },
      { id: 'orders', label: 'Orders', href: '/analytics/ecommerce', icon: ShoppingCart, iconColor: 'var(--color-secondary)' },
      { id: 'storefront', label: 'Storefront', href: '/settings/storefront', icon: Store, iconColor: 'var(--color-warning)' },
    ],
  },
  // ── Compliance ──────────────────────────────────────────────────────
  {
    id: 'compliance',
    label: 'Compliance',
    items: [
      { id: 'compliance-reports', label: 'Compliance Reports', href: '/admin/compliance-reports', icon: ShieldCheck, iconColor: 'var(--color-success)' },
      { id: 'audit-log', label: 'Audit Log', href: '/website/audit-log', icon: ScrollText, iconColor: 'var(--color-warning)' },
    ],
  },
  // ── Analytics ───────────────────────────────────────────────────────
  {
    id: 'analytics',
    label: 'Analytics',
    items: [
      { id: 'analytics-overview', label: 'Overview', href: '/analytics', icon: PieChart, iconColor: 'var(--color-cyan)' },
      { id: 'revenue', label: 'Revenue', href: '/analytics/revenue', icon: TrendingUp, iconColor: 'var(--color-success)' },
      { id: 'pipeline', label: 'Pipeline', href: '/analytics/pipeline', icon: BarChart3, iconColor: 'var(--color-primary)' },
      { id: 'sales-perf', label: 'Sales Performance', href: '/analytics/sales', icon: Activity, iconColor: 'var(--color-secondary)' },
      { id: 'sequence-analytics', label: 'Sequences', href: '/sequences/analytics', icon: LineChart, iconColor: 'var(--color-warning)' },
    ],
  },
  // ── Website ─────────────────────────────────────────────────────────
  {
    id: 'website',
    label: 'Website',
    items: [
      { id: 'site-editor', label: 'Site Editor', href: '/website/editor', icon: Globe, iconColor: 'var(--color-primary)' },
      { id: 'pages', label: 'Pages', href: '/website/pages', icon: FileEdit, iconColor: 'var(--color-secondary)' },
      { id: 'blog', label: 'Blog', href: '/website/blog', icon: BookOpenText, iconColor: 'var(--color-cyan)' },
      { id: 'seo', label: 'SEO', href: '/website/seo', icon: Search, iconColor: 'var(--color-success)' },
      { id: 'domains', label: 'Domains', href: '/website/domains', icon: Link2, iconColor: 'var(--color-teal)' },
      { id: 'site-settings', label: 'Site Settings', href: '/website/settings', icon: Cog, iconColor: 'var(--color-warning)' },
    ],
  },
  // ── Settings ────────────────────────────────────────────────────────
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { id: 'general', label: 'General', href: '/settings', icon: Settings, iconColor: 'var(--color-text-secondary)' },
      { id: 'users-team', label: 'Users & Team', href: '/settings/users', icon: UsersRound, iconColor: 'var(--color-primary)' },
      { id: 'integrations', label: 'Integrations', href: '/settings/integrations', icon: Plug, iconColor: 'var(--color-secondary)' },
      { id: 'api-keys', label: 'API Keys', href: '/settings/api-keys', icon: KeyRound, iconColor: 'var(--color-success)' },
      { id: 'theme', label: 'Theme & Branding', href: '/settings/theme', icon: Palette, iconColor: 'var(--color-warning)' },
      { id: 'security', label: 'Security', href: '/settings/security', icon: Lock, iconColor: 'var(--color-error)' },
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

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
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname?.startsWith(href) ?? false;
  };

  const currentWidth = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
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
                  Admin Panel
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
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.5rem 0',
          }}
        >
          {ADMIN_NAV_SECTIONS.map((section) => {
            const isSectionCollapsed = collapsedSections[section.id] ?? false;
            const hasActiveItem = section.items.some((item) => isActive(item.href));

            return (
              <div key={section.id} style={{ marginBottom: '0.25rem' }}>
                {/* Section Header */}
                {!isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
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
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
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

                {/* Section Items */}
                {!isSectionCollapsed &&
                  section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
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

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--color-border-light)',
            backgroundColor: 'var(--color-bg-elevated)',
          }}
        >
          {!isCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--color-text-disabled)',
                }}
              >
                SalesVelocity.ai
              </div>
              <div
                style={{
                  fontSize: '0.625rem',
                  color: 'var(--color-text-disabled)',
                  fontFamily: 'monospace',
                }}
              >
                51 agents
              </div>
            </div>
          ) : (
            <div
              style={{
                fontSize: '0.6875rem',
                color: 'var(--color-text-disabled)',
                textAlign: 'center',
              }}
            >
              RC
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
          <X className="w-6 h-6 text-white" />
        ) : (
          <Menu className="w-6 h-6 text-white" />
        )}
      </button>
    </>
  );
}
