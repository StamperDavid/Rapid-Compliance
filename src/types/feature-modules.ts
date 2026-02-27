/**
 * Feature Module Types
 *
 * Defines the feature toggle system for SalesVelocity.ai.
 * Each feature module controls sidebar visibility and maps to required API keys.
 */

/**
 * All available feature module IDs
 */
export type FeatureModuleId =
  | 'crm_pipeline'
  | 'sales_automation'
  | 'email_outreach'
  | 'social_media'
  | 'ecommerce'
  | 'website_builder'
  | 'video_production'
  | 'forms_surveys'
  | 'proposals_docs'
  | 'advanced_analytics'
  | 'workflows'
  | 'conversations';

/**
 * Feature configuration stored in Firestore
 */
export interface FeatureConfig {
  modules: Record<FeatureModuleId, boolean>;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Business profile answers from the consultative onboarding questions
 */
export interface BusinessProfile {
  businessModel: string;
  teamSize: string;
  primaryGoal: string;
  sellsOnline: boolean;
  usesEmail: boolean;
  usesSocialMedia: boolean;
  usesVideo: boolean;
  needsForms: boolean;
  completedAt?: string;
}

/**
 * Combined onboarding data
 */
export interface OnboardingData {
  businessProfile: BusinessProfile | null;
  featureConfig: FeatureConfig;
  completedAt: string | null;
  completedBy: string | null;
}

/**
 * API key requirement for a feature module
 */
export interface RequiredApiKey {
  serviceId: string;
  label: string;
  description: string;
  setupUrl: string;
  docsUrl: string;
  priority: 'required' | 'recommended' | 'optional';
}

/**
 * Feature module definition (static metadata)
 */
export interface FeatureModuleDefinition {
  id: FeatureModuleId;
  label: string;
  icon: string;
  defaultEnabled: boolean;
  description: string;
  whyItMatters: string;
  features: string[];
  useCases: string[];
  ifYouSkip: string;
  sidebarItemIds: string[];
  requiredApiKeys: RequiredApiKey[];
}
