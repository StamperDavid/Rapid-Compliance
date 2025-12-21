/**
 * Role-Based Access Control (RBAC) System
 * Permission levels for multi-tenant white-label CRM
 */

export type UserRole = 'owner' | 'admin' | 'manager' | 'employee';

export interface RolePermissions {
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
  owner: {
    // Organization Management
    canManageOrganization: true,
    canManageBilling: true,
    canManageAPIKeys: true,
    canManageTheme: true,
    canDeleteOrganization: true,
    
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
  
  admin: {
    // Organization Management
    canManageOrganization: true,
    canManageBilling: false, // Only owner
    canManageAPIKeys: true,
    canManageTheme: true,
    canDeleteOrganization: false, // Only owner
    
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
    // Organization Management
    canManageOrganization: false,
    canManageBilling: false,
    canManageAPIKeys: false,
    canManageTheme: false,
    canDeleteOrganization: false,
    
    // User Management
    canInviteUsers: true,
    canRemoveUsers: false, // Can't remove
    canChangeUserRoles: false,
    canViewAllUsers: true,
    
    // Data Management
    canCreateSchemas: false, // Can't create schemas
    canEditSchemas: false,
    canDeleteSchemas: false,
    canExportData: true,
    canImportData: true,
    canDeleteData: false, // Can't delete data
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
    // Organization Management
    canManageOrganization: false,
    canManageBilling: false,
    canManageAPIKeys: false,
    canManageTheme: false,
    canDeleteOrganization: false,
    
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
    canViewAllRecords: false, // Only own records
    
    // CRM Operations
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: false,
    canViewOwnRecordsOnly: true, // KEY: Only see assigned records
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
export function hasPermission(role: UserRole, permission: keyof RolePermissions): boolean {
  // Handle undefined or invalid roles
  if (!role || !ROLE_PERMISSIONS[role]) {
    return false;
  }
  return ROLE_PERMISSIONS[role][permission];
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
  owner: 4,
  admin: 3,
  manager: 2,
  employee: 1,
};

export function isRoleHigherThan(role1: UserRole, role2: UserRole): boolean {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2];
}


