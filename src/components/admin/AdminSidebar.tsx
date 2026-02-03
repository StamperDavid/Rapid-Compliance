'use client';

/**
 * Admin Sidebar Component
 * RapidCompliance.US - Penthouse Admin Navigation
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
      { id: 'dashboard', label: 'Dashboard', href: '/admin', icon: LayoutDashboard, iconColor: '#6366f1' },
      { id: 'workforce-hq', label: 'Workforce HQ', href: '/admin/workforce', icon: Monitor, iconColor: '#8b5cf6' },
    ],
  },
  // ── CRM ─────────────────────────────────────────────────────────────
  {
    id: 'crm',
    label: 'CRM',
    items: [
      { id: 'leads', label: 'Leads', href: '/leads', icon: Users, iconColor: '#6366f1' },
      { id: 'deals', label: 'Deals / Pipeline', href: '/deals', icon: Handshake, iconColor: '#8b5cf6' },
      { id: 'contacts', label: 'Contacts', href: '/contacts', icon: Contact, iconColor: '#06b6d4' },
      { id: 'conversations', label: 'Conversations', href: '/conversations', icon: MessageSquare, iconColor: '#10b981' },
      { id: 'living-ledger', label: 'Living Ledger', href: '/admin/living-ledger', icon: BookOpen, iconColor: '#f59e0b' },
    ],
  },
  // ── Lead Gen ────────────────────────────────────────────────────────
  {
    id: 'lead-gen',
    label: 'Lead Gen',
    items: [
      { id: 'forms', label: 'Forms', href: '/forms', icon: ClipboardList, iconColor: '#6366f1' },
      { id: 'lead-research', label: 'Lead Research', href: '/leads/research', icon: Microscope, iconColor: '#8b5cf6' },
      { id: 'lead-scoring', label: 'Lead Scoring', href: '/lead-scoring', icon: Target, iconColor: '#10b981' },
    ],
  },
  // ── Outbound / Sales ────────────────────────────────────────────────
  {
    id: 'outbound',
    label: 'Outbound',
    items: [
      { id: 'outbound-hub', label: 'Outbound', href: '/outbound', icon: Send, iconColor: '#6366f1' },
      { id: 'sequences', label: 'Sequences', href: '/outbound/sequences', icon: ListOrdered, iconColor: '#8b5cf6' },
      { id: 'email-campaigns', label: 'Campaigns', href: '/email/campaigns', icon: Mail, iconColor: '#06b6d4' },
      { id: 'email-writer', label: 'Email Writer', href: '/email-writer', icon: PenTool, iconColor: '#10b981' },
      { id: 'nurture', label: 'Nurture', href: '/nurture', icon: Sprout, iconColor: '#f59e0b' },
      { id: 'calls', label: 'Calls', href: '/calls', icon: PhoneCall, iconColor: '#ef4444' },
    ],
  },
  // ── Content Factory ─────────────────────────────────────────────────
  {
    id: 'content-factory',
    label: 'Content Factory',
    items: [
      { id: 'video-studio', label: 'Video Studio', href: '/content/video', icon: Video, iconColor: '#6366f1' },
      { id: 'social-media', label: 'Social Media', href: '/social/campaigns', icon: Share2, iconColor: '#8b5cf6' },
      { id: 'proposals', label: 'Proposals', href: '/proposals/builder', icon: FileText, iconColor: '#06b6d4' },
      { id: 'battlecards', label: 'Battlecards', href: '/battlecards', icon: Swords, iconColor: '#f59e0b' },
    ],
  },
  // ── AI Workforce ────────────────────────────────────────────────────
  {
    id: 'ai-workforce',
    label: 'AI Workforce',
    items: [
      { id: 'agent-registry', label: 'Agent Registry', href: '/admin/ai-agents', icon: Bot, iconColor: '#06b6d4' },
      { id: 'training-center', label: 'Training Center', href: '/settings/ai-agents/training', icon: GraduationCap, iconColor: '#10b981' },
      { id: 'agent-persona', label: 'Agent Persona', href: '/settings/ai-agents/persona', icon: UserCog, iconColor: '#8b5cf6' },
      { id: 'voice-ai', label: 'Voice AI Lab', href: '/voice/training', icon: Phone, iconColor: '#f59e0b' },
      { id: 'social-ai', label: 'Social AI Lab', href: '/social/training', icon: Megaphone, iconColor: '#ec4899' },
      { id: 'seo-ai', label: 'SEO AI Lab', href: '/seo/training', icon: SearchCode, iconColor: '#14b8a6' },
      { id: 'datasets', label: 'Datasets', href: '/ai/datasets', icon: Database, iconColor: '#6366f1' },
      { id: 'fine-tuning', label: 'Fine-Tuning', href: '/ai/fine-tuning', icon: Sliders, iconColor: '#f97316' },
    ],
  },
  // ── Automation ──────────────────────────────────────────────────────
  {
    id: 'automation',
    label: 'Automation',
    items: [
      { id: 'workflows', label: 'Workflows', href: '/workflows', icon: Workflow, iconColor: '#6366f1' },
      { id: 'ab-testing', label: 'A/B Testing', href: '/ab-tests', icon: FlaskConical, iconColor: '#10b981' },
      { id: 'lead-routing', label: 'Lead Routing', href: '/settings/lead-routing', icon: Route, iconColor: '#8b5cf6' },
    ],
  },
  // ── E-Commerce ──────────────────────────────────────────────────────
  {
    id: 'ecommerce',
    label: 'E-Commerce',
    items: [
      { id: 'products', label: 'Products', href: '/products', icon: Package, iconColor: '#6366f1' },
      { id: 'orders', label: 'Orders', href: '/analytics/ecommerce', icon: ShoppingCart, iconColor: '#8b5cf6' },
      { id: 'storefront', label: 'Storefront', href: '/settings/storefront', icon: Store, iconColor: '#f59e0b' },
    ],
  },
  // ── Compliance ──────────────────────────────────────────────────────
  {
    id: 'compliance',
    label: 'Compliance',
    items: [
      { id: 'compliance-reports', label: 'Compliance Reports', href: '/admin/compliance-reports', icon: ShieldCheck, iconColor: '#10b981' },
      { id: 'audit-log', label: 'Audit Log', href: '/website/audit-log', icon: ScrollText, iconColor: '#f59e0b' },
    ],
  },
  // ── Analytics ───────────────────────────────────────────────────────
  {
    id: 'analytics',
    label: 'Analytics',
    items: [
      { id: 'analytics-overview', label: 'Overview', href: '/analytics', icon: PieChart, iconColor: '#06b6d4' },
      { id: 'revenue', label: 'Revenue', href: '/analytics/revenue', icon: TrendingUp, iconColor: '#10b981' },
      { id: 'pipeline', label: 'Pipeline', href: '/analytics/pipeline', icon: BarChart3, iconColor: '#6366f1' },
      { id: 'sales-perf', label: 'Sales Performance', href: '/analytics/sales', icon: Activity, iconColor: '#8b5cf6' },
      { id: 'sequence-analytics', label: 'Sequences', href: '/sequences/analytics', icon: LineChart, iconColor: '#f59e0b' },
    ],
  },
  // ── Website ─────────────────────────────────────────────────────────
  {
    id: 'website',
    label: 'Website',
    items: [
      { id: 'site-editor', label: 'Site Editor', href: '/website/editor', icon: Globe, iconColor: '#6366f1' },
      { id: 'pages', label: 'Pages', href: '/website/pages', icon: FileEdit, iconColor: '#8b5cf6' },
      { id: 'blog', label: 'Blog', href: '/website/blog', icon: BookOpenText, iconColor: '#06b6d4' },
      { id: 'seo', label: 'SEO', href: '/website/seo', icon: Search, iconColor: '#10b981' },
      { id: 'domains', label: 'Domains', href: '/website/domains', icon: Link2, iconColor: '#14b8a6' },
      { id: 'site-settings', label: 'Site Settings', href: '/website/settings', icon: Cog, iconColor: '#f59e0b' },
    ],
  },
  // ── Settings ────────────────────────────────────────────────────────
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { id: 'general', label: 'General', href: '/settings', icon: Settings, iconColor: '#999' },
      { id: 'users-team', label: 'Users & Team', href: '/settings/users', icon: UsersRound, iconColor: '#6366f1' },
      { id: 'integrations', label: 'Integrations', href: '/settings/integrations', icon: Plug, iconColor: '#8b5cf6' },
      { id: 'api-keys', label: 'API Keys', href: '/settings/api-keys', icon: KeyRound, iconColor: '#10b981' },
      { id: 'theme', label: 'Theme & Branding', href: '/settings/theme', icon: Palette, iconColor: '#f59e0b' },
      { id: 'security', label: 'Security', href: '/settings/security', icon: Lock, iconColor: '#ef4444' },
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
          backgroundColor: '#0a0a0a',
          borderRight: '1px solid #1f1f1f',
        }}
      >
        {/* Header / Branding */}
        <div
          style={{
            padding: isCollapsed ? '1.25rem 0.75rem' : '1.5rem 1.25rem',
            borderBottom: '1px solid #1f1f1f',
            backgroundColor: '#0f0f0f',
          }}
        >
          {!isCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '0.5rem',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  color: '#fff',
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
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  RapidCompliance.US
                </div>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: '#6366f1',
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
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: '#fff',
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
              border: '1px solid #2a2a2a',
              backgroundColor: '#141414',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#666',
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
              border: '1px solid #2a2a2a',
              backgroundColor: '#141414',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#666',
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
                      color: hasActiveItem ? '#6366f1' : '#555',
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
                      backgroundColor: '#1f1f1f',
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
                          backgroundColor: active ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          borderLeft: active ? '3px solid #6366f1' : '3px solid transparent',
                          color: active ? '#fff' : '#888',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                            e.currentTarget.style.color = '#ccc';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#888';
                          }
                        }}
                      >
                        <Icon
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: active ? item.iconColor : '#666' }}
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
            borderTop: '1px solid #1f1f1f',
            backgroundColor: '#0f0f0f',
          }}
        >
          {!isCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  fontSize: '0.6875rem',
                  color: '#444',
                }}
              >
                RapidCompliance.US
              </div>
              <div
                style={{
                  fontSize: '0.625rem',
                  color: '#333',
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
                color: '#444',
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
        className="md:hidden fixed bottom-4 right-4 z-40"
        onClick={handleMobileToggle}
        aria-label="Toggle sidebar"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: '#6366f1',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
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
