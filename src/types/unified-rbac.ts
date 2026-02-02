/**
 * Unified Role-Based Access Control (RBAC) System
 * Single source of truth for single-tenant deployment
 *
 * 4-Level Hierarchy (Single-Tenant Mode):
 * - superadmin: Full system access, user management, billing, all features
 * - admin: Organization management, API keys, theme, user management
 * - manager: Team management, workflows, marketing, sales
 * - employee: Individual contributor - create/edit own records only
 */

import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

// =============================================================================
// ACCOUNT ROLE - Single source of truth
// =============================================================================

/**
 * Unified account role hierarchy (highest to lowest):
 * - superadmin: Full system access, user management, billing, all features
 * - admin: Organization management, API keys, theme, user management
 * - manager: Team management, workflows, marketing, sales
 * - employee: Individual contributor - create/edit own records only
 */
export type AccountRole = 'superadmin' | 'admin' | 'manager' | 'employee';

/**
 * @deprecated Legacy role type - now unified to AccountRole. Will be removed.
 */
export type LegacyAccountRole = 'owner' | 'admin' | 'manager' | 'employee';

/**
 * Role hierarchy for permission comparisons
 */
export const ACCOUNT_ROLE_HIERARCHY: Record<AccountRole, number> = {
  superadmin: 4,
  admin: 3,
  manager: 2,
  employee: 1,
};

/**
 * Maps legacy roles to new 4-level hierarchy
 * Use this during migration to convert existing role assignments
 */
export function migrateLegacyRole(legacyRole: LegacyAccountRole): AccountRole {
  switch (legacyRole) {
    case 'owner':
      return 'superadmin';
    case 'admin':
      return 'admin';
    case 'manager':
      return 'manager';
    case 'employee':
      return 'employee';
  }
}

// =============================================================================
// UNIFIED USER - Single user interface for the Command Center
// =============================================================================

export interface UnifiedUser {
  id: string;
  email: string;
  displayName: string;
  role: AccountRole;

  /** Organization/Tenant ID - uses DEFAULT_ORG_ID in single-tenant mode */
  tenantId: string;

  /** Avatar URL */
  avatarUrl?: string;

  /** Account status */
  status: 'active' | 'suspended' | 'pending';

  /** MFA enabled */
  mfaEnabled: boolean;

  /** Timestamps */
  createdAt?: Timestamp;
  lastLoginAt?: Timestamp;
}

// =============================================================================
// UNIFIED PERMISSIONS - Combined permission set
// =============================================================================

export interface UnifiedPermissions {
  // Platform Administration (platform_admin only)
  canAccessPlatformAdmin: boolean;
  canManageAllOrganizations: boolean;
  canViewSystemHealth: boolean;
  canManageFeatureFlags: boolean;
  canViewAuditLogs: boolean;
  canManageSystemSettings: boolean;
  canImpersonateUsers: boolean;
  canAccessSupportTools: boolean;

  // Organization Management
  canManageOrganization: boolean;
  canManageBilling: boolean;
  canManageAPIKeys: boolean;
  canManageTheme: boolean;
  canDeleteOrganization: boolean;

  // User Management
  canInviteUsers: boolean;
  canRemoveUsers: boolean;
  canChangeUserRoles: boolean;
  canViewAllUsers: boolean;

  // Data Management
  canCreateSchemas: boolean;
  canEditSchemas: boolean;
  canDeleteSchemas: boolean;
  canExportData: boolean;
  canImportData: boolean;
  canDeleteData: boolean;
  canViewAllRecords: boolean;

  // CRM Operations
  canCreateRecords: boolean;
  canEditRecords: boolean;
  canDeleteRecords: boolean;
  canViewOwnRecordsOnly: boolean;
  canAssignRecords: boolean;

  // Workflows & Automation
  canCreateWorkflows: boolean;
  canEditWorkflows: boolean;
  canDeleteWorkflows: boolean;

  // AI Agents & Swarm
  canTrainAIAgents: boolean;
  canDeployAIAgents: boolean;
  canManageAIAgents: boolean;
  canAccessSwarmPanel: boolean;

  // Marketing
  canManageSocialMedia: boolean;
  canManageEmailCampaigns: boolean;
  canManageWebsite: boolean;

  // Sales
  canViewLeads: boolean;
  canManageLeads: boolean;
  canViewDeals: boolean;
  canManageDeals: boolean;
  canAccessVoiceAgents: boolean;

  // Reports & Analytics
  canViewReports: boolean;
  canCreateReports: boolean;
  canExportReports: boolean;
  canViewPlatformAnalytics: boolean;

  // Settings
  canAccessSettings: boolean;
  canManageIntegrations: boolean;

  // E-Commerce
  canManageEcommerce: boolean;
  canProcessOrders: boolean;
  canManageProducts: boolean;
}

/**
 * Complete permission set for each role
 */
export const UNIFIED_ROLE_PERMISSIONS: Record<AccountRole, UnifiedPermissions> = {
  superadmin: {
    // Platform Administration - FULL ACCESS (single-tenant: system settings)
    canAccessPlatformAdmin: true,
    canManageAllOrganizations: true, // In single-tenant, manages the single org
    canViewSystemHealth: true,
    canManageFeatureFlags: true,
    canViewAuditLogs: true,
    canManageSystemSettings: true,
    canImpersonateUsers: true,
    canAccessSupportTools: true,

    // Organization Management - FULL ACCESS
    canManageOrganization: true,
    canManageBilling: true,
    canManageAPIKeys: true,
    canManageTheme: true,
    canDeleteOrganization: true,

    // User Management - FULL ACCESS
    canInviteUsers: true,
    canRemoveUsers: true,
    canChangeUserRoles: true,
    canViewAllUsers: true,

    // Data Management - FULL ACCESS
    canCreateSchemas: true,
    canEditSchemas: true,
    canDeleteSchemas: true,
    canExportData: true,
    canImportData: true,
    canDeleteData: true,
    canViewAllRecords: true,

    // CRM Operations - FULL ACCESS
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: true,
    canViewOwnRecordsOnly: false,
    canAssignRecords: true,

    // Workflows & Automation - FULL ACCESS
    canCreateWorkflows: true,
    canEditWorkflows: true,
    canDeleteWorkflows: true,

    // AI Agents & Swarm - FULL ACCESS
    canTrainAIAgents: true,
    canDeployAIAgents: true,
    canManageAIAgents: true,
    canAccessSwarmPanel: true,

    // Marketing - FULL ACCESS
    canManageSocialMedia: true,
    canManageEmailCampaigns: true,
    canManageWebsite: true,

    // Sales - FULL ACCESS
    canViewLeads: true,
    canManageLeads: true,
    canViewDeals: true,
    canManageDeals: true,
    canAccessVoiceAgents: true,

    // Reports & Analytics - FULL ACCESS
    canViewReports: true,
    canCreateReports: true,
    canExportReports: true,
    canViewPlatformAnalytics: true,

    // Settings - FULL ACCESS
    canAccessSettings: true,
    canManageIntegrations: true,

    // E-Commerce - FULL ACCESS
    canManageEcommerce: true,
    canProcessOrders: true,
    canManageProducts: true,
  },

  admin: {
    // Platform Administration - NO ACCESS
    canAccessPlatformAdmin: false,
    canManageAllOrganizations: false,
    canViewSystemHealth: false,
    canManageFeatureFlags: false,
    canViewAuditLogs: false,
    canManageSystemSettings: false,
    canImpersonateUsers: false,
    canAccessSupportTools: false,

    // Organization Management - LIMITED
    canManageOrganization: true,
    canManageBilling: false,
    canManageAPIKeys: true,
    canManageTheme: true,
    canDeleteOrganization: false,

    // User Management - FULL ACCESS
    canInviteUsers: true,
    canRemoveUsers: true,
    canChangeUserRoles: true,
    canViewAllUsers: true,

    // Data Management - FULL ACCESS
    canCreateSchemas: true,
    canEditSchemas: true,
    canDeleteSchemas: true,
    canExportData: true,
    canImportData: true,
    canDeleteData: true,
    canViewAllRecords: true,

    // CRM Operations - FULL ACCESS
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: true,
    canViewOwnRecordsOnly: false,
    canAssignRecords: true,

    // Workflows & Automation - FULL ACCESS
    canCreateWorkflows: true,
    canEditWorkflows: true,
    canDeleteWorkflows: true,

    // AI Agents & Swarm - FULL ACCESS
    canTrainAIAgents: true,
    canDeployAIAgents: true,
    canManageAIAgents: true,
    canAccessSwarmPanel: true,

    // Marketing - FULL ACCESS
    canManageSocialMedia: true,
    canManageEmailCampaigns: true,
    canManageWebsite: true,

    // Sales - FULL ACCESS
    canViewLeads: true,
    canManageLeads: true,
    canViewDeals: true,
    canManageDeals: true,
    canAccessVoiceAgents: true,

    // Reports & Analytics - FULL ACCESS (except platform)
    canViewReports: true,
    canCreateReports: true,
    canExportReports: true,
    canViewPlatformAnalytics: false,

    // Settings - FULL ACCESS
    canAccessSettings: true,
    canManageIntegrations: true,

    // E-Commerce - FULL ACCESS
    canManageEcommerce: true,
    canProcessOrders: true,
    canManageProducts: true,
  },

  manager: {
    // Platform Administration - NO ACCESS
    canAccessPlatformAdmin: false,
    canManageAllOrganizations: false,
    canViewSystemHealth: false,
    canManageFeatureFlags: false,
    canViewAuditLogs: false,
    canManageSystemSettings: false,
    canImpersonateUsers: false,
    canAccessSupportTools: false,

    // Organization Management - NO ACCESS
    canManageOrganization: false,
    canManageBilling: false,
    canManageAPIKeys: false,
    canManageTheme: false,
    canDeleteOrganization: false,

    // User Management - LIMITED
    canInviteUsers: true,
    canRemoveUsers: false,
    canChangeUserRoles: false,
    canViewAllUsers: true,

    // Data Management - LIMITED
    canCreateSchemas: false,
    canEditSchemas: false,
    canDeleteSchemas: false,
    canExportData: true,
    canImportData: true,
    canDeleteData: false,
    canViewAllRecords: true,

    // CRM Operations - LIMITED
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: false,
    canViewOwnRecordsOnly: false,
    canAssignRecords: true,

    // Workflows & Automation - LIMITED
    canCreateWorkflows: true,
    canEditWorkflows: true,
    canDeleteWorkflows: false,

    // AI Agents & Swarm - NO ACCESS
    canTrainAIAgents: false,
    canDeployAIAgents: false,
    canManageAIAgents: false,
    canAccessSwarmPanel: false,

    // Marketing - LIMITED
    canManageSocialMedia: true,
    canManageEmailCampaigns: true,
    canManageWebsite: false,

    // Sales - FULL ACCESS
    canViewLeads: true,
    canManageLeads: true,
    canViewDeals: true,
    canManageDeals: true,
    canAccessVoiceAgents: true,

    // Reports & Analytics - LIMITED
    canViewReports: true,
    canCreateReports: true,
    canExportReports: true,
    canViewPlatformAnalytics: false,

    // Settings - NO ACCESS
    canAccessSettings: false,
    canManageIntegrations: false,

    // E-Commerce - LIMITED
    canManageEcommerce: false,
    canProcessOrders: true,
    canManageProducts: true,
  },

  employee: {
    // Platform Administration - NO ACCESS
    canAccessPlatformAdmin: false,
    canManageAllOrganizations: false,
    canViewSystemHealth: false,
    canManageFeatureFlags: false,
    canViewAuditLogs: false,
    canManageSystemSettings: false,
    canImpersonateUsers: false,
    canAccessSupportTools: false,

    // Organization Management - NO ACCESS
    canManageOrganization: false,
    canManageBilling: false,
    canManageAPIKeys: false,
    canManageTheme: false,
    canDeleteOrganization: false,

    // User Management - NO ACCESS
    canInviteUsers: false,
    canRemoveUsers: false,
    canChangeUserRoles: false,
    canViewAllUsers: false,

    // Data Management - LIMITED
    canCreateSchemas: false,
    canEditSchemas: false,
    canDeleteSchemas: false,
    canExportData: false,
    canImportData: false,
    canDeleteData: false,
    canViewAllRecords: false,

    // CRM Operations - LIMITED
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: false,
    canViewOwnRecordsOnly: true,
    canAssignRecords: false,

    // Workflows & Automation - NO ACCESS
    canCreateWorkflows: false,
    canEditWorkflows: false,
    canDeleteWorkflows: false,

    // AI Agents & Swarm - NO ACCESS
    canTrainAIAgents: false,
    canDeployAIAgents: false,
    canManageAIAgents: false,
    canAccessSwarmPanel: false,

    // Marketing - NO ACCESS
    canManageSocialMedia: false,
    canManageEmailCampaigns: false,
    canManageWebsite: false,

    // Sales - LIMITED
    canViewLeads: true,
    canManageLeads: false,
    canViewDeals: true,
    canManageDeals: false,
    canAccessVoiceAgents: false,

    // Reports & Analytics - LIMITED
    canViewReports: true,
    canCreateReports: false,
    canExportReports: false,
    canViewPlatformAnalytics: false,

    // Settings - NO ACCESS
    canAccessSettings: false,
    canManageIntegrations: false,

    // E-Commerce - LIMITED
    canManageEcommerce: false,
    canProcessOrders: true,
    canManageProducts: false,
  },
};

// =============================================================================
// NAVIGATION TYPES - Role-based sidebar sections
// =============================================================================

/**
 * Navigation section categories
 * These map to the sidebar sections visible based on role
 *
 * 11 Operational Sections (available to all roles):
 * - command_center, crm, lead_gen, outbound, automation,
 *   content_factory, ai_workforce, ecommerce, analytics, website, settings
 *
 * 1 System Section (superadmin only):
 * - system
 *
 * Admin-Only Sections (superadmin in admin context):
 * - admin_org_view: Navigation for viewing organization details in admin panel
 * - admin_support: Support tools (impersonate, exports, bulk ops, API health)
 */
export type NavigationCategory =
  | 'command_center'   // Command Center: Workforce HQ, Dashboard, Conversations
  | 'crm'              // CRM: Leads, Deals, Contacts, Living Ledger
  | 'lead_gen'         // Lead Gen: Forms, Research, Scoring
  | 'outbound'         // Outbound: Sequences, Campaigns, Email Writer, Nurture, Calls
  | 'automation'       // Automation: Workflows, A/B Tests
  | 'content_factory'  // Content Factory: Video, Social, Proposals, Battlecards
  | 'ai_workforce'     // AI Workforce: Training, Voice AI, Social AI, SEO AI, Datasets, Fine-Tuning
  | 'ecommerce'        // E-Commerce: Products, Orders, Storefront
  | 'analytics'        // Analytics: Overview, Revenue, Pipeline, Sequences
  | 'website'          // Website: Pages, Blog, Domains, SEO, Settings
  | 'settings'         // Settings: Organization, Integrations, API Keys, Billing
  | 'system'           // System (platform_admin only): Health, Orgs, Users, Flags, Logs
  | 'admin_org_view'   // Admin Org View: Overview, Edit, Back to List (admin context)
  | 'admin_support';   // Admin Support: Impersonate, Bulk Ops, Exports, API Health (admin context)

/**
 * Navigation item definition
 */
export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;

  /** Permission required to see this item */
  requiredPermission?: keyof UnifiedPermissions;

  /** Badge count (e.g., notifications) */
  badge?: number;

  /** Sub-items for nested navigation */
  children?: NavigationItem[];

  /** Whether this item is disabled */
  disabled?: boolean;

  /** Icon color (hex) - used for colorful icon display in sidebar */
  iconColor?: string;
}

/**
 * Navigation section definition
 */
export interface NavigationSection {
  id: NavigationCategory;
  label: string;
  icon: LucideIcon;

  /** Roles that can see this section */
  allowedRoles: AccountRole[];

  /** Items in this section */
  items: NavigationItem[];

  /** Whether section is collapsible */
  collapsible?: boolean;

  /** Default collapsed state */
  defaultCollapsed?: boolean;

  /** Section icon color (hex) - used for colorful section header icons */
  iconColor?: string;
}

/**
 * Complete navigation structure for the sidebar
 */
export interface NavigationStructure {
  sections: NavigationSection[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a role has a specific permission
 */
export function hasUnifiedPermission(
  role: AccountRole | null | undefined,
  permission: keyof UnifiedPermissions
): boolean {
  if (!role) {
    return false;
  }
  const permissions = UNIFIED_ROLE_PERMISSIONS[role];
  if (!permissions) {
    return false;
  }
  return permissions[permission];
}

/**
 * Get all permissions for a role
 */
export function getUnifiedPermissions(role: AccountRole): UnifiedPermissions {
  return UNIFIED_ROLE_PERMISSIONS[role];
}

/**
 * Check if user is superadmin (has full system access)
 */
export function isSuperadminRole(role: AccountRole | null | undefined): boolean {
  return role === 'superadmin';
}

/**
 * @deprecated Use isSuperadminRole instead. Will be removed.
 */
export function isPlatformAdminRole(role: AccountRole | LegacyAccountRole | null | undefined): boolean {
  return role === 'superadmin';
}

/**
 * Check if role is at or above a certain level
 */
export function isRoleAtLeast(
  role: AccountRole | null | undefined,
  minimumRole: AccountRole
): boolean {
  if (!role) {
    return false;
  }
  return ACCOUNT_ROLE_HIERARCHY[role] >= ACCOUNT_ROLE_HIERARCHY[minimumRole];
}

/**
 * Compare two roles
 */
export function isRoleHigherThanUnified(
  role1: AccountRole,
  role2: AccountRole
): boolean {
  return ACCOUNT_ROLE_HIERARCHY[role1] > ACCOUNT_ROLE_HIERARCHY[role2];
}

/**
 * Get the default tenant ID for a role
 * In single-tenant mode, all roles use DEFAULT_ORG_ID
 */
export function getDefaultTenantId(
  _role: AccountRole,
  userTenantId: string
): string {
  // In single-tenant mode, all users belong to the same org
  return userTenantId;
}

/**
 * Filter navigation sections based on user role
 */
export function filterNavigationByRole(
  sections: NavigationSection[],
  role: AccountRole
): NavigationSection[] {
  return sections
    .filter(section => section.allowedRoles.includes(role))
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (!item.requiredPermission) {
          return true;
        }
        return hasUnifiedPermission(role, item.requiredPermission);
      }),
    }))
    .filter(section => section.items.length > 0);
}
