import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { RecordCounter } from '@/lib/subscription/record-counter';
import { updateSubscriptionTier } from '@/lib/billing/stripe-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { getTierForRecordCount, VOLUME_TIERS } from '@/types/subscription';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

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
    const historyId = `payment_${invoice.id}_${Date.now()}`;
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/billing_history`,
      historyId,
      {
        type: 'payment_succeeded',
        invoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        paidAt: new Date(invoice.status_transitions.paid_at! * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      },
      false // Don't merge, create new document
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
    // Get organization owner's email
    const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, organizationId);
    if (!org?.ownerId) {
      logger.warn('[Email] No owner found for organization', { organizationId });
      return;
    }

    const owner = await FirestoreService.get(COLLECTIONS.USERS, org.ownerId);
    if (!owner?.email) {
      logger.warn('[Email] No email found for organization owner', { organizationId, ownerId: org.ownerId });
      return;
    }

    // Format price
    const formattedPrice = (data.price / 100).toFixed(2);

    // Email HTML content
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .tier-box { background: white; border-left: 4px solid #6366f1; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .price { font-size: 32px; font-weight: bold; color: #6366f1; }
    .button { display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Trial is Ending Soon</h1>
    </div>
    <div class="content">
      <p>Hi ${owner.name || 'there'},</p>
      
      <p>Your 14-day free trial ends on <strong>${data.trialEndDate}</strong>.</p>
      
      <div class="tier-box">
        <h2>Your Assigned Tier</h2>
        <p>Based on your current usage of <strong>${data.recordCount} records</strong>, you've been assigned to:</p>
        <p class="price">$${formattedPrice}/month</p>
        <p><strong>${data.tierName}</strong></p>
      </div>

      <p>You'll be automatically charged <strong>$${formattedPrice}</strong> when your trial ends.</p>

      <h3>Need to Adjust Your Plan?</h3>
      <ul>
        <li>Delete records to move to a lower tier</li>
        <li>Add more records (we'll auto-upgrade you as needed)</li>
        <li>All features are included at every tier</li>
      </ul>

      <a href="${process.env.NEXT_PUBLIC_APP_URL}/workspace/${organizationId}/settings/billing" class="button">
        Manage Billing
      </a>

      <p>Questions? Just reply to this email and we'll help you out!</p>

      <div class="footer">
        <p>AI Sales Platform | Volume-Based Pricing</p>
        <p>You're receiving this because your trial is ending soon.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Text version for email clients that don't support HTML
    const textContent = `
Your Trial is Ending Soon

Hi ${owner.name || 'there'},

Your 14-day free trial ends on ${data.trialEndDate}.

YOUR ASSIGNED TIER
Based on your current usage of ${data.recordCount} records, you've been assigned to:
- ${data.tierName}: $${formattedPrice}/month

You'll be automatically charged $${formattedPrice} when your trial ends.

NEED TO ADJUST YOUR PLAN?
- Delete records to move to a lower tier
- Add more records (we'll auto-upgrade you as needed)
- All features are included at every tier

Manage your billing: ${process.env.NEXT_PUBLIC_APP_URL}/workspace/${organizationId}/settings/billing

Questions? Just reply to this email and we'll help you out!

---
AI Sales Platform | Volume-Based Pricing
    `.trim();

    // Import and use email service
    const { sendEmail } = await import('@/lib/email/email-service');
    
    const result = await sendEmail({
      to: owner.email,
      subject: `Your trial ends ${data.trialEndDate} - Tier assigned`,
      html: htmlContent,
      text: textContent,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@salesvelocity.ai',
      fromName: 'AI Sales Platform',
      metadata: {
        organizationId,
        type: 'trial_ending',
        tier: data.tier,
      },
    });

    if (result.success) {
      logger.info('[Email] Trial end email sent successfully', { 
        organizationId, 
        email: owner.email,
        messageId: result.messageId 
      });
    } else {
      logger.error('[Email] Failed to send trial end email', new Error(result.error), { 
        organizationId, 
        email: owner.email 
      });
    }
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
    // Get organization owner's email
    const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, organizationId);
    if (!org?.ownerId) {
      logger.warn('[Email] No owner found for organization', { organizationId });
      return;
    }

    const owner = await FirestoreService.get(COLLECTIONS.USERS, org.ownerId);
    if (!owner?.email) {
      logger.warn('[Email] No email found for organization owner', { organizationId, ownerId: org.ownerId });
      return;
    }

    // Format amount
    const formattedAmount = (data.amount / 100).toFixed(2);

    // Email HTML content
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .alert-box { background: #fee2e2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .button { display: inline-block; background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
    .amount { font-size: 24px; font-weight: bold; color: #dc2626; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Payment Failed</h1>
    </div>
    <div class="content">
      <p>Hi ${owner.name || 'there'},</p>
      
      <div class="alert-box">
        <h2>We couldn't process your payment</h2>
        <p>Attempted <strong>${data.attemptCount} time(s)</strong></p>
        <p class="amount">$${formattedAmount}</p>
      </div>

      <p>We attempted to charge your card for your AI Sales Platform subscription, but the payment failed.</p>

      <h3>What happens next?</h3>
      <p>We'll retry the payment automatically over the next few days. If all attempts fail, your account may be downgraded or suspended.</p>

      <h3>To avoid service interruption:</h3>
      <ul>
        <li>Update your payment method</li>
        <li>Ensure your card has sufficient funds</li>
        <li>Contact your bank if the issue persists</li>
      </ul>

      <a href="${process.env.NEXT_PUBLIC_APP_URL}/workspace/${organizationId}/settings/billing" class="button">
        Update Payment Method
      </a>

      <p>Need help? Reply to this email and we'll assist you immediately.</p>

      <div class="footer">
        <p>AI Sales Platform</p>
        <p>You're receiving this because a payment for your subscription failed.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Text version
    const textContent = `
⚠️ PAYMENT FAILED

Hi ${owner.name || 'there'},

We couldn't process your payment for your AI Sales Platform subscription.

DETAILS:
- Amount: $${formattedAmount}
- Attempt: ${data.attemptCount} time(s)

WHAT HAPPENS NEXT?
We'll retry the payment automatically over the next few days. If all attempts fail, your account may be downgraded or suspended.

TO AVOID SERVICE INTERRUPTION:
- Update your payment method
- Ensure your card has sufficient funds
- Contact your bank if the issue persists

Update payment method: ${process.env.NEXT_PUBLIC_APP_URL}/workspace/${organizationId}/settings/billing

Need help? Reply to this email and we'll assist you immediately.

---
AI Sales Platform
    `.trim();

    // Import and use email service
    const { sendEmail } = await import('@/lib/email/email-service');
    
    const result = await sendEmail({
      to: owner.email,
      subject: `⚠️ Payment Failed - Action Required ($${formattedAmount})`,
      html: htmlContent,
      text: textContent,
      from: process.env.SENDGRID_FROM_EMAIL || 'billing@salesvelocity.ai',
      fromName: 'AI Sales Platform Billing',
      metadata: {
        organizationId,
        type: 'payment_failed',
        amount: data.amount,
        attemptCount: data.attemptCount,
      },
    });

    if (result.success) {
      logger.info('[Email] Payment failed email sent successfully', { 
        organizationId, 
        email: owner.email,
        messageId: result.messageId 
      });
    } else {
      logger.error('[Email] Failed to send payment failed email', new Error(result.error), { 
        organizationId, 
        email: owner.email 
      });
    }
  } catch (error) {
    logger.error('[Email] Error sending payment failed email:', error);
  }
}

