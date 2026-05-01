/**
 * KnowledgeBase type definitions — Universal Product Knowledge for AI Agents
 *
 * Stored at: organizations/{orgId}/platformCatalog/current (Firestore)
 * Populated by: scripts/seed-platform-catalog.ts
 * Read by: Alex, Jasper, and all customer-facing agents at runtime.
 *
 * Note: The type names (KnowledgeBase, KnowledgeBaseFeature, KnowledgeBaseIndustry)
 * describe the conceptual shape, not the Firestore storage path.
 *
 * Per docs/knowledgebase-contract.md — agents NEVER quote facts from training;
 * they reference this document for all pricing, features, and industry value props.
 */

export interface KnowledgeBaseFeature {
  /** Machine-readable identifier, e.g. 'crm', 'voice_ai', 'magic_studio' */
  id: string;
  /** User-facing label */
  name: string;
  /** Platform domain this feature belongs to */
  category: 'sales' | 'marketing' | 'content' | 'ops' | 'commerce' | 'analytics' | 'website';
  /** One-sentence value proposition */
  summary: string;
  /** 1-3 sentence elaboration */
  detail: string;
  /** 2-4 concrete use-case bullets */
  examples: string[];
}

export interface KnowledgeBaseIndustry {
  /** Machine-readable key, e.g. 'real_estate', 'home_services' */
  key: string;
  /** User-facing label */
  label: string;
  /** Feature ids ordered most-to-least relevant for this industry (3-6 items) */
  leadFeatures: string[];
  /** 3-5 industry-specific value statements Alex can weave into a sales conversation */
  talkingPoints: string[];
}

export interface KnowledgeBase {
  pricing: {
    model: 'flat';
    monthlyPrice: number;
    currency: 'USD';
    billingCycle: 'monthly';
    byok: {
      enabled: boolean;
      explanation: string;
    };
    trial: {
      days: number;
      fullAccess: boolean;
      creditCardRequired: boolean;
      cancelAnytime: boolean;
    };
    fairUseLimits: {
      crmRecords: number;
      socialPostsPerMonth: number;
      emailsPerDay: number;
      aiAgents: number;
    };
  };
  features: KnowledgeBaseFeature[];
  industries: KnowledgeBaseIndustry[];
  /** ISO 8601 timestamp of last seed run */
  lastUpdated: string;
}
