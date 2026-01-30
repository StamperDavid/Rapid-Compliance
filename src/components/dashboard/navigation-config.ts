/**
 * Legacy Client Navigation Configuration
 * Restored: January 27, 2026 - 1/25/2026 Baseline
 *
 * ARCHITECTURE NOTES:
 * - CLIENT_SECTIONS: 11 operational sections for all client roles
 *   (Command Center, CRM, Lead Gen, Outbound, Automation, Content Factory,
 *    AI Workforce, E-Commerce, Analytics, Website, Settings)
 * - SYSTEM_SECTION: Isolated platform_admin tools - NEVER included in client array
 * - Routes use :orgId placeholder - replace with actual orgId at render time
 *
 * HARD-GATING: System tools (System Overview, Organizations, All Users, Feature Flags,
 * Audit Logs, System Settings) are ONLY accessible via explicit platform_admin check.
 * They are NOT part of the standard client navigation structure.
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
// CLIENT NAVIGATION SECTIONS (11 Operational Sections)
// These sections are available to all client roles based on permissions
// System/Admin tools are NOT included here - they are isolated separately
// =============================================================================

/**
 * Client-facing navigation sections
 * Contains ONLY the 11 operational sections for daily business operations
 * DOES NOT include System, Audit Logs, Feature Flags, or All Users
 */
export const CLIENT_SECTIONS: NavigationSection[] = [
  // =========================================================================
  // 1. COMMAND CENTER SECTION
  // =========================================================================
  {
    id: 'command_center',
    label: 'Command Center',
    icon: LayoutDashboard as LucideIcon,
    iconColor: '#6366f1', // Indigo
    allowedRoles: ALL_ROLES,
    collapsible: false,
    items: [
      {
        id: 'workforce-hq',
        label: 'Workforce HQ',
        href: ws.workforce,
        icon: GitBranch as LucideIcon,
        iconColor: '#8b5cf6', // Violet
      },
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: ws.dashboard,
        icon: LayoutDashboard as LucideIcon,
        iconColor: '#6366f1', // Indigo
      },
      {
        id: 'conversations',
        label: 'Conversations',
        href: ws.conversations,
        icon: MessageSquare as LucideIcon,
        iconColor: '#3b82f6', // Blue
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
    iconColor: '#10b981', // Emerald
    allowedRoles: ALL_ROLES,
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        id: 'leads',
        label: 'Leads',
        href: ws.leads,
        icon: Target as LucideIcon,
        iconColor: '#ef4444', // Red
        requiredPermission: 'canViewLeads',
      },
      {
        id: 'deals',
        label: 'Deals',
        href: ws.deals,
        icon: Handshake as LucideIcon,
        iconColor: '#10b981', // Emerald
        requiredPermission: 'canViewDeals',
      },
      {
        id: 'contacts',
        label: 'Contacts',
        href: ws.contacts,
        icon: Users as LucideIcon,
        iconColor: '#3b82f6', // Blue
        requiredPermission: 'canViewLeads',
      },
      {
        id: 'living-ledger',
        label: 'Living Ledger',
        href: ws.livingLedger,
        icon: Book as LucideIcon,
        iconColor: '#f59e0b', // Amber
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
    iconColor: '#f59e0b', // Amber
    allowedRoles: MANAGER_PLUS,
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        id: 'forms',
        label: 'Forms',
        href: ws.forms,
        icon: ClipboardList as LucideIcon,
        iconColor: '#8b5cf6', // Violet
        requiredPermission: 'canManageLeads',
      },
      {
        id: 'lead-research',
        label: 'Lead Research',
        href: ws.leadResearch,
        icon: Search as LucideIcon,
        iconColor: '#f59e0b', // Amber
        requiredPermission: 'canManageLeads',
      },
      {
        id: 'lead-scoring',
        label: 'Lead Scoring',
        href: ws.leadScoring,
        icon: Star as LucideIcon,
        iconColor: '#eab308', // Yellow
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
    iconColor: '#3b82f6', // Blue
    allowedRoles: ALL_ROLES,
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        id: 'sequences',
        label: 'Sequences',
        href: ws.sequences,
        icon: Mail as LucideIcon,
        iconColor: '#3b82f6', // Blue
        requiredPermission: 'canManageEmailCampaigns',
      },
      {
        id: 'campaigns',
        label: 'Campaigns',
        href: ws.emailCampaigns,
        icon: Send as LucideIcon,
        iconColor: '#06b6d4', // Cyan
        requiredPermission: 'canManageEmailCampaigns',
      },
      {
        id: 'email-writer',
        label: 'Email Writer',
        href: ws.emailWriter,
        icon: FileText as LucideIcon,
        iconColor: '#8b5cf6', // Violet
        requiredPermission: 'canManageEmailCampaigns',
      },
      {
        id: 'nurture',
        label: 'Nurture',
        href: ws.nurture,
        icon: TrendingUp as LucideIcon,
        iconColor: '#10b981', // Emerald
        requiredPermission: 'canManageLeads',
      },
      {
        id: 'calls',
        label: 'Calls',
        href: ws.calls,
        icon: Phone as LucideIcon,
        iconColor: '#22c55e', // Green
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
    iconColor: '#8b5cf6', // Violet
    allowedRoles: ADMIN_PLUS,
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        id: 'workflows',
        label: 'Workflows',
        href: ws.workflows,
        icon: Workflow as LucideIcon,
        iconColor: '#8b5cf6', // Violet
        requiredPermission: 'canCreateWorkflows',
      },
      {
        id: 'ab-tests',
        label: 'A/B Tests',
        href: ws.abTests,
        icon: TestTube as LucideIcon,
        iconColor: '#ec4899', // Pink
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
    iconColor: '#ec4899', // Pink
    allowedRoles: MANAGER_PLUS,
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        id: 'video-studio',
        label: 'Video Studio',
        href: ws.videoStudio,
        icon: Video as LucideIcon,
        iconColor: '#ef4444', // Red
        requiredPermission: 'canManageSocialMedia',
      },
      {
        id: 'social-media',
        label: 'Social Media',
        href: ws.socialMedia,
        icon: Share2 as LucideIcon,
        iconColor: '#3b82f6', // Blue
        requiredPermission: 'canManageSocialMedia',
      },
      {
        id: 'proposals',
        label: 'Proposals',
        href: ws.proposals,
        icon: FileSignature as LucideIcon,
        iconColor: '#8b5cf6', // Violet
        requiredPermission: 'canManageDeals',
      },
      {
        id: 'battlecards',
        label: 'Battlecards',
        href: ws.battlecards,
        icon: Swords as LucideIcon,
        iconColor: '#f59e0b', // Amber
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
    iconColor: '#06b6d4', // Cyan
    allowedRoles: ADMIN_PLUS,
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        id: 'agent-training',
        label: 'Agent Training',
        href: ws.agentTraining,
        icon: GraduationCap as LucideIcon,
        iconColor: '#6366f1', // Indigo
        requiredPermission: 'canTrainAIAgents',
      },
      {
        id: 'voice-ai-lab',
        label: 'Voice AI Lab',
        href: ws.voiceAiLab,
        icon: Mic as LucideIcon,
        iconColor: '#ef4444', // Red
        requiredPermission: 'canManageAIAgents',
      },
      {
        id: 'social-ai-lab',
        label: 'Social AI Lab',
        href: ws.socialAiLab,
        icon: Share2 as LucideIcon,
        iconColor: '#3b82f6', // Blue
        requiredPermission: 'canManageAIAgents',
      },
      {
        id: 'seo-ai-lab',
        label: 'SEO AI Lab',
        href: ws.seoAiLab,
        icon: SearchCheck as LucideIcon,
        iconColor: '#10b981', // Emerald
        requiredPermission: 'canManageAIAgents',
      },
      {
        id: 'datasets',
        label: 'Datasets',
        href: ws.datasets,
        icon: Database as LucideIcon,
        iconColor: '#8b5cf6', // Violet
        requiredPermission: 'canManageAIAgents',
      },
      {
        id: 'fine-tuning',
        label: 'Fine-Tuning',
        href: ws.fineTuning,
        icon: SlidersHorizontal as LucideIcon,
        iconColor: '#f59e0b', // Amber
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
    iconColor: '#22c55e', // Green
    allowedRoles: ADMIN_PLUS,
    collapsible: true,
    defaultCollapsed: true,
    items: [
      {
        id: 'products',
        label: 'Products',
        href: ws.products,
        icon: Package as LucideIcon,
        iconColor: '#f59e0b', // Amber
        requiredPermission: 'canManageProducts',
      },
      {
        id: 'orders',
        label: 'Orders',
        href: ws.orders,
        icon: ShoppingCart as LucideIcon,
        iconColor: '#22c55e', // Green
        requiredPermission: 'canProcessOrders',
      },
      {
        id: 'storefront',
        label: 'Storefront',
        href: ws.storefront,
        icon: Store as LucideIcon,
        iconColor: '#8b5cf6', // Violet
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
    iconColor: '#06b6d4', // Cyan
    allowedRoles: ALL_ROLES,
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        id: 'analytics-overview',
        label: 'Overview',
        href: ws.analyticsOverview,
        icon: BarChart3 as LucideIcon,
        iconColor: '#06b6d4', // Cyan
        requiredPermission: 'canViewReports',
      },
      {
        id: 'analytics-revenue',
        label: 'Revenue',
        href: ws.analyticsRevenue,
        icon: DollarSign as LucideIcon,
        iconColor: '#22c55e', // Green
        requiredPermission: 'canViewReports',
      },
      {
        id: 'analytics-pipeline',
        label: 'Pipeline',
        href: ws.analyticsPipeline,
        icon: TrendingUp as LucideIcon,
        iconColor: '#10b981', // Emerald
        requiredPermission: 'canViewReports',
      },
      {
        id: 'sequence-analytics',
        label: 'Sequences',
        href: ws.sequenceAnalytics,
        icon: Activity as LucideIcon,
        iconColor: '#ef4444', // Red
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
    iconColor: '#3b82f6', // Blue
    allowedRoles: ADMIN_PLUS,
    collapsible: true,
    defaultCollapsed: true,
    items: [
      {
        id: 'website-pages',
        label: 'Pages',
        href: ws.websitePages,
        icon: Globe as LucideIcon,
        iconColor: '#3b82f6', // Blue
        requiredPermission: 'canManageWebsite',
      },
      {
        id: 'website-blog',
        label: 'Blog',
        href: ws.websiteBlog,
        icon: PenTool as LucideIcon,
        iconColor: '#ec4899', // Pink
        requiredPermission: 'canManageWebsite',
      },
      {
        id: 'website-domains',
        label: 'Domains',
        href: ws.websiteDomains,
        icon: Link as LucideIcon,
        iconColor: '#8b5cf6', // Violet
        requiredPermission: 'canManageWebsite',
      },
      {
        id: 'website-seo',
        label: 'SEO',
        href: ws.websiteSeo,
        icon: SearchCheck as LucideIcon,
        iconColor: '#10b981', // Emerald
        requiredPermission: 'canManageWebsite',
      },
      {
        id: 'website-settings',
        label: 'Site Settings',
        href: ws.websiteSettings,
        icon: Palette as LucideIcon,
        iconColor: '#f59e0b', // Amber
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
    iconColor: '#64748b', // Slate
    allowedRoles: ADMIN_PLUS,
    collapsible: true,
    defaultCollapsed: true,
    items: [
      {
        id: 'org-settings',
        label: 'Organization',
        href: ws.settings,
        icon: Building2 as LucideIcon,
        iconColor: '#6366f1', // Indigo
        requiredPermission: 'canManageOrganization',
      },
      {
        id: 'team-settings',
        label: 'Team',
        href: ws.team,
        icon: Users as LucideIcon,
        iconColor: '#3b82f6', // Blue
        requiredPermission: 'canInviteUsers',
      },
      {
        id: 'integrations',
        label: 'Integrations',
        href: ws.integrations,
        icon: Plug as LucideIcon,
        iconColor: '#22c55e', // Green
        requiredPermission: 'canManageIntegrations',
      },
      {
        id: 'api-keys',
        label: 'API Keys',
        href: ws.apiKeys,
        icon: Key as LucideIcon,
        iconColor: '#f59e0b', // Amber
        requiredPermission: 'canManageAPIKeys',
      },
      {
        id: 'billing',
        label: 'Billing',
        href: ws.billing,
        icon: CreditCard as LucideIcon,
        iconColor: '#8b5cf6', // Violet
        requiredPermission: 'canManageBilling',
      },
    ],
  },
];

// =============================================================================
// SYSTEM SECTION (Platform Admin Only - Isolated)
// This section is NEVER part of the standard client navigation array
// It MUST be conditionally appended ONLY when user.role === 'platform_admin'
// =============================================================================

/**
 * Platform Admin System Tools
 * ISOLATED from client navigation - must be explicitly appended via isPlatformAdmin check
 * Contains: System Overview, Organizations, All Users, Feature Flags, Audit Logs, System Settings
 */
export const SYSTEM_SECTION: NavigationSection = {
  id: 'system',
  label: 'System',
  icon: Wrench as LucideIcon,
  iconColor: '#ef4444', // Red (admin/system)
  allowedRoles: PLATFORM_ADMIN_ONLY,
  collapsible: true,
  defaultCollapsed: false,
  items: [
    {
      id: 'system-overview',
      label: 'System Overview',
      href: admin.systemOverview,
      icon: Activity as LucideIcon,
      iconColor: '#ef4444', // Red
      requiredPermission: 'canViewSystemHealth',
    },
    {
      id: 'system-organizations',
      label: 'Organizations',
      href: admin.organizations,
      icon: Building2 as LucideIcon,
      iconColor: '#6366f1', // Indigo
      requiredPermission: 'canManageAllOrganizations',
    },
    {
      id: 'system-users',
      label: 'All Users',
      href: admin.users,
      icon: Users as LucideIcon,
      iconColor: '#3b82f6', // Blue
      requiredPermission: 'canManageAllOrganizations',
    },
    {
      id: 'system-flags',
      label: 'Feature Flags',
      href: admin.featureFlags,
      icon: Flag as LucideIcon,
      iconColor: '#f59e0b', // Amber
      requiredPermission: 'canManageFeatureFlags',
    },
    {
      id: 'system-logs',
      label: 'Audit Logs',
      href: admin.auditLogs,
      icon: FileCode as LucideIcon,
      iconColor: '#8b5cf6', // Violet
      requiredPermission: 'canViewAuditLogs',
    },
    {
      id: 'system-settings',
      label: 'System Settings',
      href: admin.systemSettings,
      icon: Settings as LucideIcon,
      iconColor: '#64748b', // Slate
      requiredPermission: 'canManageSystemSettings',
    },
  ],
};

// =============================================================================
// UNIFIED NAVIGATION (Backward Compatibility)
// Combines CLIENT_SECTIONS + SYSTEM_SECTION for legacy code paths
// NEW CODE SHOULD USE getNavigationForRole() INSTEAD
// =============================================================================

/**
 * @deprecated Use getNavigationForRole() instead for explicit platform_admin gating
 * Combined navigation structure for backward compatibility
 */
export const UNIFIED_NAVIGATION: NavigationStructure = {
  sections: [...CLIENT_SECTIONS, SYSTEM_SECTION],
};

// =============================================================================
// ADMIN ORGANIZATION VIEW NAVIGATION
// When a platform admin is viewing an organization detail, they should see
// only admin-specific navigation that keeps them within the /admin route tree
// =============================================================================

/**
 * Admin Organization View Section
 * Shows navigation items for viewing organization details in admin context
 * This replaces CLIENT_SECTIONS when admin is viewing an org to prevent routing
 * to invalid /workspace/* paths
 */
export const ADMIN_ORG_VIEW_SECTION: NavigationSection = {
  id: 'admin_org_view',
  label: 'Organization',
  icon: Building2 as LucideIcon,
  iconColor: '#6366f1', // Indigo
  allowedRoles: ['platform_admin'],
  collapsible: false,
  items: [
    {
      id: 'org-overview',
      label: 'Overview',
      href: '/admin/organizations/:adminOrgId',
      icon: LayoutDashboard as LucideIcon,
      iconColor: '#6366f1', // Indigo
    },
    {
      id: 'org-edit',
      label: 'Edit Organization',
      href: '/admin/organizations/:adminOrgId/edit',
      icon: Settings as LucideIcon,
      iconColor: '#f59e0b', // Amber
    },
    {
      id: 'org-integrations',
      label: 'Integrations',
      href: '/admin/organizations/:adminOrgId/integrations',
      icon: Share2 as LucideIcon,
      iconColor: '#22c55e', // Green
    },
    {
      id: 'org-settings',
      label: 'Settings',
      href: '/admin/organizations/:adminOrgId/settings',
      icon: Wrench as LucideIcon,
      iconColor: '#ef4444', // Red
    },
    {
      id: 'org-back',
      label: 'All Organizations',
      href: '/admin/organizations',
      icon: Building2 as LucideIcon,
      iconColor: '#3b82f6', // Blue
    },
  ],
};

/**
 * Admin Support Section - Quick Actions
 * Support tools for managing organizations
 */
export const ADMIN_SUPPORT_SECTION: NavigationSection = {
  id: 'admin_support',
  label: 'Support Tools',
  icon: Wrench as LucideIcon,
  iconColor: '#ef4444', // Red
  allowedRoles: ['platform_admin'],
  collapsible: true,
  defaultCollapsed: false,
  items: [
    {
      id: 'support-impersonate',
      label: 'Impersonate User',
      href: '/admin/support/impersonate',
      icon: Users as LucideIcon,
      iconColor: '#8b5cf6', // Violet
    },
    {
      id: 'support-bulk-ops',
      label: 'Bulk Operations',
      href: '/admin/support/bulk-ops',
      icon: Package as LucideIcon,
      iconColor: '#10b981', // Emerald
    },
    {
      id: 'support-exports',
      label: 'Data Exports',
      href: '/admin/support/exports',
      icon: FileText as LucideIcon,
      iconColor: '#3b82f6', // Blue
    },
    {
      id: 'support-api-health',
      label: 'API Health',
      href: '/admin/support/api-health',
      icon: Activity as LucideIcon,
      iconColor: '#22c55e', // Green
    },
  ],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Navigation context type for admin views
 */
export type AdminNavigationContext =
  | 'admin-global'     // Admin landing, system pages
  | 'admin-org-view';  // Viewing a specific organization

/**
 * Get navigation sections for a specific role
 * HARD-GATES platform admin tools - System section ONLY appended for platform_admin
 *
 * @param role - The user's account role
 * @param adminContext - Optional admin context for specialized navigation
 * @returns Navigation sections appropriate for the role
 */
export function getNavigationForRole(
  role: AccountRole,
  adminContext?: AdminNavigationContext
): NavigationSection[] {
  // When in admin context, DON'T show CLIENT_SECTIONS (they route to /workspace/*)
  // This prevents admins from being kicked out of the admin route tree
  if (role === 'platform_admin' && adminContext) {
    if (adminContext === 'admin-org-view') {
      // Viewing an organization - show org-specific + support + system navigation
      return [ADMIN_ORG_VIEW_SECTION, ADMIN_SUPPORT_SECTION, SYSTEM_SECTION];
    }
    // Admin global view - show support + system navigation only
    return [ADMIN_SUPPORT_SECTION, SYSTEM_SECTION];
  }

  // Standard workspace flow - show client sections
  const sections = [...CLIENT_SECTIONS];

  // HARD-GATE: Only append System section for platform_admin
  if (role === 'platform_admin') {
    sections.push(SYSTEM_SECTION);
  }

  return sections;
}

/**
 * Helper to get a specific section by ID
 */
export function getNavigationSection(sectionId: string): NavigationSection | undefined {
  // Check client sections first
  const clientSection = CLIENT_SECTIONS.find((section) => section.id === sectionId);
  if (clientSection) {
    return clientSection;
  }

  // Check system section
  if (SYSTEM_SECTION.id === sectionId) {
    return SYSTEM_SECTION;
  }

  return undefined;
}

/**
 * Helper to get all sections for a specific category
 */
export function getNavigationByCategory(category: string): NavigationSection[] {
  return [...CLIENT_SECTIONS, SYSTEM_SECTION].filter((section) => section.id === category);
}

/**
 * Helper to replace :orgId placeholder with actual organization ID
 * Call this when rendering navigation items
 */
export function resolveWorkspaceRoute(href: string, orgId: string): string {
  return href.replace(':orgId', orgId);
}

/**
 * Get navigation with resolved workspace routes for a specific role
 * Uses getNavigationForRole() for proper platform_admin gating
 */
export function getResolvedNavigation(orgId: string, role: AccountRole): NavigationStructure {
  const sections = getNavigationForRole(role);

  return {
    sections: sections.map((section) => ({
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
 * Get client section count (excludes System)
 */
export function getClientSectionCount(): number {
  return CLIENT_SECTIONS.length;
}

/**
 * Get total section count for platform_admin (includes System)
 */
export function getTotalSectionCount(): number {
  return CLIENT_SECTIONS.length + 1; // 11 client + 1 system = 12
}

/**
 * Verify navigation configuration integrity
 * Client sees 11 sections, platform_admin sees 12
 */
export function verifyNavigationConfig(): { clientSections: number; platformAdminSections: number; isValid: boolean } {
  const clientCount = CLIENT_SECTIONS.length;
  const platformAdminCount = getNavigationForRole('platform_admin').length;

  return {
    clientSections: clientCount,
    platformAdminSections: platformAdminCount,
    isValid: clientCount === 11 && platformAdminCount === 12,
  };
}
