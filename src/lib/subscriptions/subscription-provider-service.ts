/**
 * Subscription Provider Service — Provider-agnostic subscription billing
 *
 * Abstracts subscription checkout, verification, cancellation, and portal
 * across multiple payment providers (Stripe, Authorize.Net, PayPal, Square).
 *
 * Follows the same dispatcher pattern as ecommerce/payment-service.ts.
 *
 * @module lib/subscriptions/subscription-provider-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import type { SubscriptionTier } from '@/lib/pricing/subscription-tiers';

const LOG_PREFIX = '[SubscriptionProvider]';

// ============================================================================
// TYPES
// ============================================================================

export type SubscriptionProviderId =
  | 'stripe'
  | 'authorizenet'
  | 'paypal'
  | 'square'
  | 'paddle'
  | 'chargebee';

export interface SubscriptionCheckoutRequest {
  tier: SubscriptionTier;
  billingPeriod: 'monthly' | 'annual';
  userId: string;
  userEmail: string;
  couponCode?: string;
  /** Stripe coupon ID (pre-validated and created by the caller) */
  stripeCouponId?: string;
  appUrl: string;
}

export interface SubscriptionCheckoutResult {
  success: boolean;
  /** Redirect URL for hosted checkout (Stripe, PayPal, Authorize.Net Accept) */
  url?: string;
  /** Provider-specific session/order ID for verification */
  sessionId?: string;
  /** Provider name for tracking */
  provider: SubscriptionProviderId;
  error?: string;
}

export interface SubscriptionVerifyResult {
  valid: boolean;
  /** Provider's recurring subscription ID */
  subscriptionId?: string;
  error?: string;
}

export interface SubscriptionCancelResult {
  success: boolean;
  cancelAtPeriodEnd?: boolean;
  error?: string;
}

export interface SubscriptionPortalResult {
  success: boolean;
  url?: string;
  error?: string;
}

// ============================================================================
// PROVIDER CONFIG
// ============================================================================

/**
 * Get the configured subscription payment provider.
 * Reads from platform settings; falls back to 'stripe'.
 */
export async function getSubscriptionProvider(): Promise<SubscriptionProviderId> {
  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    if (!adminDb) { return 'stripe'; }

    const { getSubCollection } = await import('@/lib/firebase/collections');
    const doc = await adminDb
      .collection(getSubCollection('settings'))
      .doc('subscription_config')
      .get();

    if (doc.exists) {
      const data = doc.data();
      const provider = data?.paymentProvider as string | undefined;
      if (provider && isValidProvider(provider)) {
        return provider;
      }
    }
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to read subscription provider config, defaulting to stripe`);
  }

  return 'stripe';
}

function isValidProvider(p: string): p is SubscriptionProviderId {
  return ['stripe', 'authorizenet', 'paypal', 'square', 'paddle', 'chargebee'].includes(p);
}

// ============================================================================
// DISPATCHER — CHECKOUT
// ============================================================================

/**
 * Create a checkout session for a subscription upgrade.
 * Routes to the configured provider's implementation.
 */
export async function createCheckoutSession(
  request: SubscriptionCheckoutRequest,
  provider?: SubscriptionProviderId
): Promise<SubscriptionCheckoutResult> {
  const resolvedProvider = provider ?? await getSubscriptionProvider();

  switch (resolvedProvider) {
    case 'stripe':
      return createStripeCheckout(request);
    case 'authorizenet':
      return createAuthorizeNetCheckout(request);
    case 'paypal':
      return createPayPalCheckout(request);
    case 'square':
      return createSquareCheckout(request);
    case 'paddle':
      return createPaddleCheckout(request);
    case 'chargebee': {
      const { createChargebeeCheckout } = await import('./chargebee-provider');
      return createChargebeeCheckout(request);
    }
    default:
      return { success: false, provider: resolvedProvider, error: `Unsupported provider: ${resolvedProvider}` };
  }
}

// ============================================================================
// DISPATCHER — VERIFY
// ============================================================================

/**
 * Verify a completed checkout session matches the user.
 */
export async function verifyCheckoutSession(
  sessionId: string,
  userEmail: string,
  provider?: SubscriptionProviderId
): Promise<SubscriptionVerifyResult> {
  const resolvedProvider = provider ?? await getSubscriptionProvider();

  switch (resolvedProvider) {
    case 'stripe':
      return verifyStripeSession(sessionId, userEmail);
    case 'authorizenet':
      return verifyAuthorizeNetSession(sessionId, userEmail);
    case 'paypal':
      return verifyPayPalSession(sessionId, userEmail);
    case 'square':
      return verifySquareSession(sessionId, userEmail);
    case 'paddle':
      return verifyPaddleSession(sessionId, userEmail);
    case 'chargebee': {
      const { verifyChargebeeSession } = await import('./chargebee-provider');
      return verifyChargebeeSession(sessionId, userEmail);
    }
    default:
      return { valid: false, error: `Unsupported provider: ${resolvedProvider}` };
  }
}

// ============================================================================
// DISPATCHER — CANCEL
// ============================================================================

/**
 * Cancel a subscription (set to cancel at period end).
 */
export async function cancelSubscription(
  subscriptionId: string,
  provider?: SubscriptionProviderId
): Promise<SubscriptionCancelResult> {
  const resolvedProvider = provider ?? await getSubscriptionProvider();

  switch (resolvedProvider) {
    case 'stripe':
      return cancelStripeSubscription(subscriptionId);
    case 'authorizenet':
      return cancelAuthorizeNetSubscription(subscriptionId);
    case 'paypal':
      return cancelPayPalSubscription(subscriptionId);
    case 'square':
      return cancelSquareSubscription(subscriptionId);
    case 'paddle':
      return cancelPaddleSubscription(subscriptionId);
    case 'chargebee': {
      const { cancelChargebeeSubscription } = await import('./chargebee-provider');
      return cancelChargebeeSubscription(subscriptionId);
    }
    default:
      return { success: false, error: `Unsupported provider: ${resolvedProvider}` };
  }
}

// ============================================================================
// DISPATCHER — PORTAL
// ============================================================================

/**
 * Get a billing management portal URL.
 */
export async function getPortalUrl(
  subscriptionId: string,
  returnUrl: string,
  provider?: SubscriptionProviderId
): Promise<SubscriptionPortalResult> {
  const resolvedProvider = provider ?? await getSubscriptionProvider();

  switch (resolvedProvider) {
    case 'stripe':
      return getStripePortalUrl(subscriptionId, returnUrl);
    case 'authorizenet':
      // Authorize.Net has no hosted portal — return settings page
      return { success: true, url: returnUrl };
    case 'paypal':
      return getPayPalPortalUrl(subscriptionId);
    case 'square':
      // Square has no hosted portal — return settings page
      return { success: true, url: returnUrl };
    case 'paddle':
      return getPaddlePortalUrl(subscriptionId);
    case 'chargebee': {
      const { getChargebeePortalUrl } = await import('./chargebee-provider');
      return getChargebeePortalUrl(subscriptionId);
    }
    default:
      return { success: false, error: `Unsupported provider: ${resolvedProvider}` };
  }
}

// ============================================================================
// STRIPE IMPLEMENTATION
// ============================================================================

async function getStripeClient() {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'stripe') as { secretKey?: string } | null;
  if (!keys?.secretKey) { return null; }
  const Stripe = (await import('stripe')).default;
  return new Stripe(keys.secretKey, { apiVersion: '2023-10-16' });
}

async function createStripeCheckout(req: SubscriptionCheckoutRequest): Promise<SubscriptionCheckoutResult> {
  try {
    const stripe = await getStripeClient();
    if (!stripe) {
      return { success: false, provider: 'stripe', error: 'Stripe not configured' };
    }

    const priceInCents = req.billingPeriod === 'annual'
      ? req.tier.annualPriceCents
      : req.tier.monthlyPriceCents;
    const interval = req.billingPeriod === 'annual' ? 'year' as const : 'month' as const;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `SalesVelocity.ai ${req.tier.label} Plan`,
            description: `${req.tier.label} subscription — billed ${req.billingPeriod === 'annual' ? 'annually' : 'monthly'}`,
          },
          unit_amount: priceInCents,
          recurring: { interval },
        },
        quantity: 1,
      }],
      ...(req.stripeCouponId ? { discounts: [{ coupon: req.stripeCouponId }] } : {}),
      success_url: `${req.appUrl}/settings/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}&tier=${req.tier.key}`,
      cancel_url: `${req.appUrl}/settings/subscription?checkout=cancelled`,
      customer_email: req.userEmail,
      client_reference_id: req.userEmail,
      metadata: {
        tier: req.tier.key,
        billingPeriod: req.billingPeriod,
        userId: req.userId,
        ...(req.couponCode ? { couponCode: req.couponCode } : {}),
      },
    });

    if (!session.url) {
      return { success: false, provider: 'stripe', error: 'Failed to create Stripe checkout session' };
    }

    return { success: true, url: session.url, sessionId: session.id, provider: 'stripe' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Stripe checkout failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, provider: 'stripe', error: msg };
  }
}

async function verifyStripeSession(sessionId: string, userEmail: string): Promise<SubscriptionVerifyResult> {
  try {
    const stripe = await getStripeClient();
    if (!stripe) { return { valid: false, error: 'Stripe not configured' }; }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.status !== 'complete') {
      return { valid: false, error: `Session not complete (status: ${session.status})` };
    }
    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
      return { valid: false, error: `Payment not confirmed (status: ${session.payment_status})` };
    }

    const sessionEmail = session.customer_email ?? session.customer_details?.email;
    const sessionRef = session.client_reference_id;
    if (sessionEmail !== userEmail && sessionRef !== userEmail) {
      return { valid: false, error: 'Session does not match authenticated user' };
    }

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

    return { valid: true, subscriptionId: subscriptionId ?? undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Stripe verification failed`, err instanceof Error ? err : new Error(msg));
    return { valid: false, error: msg };
  }
}

async function cancelStripeSubscription(subscriptionId: string): Promise<SubscriptionCancelResult> {
  try {
    const stripe = await getStripeClient();
    if (!stripe) { return { success: false, error: 'Stripe not configured' }; }

    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    return { success: true, cancelAtPeriodEnd: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Stripe cancel failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, error: msg };
  }
}

async function getStripePortalUrl(subscriptionId: string, returnUrl: string): Promise<SubscriptionPortalResult> {
  try {
    const stripe = await getStripeClient();
    if (!stripe) { return { success: false, error: 'Stripe not configured' }; }

    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return { success: true, url: session.url };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Stripe portal failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, error: msg };
  }
}

// ============================================================================
// AUTHORIZE.NET IMPLEMENTATION
// ============================================================================

async function getAuthorizeNetKeys(): Promise<{ apiLoginId: string; transactionKey: string; sandbox: boolean } | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'authorizenet') as {
    apiLoginId?: string; transactionKey?: string; sandbox?: boolean;
  } | null;
  if (!keys?.apiLoginId || !keys?.transactionKey) { return null; }
  return { apiLoginId: keys.apiLoginId, transactionKey: keys.transactionKey, sandbox: keys.sandbox ?? false };
}

function getAuthorizeNetUrl(sandbox: boolean): string {
  return sandbox
    ? 'https://apitest.authorize.net/xml/v1/request.api'
    : 'https://api.authorize.net/xml/v1/request.api';
}

async function createAuthorizeNetCheckout(req: SubscriptionCheckoutRequest): Promise<SubscriptionCheckoutResult> {
  try {
    const keys = await getAuthorizeNetKeys();
    if (!keys) {
      return { success: false, provider: 'authorizenet', error: 'Authorize.Net not configured' };
    }

    const amount = req.billingPeriod === 'annual'
      ? (req.tier.annualPriceCents / 100).toFixed(2)
      : (req.tier.monthlyPriceCents / 100).toFixed(2);
    const interval = req.billingPeriod === 'annual'
      ? { length: '12', unit: 'months' as const }
      : { length: '1', unit: 'months' as const };

    // Create ARB (Automated Recurring Billing) subscription via Accept Hosted
    // Use getHostedPaymentPageRequest for a hosted checkout experience
    const payload = {
      getHostedPaymentPageRequest: {
        merchantAuthentication: {
          name: keys.apiLoginId,
          transactionKey: keys.transactionKey,
        },
        transactionRequest: {
          transactionType: 'authCaptureTransaction',
          amount,
          order: {
            invoiceNumber: `sub-${req.tier.key}-${Date.now()}`,
            description: `SalesVelocity.ai ${req.tier.label} Plan — ${req.billingPeriod}`,
          },
          customer: {
            email: req.userEmail,
          },
        },
        hostedPaymentSettings: {
          setting: [
            { settingName: 'hostedPaymentReturnOptions', settingValue: JSON.stringify({
              showReceipt: false,
              url: `${req.appUrl}/settings/subscription?checkout=success&provider=authorizenet&tier=${req.tier.key}`,
              urlText: 'Return to SalesVelocity.ai',
              cancelUrl: `${req.appUrl}/settings/subscription?checkout=cancelled`,
              cancelUrlText: 'Cancel',
            })},
            { settingName: 'hostedPaymentButtonOptions', settingValue: JSON.stringify({
              text: `Subscribe — $${amount}/${req.billingPeriod === 'annual' ? 'yr' : 'mo'}`,
            })},
            { settingName: 'hostedPaymentOrderOptions', settingValue: JSON.stringify({
              show: true,
              merchantName: 'SalesVelocity.ai',
            })},
          ],
        },
      },
    };

    const res = await fetch(getAuthorizeNetUrl(keys.sandbox), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as {
      token?: string;
      messages?: { resultCode: string; message: Array<{ code: string; text: string }> };
    };

    if (data.messages?.resultCode !== 'Ok' || !data.token) {
      const errorMsg = data.messages?.message?.[0]?.text ?? 'Failed to create Authorize.Net hosted page';
      return { success: false, provider: 'authorizenet', error: errorMsg };
    }

    // Build hosted payment page URL
    const hostedUrl = keys.sandbox
      ? `https://test.authorize.net/payment/payment`
      : `https://accept.authorize.net/payment/payment`;
    const checkoutUrl = `${hostedUrl}?token=${data.token}`;

    // Store the ARB details for post-payment subscription creation
    // The actual ARB subscription will be created via webhook after first payment
    const sessionId = `anet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Persist the pending session for verification
    const { adminDb } = await import('@/lib/firebase/admin');
    const { getSubCollection } = await import('@/lib/firebase/collections');
    if (adminDb) {
      await adminDb.collection(getSubCollection('subscription_sessions')).doc(sessionId).set({
        provider: 'authorizenet',
        token: data.token,
        tier: req.tier.key,
        billingPeriod: req.billingPeriod,
        interval,
        amount,
        userId: req.userId,
        userEmail: req.userEmail,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }

    return { success: true, url: checkoutUrl, sessionId, provider: 'authorizenet' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Authorize.Net checkout failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, provider: 'authorizenet', error: msg };
  }
}

async function verifyAuthorizeNetSession(sessionId: string, _userEmail: string): Promise<SubscriptionVerifyResult> {
  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    const { getSubCollection } = await import('@/lib/firebase/collections');
    if (!adminDb) { return { valid: false, error: 'Database not available' }; }

    const doc = await adminDb.collection(getSubCollection('subscription_sessions')).doc(sessionId).get();
    if (!doc.exists) {
      return { valid: false, error: 'Session not found' };
    }

    const session = doc.data() as Record<string, unknown>;
    if (session.status === 'completed') {
      return { valid: true, subscriptionId: session.arbSubscriptionId as string | undefined };
    }

    // For Authorize.Net, the webhook will update session status to 'completed'
    // If still pending, the payment hasn't been confirmed yet
    if (session.status === 'pending') {
      return { valid: false, error: 'Payment not yet confirmed. Please wait for processing.' };
    }

    return { valid: false, error: `Session status: ${session.status as string}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Authorize.Net verification failed`, err instanceof Error ? err : new Error(msg));
    return { valid: false, error: msg };
  }
}

async function cancelAuthorizeNetSubscription(subscriptionId: string): Promise<SubscriptionCancelResult> {
  try {
    const keys = await getAuthorizeNetKeys();
    if (!keys) { return { success: false, error: 'Authorize.Net not configured' }; }

    const payload = {
      ARBCancelSubscriptionRequest: {
        merchantAuthentication: {
          name: keys.apiLoginId,
          transactionKey: keys.transactionKey,
        },
        subscriptionId,
      },
    };

    const res = await fetch(getAuthorizeNetUrl(keys.sandbox), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as {
      messages?: { resultCode: string; message: Array<{ code: string; text: string }> };
    };

    if (data.messages?.resultCode !== 'Ok') {
      const errorMsg = data.messages?.message?.[0]?.text ?? 'Cancel failed';
      return { success: false, error: errorMsg };
    }

    return { success: true, cancelAtPeriodEnd: false }; // ARB cancels immediately
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Authorize.Net cancel failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, error: msg };
  }
}

// ============================================================================
// PAYPAL IMPLEMENTATION
// ============================================================================

async function getPayPalConfig(): Promise<{ clientId: string; clientSecret: string; sandbox: boolean } | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'paypal') as {
    clientId?: string; clientSecret?: string; sandbox?: boolean;
  } | null;
  if (!keys?.clientId || !keys?.clientSecret) { return null; }
  return { clientId: keys.clientId, clientSecret: keys.clientSecret, sandbox: keys.sandbox ?? false };
}

async function getPayPalAccessToken(config: { clientId: string; clientSecret: string; sandbox: boolean }): Promise<string | null> {
  const baseUrl = config.sandbox
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) { return null; }
  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

async function createPayPalCheckout(req: SubscriptionCheckoutRequest): Promise<SubscriptionCheckoutResult> {
  try {
    const config = await getPayPalConfig();
    if (!config) {
      return { success: false, provider: 'paypal', error: 'PayPal not configured' };
    }

    const accessToken = await getPayPalAccessToken(config);
    if (!accessToken) {
      return { success: false, provider: 'paypal', error: 'Failed to authenticate with PayPal' };
    }

    const baseUrl = config.sandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const amount = req.billingPeriod === 'annual'
      ? (req.tier.annualPriceCents / 100).toFixed(2)
      : (req.tier.monthlyPriceCents / 100).toFixed(2);

    // Create a PayPal billing plan
    const planRes = await fetch(`${baseUrl}/v1/billing/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        product_id: `salesvelocity-${req.tier.key}`,
        name: `SalesVelocity.ai ${req.tier.label} Plan`,
        description: `${req.tier.label} subscription — ${req.billingPeriod}`,
        status: 'ACTIVE',
        billing_cycles: [{
          frequency: {
            interval_unit: req.billingPeriod === 'annual' ? 'YEAR' : 'MONTH',
            interval_count: 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: amount, currency_code: 'USD' },
          },
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          payment_failure_threshold: 3,
        },
      }),
    });

    if (!planRes.ok) {
      return { success: false, provider: 'paypal', error: 'Failed to create PayPal billing plan' };
    }

    const plan = await planRes.json() as { id: string };

    // Create a subscription from the plan
    const subRes = await fetch(`${baseUrl}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        plan_id: plan.id,
        subscriber: {
          email_address: req.userEmail,
        },
        application_context: {
          brand_name: 'SalesVelocity.ai',
          return_url: `${req.appUrl}/settings/subscription?checkout=success&provider=paypal&tier=${req.tier.key}`,
          cancel_url: `${req.appUrl}/settings/subscription?checkout=cancelled`,
          user_action: 'SUBSCRIBE_NOW',
        },
        custom_id: req.userId,
      }),
    });

    if (!subRes.ok) {
      return { success: false, provider: 'paypal', error: 'Failed to create PayPal subscription' };
    }

    const subscription = await subRes.json() as {
      id: string;
      links: Array<{ rel: string; href: string }>;
    };

    const approveLink = subscription.links.find((l) => l.rel === 'approve');
    if (!approveLink) {
      return { success: false, provider: 'paypal', error: 'No approval URL returned from PayPal' };
    }

    return {
      success: true,
      url: approveLink.href,
      sessionId: subscription.id,
      provider: 'paypal',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} PayPal checkout failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, provider: 'paypal', error: msg };
  }
}

async function verifyPayPalSession(subscriptionId: string, _userEmail: string): Promise<SubscriptionVerifyResult> {
  try {
    const config = await getPayPalConfig();
    if (!config) { return { valid: false, error: 'PayPal not configured' }; }

    const accessToken = await getPayPalAccessToken(config);
    if (!accessToken) { return { valid: false, error: 'Failed to authenticate with PayPal' }; }

    const baseUrl = config.sandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const res = await fetch(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return { valid: false, error: 'Failed to retrieve PayPal subscription' };
    }

    const sub = await res.json() as { status: string; id: string };

    if (sub.status === 'ACTIVE' || sub.status === 'APPROVED') {
      return { valid: true, subscriptionId: sub.id };
    }

    return { valid: false, error: `PayPal subscription status: ${sub.status}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} PayPal verification failed`, err instanceof Error ? err : new Error(msg));
    return { valid: false, error: msg };
  }
}

async function cancelPayPalSubscription(subscriptionId: string): Promise<SubscriptionCancelResult> {
  try {
    const config = await getPayPalConfig();
    if (!config) { return { success: false, error: 'PayPal not configured' }; }

    const accessToken = await getPayPalAccessToken(config);
    if (!accessToken) { return { success: false, error: 'Failed to authenticate' }; }

    const baseUrl = config.sandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const res = await fetch(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ reason: 'Customer requested cancellation' }),
    });

    if (!res.ok && res.status !== 204) {
      return { success: false, error: 'Failed to cancel PayPal subscription' };
    }

    return { success: true, cancelAtPeriodEnd: false };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} PayPal cancel failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, error: msg };
  }
}

function getPayPalPortalUrl(_subscriptionId: string): SubscriptionPortalResult {
  // PayPal doesn't have a white-label portal like Stripe
  // Direct users to their PayPal dashboard
  return { success: true, url: 'https://www.paypal.com/myaccount/autopay/' };
}

// ============================================================================
// SQUARE IMPLEMENTATION
// ============================================================================

async function getSquareConfig(): Promise<{ accessToken: string; sandbox: boolean } | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'square') as {
    accessToken?: string; sandbox?: boolean;
  } | null;
  if (!keys?.accessToken) { return null; }
  return { accessToken: keys.accessToken, sandbox: keys.sandbox ?? false };
}

async function createSquareCheckout(req: SubscriptionCheckoutRequest): Promise<SubscriptionCheckoutResult> {
  try {
    const config = await getSquareConfig();
    if (!config) {
      return { success: false, provider: 'square', error: 'Square not configured' };
    }

    const baseUrl = config.sandbox
      ? 'https://connect.squareupsandbox.com/v2'
      : 'https://connect.squareup.com/v2';

    const amount = req.billingPeriod === 'annual'
      ? req.tier.annualPriceCents
      : req.tier.monthlyPriceCents;

    // Square uses catalog-based subscriptions — create a subscription plan first
    const planRes = await fetch(`${baseUrl}/catalog/object`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.accessToken}`,
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify({
        idempotency_key: `plan-${req.tier.key}-${Date.now()}`,
        object: {
          type: 'SUBSCRIPTION_PLAN',
          id: `#salesvelocity-${req.tier.key}-${req.billingPeriod}`,
          subscription_plan_data: {
            name: `SalesVelocity.ai ${req.tier.label} Plan (${req.billingPeriod})`,
            phases: [{
              cadence: req.billingPeriod === 'annual' ? 'ANNUAL' : 'MONTHLY',
              recurring_price_money: {
                amount,
                currency: 'USD',
              },
            }],
          },
        },
      }),
    });

    if (!planRes.ok) {
      return { success: false, provider: 'square', error: 'Failed to create Square subscription plan' };
    }

    const planData = await planRes.json() as {
      catalog_object?: { id: string };
    };
    const planId = planData.catalog_object?.id;

    if (!planId) {
      return { success: false, provider: 'square', error: 'No plan ID returned from Square' };
    }

    // Square subscriptions require a customer — create one
    const custRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.accessToken}`,
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify({
        idempotency_key: `cust-${req.userId}-${Date.now()}`,
        email_address: req.userEmail,
        reference_id: req.userId,
      }),
    });

    const custData = await custRes.json() as { customer?: { id: string } };
    const customerId = custData.customer?.id;

    if (!customerId) {
      return { success: false, provider: 'square', error: 'Failed to create Square customer' };
    }

    // Create a checkout link for the subscription
    const checkoutRes = await fetch(`${baseUrl}/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.accessToken}`,
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify({
        idempotency_key: `sub-checkout-${Date.now()}`,
        quick_pay: {
          name: `SalesVelocity.ai ${req.tier.label} Plan`,
          price_money: { amount, currency: 'USD' },
          location_id: 'main',
        },
        checkout_options: {
          redirect_url: `${req.appUrl}/settings/subscription?checkout=success&provider=square&tier=${req.tier.key}`,
          subscription_plan_id: planId,
        },
        pre_populated_data: {
          buyer_email: req.userEmail,
        },
      }),
    });

    const checkoutData = await checkoutRes.json() as {
      payment_link?: { url: string; id: string };
    };

    if (!checkoutData.payment_link?.url) {
      return { success: false, provider: 'square', error: 'Failed to create Square checkout link' };
    }

    return {
      success: true,
      url: checkoutData.payment_link.url,
      sessionId: checkoutData.payment_link.id,
      provider: 'square',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Square checkout failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, provider: 'square', error: msg };
  }
}

async function verifySquareSession(sessionId: string, _userEmail: string): Promise<SubscriptionVerifyResult> {
  try {
    const config = await getSquareConfig();
    if (!config) { return { valid: false, error: 'Square not configured' }; }

    const baseUrl = config.sandbox
      ? 'https://connect.squareupsandbox.com/v2'
      : 'https://connect.squareup.com/v2';

    const res = await fetch(`${baseUrl}/online-checkout/payment-links/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Square-Version': '2024-01-18',
      },
    });

    if (!res.ok) {
      return { valid: false, error: 'Failed to retrieve Square payment link' };
    }

    const data = await res.json() as {
      payment_link?: { id: string; order_id?: string };
    };

    if (data.payment_link?.order_id) {
      return { valid: true, subscriptionId: data.payment_link.order_id };
    }

    return { valid: false, error: 'Square payment not yet completed' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Square verification failed`, err instanceof Error ? err : new Error(msg));
    return { valid: false, error: msg };
  }
}

async function cancelSquareSubscription(subscriptionId: string): Promise<SubscriptionCancelResult> {
  try {
    const config = await getSquareConfig();
    if (!config) { return { success: false, error: 'Square not configured' }; }

    const baseUrl = config.sandbox
      ? 'https://connect.squareupsandbox.com/v2'
      : 'https://connect.squareup.com/v2';

    const res = await fetch(`${baseUrl}/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.accessToken}`,
        'Square-Version': '2024-01-18',
      },
    });

    if (!res.ok) {
      return { success: false, error: 'Failed to cancel Square subscription' };
    }

    return { success: true, cancelAtPeriodEnd: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Square cancel failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, error: msg };
  }
}

// ============================================================================
// PADDLE IMPLEMENTATION
// ============================================================================

interface PaddleKeys {
  apiKey?: string;
  mode?: string;
}

interface PaddleConfig {
  apiKey: string;
  baseUrl: string;
}

async function getPaddleSubscriptionConfig(): Promise<PaddleConfig | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'paddle') as PaddleKeys | null;
  if (!keys?.apiKey) { return null; }
  const baseUrl = keys.mode === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';
  return { apiKey: keys.apiKey, baseUrl };
}

async function createPaddleCheckout(req: SubscriptionCheckoutRequest): Promise<SubscriptionCheckoutResult> {
  try {
    const config = await getPaddleSubscriptionConfig();
    if (!config) {
      return { success: false, provider: 'paddle', error: 'Paddle not configured' };
    }

    const priceInCents = req.billingPeriod === 'annual'
      ? req.tier.annualPriceCents
      : req.tier.monthlyPriceCents;
    const interval = req.billingPeriod === 'annual' ? 'year' : 'month';

    // Create a Paddle transaction with subscription billing
    const res = await fetch(`${config.baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        items: [{
          price: {
            description: `SalesVelocity.ai ${req.tier.label} Plan`,
            name: `${req.tier.label} — ${req.billingPeriod}`,
            unit_price: {
              amount: String(priceInCents),
              currency_code: 'USD',
            },
            billing_cycle: {
              interval,
              frequency: 1,
            },
          },
          quantity: 1,
        }],
        customer: {
          email: req.userEmail,
        },
        checkout: {
          url: `${req.appUrl}/settings/subscription?checkout=success&provider=paddle&tier=${req.tier.key}`,
        },
        custom_data: {
          tier: req.tier.key,
          billingPeriod: req.billingPeriod,
          userId: req.userId,
          ...(req.couponCode ? { couponCode: req.couponCode } : {}),
        },
      }),
    });

    const data = await res.json() as {
      data?: {
        id?: string;
        checkout?: { url?: string };
      };
      error?: { detail?: string };
    };

    if (!res.ok || !data.data?.id) {
      const errorMsg = data.error?.detail ?? 'Failed to create Paddle checkout';
      return { success: false, provider: 'paddle', error: errorMsg };
    }

    return {
      success: true,
      url: data.data.checkout?.url ?? undefined,
      sessionId: data.data.id,
      provider: 'paddle',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Paddle checkout failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, provider: 'paddle', error: msg };
  }
}

async function verifyPaddleSession(sessionId: string, _userEmail: string): Promise<SubscriptionVerifyResult> {
  try {
    const config = await getPaddleSubscriptionConfig();
    if (!config) { return { valid: false, error: 'Paddle not configured' }; }

    const res = await fetch(`${config.baseUrl}/transactions/${sessionId}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    const data = await res.json() as {
      data?: {
        status?: string;
        subscription_id?: string;
        custom_data?: Record<string, string>;
        details?: {
          totals?: { total?: string };
        };
      };
    };

    if (!res.ok || !data.data) {
      return { valid: false, error: 'Failed to retrieve Paddle transaction' };
    }

    const status = data.data.status;
    if (status !== 'completed' && status !== 'billed') {
      return { valid: false, error: `Paddle transaction not complete (status: ${status ?? 'unknown'})` };
    }

    return {
      valid: true,
      subscriptionId: data.data.subscription_id,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Paddle verify failed`, err instanceof Error ? err : new Error(msg));
    return { valid: false, error: msg };
  }
}

async function cancelPaddleSubscription(subscriptionId: string): Promise<SubscriptionCancelResult> {
  try {
    const config = await getPaddleSubscriptionConfig();
    if (!config) { return { success: false, error: 'Paddle not configured' }; }

    const res = await fetch(`${config.baseUrl}/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        effective_from: 'next_billing_period',
      }),
    });

    if (!res.ok) {
      const errorData = await res.json() as { error?: { detail?: string } };
      return { success: false, error: errorData.error?.detail ?? 'Failed to cancel Paddle subscription' };
    }

    return { success: true, cancelAtPeriodEnd: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Paddle cancel failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, error: msg };
  }
}

async function getPaddlePortalUrl(subscriptionId: string): Promise<SubscriptionPortalResult> {
  try {
    const config = await getPaddleSubscriptionConfig();
    if (!config) { return { success: false, error: 'Paddle not configured' }; }

    // Paddle's customer portal is accessed via the update payment method URL
    const res = await fetch(
      `${config.baseUrl}/subscriptions/${subscriptionId}/update-payment-method-transaction`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
      },
    );

    const data = await res.json() as {
      data?: {
        checkout?: { url?: string };
      };
      error?: { detail?: string };
    };

    if (!res.ok || !data.data?.checkout?.url) {
      // Fallback to settings page
      return { success: true, url: '/settings/subscription' };
    }

    return { success: true, url: data.data.checkout.url };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Paddle portal URL failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, error: msg };
  }
}
