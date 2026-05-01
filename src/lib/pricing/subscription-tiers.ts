/**
 * Subscription Tier Config — Single-tier flat pricing model
 *
 * SalesVelocity.ai is $299/month flat — one tier, all features.
 * The tier enum and SubscriptionTier shape are preserved so the Stripe checkout
 * pipeline (subscription-provider-service.ts, /api/subscriptions/checkout) can
 * continue to read tier.monthlyPriceCents and tier.label without refactoring.
 *
 * Price values are derived from PRICING in @/lib/config/pricing so a single
 * edit to pricing.ts propagates here automatically.
 *
 * Multi-tier pricing (free/starter/professional/enterprise) was retired.
 * See docs/knowledgebase-contract.md for the canonical pricing shape.
 */

import { PRICING } from '@/lib/config/pricing';

export type SubscriptionTierKey = 'pro';

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

const MONTHLY_PRICE = PRICING.monthlyPrice;
// Annual: 2 months free (10 months billed)
const ANNUAL_PRICE = MONTHLY_PRICE * 10;

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    key: 'pro',
    label: 'SalesVelocity Pro',
    monthlyPrice: MONTHLY_PRICE,
    annualPrice: ANNUAL_PRICE,
    monthlyPriceCents: MONTHLY_PRICE * 100,
    annualPriceCents: ANNUAL_PRICE * 100,
    icon: '🚀',
    color: '#6366f1',
    highlight: true,
    features: [
      `Up to ${PRICING.fairUseLimits.crmRecords.toLocaleString()} CRM records`,
      `${PRICING.fairUseLimits.socialPostsPerMonth.toLocaleString()} social posts/month`,
      `${PRICING.fairUseLimits.emailsPerDay.toLocaleString()} emails/day`,
      `${PRICING.fairUseLimits.aiAgents} AI agents`,
      'Full AI swarm (40+ specialists)',
      'Voice AI inbound + outbound',
      'Content Factory + Video Studio',
      'Website builder + SEO suite',
      'E-commerce + Stripe payments',
      'Workflow automation',
      'White-label branding',
      'BYOK — zero AI markup',
      '14-day free trial, cancel anytime',
    ],
  },
];

export const TIER_RANK: Record<string, number> = {
  pro: 1,
};

/**
 * Get tier config by key
 */
export function getTier(key: string): SubscriptionTier | undefined {
  return SUBSCRIPTION_TIERS.find(t => t.key === key);
}

/**
 * Get tier config with defaults — always returns pro values since we are flat-rate.
 */
export function getTierConfig(key: string): { label: string; color: string; badge: string; monthlyPrice: number; annualPrice: number } {
  const tier = getTier(key) ?? SUBSCRIPTION_TIERS[0];
  return {
    label: tier.label,
    color: 'var(--color-primary)',
    badge: tier.color,
    monthlyPrice: tier.monthlyPrice,
    annualPrice: tier.annualPrice,
  };
}
