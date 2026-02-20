/**
 * Centralized Dashboard Route Constants
 * Defines all dashboard routes as typed constants for type safety
 *
 * All routes map to the (dashboard) route group, not the legacy /dashboard/ paths.
 *
 * @module routes/dashboard-routes
 */

/**
 * Dashboard route builders
 * All routes under the (dashboard) route group
 */
export const dashboardRoutes = {
  // Core Dashboard
  overview: () => '/dashboard',

  // Sales
  salesLeads: () => '/leads',
  salesDeals: () => '/deals',

  // Marketing
  marketingSocial: () => '/social/campaigns',
  marketingEmail: () => '/email/campaigns',

  // Analytics
  analytics: () => '/analytics',

  // AI Workforce
  workforce: () => '/workforce',

  // Performance & Coaching
  performance: () => '/performance',
  coaching: () => '/coaching',
  coachingTeam: () => '/coaching/team',

  // Playbook
  playbook: () => '/playbook',

  // Conversation Intelligence
  conversation: () => '/conversations',

  // Risk Management
  risk: () => '/risk',

  // Lead Routing
  routing: () => '/settings/lead-routing',

  // Sequence Management
  sequence: () => '/outbound/sequences',

  // Settings
  settings: () => '/settings',

  // System (Platform Admin Only)
  system: () => '/system',
} as const;

/**
 * Type exports for route parameters
 */
export type DashboardRouteKey = keyof typeof dashboardRoutes;

/**
 * Helper to get all dashboard route paths
 */
export function getAllDashboardRoutes(): string[] {
  return Object.values(dashboardRoutes).map(fn => fn());
}
