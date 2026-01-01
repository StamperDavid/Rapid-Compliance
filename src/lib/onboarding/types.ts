/**
 * Onboarding Module Types
 * 
 * Type definitions for the Onboarding Prefill Engine and related components.
 */

/**
 * Onboarding Form Data Structure
 * 
 * Matches the formData state in the onboarding wizard page.
 */
export interface OnboardingFormData {
  // Step 1: Business Basics
  businessName: string;
  industry: string;
  website: string;
  faqPageUrl: string;
  socialMediaUrls: string[];
  companySize: string;
  businessLocation?: string;
  contactEmail?: string;
  contactPhone?: string;
  
  // Step 2: Business Understanding
  problemSolved: string;
  uniqueValue: string;
  whyBuy: string;
  whyNotBuy: string;
  
  // Step 3: Products/Services Overview
  primaryOffering: string;
  priceRange: string;
  targetCustomer: string;
  customerDemographics: string;
  
  // Step 4: Product/Service Details
  topProducts: string;
  productComparison: string;
  seasonalOfferings: string;
  whoShouldNotBuy: string;
  
  // Step 5: Pricing & Sales Strategy
  pricingStructure: string;
  discountsPromotions: string;
  competitivePricing: string;
  valueJustification: string;
  
  // Step 6: Objections & Concerns
  commonObjections: string;
  customerHesitations: string;
  objectionResponses: string;
  
  // Step 7: Sales Process
  customerJourney: string;
  decisionCriteria: string;
  salesCycleDuration: string;
  keyStakeholders: string;
  
  // Step 8: Additional Context
  brandPersonality: string;
  communicationStyle: string;
  complianceRequirements: string;
  technicalCapabilities?: string;
}

/**
 * Field Confidence Information
 * 
 * Describes the confidence level and suggested action for a prefilled field.
 */
export interface FieldConfidence {
  /** Name of the form field */
  fieldName: string;
  
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
  
  /** Prefilled value */
  value: string | string[];
  
  /** Source of the data */
  source: 'discovery-engine' | 'user-input' | 'inference';
  
  /** Suggested action based on confidence */
  suggestedAction: 'auto-fill' | 'confirm' | 'hint';
  
  /** Optional explanation of how we got this value */
  reasoning?: string;
}

/**
 * Prefill Result
 * 
 * The complete result returned by the Prefill Engine.
 */
export interface PrefillResult {
  /** Partially filled form data */
  formData: Partial<OnboardingFormData>;
  
  /** Confidence information for each field */
  fieldConfidences: Record<string, FieldConfidence>;
  
  /** Overall confidence score (weighted average) */
  overallConfidence: number;
  
  /** Discovery metadata */
  discoveryMetadata: {
    scrapedAt: Date;
    fromCache: boolean;
    scrapeId: string;
  };
}

/**
 * Prefill UI State
 * 
 * State management for the prefill UI component.
 */
export interface PrefillUIState {
  /** Is prefill currently in progress? */
  isPrefilling: boolean;
  
  /** Did prefill complete successfully? */
  prefillComplete: boolean;
  
  /** Prefill error (if any) */
  prefillError: string | null;
  
  /** Current prefill result */
  prefillResult: PrefillResult | null;
  
  /** Fields user has confirmed */
  confirmedFields: Set<string>;
  
  /** Fields user has rejected/edited */
  rejectedFields: Set<string>;
}

/**
 * Confidence Badge Props
 * 
 * Props for rendering a confidence indicator badge.
 */
export interface ConfidenceBadgeProps {
  confidence: number;
  suggestedAction: 'auto-fill' | 'confirm' | 'hint';
  showLabel?: boolean;
}
