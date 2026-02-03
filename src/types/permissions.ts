/**
 * Role-Based Access Control (RBAC) System
 * Single-Tenant SalesVelocity Model
 *
 * Role Hierarchy (highest to lowest):
 * - superadmin: Full company access, user management, all features
 * - admin: Organization management, API keys, theme, user management
 * - manager: Team-level management, workflows
 * - employee: Individual contributor access
 */

export type UserRole = 'superadmin' | 'admin' | 'manager' | 'employee';

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
  superadmin: {
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

  admin: {
    // Company Management
    canManageOrganization: true,
    canManageBilling: false,
    canManageAPIKeys: true,
    canManageTheme: true,

    // User Management
    canInviteUsers: true,
    canRemoveUsers: true,
    canChangeUserRoles: true,
    canViewAllUsers: true,

    // Data Management
    canCreateSchemas: true,
    canEditSchemas: true,
    canDeleteSchemas: true,
    canExportData: true,
    canImportData: true,
    canDeleteData: true,
    canViewAllRecords: true,

    // CRM Operations
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: true,
    canViewOwnRecordsOnly: false,
    canAssignRecords: true,

    // Workflows & Automation
    canCreateWorkflows: true,
    canEditWorkflows: true,
    canDeleteWorkflows: true,

    // AI Agents
    canTrainAIAgents: true,
    canDeployAIAgents: true,
    canManageAIAgents: true,

    // Reports & Analytics
    canViewReports: true,
    canCreateReports: true,
    canExportReports: true,

    // Settings
    canAccessSettings: true,
    canManageIntegrations: true,

    // E-Commerce
    canManageEcommerce: true,
    canProcessOrders: true,
    canManageProducts: true,
  },

  manager: {
    // Company Management
    canManageOrganization: false,
    canManageBilling: false,
    canManageAPIKeys: false,
    canManageTheme: false,

    // User Management
    canInviteUsers: true,
    canRemoveUsers: false,
    canChangeUserRoles: false,
    canViewAllUsers: true,

    // Data Management
    canCreateSchemas: false,
    canEditSchemas: false,
    canDeleteSchemas: false,
    canExportData: true,
    canImportData: true,
    canDeleteData: false,
    canViewAllRecords: true,

    // CRM Operations
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: false,
    canViewOwnRecordsOnly: false,
    canAssignRecords: true,

    // Workflows & Automation
    canCreateWorkflows: true,
    canEditWorkflows: true,
    canDeleteWorkflows: false,

    // AI Agents
    canTrainAIAgents: false,
    canDeployAIAgents: false,
    canManageAIAgents: false,

    // Reports & Analytics
    canViewReports: true,
    canCreateReports: true,
    canExportReports: true,

    // Settings
    canAccessSettings: false,
    canManageIntegrations: false,

    // E-Commerce
    canManageEcommerce: false,
    canProcessOrders: true,
    canManageProducts: true,
  },

  employee: {
    // Company Management
    canManageOrganization: false,
    canManageBilling: false,
    canManageAPIKeys: false,
    canManageTheme: false,

    // User Management
    canInviteUsers: false,
    canRemoveUsers: false,
    canChangeUserRoles: false,
    canViewAllUsers: false,

    // Data Management
    canCreateSchemas: false,
    canEditSchemas: false,
    canDeleteSchemas: false,
    canExportData: false,
    canImportData: false,
    canDeleteData: false,
    canViewAllRecords: false,

    // CRM Operations
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: false,
    canViewOwnRecordsOnly: true,
    canAssignRecords: false,

    // Workflows & Automation
    canCreateWorkflows: false,
    canEditWorkflows: false,
    canDeleteWorkflows: false,

    // AI Agents
    canTrainAIAgents: false,
    canDeployAIAgents: false,
    canManageAIAgents: false,

    // Reports & Analytics
    canViewReports: true,
    canCreateReports: false,
    canExportReports: false,

    // Settings
    canAccessSettings: false,
    canManageIntegrations: false,

    // E-Commerce
    canManageEcommerce: false,
    canProcessOrders: true,
    canManageProducts: false,
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
 * Role hierarchy (for checking if role is higher than another)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  superadmin: 4,
  admin: 3,
  manager: 2,
  employee: 1,
};

/**
 * Check if user has superadmin role
 */
export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === 'superadmin';
}

/**
 * Get all permissions for superadmin role
 */
export function getAllPermissions(): RolePermissions {
  return ROLE_PERMISSIONS.superadmin;
}

export function isRoleHigherThan(role1: UserRole, role2: UserRole): boolean {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2];
}
