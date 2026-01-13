import type { Timestamp } from 'firebase/firestore';

/**
 * Organization (Top-level tenant)
 * Each customer/company gets one organization
 */
export interface Organization {
  id: string;
  name: string;
  slug: string; // URL-friendly identifier
  
  // Plan & Billing
  plan: 'free' | 'pro' | 'enterprise';
  planLimits: PlanLimits;
  billingEmail: string;
  
  // Branding
  branding: {
    logo?: string; // Cloud Storage URL
    favicon?: string;
    customDomain?: string;
  };

  // Brand DNA (inherited by all AI tools)
  brandDNA?: BrandDNA;
  
  // Settings
  settings: {
    defaultTimezone: string;
    defaultCurrency: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
  };
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // userId
  
  // Status
  status: 'active' | 'suspended' | 'trial';
  trialEndsAt?: Timestamp;
  
  // Testing flag (to prevent test data pollution)
  isTest?: boolean;
}

export interface PlanLimits {
  maxWorkspaces: number;
  maxUsersPerWorkspace: number;
  maxRecordsPerWorkspace: number;
  maxAICallsPerMonth: number;
  maxStorageGB: number;
  maxSchemas: number;
  maxWorkflows: number;
  allowCustomDomain: boolean;
  allowWhiteLabel: boolean;
  allowAPIAccess: boolean;
}

/**
 * Workspace (Sub-tenant within an organization)
 * Different business units, departments, or use cases
 */
export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  
  // Industry/Use Case
  industry: IndustryType;
  useCase: string; // e.g., "Sales CRM", "Service Management", "E-commerce"
  
  // Theme
  themeId: string; // references Theme
  
  // Settings
  settings: {
    allowGuestAccess: boolean;
    enableAI: boolean;
    enableWorkflows: boolean;
    dataRetentionDays: number;
  };
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  
  // Status
  status: 'active' | 'archived';
}

export type IndustryType =
  | 'sales'
  | 'ecommerce'
  | 'service'
  | 'education'
  | 'real_estate'
  | 'transportation'
  | 'manufacturing'
  | 'hospitality'
  | 'finance'
  | 'legal'
  | 'nonprofit'
  | 'custom';

/**
 * Organization Member
 * Users who have access to an organization
 */
export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  
  // Role at org level
  role: OrganizationRole;
  
  // Workspace access
  workspaceAccess: WorkspaceAccess[];
  
  // Metadata
  joinedAt: Timestamp;
  invitedBy: string;
  lastActiveAt: Timestamp;
  
  // Status
  status: 'active' | 'invited' | 'suspended';
}

export type OrganizationRole = 'owner' | 'admin' | 'member';

export interface WorkspaceAccess {
  workspaceId: string;
  role: WorkspaceRole;
  permissions: Permission[];
}

export type WorkspaceRole = 'admin' | 'editor' | 'viewer' | 'custom';

export type Permission =
  // Schema permissions
  | 'schemas:read'
  | 'schemas:write'
  | 'schemas:delete'
  // Entity permissions
  | 'entities:read'
  | 'entities:create'
  | 'entities:update'
  | 'entities:delete'
  // View permissions
  | 'views:read'
  | 'views:write'
  | 'views:delete'
  // AI permissions
  | 'ai:chat'
  | 'ai:train'
  | 'ai:deploy'
  // Workflow permissions
  | 'workflows:read'
  | 'workflows:write'
  | 'workflows:execute'
  // Settings permissions
  | 'settings:read'
  | 'settings:write'
  // Admin permissions
  | 'members:invite'
  | 'members:manage'
  | 'billing:manage';

/**
 * Audit Log
 * Track all actions for compliance and debugging
 */
export interface AuditLog {
  id: string;
  organizationId: string;
  workspaceId?: string;
  
  // Action details
  action: string; // e.g., "entity.created", "schema.updated"
  resourceType: string; // e.g., "entity", "schema"
  resourceId: string;
  
  // User
  userId: string;
  userEmail: string;
  
  // Changes
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  
  // Metadata
  timestamp: Timestamp;
  ipAddress?: string;
  userAgent?: string;
  
  // Context
  metadata?: Record<string, unknown>;
}

/**
 * Usage Tracking
 * Monitor usage against plan limits
 */
export interface UsageMetrics {
  organizationId: string;
  period: string; // e.g., "2024-03"
  
  metrics: {
    workspaces: number;
    users: number;
    totalRecords: number;
    aiCallsCount: number;
    storageUsedGB: number;
    apiCallsCount: number;
  };
  
  // Breakdown by workspace
  workspaceBreakdown: {
    workspaceId: string;
    records: number;
    aiCalls: number;
    apiCalls: number;
  }[];
  
  updatedAt: Timestamp;
}

/**
 * Brand DNA - Global brand identity inherited by all AI tools
 */
export interface BrandDNA {
  // Core Identity
  companyDescription: string;
  uniqueValue: string; // What makes this brand unique
  targetAudience: string;

  // Voice & Tone
  toneOfVoice: 'warm' | 'professional' | 'direct' | 'friendly' | 'formal' | 'casual';
  communicationStyle: string; // e.g., "Consultative and empathetic"

  // Brand Guidelines
  brandGuidelines?: string; // URL or text
  logoUrl?: string;
  primaryColor?: string;

  // Keywords & Phrases
  keyPhrases: string[]; // Phrases to always use
  avoidPhrases: string[]; // Phrases to never use

  // Industry Context
  industry: string;
  competitors: string[];

  updatedAt?: Timestamp;
  updatedBy?: string;
}

/**
 * Tool-specific Training Context
 * Inherits from BrandDNA but can be overridden per tool
 */
export interface ToolTrainingContext {
  toolType: 'voice' | 'social' | 'seo';
  orgId: string;

  // Inheritance
  inheritFromBrandDNA: boolean;
  overrides?: Partial<BrandDNA>;

  // Custom instructions for this tool
  customInstructions: string;

  // Tool-specific settings (type varies by tool)
  toolSettings: VoiceTrainingSettings | SocialTrainingSettings | SEOTrainingSettings;

  // Knowledge base specific to this tool
  knowledgeBase: ToolKnowledgeItem[];

  updatedAt?: Timestamp;
  updatedBy?: string;
}

/**
 * Voice AI Training Settings
 */
export interface VoiceTrainingSettings {
  greetingScript: string;
  toneOfVoice: 'warm' | 'direct' | 'professional';
  callHandoffInstructions: string;
  objectionResponses: Record<string, string>;
  qualificationCriteria: string[];
  closingTechniques: string[];
}

/**
 * Social Media AI Training Settings
 */
export interface SocialTrainingSettings {
  emojiUsage: 'none' | 'light' | 'heavy';
  ctaStyle: 'soft' | 'direct' | 'question';
  contentThemes: string[];
  hashtagStrategy: string;
  postingPersonality: string;
  platformPreferences: {
    twitter?: { maxLength: number; style: string };
    linkedin?: { format: string; tone: string };
    instagram?: { captionStyle: string; hashtagCount: number };
  };
}

/**
 * SEO Content Training Settings
 */
export interface SEOTrainingSettings {
  targetSearchIntent: 'informational' | 'transactional' | 'navigational' | 'commercial';
  writingStyle: 'scientific' | 'conversational' | 'journalistic' | 'technical';
  targetKeywords: string[];
  contentLength: 'short' | 'medium' | 'long' | 'comprehensive';
  structurePreferences: {
    useHeaders: boolean;
    useLists: boolean;
    useFAQ: boolean;
    useImages: boolean;
  };
  audienceExpertiseLevel: 'beginner' | 'intermediate' | 'expert';
}

/**
 * Knowledge item specific to a tool
 */
export interface ToolKnowledgeItem {
  id: string;
  title: string;
  content: string;
  type: 'document' | 'example' | 'template' | 'script';
  uploadedAt: Timestamp;
  uploadedBy: string;
}


