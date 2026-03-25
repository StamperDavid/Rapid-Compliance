/**
 * Razorpay Payment Provider
 * Popular in India with simple pricing (2% + small fixed fee).
 * Uses Razorpay Orders API v1 with Basic Auth.
 *
 * Flow: Server creates order → Client completes via Razorpay checkout.js → Webhook confirms.
 * Supports programmatic refunds via /payments/{id}/refund.
 *
 * @module lib/ecommerce/razorpay-provider
 */

import { createHmac } from 'crypto';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import type { PaymentRequest, PaymentResult } from './payment-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ─── Key Config ──────────────────────────────────────────────────────────────

interface RazorpayKeys {
  keyId?: string;
  keySecret?: string;
  /** Razorpay uses test keys for sandbox — no separate endpoint needed */
  webhookSecret?: string;
}

// ─── API Response Shapes ─────────────────────────────────────────────────────

interface RazorpayOrderResponse {
  id?: string;
  entity?: string;
  amount?: number;
  currency?: string;
  status?: string;
  error?: {
    code?: string;
    description?: string;
  };
}

interface RazorpayPaymentResponse {
  id?: string;
  entity?: string;
  amount?: number;
  currency?: string;
  status?: string;
  method?: string;
  card?: {
    last4?: string;
    network?: string;
  };
  error?: {
    code?: string;
    description?: string;
  };
}

interface RazorpayRefundResponse {
  id?: string;
  entity?: string;
  amount?: number;
  status?: string;
  error?: {
    code?: string;
    description?: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getRazorpayConfig(): Promise<{
  keyId: string;
  keySecret: string;
  authHeader: string;
} | null> {
  const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'razorpay')) as RazorpayKeys | null;
  if (!keys?.keyId || !keys?.keySecret) {
    return null;
  }

  const authHeader = `Basic ${Buffer.from(`${keys.keyId}:${keys.keySecret}`).toString('base64')}`;

  return { keyId: keys.keyId, keySecret: keys.keySecret, authHeader };
}

const RAZORPAY_API = 'https://api.razorpay.com/v1';

/**
 * Calculate Razorpay processing fee.
 * Standard rate: 2% per transaction (varies by payment method).
 */
export function calculateRazorpayFee(amount: number): number {
  return amount * 0.02;
}

// ─── Process Payment ─────────────────────────────────────────────────────────

/**
 * Create a Razorpay order for client-side checkout.
 *
 * If `paymentToken` is provided (razorpay_payment_id from client), captures and verifies it.
 * Otherwise, creates a new order and returns pending: true for client-side completion.
 */
export async function processRazorpayPayment(
  request: PaymentRequest,
  _providerConfig: unknown,
): Promise<PaymentResult> {
  try {
    const config = await getRazorpayConfig();
    if (!config) {
      return { success: false, error: 'Razorpay not configured. Please add Razorpay API keys in settings.' };
    }

    // If client already completed payment, verify and fetch details
    if (request.paymentToken) {
      return await verifyAndFetchPayment(config, request);
    }

    // Create a new order for client-side checkout
    const response = await fetch(`${RAZORPAY_API}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: config.authHeader,
      },
      body: JSON.stringify({
        amount: Math.round(request.amount * 100), // Razorpay expects paise (INR) or smallest unit
        currency: request.currency.toUpperCase(),
        receipt: typeof request.metadata?.orderId === 'string'
          ? request.metadata.orderId
          : `sv_${Date.now()}`,
        notes: {
          customerEmail: request.customer.email,
          customerName: `${request.customer.firstName} ${request.customer.lastName}`,
        },
      }),
    });

    const data = (await response.json()) as RazorpayOrderResponse;

    if (!response.ok || !data.id) {
      const errorMsg = data.error?.description ?? 'Failed to create Razorpay order';
      logger.error('Razorpay order creation failed', new Error(errorMsg), {
        file: 'razorpay-provider.ts',
      });
      return { success: false, error: errorMsg };
    }

    // Order created — client uses Razorpay checkout.js to complete payment
    return {
      success: true,
      pending: true,
      transactionId: data.id,
      provider: 'razorpay',
      processingFee: calculateRazorpayFee(request.amount),
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Razorpay payment error:', err, { file: 'razorpay-provider.ts' });
    return {
      success: false,
      error: err.message || 'Razorpay payment processing failed',
    };
  }
}

/**
 * Verify a completed Razorpay payment and fetch its details.
 * Called when the client sends back the razorpay_payment_id after checkout.
 */
async function verifyAndFetchPayment(
  config: { keyId: string; keySecret: string; authHeader: string },
  request: PaymentRequest,
): Promise<PaymentResult> {
  const paymentId = request.paymentToken;

  // Fetch payment details
  const response = await fetch(`${RAZORPAY_API}/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      Authorization: config.authHeader,
    },
  });

  const payment = (await response.json()) as RazorpayPaymentResponse;

  if (!response.ok || !payment.id) {
    const errorMsg = payment.error?.description ?? 'Failed to fetch Razorpay payment';
    return { success: false, error: errorMsg };
  }

  if (payment.status === 'captured') {
    return {
      success: true,
      transactionId: payment.id,
      provider: 'razorpay',
      cardLast4: payment.card?.last4,
      cardBrand: payment.card?.network,
      processingFee: calculateRazorpayFee(request.amount),
    };
  }

  // If authorized but not captured, capture it
  if (payment.status === 'authorized') {
    const captureResponse = await fetch(`${RAZORPAY_API}/payments/${paymentId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: config.authHeader,
      },
      body: JSON.stringify({
        amount: Math.round(request.amount * 100),
        currency: request.currency.toUpperCase(),
      }),
    });

    const captured = (await captureResponse.json()) as RazorpayPaymentResponse;

    if (!captureResponse.ok || captured.status !== 'captured') {
      const errorMsg = captured.error?.description ?? 'Razorpay payment capture failed';
      return { success: false, error: errorMsg };
    }

    return {
      success: true,
      transactionId: captured.id ?? paymentId ?? '',
      provider: 'razorpay',
      cardLast4: captured.card?.last4,
      cardBrand: captured.card?.network,
      processingFee: calculateRazorpayFee(request.amount),
    };
  }

  return {
    success: false,
    error: `Razorpay payment status: ${payment.status}`,
  };
}

// ─── Verify Signature ────────────────────────────────────────────────────────

/**
 * Verify Razorpay payment signature (for webhook or client-side verification).
 * Razorpay signs: HMAC-SHA256(order_id + "|" + payment_id, key_secret).
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  const expectedSignature = createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return expectedSignature === signature;
}

// ─── Refund Payment ──────────────────────────────────────────────────────────

/**
 * Refund a Razorpay payment (full or partial).
 */
export async function refundRazorpayPayment(
  paymentId: string,
  amount?: number,
): Promise<PaymentResult> {
  try {
    const config = await getRazorpayConfig();
    if (!config) {
      return { success: false, error: 'Razorpay not configured' };
    }

    const body: Record<string, unknown> = {};

    if (amount != null) {
      body.amount = Math.round(amount * 100); // Convert to smallest currency unit
    }

    const response = await fetch(`${RAZORPAY_API}/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: config.authHeader,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as RazorpayRefundResponse;

    if (!response.ok || !data.id) {
      const errorMsg = data.error?.description ?? 'Razorpay refund failed';
      return { success: false, error: errorMsg };
    }

    return {
      success: true,
      transactionId: data.id,
      provider: 'razorpay',
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Razorpay refund error:', err, { file: 'razorpay-provider.ts' });
    return { success: false, error: err.message || 'Razorpay refund failed' };
  }
}
