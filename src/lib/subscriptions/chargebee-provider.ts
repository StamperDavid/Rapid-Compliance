/**
 * Chargebee Subscription Provider
 * Gold-standard SaaS subscription management layer.
 * Sits on top of existing payment processors (Stripe, Adyen, etc.).
 *
 * Uses Chargebee API v2 — hosted pages for checkout, portal sessions for management.
 *
 * @module lib/subscriptions/chargebee-provider
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import type {
  SubscriptionCheckoutRequest,
  SubscriptionCheckoutResult,
  SubscriptionVerifyResult,
  SubscriptionCancelResult,
  SubscriptionPortalResult,
} from './subscription-provider-service';

const LOG_PREFIX = '[Chargebee]';

// ─── Key Config ──────────────────────────────────────────────────────────────

interface ChargebeeKeys {
  apiKey?: string;
  siteName?: string;
}

interface ChargebeeConfig {
  apiKey: string;
  siteName: string;
  baseUrl: string;
}

// ─── API Response Shapes ─────────────────────────────────────────────────────

interface ChargebeeHostedPage {
  id?: string;
  url?: string;
  state?: string;
  type?: string;
  content?: {
    subscription?: {
      id?: string;
      plan_id?: string;
      status?: string;
      customer_id?: string;
    };
    customer?: {
      email?: string;
    };
  };
}

interface ChargebeeHostedPageResponse {
  hosted_page?: ChargebeeHostedPage;
  message?: string;
}

interface ChargebeeSubscription {
  id?: string;
  status?: string;
  current_term_end?: number;
}

interface ChargebeeSubscriptionResponse {
  subscription?: ChargebeeSubscription;
  message?: string;
}

interface ChargebeePortalSession {
  id?: string;
  access_url?: string;
}

interface ChargebeePortalResponse {
  portal_session?: ChargebeePortalSession;
  message?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getChargebeeConfig(): Promise<ChargebeeConfig | null> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'chargebee')) as ChargebeeKeys | null;
  if (!keys?.apiKey || !keys.siteName) {
    return null;
  }

  return {
    apiKey: keys.apiKey,
    siteName: keys.siteName,
    baseUrl: `https://${keys.siteName}.chargebee.com/api/v2`,
  };
}

function chargebeeHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
  };
}

function toFormBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

// ─── Create Checkout ─────────────────────────────────────────────────────────

export async function createChargebeeCheckout(
  req: SubscriptionCheckoutRequest,
): Promise<SubscriptionCheckoutResult> {
  try {
    const config = await getChargebeeConfig();
    if (!config) {
      return { success: false, provider: 'chargebee', error: 'Chargebee not configured' };
    }

    const priceInCents = req.billingPeriod === 'annual'
      ? req.tier.annualPriceCents
      : req.tier.monthlyPriceCents;
    const periodUnit = req.billingPeriod === 'annual' ? 'year' : 'month';

    const params: Record<string, string> = {
      'subscription[plan_id]': `sv_${req.tier.key}_${periodUnit}ly`,
      'subscription[plan_unit_price]': String(priceInCents),
      'customer[email]': req.userEmail,
      'redirect_url': `${req.appUrl}/settings/subscription?checkout=success&provider=chargebee&tier=${req.tier.key}`,
      'cancel_url': `${req.appUrl}/settings/subscription?checkout=cancelled`,
    };

    if (req.couponCode) {
      params['subscription[coupon]'] = req.couponCode;
    }

    const response = await fetch(`${config.baseUrl}/hosted_pages/checkout_new`, {
      method: 'POST',
      headers: chargebeeHeaders(config.apiKey),
      body: toFormBody(params),
    });

    const data = (await response.json()) as ChargebeeHostedPageResponse;

    if (!response.ok || !data.hosted_page?.url) {
      const errorMsg = data.message ?? 'Failed to create Chargebee checkout';
      return { success: false, provider: 'chargebee', error: errorMsg };
    }

    return {
      success: true,
      url: data.hosted_page.url,
      sessionId: data.hosted_page.id,
      provider: 'chargebee',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Checkout failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, provider: 'chargebee', error: msg };
  }
}

// ─── Verify Session ──────────────────────────────────────────────────────────

export async function verifyChargebeeSession(
  hostedPageId: string,
  _userEmail: string,
): Promise<SubscriptionVerifyResult> {
  try {
    const config = await getChargebeeConfig();
    if (!config) {
      return { valid: false, error: 'Chargebee not configured' };
    }

    const response = await fetch(`${config.baseUrl}/hosted_pages/${hostedPageId}`, {
      headers: chargebeeHeaders(config.apiKey),
    });

    const data = (await response.json()) as ChargebeeHostedPageResponse;

    if (!response.ok || !data.hosted_page) {
      return { valid: false, error: 'Failed to retrieve Chargebee hosted page' };
    }

    const page = data.hosted_page;
    if (page.state !== 'succeeded') {
      return { valid: false, error: `Chargebee checkout not completed (state: ${page.state ?? 'unknown'})` };
    }

    return {
      valid: true,
      subscriptionId: page.content?.subscription?.id,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Verify failed`, err instanceof Error ? err : new Error(msg));
    return { valid: false, error: msg };
  }
}

// ─── Cancel Subscription ─────────────────────────────────────────────────────

export async function cancelChargebeeSubscription(
  subscriptionId: string,
): Promise<SubscriptionCancelResult> {
  try {
    const config = await getChargebeeConfig();
    if (!config) {
      return { success: false, error: 'Chargebee not configured' };
    }

    const response = await fetch(
      `${config.baseUrl}/subscriptions/${subscriptionId}/cancel_for_items`,
      {
        method: 'POST',
        headers: chargebeeHeaders(config.apiKey),
        body: toFormBody({ end_of_term: 'true' }),
      },
    );

    const data = (await response.json()) as ChargebeeSubscriptionResponse;

    if (!response.ok) {
      return { success: false, error: data.message ?? 'Failed to cancel Chargebee subscription' };
    }

    return { success: true, cancelAtPeriodEnd: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Cancel failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, error: msg };
  }
}

// ─── Portal URL ──────────────────────────────────────────────────────────────

export async function getChargebeePortalUrl(
  _subscriptionId: string,
): Promise<SubscriptionPortalResult> {
  try {
    const config = await getChargebeeConfig();
    if (!config) {
      return { success: false, error: 'Chargebee not configured' };
    }

    const response = await fetch(`${config.baseUrl}/portal_sessions`, {
      method: 'POST',
      headers: chargebeeHeaders(config.apiKey),
      body: toFormBody({
        'redirect_url': `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/settings/subscription`,
      }),
    });

    const data = (await response.json()) as ChargebeePortalResponse;

    if (!response.ok || !data.portal_session?.access_url) {
      return { success: false, error: data.message ?? 'Failed to create Chargebee portal session' };
    }

    return { success: true, url: data.portal_session.access_url };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Portal URL failed`, err instanceof Error ? err : new Error(msg));
    return { success: false, error: msg };
  }
}
