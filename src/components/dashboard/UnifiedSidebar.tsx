"use client";

/**
 * Single-Tenant Unified Sidebar Component
 * Rapid Compliance - Clean, Simple Navigation
 *
 * Navigation: Dashboard, Lead Pipeline, Agent Swarm, Social Media, Company Settings
 */

import React, { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";
import {
  filterNavigationByRole,
  type UnifiedUser,
  type NavigationSection,
  type NavigationItem,
  type AccountRole,
} from "@/types/unified-rbac";
import { getNavigationForRole } from "./navigation-config";
import { DEFAULT_ORG_ID } from "@/lib/constants/platform";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface UnifiedSidebarProps {
  /** Current user with unified role */
  user: UnifiedUser;

  /** External collapsed state control */
  isCollapsed?: boolean;

  /** External collapse toggle handler */
  onToggleCollapse?: () => void;

  /** Custom brand name */
  brandName?: string;

  /** Custom primary color */
  primaryColor?: string;
}

interface NavItemComponentProps {
  item: NavigationItem;
  isCollapsed: boolean;
  isActive: boolean;
}

interface NavSectionComponentProps {
  section: NavigationSection;
  isCollapsed: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Individual navigation item component
 */
const NavItemComponent = React.memo<NavItemComponentProps>(
  ({ item, isCollapsed, isActive }) => {
    const Icon = item.icon;

    // Build href with hardcoded org ID (single-tenant)
    const href = useMemo(() => {
      return item.href.replace(':orgId', DEFAULT_ORG_ID);
    }, [item.href]);

    const iconColor = item.iconColor ?? '#999';

    return (
      <Link
        href={href}
        className={`flex items-center gap-3 transition-colors ${
          isActive
            ? "bg-[var(--color-bg-elevated)] text-[var(--color-primary)] font-semibold border-l-[3px] border-l-[var(--color-primary)]"
            : "text-[#999] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-primary)] border-l-[3px] border-l-transparent"
        } ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        style={{ padding: '0.875rem 1.25rem' }}
        title={isCollapsed ? item.label : undefined}
        aria-disabled={item.disabled}
      >
        <Icon
          className="w-5 h-5 flex-shrink-0 transition-colors"
          style={{ color: iconColor }}
        />
        {!isCollapsed && (
          <>
            <span className="flex-1 text-[15px] whitespace-nowrap overflow-hidden text-ellipsis">
              {item.label}
            </span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="bg-[var(--color-primary)] text-white text-xs font-semibold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    );
  }
);

NavItemComponent.displayName = "NavItemComponent";

/**
 * Navigation section component
 */
const NavSectionComponent = React.memo<NavSectionComponentProps>(
  ({ section, isCollapsed, isExpanded, onToggle }) => {
    const SectionIcon = section.icon;
    const pathname = usePathname();

    // Check if any item in this section is active
    const hasActiveItem = useMemo(() => {
      return section.items.some((item) => {
        const href = item.href.replace(':orgId', DEFAULT_ORG_ID);
        return pathname?.startsWith(href);
      });
    }, [section.items, pathname]);

    const shouldShowItems = !section.collapsible || isExpanded || isCollapsed;
    const sectionIconColor = section.iconColor ?? '#666';

    return (
      <div className="mb-0">
        {section.collapsible ? (
          <button
            type="button"
            className={`w-full flex items-center gap-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              hasActiveItem
                ? "text-[var(--color-primary)]"
                : "text-[#666]"
            } hover:bg-[var(--color-bg-elevated)]`}
            style={{ padding: '0 1.25rem', marginBottom: '0.5rem' }}
            onClick={onToggle}
            title={isCollapsed ? section.label : undefined}
          >
            <SectionIcon
              className="w-[18px] h-[18px] flex-shrink-0 transition-colors"
              style={{ color: sectionIconColor }}
            />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left">{section.label}</span>
                <ChevronRight
                  className={`w-4 h-4 transition-transform transition-colors duration-200 text-[#666] ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
              </>
            )}
          </button>
        ) : (
          !isCollapsed && (
            <div
              className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-[#666]"
              style={{ padding: '0 1.25rem', marginBottom: '0.5rem' }}
            >
              <SectionIcon
                className="w-[18px] h-[18px] flex-shrink-0 transition-colors"
                style={{ color: sectionIconColor }}
              />
              <span className="flex-1 text-left">{section.label}</span>
            </div>
          )
        )}
        {shouldShowItems && (
          <div className="flex flex-col">
            {section.items.map((item) => {
              const href = item.href.replace(':orgId', DEFAULT_ORG_ID);
              const isActive = pathname?.startsWith(href) ?? false;

              return (
                <NavItemComponent
                  key={item.id}
                  item={item}
                  isCollapsed={isCollapsed}
                  isActive={isActive}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

NavSectionComponent.displayName = "NavSectionComponent";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Unified Sidebar Component
 * Single-tenant navigation for Rapid Compliance
 */
const UnifiedSidebar: React.FC<UnifiedSidebarProps> = React.memo(
  ({
    user,
    isCollapsed: externalIsCollapsed,
    onToggleCollapse,
    brandName = "Rapid Compliance",
    primaryColor = "#6366f1",
  }) => {
    const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const isCollapsed = externalIsCollapsed ?? internalIsCollapsed;

    // Get navigation sections based on user role
    const filteredSections = useMemo(() => {
      const roleSections = getNavigationForRole(user.role);
      return filterNavigationByRole(roleSections, user.role);
    }, [user.role]);

    // Track expanded sections
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
      const initial: Record<string, boolean> = {};
      filteredSections.forEach((section) => {
        initial[section.id] = !(section.defaultCollapsed ?? true);
      });
      return initial;
    });

    const handleToggleCollapse = useCallback(() => {
      if (onToggleCollapse) {
        onToggleCollapse();
      } else {
        setInternalIsCollapsed((prev) => !prev);
      }
    }, [onToggleCollapse]);

    const handleToggleSection = useCallback((sectionId: string) => {
      setExpandedSections((prev) => ({
        ...prev,
        [sectionId]: !prev[sectionId],
      }));
    }, []);

    const handleMobileToggle = useCallback(() => {
      setMobileOpen((prev) => !prev);
    }, []);

    const handleMobileClose = useCallback(() => {
      setMobileOpen(false);
    }, []);

    // Role badge display
    const getRoleBadge = (role: AccountRole): string => {
      const badges: Record<AccountRole, string> = {
        superadmin: "Super Admin",
        admin: "Admin",
        manager: "Manager",
        employee: "Employee",
      };
      return badges[role];
    };

    const roleBadge = getRoleBadge(user.role);
    const isSuperAdmin = user.role === 'superadmin';

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
          className={`fixed left-0 top-0 h-screen bg-[var(--color-bg-paper)] border-r border-[var(--color-border-light)] flex flex-col transition-all duration-300 z-50 ${
            isCollapsed ? "w-16" : "w-[280px]"
          } ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0`}
          style={{
            ['--primary-color' as string]: primaryColor,
            ['--color-primary' as string]: primaryColor,
          }}
        >
          {/* Header */}
          <div className="p-6 border-b border-[var(--color-border-light)] bg-[var(--color-bg-elevated)] relative">
            {!isCollapsed && (
              <div className="flex flex-col gap-4">
                {/* Brand/Title */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
                    {brandName.charAt(0).toUpperCase()}
                  </div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)] m-0 whitespace-nowrap overflow-hidden text-ellipsis">
                    {brandName}
                  </h2>
                </div>

                {/* User Info */}
                <div className="flex items-center gap-3 p-3 bg-[var(--color-bg-paper)] rounded-lg border border-[var(--color-border-light)]">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-base flex-shrink-0"
                    style={{
                      background: user.avatarUrl
                        ? `url(${user.avatarUrl})`
                        : `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {!user.avatarUrl && user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[var(--color-text-primary)] whitespace-nowrap overflow-hidden text-ellipsis">
                      {user.displayName}
                    </div>
                    <div
                      className={`text-xs uppercase tracking-wider ${
                        isSuperAdmin
                          ? "text-[var(--color-primary)] font-semibold"
                          : "text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {roleBadge}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Collapse Toggle */}
            <button
              type="button"
              className={`${
                isCollapsed
                  ? "static w-10 h-10 mx-auto mt-0"
                  : "absolute top-4 right-4 w-8 h-8"
              } group rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] flex items-center justify-center cursor-pointer transition-all hover:bg-[var(--color-bg-elevated)] hover:border-[var(--color-primary)]`}
              onClick={handleToggleCollapse}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] transition-colors group-hover:text-[var(--color-primary)]" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-[var(--color-text-secondary)] transition-colors group-hover:text-[var(--color-primary)]" />
              )}
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              className="md:hidden absolute top-4 left-4 w-8 h-8 group rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] flex items-center justify-center cursor-pointer transition-all hover:bg-[var(--color-bg-elevated)] hover:border-[var(--color-primary)]"
              onClick={handleMobileClose}
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4 text-[var(--color-text-secondary)] transition-colors group-hover:text-[var(--color-primary)]" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-thin scrollbar-thumb-[var(--color-border-light)] scrollbar-track-transparent hover:scrollbar-thumb-[var(--color-text-disabled)]">
            {filteredSections.map((section) => (
              <NavSectionComponent
                key={section.id}
                section={section}
                isCollapsed={isCollapsed}
                isExpanded={expandedSections[section.id] ?? false}
                onToggle={() => handleToggleSection(section.id)}
              />
            ))}
          </nav>

          {/* Footer */}
          {!isCollapsed && (
            <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-bg-elevated)]">
              <div className="text-xs text-[var(--color-text-disabled)] text-center">
                Rapid Compliance
              </div>
            </div>
          )}
        </aside>

        {/* Mobile Toggle Button */}
        <button
          type="button"
          className="md:hidden fixed bottom-4 right-4 w-14 h-14 rounded-full bg-[var(--color-primary)] shadow-lg flex items-center justify-center cursor-pointer z-40 transition-transform hover:scale-105 active:scale-95"
          onClick={handleMobileToggle}
          aria-label="Toggle sidebar"
          style={{
            backgroundColor: primaryColor,
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
);

UnifiedSidebar.displayName = "UnifiedSidebar";

export default UnifiedSidebar;
