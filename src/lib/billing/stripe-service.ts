/**
 * Stripe Billing Service - Volume-Based Pricing
 * Success-linked pricing: Pay for what you store, not what you use
 */

import Stripe from 'stripe';
import type { SubscriptionTier} from '@/types/subscription';
import { VOLUME_TIERS, TIER_PRICING, ALL_INCLUSIVE_FEATURES } from '@/types/subscription';

// Use placeholder during build, validate at runtime
const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';

const stripe = new Stripe(stripeKey, {
  apiVersion: '2023-10-16',
});

// Helper to ensure Stripe is configured at runtime
function ensureStripeConfigured() {
  if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV !== 'test') {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
  }
}

/**
 * Volume-Based Tier Definition for Stripe
 */
export interface StripeTierPlan {
  id: SubscriptionTier;
  name: string;
  price: number; // in cents
  interval: 'month' | 'year';
  recordCapacity: {
    min: number;
    max: number;
  };
  features: readonly string[];
}

/**
 * NEW: Volume-Based Tiers (replaces old PLANS)
 */
export const STRIPE_TIERS: Record<SubscriptionTier, StripeTierPlan> = {
  tier1: {
    id: 'tier1',
    name: VOLUME_TIERS.tier1.name,
    price: TIER_PRICING.tier1.monthly * 100, // $400 in cents
    interval: 'month',
    recordCapacity: {
      min: VOLUME_TIERS.tier1.recordMin,
      max: VOLUME_TIERS.tier1.recordMax,
    },
    features: ALL_INCLUSIVE_FEATURES,
  },
  tier2: {
    id: 'tier2',
    name: VOLUME_TIERS.tier2.name,
    price: TIER_PRICING.tier2.monthly * 100, // $650 in cents
    interval: 'month',
    recordCapacity: {
      min: VOLUME_TIERS.tier2.recordMin,
      max: VOLUME_TIERS.tier2.recordMax,
    },
    features: ALL_INCLUSIVE_FEATURES,
  },
  tier3: {
    id: 'tier3',
    name: VOLUME_TIERS.tier3.name,
    price: TIER_PRICING.tier3.monthly * 100, // $1,000 in cents
    interval: 'month',
    recordCapacity: {
      min: VOLUME_TIERS.tier3.recordMin,
      max: VOLUME_TIERS.tier3.recordMax,
    },
    features: ALL_INCLUSIVE_FEATURES,
  },
  tier4: {
    id: 'tier4',
    name: VOLUME_TIERS.tier4.name,
    price: TIER_PRICING.tier4.monthly * 100, // $1,250 in cents
    interval: 'month',
    recordCapacity: {
      min: VOLUME_TIERS.tier4.recordMin,
      max: VOLUME_TIERS.tier4.recordMax,
    },
    features: ALL_INCLUSIVE_FEATURES,
  },
};

// DEPRECATED: Legacy interface kept only for type compatibility
// DO NOT USE - Use STRIPE_TIERS instead
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  limits: {
    records: number;
    aiConversations: number;
    emails: number;
    gmv: number;
  };
  features: string[];
}

/**
 * Create a Stripe customer
 */
export async function createCustomer(
  email: string,
  name?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  return stripe.customers.create({
    email,
    name,
    metadata,
  });
}

/**
 * Create a subscription (NEW: Volume-based with mandatory payment method)
 */
export async function createSubscription(
  customerId: string,
  tierId: SubscriptionTier,
  organizationId: string,
  trialDays: number = 14,
  paymentMethodId?: string // NEW: Required for trial (will auto-charge at trial end)
): Promise<Stripe.Subscription> {
  const tier = STRIPE_TIERS[tierId];
  if (!tier) {
    throw new Error(`Invalid tier ID: ${tierId}`);
  }

  // Get Stripe price ID from environment
  // Format: STRIPE_PRICE_ID_TIER1, STRIPE_PRICE_ID_TIER2, etc.
  const priceId = process.env[`STRIPE_PRICE_ID_${tierId.toUpperCase()}`];
  
  if (!priceId) {
    throw new Error(`Stripe price ID not configured for tier: ${tierId}. Add STRIPE_PRICE_ID_${tierId.toUpperCase()} to .env`);
  }

  // NEW: Build subscription params with payment method requirement
  const subscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: trialDays,
    metadata: {
      tierId,
      tier: tier.name,
      organizationId,
      recordCapacityMin: tier.recordCapacity.min.toString(),
      recordCapacityMax: tier.recordCapacity.max.toString(),
    },
  };

  // NEW: Attach payment method if provided (required for trial)
  if (paymentMethodId) {
    subscriptionParams.default_payment_method = paymentMethodId;
  }

  // NEW: Auto-charge at trial end (not "cancel_at_trial_end")
  // This ensures seamless conversion to paid
  subscriptionParams.cancel_at_period_end = false;

  return stripe.subscriptions.create(subscriptionParams);
}

// DEPRECATED functions removed - use createSubscriptionWithTier instead

/**
 * Update subscription tier (auto-scaling based on record count)
 */
export async function updateSubscriptionTier(
  subscriptionId: string,
  newTierId: SubscriptionTier,
  recordCount?: number
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const tier = STRIPE_TIERS[newTierId];
  
  if (!tier) {
    throw new Error(`Invalid tier ID: ${newTierId}`);
  }

  const priceId = process.env[`STRIPE_PRICE_ID_${newTierId.toUpperCase()}`];
  if (!priceId) {
    throw new Error(`Stripe price ID not configured for tier: ${newTierId}`);
  }

  return stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: subscription.items.data[0].id,
      price: priceId,
    }],
    proration_behavior: 'always_invoice', // Prorate when upgrading/downgrading
    metadata: {
      ...subscription.metadata,
      tierId: newTierId,
      tier: tier.name,
      recordCount: recordCount?.toString() || subscription.metadata?.recordCount,
      recordCapacityMin: tier.recordCapacity.min.toString(),
      recordCapacityMax: tier.recordCapacity.max.toString(),
      lastTierUpdate: new Date().toISOString(),
    },
  });
}

// DEPRECATED function removed - use updateSubscriptionTier instead

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<Stripe.Subscription> {
  if (immediately) {
    return stripe.subscriptions.cancel(subscriptionId);
  } else {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
}

/**
 * Get subscription
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Create billing portal session
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

/**
 * NEW: Check record capacity (replaces old usage limits)
 * In volume-based model, we only limit RECORDS, not feature usage
 */
export async function checkRecordCapacity(
  organizationId: string,
  currentRecordCount: number,
  additionalRecords: number = 0
): Promise<{ 
  allowed: boolean; 
  currentTier: SubscriptionTier;
  requiredTier: SubscriptionTier;
  capacity: number; 
  totalRecords: number;
  needsUpgrade: boolean;
  upgradePrice?: number;
}> {
  // Get organization's subscription
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, organizationId);
  
  if (!org?.subscriptionId) {
    return { 
      allowed: false, 
      currentTier: 'tier1',
      requiredTier: 'tier1',
      capacity: 0, 
      totalRecords: 0,
      needsUpgrade: false,
    };
  }

  const subscription = await getSubscription(org.subscriptionId);
  const currentTierId = (subscription.metadata?.tierId as SubscriptionTier) || 'tier1';
  const currentTier = STRIPE_TIERS[currentTierId];
  
  const totalRecords = currentRecordCount + additionalRecords;
  const withinCapacity = totalRecords <= currentTier.recordCapacity.max;
  
  // Determine required tier if exceeding current capacity
  let requiredTierId = currentTierId;
  if (!withinCapacity) {
    if (totalRecords <= STRIPE_TIERS.tier1.recordCapacity.max) {requiredTierId = 'tier1';}
    else if (totalRecords <= STRIPE_TIERS.tier2.recordCapacity.max) {requiredTierId = 'tier2';}
    else if (totalRecords <= STRIPE_TIERS.tier3.recordCapacity.max) {requiredTierId = 'tier3';}
    else {requiredTierId = 'tier4';}
  }
  
  const needsUpgrade = requiredTierId !== currentTierId;

  return {
    allowed: withinCapacity,
    currentTier: currentTierId,
    requiredTier: requiredTierId,
    capacity: currentTier.recordCapacity.max,
    totalRecords,
    needsUpgrade,
    upgradePrice: needsUpgrade ? STRIPE_TIERS[requiredTierId].price / 100 : undefined,
  };
}

/**
 * DEPRECATED: Legacy usage limits (kept for backward compatibility)
 * In new model, features are UNLIMITED - only records are capped
 */
export interface UsageMetrics {
  records: number;
  aiConversations: number;
  emails: number;
  gmv: number; // in cents
}

export async function checkUsageLimit(
  organizationId: string,
  metric: keyof UsageMetrics,
  currentUsage: number
): Promise<{ allowed: boolean; limit: number; remaining: number }> {
  // MIGRATION NOTE: In new pricing model, all features are unlimited
  // Only 'records' metric is enforced via checkRecordCapacity()
  if (metric === 'records') {
    const capacityCheck = await checkRecordCapacity(organizationId, currentUsage);
    return {
      allowed: capacityCheck.allowed,
      limit: capacityCheck.capacity,
      remaining: capacityCheck.capacity - capacityCheck.totalRecords,
    };
  }
  
  // All other metrics are unlimited in new model
  return { allowed: true, limit: -1, remaining: -1 };
}

/**
 * Record usage
 */
export async function recordUsage(
  organizationId: string,
  metric: keyof UsageMetrics,
  amount: number = 1
): Promise<void> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  
  // Get current usage
  const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, organizationId);
  const currentUsage = org?.usage?.[metric] || 0;
  
  // Update usage
  await FirestoreService.update(COLLECTIONS.ORGANIZATIONS, organizationId, {
    usage: {
      ...(org?.usage ?? {}),
      [metric]: currentUsage + amount,
      lastUpdated: new Date().toISOString(),
    },
  });
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhook(
  event: Stripe.Event
): Promise<void> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const orgId = subscription.metadata?.organizationId;
      
      if (orgId) {
        await FirestoreService.update(COLLECTIONS.ORGANIZATIONS, orgId, {
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          planId: subscription.metadata?.planId,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const deletedSubscription = event.data.object;
      const deletedOrgId = deletedSubscription.metadata?.organizationId;
      
      if (deletedOrgId) {
        await FirestoreService.update(COLLECTIONS.ORGANIZATIONS, deletedOrgId, {
          subscriptionStatus: 'canceled',
        });
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      const invoiceOrgId = invoice.metadata?.organizationId;
      
      if (invoiceOrgId) {
        // Update billing history
        // Implementation depends on your billing history structure
      }
      break;
    }

    case 'invoice.payment_failed': {
      const failedInvoice = event.data.object;
      const failedOrgId = failedInvoice.metadata?.organizationId;
      
      if (failedOrgId) {
        await FirestoreService.update(COLLECTIONS.ORGANIZATIONS, failedOrgId, {
          paymentFailed: true,
          paymentFailedAt: new Date().toISOString(),
        });
      }
      break;
    }
  }
}


