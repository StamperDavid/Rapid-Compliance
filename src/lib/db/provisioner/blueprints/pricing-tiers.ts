/**
 * Pricing Tiers Blueprint
 *
 * Platform pricing configuration for Free, Pro, and Enterprise tiers.
 * These are the default pricing structures provisioned to Firestore.
 */

import type { PricingTierBlueprint } from '../types';

/**
 * Blueprint version - increment when making changes
 */
export const PRICING_TIERS_VERSION = 1;

/**
 * All pricing tier blueprints
 */
export const PRICING_TIER_BLUEPRINTS: Record<string, PricingTierBlueprint> = {
  free: {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    limits: {
      maxWorkspaces: 1,
      maxUsersPerWorkspace: 2,
      maxAICallsPerMonth: 100,
      maxStorageGB: 1,
      maxLeads: 100,
      maxContacts: 250,
    },
    features: [
      'Basic CRM features',
      'AI chat assistant (limited)',
      '1 project',
      'Email support',
      'Basic analytics',
    ],
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 49,
    yearlyPrice: 490,
    isPopular: true,
    limits: {
      maxWorkspaces: 5,
      maxUsersPerWorkspace: 10,
      maxAICallsPerMonth: 5000,
      maxStorageGB: 25,
      maxLeads: 5000,
      maxContacts: 10000,
    },
    features: [
      'Everything in Free',
      'Unlimited AI chat',
      'Workflow automation',
      'E-commerce integration',
      'Social media management',
      'Lead Hunter',
      'Custom branding',
      'Priority support',
      'Advanced analytics',
    ],
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 199,
    yearlyPrice: 1990,
    limits: {
      maxWorkspaces: -1, // unlimited
      maxUsersPerWorkspace: -1, // unlimited
      maxAICallsPerMonth: -1, // unlimited
      maxStorageGB: 100,
      maxLeads: -1, // unlimited
      maxContacts: -1, // unlimited
    },
    features: [
      'Everything in Pro',
      'Unlimited projects',
      'Unlimited team members',
      'Fine-tuning capabilities',
      'Dedicated account manager',
      'SLA guarantees',
      'Custom integrations',
      'White-label options',
      'Advanced security',
      'API access',
    ],
  },
};

/**
 * Get all pricing tier blueprints
 */
export function getPricingTierBlueprints(): Record<string, PricingTierBlueprint> {
  return { ...PRICING_TIER_BLUEPRINTS };
}

/**
 * Get a specific pricing tier blueprint
 */
export function getPricingTierBlueprint(tierId: string): PricingTierBlueprint | null {
  return PRICING_TIER_BLUEPRINTS[tierId] ?? null;
}

/**
 * Get all tier IDs
 */
export function getPricingTierIds(): string[] {
  return Object.keys(PRICING_TIER_BLUEPRINTS);
}
