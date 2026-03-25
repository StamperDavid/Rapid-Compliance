/**
 * Authorize.Net Webhook Handler
 * Processes payment and fraud events from Authorize.Net.
 *
 * Authorize.Net sends JSON POST with X-ANET-Signature header.
 * Signature = SHA-512 HMAC of the raw body using the webhook signature key.
 * Header format: "sha512=<hex-encoded-hash>"
 *
 * Events: net.authorize.payment.authcapture.created, net.authorize.payment.void.created, etc.
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

interface AuthorizeNetKeys {
  apiLoginId?: string;
  transactionKey?: string;
  signatureKey?: string;
}

// ─── Event Shapes ────────────────────────────────────────────────────────────

interface AuthorizeNetPayload {
  notificationId?: string;
  eventType?: string;
  eventDate?: string;
  webhookId?: string;
  payload?: {
    id?: string;
    responseCode?: number;
    authCode?: string;
    authAmount?: number;
    entityName?: string;
    invoiceNumber?: string;
  };
}

// ─── Signature Verification ─────────────────────────────────────────────────

function verifyAuthorizeNetSignature(
  rawBody: string,
  signatureHeader: string,
  signatureKey: string,
): boolean {
  try {
    // Header format: "sha512=<hex>"
    const providedHash = signatureHeader.replace('sha512=', '').toUpperCase();

    const expectedHash = createHmac('sha512', signatureKey)
      .update(rawBody)
      .digest('hex')
      .toUpperCase();

    const expectedBuf = Buffer.from(expectedHash);
    const receivedBuf = Buffer.from(providedHash);

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
    const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'authorizenet')) as AuthorizeNetKeys | null;

    // Verify signature if key is configured
    if (keys?.signatureKey) {
      const signatureHeader = request.headers.get('x-anet-signature') ?? '';
      if (!verifyAuthorizeNetSignature(rawBody, signatureHeader, keys.signatureKey)) {
        logger.warn('Authorize.Net webhook signature verification failed', {
          route: '/api/webhooks/authorizenet',
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody) as AuthorizeNetPayload;

    if (!event.notificationId || !event.eventType) {
      return NextResponse.json({ received: true });
    }

    // Idempotency check
    const eventsCol = getSubCollection('authorizenet_events');
    const existingEvent = await AdminFirestoreService.get(eventsCol, event.notificationId);
    if (existingEvent) {
      return NextResponse.json({ received: true });
    }

    // Store event for idempotency
    await AdminFirestoreService.set(eventsCol, event.notificationId, {
      eventType: event.eventType,
      transactionId: event.payload?.id ?? null,
      responseCode: event.payload?.responseCode ?? null,
      processedAt: new Date().toISOString(),
    });

    // Handle events
    switch (event.eventType) {
      case 'net.authorize.payment.authcapture.created': {
        const transactionId = event.payload?.id;
        if (transactionId) {
          await updateOrderByTransactionId(transactionId, {
            status: 'processing',
            paymentStatus: 'captured',
            'payment.authNetStatus': 'authcapture',
            'payment.authNetTransactionId': transactionId,
          });
        }

        logger.info('Authorize.Net auth+capture created', {
          route: '/api/webhooks/authorizenet',
          transactionId,
          authAmount: event.payload?.authAmount,
        });
        break;
      }

      case 'net.authorize.payment.authorization.created': {
        logger.info('Authorize.Net authorization created (awaiting capture)', {
          route: '/api/webhooks/authorizenet',
          transactionId: event.payload?.id,
        });
        break;
      }

      case 'net.authorize.payment.capture.created': {
        const transactionId = event.payload?.id;
        if (transactionId) {
          await updateOrderByTransactionId(transactionId, {
            status: 'processing',
            paymentStatus: 'captured',
            'payment.authNetStatus': 'captured',
          });
        }

        logger.info('Authorize.Net capture created', {
          route: '/api/webhooks/authorizenet',
          transactionId,
        });
        break;
      }

      case 'net.authorize.payment.void.created': {
        const transactionId = event.payload?.id;
        if (transactionId) {
          await updateOrderByTransactionId(transactionId, {
            status: 'cancelled',
            paymentStatus: 'voided',
            'payment.authNetStatus': 'voided',
          });
        }

        logger.info('Authorize.Net void created', {
          route: '/api/webhooks/authorizenet',
          transactionId,
        });
        break;
      }

      case 'net.authorize.payment.refund.created': {
        const transactionId = event.payload?.id;
        if (transactionId) {
          await updateOrderByTransactionId(transactionId, {
            paymentStatus: 'refunded',
            'payment.authNetStatus': 'refunded',
          });
        }

        logger.info('Authorize.Net refund created', {
          route: '/api/webhooks/authorizenet',
          transactionId,
        });
        break;
      }

      case 'net.authorize.payment.fraud.held': {
        logger.warn('Authorize.Net fraud hold', {
          route: '/api/webhooks/authorizenet',
          transactionId: event.payload?.id,
        });
        break;
      }

      case 'net.authorize.payment.fraud.declined': {
        const transactionId = event.payload?.id;
        if (transactionId) {
          await updateOrderByTransactionId(transactionId, {
            status: 'cancelled',
            paymentStatus: 'fraud_declined',
            'payment.authNetStatus': 'fraud_declined',
          });
        }

        logger.warn('Authorize.Net fraud decline', {
          route: '/api/webhooks/authorizenet',
          transactionId,
        });
        break;
      }

      default:
        logger.debug(`Authorize.Net event not handled: ${event.eventType}`, {
          route: '/api/webhooks/authorizenet',
        });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(
      'Authorize.Net webhook processing error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/webhooks/authorizenet' },
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
    logger.error('Failed to update order from Authorize.Net webhook', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/webhooks/authorizenet',
      transactionId,
    });
  }
}
