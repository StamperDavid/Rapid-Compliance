/**
 * Create Stripe Checkout session for subscription upgrades
 * POST - Creates a Stripe Checkout session and returns the URL
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getTier } from '@/lib/pricing/subscription-tiers';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const checkoutSchema = z.object({
  tier: z.enum(['starter', 'professional', 'enterprise']),
  billingPeriod: z.enum(['monthly', 'annual']).default('monthly'),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscriptions/checkout');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody: unknown = await request.json();
    const parseResult = checkoutSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid checkout data');
    }

    const { tier, billingPeriod } = parseResult.data;
    const tierConfig = getTier(tier);

    if (!tierConfig) {
      return errors.badRequest('Invalid subscription tier');
    }

    const stripeKeys = await apiKeyService.getServiceKey(PLATFORM_ID, 'stripe') as { secretKey?: string } | null;
    if (!stripeKeys?.secretKey) {
      return errors.badRequest('Stripe not configured. Please add Stripe API keys in settings.');
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKeys.secretKey, { apiVersion: '2023-10-16' });

    const priceInCents = billingPeriod === 'annual' ? tierConfig.annualPriceCents : tierConfig.monthlyPriceCents;
    const interval = billingPeriod === 'annual' ? 'year' as const : 'month' as const;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `SalesVelocity.ai ${tierConfig.label} Plan`,
            description: `${tierConfig.label} subscription — billed ${billingPeriod === 'annual' ? 'annually' : 'monthly'}`,
          },
          unit_amount: priceInCents,
          recurring: { interval },
        },
        quantity: 1,
      }],
      success_url: `${appUrl}/settings/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}&tier=${tier}`,
      cancel_url: `${appUrl}/settings/subscription?checkout=cancelled`,
      customer_email: authResult.user.email ?? undefined,
      client_reference_id: authResult.user.email ?? authResult.user.uid,
      metadata: {
        tier,
        billingPeriod,
        userId: authResult.user.uid,
      },
    });

    if (!session.url) {
      return errors.internal('Failed to create Stripe checkout session');
    }

    logger.info('Subscription checkout session created', {
      route: '/api/subscriptions/checkout',
      tier,
      billingPeriod,
      userId: authResult.user.uid,
      sessionId: session.id,
    });

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error: unknown) {
    logger.error('Subscription checkout error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/subscriptions/checkout',
    });
    return errors.externalService('Stripe', error instanceof Error ? error : new Error(String(error)));
  }
}
