/**
 * Hyperswitch Payment Provider
 * Open-source payment orchestration layer (Apache 2.0).
 * Routes payments through connected processors using intelligent rules.
 * Stripe-compatible PaymentIntent API shape.
 *
 * E-commerce only — subscriptions handled by Stripe/Paddle/Chargebee/PayPal directly.
 *
 * @module lib/ecommerce/hyperswitch-provider
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import type { PaymentRequest, PaymentResult } from './payment-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ─── Key Config ──────────────────────────────────────────────────────────────

interface HyperswitchKeys {
  apiKey?: string;
  publishableKey?: string;
  /** Base URL for self-hosted or cloud instance */
  baseUrl?: string;
}

// ─── API Response Shapes ─────────────────────────────────────────────────────

interface HyperswitchPaymentResponse {
  payment_id?: string;
  client_secret?: string;
  status?: string;
  amount?: number;
  currency?: string;
  error?: {
    message?: string;
    code?: string;
  };
  message?: string;
}

interface HyperswitchRefundResponse {
  refund_id?: string;
  status?: string;
  error?: {
    message?: string;
  };
  message?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getHyperswitchConfig(): Promise<{
  apiKey: string;
  baseUrl: string;
} | null> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'hyperswitch')) as HyperswitchKeys | null;
  if (!keys?.apiKey) {
    return null;
  }

  return {
    apiKey: keys.apiKey,
    baseUrl: keys.baseUrl ?? 'https://sandbox.hyperswitch.io',
  };
}

/**
 * Calculate Hyperswitch processing fee.
 * Hyperswitch itself is free (open-source). The fee is from the underlying processor.
 * We estimate based on average processor costs (~2.5%).
 */
export function calculateHyperswitchFee(amount: number): number {
  return amount * 0.025;
}

// ─── Create Payment Intent ───────────────────────────────────────────────────

/**
 * Create a Hyperswitch PaymentIntent (Stripe-compatible shape).
 * Returns client_secret for the UnifiedCheckout component.
 */
export async function createHyperswitchPaymentIntent(
  amount: number,
  currency: string,
  returnUrl: string,
  metadata?: Record<string, string>,
): Promise<{
  clientSecret: string;
  paymentId: string;
} | { error: string }> {
  const config = await getHyperswitchConfig();
  if (!config) {
    return { error: 'Hyperswitch not configured. Please add API key in settings.' };
  }

  const response = await fetch(`${config.baseUrl}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: currency.toUpperCase(),
      confirm: false,
      capture_method: 'automatic',
      return_url: returnUrl,
      ...(metadata ? { metadata } : {}),
    }),
  });

  const data = (await response.json()) as HyperswitchPaymentResponse;

  if (!response.ok || !data.client_secret || !data.payment_id) {
    const errorMsg = data.error?.message ?? data.message ?? 'Failed to create Hyperswitch payment';
    logger.error('Hyperswitch payment creation failed', new Error(errorMsg), {
      file: 'hyperswitch-provider.ts',
    });
    return { error: errorMsg };
  }

  return {
    clientSecret: data.client_secret,
    paymentId: data.payment_id,
  };
}

// ─── Process Payment ─────────────────────────────────────────────────────────

/**
 * Process a payment via Hyperswitch (for the payment-service dispatcher).
 */
export async function processHyperswitchPayment(
  request: PaymentRequest,
  _providerConfig: unknown,
): Promise<PaymentResult> {
  try {
    const config = await getHyperswitchConfig();
    if (!config) {
      return { success: false, error: 'Hyperswitch not configured. Please add API key in settings.' };
    }

    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/store/checkout/success`;

    const response = await fetch(`${config.baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey,
      },
      body: JSON.stringify({
        amount: Math.round(request.amount * 100),
        currency: request.currency.toUpperCase(),
        confirm: false,
        capture_method: 'automatic',
        return_url: returnUrl,
        email: request.customer.email,
        metadata: {
          customerEmail: request.customer.email,
          ...request.metadata,
        },
      }),
    });

    const data = (await response.json()) as HyperswitchPaymentResponse;

    if (!response.ok || !data.payment_id) {
      const errorMsg = data.error?.message ?? data.message ?? 'Hyperswitch payment failed';
      return { success: false, error: errorMsg };
    }

    return {
      success: true,
      pending: true,
      transactionId: data.payment_id,
      provider: 'hyperswitch',
      processingFee: calculateHyperswitchFee(request.amount),
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Hyperswitch payment error:', err, { file: 'hyperswitch-provider.ts' });
    return {
      success: false,
      error: err.message || 'Hyperswitch payment processing failed',
    };
  }
}

// ─── Refund Payment ──────────────────────────────────────────────────────────

/**
 * Refund a Hyperswitch payment (full or partial).
 */
export async function refundHyperswitchPayment(
  paymentId: string,
  amount?: number,
): Promise<PaymentResult> {
  try {
    const config = await getHyperswitchConfig();
    if (!config) {
      return { success: false, error: 'Hyperswitch not configured' };
    }

    const body: Record<string, unknown> = {
      payment_id: paymentId,
      reason: 'Refund requested',
    };

    if (amount != null) {
      body.amount = Math.round(amount * 100);
    }

    const response = await fetch(`${config.baseUrl}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as HyperswitchRefundResponse;

    if (!response.ok || !data.refund_id) {
      const errorMsg = data.error?.message ?? data.message ?? 'Hyperswitch refund failed';
      return { success: false, error: errorMsg };
    }

    return {
      success: true,
      transactionId: data.refund_id,
      provider: 'hyperswitch',
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Hyperswitch refund error:', err, { file: 'hyperswitch-provider.ts' });
    return { success: false, error: err.message || 'Hyperswitch refund failed' };
  }
}
