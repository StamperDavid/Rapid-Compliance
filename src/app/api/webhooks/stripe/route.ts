/**
 * Stripe Webhook Handler
 * Processes payment events from Stripe and stores them in Firestore
 *
 * MAJ-1: Subscription webhooks now fully processed (create/update/cancel)
 * MAJ-2: Processing errors return 500 for Stripe retry; permanent failures return 200
 * MAJ-10: charge.refunded tracked for revenue analytics accuracy
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { verifyStripeSignature } from '@/lib/security/webhook-verification';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { where, limit } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

const EVENTS_PATH = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/stripe_events`;
const SUBSCRIPTIONS_PATH = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/subscriptions`;
const ORDERS_PATH = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/orders`;

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

/**
 * Find user subscription by Stripe subscription ID
 */
async function findUserSubscription(
  stripeSubscriptionId: string
): Promise<Record<string, unknown> | null> {
  try {
    const results = await FirestoreService.getAll<Record<string, unknown>>(
      SUBSCRIPTIONS_PATH,
      [where('stripeSubscriptionId', '==', stripeSubscriptionId), limit(1)]
    );
    return results.length > 0 ? results[0] ?? null : null;
  } catch {
    return null;
  }
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
    const existingEvent = await FirestoreService.get<{ processed?: boolean }>(
      EVENTS_PATH,
      event.id
    );
    if (existingEvent?.processed) {
      logger.info('Stripe webhook duplicate event - skipping', {
        route: '/api/webhooks/stripe',
        eventId: event.id,
        eventType: event.type,
      });
      return NextResponse.json({ success: true, duplicate: true });
    }

    // Store event as received before processing
    await FirestoreService.set(EVENTS_PATH, event.id, {
      id: event.id,
      type: event.type,
      data: event.data,
      created: event.created,
      receivedAt: new Date().toISOString(),
      processed: false,
    });

    // Process the event — return 500 on failure so Stripe retries
    try {
      await processStripeEvent(event);

      // Mark event as successfully processed
      await FirestoreService.update(EVENTS_PATH, event.id, {
        processed: true,
        processedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        'Stripe event processing error — will be retried',
        error instanceof Error ? error : new Error(String(error)),
        {
          route: '/api/webhooks/stripe',
          eventId: event.id,
          eventType: event.type,
        }
      );
      // Return 500 so Stripe retries; idempotency check prevents double-processing
      return NextResponse.json(
        { success: false, error: 'Event processing failed' },
        { status: 500 }
      );
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
    // Return 200 for permanent failures (bad payload) to prevent futile retries
    return NextResponse.json({
      success: false,
      error: 'Webhook handler error — acknowledged',
    });
  }
}

/**
 * Process a Stripe webhook event
 */
async function processStripeEvent(event: StripeWebhookEvent): Promise<void> {
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
          await FirestoreService.update(ORDERS_PATH, orderId, {
            status: 'completed',
            stripeSessionId: String(session.id ?? ''),
            completedAt: new Date().toISOString(),
          });
          logger.info('Order updated to completed', {
            route: '/api/webhooks/stripe',
            orderId,
          });
        }

        // Clear the user's cart after successful payment (workspace-scoped path)
        const cartId = metadata.cartId;
        const wsId = typeof metadata.workspaceId === 'string' ? metadata.workspaceId : 'default';
        if (typeof cartId === 'string') {
          try {
            await FirestoreService.delete(
              `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/workspaces/${wsId}/carts`,
              cartId
            );
            logger.info('Cart cleared after successful checkout', {
              route: '/api/webhooks/stripe',
              cartId,
            });
          } catch (cartError) {
            logger.warn('Failed to clear cart after checkout (non-fatal)', {
              cartId,
              error: cartError instanceof Error ? cartError.message : 'Unknown',
            });
          }
        }
      }
      break;
    }

    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      const piId = String(paymentIntent.id ?? '');
      logger.info('Payment intent succeeded', {
        route: '/api/webhooks/stripe',
        paymentIntentId: piId,
        amount: typeof paymentIntent.amount === 'number' ? paymentIntent.amount : 0,
        currency: String(paymentIntent.currency ?? ''),
      });

      // Safety net: update order status if client-side completion failed
      if (piId) {
        try {
          const matchingOrders = await FirestoreService.getAll<Record<string, unknown>>(
            ORDERS_PATH,
            [where('paymentIntentId', '==', piId), limit(1)]
          );

          if (matchingOrders.length > 0) {
            const existingOrder = matchingOrders[0];
            const existingOrderId = String(existingOrder?.id ?? '');
            const existingStatus = String(existingOrder?.status ?? '');
            if (existingOrderId && existingStatus !== 'processing' && existingStatus !== 'completed') {
              await FirestoreService.update(ORDERS_PATH, existingOrderId, {
                status: 'processing',
                paymentStatus: 'captured',
                webhookUpdatedAt: new Date().toISOString(),
              });
              logger.info('Order status updated via webhook safety net', {
                route: '/api/webhooks/stripe',
                orderId: existingOrderId,
                paymentIntentId: piId,
              });
            }
          }
        } catch (orderError) {
          logger.warn('Webhook: failed to update order status (non-fatal)', {
            error: orderError instanceof Error ? orderError.message : 'Unknown',
            paymentIntentId: piId,
          });
        }
      }
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

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const subscriptionId = String(subscription.id ?? '');
      const customerId = String(subscription.customer ?? '');
      const status = String(subscription.status ?? '');
      const currentPeriodEnd = typeof subscription.current_period_end === 'number'
        ? subscription.current_period_end
        : null;
      const cancelAtPeriodEnd = subscription.cancel_at_period_end === true;

      // Store in stripe_subscriptions for audit/lookup
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/stripe_subscriptions`,
        subscriptionId,
        {
          id: subscriptionId,
          customerId,
          status,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          updatedAt: new Date().toISOString(),
          eventType: event.type,
        }
      );

      // Sync to user's subscription record
      const userSub = await findUserSubscription(subscriptionId);
      if (userSub?.id) {
        await FirestoreService.update(SUBSCRIPTIONS_PATH, String(userSub.id), {
          stripeStatus: status,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          updatedAt: new Date().toISOString(),
        });
      }

      logger.info(`Subscription ${event.type === 'customer.subscription.created' ? 'created' : 'updated'}`, {
        route: '/api/webhooks/stripe',
        subscriptionId,
        customerId,
        status,
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const subscriptionId = String(subscription.id ?? '');
      const customerId = String(subscription.customer ?? '');

      // Update stripe_subscriptions
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/stripe_subscriptions`,
        subscriptionId,
        {
          id: subscriptionId,
          customerId,
          status: 'canceled',
          canceledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          eventType: event.type,
        }
      );

      // Sync cancellation to user's subscription record
      const userSub = await findUserSubscription(subscriptionId);
      if (userSub?.id) {
        await FirestoreService.update(SUBSCRIPTIONS_PATH, String(userSub.id), {
          status: 'cancelled',
          stripeStatus: 'canceled',
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      logger.warn('Subscription cancelled via Stripe', {
        route: '/api/webhooks/stripe',
        subscriptionId,
        customerId,
      });
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      const subscriptionId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : null;

      // Update subscription payment status if subscription-related
      if (subscriptionId) {
        const userSub = await findUserSubscription(subscriptionId);
        if (userSub?.id) {
          await FirestoreService.update(SUBSCRIPTIONS_PATH, String(userSub.id), {
            lastPaymentAt: new Date().toISOString(),
            lastPaymentAmount: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : 0,
            paymentStatus: 'current',
            updatedAt: new Date().toISOString(),
          });
        }
      }

      logger.info('Invoice payment succeeded', {
        route: '/api/webhooks/stripe',
        invoiceId: String(invoice.id ?? ''),
        subscriptionId,
        amount: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : 0,
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const subscriptionId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : null;

      // Flag subscription payment failure
      if (subscriptionId) {
        const userSub = await findUserSubscription(subscriptionId);
        if (userSub?.id) {
          await FirestoreService.update(SUBSCRIPTIONS_PATH, String(userSub.id), {
            paymentStatus: 'past_due',
            lastPaymentFailedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      logger.warn('Invoice payment failed', {
        route: '/api/webhooks/stripe',
        invoiceId: String(invoice.id ?? ''),
        subscriptionId,
        amount: typeof invoice.amount_due === 'number' ? invoice.amount_due : 0,
        attemptCount: typeof invoice.attempt_count === 'number' ? invoice.attempt_count : 0,
      });
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      const paymentIntentId = typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : null;
      const amountRefunded = typeof charge.amount_refunded === 'number'
        ? charge.amount_refunded
        : 0;

      // Update order with refund info
      if (paymentIntentId) {
        try {
          const matchingOrders = await FirestoreService.getAll<Record<string, unknown>>(
            ORDERS_PATH,
            [where('paymentIntentId', '==', paymentIntentId), limit(1)]
          );
          if (matchingOrders.length > 0 && matchingOrders[0]?.id) {
            const chargeAmount = typeof charge.amount === 'number' ? charge.amount : 0;
            await FirestoreService.update(ORDERS_PATH, String(matchingOrders[0].id), {
              refundedAmount: amountRefunded,
              refundedAt: new Date().toISOString(),
              status: amountRefunded >= chargeAmount ? 'refunded' : 'partially_refunded',
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (refundError) {
          logger.warn('Failed to update order refund status (non-fatal)', {
            paymentIntentId,
            error: refundError instanceof Error ? refundError.message : 'Unknown',
          });
        }
      }

      logger.info('Charge refunded', {
        route: '/api/webhooks/stripe',
        chargeId: String(charge.id ?? ''),
        paymentIntentId,
        amountRefunded,
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
