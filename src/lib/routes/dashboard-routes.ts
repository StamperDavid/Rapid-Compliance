/**
 * Centralized Dashboard Route Constants
 * Defines all dashboard routes as typed constants for type safety
 *
 * SOVEREIGN CORPORATE BRAIN - DASHBOARD ROUTING MODULE
 *
 * @module routes/dashboard-routes
 */

/**
 * Dashboard route builders
 * All routes under /dashboard
 */
export const dashboardRoutes = {
  // Core Dashboard
  overview: () => '/dashboard',

  // Sales
  salesLeads: () => '/dashboard/sales/leads',
  salesDeals: () => '/dashboard/sales/deals',

  // Marketing
  marketingSocial: () => '/dashboard/marketing/social',
  marketingEmail: () => '/dashboard/marketing/email',

  // Analytics
  analytics: () => '/dashboard/analytics',

  // AI Swarm
  swarm: () => '/dashboard/swarm',

  // Performance & Coaching
  performance: () => '/dashboard/performance',
  coaching: () => '/dashboard/coaching',
  coachingTeam: () => '/dashboard/coaching/team',

  // Playbook
  playbook: () => '/dashboard/playbook',

  // Conversation Intelligence
  conversation: () => '/dashboard/conversation',

  // Risk Management
  risk: () => '/dashboard/risk',

  // Lead Routing
  routing: () => '/dashboard/routing',

  // Sequence Management
  sequence: () => '/dashboard/sequence',

  // Settings
  settings: () => '/dashboard/settings',

  // System (Platform Admin Only)
  system: () => '/dashboard/system',
} as const;

/**
 * Admin routes for platform administration
 * These routes are under /admin and available to platform admins
 */
export const legacyAdminRoutes = {
  organizations: () => '/admin/organizations',
  users: () => '/admin/users',
  systemFlags: () => '/admin/system/flags',
  systemLogs: () => '/admin/system/logs',
  systemSettings: () => '/admin/system/settings',

  // Voice & AI Agent routes (now properly mapped to /admin)
  voiceAgents: () => '/admin/voice',
  aiAgent: () => '/admin/sales-agent',
} as const;

/**
 * Routes that map to existing admin functionality
 * These are remapped from legacy /dashboard paths to their correct /admin locations
 */
export const pendingDashboardRoutes = {
  // Analytics sub-routes (mapped to admin analytics)
  analyticsRevenue: () => '/admin/revenue',
  analyticsPipeline: () => '/admin/analytics/pipeline',
  analyticsPlatform: () => '/admin/analytics/usage',

  // Marketing sub-routes (mapped to admin tools)
  marketingEmailTemplates: () => '/admin/templates',
  marketingWebsite: () => '/admin/website-editor',

  // Swarm sub-routes (mapped to admin sales-agent)
  swarmTraining: () => '/admin/sales-agent/training',
  swarmPersona: () => '/admin/sales-agent/persona',
  swarmKnowledge: () => '/admin/sales-agent/knowledge',

  // Settings sub-routes (mapped to admin tools)
  settingsTeam: () => '/admin/users',
  settingsApiKeys: () => '/admin/system/api-keys',
  settingsIntegrations: () => '/admin/settings/integrations',
  settingsBilling: () => '/admin/billing',
  settingsEcommerce: () => '/admin/merchandiser',
  settingsProducts: () => '/admin/merchandiser',
} as const;

/**
 * All existing dashboard routes (verified to have page.tsx files)
 */
export const existingDashboardRoutes = [
  '/dashboard',
  '/dashboard/analytics',
  '/dashboard/coaching',
  '/dashboard/coaching/team',
  '/dashboard/conversation',
  '/dashboard/marketing/email',
  '/dashboard/marketing/social',
  '/dashboard/performance',
  '/dashboard/playbook',
  '/dashboard/risk',
  '/dashboard/routing',
  '/dashboard/sales/deals',
  '/dashboard/sales/leads',
  '/dashboard/sequence',
  '/dashboard/settings',
  '/dashboard/swarm',
  '/dashboard/system',
] as const;

/**
 * Type exports for route parameters
 */
export type DashboardRouteKey = keyof typeof dashboardRoutes;
export type LegacyAdminRouteKey = keyof typeof legacyAdminRoutes;
export type PendingDashboardRouteKey = keyof typeof pendingDashboardRoutes;
export type ExistingDashboardRoute = typeof existingDashboardRoutes[number];

/**
 * Helper to check if a route exists
 */
export function isDashboardRouteExisting(path: string): path is ExistingDashboardRoute {
  return existingDashboardRoutes.includes(path as ExistingDashboardRoute);
}

/**
 * Helper to get all dashboard route paths
 */
export function getAllDashboardRoutes(): string[] {
  return Object.values(dashboardRoutes).map(fn => fn());
}
