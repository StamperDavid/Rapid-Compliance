/**
 * Unified Role-Based Access Control (RBAC) System
 * Single source of truth for penthouse deployment
 *
 * Roles (highest to lowest privilege):
 * - owner: Master key — full system access, can delete org, impersonate users
 * - admin: Full system access minus destructive org ops and impersonation
 * - manager: Team lead — CRM, marketing, sales, limited user/data management
 * - member: Individual contributor — own records, limited read access
 */

import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

// =============================================================================
// ACCOUNT ROLE - Single source of truth
// =============================================================================

/**
 * Account roles (highest to lowest privilege):
 * - owner: Master key — full system access
 * - admin: Full access minus destructive org ops and impersonation
 * - manager: Team lead — CRM, marketing, sales, limited management
 * - member: Individual contributor — own records, limited read access
 */
export type AccountRole = 'owner' | 'admin' | 'manager' | 'member';

// =============================================================================
// UNIFIED USER - Single user interface for the Command Center
// =============================================================================

export interface UnifiedUser {
  id: string;
  email: string;
  displayName: string;
  role: AccountRole;

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
  // Platform Administration (admin only)
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
 * Role hierarchy for privilege comparison
 */
export const ROLE_HIERARCHY: Record<AccountRole, number> = {
  member: 0,
  manager: 1,
  admin: 2,
  owner: 3,
};

/**
 * Complete permission set for each role
 */
export const UNIFIED_ROLE_PERMISSIONS: Record<AccountRole, UnifiedPermissions> = {
  // ── OWNER: Master key — all permissions ────────────────────────────
  owner: {
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

  // ── ADMIN: Full access minus destructive org ops and impersonation ─
  admin: {
    // Platform Administration
    canAccessPlatformAdmin: true,
    canManageAllOrganizations: true,
    canViewSystemHealth: true,
    canManageFeatureFlags: true,
    canViewAuditLogs: true,
    canManageSystemSettings: true,
    canImpersonateUsers: false,
    canAccessSupportTools: true,

    // Organization Management
    canManageOrganization: true,
    canManageBilling: true,
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

  // ── MANAGER: Team lead — CRM, marketing, sales, limited management ─
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

    // Organization Management - theme only
    canManageOrganization: false,
    canManageBilling: false,
    canManageAPIKeys: false,
    canManageTheme: true,
    canDeleteOrganization: false,

    // User Management - invite and view only
    canInviteUsers: true,
    canRemoveUsers: false,
    canChangeUserRoles: false,
    canViewAllUsers: true,

    // Data Management - edit/export/import, no create/delete schemas
    canCreateSchemas: false,
    canEditSchemas: true,
    canDeleteSchemas: false,
    canExportData: true,
    canImportData: true,
    canDeleteData: false,
    canViewAllRecords: true,

    // CRM Operations - FULL ACCESS
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: true,
    canViewOwnRecordsOnly: false,
    canAssignRecords: true,

    // Workflows & Automation - create/edit, no delete
    canCreateWorkflows: true,
    canEditWorkflows: true,
    canDeleteWorkflows: false,

    // AI Agents & Swarm - use but not manage
    canTrainAIAgents: true,
    canDeployAIAgents: true,
    canManageAIAgents: false,
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

    // Settings - access but no integrations
    canAccessSettings: true,
    canManageIntegrations: false,

    // E-Commerce - FULL ACCESS
    canManageEcommerce: true,
    canProcessOrders: true,
    canManageProducts: true,
  },

  // ── MEMBER: Individual contributor — own records, limited read ──────
  member: {
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

    // Data Management - export only
    canCreateSchemas: false,
    canEditSchemas: false,
    canDeleteSchemas: false,
    canExportData: true,
    canImportData: false,
    canDeleteData: false,
    canViewAllRecords: false,

    // CRM Operations - create/edit own records
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

    // Sales - view only
    canViewLeads: true,
    canManageLeads: false,
    canViewDeals: true,
    canManageDeals: false,
    canAccessVoiceAgents: false,

    // Reports & Analytics - view only
    canViewReports: true,
    canCreateReports: false,
    canExportReports: false,
    canViewPlatformAnalytics: false,

    // Settings - NO ACCESS
    canAccessSettings: false,
    canManageIntegrations: false,

    // E-Commerce - process orders only
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
 */
export type NavigationCategory =
  | 'home'
  | 'crm'
  | 'outreach'
  | 'content'
  | 'ai_workforce'
  | 'ecommerce'
  | 'commerce'
  | 'website'
  | 'analytics'
  | 'system';

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
 * Check if a role has a specific permission.
 * Owner role is a master key — always returns true.
 */
export function hasUnifiedPermission(
  role: AccountRole | null | undefined,
  permission: keyof UnifiedPermissions
): boolean {
  if (!role) {
    return false;
  }
  if (role === 'owner') {
    return true;
  }
  return UNIFIED_ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

/**
 * Get all permissions for a role
 */
export function getUnifiedPermissions(role: AccountRole): UnifiedPermissions {
  return UNIFIED_ROLE_PERMISSIONS[role];
}

/**
 * Check if user is admin-level (owner or admin)
 */
export function isAdmin(role: AccountRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Check if role is at or above a certain level using the role hierarchy
 */
export function isRoleAtLeast(
  role: AccountRole | null | undefined,
  minimumRole: AccountRole
): boolean {
  if (!role) {
    return false;
  }
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole];
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
