/**
 * Paddle Payment Provider
 * Merchant of Record — handles all tax, VAT, invoicing, and compliance.
 * Uses Paddle Billing API v2 (transactions + subscriptions).
 *
 * @module lib/ecommerce/paddle-provider
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import type { PaymentRequest, PaymentResult } from './payment-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ─── Key Config ──────────────────────────────────────────────────────────────

interface PaddleKeys {
  apiKey?: string;
  /** "sandbox" or "production" */
  mode?: string;
}

// ─── API Response Shapes ─────────────────────────────────────────────────────

interface PaddleTransactionResponse {
  data?: {
    id?: string;
    status?: string;
    checkout?: {
      url?: string;
    };
    details?: {
      totals?: {
        total?: string;
        currency_code?: string;
      };
    };
  };
  error?: {
    detail?: string;
  };
}

interface PaddleRefundResponse {
  data?: {
    id?: string;
    status?: string;
  };
  error?: {
    detail?: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getPaddleConfig(): Promise<{ apiKey: string; baseUrl: string } | null> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'paddle')) as PaddleKeys | null;
  if (!keys?.apiKey) {
    return null;
  }

  const baseUrl = keys.mode === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

  return { apiKey: keys.apiKey, baseUrl };
}

/**
 * Calculate Paddle processing fee (Merchant of Record).
 * Paddle fee: 5% + $0.50 per transaction.
 */
export function calculatePaddleFee(amount: number): number {
  return amount * 0.05 + 0.50;
}

// ─── Process Payment ─────────────────────────────────────────────────────────

/**
 * Create a Paddle transaction for a one-time payment.
 * Returns a checkout URL for the Paddle overlay.
 */
export async function processPaddlePayment(
  request: PaymentRequest,
  _providerConfig: unknown,
): Promise<PaymentResult> {
  try {
    const config = await getPaddleConfig();
    if (!config) {
      return { success: false, error: 'Paddle not configured. Please add Paddle API key in settings.' };
    }

    const response = await fetch(`${config.baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        items: [{
          price: {
            description: 'SalesVelocity.ai Purchase',
            name: 'Checkout Payment',
            unit_price: {
              amount: String(Math.round(request.amount * 100)),
              currency_code: request.currency.toUpperCase(),
            },
            quantity: { minimum: 1, maximum: 1 },
          },
          quantity: 1,
        }],
        checkout: {
          url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/store/checkout/success`,
        },
        customer: {
          email: request.customer.email,
        },
      }),
    });

    const data = (await response.json()) as PaddleTransactionResponse;

    if (!response.ok || !data.data?.id) {
      const errorMsg = data.error?.detail ?? 'Failed to create Paddle transaction';
      logger.error('Paddle transaction creation failed', new Error(errorMsg), {
        file: 'paddle-provider.ts',
      });
      return { success: false, error: errorMsg };
    }

    // Paddle transactions in "ready" or "billed" status are successful
    const status = data.data.status;
    if (status === 'completed' || status === 'billed' || status === 'ready') {
      return {
        success: true,
        transactionId: data.data.id,
        provider: 'paddle',
        processingFee: calculatePaddleFee(request.amount),
      };
    }

    // For draft/pending — return the checkout URL for the overlay
    return {
      success: true,
      pending: true,
      redirectUrl: data.data.checkout?.url,
      transactionId: data.data.id,
      provider: 'paddle',
      processingFee: calculatePaddleFee(request.amount),
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Paddle payment error:', err, { file: 'paddle-provider.ts' });
    return {
      success: false,
      error: err.message || 'Paddle payment processing failed',
    };
  }
}

// ─── Refund Payment ──────────────────────────────────────────────────────────

/**
 * Refund a Paddle transaction (full or partial).
 */
export async function refundPaddlePayment(
  transactionId: string,
  amount?: number,
): Promise<PaymentResult> {
  try {
    const config = await getPaddleConfig();
    if (!config) {
      return { success: false, error: 'Paddle not configured' };
    }

    const body: Record<string, unknown> = {
      transaction_id: transactionId,
      reason: 'Refund requested',
    };

    if (amount != null) {
      body.amount = {
        amount: String(Math.round(amount * 100)),
        currency_code: 'USD',
      };
    }

    const response = await fetch(`${config.baseUrl}/adjustments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        action: 'refund',
        ...body,
      }),
    });

    const data = (await response.json()) as PaddleRefundResponse;

    if (!response.ok || !data.data?.id) {
      const errorMsg = data.error?.detail ?? 'Paddle refund failed';
      return { success: false, error: errorMsg };
    }

    return {
      success: true,
      transactionId: data.data.id,
      provider: 'paddle',
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Paddle refund error:', err, { file: 'paddle-provider.ts' });
    return { success: false, error: err.message || 'Paddle refund failed' };
  }
}
