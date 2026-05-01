/**
 * Tier Enforcement Middleware
 *
 * SalesVelocity.ai is flat-rate ($299/month, all features).
 * Fair-use limits are defined in PRICING.fairUseLimits.
 * Every active subscriber gets identical limits — no tier gates.
 *
 * The getUserTier / getTierLimits / checkTierLimit API surface is
 * preserved so callers do not need to change. All active-subscriber
 * tiers map to the same 'pro' limits.
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { PRICING } from '@/lib/config/pricing';

interface TierLimits {
  maxContacts: number;
  maxEmailsPerMonth: number;
  maxSMSPerMonth: number;
  maxAgents: number;
  maxForms: number;
  features: string[];
}

interface SubscriptionRecord {
  tier: string;
  status: string;
}

/**
 * Fair-use limits for all active subscribers (flat-rate plan).
 * Derived from PRICING.fairUseLimits so a single config edit propagates here.
 */
const PRO_LIMITS: TierLimits = {
  maxContacts: PRICING.fairUseLimits.crmRecords,
  maxEmailsPerMonth: PRICING.fairUseLimits.emailsPerDay * 30,
  maxSMSPerMonth: 10000,
  maxAgents: PRICING.fairUseLimits.aiAgents,
  maxForms: -1, // unlimited
  features: ['all'],
};

const TIER_LIMITS: Record<string, TierLimits> = {
  // All paid tiers resolve to pro (flat-rate — no feature gating)
  pro: PRO_LIMITS,
  // Legacy tier keys kept for backward compat with existing Firestore records
  starter: PRO_LIMITS,
  professional: PRO_LIMITS,
  enterprise: PRO_LIMITS,
  // Unactivated/cancelled — minimal access until subscribed
  free: {
    maxContacts: 100,
    maxEmailsPerMonth: 500,
    maxSMSPerMonth: 0,
    maxAgents: 1,
    maxForms: 3,
    features: ['crm_basic', 'email_basic'],
  },
};

/**
 * Get the current tier for a user
 */
export async function getUserTier(userId: string): Promise<string> {
  try {
    const subscription = await FirestoreService.get<SubscriptionRecord>(
      getSubCollection('subscriptions'),
      userId
    );
    if (subscription?.status === 'active') {
      return subscription.tier;
    }
    return 'free';
  } catch {
    return 'free';
  }
}

/**
 * Get limits for a tier. All active-subscriber tiers return PRO_LIMITS.
 */
export function getTierLimits(tier: string): TierLimits {
  return TIER_LIMITS[tier] ?? TIER_LIMITS.free;
}

/**
 * Check if a user has hit a resource limit
 */
export async function checkTierLimit(
  userId: string,
  resource: keyof Omit<TierLimits, 'features'>,
  currentUsage: number
): Promise<{ allowed: boolean; limit: number; current: number; tier: string }> {
  const tier = await getUserTier(userId);
  const limits = getTierLimits(tier);
  const limit = limits[resource];

  if (limit === -1) {
    return { allowed: true, limit: -1, current: currentUsage, tier };
  }

  return {
    allowed: currentUsage < limit,
    limit,
    current: currentUsage,
    tier,
  };
}

/**
 * Check if a user has access to a specific feature.
 * All active subscribers have access to all features.
 */
export async function checkFeatureAccess(
  userId: string,
  feature: string
): Promise<{ allowed: boolean; tier: string }> {
  const tier = await getUserTier(userId);
  const limits = getTierLimits(tier);

  if (limits.features.includes('all') || limits.features.includes(feature)) {
    return { allowed: true, tier };
  }

  return { allowed: false, tier };
}
