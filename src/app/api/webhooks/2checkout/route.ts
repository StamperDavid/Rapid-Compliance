/**
 * 2Checkout (Verifone) Webhook Handler
 * Processes Instant Notification Service (INS) events from 2Checkout.
 *
 * 2Checkout sends POST with HMAC-MD5 signature in the payload.
 * The hash is computed over specific ordered fields using the secret word.
 *
 * Events: ORDER_CREATED, FRAUD_STATUS_CHANGED, INVOICE_STATUS_CHANGED,
 *         REFUND_ISSUED, CHARGEBACK, etc.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection, getOrdersCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

// ─── Key Config ──────────────────────────────────────────────────────────────

interface TwoCheckoutKeys {
  merchantCode?: string;
  secretKey?: string;
  secretWord?: string;
}

// ─── INS Notification Shape ─────────────────────────────────────────────────

interface TwoCheckoutNotification {
  HASH?: string;
  REFNO?: string;
  ORDERNO?: string;
  ORDERSTATUS?: string;
  REFUNDNO?: string;
  IPN_PID?: string[];
  IPN_PNAME?: string[];
  IPN_DATE?: string;
  FIRSTNAME?: string;
  LASTNAME?: string;
  EMAIL?: string;
  CURRENCY?: string;
  IPN_TOTALGENERAL?: string;
  message_type?: string;
  // INS notification type field
  NOTIFICATION_TYPE?: string;
}

// ─── Signature Verification ─────────────────────────────────────────────────

/**
 * Verify 2Checkout INS notification hash.
 * 2Checkout sends an MD5 HMAC hash computed over field lengths + values.
 */
function verify2CheckoutHash(
  params: TwoCheckoutNotification,
  secretKey: string,
): boolean {
  try {
    if (!params.HASH) {
      return false;
    }

    // 2Checkout INS hash: HMAC-MD5 over concatenated "length + value" pairs
    // For IPN, the hash is over specific fields in specific order
    const fields = [
      params.IPN_PID?.join('') ?? '',
      params.IPN_PNAME?.join('') ?? '',
      params.IPN_DATE ?? '',
      params.IPN_TOTALGENERAL ?? '',
    ];

    let hashString = '';
    for (const field of fields) {
      hashString += String(field.length) + field;
    }

    const expectedHash = createHmac('md5', secretKey)
      .update(hashString)
      .digest('hex');

    return expectedHash.toUpperCase() === (params.HASH ?? '').toUpperCase();
  } catch {
    return false;
  }
}

// ─── Route Handler ──────────────────────────────────────────────────────────

const ORDERS_PATH = getOrdersCollection();

export async function POST(request: NextRequest) {
  try {
    // 2Checkout sends form-encoded data for INS notifications
    const formData = await request.formData();
    const params: TwoCheckoutNotification = {};

    // Extract all form fields
    for (const [key, value] of formData.entries()) {
      if (key === 'IPN_PID[]' || key === 'IPN_PID') {
        params.IPN_PID ??= [];
        params.IPN_PID.push(String(value));
      } else if (key === 'IPN_PNAME[]' || key === 'IPN_PNAME') {
        params.IPN_PNAME ??= [];
        params.IPN_PNAME.push(String(value));
      } else {
        (params as Record<string, unknown>)[key] = String(value);
      }
    }

    const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, '2checkout')) as TwoCheckoutKeys | null;

    // Verify hash if secret key is configured
    if (keys?.secretKey && params.HASH) {
      if (!verify2CheckoutHash(params, keys.secretKey)) {
        logger.warn('2Checkout webhook hash verification failed', {
          route: '/api/webhooks/2checkout',
        });
        return NextResponse.json({ error: 'Invalid hash' }, { status: 401 });
      }
    }

    const notificationType = params.NOTIFICATION_TYPE ?? params.message_type ?? 'UNKNOWN';
    const refNo = params.REFNO ?? `2co_${Date.now()}`;
    const eventId = `${refNo}_${notificationType}`;

    // Idempotency check
    const eventsCol = getSubCollection('2checkout_events');
    const existingEvent = await AdminFirestoreService.get(eventsCol, eventId);
    if (existingEvent) {
      // 2Checkout expects specific response to stop retrying
      return new NextResponse(`<EPAYMENT>${params.IPN_DATE ?? ''}|${createHmac('md5', keys?.secretKey ?? '').update(params.IPN_DATE ?? '').digest('hex')}</EPAYMENT>`, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Store event for idempotency
    await AdminFirestoreService.set(eventsCol, eventId, {
      notificationType,
      refNo,
      orderNo: params.ORDERNO ?? null,
      orderStatus: params.ORDERSTATUS ?? null,
      processedAt: new Date().toISOString(),
    });

    // Handle notification types
    switch (notificationType) {
      case 'ORDER_CREATED': {
        if (refNo) {
          await updateOrderByTransactionId(refNo, {
            status: 'processing',
            paymentStatus: 'captured',
            'payment.twoCheckoutStatus': 'ORDER_CREATED',
            'payment.twoCheckoutRefNo': refNo,
          });
        }

        logger.info('2Checkout order created', {
          route: '/api/webhooks/2checkout',
          refNo,
          orderNo: params.ORDERNO,
          total: params.IPN_TOTALGENERAL,
        });
        break;
      }

      case 'FRAUD_STATUS_CHANGED': {
        const status = params.ORDERSTATUS;
        if (refNo && status === 'CANCELED') {
          await updateOrderByTransactionId(refNo, {
            status: 'cancelled',
            paymentStatus: 'fraud_cancelled',
            'payment.twoCheckoutStatus': 'FRAUD_CANCELED',
          });
        }

        logger.warn('2Checkout fraud status changed', {
          route: '/api/webhooks/2checkout',
          refNo,
          orderStatus: status,
        });
        break;
      }

      case 'INVOICE_STATUS_CHANGED': {
        const status = params.ORDERSTATUS;
        if (refNo && (status === 'CANCELED' || status === 'REVERSED')) {
          await updateOrderByTransactionId(refNo, {
            status: 'cancelled',
            paymentStatus: status === 'REVERSED' ? 'reversed' : 'cancelled',
            'payment.twoCheckoutStatus': status,
          });
        }

        logger.info('2Checkout invoice status changed', {
          route: '/api/webhooks/2checkout',
          refNo,
          orderStatus: status,
        });
        break;
      }

      case 'REFUND_ISSUED': {
        if (refNo) {
          await updateOrderByTransactionId(refNo, {
            paymentStatus: 'refunded',
            'payment.twoCheckoutStatus': 'REFUNDED',
            'payment.refundNo': params.REFUNDNO ?? null,
          });
        }

        logger.info('2Checkout refund issued', {
          route: '/api/webhooks/2checkout',
          refNo,
          refundNo: params.REFUNDNO,
        });
        break;
      }

      case 'CHARGEBACK': {
        logger.warn('2Checkout chargeback received', {
          route: '/api/webhooks/2checkout',
          refNo,
        });
        break;
      }

      default:
        logger.debug(`2Checkout notification not handled: ${notificationType}`, {
          route: '/api/webhooks/2checkout',
          refNo,
        });
    }

    // 2Checkout expects a specific XML response to acknowledge receipt
    const ipnDate = params.IPN_DATE ?? '';
    const responseHash = createHmac('md5', keys?.secretKey ?? '')
      .update(ipnDate)
      .digest('hex');

    return new NextResponse(`<EPAYMENT>${ipnDate}|${responseHash}</EPAYMENT>`, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    logger.error(
      '2Checkout webhook processing error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/webhooks/2checkout' },
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
    logger.error('Failed to update order from 2Checkout webhook', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/webhooks/2checkout',
      transactionId,
    });
  }
}
