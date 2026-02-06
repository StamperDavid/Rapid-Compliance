/**
 * Role-Based Access Control (RBAC) System
 * SalesVelocity Penthouse Model
 *
 * This is a THIN RE-EXPORT LAYER. The single source of truth is unified-rbac.ts.
 * This file exists for backward compatibility with 46+ pages that import from it.
 *
 * Roles: owner | admin | manager | member
 */

import {
  type AccountRole,
  type UnifiedPermissions,
  UNIFIED_ROLE_PERMISSIONS,
  hasUnifiedPermission,
} from './unified-rbac';

export type UserRole = AccountRole;

export interface RolePermissions {
  // Company Management
  canManageOrganization: boolean;
  canManageBilling: boolean;
  canManageAPIKeys: boolean;
  canManageTheme: boolean;

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

  // AI Agents
  canTrainAIAgents: boolean;
  canDeployAIAgents: boolean;
  canManageAIAgents: boolean;

  // Reports & Analytics
  canViewReports: boolean;
  canCreateReports: boolean;
  canExportReports: boolean;

  // Settings
  canAccessSettings: boolean;
  canManageIntegrations: boolean;

  // E-Commerce
  canManageEcommerce: boolean;
  canProcessOrders: boolean;
  canManageProducts: boolean;
}

/**
 * Extract the legacy 31-field RolePermissions subset from a UnifiedPermissions object.
 */
function toRolePermissions(unified: UnifiedPermissions): RolePermissions {
  return {
    canManageOrganization: unified.canManageOrganization,
    canManageBilling: unified.canManageBilling,
    canManageAPIKeys: unified.canManageAPIKeys,
    canManageTheme: unified.canManageTheme,
    canInviteUsers: unified.canInviteUsers,
    canRemoveUsers: unified.canRemoveUsers,
    canChangeUserRoles: unified.canChangeUserRoles,
    canViewAllUsers: unified.canViewAllUsers,
    canCreateSchemas: unified.canCreateSchemas,
    canEditSchemas: unified.canEditSchemas,
    canDeleteSchemas: unified.canDeleteSchemas,
    canExportData: unified.canExportData,
    canImportData: unified.canImportData,
    canDeleteData: unified.canDeleteData,
    canViewAllRecords: unified.canViewAllRecords,
    canCreateRecords: unified.canCreateRecords,
    canEditRecords: unified.canEditRecords,
    canDeleteRecords: unified.canDeleteRecords,
    canViewOwnRecordsOnly: unified.canViewOwnRecordsOnly,
    canAssignRecords: unified.canAssignRecords,
    canCreateWorkflows: unified.canCreateWorkflows,
    canEditWorkflows: unified.canEditWorkflows,
    canDeleteWorkflows: unified.canDeleteWorkflows,
    canTrainAIAgents: unified.canTrainAIAgents,
    canDeployAIAgents: unified.canDeployAIAgents,
    canManageAIAgents: unified.canManageAIAgents,
    canViewReports: unified.canViewReports,
    canCreateReports: unified.canCreateReports,
    canExportReports: unified.canExportReports,
    canAccessSettings: unified.canAccessSettings,
    canManageIntegrations: unified.canManageIntegrations,
    canManageEcommerce: unified.canManageEcommerce,
    canProcessOrders: unified.canProcessOrders,
    canManageProducts: unified.canManageProducts,
  };
}

/**
 * Derived from UNIFIED_ROLE_PERMISSIONS — single source of truth.
 */
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  owner: toRolePermissions(UNIFIED_ROLE_PERMISSIONS.owner),
  admin: toRolePermissions(UNIFIED_ROLE_PERMISSIONS.admin),
  manager: toRolePermissions(UNIFIED_ROLE_PERMISSIONS.manager),
  member: toRolePermissions(UNIFIED_ROLE_PERMISSIONS.member),
};

/**
 * Check if user has specific permission.
 * Delegates to unified-rbac hasUnifiedPermission (owner = master key).
 */
export function hasPermission(role: string | null | undefined, permission: keyof RolePermissions): boolean {
  return hasUnifiedPermission(role as AccountRole | null | undefined, permission as keyof UnifiedPermissions);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role];
}

/**
 * Check if user can perform action
 */
export function canPerformAction(userRole: UserRole, requiredPermission: keyof RolePermissions): boolean {
  return hasPermission(userRole, requiredPermission);
}

/**
 * Get all permissions (owner-level)
 */
export function getAllPermissions(): RolePermissions {
  return ROLE_PERMISSIONS.owner;
}
