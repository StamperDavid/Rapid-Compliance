import type { Timestamp } from 'firebase/firestore';

/**
 * Admin Types for SalesVelocity
 * Penthouse Model - Company Settings & System Configuration
 */

/**
 * Admin role type - penthouse binary RBAC
 * All admin panel users are 'admin'
 */
export type AdminRole = 'admin';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;

  // Permissions
  permissions: AdminPermissions;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
  createdBy?: string;

  // Status
  status: 'active' | 'suspended';
  mfaEnabled: boolean;
}

export interface AdminPermissions {
  // User Management
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canSuspendUsers: boolean;
  canDeleteUsers: boolean;

  // Company Settings
  canViewSettings: boolean;
  canManageSettings: boolean;
  canManageIntegrations: boolean;
  canManageAPIKeys: boolean;

  // System Management
  canViewSystemHealth: boolean;
  canManageFeatureFlags: boolean;
  canViewAuditLogs: boolean;

  // Data Management
  canExportData: boolean;
  canImportData: boolean;
  canViewAnalytics: boolean;
}

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, AdminPermissions> = {
  admin: {
    canViewUsers: true,
    canCreateUsers: true,
    canEditUsers: true,
    canSuspendUsers: true,
    canDeleteUsers: true,
    canViewSettings: true,
    canManageSettings: true,
    canManageIntegrations: true,
    canManageAPIKeys: true,
    canViewSystemHealth: true,
    canManageFeatureFlags: true,
    canViewAuditLogs: true,
    canExportData: true,
    canImportData: true,
    canViewAnalytics: true,
  },
};

/**
 * System Health Metrics
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: Timestamp;

  services: {
    database: ServiceStatus;
    storage: ServiceStatus;
    ai: ServiceStatus;
    email: ServiceStatus;
    sms: ServiceStatus;
    api: ServiceStatus;
  };

  performance: {
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
    activeConnections: number;
  };

  alerts: Alert[];
}

export interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  lastChecked: Timestamp;
  message?: string;
}

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  service: string;
  message: string;
  timestamp: Timestamp;
  resolved: boolean;
}

/**
 * Feature Flag
 */
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Audit Log
 */
export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Timestamp;
}

/**
 * System Configuration
 */
export type SystemConfigValue = string | number | boolean | Record<string, unknown>;

export interface SystemConfig {
  id: string;
  key: string;
  value: SystemConfigValue;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  category: 'general' | 'ai' | 'integrations' | 'security';
  updatedBy: string;
  updatedAt: Date | Timestamp;
}
