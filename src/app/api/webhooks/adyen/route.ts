import { type NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection, getOrdersCollection } from '@/lib/firebase/collections';

const ORDERS_PATH = getOrdersCollection();

export const dynamic = 'force-dynamic';

// ─── Key Config ──────────────────────────────────────────────────────────────

interface AdyenKeys {
  apiKey?: string;
  hmacKey?: string;
  merchantAccount?: string;
}

// ─── Adyen Notification Shapes ───────────────────────────────────────────────

interface AdyenNotificationAmount {
  value?: number;
  currency?: string;
}

interface AdyenNotificationItem {
  NotificationRequestItem: {
    eventCode: string;
    pspReference: string;
    originalReference?: string;
    merchantReference?: string;
    merchantAccountCode?: string;
    success: string;
    amount?: AdyenNotificationAmount;
    reason?: string;
    additionalData?: Record<string, string>;
  };
}

interface AdyenNotificationPayload {
  live: string;
  notificationItems: AdyenNotificationItem[];
}

// ─── HMAC Verification ───────────────────────────────────────────────────────

function computeAdyenHmac(
  notificationItem: AdyenNotificationItem['NotificationRequestItem'],
  hmacKey: string,
): string {
  // Adyen HMAC signature payload: concatenation of specific fields separated by ':'
  const signedFields = [
    notificationItem.pspReference,
    notificationItem.originalReference ?? '',
    notificationItem.merchantAccountCode ?? '',
    notificationItem.merchantReference ?? '',
    String(notificationItem.amount?.value ?? 0),
    notificationItem.amount?.currency ?? '',
    notificationItem.eventCode,
    notificationItem.success,
  ].join(':');

  const keyBytes = Buffer.from(hmacKey, 'hex');
  return createHmac('sha256', keyBytes)
    .update(signedFields)
    .digest('base64');
}

function verifyAdyenHmac(
  notificationItem: AdyenNotificationItem['NotificationRequestItem'],
  hmacKey: string,
): boolean {
  try {
    const additionalHmac = notificationItem.additionalData?.hmacSignature;
    if (!additionalHmac) {
      return false;
    }

    const computed = computeAdyenHmac(notificationItem, hmacKey);
    return computed === additionalHmac;
  } catch {
    return false;
  }
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

async function handleAuthorisation(
  item: AdyenNotificationItem['NotificationRequestItem'],
): Promise<void> {
  const success = item.success === 'true';
  logger.info(`Adyen AUTHORISATION ${success ? 'succeeded' : 'failed'}`, {
    route: '/api/webhooks/adyen',
    pspReference: item.pspReference,
    merchantReference: item.merchantReference,
    amount: item.amount?.value,
    currency: item.amount?.currency,
  });

  // Update order status based on authorisation result
  const transactionId = item.pspReference;
  if (success) {
    await updateOrderByTransactionId(transactionId, {
      status: 'processing',
      paymentStatus: 'authorized',
      'payment.adyenStatus': 'AUTHORISED',
      'payment.adyenPspReference': item.pspReference,
    });
  } else {
    await updateOrderByTransactionId(transactionId, {
      status: 'cancelled',
      paymentStatus: 'failed',
      'payment.adyenStatus': 'REFUSED',
      'payment.adyenReason': item.reason ?? null,
    });
  }
}

async function handleCapture(
  item: AdyenNotificationItem['NotificationRequestItem'],
): Promise<void> {
  logger.info('Adyen CAPTURE received', {
    route: '/api/webhooks/adyen',
    pspReference: item.pspReference,
    originalReference: item.originalReference,
    amount: item.amount?.value,
  });

  // CAPTURE uses originalReference as the original payment's pspReference
  const transactionId = item.originalReference ?? item.pspReference;
  await updateOrderByTransactionId(transactionId, {
    status: 'processing',
    paymentStatus: 'captured',
    'payment.adyenStatus': 'CAPTURED',
  });
}

async function handleRefund(
  item: AdyenNotificationItem['NotificationRequestItem'],
): Promise<void> {
  const success = item.success === 'true';
  logger.info(`Adyen REFUND ${success ? 'succeeded' : 'failed'}`, {
    route: '/api/webhooks/adyen',
    pspReference: item.pspReference,
    originalReference: item.originalReference,
    amount: item.amount?.value,
    reason: item.reason,
  });

  if (success && item.originalReference) {
    await updateOrderByTransactionId(item.originalReference, {
      paymentStatus: 'refunded',
      'payment.adyenStatus': 'REFUNDED',
      'payment.refundReference': item.pspReference,
    });
  }
}

async function handleCancellation(
  item: AdyenNotificationItem['NotificationRequestItem'],
): Promise<void> {
  logger.info('Adyen CANCELLATION received', {
    route: '/api/webhooks/adyen',
    pspReference: item.pspReference,
    originalReference: item.originalReference,
  });

  const transactionId = item.originalReference ?? item.pspReference;
  await updateOrderByTransactionId(transactionId, {
    status: 'cancelled',
    paymentStatus: 'cancelled',
    'payment.adyenStatus': 'CANCELLED',
  });
}

/**
 * Find and update an order by its payment.transactionId (Adyen pspReference).
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
    logger.error('Failed to update order from Adyen webhook', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/webhooks/adyen',
      transactionId,
    });
  }
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const payload = body as AdyenNotificationPayload;

    if (!payload.notificationItems?.length) {
      // Adyen requires [accepted] response even for empty/malformed requests
      return new NextResponse('[accepted]', { status: 200 });
    }

    // Get HMAC key for verification
    const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'adyen')) as AdyenKeys | null;
    const hmacKey = keys?.hmacKey;

    const eventsCol = getSubCollection('adyen_events');

    // Process each notification item in the batch
    for (const notificationItem of payload.notificationItems) {
      const item = notificationItem.NotificationRequestItem;

      // Verify HMAC if configured
      if (hmacKey && !verifyAdyenHmac(item, hmacKey)) {
        logger.warn('Adyen webhook HMAC verification failed', {
          route: '/api/webhooks/adyen',
          pspReference: item.pspReference,
          eventCode: item.eventCode,
        });
        continue;
      }

      // Idempotency check
      const eventId = `${item.pspReference}_${item.eventCode}`;
      const existingEvent = await AdminFirestoreService.get(eventsCol, eventId);
      if (existingEvent) {
        continue;
      }

      // Store event for idempotency
      await AdminFirestoreService.set(eventsCol, eventId, {
        eventCode: item.eventCode,
        pspReference: item.pspReference,
        originalReference: item.originalReference ?? null,
        merchantReference: item.merchantReference ?? null,
        success: item.success,
        amount: item.amount ?? null,
        processedAt: new Date().toISOString(),
      });

      // Route to handler
      switch (item.eventCode) {
        case 'AUTHORISATION':
          await handleAuthorisation(item);
          break;
        case 'CAPTURE':
          await handleCapture(item);
          break;
        case 'REFUND':
        case 'REFUND_FAILED':
          await handleRefund(item);
          break;
        case 'CANCELLATION':
          await handleCancellation(item);
          break;
        default:
          logger.debug(`Adyen event not handled: ${item.eventCode}`, {
            route: '/api/webhooks/adyen',
            pspReference: item.pspReference,
          });
      }
    }

    // Adyen requires the literal string "[accepted]" in the response body
    return new NextResponse('[accepted]', { status: 200 });
  } catch (error) {
    logger.error(
      'Adyen webhook processing error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/webhooks/adyen' },
    );
    // Still return [accepted] to prevent Adyen from retrying
    return new NextResponse('[accepted]', { status: 200 });
  }
}
