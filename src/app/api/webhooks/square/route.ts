/**
 * Square Webhook Handler
 * Processes payment and refund events from Square.
 *
 * Square sends JSON POST with X-Square-Hmacsha256-Signature header.
 * Signature = HMAC-SHA256(notification_url + body, signature_key).
 *
 * Events: payment.completed, payment.updated, refund.created, refund.updated, etc.
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

interface SquareKeys {
  accessToken?: string;
  webhookSignatureKey?: string;
  locationId?: string;
}

// ─── Event Shapes ────────────────────────────────────────────────────────────

interface SquarePaymentData {
  id?: string;
  status?: string;
  amount_money?: { amount?: number; currency?: string };
  order_id?: string;
  reference_id?: string;
  card_details?: {
    card?: { last_4?: string; card_brand?: string };
  };
}

interface SquareRefundData {
  id?: string;
  status?: string;
  payment_id?: string;
  amount_money?: { amount?: number; currency?: string };
}

interface SquareEvent {
  merchant_id?: string;
  type: string;
  event_id: string;
  created_at?: string;
  data?: {
    type?: string;
    id?: string;
    object?: {
      payment?: SquarePaymentData;
      refund?: SquareRefundData;
    };
  };
}

// ─── Signature Verification ─────────────────────────────────────────────────

function verifySquareSignature(
  rawBody: string,
  signature: string,
  signatureKey: string,
  notificationUrl: string,
): boolean {
  try {
    // Square signs: HMAC-SHA256(notification_url + body, signature_key)
    const payload = notificationUrl + rawBody;
    const expectedSignature = createHmac('sha256', signatureKey)
      .update(payload)
      .digest('base64');

    const expectedBuf = Buffer.from(expectedSignature);
    const receivedBuf = Buffer.from(signature);

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
    const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'square')) as SquareKeys | null;

    // Verify signature if key is configured
    if (keys?.webhookSignatureKey) {
      const signature = request.headers.get('x-square-hmacsha256-signature') ?? '';
      const notificationUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/webhooks/square`;

      if (!verifySquareSignature(rawBody, signature, keys.webhookSignatureKey, notificationUrl)) {
        logger.warn('Square webhook signature verification failed', {
          route: '/api/webhooks/square',
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody) as SquareEvent;

    if (!event.event_id || !event.type) {
      return NextResponse.json({ received: true });
    }

    // Idempotency check
    const eventsCol = getSubCollection('square_events');
    const existingEvent = await AdminFirestoreService.get(eventsCol, event.event_id);
    if (existingEvent) {
      return NextResponse.json({ received: true });
    }

    // Store event for idempotency
    await AdminFirestoreService.set(eventsCol, event.event_id, {
      eventType: event.type,
      dataId: event.data?.id ?? null,
      processedAt: new Date().toISOString(),
    });

    // Handle events
    switch (event.type) {
      case 'payment.completed': {
        const payment = event.data?.object?.payment;
        const transactionId = payment?.id;

        if (transactionId) {
          await updateOrderByTransactionId(transactionId, {
            status: 'processing',
            paymentStatus: 'captured',
            'payment.squareStatus': 'COMPLETED',
          });
        }

        logger.info('Square payment completed', {
          route: '/api/webhooks/square',
          paymentId: payment?.id,
          orderId: payment?.order_id,
          amount: payment?.amount_money?.amount,
        });
        break;
      }

      case 'payment.updated': {
        const payment = event.data?.object?.payment;
        if (payment?.id && payment.status === 'FAILED') {
          await updateOrderByTransactionId(payment.id, {
            status: 'cancelled',
            paymentStatus: 'failed',
            'payment.squareStatus': 'FAILED',
          });
        }

        logger.info('Square payment updated', {
          route: '/api/webhooks/square',
          paymentId: payment?.id,
          status: payment?.status,
        });
        break;
      }

      case 'refund.created':
      case 'refund.updated': {
        const refund = event.data?.object?.refund;

        if (refund?.payment_id && refund.status === 'COMPLETED') {
          await updateOrderByTransactionId(refund.payment_id, {
            paymentStatus: 'refunded',
            'payment.squareStatus': 'REFUNDED',
            'payment.refundId': refund.id ?? null,
          });
        }

        logger.info(`Square ${event.type}`, {
          route: '/api/webhooks/square',
          refundId: refund?.id,
          paymentId: refund?.payment_id,
          status: refund?.status,
        });
        break;
      }

      default:
        logger.debug(`Square event not handled: ${event.type}`, {
          route: '/api/webhooks/square',
        });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(
      'Square webhook processing error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/webhooks/square' },
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
    logger.error('Failed to update order from Square webhook', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/webhooks/square',
      transactionId,
    });
  }
}
