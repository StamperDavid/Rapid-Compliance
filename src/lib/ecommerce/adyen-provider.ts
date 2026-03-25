/**
 * Adyen Payment Provider
 * Direct processor with Interchange++ pricing (~0.95-1.15%).
 * Uses Adyen Checkout API v71 (sessions + payments).
 *
 * NO built-in subscription support — pair with Chargebee for recurring billing.
 *
 * @module lib/ecommerce/adyen-provider
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import type { PaymentRequest, PaymentResult } from './payment-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ─── Key Config ──────────────────────────────────────────────────────────────

interface AdyenKeys {
  apiKey?: string;
  merchantAccount?: string;
  /** "test" or "live" — determines API prefix */
  mode?: string;
  /** Live URL prefix (e.g., "abc123-CompanyName") — required for production */
  liveUrlPrefix?: string;
}

// ─── API Response Shapes ─────────────────────────────────────────────────────

interface AdyenSessionResponse {
  id?: string;
  sessionData?: string;
  amount?: {
    value?: number;
    currency?: string;
  };
  expiresAt?: string;
  reference?: string;
  returnUrl?: string;
  error?: string;
  message?: string;
  status?: number;
}

interface AdyenRefundResponse {
  pspReference?: string;
  status?: string;
  message?: string;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAdyenConfig(): Promise<{
  apiKey: string;
  merchantAccount: string;
  baseUrl: string;
} | null> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'adyen')) as AdyenKeys | null;
  if (!keys?.apiKey || !keys.merchantAccount) {
    return null;
  }

  // Adyen API URLs differ for test vs live
  const baseUrl = keys.mode === 'live' && keys.liveUrlPrefix
    ? `https://${keys.liveUrlPrefix}-checkout-live.adyenpayments.com/checkout/v71`
    : 'https://checkout-test.adyen.com/v71';

  return { apiKey: keys.apiKey, merchantAccount: keys.merchantAccount, baseUrl };
}

/**
 * Calculate Adyen processing fee (Interchange++).
 * Approximate: ~1.05% average (actual varies by card type/region).
 */
export function calculateAdyenFee(amount: number): number {
  return amount * 0.0105;
}

// ─── Create Session ──────────────────────────────────────────────────────────

/**
 * Create an Adyen checkout session for the Drop-in component.
 * Returns sessionId + sessionData for client-side initialization.
 */
export async function createAdyenSession(
  amount: number,
  currency: string,
  returnUrl: string,
  metadata?: Record<string, string>,
): Promise<{
  sessionId: string;
  sessionData: string;
} | { error: string }> {
  const config = await getAdyenConfig();
  if (!config) {
    return { error: 'Adyen not configured. Please add Adyen API keys in settings.' };
  }

  const reference = `sv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const response = await fetch(`${config.baseUrl}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.apiKey,
    },
    body: JSON.stringify({
      amount: {
        value: Math.round(amount * 100),
        currency: currency.toUpperCase(),
      },
      reference,
      returnUrl,
      merchantAccount: config.merchantAccount,
      channel: 'Web',
      ...(metadata ? { metadata } : {}),
    }),
  });

  const data = (await response.json()) as AdyenSessionResponse;

  if (!response.ok || !data.id || !data.sessionData) {
    const errorMsg = data.message ?? data.error ?? 'Failed to create Adyen session';
    logger.error('Adyen session creation failed', new Error(errorMsg), {
      file: 'adyen-provider.ts',
    });
    return { error: errorMsg };
  }

  return {
    sessionId: data.id,
    sessionData: data.sessionData,
  };
}

// ─── Process Payment ─────────────────────────────────────────────────────────

/**
 * Process a payment via Adyen (server-side, for the payment-service dispatcher).
 * Uses the Sessions API to create a checkout session.
 */
export async function processAdyenPayment(
  request: PaymentRequest,
  _providerConfig: unknown,
): Promise<PaymentResult> {
  try {
    const config = await getAdyenConfig();
    if (!config) {
      return { success: false, error: 'Adyen not configured. Please add Adyen API keys in settings.' };
    }

    const reference = `sv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/store/checkout/success`;

    const response = await fetch(`${config.baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
      },
      body: JSON.stringify({
        amount: {
          value: Math.round(request.amount * 100),
          currency: request.currency.toUpperCase(),
        },
        reference,
        returnUrl,
        merchantAccount: config.merchantAccount,
        channel: 'Web',
        shopperEmail: request.customer.email,
        metadata: {
          customerEmail: request.customer.email,
          ...request.metadata,
        },
      }),
    });

    const data = (await response.json()) as AdyenSessionResponse;

    if (!response.ok || !data.id) {
      const errorMsg = data.message ?? data.error ?? 'Adyen session creation failed';
      return { success: false, error: errorMsg };
    }

    // Session created — client needs to render the Drop-in to complete payment
    return {
      success: true,
      pending: true,
      transactionId: data.id,
      provider: 'adyen',
      processingFee: calculateAdyenFee(request.amount),
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Adyen payment error:', err, { file: 'adyen-provider.ts' });
    return {
      success: false,
      error: err.message || 'Adyen payment processing failed',
    };
  }
}

// ─── Refund Payment ──────────────────────────────────────────────────────────

/**
 * Refund an Adyen payment (full or partial).
 * Uses the /payments/{pspReference}/refunds endpoint.
 */
export async function refundAdyenPayment(
  pspReference: string,
  amount?: number,
): Promise<PaymentResult> {
  try {
    const config = await getAdyenConfig();
    if (!config) {
      return { success: false, error: 'Adyen not configured' };
    }

    const body: Record<string, unknown> = {
      merchantAccount: config.merchantAccount,
      reference: `refund_${Date.now()}`,
    };

    if (amount != null) {
      body.amount = {
        value: Math.round(amount * 100),
        currency: 'USD',
      };
    }

    const response = await fetch(`${config.baseUrl}/payments/${pspReference}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as AdyenRefundResponse;

    if (!response.ok || !data.pspReference) {
      const errorMsg = data.message ?? data.error ?? 'Adyen refund failed';
      return { success: false, error: errorMsg };
    }

    return {
      success: true,
      transactionId: data.pspReference,
      provider: 'adyen',
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Adyen refund error:', err, { file: 'adyen-provider.ts' });
    return { success: false, error: err.message || 'Adyen refund failed' };
  }
}
