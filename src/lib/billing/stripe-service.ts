/**
 * Stripe Billing Service
 * Handles subscription management, payments, and usage tracking
 */

import Stripe from 'stripe';

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

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // in cents
  interval: 'month' | 'year';
  limits: {
    records: number;
    aiConversations: number;
    emails: number;
    gmv: number; // in cents
  };
  features: string[];
}

export const PLANS: Record<string, SubscriptionPlan> = {
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 9900, // $99/month
    interval: 'month',
    limits: {
      records: 50000,
      aiConversations: 1000,
      emails: 10000,
      gmv: 1000000, // $10,000
    },
    features: [
      'Standard branding',
      'Standard support',
      'Email support',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 49900, // $499/month
    interval: 'month',
    limits: {
      records: -1, // unlimited
      aiConversations: -1, // unlimited
      emails: -1, // unlimited
      gmv: -1, // unlimited
    },
    features: [
      'Full white-labeling',
      'Dedicated account manager',
      'Phone + priority support',
      'Custom domain included',
    ],
  },
};

/**
 * Create a Stripe customer
 */
export async function createCustomer(
  email: string,
  name?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  return await stripe.customers.create({
    email,
    name,
    metadata,
  });
}

/**
 * Create a subscription
 */
export async function createSubscription(
  customerId: string,
  planId: string,
  organizationId: string,
  trialDays: number = 14
): Promise<Stripe.Subscription> {
  const plan = PLANS[planId];
  if (!plan) {
    throw new Error(`Invalid plan ID: ${planId}`);
  }

  // Create Stripe price if it doesn't exist
  // In production, create prices in Stripe Dashboard and reference them
  const priceId = process.env[`STRIPE_PRICE_ID_${planId.toUpperCase()}`];
  
  if (!priceId) {
    throw new Error(`Stripe price ID not configured for plan: ${planId}`);
  }

  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: trialDays,
    metadata: {
      planId,
      organizationId,
    },
  });
}

/**
 * Update subscription (upgrade/downgrade)
 */
export async function updateSubscription(
  subscriptionId: string,
  newPlanId: string
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const plan = PLANS[newPlanId];
  
  if (!plan) {
    throw new Error(`Invalid plan ID: ${newPlanId}`);
  }

  const priceId = process.env[`STRIPE_PRICE_ID_${newPlanId.toUpperCase()}`];
  if (!priceId) {
    throw new Error(`Stripe price ID not configured for plan: ${newPlanId}`);
  }

  return await stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: subscription.items.data[0].id,
      price: priceId,
    }],
    proration_behavior: 'always_invoice',
    metadata: {
      ...subscription.metadata,
      planId: newPlanId,
    },
  });
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<Stripe.Subscription> {
  if (immediately) {
    return await stripe.subscriptions.cancel(subscriptionId);
  } else {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
}

/**
 * Get subscription
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Create billing portal session
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

/**
 * Track usage against plan limits
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
  // Get organization's subscription
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, organizationId);
  
  if (!org?.subscriptionId) {
    return { allowed: false, limit: 0, remaining: 0 };
  }

  const subscription = await getSubscription(org.subscriptionId);
  const planId = subscription.metadata?.planId || 'pro';
  const plan = PLANS[planId];
  
  const limit = plan.limits[metric];
  
  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, limit: -1, remaining: -1 };
  }

  const remaining = limit - currentUsage;
  return {
    allowed: remaining > 0,
    limit,
    remaining: Math.max(0, remaining),
  };
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
      ...(org?.usage || {}),
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
    case 'customer.subscription.updated':
      const subscription = event.data.object as Stripe.Subscription;
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

    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object as Stripe.Subscription;
      const deletedOrgId = deletedSubscription.metadata?.organizationId;
      
      if (deletedOrgId) {
        await FirestoreService.update(COLLECTIONS.ORGANIZATIONS, deletedOrgId, {
          subscriptionStatus: 'canceled',
        });
      }
      break;

    case 'invoice.payment_succeeded':
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceOrgId = invoice.metadata?.organizationId;
      
      if (invoiceOrgId) {
        // Update billing history
        // Implementation depends on your billing history structure
      }
      break;

    case 'invoice.payment_failed':
      const failedInvoice = event.data.object as Stripe.Invoice;
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


