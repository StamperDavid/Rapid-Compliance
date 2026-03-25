/**
 * PayPal Webhook Handler
 * Processes payment, refund, and dispute events from PayPal.
 *
 * PayPal sends JSON POST with headers for signature verification:
 * - PAYPAL-TRANSMISSION-ID, PAYPAL-TRANSMISSION-TIME, PAYPAL-TRANSMISSION-SIG
 * - PAYPAL-CERT-URL, PAYPAL-AUTH-ALGO
 *
 * We verify by calling PayPal's /v1/notifications/verify-webhook-signature endpoint.
 *
 * Events: PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.DENIED, CHECKOUT.ORDER.APPROVED, etc.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection, getOrdersCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

// ─── Key Config ──────────────────────────────────────────────────────────────

interface PayPalKeys {
  clientId?: string;
  clientSecret?: string;
  webhookId?: string;
  mode?: string;
}

// ─── Event Shapes ────────────────────────────────────────────────────────────

interface PayPalResource {
  id?: string;
  status?: string;
  amount?: { value?: string; currency_code?: string };
  invoice_id?: string;
  custom_id?: string;
  supplementary_data?: {
    related_ids?: { order_id?: string };
  };
}

interface PayPalEvent {
  id: string;
  event_type: string;
  resource_type?: string;
  resource: PayPalResource;
  create_time?: string;
  summary?: string;
}

// ─── Signature Verification ─────────────────────────────────────────────────

/**
 * Verify PayPal webhook signature by calling PayPal's verification endpoint.
 * This is PayPal's recommended approach — they handle the crypto.
 */
async function verifyPayPalWebhook(
  rawBody: string,
  headers: Headers,
  keys: PayPalKeys,
): Promise<boolean> {
  try {
    if (!keys.clientId || !keys.clientSecret || !keys.webhookId) {
      return false;
    }

    const baseUrl = keys.mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    // Get access token
    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${keys.clientId}:${keys.clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!authResponse.ok) {
      return false;
    }

    const authData = (await authResponse.json()) as { access_token: string };

    // Verify the webhook signature
    const verifyResponse = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authData.access_token}`,
      },
      body: JSON.stringify({
        auth_algo: headers.get('paypal-auth-algo') ?? '',
        cert_url: headers.get('paypal-cert-url') ?? '',
        transmission_id: headers.get('paypal-transmission-id') ?? '',
        transmission_sig: headers.get('paypal-transmission-sig') ?? '',
        transmission_time: headers.get('paypal-transmission-time') ?? '',
        webhook_id: keys.webhookId,
        webhook_event: JSON.parse(rawBody) as Record<string, unknown>,
      }),
    });

    if (!verifyResponse.ok) {
      return false;
    }

    const result = (await verifyResponse.json()) as { verification_status: string };
    return result.verification_status === 'SUCCESS';
  } catch {
    return false;
  }
}

// ─── Route Handler ──────────────────────────────────────────────────────────

const ORDERS_PATH = getOrdersCollection();

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'paypal')) as PayPalKeys | null;

    // Verify signature if webhook ID is configured
    if (keys?.webhookId) {
      const isValid = await verifyPayPalWebhook(rawBody, request.headers, keys);
      if (!isValid) {
        logger.warn('PayPal webhook signature verification failed', {
          route: '/api/webhooks/paypal',
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody) as PayPalEvent;

    if (!event.id || !event.event_type) {
      return NextResponse.json({ received: true });
    }

    // Idempotency check
    const eventsCol = getSubCollection('paypal_events');
    const existingEvent = await AdminFirestoreService.get(eventsCol, event.id);
    if (existingEvent) {
      return NextResponse.json({ received: true });
    }

    // Store event for idempotency
    await AdminFirestoreService.set(eventsCol, event.id, {
      eventType: event.event_type,
      resourceId: event.resource?.id ?? null,
      status: event.resource?.status ?? null,
      processedAt: new Date().toISOString(),
    });

    // Handle events
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const captureId = event.resource?.id;
        const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
        const transactionId = orderId ?? captureId;

        if (transactionId) {
          await updateOrderByTransactionId(transactionId, {
            status: 'processing',
            paymentStatus: 'captured',
            'payment.paypalStatus': 'COMPLETED',
            'payment.paypalCaptureId': captureId ?? null,
          });
        }

        logger.info('PayPal payment capture completed', {
          route: '/api/webhooks/paypal',
          captureId,
          orderId,
          amount: event.resource?.amount?.value,
        });
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED': {
        const transactionId = event.resource?.supplementary_data?.related_ids?.order_id
          ?? event.resource?.id;

        if (transactionId) {
          await updateOrderByTransactionId(transactionId, {
            status: 'cancelled',
            paymentStatus: 'failed',
            'payment.paypalStatus': event.event_type,
          });
        }

        logger.warn(`PayPal ${event.event_type}`, {
          route: '/api/webhooks/paypal',
          resourceId: event.resource?.id,
        });
        break;
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        const transactionId = event.resource?.supplementary_data?.related_ids?.order_id
          ?? event.resource?.id;

        if (transactionId) {
          await updateOrderByTransactionId(transactionId, {
            paymentStatus: 'refunded',
            'payment.paypalStatus': 'REFUNDED',
          });
        }

        logger.info('PayPal payment refunded', {
          route: '/api/webhooks/paypal',
          resourceId: event.resource?.id,
          amount: event.resource?.amount?.value,
        });
        break;
      }

      case 'CHECKOUT.ORDER.APPROVED': {
        logger.info('PayPal checkout order approved', {
          route: '/api/webhooks/paypal',
          orderId: event.resource?.id,
        });
        break;
      }

      case 'CUSTOMER.DISPUTE.CREATED':
      case 'CUSTOMER.DISPUTE.RESOLVED': {
        logger.warn(`PayPal ${event.event_type}`, {
          route: '/api/webhooks/paypal',
          disputeId: event.resource?.id,
          status: event.resource?.status,
        });
        break;
      }

      default:
        logger.debug(`PayPal event not handled: ${event.event_type}`, {
          route: '/api/webhooks/paypal',
        });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(
      'PayPal webhook processing error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/webhooks/paypal' },
    );
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function updateOrderByTransactionId(
  transactionId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  try {
    const snapshot = await AdminFirestoreService.collection(ORDERS_PATH)
      .where('payment.transactionId', '==', transactionId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return;
    }

    const orderId = snapshot.docs[0].id;
    await AdminFirestoreService.update(ORDERS_PATH, orderId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to update order from PayPal webhook', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/webhooks/paypal',
      transactionId,
    });
  }
}
