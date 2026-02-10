/**
 * Tier Enforcement Middleware
 * Runtime enforcement of pricing tier limits
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

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

const TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    maxContacts: 100,
    maxEmailsPerMonth: 500,
    maxSMSPerMonth: 0,
    maxAgents: 1,
    maxForms: 3,
    features: ['crm_basic', 'email_basic'],
  },
  starter: {
    maxContacts: 1000,
    maxEmailsPerMonth: 5000,
    maxSMSPerMonth: 500,
    maxAgents: 3,
    maxForms: 10,
    features: ['crm_basic', 'email_basic', 'forms', 'social_basic'],
  },
  professional: {
    maxContacts: 10000,
    maxEmailsPerMonth: 25000,
    maxSMSPerMonth: 2500,
    maxAgents: 10,
    maxForms: 50,
    features: ['crm_full', 'email_full', 'forms', 'social_full', 'voice', 'analytics'],
  },
  enterprise: {
    maxContacts: -1, // unlimited
    maxEmailsPerMonth: -1,
    maxSMSPerMonth: -1,
    maxAgents: -1,
    maxForms: -1,
    features: ['all'],
  },
};

/**
 * Get the current tier for a user
 */
export async function getUserTier(userId: string): Promise<string> {
  try {
    const subscription = await FirestoreService.get<SubscriptionRecord>(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/subscriptions`,
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
 * Get limits for a tier
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
 * Check if a user has access to a specific feature
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
