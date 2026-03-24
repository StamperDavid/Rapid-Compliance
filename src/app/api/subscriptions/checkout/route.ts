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
import { adminDb } from '@/lib/firebase/admin';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { PlatformCoupon } from '@/types/pricing';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const checkoutSchema = z.object({
  tier: z.enum(['starter', 'professional', 'enterprise']),
  billingPeriod: z.enum(['monthly', 'annual']).default('monthly'),
  couponCode: z.string().optional(),
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

    const { tier, billingPeriod, couponCode } = parseResult.data;
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

    // Validate coupon if provided, before creating the Stripe session
    let stripeCouponId: string | undefined;
    if (couponCode) {
      if (!adminDb) {
        return errors.internal('Database not available for coupon validation');
      }

      const normalizedCode = couponCode.toUpperCase().trim();
      // The coupon service uses billing cycle 'monthly' | 'yearly'; map 'annual' → 'yearly'
      const billingCycleForCoupon = billingPeriod === 'annual' ? 'yearly' : 'monthly';

      const couponsRef = adminDb.collection(COLLECTIONS.PLATFORM_COUPONS);
      const snapshot = await couponsRef.where('code', '==', normalizedCode).get();

      if (snapshot.empty) {
        return errors.badRequest('Coupon code not found');
      }

      const couponDoc = snapshot.docs[0];
      const coupon = { ...couponDoc.data(), id: couponDoc.id } as PlatformCoupon;

      if (coupon.status !== 'active') {
        const messageMap: Record<string, string> = {
          expired: 'This coupon has expired',
          depleted: 'This coupon has reached its usage limit',
          disabled: 'This coupon is no longer valid',
        };
        return errors.badRequest(messageMap[coupon.status] ?? 'This coupon is no longer valid');
      }

      const now = new Date();
      if (new Date(coupon.valid_from) > now) {
        return errors.badRequest('This coupon is not yet active');
      }
      if (coupon.valid_until && new Date(coupon.valid_until) < now) {
        return errors.badRequest('This coupon has expired');
      }

      if (coupon.max_uses !== undefined && coupon.current_uses >= coupon.max_uses) {
        return errors.badRequest('This coupon has reached its usage limit');
      }

      if (coupon.applies_to_plans !== 'all' && !coupon.applies_to_plans.includes(tier)) {
        return errors.badRequest('This coupon does not apply to the selected plan');
      }

      if (coupon.billing_cycles !== 'all' && !coupon.billing_cycles.includes(billingCycleForCoupon)) {
        return errors.badRequest(`This coupon is not valid for ${billingPeriod} billing`);
      }

      // Free-forever coupons bypass Stripe entirely — they cannot be applied through a checkout session
      const isFreeForever = coupon.is_free_forever ||
        (coupon.discount_type === 'percentage' && coupon.value === 100);
      if (isFreeForever) {
        return errors.badRequest(
          'This coupon grants free access and cannot be applied through checkout. Please contact support.'
        );
      }

      // Create an ad-hoc Stripe coupon to apply to the session
      const stripeCoupon = await stripe.coupons.create({
        percent_off: coupon.discount_type === 'percentage' ? coupon.value : undefined,
        amount_off: coupon.discount_type === 'fixed' ? Math.round(coupon.value * 100) : undefined,
        currency: coupon.discount_type === 'fixed' ? 'usd' : undefined,
        duration: 'once',
        name: `Coupon: ${normalizedCode}`,
      });

      stripeCouponId = stripeCoupon.id;

      logger.info('Platform coupon validated for subscription checkout', {
        route: '/api/subscriptions/checkout',
        couponCode: normalizedCode,
        discountType: coupon.discount_type,
        discountValue: coupon.value,
        userId: authResult.user.uid,
      });
    }

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
      ...(stripeCouponId !== undefined && { discounts: [{ coupon: stripeCouponId }] }),
      success_url: `${appUrl}/settings/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}&tier=${tier}`,
      cancel_url: `${appUrl}/settings/subscription?checkout=cancelled`,
      customer_email: authResult.user.email ?? undefined,
      client_reference_id: authResult.user.email ?? authResult.user.uid,
      metadata: {
        tier,
        billingPeriod,
        userId: authResult.user.uid,
        ...(couponCode !== undefined && { couponCode: couponCode.toUpperCase().trim() }),
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
      couponApplied: couponCode !== undefined,
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
