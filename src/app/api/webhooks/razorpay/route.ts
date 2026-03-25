/**
 * Razorpay Webhook Handler
 * Processes payment and refund events from Razorpay.
 *
 * Razorpay sends JSON POST with X-Razorpay-Signature header (HMAC-SHA256).
 * Events: payment.authorized, payment.captured, payment.failed, refund.created, etc.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection, getOrdersCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

// ─── Key Config ──────────────────────────────────────────────────────────────

interface RazorpayKeys {
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
}

// ─── Event Shapes ────────────────────────────────────────────────────────────

interface RazorpayPaymentEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  method?: string;
  email?: string;
  error_code?: string;
  error_description?: string;
  notes?: Record<string, string>;
}

interface RazorpayRefundEntity {
  id?: string;
  payment_id?: string;
  amount?: number;
  status?: string;
}

interface RazorpayEvent {
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    refund?: { entity: RazorpayRefundEntity };
  };
  account_id?: string;
  created_at?: number;
}

// ─── Signature Verification ─────────────────────────────────────────────────

function verifyRazorpaySignature(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): boolean {
  try {
    const expected = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(signature, 'hex');

    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }

    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

// ─── Route Handler ──────────────────────────────────────────────────────────

const ORDERS_PATH = getOrdersCollection();

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Get webhook secret
    const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'razorpay')) as RazorpayKeys | null;

    // Verify signature if configured
    if (keys?.webhookSecret) {
      const signature = request.headers.get('x-razorpay-signature') ?? '';
      if (!verifyRazorpaySignature(rawBody, signature, keys.webhookSecret)) {
        logger.warn('Razorpay webhook signature verification failed', {
          route: '/api/webhooks/razorpay',
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody) as RazorpayEvent;

    if (!event.event) {
      return NextResponse.json({ received: true });
    }

    // Idempotency check
    const eventsCol = getSubCollection('razorpay_events');
    const paymentEntity = event.payload.payment?.entity;
    const refundEntity = event.payload.refund?.entity;
    const entityId = paymentEntity?.id ?? refundEntity?.id ?? `${Date.now()}`;
    const eventId = `${entityId}_${event.event}`;

    const existingEvent = await AdminFirestoreService.get(eventsCol, eventId);
    if (existingEvent) {
      return NextResponse.json({ received: true });
    }

    // Store event for idempotency
    await AdminFirestoreService.set(eventsCol, eventId, {
      event: event.event,
      paymentId: paymentEntity?.id ?? null,
      refundId: refundEntity?.id ?? null,
      status: paymentEntity?.status ?? refundEntity?.status ?? null,
      processedAt: new Date().toISOString(),
    });

    // Handle events
    switch (event.event) {
      case 'payment.captured': {
        if (paymentEntity?.order_id) {
          await updateOrderByTransactionId(paymentEntity.order_id, {
            status: 'processing',
            paymentStatus: 'captured',
            'payment.razorpayStatus': 'captured',
            'payment.razorpayPaymentId': paymentEntity.id ?? null,
          });
        }
        logger.info('Razorpay payment captured', {
          route: '/api/webhooks/razorpay',
          paymentId: paymentEntity?.id,
          orderId: paymentEntity?.order_id,
          amount: paymentEntity?.amount,
        });
        break;
      }

      case 'payment.authorized': {
        logger.info('Razorpay payment authorized (awaiting capture)', {
          route: '/api/webhooks/razorpay',
          paymentId: paymentEntity?.id,
          orderId: paymentEntity?.order_id,
        });
        break;
      }

      case 'payment.failed': {
        if (paymentEntity?.order_id) {
          await updateOrderByTransactionId(paymentEntity.order_id, {
            status: 'cancelled',
            paymentStatus: 'failed',
            'payment.razorpayStatus': 'failed',
            'payment.errorDescription': paymentEntity.error_description ?? null,
          });
        }
        logger.warn('Razorpay payment failed', {
          route: '/api/webhooks/razorpay',
          paymentId: paymentEntity?.id,
          error: paymentEntity?.error_description,
        });
        break;
      }

      case 'refund.created':
      case 'refund.processed': {
        logger.info(`Razorpay ${event.event}`, {
          route: '/api/webhooks/razorpay',
          refundId: refundEntity?.id,
          paymentId: refundEntity?.payment_id,
          amount: refundEntity?.amount,
          status: refundEntity?.status,
        });
        break;
      }

      case 'refund.failed': {
        logger.warn('Razorpay refund failed', {
          route: '/api/webhooks/razorpay',
          refundId: refundEntity?.id,
          paymentId: refundEntity?.payment_id,
        });
        break;
      }

      default:
        logger.debug(`Razorpay event not handled: ${event.event}`, {
          route: '/api/webhooks/razorpay',
        });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(
      'Razorpay webhook processing error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/webhooks/razorpay' },
    );
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

/**
 * Find and update an order by its payment.transactionId (Razorpay order_id).
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
    logger.error('Failed to update order from Razorpay webhook', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/webhooks/razorpay',
      transactionId,
    });
  }
}
