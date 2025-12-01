import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook } from '@/lib/billing/stripe-service';
import Stripe from 'stripe';
import { apiKeyService } from '@/lib/api-keys/api-key-service';

/**
 * Stripe Webhook Handler
 * Note: Webhooks don't use standard auth - they use Stripe signature verification
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { success: false, error: 'No signature provided' },
      { status: 400 }
    );
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
    console.error('Stripe webhook secret not configured');
    return NextResponse.json(
      { success: false, error: 'Webhook secret not configured' },
      { status: 500 }
    );
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
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { success: false, error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  try {
    await handleWebhook(event);
    return NextResponse.json({ success: true, received: true });
  } catch (error: any) {
    console.error('Error handling webhook:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to handle webhook' },
      { status: 500 }
    );
  }
}
