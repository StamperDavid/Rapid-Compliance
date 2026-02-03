'use client';

/**
 * Admin Sidebar Component
 * RapidCompliance.US - Penthouse Admin Navigation
 *
 * Provides persistent sidebar navigation for the admin dashboard.
 * Single-tenant: all links use static routes with rapid-compliance-root identity.
 */

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Bot,
  FileBarChart,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
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
  description: string;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    iconColor: '#6366f1',
    description: 'Platform overview & stats',
  },
  {
    id: 'living-ledger',
    label: 'Living Ledger',
    href: '/admin/living-ledger',
    icon: BookOpen,
    iconColor: '#10b981',
    description: 'CRM deal intelligence',
  },
  {
    id: 'ai-agents',
    label: 'AI Agents / Tools',
    href: '/admin/ai-agents',
    icon: Bot,
    iconColor: '#06b6d4',
    description: 'Agent management & orchestration',
  },
  {
    id: 'compliance-reports',
    label: 'Compliance Reports',
    href: '/admin/compliance-reports',
    icon: FileBarChart,
    iconColor: '#f59e0b',
    description: 'Regulatory & compliance reporting',
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

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const handleMobileToggle = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
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
              {/* Logo mark */}
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
            padding: '1rem 0',
          }}
        >
          {!isCollapsed && (
            <div
              style={{
                padding: '0 1.25rem',
                marginBottom: '0.75rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: '#444',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                Navigation
              </span>
            </div>
          )}

          {ADMIN_NAV_ITEMS.map((item) => {
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
                  padding: isCollapsed ? '0.875rem 0' : '0.875rem 1.25rem',
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
                  className="w-5 h-5 flex-shrink-0"
                  style={{ color: active ? item.iconColor : '#666' }}
                />
                {!isCollapsed && (
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: active ? 600 : 400,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: '0.6875rem',
                        color: '#555',
                        marginTop: '0.125rem',
                      }}
                    >
                      {item.description}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid #1f1f1f',
            backgroundColor: '#0f0f0f',
          }}
        >
          {!isCollapsed ? (
            <div
              style={{
                fontSize: '0.6875rem',
                color: '#444',
                textAlign: 'center',
              }}
            >
              RapidCompliance.US
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
