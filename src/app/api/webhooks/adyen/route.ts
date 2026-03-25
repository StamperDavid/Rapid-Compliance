import { type NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';

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

function handleAuthorisation(
  item: AdyenNotificationItem['NotificationRequestItem'],
): void {
  const success = item.success === 'true';
  logger.info(`Adyen AUTHORISATION ${success ? 'succeeded' : 'failed'}`, {
    route: '/api/webhooks/adyen',
    pspReference: item.pspReference,
    merchantReference: item.merchantReference,
    amount: item.amount?.value,
    currency: item.amount?.currency,
  });
}

function handleCapture(
  item: AdyenNotificationItem['NotificationRequestItem'],
): void {
  logger.info('Adyen CAPTURE received', {
    route: '/api/webhooks/adyen',
    pspReference: item.pspReference,
    originalReference: item.originalReference,
    amount: item.amount?.value,
  });
}

function handleRefund(
  item: AdyenNotificationItem['NotificationRequestItem'],
): void {
  const success = item.success === 'true';
  logger.info(`Adyen REFUND ${success ? 'succeeded' : 'failed'}`, {
    route: '/api/webhooks/adyen',
    pspReference: item.pspReference,
    originalReference: item.originalReference,
    amount: item.amount?.value,
    reason: item.reason,
  });
}

function handleCancellation(
  item: AdyenNotificationItem['NotificationRequestItem'],
): void {
  logger.info('Adyen CANCELLATION received', {
    route: '/api/webhooks/adyen',
    pspReference: item.pspReference,
    originalReference: item.originalReference,
  });
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
          handleAuthorisation(item);
          break;
        case 'CAPTURE':
          handleCapture(item);
          break;
        case 'REFUND':
        case 'REFUND_FAILED':
          handleRefund(item);
          break;
        case 'CANCELLATION':
          handleCancellation(item);
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
