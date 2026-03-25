import { type NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection, getOrdersCollection } from '@/lib/firebase/collections';

const ORDERS_PATH = getOrdersCollection();

export const dynamic = 'force-dynamic';

// ─── Key Config ──────────────────────────────────────────────────────────────

interface HyperswitchKeys {
  apiKey?: string;
  webhookSecret?: string;
}

// ─── Hyperswitch Event Types ─────────────────────────────────────────────────

interface HyperswitchEventData {
  payment_id?: string;
  refund_id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  error_message?: string;
  metadata?: Record<string, string>;
}

interface HyperswitchEvent {
  event_id: string;
  event_type: string;
  content: {
    object: HyperswitchEventData;
  };
  created_at?: string;
}

// ─── HMAC-SHA512 Verification ────────────────────────────────────────────────

function verifyHyperswitchSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): boolean {
  try {
    const expectedHmac = createHmac('sha512', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expected = Buffer.from(expectedHmac, 'hex');
    const received = Buffer.from(signature, 'hex');

    if (expected.length !== received.length) {
      return false;
    }

    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

async function handlePaymentSucceeded(data: HyperswitchEventData): Promise<void> {
  logger.info('Hyperswitch payment succeeded', {
    route: '/api/webhooks/hyperswitch',
    paymentId: data.payment_id,
    amount: data.amount,
    currency: data.currency,
  });

  if (data.payment_id) {
    await updateOrderByTransactionId(data.payment_id, {
      status: 'processing',
      paymentStatus: 'captured',
      'payment.hyperswitchStatus': 'succeeded',
    });
  }
}

async function handlePaymentFailed(data: HyperswitchEventData): Promise<void> {
  logger.warn('Hyperswitch payment failed', {
    route: '/api/webhooks/hyperswitch',
    paymentId: data.payment_id,
    error: data.error_message,
  });

  if (data.payment_id) {
    await updateOrderByTransactionId(data.payment_id, {
      status: 'cancelled',
      paymentStatus: 'failed',
      'payment.hyperswitchStatus': 'failed',
      'payment.errorMessage': data.error_message ?? null,
    });
  }
}

async function handleRefundSucceeded(data: HyperswitchEventData): Promise<void> {
  logger.info('Hyperswitch refund succeeded', {
    route: '/api/webhooks/hyperswitch',
    refundId: data.refund_id,
    paymentId: data.payment_id,
    amount: data.amount,
  });

  if (data.payment_id) {
    await updateOrderByTransactionId(data.payment_id, {
      paymentStatus: 'refunded',
      'payment.hyperswitchStatus': 'refunded',
      'payment.refundId': data.refund_id ?? null,
    });
  }
}

function handleRefundFailed(data: HyperswitchEventData): void {
  logger.warn('Hyperswitch refund failed', {
    route: '/api/webhooks/hyperswitch',
    refundId: data.refund_id,
    paymentId: data.payment_id,
    error: data.error_message,
  });
}

/**
 * Find and update an order by its payment.transactionId (Hyperswitch payment_id).
 */
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
    logger.error('Failed to update order from Hyperswitch webhook', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/webhooks/hyperswitch',
      transactionId,
    });
  }
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Get webhook secret
    const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'hyperswitch')) as HyperswitchKeys | null;

    // Verify signature if secret is configured
    if (keys?.webhookSecret) {
      const signature = request.headers.get('x-webhook-signature-512') ?? '';
      if (!verifyHyperswitchSignature(rawBody, signature, keys.webhookSecret)) {
        logger.warn('Hyperswitch webhook signature verification failed', {
          route: '/api/webhooks/hyperswitch',
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody) as HyperswitchEvent;

    if (!event.event_id || !event.event_type) {
      return NextResponse.json({ received: true });
    }

    // Idempotency check
    const eventsCol = getSubCollection('hyperswitch_events');
    const existingEvent = await AdminFirestoreService.get(eventsCol, event.event_id);
    if (existingEvent) {
      return NextResponse.json({ received: true });
    }

    // Store event for idempotency
    const eventData = event.content.object;
    await AdminFirestoreService.set(eventsCol, event.event_id, {
      eventType: event.event_type,
      paymentId: eventData.payment_id ?? null,
      refundId: eventData.refund_id ?? null,
      status: eventData.status ?? null,
      processedAt: new Date().toISOString(),
    });

    // Route to handler
    switch (event.event_type) {
      case 'payment_succeeded':
        await handlePaymentSucceeded(eventData);
        break;
      case 'payment_failed':
        await handlePaymentFailed(eventData);
        break;
      case 'refund_succeeded':
        await handleRefundSucceeded(eventData);
        break;
      case 'refund_failed':
        handleRefundFailed(eventData);
        break;
      default:
        logger.debug(`Hyperswitch event not handled: ${event.event_type}`, {
          route: '/api/webhooks/hyperswitch',
        });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(
      'Hyperswitch webhook processing error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/webhooks/hyperswitch' },
    );
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
