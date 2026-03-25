import { type NextRequest, NextResponse } from 'next/server';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

// ─── Key Config ──────────────────────────────────────────────────────────────

interface ChargebeeKeys {
  apiKey?: string;
  webhookSecret?: string;
  siteName?: string;
}

// ─── Chargebee Event Types ───────────────────────────────────────────────────

interface ChargebeeEventContent {
  subscription?: {
    id?: string;
    status?: string;
    plan_id?: string;
    customer_id?: string;
    current_term_end?: number;
    cancelled_at?: number;
  };
  customer?: {
    id?: string;
    email?: string;
  };
  invoice?: {
    id?: string;
    subscription_id?: string;
    total?: number;
    currency_code?: string;
    status?: string;
  };
  transaction?: {
    id?: string;
    amount?: number;
    status?: string;
  };
}

interface ChargebeeEvent {
  id: string;
  event_type: string;
  occurred_at: number;
  content: ChargebeeEventContent;
  webhook_status?: string;
}

// ─── Shared Secret Verification ──────────────────────────────────────────────

function verifyChargebeeWebhook(
  request: NextRequest,
  webhookSecret: string,
): boolean {
  // Chargebee uses Basic Auth for webhook verification
  // The webhook password is sent as the Basic Auth password
  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const decoded = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString();
    // Chargebee sends username:password where password is the webhook secret
    const password = decoded.split(':')[1] ?? '';
    return password === webhookSecret;
  } catch {
    return false;
  }
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

function handleSubscriptionEvent(
  eventType: string,
  content: ChargebeeEventContent,
): void {
  const sub = content.subscription;
  if (!sub?.id) {
    return;
  }

  logger.info(`Chargebee subscription event: ${eventType}`, {
    route: '/api/webhooks/chargebee',
    subscriptionId: sub.id,
    status: sub.status,
    planId: sub.plan_id,
    customerId: sub.customer_id,
  });
}

function handlePaymentEvent(
  eventType: string,
  content: ChargebeeEventContent,
): void {
  const txn = content.transaction;
  logger.info(`Chargebee payment event: ${eventType}`, {
    route: '/api/webhooks/chargebee',
    transactionId: txn?.id,
    amount: txn?.amount,
    status: txn?.status,
  });
}

function handleInvoiceEvent(
  eventType: string,
  content: ChargebeeEventContent,
): void {
  const invoice = content.invoice;
  logger.info(`Chargebee invoice event: ${eventType}`, {
    route: '/api/webhooks/chargebee',
    invoiceId: invoice?.id,
    subscriptionId: invoice?.subscription_id,
    total: invoice?.total,
    currency: invoice?.currency_code,
  });
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Get webhook secret
    const keys = (await apiKeyService.getServiceKey(PLATFORM_ID, 'chargebee')) as ChargebeeKeys | null;

    // Verify webhook authenticity if secret is configured
    if (keys?.webhookSecret) {
      if (!verifyChargebeeWebhook(request, keys.webhookSecret)) {
        logger.warn('Chargebee webhook authentication failed', {
          route: '/api/webhooks/chargebee',
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body: unknown = await request.json();
    const event = body as ChargebeeEvent;

    if (!event.id || !event.event_type) {
      return NextResponse.json({ received: true });
    }

    // Idempotency check
    const eventsCol = getSubCollection('chargebee_events');
    const existingEvent = await AdminFirestoreService.get(eventsCol, event.id);
    if (existingEvent) {
      return NextResponse.json({ received: true });
    }

    // Store event for idempotency
    await AdminFirestoreService.set(eventsCol, event.id, {
      eventType: event.event_type,
      occurredAt: event.occurred_at,
      processedAt: new Date().toISOString(),
      subscriptionId: event.content.subscription?.id ?? null,
      customerId: event.content.customer?.id ?? null,
    });

    // Route to handler by event category
    const eventType = event.event_type;

    if (eventType.startsWith('subscription_')) {
      handleSubscriptionEvent(eventType, event.content);
    } else if (eventType.startsWith('payment_')) {
      handlePaymentEvent(eventType, event.content);
    } else if (eventType.startsWith('invoice_')) {
      handleInvoiceEvent(eventType, event.content);
    } else {
      logger.debug(`Chargebee event not handled: ${eventType}`, {
        route: '/api/webhooks/chargebee',
      });
    }

    // Store subscription status update if present
    if (event.content.subscription?.id && event.content.subscription.status) {
      const sub = event.content.subscription;
      const subscriptionsCol = getSubCollection('subscriptions');
      const docId = `chargebee_${sub.id}`;

      await AdminFirestoreService.set(subscriptionsCol, docId, {
        providerSubscriptionId: sub.id,
        provider: 'chargebee',
        status: sub.status,
        planId: sub.plan_id ?? null,
        customerId: sub.customer_id ?? null,
        ...(sub.current_term_end
          ? { currentPeriodEnd: new Date(sub.current_term_end * 1000).toISOString() }
          : {}),
        ...(sub.cancelled_at
          ? { cancelledAt: new Date(sub.cancelled_at * 1000).toISOString() }
          : {}),
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(
      'Chargebee webhook processing error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/webhooks/chargebee' },
    );
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
