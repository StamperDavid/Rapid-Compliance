/**
 * Admin Command Center Type Definitions
 *
 * Comprehensive type system for the platform admin interface including:
 * - Navigation structures
 * - Permission management
 * - AI Specialist configuration
 * - Jasper Training Lab types
 * - Feature visibility controls
 */

// ============================================================================
// Navigation Types
// ============================================================================

/**
 * Top-level navigation category in the admin sidebar
 */
export interface NavCategory {
  /** Unique identifier for the category */
  id: string;
  /** Display label for the category */
  label: string;
  /** Icon identifier (e.g., Lucide icon name) */
  icon: string;
  /** Navigation items within this category */
  items: NavItem[];
  /** Whether the category should be expanded by default */
  defaultExpanded?: boolean;
}

/**
 * Individual navigation item within a category
 */
export interface NavItem {
  /** Unique identifier for the nav item */
  id: string;
  /** Display label for the nav item */
  label: string;
  /** Route path for navigation */
  href: string;
  /** Icon identifier (e.g., Lucide icon name) */
  icon: string;
  /** Optional tooltip text for additional context */
  tooltip?: string;
  /** Optional badge to display (count or text) */
  badge?: number | string;
  /** Permission required to view this nav item */
  requiredPermission?: AdminPermission;
}

// ============================================================================
// Admin Permission Types
// ============================================================================

/**
 * Available administrative permissions in the platform
 *
 * Permissions are hierarchical:
 * - 'view_*' permissions allow read-only access
 * - 'manage_*' permissions allow full CRUD operations
 * - 'platform_admin' grants all permissions
 */
export type AdminPermission =
  | 'view_organizations'
  | 'manage_organizations'
  | 'view_users'
  | 'manage_users'
  | 'view_billing'
  | 'manage_billing'
  | 'view_analytics'
  | 'manage_system'
  | 'manage_agents'
  | 'platform_admin';

// ============================================================================
// AI Specialist Categories and Configuration
// ============================================================================

/**
 * Categories of AI Specialists organized by functional domain
 */
export type SpecialistCategory =
  | 'intelligence'  // Strategic analysis and decision-making
  | 'marketing'     // Marketing automation and campaigns
  | 'builder'       // Development and technical tasks
  | 'commerce'      // E-commerce and transactions
  | 'outreach'      // Customer engagement and communication
  | 'content'       // Content creation and management
  | 'sales'         // Sales automation and enablement
  | 'trust';        // Security and compliance

/**
 * Development status of an AI Specialist
 *
 * Lifecycle progression:
 * GHOST -> UNBUILT -> SHELL -> FUNCTIONAL -> TESTED
 */
export type SpecialistStatus =
  | 'GHOST'       // Planned but not started
  | 'UNBUILT'     // Design phase
  | 'SHELL'       // Basic structure exists
  | 'FUNCTIONAL'  // Core features implemented
  | 'TESTED';     // Production-ready

/**
 * AI Specialist agent configuration
 */
export interface AISpecialist {
  /** Unique identifier for the specialist */
  id: string;
  /** Display name of the specialist */
  name: string;
  /** Functional category */
  category: SpecialistCategory;
  /** Current development status */
  status: SpecialistStatus;
  /** Human-readable description of capabilities */
  description: string;
  /** List of specific capabilities this specialist provides */
  capabilities: string[];
  /** ID of the managing admin/supervisor */
  managerId: string;
}

// ============================================================================
// Jasper Training Lab Types
// ============================================================================

/**
 * Tone options for Jasper's communication style
 */
export type JasperTone =
  | 'professional'   // Formal business communication
  | 'friendly'       // Approachable and warm
  | 'authoritative'  // Expert and confident
  | 'casual';        // Relaxed and conversational

/**
 * Jasper persona configuration defining behavior and communication style
 */
export interface JasperPersona {
  /** Display name for the persona */
  name: string;
  /** Job title/role for context */
  title: string;
  /** System prompt defining core behavior and knowledge */
  systemPrompt: string;
  /** Communication tone */
  tone: JasperTone;
  /** Areas of expertise */
  specializations: string[];
}

/**
 * Categories of training modules for sales scenarios
 */
export type TrainingCategory =
  | 'objection_handling'  // Handling customer objections
  | 'product_knowledge'   // Product features and benefits
  | 'pricing'             // Pricing strategies and discussions
  | 'demos'               // Product demonstrations
  | 'custom';             // Custom training content

/**
 * Training module containing knowledge and examples for Jasper
 */
export interface TrainingModule {
  /** Unique identifier for the module */
  id: string;
  /** Display name of the training module */
  name: string;
  /** Category of training content */
  category: TrainingCategory;
  /** Main training content/instructions */
  content: string;
  /** Example interactions for this module */
  examples: TrainingExample[];
  /** Whether this module is currently active */
  isActive: boolean;
}

/**
 * Example interaction for training purposes
 */
export interface TrainingExample {
  /** Customer input or scenario */
  input: string;
  /** Desired response or outcome */
  expectedOutput: string;
  /** Categorization tags for filtering */
  tags: string[];
}

// ============================================================================
// Command Center Context
// ============================================================================

/**
 * Complete context for the Admin Command Center session
 */
export interface CommandCenterContext {
  /** Current organization ID being administered */
  organizationId: string;
  /** Currently authenticated admin user */
  adminUser: AdminUser;
  /** List of active AI specialists in this org */
  activeSpecialists: AISpecialist[];
  /** Current Jasper configuration */
  jasperConfig: JasperPersona;
}

/**
 * Admin role levels defining access scope
 */
export type AdminRole =
  | 'platform_admin'  // Full platform access (formerly super_admin)
  | 'admin'           // Organization-level access
  | 'support'         // Read + limited write access
  | 'viewer';         // Read-only access

/**
 * Administrative user information
 */
export interface AdminUser {
  /** Unique user identifier */
  id: string;
  /** User email address */
  email: string;
  /** Display name */
  displayName: string;
  /** Administrative role */
  role: AdminRole;
  /** Specific granted permissions */
  permissions: AdminPermission[];
}

// ============================================================================
// Feature Visibility and Access Control
// ============================================================================

/**
 * Feature visibility flags for the admin interface
 *
 * Controls which sections of the admin panel are accessible
 * to the current user based on role and permissions
 */
export interface FeatureVisibility {
  /** Dashboard overview access */
  dashboard: boolean;
  /** Organization management access */
  organizations: boolean;
  /** User management access */
  users: boolean;
  /** Billing and subscription access */
  billing: boolean;
  /** Analytics and reporting access */
  analytics: boolean;
  /** Jasper sales agent configuration access */
  salesAgent: boolean;
  /** AI Swarm management access */
  swarm: boolean;
  /** Social media management access */
  social: boolean;
  /** System administration access */
  system: boolean;
  /** Jasper Training Lab access */
  jasperLab: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Generic response wrapper for async operations
 */
export interface CommandCenterResponse<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Response data (present on success) */
  data?: T;
  /** Error message (present on failure) */
  error?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Pagination parameters for list queries
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Optional total count of items */
  totalCount?: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  /** Array of items for current page */
  items: T[];
  /** Pagination metadata */
  pagination: PaginationParams;
  /** Total number of items across all pages */
  totalCount: number;
  /** Whether there are more pages */
  hasMore: boolean;
}

/**
 * Filter options for specialist queries
 */
export interface SpecialistFilter {
  /** Filter by category */
  category?: SpecialistCategory;
  /** Filter by status */
  status?: SpecialistStatus;
  /** Search by name (partial match) */
  searchQuery?: string;
  /** Filter by manager ID */
  managerId?: string;
}

/**
 * Audit log entry for admin actions
 */
export interface AdminAuditLog {
  /** Unique log entry ID */
  id: string;
  /** Timestamp of the action */
  timestamp: Date;
  /** Admin user who performed the action */
  adminUserId: string;
  /** Type of action performed */
  action: AdminAction;
  /** Resource type affected */
  resourceType: ResourceType;
  /** Resource ID affected */
  resourceId: string;
  /** Additional context/metadata */
  metadata?: Record<string, unknown>;
  /** IP address of the admin */
  ipAddress?: string;
}

/**
 * Types of admin actions that can be logged
 */
export type AdminAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'export'
  | 'import'
  | 'login'
  | 'logout';

/**
 * Types of resources that can be managed
 */
export type ResourceType =
  | 'organization'
  | 'user'
  | 'specialist'
  | 'training_module'
  | 'jasper_config'
  | 'system_setting'
  | 'billing';
