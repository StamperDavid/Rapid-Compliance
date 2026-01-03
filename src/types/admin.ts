import type { Timestamp } from 'firebase/firestore';

/**
 * Admin Platform Types
 * For managing the entire SaaS platform
 */

export type AdminRole = 'super_admin' | 'admin' | 'support' | 'viewer';

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
  // Organization Management
  canViewOrganizations: boolean;
  canCreateOrganizations: boolean;
  canEditOrganizations: boolean;
  canSuspendOrganizations: boolean;
  canDeleteOrganizations: boolean;
  
  // User Management
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canSuspendUsers: boolean;
  canDeleteUsers: boolean;
  canImpersonateUsers: boolean;
  
  // Billing Management
  canViewBilling: boolean;
  canManageSubscriptions: boolean;
  canProcessRefunds: boolean;
  canViewPaymentHistory: boolean;
  
  // System Management
  canViewSystemHealth: boolean;
  canManageFeatureFlags: boolean;
  canViewAuditLogs: boolean;
  canManageSystemSettings: boolean;
  
  // Support Tools
  canAccessSupportTools: boolean;
  canExportData: boolean;
  canViewUsageAnalytics: boolean;
  
  // Advanced
  canManageIntegrations: boolean;
  canManageTemplates: boolean;
  canManageCompliance: boolean;
}

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, AdminPermissions> = {
  super_admin: {
    canViewOrganizations: true,
    canCreateOrganizations: true,
    canEditOrganizations: true,
    canSuspendOrganizations: true,
    canDeleteOrganizations: true,
    canViewUsers: true,
    canCreateUsers: true,
    canEditUsers: true,
    canSuspendUsers: true,
    canDeleteUsers: true,
    canImpersonateUsers: true,
    canViewBilling: true,
    canManageSubscriptions: true,
    canProcessRefunds: true,
    canViewPaymentHistory: true,
    canViewSystemHealth: true,
    canManageFeatureFlags: true,
    canViewAuditLogs: true,
    canManageSystemSettings: true,
    canAccessSupportTools: true,
    canExportData: true,
    canViewUsageAnalytics: true,
    canManageIntegrations: true,
    canManageTemplates: true,
    canManageCompliance: true,
  },
  admin: {
    canViewOrganizations: true,
    canCreateOrganizations: true,
    canEditOrganizations: true,
    canSuspendOrganizations: true,
    canDeleteOrganizations: false,
    canViewUsers: true,
    canCreateUsers: true,
    canEditUsers: true,
    canSuspendUsers: true,
    canDeleteUsers: false,
    canImpersonateUsers: true,
    canViewBilling: true,
    canManageSubscriptions: true,
    canProcessRefunds: false,
    canViewPaymentHistory: true,
    canViewSystemHealth: true,
    canManageFeatureFlags: true,
    canViewAuditLogs: true,
    canManageSystemSettings: false,
    canAccessSupportTools: true,
    canExportData: true,
    canViewUsageAnalytics: true,
    canManageIntegrations: true,
    canManageTemplates: true,
    canManageCompliance: false,
  },
  support: {
    canViewOrganizations: true,
    canCreateOrganizations: false,
    canEditOrganizations: true,
    canSuspendOrganizations: false,
    canDeleteOrganizations: false,
    canViewUsers: true,
    canCreateUsers: false,
    canEditUsers: true,
    canSuspendUsers: false,
    canDeleteUsers: false,
    canImpersonateUsers: true,
    canViewBilling: true,
    canManageSubscriptions: false,
    canProcessRefunds: false,
    canViewPaymentHistory: true,
    canViewSystemHealth: true,
    canManageFeatureFlags: false,
    canViewAuditLogs: true,
    canManageSystemSettings: false,
    canAccessSupportTools: true,
    canExportData: false,
    canViewUsageAnalytics: true,
    canManageIntegrations: false,
    canManageTemplates: false,
    canManageCompliance: false,
  },
  viewer: {
    canViewOrganizations: true,
    canCreateOrganizations: false,
    canEditOrganizations: false,
    canSuspendOrganizations: false,
    canDeleteOrganizations: false,
    canViewUsers: true,
    canCreateUsers: false,
    canEditUsers: false,
    canSuspendUsers: false,
    canDeleteUsers: false,
    canImpersonateUsers: false,
    canViewBilling: true,
    canManageSubscriptions: false,
    canProcessRefunds: false,
    canViewPaymentHistory: true,
    canViewSystemHealth: true,
    canManageFeatureFlags: false,
    canViewAuditLogs: true,
    canManageSystemSettings: false,
    canAccessSupportTools: false,
    canExportData: false,
    canViewUsageAnalytics: true,
    canManageIntegrations: false,
    canManageTemplates: false,
    canManageCompliance: false,
  },
};

/**
 * System Health Metrics
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: Timestamp;
  
  // Services
  services: {
    database: ServiceStatus;
    storage: ServiceStatus;
    ai: ServiceStatus;
    email: ServiceStatus;
    sms: ServiceStatus;
    api: ServiceStatus;
  };
  
  // Performance
  performance: {
    averageResponseTime: number; // ms
    errorRate: number; // percentage
    uptime: number; // percentage
    activeConnections: number;
  };
  
  // Alerts
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
 * Platform Metrics
 */
export interface PlatformMetrics {
  period: string; // e.g., "2024-03"
  
  // Organizations
  totalOrganizations: number;
  activeOrganizations: number;
  trialOrganizations: number;
  suspendedOrganizations: number;
  
  // Users
  totalUsers: number;
  activeUsers: number;
  newUsersThisPeriod: number;
  
  // Usage
  totalApiCalls: number;
  totalAICalls: number;
  totalStorageGB: number;
  totalRecords: number;
  
  // Revenue
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  totalRevenue: number;
  newRevenue: number;
  churnRate: number;
  
  // Growth
  growthRate: number;
  conversionRate: number;
  
  updatedAt: Timestamp;
}

/**
 * Feature Flag
 */
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Rollout
  rolloutPercentage: number; // 0-100
  targetOrganizations?: string[]; // Specific org IDs
  excludeOrganizations?: string[]; // Excluded org IDs
  
  // Conditions
  conditions?: {
    plan?: ('free' | 'pro' | 'enterprise')[];
    industry?: string[];
    createdAt?: {
      before?: Timestamp;
      after?: Timestamp;
    };
  };
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Admin Audit Log
 */
export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string; // e.g., "organization.suspended", "user.impersonated"
  resourceType: string;
  resourceId: string;
  
  // Details
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  
  timestamp: Timestamp;
}

/**
 * Impersonation Session
 */
export interface ImpersonationSession {
  id: string;
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetUserEmail: string;
  targetOrganizationId: string;
  
  startedAt: Timestamp;
  endedAt?: Timestamp;
  reason?: string;
}

/**
 * Bulk Operation
 */
export interface BulkOperation {
  id: string;
  type: 'export' | 'import' | 'update' | 'delete' | 'suspend';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  // Scope
  organizationIds?: string[];
  resourceType: string;
  
  // Parameters
  parameters: Record<string, unknown>;
  
  // Export format (for export operations)
  format?: 'json' | 'csv' | 'xlsx';
  
  // Results
  totalItems: number;
  processedItems: number;
  successCount: number;
  errorCount: number;
  errors?: Array<{ item: string; error: string }>;
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  downloadUrl?: string;
}

/**
 * Compliance Record
 */
export interface ComplianceRecord {
  id: string;
  organizationId: string;
  type: 'gdpr' | 'ccpa' | 'sox' | 'custom';
  
  // Status
  status: 'compliant' | 'non_compliant' | 'pending_review';
  
  // Requirements
  requirements: ComplianceRequirement[];
  
  // Audit
  lastAuditAt?: Timestamp;
  nextAuditAt?: Timestamp;
  auditNotes?: string;
  
  updatedAt: Timestamp;
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string;
  status: 'met' | 'not_met' | 'n/a';
  evidence?: string;
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
  category: 'general' | 'billing' | 'ai' | 'integrations' | 'security' | 'compliance';
  
  updatedBy: string;
  updatedAt: Timestamp;
}


