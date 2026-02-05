/**
 * Role-Based Access Control (RBAC) System
 * SalesVelocity Penthouse Model - Binary RBAC
 *
 * Roles:
 * - admin: Full system access, user management, billing, all features
 * - user: Standard contributor - CRM, marketing, sales, limited management
 */

import type { AccountRole } from './unified-rbac';

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

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    // Company Management - FULL ACCESS
    canManageOrganization: true,
    canManageBilling: true,
    canManageAPIKeys: true,
    canManageTheme: true,

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

    // AI Agents - FULL ACCESS
    canTrainAIAgents: true,
    canDeployAIAgents: true,
    canManageAIAgents: true,

    // Reports & Analytics - FULL ACCESS
    canViewReports: true,
    canCreateReports: true,
    canExportReports: true,

    // Settings - FULL ACCESS
    canAccessSettings: true,
    canManageIntegrations: true,

    // E-Commerce - FULL ACCESS
    canManageEcommerce: true,
    canProcessOrders: true,
    canManageProducts: true,
  },

  user: {
    // Company Management - NO ACCESS
    canManageOrganization: false,
    canManageBilling: false,
    canManageAPIKeys: false,
    canManageTheme: false,

    // User Management - VIEW ONLY
    canInviteUsers: false,
    canRemoveUsers: false,
    canChangeUserRoles: false,
    canViewAllUsers: true,

    // Data Management - LIMITED
    canCreateSchemas: false,
    canEditSchemas: false,
    canDeleteSchemas: false,
    canExportData: true,
    canImportData: false,
    canDeleteData: false,
    canViewAllRecords: true,

    // CRM Operations - CREATE/EDIT
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: false,
    canViewOwnRecordsOnly: false,
    canAssignRecords: true,

    // Workflows & Automation - LIMITED
    canCreateWorkflows: true,
    canEditWorkflows: true,
    canDeleteWorkflows: false,

    // AI Agents - NO ACCESS
    canTrainAIAgents: false,
    canDeployAIAgents: false,
    canManageAIAgents: false,

    // Reports & Analytics - LIMITED
    canViewReports: true,
    canCreateReports: true,
    canExportReports: true,

    // Settings - NO ACCESS
    canAccessSettings: false,
    canManageIntegrations: false,

    // E-Commerce - LIMITED
    canManageEcommerce: false,
    canProcessOrders: true,
    canManageProducts: true,
  },
};

/**
 * Check if user has specific permission
 */
export function hasPermission(role: string | null | undefined, permission: keyof RolePermissions): boolean {
  if (!role) {
    return false;
  }

  const roleKey = role as UserRole;
  if (!ROLE_PERMISSIONS[roleKey]) {
    return false;
  }

  return ROLE_PERMISSIONS[roleKey][permission];
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
 * Get all permissions (admin-level)
 */
export function getAllPermissions(): RolePermissions {
  return ROLE_PERMISSIONS.admin;
}
