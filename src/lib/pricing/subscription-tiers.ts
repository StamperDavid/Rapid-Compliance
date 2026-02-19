/**
 * Subscription Tier Pricing — Single Source of Truth
 *
 * Centralized pricing constants used by:
 * - /settings/subscription (plan comparison page)
 * - /settings/billing (billing details page)
 * - /api/subscriptions/checkout (Stripe Checkout session creation)
 *
 * To migrate to Firestore: Replace these constants with reads from
 * the platform_pricing collection using PlatformPricingPlan type.
 */

export type SubscriptionTierKey = 'free' | 'starter' | 'professional' | 'enterprise';

export interface SubscriptionTier {
  key: SubscriptionTierKey;
  label: string;
  monthlyPrice: number;
  annualPrice: number;
  monthlyPriceCents: number;
  annualPriceCents: number;
  color: string;
  icon: string;
  highlight: boolean;
  features: string[];
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    key: 'free',
    label: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    icon: '🆓',
    color: '#374151',
    highlight: false,
    features: [
      '100 contacts',
      '500 emails/month',
      '50 AI credits/month',
      'Basic CRM features',
      'Email support',
    ],
  },
  {
    key: 'starter',
    label: 'Starter',
    monthlyPrice: 29,
    annualPrice: 290,
    monthlyPriceCents: 2900,
    annualPriceCents: 29000,
    icon: '🚀',
    color: '#2563eb',
    highlight: false,
    features: [
      '1,000 contacts',
      '5,000 emails/month',
      '500 AI credits/month',
      'Lead scoring & routing',
      'A/B testing',
      'Email templates',
      'Priority support',
    ],
  },
  {
    key: 'professional',
    label: 'Professional',
    monthlyPrice: 79,
    annualPrice: 790,
    monthlyPriceCents: 7900,
    annualPriceCents: 79000,
    icon: '⭐',
    color: '#059669',
    highlight: true,
    features: [
      '10,000 contacts',
      'Unlimited emails',
      '5,000 AI credits/month',
      'Everything in Starter',
      'Workflows & automation',
      'Advanced analytics',
      'Webhooks & integrations',
      'Custom branding',
      'Phone support',
    ],
  },
  {
    key: 'enterprise',
    label: 'Enterprise',
    monthlyPrice: 199,
    annualPrice: 1990,
    monthlyPriceCents: 19900,
    annualPriceCents: 199000,
    icon: '👑',
    color: '#d97706',
    highlight: false,
    features: [
      'Unlimited contacts',
      'Unlimited emails',
      'Unlimited AI credits',
      'Everything in Professional',
      'AI agent swarm',
      'Voice AI (inbound/outbound)',
      'Video generation',
      'Dedicated account manager',
      'SLA guarantee',
    ],
  },
];

export const TIER_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
};

/**
 * Get tier config by key
 */
export function getTier(key: string): SubscriptionTier | undefined {
  return SUBSCRIPTION_TIERS.find(t => t.key === key);
}

/**
 * Get tier config with defaults
 */
export function getTierConfig(key: string): { label: string; color: string; badge: string; monthlyPrice: number; annualPrice: number } {
  const tier = getTier(key);
  if (!tier) {
    return { label: 'Free', color: 'var(--color-text-secondary)', badge: '#374151', monthlyPrice: 0, annualPrice: 0 };
  }
  return {
    label: tier.label,
    color: `var(--color-${key === 'starter' ? 'info' : key === 'professional' ? 'success' : key === 'enterprise' ? 'warning' : 'text-secondary'})`,
    badge: tier.color,
    monthlyPrice: tier.monthlyPrice,
    annualPrice: tier.annualPrice,
  };
}
