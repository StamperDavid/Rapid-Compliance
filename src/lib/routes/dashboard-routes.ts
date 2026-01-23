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
 * Legacy admin routes that still exist
 * These are referenced in navigation but may need migration to /dashboard
 */
export const legacyAdminRoutes = {
  organizations: () => '/admin/organizations',
  users: () => '/admin/users',
  systemFlags: () => '/admin/system/flags',
  systemLogs: () => '/admin/system/logs',
  systemSettings: () => '/admin/system/settings',

  // Legacy sales routes
  voiceAgents: () => '/sales/voice-agents',
  aiAgent: () => '/sales/ai-agent',
} as const;

/**
 * Routes that are referenced in navigation but don't exist yet in /dashboard
 * These need to be created or redirected to existing pages
 */
export const pendingDashboardRoutes = {
  // Analytics sub-routes
  analyticsRevenue: () => '/dashboard/analytics/revenue',
  analyticsPipeline: () => '/dashboard/analytics/pipeline',
  analyticsPlatform: () => '/dashboard/analytics/platform',

  // Marketing sub-routes
  marketingEmailTemplates: () => '/dashboard/marketing/email-templates',
  marketingWebsite: () => '/dashboard/marketing/website',

  // Swarm sub-routes
  swarmTraining: () => '/dashboard/swarm/training',
  swarmPersona: () => '/dashboard/swarm/persona',
  swarmKnowledge: () => '/dashboard/swarm/knowledge',

  // Settings sub-routes
  settingsTeam: () => '/dashboard/settings/team',
  settingsApiKeys: () => '/dashboard/settings/api-keys',
  settingsIntegrations: () => '/dashboard/settings/integrations',
  settingsBilling: () => '/dashboard/settings/billing',
  settingsEcommerce: () => '/dashboard/settings/ecommerce',
  settingsProducts: () => '/dashboard/settings/products',
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
