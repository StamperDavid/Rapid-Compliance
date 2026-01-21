/**
 * Centralized route builder for workspace URLs
 * Eliminates hardcoded URL patterns across components
 */

// Route configuration type
export interface RouteConfig {
  path: string;
  label: string;
  icon?: string;
}

// Workspace route builders
export const workspaceRoutes = {
  // Core
  dashboard: (orgId: string) => `/workspace/${orgId}/dashboard`,
  settings: (orgId: string) => `/workspace/${orgId}/settings`,

  // CRM
  leads: (orgId: string) => `/workspace/${orgId}/leads`,
  leadDetail: (orgId: string, leadId: string) => `/workspace/${orgId}/leads/${leadId}`,
  deals: (orgId: string) => `/workspace/${orgId}/deals`,
  dealDetail: (orgId: string, dealId: string) => `/workspace/${orgId}/deals/${dealId}`,
  contacts: (orgId: string) => `/workspace/${orgId}/contacts`,

  // Marketing
  email: (orgId: string) => `/workspace/${orgId}/email`,
  social: (orgId: string) => `/workspace/${orgId}/social`,

  // Automation
  workflows: (orgId: string) => `/workspace/${orgId}/workflows`,
  workflowDetail: (orgId: string, workflowId: string) => `/workspace/${orgId}/workflows/${workflowId}`,

  // Analytics
  analytics: (orgId: string) => `/workspace/${orgId}/analytics`,
  revenue: (orgId: string) => `/workspace/${orgId}/analytics/revenue`,
  pipeline: (orgId: string) => `/workspace/${orgId}/analytics/pipeline`,

  // AI
  aiDatasets: (orgId: string) => `/workspace/${orgId}/ai/datasets`,
  aiFineTuning: (orgId: string) => `/workspace/${orgId}/ai/fine-tuning`,

  // Website
  website: (orgId: string) => `/workspace/${orgId}/website`,
  websitePages: (orgId: string) => `/workspace/${orgId}/website/pages`,
  websiteBlog: (orgId: string) => `/workspace/${orgId}/website/blog`,
} as const;

// Admin route builders
export const adminRoutes = {
  dashboard: () => '/admin',
  organizations: () => '/admin/organizations',
  organizationDetail: (orgId: string) => `/admin/organizations/${orgId}`,
  users: () => '/admin/users',
  userDetail: (userId: string) => `/admin/users/${userId}`,
  billing: () => '/admin/billing',
  subscriptions: () => '/admin/subscriptions',
  globalConfig: () => '/admin/global-config',
  analytics: () => '/admin/analytics',
  revenue: () => '/admin/revenue',
  recovery: () => '/admin/recovery',
  salesAgent: () => '/admin/sales-agent',
  salesAgentPersona: () => '/admin/sales-agent/persona',
  salesAgentTraining: () => '/admin/sales-agent/training',
  salesAgentKnowledge: () => '/admin/sales-agent/knowledge',
  swarm: () => '/admin/swarm',
  social: () => '/admin/social',
  systemHealth: () => '/admin/system/health',
  systemApiKeys: () => '/admin/system/api-keys',
  systemFlags: () => '/admin/system/flags',
  systemLogs: () => '/admin/system/logs',
  systemSettings: () => '/admin/system/settings',
  supportImpersonate: () => '/admin/support/impersonate',
  supportExports: () => '/admin/support/exports',
  supportBulkOps: () => '/admin/support/bulk-ops',
  compliance: () => '/admin/advanced/compliance',
} as const;

// API route builders
export const apiRoutes = {
  workspace: {
    leads: (orgId: string) => `/api/workspace/${orgId}/leads`,
    contacts: (orgId: string) => `/api/workspace/${orgId}/contacts`,
    deals: (orgId: string) => `/api/workspace/${orgId}/deals`,
    forms: (orgId: string) => `/api/workspace/${orgId}/forms`,
    identity: (orgId: string) => `/api/workspace/${orgId}/identity`,
    coupons: (orgId: string) => `/api/workspace/${orgId}/coupons`,
    agentPersona: (orgId: string) => `/api/workspace/${orgId}/agent/persona`,
  },
  admin: {
    verify: () => '/api/admin/verify',
    stats: () => '/api/admin/stats',
    organizations: () => '/api/admin/organizations',
    organizationDetail: (orgId: string) => `/api/admin/organizations/${orgId}`,
    users: () => '/api/admin/users',
    platformPricing: () => '/api/admin/platform-pricing',
    swarmExecute: () => '/api/admin/swarm/execute',
  },
} as const;

// Type exports for route parameters
export type WorkspaceRouteKey = keyof typeof workspaceRoutes;
export type AdminRouteKey = keyof typeof adminRoutes;
export type ApiWorkspaceRouteKey = keyof typeof apiRoutes.workspace;
export type ApiAdminRouteKey = keyof typeof apiRoutes.admin;

// Platform internal organization constant
export const PLATFORM_INTERNAL_ORG_ID = 'platform-internal-org';
