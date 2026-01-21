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
        className="flex items-center gap-3 px-4 py-2.5 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-primary)] transition-colors"
        title={isCollapsed ? item.label : item.tooltip}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!isCollapsed && (
          <>
            <span className="flex-1 text-[15px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
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

    if (isSingleItem) {
      return (
        <div className="mb-2">
          {!isCollapsed && (
            <div className="flex items-center gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              <CategoryIcon className="w-[18px] h-[18px] flex-shrink-0 text-[var(--color-text-disabled)]" />
              <span className="flex-1 text-left">{category.label}</span>
            </div>
          )}
          <div className="flex flex-col gap-0.5 px-2">
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
      <div className="mb-2">
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
          onClick={onToggle}
          title={isCollapsed ? category.label : undefined}
        >
          <CategoryIcon className="w-[18px] h-[18px] flex-shrink-0 text-[var(--color-text-disabled)]" />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left">{category.label}</span>
              <ChevronRight
                className={`w-4 h-4 transition-transform duration-200 text-[var(--color-text-disabled)] ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
            </>
          )}
        </button>
        {isExpanded && !isCollapsed && (
          <div className="flex flex-col gap-0.5 px-2">
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
    const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
    const isCollapsed = externalIsCollapsed ?? internalIsCollapsed;

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
      <aside
        className={`fixed left-0 top-0 h-screen bg-[var(--color-bg-paper)] border-r border-[var(--color-border-light)] flex flex-col transition-all duration-300 z-[1000] overflow-hidden ${
          isCollapsed ? "w-16" : "w-[280px]"
        } max-md:transform max-md:${isCollapsed ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-border-light)] bg-[var(--color-bg-elevated)] relative">
          {!isCollapsed && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Wrench className="w-6 h-6 text-[var(--color-primary)]" />
                <h2 className="text-xl font-bold text-[var(--color-text-primary)] m-0">
                  Command Center
                </h2>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[var(--color-bg-paper)] rounded-lg border border-[var(--color-border-light)]">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center font-bold text-white text-base flex-shrink-0">
                  {adminUser.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--color-text-primary)] whitespace-nowrap overflow-hidden text-ellipsis">
                    {adminUser.displayName}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">
                    {adminUser.role}
                  </div>
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            className={`${
              isCollapsed
                ? "static w-10 h-10 mx-auto"
                : "absolute top-4 right-4 w-8 h-8"
            } rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] flex items-center justify-center cursor-pointer transition-all hover:bg-[var(--color-bg-elevated)] hover:border-[var(--color-primary)]`}
            onClick={handleToggleCollapse}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-[var(--color-text-secondary)]" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-thin scrollbar-thumb-[var(--color-border-light)] scrollbar-track-transparent hover:scrollbar-thumb-[var(--color-text-disabled)]">
          {navigationStructure.map((category, index) => {
            const isLastCategory =
              category.id === "jasper-training" &&
              index === navigationStructure.length - 1;

            return (
              <div
                key={category.id}
                className={
                  isLastCategory
                    ? "mt-auto pt-4 border-t border-[var(--color-border-light)]"
                    : ""
                }
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
          className="hidden max-md:flex fixed bottom-4 right-4 w-14 h-14 rounded-full bg-[var(--color-primary)] border-0 shadow-lg items-center justify-center cursor-pointer z-[1001] transition-transform hover:scale-105 active:scale-95"
          onClick={handleToggleCollapse}
          aria-label="Toggle sidebar"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>
      </aside>
    );
  }
);

CommandCenterSidebar.displayName = "CommandCenterSidebar";

export default CommandCenterSidebar;
