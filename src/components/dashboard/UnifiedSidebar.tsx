"use client";

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

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface UnifiedSidebarProps {
  /** Current user with unified role */
  user: UnifiedUser;

  /** Organization ID for URL context */
  organizationId?: string;

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
  organizationId?: string;
}

interface NavSectionComponentProps {
  section: NavigationSection;
  isCollapsed: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  organizationId?: string;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Individual navigation item component
 */
const NavItemComponent = React.memo<NavItemComponentProps>(
  ({ item, isCollapsed, isActive, organizationId }) => {
    const Icon = item.icon;

    // Build href with organization context - replace :orgId placeholder
    const href = useMemo(() => {
      if (item.href.startsWith('/admin')) {
        return item.href;
      }
      return item.href.replace(':orgId', organizationId ?? '');
    }, [item.href, organizationId]);

    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors ${
          isActive
            ? "bg-[var(--color-bg-elevated)] text-[var(--color-primary)] font-medium"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-primary)]"
        } ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        title={isCollapsed ? item.label : undefined}
        aria-disabled={item.disabled}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
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
 * Navigation section component (collapsible)
 */
const NavSectionComponent = React.memo<NavSectionComponentProps>(
  ({ section, isCollapsed, isExpanded, onToggle, organizationId }) => {
    const SectionIcon = section.icon;
    const pathname = usePathname();

    // Check if any item in this section is active
    const hasActiveItem = useMemo(() => {
      return section.items.some((item) => {
        const href = item.href.startsWith('/admin')
          ? item.href
          : item.href.replace(':orgId', organizationId ?? '');
        return pathname?.startsWith(href);
      });
    }, [section.items, pathname, organizationId]);

    // If section is not collapsible, always show items
    const shouldShowItems = !section.collapsible || isExpanded || isCollapsed;

    return (
      <div className="mb-2">
        {section.collapsible ? (
          <button
            type="button"
            className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              hasActiveItem
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-text-secondary)]"
            } hover:bg-[var(--color-bg-elevated)]`}
            onClick={onToggle}
            title={isCollapsed ? section.label : undefined}
          >
            <SectionIcon className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left">{section.label}</span>
                <ChevronRight
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
              </>
            )}
          </button>
        ) : (
          !isCollapsed && (
            <div className="flex items-center gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              <SectionIcon className="w-[18px] h-[18px] flex-shrink-0 text-[var(--color-text-disabled)]" />
              <span className="flex-1 text-left">{section.label}</span>
            </div>
          )
        )}
        {shouldShowItems && (
          <div className="flex flex-col gap-0.5 px-2 mt-1">
            {section.items.map((item) => {
              const href = item.href.startsWith('/admin')
                ? item.href
                : item.href.replace(':orgId', organizationId ?? '');
              const isActive = pathname?.startsWith(href) ?? false;

              return (
                <NavItemComponent
                  key={item.id}
                  item={item}
                  isCollapsed={isCollapsed}
                  isActive={isActive}
                  organizationId={organizationId}
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
 * Single sidebar that adapts based on user.role
 * Replaces both CommandCenterSidebar and workspace layout sidebar
 */
const UnifiedSidebar: React.FC<UnifiedSidebarProps> = React.memo(
  ({
    user,
    organizationId,
    isCollapsed: externalIsCollapsed,
    onToggleCollapse,
    brandName = "AI Sales Platform",
    primaryColor = "#6366f1",
  }) => {
    const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const isCollapsed = externalIsCollapsed ?? internalIsCollapsed;

    // Get navigation sections based on user role
    // Uses getNavigationForRole() which HARD-GATES System section to platform_admin only
    const filteredSections = useMemo(() => {
      const roleSections = getNavigationForRole(user.role);
      // Apply permission-based filtering on top of role-based sections
      return filterNavigationByRole(roleSections, user.role);
    }, [user.role]);

    // Track expanded sections
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
      const initial: Record<string, boolean> = {};
      filteredSections.forEach((section) => {
        initial[section.id] = !(section.defaultCollapsed ?? false);
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
        platform_admin: "Platform Admin",
        owner: "Owner",
        admin: "Admin",
        manager: "Manager",
        employee: "Employee",
      };
      return badges[role];
    };

    const roleBadge = getRoleBadge(user.role);
    const isPlatformAdmin = user.role === 'platform_admin';

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
                        isPlatformAdmin
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
              } rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] flex items-center justify-center cursor-pointer transition-all hover:bg-[var(--color-bg-elevated)] hover:border-[var(--color-primary)]`}
              onClick={handleToggleCollapse}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-[var(--color-text-secondary)]" />
              )}
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              className="md:hidden absolute top-4 left-4 w-8 h-8 rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] flex items-center justify-center cursor-pointer transition-all hover:bg-[var(--color-bg-elevated)]"
              onClick={handleMobileClose}
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
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
                organizationId={organizationId}
              />
            ))}
          </nav>

          {/* Footer Info */}
          {!isCollapsed && (
            <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-bg-elevated)]">
              <div className="text-xs text-[var(--color-text-disabled)] text-center">
                {user.tenantId ? `Org: ${user.tenantId.slice(0, 8)}...` : "Platform View"}
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
