/**
 * Braintree Webhook Handler
 * Processes payment and subscription events from Braintree.
 *
 * Braintree sends webhook notifications as POST with bt_signature and bt_payload
 * form fields. The payload is Base64-encoded XML signed with the webhook's public key.
 *
 * For simplicity (no braintree npm package), we verify using HMAC-SHA1 of the payload
 * against the configured webhook signing key.
 *
 * Events: check, transaction_disbursed, transaction_settled, subscription_*, dispute_*, etc.
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

interface BraintreeKeys {
  merchantId?: string;
  publicKey?: string;
  privateKey?: string;
  webhookPublicKey?: string;
}

// ─── Braintree Webhook Payload (parsed from XML) ────────────────────────────

interface BraintreeWebhookPayload {
  kind: string;
  timestamp: string;
  subject?: {
    transaction?: {
      id?: string;
      status?: string;
      amount?: string;
      currency_iso_code?: string;
      order_id?: string;
    };
    subscription?: {
      id?: string;
      status?: string;
      plan_id?: string;
    };
    dispute?: {
      id?: string;
      status?: string;
      transaction?: {
        id?: string;
        amount?: string;
      };
    };
  };
}

// ─── Signature Verification ─────────────────────────────────────────────────

/**
 * Verify Braintree webhook signature.
 * Braintree sends bt_signature as "public_key|signature" and bt_payload as Base64.
 * We verify: HMAC-SHA1(bt_payload, private_key) matches the signature portion.
 */
function verifyBraintreeSignature(
  btSignature: string,
  btPayload: string,
  publicKey: string,
  privateKey: string,
): boolean {
  try {
    // bt_signature format: "public_key|signature_hash"
    const parts = btSignature.split('|');
    if (parts.length !== 2) {
      return false;
    }

    const [sigPublicKey, signatureHash] = parts;

    // Verify the public key matches
    if (sigPublicKey !== publicKey) {
      return false;
    }

    // Compute HMAC-SHA1 of the payload using the private key
    const expectedHash = createHmac('sha1', privateKey)
      .update(btPayload)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedHash, 'hex');
    const receivedBuf = Buffer.from(signatureHash, 'hex');

    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }

    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

/**
 * Parse Braintree XML payload into a simplified object.
 * Braintree webhooks use XML. We extract key fields without a full XML parser.
 */
function parseBraintreePayload(base64Payload: string): BraintreeWebhookPayload {
  const xml = Buffer.from(base64Payload, 'base64').toString('utf-8');

  const extractTag = (tag: string, source: string): string | undefined => {
    const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
    const match = source.match(regex);
    return match?.[1]?.trim();
  };

  const kind = extractTag('kind', xml) ?? 'unknown';
  const timestamp = extractTag('timestamp', xml) ?? new Date().toISOString();

  const result: BraintreeWebhookPayload = { kind, timestamp };

  // Extract transaction details if present
  const transactionBlock = extractTag('transaction', xml);
  if (transactionBlock) {
    result.subject = {
      transaction: {
        id: extractTag('id', transactionBlock),
        status: extractTag('status', transactionBlock),
        amount: extractTag('amount', transactionBlock),
        currency_iso_code: extractTag('currency-iso-code', transactionBlock),
        order_id: extractTag('order-id', transactionBlock),
      },
    };
  }

  // Extract subscription details if present
  const subscriptionBlock = extractTag('subscription', xml);
  if (subscriptionBlock && !transactionBlock) {
    result.subject = {
      subscription: {
        id: extractTag('id', subscriptionBlock),
        status: extractTag('status', subscriptionBlock),
        plan_id: extractTag('plan-id', subscriptionBlock),
      },
    };
  }

  // Extract dispute details if present
  const disputeBlock = extractTag('dispute', xml);
  if (disputeBlock) {
    const disputeTransaction = extractTag('transaction', disputeBlock);
    result.subject = {
      ...result.subject,
      dispute: {
        id: extractTag('id', disputeBlock),
        status: extractTag('status', disputeBlock),
        transaction: disputeTransaction ? {
          id: extractTag('id', disputeTransaction),
          amount: extractTag('amount', disputeTransaction),
        } : undefined,
      },
    };
  }

  return result;
}

// ─── Route Handler ──────────────────────────────────────────────────────────

const ORDERS_PATH = getOrdersCollection();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const btSignature = formData.get('bt_signature') as string | null;
    const btPayload = formData.get('bt_payload') as string | null;

    if (!btSignature || !btPayload) {
      return NextResponse.json({ error: 'Missing bt_signature or bt_payload' }, { status: 400 });
    }

    // Get keys for verification
    const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'braintree')) as BraintreeKeys | null;

    // Verify signature if keys are configured
    if (keys?.publicKey && keys?.privateKey) {
      if (!verifyBraintreeSignature(btSignature, btPayload, keys.publicKey, keys.privateKey)) {
        logger.warn('Braintree webhook signature verification failed', {
          route: '/api/webhooks/braintree',
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event = parseBraintreePayload(btPayload);

    // Idempotency check
    const eventsCol = getSubCollection('braintree_events');
    const transactionId = event.subject?.transaction?.id
      ?? event.subject?.subscription?.id
      ?? event.subject?.dispute?.id
      ?? `${Date.now()}`;
    const eventId = `${transactionId}_${event.kind}`;

    const existingEvent = await AdminFirestoreService.get(eventsCol, eventId);
    if (existingEvent) {
      return NextResponse.json({ received: true });
    }

    // Store event for idempotency
    await AdminFirestoreService.set(eventsCol, eventId, {
      kind: event.kind,
      transactionId: event.subject?.transaction?.id ?? null,
      subscriptionId: event.subject?.subscription?.id ?? null,
      status: event.subject?.transaction?.status
        ?? event.subject?.subscription?.status
        ?? null,
      processedAt: new Date().toISOString(),
    });

    // Handle events
    switch (event.kind) {
      case 'transaction_settled':
      case 'transaction_settlement_declined': {
        const txn = event.subject?.transaction;
        const isSettled = event.kind === 'transaction_settled';

        if (txn?.id) {
          await updateOrderByTransactionId(txn.id, {
            status: isSettled ? 'processing' : 'cancelled',
            paymentStatus: isSettled ? 'settled' : 'settlement_declined',
            'payment.braintreeStatus': txn.status ?? event.kind,
          });
        }

        if (isSettled) {
          logger.info('Braintree transaction settled', {
            route: '/api/webhooks/braintree',
            transactionId: txn?.id,
            amount: txn?.amount,
          });
        } else {
          logger.warn('Braintree transaction settlement declined', {
            route: '/api/webhooks/braintree',
            transactionId: txn?.id,
          });
        }
        break;
      }

      case 'transaction_disbursed': {
        logger.info('Braintree transaction disbursed', {
          route: '/api/webhooks/braintree',
          transactionId: event.subject?.transaction?.id,
        });
        break;
      }

      case 'dispute_opened':
      case 'dispute_lost':
      case 'dispute_won': {
        const dispute = event.subject?.dispute;
        logger.warn(`Braintree ${event.kind}`, {
          route: '/api/webhooks/braintree',
          disputeId: dispute?.id,
          transactionId: dispute?.transaction?.id,
          status: dispute?.status,
        });
        break;
      }

      case 'subscription_canceled':
      case 'subscription_expired':
      case 'subscription_went_active':
      case 'subscription_went_past_due':
      case 'subscription_charged_successfully':
      case 'subscription_charged_unsuccessfully': {
        const sub = event.subject?.subscription;
        logger.info(`Braintree ${event.kind}`, {
          route: '/api/webhooks/braintree',
          subscriptionId: sub?.id,
          status: sub?.status,
          planId: sub?.plan_id,
        });
        break;
      }

      case 'check':
        // Braintree sends a "check" event to verify the webhook endpoint
        logger.info('Braintree webhook check received', {
          route: '/api/webhooks/braintree',
        });
        break;

      default:
        logger.debug(`Braintree event not handled: ${event.kind}`, {
          route: '/api/webhooks/braintree',
        });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(
      'Braintree webhook processing error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/webhooks/braintree' },
    );
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

/**
 * Find and update an order by its payment.transactionId (Braintree transaction ID).
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
    logger.error('Failed to update order from Braintree webhook', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/webhooks/braintree',
      transactionId,
    });
  }
}
