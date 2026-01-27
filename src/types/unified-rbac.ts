/**
 * Unified Role-Based Access Control (RBAC) System
 * Single source of truth for the Command Center unification
 *
 * This file consolidates:
 * - AdminRole (platform_admin, admin, support, viewer) from admin.ts
 * - UserRole (platform_admin, owner, admin, manager, employee) from permissions.ts
 *
 * Into a single AccountRole system that the unified dashboard uses.
 */

import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

// =============================================================================
// ACCOUNT ROLE - Single source of truth
// =============================================================================

/**
 * Unified account role hierarchy (highest to lowest):
 * - platform_admin: Full platform access + system administration
 * - owner: Full access within their organization
 * - admin: Most permissions except billing and org deletion
 * - manager: Team-level management
 * - employee: Individual contributor access
 */
export type AccountRole = 'platform_admin' | 'owner' | 'admin' | 'manager' | 'employee';

/**
 * Role hierarchy for permission comparisons
 */
export const ACCOUNT_ROLE_HIERARCHY: Record<AccountRole, number> = {
  platform_admin: 5,
  owner: 4,
  admin: 3,
  manager: 2,
  employee: 1,
};

// =============================================================================
// UNIFIED USER - Single user interface for the Command Center
// =============================================================================

export interface UnifiedUser {
  id: string;
  email: string;
  displayName: string;
  role: AccountRole;

  /** Organization/Tenant ID - null for platform_admin default view */
  tenantId: string | null;

  /** Current workspace ID within the tenant */
  workspaceId?: string;

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
  platform_admin: {
    // Platform Administration - FULL ACCESS
    canAccessPlatformAdmin: true,
    canManageAllOrganizations: true,
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

  owner: {
    // Platform Administration - NO ACCESS
    canAccessPlatformAdmin: false,
    canManageAllOrganizations: false,
    canViewSystemHealth: false,
    canManageFeatureFlags: false,
    canViewAuditLogs: false,
    canManageSystemSettings: false,
    canImpersonateUsers: false,
    canAccessSupportTools: false,

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
 * 11 Operational Sections (available to client roles):
 * - command_center, crm, lead_gen, outbound, automation,
 *   content_factory, ai_workforce, ecommerce, analytics, website, settings
 *
 * 1 System Section (platform_admin only):
 * - system
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
  | 'system';          // System (platform_admin only): Health, Orgs, Users, Flags, Logs

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
 * Check if user is platform admin
 */
export function isPlatformAdminRole(role: AccountRole | null | undefined): boolean {
  return role === 'platform_admin';
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
 * Platform admins default to null (platform-level data)
 * All other roles must have a tenant ID
 */
export function getDefaultTenantId(
  role: AccountRole,
  userTenantId: string | null
): string | null {
  if (role === 'platform_admin') {
    // Platform admin can view platform-level data by default
    // But can also switch to specific tenants
    return userTenantId;
  }
  // All other roles must have a tenant ID
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
