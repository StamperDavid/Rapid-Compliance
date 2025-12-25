import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { RecordCounter } from '@/lib/subscription/record-counter';
import { updateSubscriptionTier } from '@/lib/billing/stripe-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { getTierForRecordCount, VOLUME_TIERS } from '@/types/subscription';
import { logger } from '@/lib/logger/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      logger.error('[Stripe Webhook] Signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    logger.info(`[Stripe Webhook] Received event: ${event.type}`);

    // Handle different webhook events
    switch (event.type) {
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        logger.info(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    logger.error('[Stripe Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Trial ending in 3 days - Calculate tier based on current record count
 */
async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  try {
    const organizationId = subscription.metadata?.organizationId;
    if (!organizationId) {
      logger.warn('[Stripe Webhook] No organizationId in subscription metadata');
      return;
    }

    logger.info(`[Stripe Webhook] Trial ending for org: ${organizationId}`);

    // Count current records
    const recordCount = await RecordCounter.recalculateCount(organizationId);
    
    // Determine appropriate tier
    const requiredTier = getTierForRecordCount(recordCount);
    const tierDetails = VOLUME_TIERS[requiredTier];

    logger.info(`[Stripe Webhook] Org ${organizationId} has ${recordCount} records, assigning ${requiredTier}`, {
      recordCount,
      tier: requiredTier,
      price: tierDetails.price,
    });

    // Update subscription to appropriate tier
    await updateSubscriptionTier(
      subscription.id,
      requiredTier,
      recordCount
    );

    // Send email notification to customer
    await sendTrialEndEmail(organizationId, {
      tier: requiredTier,
      tierName: tierDetails.name,
      price: tierDetails.price,
      recordCount,
      trialEndDate: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toLocaleDateString()
        : 'soon',
    });

    logger.info(`[Stripe Webhook] Successfully updated tier for trial end: ${organizationId}`);
  } catch (error) {
    logger.error('[Stripe Webhook] Error handling trial_will_end:', error);
  }
}

/**
 * Subscription updated - Sync to Firestore
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const organizationId = subscription.metadata?.organizationId;
    if (!organizationId) return;

    // Update organization's subscription status
    await FirestoreService.update(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/subscriptions`,
      'current',
      {
        status: subscription.status,
        tier: subscription.metadata?.tierId,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAt: subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000).toISOString()
          : null,
        updatedAt: new Date().toISOString(),
      }
    );

    logger.info(`[Stripe Webhook] Updated subscription for org: ${organizationId}`);
  } catch (error) {
    logger.error('[Stripe Webhook] Error handling subscription_updated:', error);
  }
}

/**
 * Subscription canceled
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const organizationId = subscription.metadata?.organizationId;
    if (!organizationId) return;

    await FirestoreService.update(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/subscriptions`,
      'current',
      {
        status: 'canceled',
        canceledAt: new Date().toISOString(),
      }
    );

    logger.info(`[Stripe Webhook] Subscription canceled for org: ${organizationId}`);
  } catch (error) {
    logger.error('[Stripe Webhook] Error handling subscription_deleted:', error);
  }
}

/**
 * Payment succeeded
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    const organizationId = invoice.metadata?.organizationId;
    if (!organizationId) return;

    // Log successful payment
    await FirestoreService.create(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/billing_history`,
      {
        type: 'payment_succeeded',
        invoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        paidAt: new Date(invoice.status_transitions.paid_at! * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      }
    );

    logger.info(`[Stripe Webhook] Payment succeeded for org: ${organizationId}, amount: ${invoice.amount_paid}`);
  } catch (error) {
    logger.error('[Stripe Webhook] Error handling payment_succeeded:', error);
  }
}

/**
 * Payment failed
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const organizationId = invoice.metadata?.organizationId;
    if (!organizationId) return;

    // Update subscription status
    await FirestoreService.update(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/subscriptions`,
      'current',
      {
        status: 'past_due',
        lastPaymentFailed: true,
        lastPaymentFailedAt: new Date().toISOString(),
      }
    );

    // Send payment failed email
    await sendPaymentFailedEmail(organizationId, {
      attemptCount: invoice.attempt_count || 1,
      amount: invoice.amount_due,
    });

    logger.warn(`[Stripe Webhook] Payment failed for org: ${organizationId}`);
  } catch (error) {
    logger.error('[Stripe Webhook] Error handling payment_failed:', error);
  }
}

/**
 * Send trial ending email with tier assignment
 */
async function sendTrialEndEmail(
  organizationId: string,
  data: {
    tier: string;
    tierName: string;
    price: number;
    recordCount: number;
    trialEndDate: string;
  }
) {
  try {
    // TODO: Integrate with your email service (SendGrid, Resend, etc.)
    logger.info(`[Email] Would send trial end email to org ${organizationId}:`, data);
    
    // Example email content:
    const emailContent = `
Your 14-day free trial ends on ${data.trialEndDate}.

Based on your current usage of ${data.recordCount} records, you've been assigned to:
- ${data.tierName}: $${data.price}/month

You'll be automatically charged $${data.price} when your trial ends.

Need to adjust? You can:
- Delete records to move to a lower tier
- Add more records (we'll auto-upgrade you as needed)

Questions? Reply to this email.
    `.trim();

    // TODO: Actually send the email
    logger.info(`[Email] Trial end email content:`, emailContent);
  } catch (error) {
    logger.error('[Email] Error sending trial end email:', error);
  }
}

/**
 * Send payment failed email
 */
async function sendPaymentFailedEmail(
  organizationId: string,
  data: {
    attemptCount: number;
    amount: number;
  }
) {
  try {
    logger.info(`[Email] Would send payment failed email to org ${organizationId}:`, data);
    
    // TODO: Actually send the email
  } catch (error) {
    logger.error('[Email] Error sending payment failed email:', error);
  }
}

