/**
 * Database Provisioner Types
 *
 * Defines the blueprint system for automatic database provisioning.
 * This enables the "self-healing" database layer that provisions
 * missing architectural components automatically.
 */

import type {
  PersonaTraits,
  CommunicationStyle,
  StatusUpdateTemplate,
  SpecialistTrigger,
} from '@/lib/ai/persona-mapper';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Categories of data that can be provisioned
 */
export type ProvisionTarget =
  | 'SYSTEM_CONFIG'
  | 'ADMIN_PERSONA'
  | 'INDUSTRY_PERSONAS'
  | 'PRICING_TIERS'
  | 'ESCALATION_RULES';

/**
 * Result of a single provisioning operation
 */
export interface ProvisionResult {
  target: ProvisionTarget;
  action: 'created' | 'skipped' | 'error';
  documentId?: string;
  error?: string;
  timestamp: string;
}

/**
 * Complete report of a provisioning run
 */
export interface ProvisionReport {
  environment: string;
  projectId: string;
  prefix: string;
  startedAt: string;
  completedAt: string;
  results: ProvisionResult[];
  summary: {
    created: number;
    skipped: number;
    errors: number;
  };
}

// ============================================================================
// BLUEPRINT TYPES
// ============================================================================

/**
 * System-wide platform configuration
 */
export interface SystemConfigBlueprint {
  id: string;
  version: number;
  settings: {
    maintenanceMode: boolean;
    defaultTimezone: string;
    defaultCurrency: string;
    maxOrganizations: number;
    featureFlags: {
      enableAIChat: boolean;
      enableWorkflows: boolean;
      enableEcommerce: boolean;
      enableSocialMedia: boolean;
      enableLeadHunter: boolean;
      enableFineTuning: boolean;
      enableWebsiteBuilder: boolean;
      enableAnalytics: boolean;
    };
  };
}

/**
 * Admin persona (Jasper) configuration stored in Firestore
 */
export interface AdminPersonaBlueprint {
  id: string;
  name: string;
  industry: 'admin';
  industryDisplayName: string;
  partnerTitle: string;
  traits: PersonaTraits;
  communicationStyle: CommunicationStyle;
  greetingVariants: string[];
  statusUpdates: StatusUpdateTemplate[];
  specialistTriggers: SpecialistTrigger[];
  version: number;
}

/**
 * Industry persona configuration stored in Firestore
 */
export interface IndustryPersonaBlueprint {
  id: string;
  industry: string;
  industryDisplayName: string;
  partnerTitle: string;
  traits: PersonaTraits;
  communicationStyle: CommunicationStyle;
  greetingVariants: string[];
  statusUpdates: StatusUpdateTemplate[];
  specialistTriggers: SpecialistTrigger[];
  version: number;
}

/**
 * Pricing tier configuration
 */
export interface PricingTierBlueprint {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  isPopular?: boolean;
  limits: {
    maxWorkspaces: number;
    maxUsersPerWorkspace: number;
    maxAICallsPerMonth: number;
    maxStorageGB: number;
    maxLeads: number;
    maxContacts: number;
  };
  features: string[];
}

/**
 * Default escalation rules configuration
 */
export interface EscalationRulesBlueprint {
  id: string;
  version: number;
  rules: Array<{
    trigger: string;
    condition: string;
    action: 'escalate_to_human' | 'notify_admin' | 'log_warning';
    priority: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

// ============================================================================
// COLLECTION PATHS
// ============================================================================

/**
 * Collection paths used by the provisioner
 * These are relative - prefix is applied by the provisioner
 */
export const PROVISIONER_COLLECTIONS = {
  SYSTEM: 'system',
  SYSTEM_CONFIG: 'system/config',
  PERSONAS: 'system/personas',
  ADMIN_PERSONA: 'system/personas/admin',
  INDUSTRY_PERSONAS: 'system/personas/industries',
  ESCALATION_RULES: 'system/escalation',
} as const;
