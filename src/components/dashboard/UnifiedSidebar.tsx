"use client";

// Verification marker - confirms 11-section granular client UI is active
console.info("RESTORED_CLIENT_UI_v1");

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

/**
 * Admin theme colors for isolated theming
 * When provided, these override CSS variables on the fixed-positioned sidebar
 */
interface AdminThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  bgMain: string;
  bgPaper: string;
  bgElevated: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  borderLight: string;
  accent: string;
}

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

  /**
   * Admin context flag - when true, sidebar uses Admin-scoped theme variables
   * This enables theme isolation between Admin and Client workspaces
   */
  isAdminContext?: boolean;

  /**
   * Full Admin theme colors for fixed-position sidebar isolation
   * Required when isAdminContext=true for proper theme inheritance
   */
  adminThemeColors?: AdminThemeColors;
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

    // Use item's specific iconColor, fallback to default
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

    // Use section's specific iconColor, fallback to #666
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
 *
 * THEME ISOLATION:
 * - When isAdminContext=true, the sidebar inherits theme from Admin-scoped CSS variables
 * - When isAdminContext=false (default), uses standard CSS variables (may be overridden by org theme)
 * - The parent container (Admin layout) applies scoped CSS vars that override document.documentElement
 */
const UnifiedSidebar: React.FC<UnifiedSidebarProps> = React.memo(
  ({
    user,
    organizationId,
    isCollapsed: externalIsCollapsed,
    onToggleCollapse,
    brandName = "AI Sales Platform",
    primaryColor = "#6366f1",
    // When true, sidebar applies Admin theme CSS variables directly (for fixed positioning isolation)
    isAdminContext = false,
    adminThemeColors,
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

    // Track expanded sections - default to collapsed (closed)
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
            // Apply theme CSS variables directly for fixed positioning isolation
            // Fixed elements may not inherit from scoped parent containers
            ['--primary-color' as string]: primaryColor,
            ['--color-primary' as string]: adminThemeColors?.primary ?? primaryColor,
            ['--color-primary-light' as string]: adminThemeColors?.primaryLight ?? `${primaryColor}cc`,
            ['--color-primary-dark' as string]: adminThemeColors?.primaryDark ?? primaryColor,
            // When in Admin context, apply full theme colors for proper isolation
            ...(isAdminContext && adminThemeColors ? {
              ['--color-bg-main' as string]: adminThemeColors.bgMain,
              ['--color-bg-paper' as string]: adminThemeColors.bgPaper,
              ['--color-bg-elevated' as string]: adminThemeColors.bgElevated,
              ['--color-text-primary' as string]: adminThemeColors.textPrimary,
              ['--color-text-secondary' as string]: adminThemeColors.textSecondary,
              ['--color-text-disabled' as string]: adminThemeColors.textDisabled,
              ['--color-border-light' as string]: adminThemeColors.borderLight,
              ['--color-accent' as string]: adminThemeColors.accent,
              ['--color-background' as string]: adminThemeColors.bgMain,
            } : {}),
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
