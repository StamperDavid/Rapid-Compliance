import { type NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

// ─── Key Config ──────────────────────────────────────────────────────────────

interface PaddleKeys {
  apiKey?: string;
  webhookSecret?: string;
  mode?: string;
}

// ─── Paddle Webhook Event Types ──────────────────────────────────────────────

interface PaddleEventPayload {
  event_type: string;
  event_id: string;
  occurred_at: string;
  data: {
    id?: string;
    status?: string;
    transaction_id?: string;
    subscription_id?: string;
    customer_id?: string;
    custom_data?: Record<string, string>;
    details?: {
      totals?: {
        total?: string;
        currency_code?: string;
      };
    };
    billing_period?: {
      starts_at?: string;
      ends_at?: string;
    };
    [key: string]: unknown;
  };
}

// ─── Signature Verification ──────────────────────────────────────────────────

function verifyPaddleSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): boolean {
  try {
    // Paddle v2 webhook signature format: ts=TIMESTAMP;h1=HMAC
    const parts = signature.split(';');
    const tsEntry = parts.find((p) => p.startsWith('ts='));
    const h1Entry = parts.find((p) => p.startsWith('h1='));

    if (!tsEntry || !h1Entry) {
      return false;
    }

    const ts = tsEntry.replace('ts=', '');
    const receivedHmac = h1Entry.replace('h1=', '');

    // Compute HMAC-SHA256 of "timestamp:rawBody"
    const signedPayload = `${ts}:${rawBody}`;
    const expectedHmac = createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    // Timing-safe comparison
    const expected = Buffer.from(expectedHmac, 'hex');
    const received = Buffer.from(receivedHmac, 'hex');

    if (expected.length !== received.length) {
      return false;
    }

    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

function handleTransactionCompleted(data: PaddleEventPayload['data']): void {
  const transactionId = data.id;
  if (!transactionId) {
    return;
  }

  // Log for audit — primary order creation happens via /api/checkout/complete
  // The webhook serves as a backup confirmation that the transaction succeeded
  logger.info('Paddle transaction completed', {
    route: '/api/webhooks/paddle',
    transactionId,
    status: data.status,
  });
}

function handleTransactionPaymentFailed(data: PaddleEventPayload['data']): void {
  const transactionId = data.id;
  if (!transactionId) {
    return;
  }

  logger.warn('Paddle transaction payment failed', {
    route: '/api/webhooks/paddle',
    transactionId,
  });
}

async function handleSubscriptionEvent(
  eventType: string,
  data: PaddleEventPayload['data'],
): Promise<void> {
  const subscriptionId = data.id ?? data.subscription_id;
  if (!subscriptionId) {
    return;
  }

  logger.info(`Paddle subscription event: ${eventType}`, {
    route: '/api/webhooks/paddle',
    subscriptionId,
    status: data.status,
  });

  // Map Paddle subscription status to our internal status
  const statusMap: Record<string, string> = {
    active: 'active',
    canceled: 'cancelled',
    past_due: 'past_due',
    paused: 'paused',
    trialing: 'trialing',
  };

  const mappedStatus = data.status ? (statusMap[data.status] ?? data.status) : 'unknown';

  // Store/update subscription status using predictable doc ID based on Paddle subscription ID
  const subscriptionsCol = getSubCollection('subscriptions');
  const docId = `paddle_${subscriptionId}`;

  await AdminFirestoreService.set(subscriptionsCol, docId, {
    providerSubscriptionId: subscriptionId,
    provider: 'paddle',
    status: mappedStatus,
    providerStatus: data.status ?? 'unknown',
    ...(data.billing_period?.ends_at
      ? { currentPeriodEnd: data.billing_period.ends_at }
      : {}),
    ...(data.customer_id ? { customerId: data.customer_id } : {}),
    updatedAt: new Date().toISOString(),
  });
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Get webhook secret
    const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'paddle')) as PaddleKeys | null;
    if (!keys?.webhookSecret) {
      logger.error('Paddle webhook secret not configured', new Error('Missing webhookSecret'), {
        route: '/api/webhooks/paddle',
      });
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    // Verify signature
    const signature = request.headers.get('paddle-signature') ?? '';
    if (!verifyPaddleSignature(rawBody, signature, keys.webhookSecret)) {
      logger.warn('Paddle webhook signature verification failed', {
        route: '/api/webhooks/paddle',
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody) as PaddleEventPayload;

    // Idempotency check — skip if we've already processed this event
    const eventsCol = getSubCollection('paddle_events');
    const existingEvent = await AdminFirestoreService.get(eventsCol, event.event_id);
    if (existingEvent) {
      logger.debug('Paddle webhook event already processed', {
        route: '/api/webhooks/paddle',
        eventId: event.event_id,
      });
      return NextResponse.json({ received: true });
    }

    // Store event for idempotency
    await AdminFirestoreService.set(eventsCol, event.event_id, {
      eventType: event.event_type,
      occurredAt: event.occurred_at,
      processedAt: new Date().toISOString(),
      data: event.data,
    });

    // Route to handler
    switch (event.event_type) {
      case 'transaction.completed':
        handleTransactionCompleted(event.data);
        break;

      case 'transaction.payment_failed':
        handleTransactionPaymentFailed(event.data);
        break;

      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.canceled':
      case 'subscription.past_due':
      case 'subscription.activated':
      case 'subscription.paused':
        await handleSubscriptionEvent(event.event_type, event.data);
        break;

      default:
        logger.debug(`Paddle webhook event type not handled: ${event.event_type}`, {
          route: '/api/webhooks/paddle',
        });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(
      'Paddle webhook processing error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/webhooks/paddle' },
    );
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
