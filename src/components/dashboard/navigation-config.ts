/**
 * Unified Navigation Configuration
 * Defines the complete navigation structure for the unified sidebar
 * Role-based visibility is controlled via requiredPermission fields
 *
 * ARCHITECTURE NOTE: SYSTEM section is positioned at the bottom for platform_admin users
 * as it contains administrative tools that should be visually separated from daily operations.
 */

import {
  LayoutDashboard,
  Building2,
  Users,
  Target,
  Handshake,
  Bot,
  Share2,
  GitBranch,
  Mail,
  FileText,
  Mic,
  BarChart3,
  Settings,
  Activity,
  Key,
  Flag,
  FileCode,
  Wrench,
  GraduationCap,
  UserCog,
  Book,
  Package,
  TrendingUp,
  DollarSign,
  Zap,
} from 'lucide-react';
import type { NavigationStructure, NavigationSection } from '@/types/unified-rbac';
import { dashboardRoutes, legacyAdminRoutes, pendingDashboardRoutes } from '@/lib/routes';

/**
 * Complete navigation structure for the unified sidebar
 * Sections are filtered by role using filterNavigationByRole()
 */
export const UNIFIED_NAVIGATION: NavigationStructure = {
  sections: [
    // =======================================================================
    // DASHBOARD SECTION (All Roles)
    // =======================================================================
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      allowedRoles: ['platform_admin', 'owner', 'admin', 'manager', 'employee'],
      collapsible: false,
      items: [
        {
          id: 'overview',
          label: 'Overview',
          href: dashboardRoutes.overview(),
          icon: LayoutDashboard,
        },
        {
          id: 'analytics-overview',
          label: 'Analytics',
          href: dashboardRoutes.analytics(),
          icon: TrendingUp,
          requiredPermission: 'canViewReports',
        },
      ],
    },

    // =======================================================================
    // SALES SECTION (All Roles - Some items restricted)
    // =======================================================================
    {
      id: 'sales',
      label: 'Sales',
      icon: Target,
      allowedRoles: ['platform_admin', 'owner', 'admin', 'manager', 'employee'],
      collapsible: true,
      defaultCollapsed: false,
      items: [
        {
          id: 'leads',
          label: 'Leads',
          href: dashboardRoutes.salesLeads(),
          icon: Target,
          requiredPermission: 'canViewLeads',
        },
        {
          id: 'deals',
          label: 'Deals',
          href: dashboardRoutes.salesDeals(),
          icon: Handshake,
          requiredPermission: 'canViewDeals',
        },
        {
          id: 'voice-agents',
          label: 'Voice Agents',
          href: legacyAdminRoutes.voiceAgents(),
          icon: Mic,
          requiredPermission: 'canAccessVoiceAgents',
        },
        {
          id: 'sales-agent',
          label: 'AI Sales Agent',
          href: legacyAdminRoutes.aiAgent(),
          icon: Bot,
          requiredPermission: 'canManageLeads',
        },
      ],
    },

    // =======================================================================
    // MARKETING SECTION (Admin+ and Manager)
    // =======================================================================
    {
      id: 'marketing',
      label: 'Marketing',
      icon: Share2,
      allowedRoles: ['platform_admin', 'owner', 'admin', 'manager'],
      collapsible: true,
      defaultCollapsed: false,
      items: [
        {
          id: 'social-media',
          label: 'Social Media',
          href: dashboardRoutes.marketingSocial(),
          icon: Share2,
          requiredPermission: 'canManageSocialMedia',
        },
        {
          id: 'email-campaigns',
          label: 'Email Campaigns',
          href: dashboardRoutes.marketingEmail(),
          icon: Mail,
          requiredPermission: 'canManageEmailCampaigns',
        },
        {
          id: 'email-templates',
          label: 'Email Templates',
          href: pendingDashboardRoutes.marketingEmailTemplates(),
          icon: FileText,
          requiredPermission: 'canManageEmailCampaigns',
        },
        {
          id: 'website',
          label: 'Website',
          href: pendingDashboardRoutes.marketingWebsite(),
          icon: Zap,
          requiredPermission: 'canManageWebsite',
        },
      ],
    },

    // =======================================================================
    // SWARM SECTION (Owner and Admin only)
    // =======================================================================
    {
      id: 'swarm',
      label: 'AI Swarm',
      icon: GitBranch,
      allowedRoles: ['platform_admin', 'owner', 'admin'],
      collapsible: true,
      defaultCollapsed: false,
      items: [
        {
          id: 'swarm-control',
          label: 'Swarm Control',
          href: dashboardRoutes.swarm(),
          icon: GitBranch,
          requiredPermission: 'canAccessSwarmPanel',
        },
        {
          id: 'agent-training',
          label: 'Agent Training',
          href: pendingDashboardRoutes.swarmTraining(),
          icon: GraduationCap,
          requiredPermission: 'canTrainAIAgents',
        },
        {
          id: 'agent-persona',
          label: 'Agent Persona',
          href: pendingDashboardRoutes.swarmPersona(),
          icon: UserCog,
          requiredPermission: 'canManageAIAgents',
        },
        {
          id: 'knowledge-base',
          label: 'Knowledge Base',
          href: pendingDashboardRoutes.swarmKnowledge(),
          icon: Book,
          requiredPermission: 'canManageAIAgents',
        },
      ],
    },

    // =======================================================================
    // ANALYTICS SECTION (All Roles - Manager+ can create)
    // =======================================================================
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      allowedRoles: ['platform_admin', 'owner', 'admin', 'manager', 'employee'],
      collapsible: true,
      defaultCollapsed: false,
      items: [
        {
          id: 'reports',
          label: 'Reports',
          href: dashboardRoutes.analytics(),
          icon: BarChart3,
          requiredPermission: 'canViewReports',
        },
        {
          id: 'revenue',
          label: 'Revenue',
          href: pendingDashboardRoutes.analyticsRevenue(),
          icon: DollarSign,
          requiredPermission: 'canViewReports',
        },
        {
          id: 'pipeline',
          label: 'Pipeline',
          href: pendingDashboardRoutes.analyticsPipeline(),
          icon: TrendingUp,
          requiredPermission: 'canViewReports',
        },
        {
          id: 'platform-analytics',
          label: 'Platform Analytics',
          href: pendingDashboardRoutes.analyticsPlatform(),
          icon: Activity,
          requiredPermission: 'canViewPlatformAnalytics',
        },
      ],
    },

    // =======================================================================
    // SETTINGS SECTION (Owner and Admin only)
    // NOTE: Products points to /admin/merchandiser (E-Commerce functionality)
    // =======================================================================
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      allowedRoles: ['platform_admin', 'owner', 'admin'],
      collapsible: true,
      defaultCollapsed: true,
      items: [
        {
          id: 'org-settings',
          label: 'Organization',
          href: dashboardRoutes.settings(),
          icon: Building2,
          requiredPermission: 'canManageOrganization',
        },
        {
          id: 'team-settings',
          label: 'Team',
          href: pendingDashboardRoutes.settingsTeam(),
          icon: Users,
          requiredPermission: 'canInviteUsers',
        },
        {
          id: 'products',
          label: 'Products',
          href: pendingDashboardRoutes.settingsProducts(),
          icon: Package,
          requiredPermission: 'canManageProducts',
        },
        {
          id: 'api-keys',
          label: 'API Keys',
          href: pendingDashboardRoutes.settingsApiKeys(),
          icon: Key,
          requiredPermission: 'canManageAPIKeys',
        },
        {
          id: 'integrations',
          label: 'Integrations',
          href: pendingDashboardRoutes.settingsIntegrations(),
          icon: Zap,
          requiredPermission: 'canManageIntegrations',
        },
        {
          id: 'billing',
          label: 'Billing',
          href: pendingDashboardRoutes.settingsBilling(),
          icon: DollarSign,
          requiredPermission: 'canManageBilling',
        },
      ],
    },

    // =======================================================================
    // SYSTEM SECTION (Platform Admin Only)
    // CRITICAL: This section MUST remain at the ABSOLUTE BOTTOM
    // Positioned last to visually separate platform admin tools from daily operations
    // =======================================================================
    {
      id: 'system',
      label: 'System',
      icon: Wrench,
      allowedRoles: ['platform_admin'],
      collapsible: true,
      defaultCollapsed: false,
      items: [
        {
          id: 'system-overview',
          label: 'System Overview',
          href: dashboardRoutes.system(),
          icon: Activity,
          requiredPermission: 'canViewSystemHealth',
        },
        {
          id: 'system-organizations',
          label: 'Organizations',
          href: legacyAdminRoutes.organizations(),
          icon: Building2,
          requiredPermission: 'canManageAllOrganizations',
        },
        {
          id: 'system-users',
          label: 'All Users',
          href: legacyAdminRoutes.users(),
          icon: Users,
          requiredPermission: 'canManageAllOrganizations',
        },
        {
          id: 'system-flags',
          label: 'Feature Flags',
          href: legacyAdminRoutes.systemFlags(),
          icon: Flag,
          requiredPermission: 'canManageFeatureFlags',
        },
        {
          id: 'system-logs',
          label: 'Audit Logs',
          href: legacyAdminRoutes.systemLogs(),
          icon: FileCode,
          requiredPermission: 'canViewAuditLogs',
        },
        {
          id: 'system-settings',
          label: 'System Settings',
          href: legacyAdminRoutes.systemSettings(),
          icon: Settings,
          requiredPermission: 'canManageSystemSettings',
        },
      ],
    },
  ],
};

/**
 * Helper to get a specific section by ID
 */
export function getNavigationSection(sectionId: string): NavigationSection | undefined {
  return UNIFIED_NAVIGATION.sections.find((section) => section.id === sectionId);
}

/**
 * Helper to get all sections for a specific category
 */
export function getNavigationByCategory(category: string): NavigationSection[] {
  return UNIFIED_NAVIGATION.sections.filter((section) => section.id === category);
}
