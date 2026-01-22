/**
 * Unified Navigation Configuration
 * Defines the complete navigation structure for the unified sidebar
 * Role-based visibility is controlled via requiredPermission fields
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
  ShoppingCart,
  Package,
  TrendingUp,
  DollarSign,
  Zap,
} from 'lucide-react';
import type { NavigationStructure, NavigationSection } from '@/types/unified-rbac';

/**
 * Complete navigation structure for the unified sidebar
 * Sections are filtered by role using filterNavigationByRole()
 */
export const UNIFIED_NAVIGATION: NavigationStructure = {
  sections: [
    // =======================================================================
    // SYSTEM SECTION (Platform Admin Only)
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
          href: '/dashboard/system',
          icon: Activity,
          requiredPermission: 'canViewSystemHealth',
        },
        {
          id: 'system-organizations',
          label: 'Organizations',
          href: '/admin/organizations',
          icon: Building2,
          requiredPermission: 'canManageAllOrganizations',
        },
        {
          id: 'system-users',
          label: 'All Users',
          href: '/admin/users',
          icon: Users,
          requiredPermission: 'canManageAllOrganizations',
        },
        {
          id: 'system-flags',
          label: 'Feature Flags',
          href: '/admin/system/flags',
          icon: Flag,
          requiredPermission: 'canManageFeatureFlags',
        },
        {
          id: 'system-logs',
          label: 'Audit Logs',
          href: '/admin/system/logs',
          icon: FileCode,
          requiredPermission: 'canViewAuditLogs',
        },
        {
          id: 'system-settings',
          label: 'System Settings',
          href: '/admin/system/settings',
          icon: Settings,
          requiredPermission: 'canManageSystemSettings',
        },
      ],
    },

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
          href: '/dashboard',
          icon: LayoutDashboard,
        },
        {
          id: 'analytics-overview',
          label: 'Analytics',
          href: '/dashboard/analytics',
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
          href: '/dashboard/sales/leads',
          icon: Target,
          requiredPermission: 'canViewLeads',
        },
        {
          id: 'deals',
          label: 'Deals',
          href: '/dashboard/sales/deals',
          icon: Handshake,
          requiredPermission: 'canViewDeals',
        },
        {
          id: 'voice-agents',
          label: 'Voice Agents',
          href: '/sales/voice-agents',
          icon: Mic,
          requiredPermission: 'canAccessVoiceAgents',
        },
        {
          id: 'sales-agent',
          label: 'AI Sales Agent',
          href: '/sales/ai-agent',
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
          href: '/dashboard/marketing/social',
          icon: Share2,
          requiredPermission: 'canManageSocialMedia',
        },
        {
          id: 'email-campaigns',
          label: 'Email Campaigns',
          href: '/dashboard/marketing/email',
          icon: Mail,
          requiredPermission: 'canManageEmailCampaigns',
        },
        {
          id: 'email-templates',
          label: 'Email Templates',
          href: '/dashboard/marketing/email-templates',
          icon: FileText,
          requiredPermission: 'canManageEmailCampaigns',
        },
        {
          id: 'website',
          label: 'Website',
          href: '/dashboard/marketing/website',
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
          href: '/dashboard/swarm',
          icon: GitBranch,
          requiredPermission: 'canAccessSwarmPanel',
        },
        {
          id: 'agent-training',
          label: 'Agent Training',
          href: '/dashboard/swarm/training',
          icon: GraduationCap,
          requiredPermission: 'canTrainAIAgents',
        },
        {
          id: 'agent-persona',
          label: 'Agent Persona',
          href: '/dashboard/swarm/persona',
          icon: UserCog,
          requiredPermission: 'canManageAIAgents',
        },
        {
          id: 'knowledge-base',
          label: 'Knowledge Base',
          href: '/dashboard/swarm/knowledge',
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
          href: '/dashboard/analytics',
          icon: BarChart3,
          requiredPermission: 'canViewReports',
        },
        {
          id: 'revenue',
          label: 'Revenue',
          href: '/dashboard/analytics/revenue',
          icon: DollarSign,
          requiredPermission: 'canViewReports',
        },
        {
          id: 'pipeline',
          label: 'Pipeline',
          href: '/dashboard/analytics/pipeline',
          icon: TrendingUp,
          requiredPermission: 'canViewReports',
        },
        {
          id: 'platform-analytics',
          label: 'Platform Analytics',
          href: '/dashboard/analytics/platform',
          icon: Activity,
          requiredPermission: 'canViewPlatformAnalytics',
        },
      ],
    },

    // =======================================================================
    // SETTINGS SECTION (Owner and Admin only)
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
          href: '/dashboard/settings',
          icon: Building2,
          requiredPermission: 'canManageOrganization',
        },
        {
          id: 'team-settings',
          label: 'Team',
          href: '/dashboard/settings/team',
          icon: Users,
          requiredPermission: 'canInviteUsers',
        },
        {
          id: 'api-keys',
          label: 'API Keys',
          href: '/dashboard/settings/api-keys',
          icon: Key,
          requiredPermission: 'canManageAPIKeys',
        },
        {
          id: 'integrations',
          label: 'Integrations',
          href: '/dashboard/settings/integrations',
          icon: Zap,
          requiredPermission: 'canManageIntegrations',
        },
        {
          id: 'billing',
          label: 'Billing',
          href: '/dashboard/settings/billing',
          icon: DollarSign,
          requiredPermission: 'canManageBilling',
        },
        {
          id: 'ecommerce',
          label: 'E-Commerce',
          href: '/dashboard/settings/ecommerce',
          icon: ShoppingCart,
          requiredPermission: 'canManageEcommerce',
        },
        {
          id: 'products',
          label: 'Products',
          href: '/dashboard/settings/products',
          icon: Package,
          requiredPermission: 'canManageProducts',
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
