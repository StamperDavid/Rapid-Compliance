"use client";

import React, { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Users,
  Target,
  Handshake,
  Bot,
  RotateCcw,
  Share2,
  GitBranch,
  Mail,
  FileText,
  Mic,
  Settings as SettingsIcon,
  BarChart3,
  DollarSign,
  TrendingUp,
  Activity,
  Key,
  Flag,
  FileCode,
  Wrench,
  GraduationCap,
  UserCog,
  Book,
  ChevronRight,
  ChevronLeft,
  Menu,
} from "lucide-react";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface AdminUser {
  displayName: string;
  role: string;
}

interface CommandCenterSidebarProps {
  organizationId: string;
  adminUser: AdminUser;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  tooltip?: string;
}

interface NavCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  defaultExpanded?: boolean;
}

// ============================================================================
// NAVIGATION STRUCTURE
// ============================================================================

const useNavigationStructure = (organizationId: string): NavCategory[] => {
  return useMemo(
    () => [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        defaultExpanded: true,
        items: [
          {
            id: "overview",
            label: "Overview",
            href: `/admin/command-center?org=${organizationId}`,
            icon: LayoutDashboard,
            tooltip: "Command Center Overview",
          },
        ],
      },
      {
        id: "clients-orgs",
        label: "Clients & Organizations",
        icon: Building2,
        items: [
          {
            id: "organizations",
            label: "Organizations",
            href: `/admin/organizations?org=${organizationId}`,
            icon: Building2,
            tooltip: "Manage Organizations",
          },
          {
            id: "users",
            label: "Users",
            href: `/admin/users?org=${organizationId}`,
            icon: Users,
            tooltip: "Manage Users",
          },
        ],
      },
      {
        id: "leads-sales",
        label: "Leads & Sales",
        icon: Target,
        items: [
          {
            id: "leads",
            label: "Leads",
            href: `/admin/leads?org=${organizationId}`,
            icon: Target,
            tooltip: "Lead Management",
          },
          {
            id: "deals",
            label: "Deals",
            href: `/admin/deals?org=${organizationId}`,
            icon: Handshake,
            tooltip: "Deal Pipeline",
          },
          {
            id: "sales-agent",
            label: "Sales Agent",
            href: `/admin/sales-agent?org=${organizationId}`,
            icon: Bot,
            tooltip: "AI Sales Agent",
          },
          {
            id: "recovery",
            label: "Recovery",
            href: `/admin/recovery?org=${organizationId}`,
            icon: RotateCcw,
            tooltip: "Lead Recovery",
          },
        ],
      },
      {
        id: "social-media",
        label: "Social Media",
        icon: Share2,
        items: [
          {
            id: "social",
            label: "Social Posts",
            href: `/admin/social?org=${organizationId}`,
            icon: Share2,
            tooltip: "Social Media Management",
          },
          {
            id: "swarm",
            label: "Swarm Control",
            href: `/admin/swarm?org=${organizationId}`,
            icon: GitBranch,
            tooltip: "Agent Swarm Control Center",
          },
        ],
      },
      {
        id: "email-marketing",
        label: "Email Marketing",
        icon: Mail,
        items: [
          {
            id: "campaigns",
            label: "Campaigns",
            href: `/admin/email-campaigns?org=${organizationId}`,
            icon: Mail,
            tooltip: "Email Campaigns",
          },
          {
            id: "templates",
            label: "Templates",
            href: `/admin/email-templates?org=${organizationId}`,
            icon: FileText,
            tooltip: "Email Templates",
          },
        ],
      },
      {
        id: "ai-voice",
        label: "AI Voice Agents",
        icon: Mic,
        items: [
          {
            id: "voice-settings",
            label: "Voice Settings",
            href: `/admin/voice-settings?org=${organizationId}`,
            icon: SettingsIcon,
            tooltip: "Voice Configuration",
          },
          {
            id: "training",
            label: "Training",
            href: `/admin/voice-training?org=${organizationId}`,
            icon: GraduationCap,
            tooltip: "Voice Agent Training",
          },
        ],
      },
      {
        id: "analytics",
        label: "Analytics",
        icon: BarChart3,
        items: [
          {
            id: "usage",
            label: "Usage",
            href: `/admin/analytics/usage?org=${organizationId}`,
            icon: Activity,
            tooltip: "Usage Analytics",
          },
          {
            id: "revenue",
            label: "Revenue",
            href: `/admin/analytics/revenue?org=${organizationId}`,
            icon: DollarSign,
            tooltip: "Revenue Analytics",
          },
          {
            id: "pipeline",
            label: "Pipeline",
            href: `/admin/analytics/pipeline?org=${organizationId}`,
            icon: TrendingUp,
            tooltip: "Pipeline Analytics",
          },
        ],
      },
      {
        id: "system",
        label: "System",
        icon: Wrench,
        items: [
          {
            id: "health",
            label: "Health",
            href: `/admin/system/health?org=${organizationId}`,
            icon: Activity,
            tooltip: "System Health",
          },
          {
            id: "api-keys",
            label: "API Keys",
            href: `/admin/system/api-keys?org=${organizationId}`,
            icon: Key,
            tooltip: "API Key Management",
          },
          {
            id: "flags",
            label: "Feature Flags",
            href: `/admin/system/flags?org=${organizationId}`,
            icon: Flag,
            tooltip: "Feature Flag Control",
          },
          {
            id: "logs",
            label: "Logs",
            href: `/admin/system/logs?org=${organizationId}`,
            icon: FileCode,
            tooltip: "System Logs",
          },
          {
            id: "settings",
            label: "Settings",
            href: `/admin/system/settings?org=${organizationId}`,
            icon: SettingsIcon,
            tooltip: "System Settings",
          },
        ],
      },
      {
        id: "jasper-training",
        label: "Jasper Training Lab",
        icon: GraduationCap,
        items: [
          {
            id: "persona",
            label: "Persona",
            href: `/admin/jasper/persona?org=${organizationId}`,
            icon: UserCog,
            tooltip: "Agent Persona Configuration",
          },
          {
            id: "jasper-training",
            label: "Training",
            href: `/admin/jasper/training?org=${organizationId}`,
            icon: GraduationCap,
            tooltip: "Agent Training",
          },
          {
            id: "knowledge",
            label: "Knowledge Base",
            href: `/admin/jasper/knowledge?org=${organizationId}`,
            icon: Book,
            tooltip: "Knowledge Base Management",
          },
        ],
      },
    ],
    [organizationId]
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface NavItemComponentProps {
  item: NavItem;
  isCollapsed: boolean;
}

const NavItemComponent = React.memo<NavItemComponentProps>(
  ({ item, isCollapsed }) => {
    const Icon = item.icon;

    return (
      <Link
        href={item.href}
        className="nav-item"
        title={isCollapsed ? item.label : item.tooltip}
      >
        <div className="nav-item-content">
          <Icon className="nav-item-icon" />
          {!isCollapsed && (
            <>
              <span className="nav-item-label">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="nav-item-badge">{item.badge}</span>
              )}
            </>
          )}
        </div>
      </Link>
    );
  }
);

NavItemComponent.displayName = "NavItemComponent";

interface NavCategoryComponentProps {
  category: NavCategory;
  isCollapsed: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

const NavCategoryComponent = React.memo<NavCategoryComponentProps>(
  ({ category, isCollapsed, isExpanded, onToggle }) => {
    const CategoryIcon = category.icon;
    const isSingleItem = category.items.length === 1;

    // Single-item categories (like Dashboard) don't need expansion
    if (isSingleItem) {
      return (
        <div className="nav-category">
          {!isCollapsed && (
            <div className="nav-category-header-static">
              <CategoryIcon className="nav-category-icon" />
              <span className="nav-category-label">{category.label}</span>
            </div>
          )}
          <div className="nav-items">
            {category.items.map((item) => (
              <NavItemComponent
                key={item.id}
                item={item}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="nav-category">
        <button
          type="button"
          className="nav-category-header"
          onClick={onToggle}
          title={isCollapsed ? category.label : undefined}
        >
          <div className="nav-category-header-content">
            <CategoryIcon className="nav-category-icon" />
            {!isCollapsed && (
              <>
                <span className="nav-category-label">{category.label}</span>
                <ChevronRight
                  className={`nav-category-chevron ${
                    isExpanded ? "expanded" : ""
                  }`}
                />
              </>
            )}
          </div>
        </button>
        {isExpanded && !isCollapsed && (
          <div className="nav-items">
            {category.items.map((item) => (
              <NavItemComponent
                key={item.id}
                item={item}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);

NavCategoryComponent.displayName = "NavCategoryComponent";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const CommandCenterSidebar: React.FC<CommandCenterSidebarProps> = React.memo(
  ({
    organizationId,
    adminUser,
    isCollapsed: externalIsCollapsed,
    onToggleCollapse,
  }) => {
    // Local state for collapsed/expanded
    const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
    const isCollapsed = externalIsCollapsed ?? internalIsCollapsed;

    // Track which categories are expanded
    const navigationStructure = useNavigationStructure(organizationId);
    const [expandedCategories, setExpandedCategories] = useState<
      Record<string, boolean>
    >(() => {
      const initial: Record<string, boolean> = {};
      navigationStructure.forEach((category) => {
        initial[category.id] = category.defaultExpanded ?? false;
      });
      return initial;
    });

    // Handlers
    const handleToggleCollapse = useCallback(() => {
      if (onToggleCollapse) {
        onToggleCollapse();
      } else {
        setInternalIsCollapsed((prev) => !prev);
      }
    }, [onToggleCollapse]);

    const handleToggleCategory = useCallback((categoryId: string) => {
      setExpandedCategories((prev) => ({
        ...prev,
        [categoryId]: !prev[categoryId],
      }));
    }, []);

    return (
      <aside className={`command-center-sidebar ${isCollapsed ? "collapsed" : ""}`}>
        {/* Header */}
        <div className="sidebar-header">
          {!isCollapsed && (
            <div className="sidebar-header-content">
              <div className="sidebar-title">
                <Wrench className="sidebar-title-icon" />
                <h2 className="sidebar-title-text">Command Center</h2>
              </div>
              <div className="sidebar-user">
                <div className="sidebar-user-avatar">
                  {adminUser.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">{adminUser.displayName}</div>
                  <div className="sidebar-user-role">{adminUser.role}</div>
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={handleToggleCollapse}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="toggle-icon" />
            ) : (
              <ChevronLeft className="toggle-icon" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navigationStructure.map((category, index) => {
            // Jasper Training Lab at bottom
            const isLastCategory =
              category.id === "jasper-training" &&
              index === navigationStructure.length - 1;

            return (
              <div
                key={category.id}
                className={isLastCategory ? "nav-category-bottom" : ""}
              >
                <NavCategoryComponent
                  category={category}
                  isCollapsed={isCollapsed}
                  isExpanded={expandedCategories[category.id] ?? false}
                  onToggle={() => handleToggleCategory(category.id)}
                />
              </div>
            );
          })}
        </nav>

        {/* Mobile Toggle */}
        <button
          type="button"
          className="sidebar-mobile-toggle"
          onClick={handleToggleCollapse}
          aria-label="Toggle sidebar"
        >
          <Menu className="mobile-toggle-icon" />
        </button>

        {/* Styles */}
        <style jsx>{`
          .command-center-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            height: 100vh;
            width: 280px;
            background: var(--color-bg-paper);
            border-right: 1px solid var(--color-border);
            display: flex;
            flex-direction: column;
            transition: width 0.3s ease, transform 0.3s ease;
            z-index: 1000;
            overflow: hidden;
          }

          .command-center-sidebar.collapsed {
            width: 64px;
          }

          /* Header */
          .sidebar-header {
            padding: 1.5rem 1rem;
            border-bottom: 1px solid var(--color-border);
            background: var(--color-bg-elevated);
            position: relative;
          }

          .sidebar-header-content {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .sidebar-title {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }

          .sidebar-title-icon {
            width: 24px;
            height: 24px;
            color: var(--color-primary);
          }

          .sidebar-title-text {
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--color-text-primary);
            margin: 0;
          }

          .sidebar-user {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem;
            background: var(--color-bg-paper);
            border-radius: 8px;
            border: 1px solid var(--color-border);
          }

          .sidebar-user-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            color: white;
            font-size: 1rem;
            flex-shrink: 0;
          }

          .sidebar-user-info {
            flex: 1;
            min-width: 0;
          }

          .sidebar-user-name {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--color-text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .sidebar-user-role {
            font-size: 0.75rem;
            color: var(--color-text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .sidebar-collapse-toggle {
            position: absolute;
            top: 1rem;
            right: 1rem;
            width: 32px;
            height: 32px;
            border-radius: 6px;
            border: 1px solid var(--color-border);
            background: var(--color-bg-paper);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .sidebar-collapse-toggle:hover {
            background: var(--color-bg-elevated);
            border-color: var(--color-primary);
          }

          .toggle-icon {
            width: 16px;
            height: 16px;
            color: var(--color-text-secondary);
          }

          .collapsed .sidebar-collapse-toggle {
            position: static;
            width: 40px;
            height: 40px;
            margin: 0 auto;
          }

          /* Navigation */
          .sidebar-nav {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 1rem 0;
          }

          .sidebar-nav::-webkit-scrollbar {
            width: 6px;
          }

          .sidebar-nav::-webkit-scrollbar-track {
            background: transparent;
          }

          .sidebar-nav::-webkit-scrollbar-thumb {
            background: var(--color-border);
            border-radius: 3px;
          }

          .sidebar-nav::-webkit-scrollbar-thumb:hover {
            background: var(--color-text-disabled);
          }

          /* Category */
          .nav-category {
            margin-bottom: 0.5rem;
          }

          .nav-category-bottom {
            margin-top: auto;
            padding-top: 1rem;
            border-top: 1px solid var(--color-border);
          }

          .nav-category-header,
          .nav-category-header-static {
            width: 100%;
            padding: 0.75rem 1rem;
            background: transparent;
            border: none;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            cursor: pointer;
            transition: background 0.2s ease;
            color: var(--color-text-secondary);
            font-size: 0.875rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .nav-category-header-static {
            cursor: default;
            padding-bottom: 0.5rem;
          }

          .nav-category-header:hover {
            background: var(--color-bg-elevated);
          }

          .nav-category-header-content {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex: 1;
          }

          .nav-category-icon {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
            color: var(--color-text-disabled);
          }

          .nav-category-label {
            flex: 1;
            text-align: left;
          }

          .nav-category-chevron {
            width: 16px;
            height: 16px;
            transition: transform 0.2s ease;
            color: var(--color-text-disabled);
          }

          .nav-category-chevron.expanded {
            transform: rotate(90deg);
          }

          .collapsed .nav-category-header {
            justify-content: center;
            padding: 0.75rem;
          }

          /* Nav Items */
          .nav-items {
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding: 0 0.5rem;
          }

          .collapsed .nav-items {
            padding: 0;
          }

          :global(.nav-item) {
            display: block;
            text-decoration: none;
            border-radius: 6px;
            transition: all 0.2s ease;
          }

          :global(.nav-item:hover) {
            background: var(--color-bg-elevated);
          }

          :global(.nav-item:active) {
            background: var(--color-primary-dark);
          }

          .nav-item-content {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.625rem 1rem;
          }

          .collapsed .nav-item-content {
            justify-content: center;
            padding: 0.75rem;
          }

          :global(.nav-item-icon) {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
            color: var(--color-text-secondary);
            transition: color 0.2s ease;
          }

          :global(.nav-item:hover .nav-item-icon) {
            color: var(--color-primary);
          }

          .nav-item-label {
            flex: 1;
            font-size: 0.9375rem;
            font-weight: 500;
            color: var(--color-text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .nav-item-badge {
            background: var(--color-primary);
            color: white;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 0.125rem 0.5rem;
            border-radius: 12px;
            min-width: 20px;
            text-align: center;
          }

          /* Mobile Toggle */
          .sidebar-mobile-toggle {
            display: none;
            position: fixed;
            bottom: 1rem;
            right: 1rem;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: var(--color-primary);
            border: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 1001;
            transition: transform 0.2s ease;
          }

          .sidebar-mobile-toggle:hover {
            transform: scale(1.05);
          }

          .sidebar-mobile-toggle:active {
            transform: scale(0.95);
          }

          :global(.mobile-toggle-icon) {
            width: 24px;
            height: 24px;
            color: white;
          }

          /* Responsive */
          @media (max-width: 768px) {
            .command-center-sidebar {
              transform: translateX(-100%);
            }

            .command-center-sidebar.collapsed {
              transform: translateX(0);
              width: 280px;
            }

            .sidebar-mobile-toggle {
              display: flex;
            }

            .sidebar-collapse-toggle {
              display: none;
            }
          }

          /* Active state (would be set via className based on current route) */
          :global(.nav-item.active) {
            background: rgba(99, 102, 241, 0.1);
          }

          :global(.nav-item.active .nav-item-icon) {
            color: var(--color-primary);
          }

          :global(.nav-item.active .nav-item-label) {
            color: var(--color-primary);
            font-weight: 600;
          }
        `}</style>
      </aside>
    );
  }
);

CommandCenterSidebar.displayName = "CommandCenterSidebar";

export default CommandCenterSidebar;
