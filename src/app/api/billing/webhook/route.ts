import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook } from '@/lib/billing/stripe-service';
import Stripe from 'stripe';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

/**
 * Stripe Webhook Handler
 * Note: Webhooks don't use standard auth - they use Stripe signature verification
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return errors.badRequest('No signature provided');
  }

  // Get webhook secret from platform API keys (admin settings)
  // Fallback to environment variable
  let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    try {
      // Try to get from admin settings
      const adminKeys = await apiKeyService.getServiceKey('platform', 'stripe');
      webhookSecret = adminKeys?.webhookSecret;
    } catch (error) {
      // Silently fail - will use env var or error
    }
  }

  if (!webhookSecret) {
    logger.error('Stripe webhook secret not configured', undefined, { route: '/api/billing/webhook' });
    return errors.internal('Webhook secret not configured');
  }

  let event: Stripe.Event;

  try {
    // Get Stripe instance (use platform keys)
    const stripeKeys = await apiKeyService.getServiceKey('platform', 'stripe');
    if (!stripeKeys?.secretKey) {
      throw new Error('Stripe platform keys not configured');
    }

    const stripe = new Stripe(stripeKeys.secretKey, {
      apiVersion: '2023-10-16',
    });

    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err: any) {
    logger.error('Webhook signature verification failed', err, { route: '/api/billing/webhook' });
    return errors.badRequest(`Webhook Error: ${err.message}`);
  }

  try {
    await handleWebhook(event);
    return NextResponse.json({ success: true, received: true });
  } catch (error: any) {
    logger.error('Error handling webhook', error, { route: '/api/billing/webhook' });
    return errors.internal('Webhook handler failed', error);
  }
}
