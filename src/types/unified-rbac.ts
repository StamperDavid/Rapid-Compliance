/**
 * Unified Role-Based Access Control (RBAC) System
 * Single source of truth for penthouse deployment
 *
 * Binary Roles:
 * - admin: Full system access, user management, billing, all features
 * - user: Standard contributor - CRM, marketing, sales, limited management
 */

import type { LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

// =============================================================================
// ACCOUNT ROLE - Single source of truth
// =============================================================================

/**
 * Binary account roles:
 * - admin: Full system access, user management, billing, all features
 * - user: Standard contributor - create/edit records, limited management
 */
export type AccountRole = 'admin' | 'user';

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
 * Complete permission set for each role
 */
export const UNIFIED_ROLE_PERMISSIONS: Record<AccountRole, UnifiedPermissions> = {
  admin: {
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

  user: {
    // Penthouse model: all permissions granted for single-tenant deployment
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
};

// =============================================================================
// NAVIGATION TYPES - Role-based sidebar sections
// =============================================================================

/**
 * Navigation section categories
 */
export type NavigationCategory =
  | 'command_center'
  | 'crm'
  | 'lead_gen'
  | 'outbound'
  | 'automation'
  | 'content_factory'
  | 'ai_workforce'
  | 'ecommerce'
  | 'analytics'
  | 'website'
  | 'settings'
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
 * Check if user is admin (has full system access)
 */
export function isAdmin(role: AccountRole | null | undefined): boolean {
  return role === 'admin';
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
  if (minimumRole === 'user') {
    return true;
  }
  return role === 'admin';
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
