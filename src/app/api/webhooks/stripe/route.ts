/**
 * Stripe Webhook Handler
 * Processes payment events from Stripe and stores them in Firestore
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { verifyStripeSignature } from '@/lib/security/webhook-verification';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

/**
 * Stripe webhook event interface
 */
interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
  created: number;
}

/**
 * Type guard to validate Stripe event structure
 */
function isStripeEvent(value: unknown): value is StripeWebhookEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const event = value as Record<string, unknown>;

  return (
    typeof event.id === 'string' &&
    typeof event.type === 'string' &&
    typeof event.created === 'number' &&
    typeof event.data === 'object' &&
    event.data !== null &&
    typeof (event.data as Record<string, unknown>).object === 'object'
  );
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (high limit for webhooks)
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/webhooks/stripe');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Get Stripe signature header
    const signatureHeader = request.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Fail closed: require webhook secret in production
    if (!webhookSecret) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Stripe webhook secret not configured - skipping verification in development', {
          route: '/api/webhooks/stripe',
        });
      } else {
        logger.error('Stripe webhook secret not configured - rejecting request', new Error('Missing STRIPE_WEBHOOK_SECRET'), {
          route: '/api/webhooks/stripe',
        });
        return NextResponse.json(
          { success: false, error: 'Webhook not configured' },
          { status: 500 }
        );
      }
    } else {
      if (!signatureHeader) {
        logger.warn('Stripe webhook signature header missing', {
          route: '/api/webhooks/stripe',
        });
        return errors.unauthorized('Missing Stripe signature header');
      }

      const isValid = verifyStripeSignature(
        rawBody,
        signatureHeader,
        webhookSecret
      );

      if (!isValid) {
        logger.warn('Stripe webhook signature verification failed', {
          route: '/api/webhooks/stripe',
        });
        return errors.unauthorized('Invalid Stripe signature');
      }

      logger.debug('Stripe webhook signature verified', {
        route: '/api/webhooks/stripe',
      });
    }

    // Parse the verified payload
    const body: unknown = JSON.parse(rawBody);

    if (!isStripeEvent(body)) {
      logger.warn('Invalid Stripe event structure', {
        route: '/api/webhooks/stripe',
        receivedData: JSON.stringify(body),
      });
      return errors.badRequest('Invalid Stripe event structure');
    }

    const event: StripeWebhookEvent = body;

    logger.info('Stripe webhook received', {
      route: '/api/webhooks/stripe',
      eventId: event.id,
      eventType: event.type,
    });

    // Idempotency: check if this event was already processed
    const existingEvent = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/stripe_events`,
      event.id
    );
    if (existingEvent) {
      logger.info('Stripe webhook duplicate event - skipping', {
        route: '/api/webhooks/stripe',
        eventId: event.id,
        eventType: event.type,
      });
      return NextResponse.json({ success: true, duplicate: true });
    }

    // Process the event (wrapped in try-catch to always return 200)
    try {
      await processStripeEvent(event);
    } catch (error) {
      // Log the error but return 200 to prevent Stripe retries
      logger.error(
        'Stripe event processing error',
        error instanceof Error ? error : new Error(String(error)),
        {
          route: '/api/webhooks/stripe',
          eventId: event.id,
          eventType: event.type,
        }
      );
      // Still return success to acknowledge receipt
    }

    return NextResponse.json({
      success: true,
      eventType: event.type,
    });
  } catch (error: unknown) {
    logger.error(
      'Stripe webhook handler error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/webhooks/stripe' }
    );
    // Return 200 even on parsing errors to prevent Stripe retries
    return NextResponse.json({
      success: true,
      note: 'Error logged, acknowledged to prevent retries',
    });
  }
}

/**
 * Process a Stripe webhook event
 */
async function processStripeEvent(event: StripeWebhookEvent): Promise<void> {
  // Store event in Firestore for audit trail
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/stripe_events`,
    event.id,
    {
      id: event.id,
      type: event.type,
      data: event.data,
      created: event.created,
      processedAt: new Date().toISOString(),
    }
  );

  // Handle different event types
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      logger.info('Checkout session completed', {
        route: '/api/webhooks/stripe',
        sessionId: String(session.id ?? ''),
        customerId: String(session.customer ?? ''),
        amount: typeof session.amount_total === 'number' ? session.amount_total : 0,
      });

      // Update order status in Firestore
      if (typeof session.metadata === 'object' && session.metadata !== null) {
        const metadata = session.metadata as Record<string, unknown>;
        const orderId = metadata.orderId;
        if (typeof orderId === 'string') {
          await FirestoreService.update(
            `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/orders`,
            orderId,
            {
              status: 'completed',
              stripeSessionId: String(session.id ?? ''),
              completedAt: new Date().toISOString(),
            }
          );
          logger.info('Order updated to completed', {
            route: '/api/webhooks/stripe',
            orderId,
          });
        }
      }
      break;
    }

    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      logger.info('Payment intent succeeded', {
        route: '/api/webhooks/stripe',
        paymentIntentId: String(paymentIntent.id ?? ''),
        amount: typeof paymentIntent.amount === 'number' ? paymentIntent.amount : 0,
        currency: String(paymentIntent.currency ?? ''),
      });
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object;
      logger.warn('Payment intent failed', {
        route: '/api/webhooks/stripe',
        paymentIntentId: String(paymentIntent.id ?? ''),
        amount: typeof paymentIntent.amount === 'number' ? paymentIntent.amount : 0,
        currency: String(paymentIntent.currency ?? ''),
        lastPaymentError: String(paymentIntent.last_payment_error ?? ''),
      });
      break;
    }

    case 'customer.subscription.created': {
      const subscription = event.data.object;
      logger.info('Subscription created', {
        route: '/api/webhooks/stripe',
        subscriptionId: String(subscription.id ?? ''),
        customerId: String(subscription.customer ?? ''),
        status: String(subscription.status ?? ''),
      });
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      logger.info('Subscription updated', {
        route: '/api/webhooks/stripe',
        subscriptionId: String(subscription.id ?? ''),
        customerId: String(subscription.customer ?? ''),
        status: String(subscription.status ?? ''),
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      logger.warn('Subscription cancelled', {
        route: '/api/webhooks/stripe',
        subscriptionId: String(subscription.id ?? ''),
        customerId: String(subscription.customer ?? ''),
        canceledAt: typeof subscription.canceled_at === 'number' ? subscription.canceled_at : 0,
      });
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      logger.info('Invoice payment succeeded', {
        route: '/api/webhooks/stripe',
        invoiceId: String(invoice.id ?? ''),
        customerId: String(invoice.customer ?? ''),
        amount: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : 0,
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      logger.warn('Invoice payment failed', {
        route: '/api/webhooks/stripe',
        invoiceId: String(invoice.id ?? ''),
        customerId: String(invoice.customer ?? ''),
        amount: typeof invoice.amount_due === 'number' ? invoice.amount_due : 0,
        attemptCount: typeof invoice.attempt_count === 'number' ? invoice.attempt_count : 0,
      });
      break;
    }

    default:
      logger.debug('Unhandled Stripe event type', {
        route: '/api/webhooks/stripe',
        eventType: event.type,
        eventId: event.id,
      });
  }
}
