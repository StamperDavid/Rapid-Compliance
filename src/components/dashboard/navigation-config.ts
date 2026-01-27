/**
 * Unified Navigation Configuration
 * Defines the complete navigation structure for the unified sidebar
 * Role-based visibility is controlled via allowedRoles and requiredPermission fields
 *
 * ARCHITECTURE NOTES:
 * - 11 OPERATIONAL SECTIONS: Command Center, CRM, Lead Gen, Outbound, Automation,
 *   Content Factory, AI Workforce, E-Commerce, Analytics, Website, Settings
 * - 1 SYSTEM SECTION: Platform admin only tools (positioned at absolute bottom)
 * - All operational sections include platform_admin + appropriate client roles
 * - Routes use :orgId placeholder - replace with actual orgId at render time
 *
 * GOD-MODE: platform_admin sees all 12 sections simultaneously
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
  Book,
  Package,
  TrendingUp,
  DollarSign,
  MessageSquare,
  ClipboardList,
  Search,
  Star,
  Send,
  Phone,
  Workflow,
  TestTube,
  Video,
  FileSignature,
  Swords,
  Database,
  SlidersHorizontal,
  ShoppingCart,
  Store,
  Globe,
  PenTool,
  Link,
  SearchCheck,
  Palette,
  Plug,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import type { NavigationStructure, NavigationSection, AccountRole } from '@/types/unified-rbac';

// =============================================================================
// ROUTE BUILDERS - Workspace routes with :orgId placeholder
// =============================================================================

/**
 * Workspace route builders
 * Use :orgId placeholder - replace at render time with actual organization ID
 */
const ws = {
  // Command Center
  workforce: '/workspace/:orgId/workforce',
  dashboard: '/workspace/:orgId/dashboard',
  conversations: '/workspace/:orgId/conversations',

  // CRM
  leads: '/workspace/:orgId/leads',
  deals: '/workspace/:orgId/deals',
  contacts: '/workspace/:orgId/contacts',
  livingLedger: '/workspace/:orgId/living-ledger',

  // Lead Gen
  forms: '/workspace/:orgId/forms',
  leadResearch: '/workspace/:orgId/leads/research',
  leadScoring: '/workspace/:orgId/lead-scoring',

  // Outbound
  sequences: '/workspace/:orgId/outbound/sequences',
  emailCampaigns: '/workspace/:orgId/email/campaigns',
  emailWriter: '/workspace/:orgId/email-writer',
  nurture: '/workspace/:orgId/nurture',
  calls: '/workspace/:orgId/calls',

  // Automation
  workflows: '/workspace/:orgId/workflows',
  abTests: '/workspace/:orgId/ab-tests',

  // Content Factory
  videoStudio: '/workspace/:orgId/content/video',
  socialMedia: '/workspace/:orgId/social/campaigns',
  proposals: '/workspace/:orgId/proposals/builder',
  battlecards: '/workspace/:orgId/battlecards',

  // AI Workforce
  agentTraining: '/workspace/:orgId/settings/ai-agents/training',
  voiceAiLab: '/workspace/:orgId/voice/training',
  socialAiLab: '/workspace/:orgId/social/training',
  seoAiLab: '/workspace/:orgId/seo/training',
  datasets: '/workspace/:orgId/ai/datasets',
  fineTuning: '/workspace/:orgId/ai/fine-tuning',

  // E-Commerce
  products: '/workspace/:orgId/products',
  orders: '/workspace/:orgId/analytics/ecommerce',
  storefront: '/workspace/:orgId/settings/storefront',

  // Analytics
  analyticsOverview: '/workspace/:orgId/analytics',
  analyticsRevenue: '/workspace/:orgId/analytics/revenue',
  analyticsPipeline: '/workspace/:orgId/analytics/pipeline',
  sequenceAnalytics: '/workspace/:orgId/sequences/analytics',

  // Website
  websitePages: '/workspace/:orgId/website/pages',
  websiteBlog: '/workspace/:orgId/website/blog',
  websiteDomains: '/workspace/:orgId/website/domains',
  websiteSeo: '/workspace/:orgId/website/seo',
  websiteSettings: '/workspace/:orgId/website/settings',

  // Settings
  settings: '/workspace/:orgId/settings',
  integrations: '/workspace/:orgId/integrations',
  apiKeys: '/workspace/:orgId/settings/api-keys',
  billing: '/workspace/:orgId/settings/billing',
  team: '/workspace/:orgId/settings/users',
} as const;

/**
 * Admin route builders (System section - platform_admin only)
 */
const admin = {
  systemOverview: '/admin/system/health',
  organizations: '/admin/organizations',
  users: '/admin/users',
  featureFlags: '/admin/system/flags',
  auditLogs: '/admin/system/logs',
  systemSettings: '/admin/system/settings',
} as const;

// =============================================================================
// ROLE GROUPS - Common role combinations for allowedRoles
// =============================================================================

/** All roles can access */
const ALL_ROLES: AccountRole[] = ['platform_admin', 'owner', 'admin', 'manager', 'employee'];

/** Admin+ roles (owner, admin, and platform_admin) */
const ADMIN_PLUS: AccountRole[] = ['platform_admin', 'owner', 'admin'];

/** Manager+ roles */
const MANAGER_PLUS: AccountRole[] = ['platform_admin', 'owner', 'admin', 'manager'];

/** Platform admin only */
const PLATFORM_ADMIN_ONLY: AccountRole[] = ['platform_admin'];

// =============================================================================
// UNIFIED NAVIGATION STRUCTURE
// =============================================================================

/**
 * Complete navigation structure for the unified sidebar
 * Sections are filtered by role using filterNavigationByRole()
 *
 * Section order:
 * 1-11: Operational sections (accessible by client roles + platform_admin)
 * 12: System section (platform_admin only - always at bottom)
 */
export const UNIFIED_NAVIGATION: NavigationStructure = {
  sections: [
    // =========================================================================
    // 1. COMMAND CENTER SECTION
    // =========================================================================
    {
      id: 'command_center',
      label: 'Command Center',
      icon: LayoutDashboard as LucideIcon,
      allowedRoles: ALL_ROLES,
      collapsible: false,
      items: [
        {
          id: 'workforce-hq',
          label: 'Workforce HQ',
          href: ws.workforce,
          icon: GitBranch as LucideIcon,
        },
        {
          id: 'dashboard',
          label: 'Dashboard',
          href: ws.dashboard,
          icon: LayoutDashboard as LucideIcon,
        },
        {
          id: 'conversations',
          label: 'Conversations',
          href: ws.conversations,
          icon: MessageSquare as LucideIcon,
        },
      ],
    },

    // =========================================================================
    // 2. CRM SECTION
    // =========================================================================
    {
      id: 'crm',
      label: 'CRM',
      icon: Users as LucideIcon,
      allowedRoles: ALL_ROLES,
      collapsible: true,
      defaultCollapsed: false,
      items: [
        {
          id: 'leads',
          label: 'Leads',
          href: ws.leads,
          icon: Target as LucideIcon,
          requiredPermission: 'canViewLeads',
        },
        {
          id: 'deals',
          label: 'Deals',
          href: ws.deals,
          icon: Handshake as LucideIcon,
          requiredPermission: 'canViewDeals',
        },
        {
          id: 'contacts',
          label: 'Contacts',
          href: ws.contacts,
          icon: Users as LucideIcon,
          requiredPermission: 'canViewLeads',
        },
        {
          id: 'living-ledger',
          label: 'Living Ledger',
          href: ws.livingLedger,
          icon: Book as LucideIcon,
          requiredPermission: 'canViewAllRecords',
        },
      ],
    },

    // =========================================================================
    // 3. LEAD GEN SECTION
    // =========================================================================
    {
      id: 'lead_gen',
      label: 'Lead Gen',
      icon: Search as LucideIcon,
      allowedRoles: MANAGER_PLUS,
      collapsible: true,
      defaultCollapsed: false,
      items: [
        {
          id: 'forms',
          label: 'Forms',
          href: ws.forms,
          icon: ClipboardList as LucideIcon,
          requiredPermission: 'canManageLeads',
        },
        {
          id: 'lead-research',
          label: 'Lead Research',
          href: ws.leadResearch,
          icon: Search as LucideIcon,
          requiredPermission: 'canManageLeads',
        },
        {
          id: 'lead-scoring',
          label: 'Lead Scoring',
          href: ws.leadScoring,
          icon: Star as LucideIcon,
          requiredPermission: 'canManageLeads',
        },
      ],
    },

    // =========================================================================
    // 4. OUTBOUND SECTION
    // =========================================================================
    {
      id: 'outbound',
      label: 'Outbound',
      icon: Send as LucideIcon,
      allowedRoles: ALL_ROLES,
      collapsible: true,
      defaultCollapsed: false,
      items: [
        {
          id: 'sequences',
          label: 'Sequences',
          href: ws.sequences,
          icon: Mail as LucideIcon,
          requiredPermission: 'canManageEmailCampaigns',
        },
        {
          id: 'campaigns',
          label: 'Campaigns',
          href: ws.emailCampaigns,
          icon: Send as LucideIcon,
          requiredPermission: 'canManageEmailCampaigns',
        },
        {
          id: 'email-writer',
          label: 'Email Writer',
          href: ws.emailWriter,
          icon: FileText as LucideIcon,
          requiredPermission: 'canManageEmailCampaigns',
        },
        {
          id: 'nurture',
          label: 'Nurture',
          href: ws.nurture,
          icon: TrendingUp as LucideIcon,
          requiredPermission: 'canManageLeads',
        },
        {
          id: 'calls',
          label: 'Calls',
          href: ws.calls,
          icon: Phone as LucideIcon,
          requiredPermission: 'canAccessVoiceAgents',
        },
      ],
    },

    // =========================================================================
    // 5. AUTOMATION SECTION
    // =========================================================================
    {
      id: 'automation',
      label: 'Automation',
      icon: Workflow as LucideIcon,
      allowedRoles: ADMIN_PLUS,
      collapsible: true,
      defaultCollapsed: false,
      items: [
        {
          id: 'workflows',
          label: 'Workflows',
          href: ws.workflows,
          icon: Workflow as LucideIcon,
          requiredPermission: 'canCreateWorkflows',
        },
        {
          id: 'ab-tests',
          label: 'A/B Tests',
          href: ws.abTests,
          icon: TestTube as LucideIcon,
          requiredPermission: 'canCreateWorkflows',
        },
      ],
    },

    // =========================================================================
    // 6. CONTENT FACTORY SECTION
    // =========================================================================
    {
      id: 'content_factory',
      label: 'Content Factory',
      icon: Video as LucideIcon,
      allowedRoles: MANAGER_PLUS,
      collapsible: true,
      defaultCollapsed: false,
      items: [
        {
          id: 'video-studio',
          label: 'Video Studio',
          href: ws.videoStudio,
          icon: Video as LucideIcon,
          requiredPermission: 'canManageSocialMedia',
        },
        {
          id: 'social-media',
          label: 'Social Media',
          href: ws.socialMedia,
          icon: Share2 as LucideIcon,
          requiredPermission: 'canManageSocialMedia',
        },
        {
          id: 'proposals',
          label: 'Proposals',
          href: ws.proposals,
          icon: FileSignature as LucideIcon,
          requiredPermission: 'canManageDeals',
        },
        {
          id: 'battlecards',
          label: 'Battlecards',
          href: ws.battlecards,
          icon: Swords as LucideIcon,
          requiredPermission: 'canViewDeals',
        },
      ],
    },

    // =========================================================================
    // 7. AI WORKFORCE SECTION
    // =========================================================================
    {
      id: 'ai_workforce',
      label: 'AI Workforce',
      icon: Bot as LucideIcon,
      allowedRoles: ADMIN_PLUS,
      collapsible: true,
      defaultCollapsed: false,
      items: [
        {
          id: 'agent-training',
          label: 'Agent Training',
          href: ws.agentTraining,
          icon: GraduationCap as LucideIcon,
          requiredPermission: 'canTrainAIAgents',
        },
        {
          id: 'voice-ai-lab',
          label: 'Voice AI Lab',
          href: ws.voiceAiLab,
          icon: Mic as LucideIcon,
          requiredPermission: 'canManageAIAgents',
        },
        {
          id: 'social-ai-lab',
          label: 'Social AI Lab',
          href: ws.socialAiLab,
          icon: Share2 as LucideIcon,
          requiredPermission: 'canManageAIAgents',
        },
        {
          id: 'seo-ai-lab',
          label: 'SEO AI Lab',
          href: ws.seoAiLab,
          icon: SearchCheck as LucideIcon,
          requiredPermission: 'canManageAIAgents',
        },
        {
          id: 'datasets',
          label: 'Datasets',
          href: ws.datasets,
          icon: Database as LucideIcon,
          requiredPermission: 'canManageAIAgents',
        },
        {
          id: 'fine-tuning',
          label: 'Fine-Tuning',
          href: ws.fineTuning,
          icon: SlidersHorizontal as LucideIcon,
          requiredPermission: 'canTrainAIAgents',
        },
      ],
    },

    // =========================================================================
    // 8. E-COMMERCE SECTION
    // =========================================================================
    {
      id: 'ecommerce',
      label: 'E-Commerce',
      icon: ShoppingCart as LucideIcon,
      allowedRoles: ADMIN_PLUS,
      collapsible: true,
      defaultCollapsed: true,
      items: [
        {
          id: 'products',
          label: 'Products',
          href: ws.products,
          icon: Package as LucideIcon,
          requiredPermission: 'canManageProducts',
        },
        {
          id: 'orders',
          label: 'Orders',
          href: ws.orders,
          icon: ShoppingCart as LucideIcon,
          requiredPermission: 'canProcessOrders',
        },
        {
          id: 'storefront',
          label: 'Storefront',
          href: ws.storefront,
          icon: Store as LucideIcon,
          requiredPermission: 'canManageEcommerce',
        },
      ],
    },

    // =========================================================================
    // 9. ANALYTICS SECTION
    // =========================================================================
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3 as LucideIcon,
      allowedRoles: ALL_ROLES,
      collapsible: true,
      defaultCollapsed: false,
      items: [
        {
          id: 'analytics-overview',
          label: 'Overview',
          href: ws.analyticsOverview,
          icon: BarChart3 as LucideIcon,
          requiredPermission: 'canViewReports',
        },
        {
          id: 'analytics-revenue',
          label: 'Revenue',
          href: ws.analyticsRevenue,
          icon: DollarSign as LucideIcon,
          requiredPermission: 'canViewReports',
        },
        {
          id: 'analytics-pipeline',
          label: 'Pipeline',
          href: ws.analyticsPipeline,
          icon: TrendingUp as LucideIcon,
          requiredPermission: 'canViewReports',
        },
        {
          id: 'sequence-analytics',
          label: 'Sequences',
          href: ws.sequenceAnalytics,
          icon: Activity as LucideIcon,
          requiredPermission: 'canViewReports',
        },
      ],
    },

    // =========================================================================
    // 10. WEBSITE SECTION
    // =========================================================================
    {
      id: 'website',
      label: 'Website',
      icon: Globe as LucideIcon,
      allowedRoles: ADMIN_PLUS,
      collapsible: true,
      defaultCollapsed: true,
      items: [
        {
          id: 'website-pages',
          label: 'Pages',
          href: ws.websitePages,
          icon: Globe as LucideIcon,
          requiredPermission: 'canManageWebsite',
        },
        {
          id: 'website-blog',
          label: 'Blog',
          href: ws.websiteBlog,
          icon: PenTool as LucideIcon,
          requiredPermission: 'canManageWebsite',
        },
        {
          id: 'website-domains',
          label: 'Domains',
          href: ws.websiteDomains,
          icon: Link as LucideIcon,
          requiredPermission: 'canManageWebsite',
        },
        {
          id: 'website-seo',
          label: 'SEO',
          href: ws.websiteSeo,
          icon: SearchCheck as LucideIcon,
          requiredPermission: 'canManageWebsite',
        },
        {
          id: 'website-settings',
          label: 'Site Settings',
          href: ws.websiteSettings,
          icon: Palette as LucideIcon,
          requiredPermission: 'canManageWebsite',
        },
      ],
    },

    // =========================================================================
    // 11. SETTINGS SECTION
    // =========================================================================
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings as LucideIcon,
      allowedRoles: ADMIN_PLUS,
      collapsible: true,
      defaultCollapsed: true,
      items: [
        {
          id: 'org-settings',
          label: 'Organization',
          href: ws.settings,
          icon: Building2 as LucideIcon,
          requiredPermission: 'canManageOrganization',
        },
        {
          id: 'team-settings',
          label: 'Team',
          href: ws.team,
          icon: Users as LucideIcon,
          requiredPermission: 'canInviteUsers',
        },
        {
          id: 'integrations',
          label: 'Integrations',
          href: ws.integrations,
          icon: Plug as LucideIcon,
          requiredPermission: 'canManageIntegrations',
        },
        {
          id: 'api-keys',
          label: 'API Keys',
          href: ws.apiKeys,
          icon: Key as LucideIcon,
          requiredPermission: 'canManageAPIKeys',
        },
        {
          id: 'billing',
          label: 'Billing',
          href: ws.billing,
          icon: CreditCard as LucideIcon,
          requiredPermission: 'canManageBilling',
        },
      ],
    },

    // =========================================================================
    // 12. SYSTEM SECTION (Platform Admin Only)
    // CRITICAL: This section MUST remain at the ABSOLUTE BOTTOM
    // Positioned last to visually separate platform admin tools from daily operations
    // =========================================================================
    {
      id: 'system',
      label: 'System',
      icon: Wrench as LucideIcon,
      allowedRoles: PLATFORM_ADMIN_ONLY,
      collapsible: true,
      defaultCollapsed: false,
      items: [
        {
          id: 'system-overview',
          label: 'System Overview',
          href: admin.systemOverview,
          icon: Activity as LucideIcon,
          requiredPermission: 'canViewSystemHealth',
        },
        {
          id: 'system-organizations',
          label: 'Organizations',
          href: admin.organizations,
          icon: Building2 as LucideIcon,
          requiredPermission: 'canManageAllOrganizations',
        },
        {
          id: 'system-users',
          label: 'All Users',
          href: admin.users,
          icon: Users as LucideIcon,
          requiredPermission: 'canManageAllOrganizations',
        },
        {
          id: 'system-flags',
          label: 'Feature Flags',
          href: admin.featureFlags,
          icon: Flag as LucideIcon,
          requiredPermission: 'canManageFeatureFlags',
        },
        {
          id: 'system-logs',
          label: 'Audit Logs',
          href: admin.auditLogs,
          icon: FileCode as LucideIcon,
          requiredPermission: 'canViewAuditLogs',
        },
        {
          id: 'system-settings',
          label: 'System Settings',
          href: admin.systemSettings,
          icon: Settings as LucideIcon,
          requiredPermission: 'canManageSystemSettings',
        },
      ],
    },
  ],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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

/**
 * Helper to replace :orgId placeholder with actual organization ID
 * Call this when rendering navigation items
 */
export function resolveWorkspaceRoute(href: string, orgId: string): string {
  return href.replace(':orgId', orgId);
}

/**
 * Get navigation with resolved workspace routes
 */
export function getResolvedNavigation(orgId: string): NavigationStructure {
  return {
    sections: UNIFIED_NAVIGATION.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        href: resolveWorkspaceRoute(item.href, orgId),
        children: item.children?.map((child) => ({
          ...child,
          href: resolveWorkspaceRoute(child.href, orgId),
        })),
      })),
    })),
  };
}

/**
 * Get section count for God-Mode verification
 * Platform admin should see 12 sections total
 */
export function getTotalSectionCount(): number {
  return UNIFIED_NAVIGATION.sections.length;
}

/**
 * Verify God-Mode configuration
 * Returns true if platform_admin can see all 12 sections
 */
export function verifyGodModeAccess(): boolean {
  const platformAdminSections = UNIFIED_NAVIGATION.sections.filter((section) =>
    section.allowedRoles.includes('platform_admin')
  );
  return platformAdminSections.length === 12;
}
