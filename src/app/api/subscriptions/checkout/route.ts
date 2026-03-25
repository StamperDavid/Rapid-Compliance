/**
 * Create checkout session for subscription upgrades
 * POST - Creates a provider-specific checkout session and returns the URL
 *
 * Supports: Stripe, Authorize.Net, PayPal, Square, Paddle, Chargebee
 * Provider is determined by platform subscription config (default: Stripe)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getTier } from '@/lib/pricing/subscription-tiers';
import { adminDb } from '@/lib/firebase/admin';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { PlatformCoupon } from '@/types/pricing';
import {
  createCheckoutSession,
  getSubscriptionProvider,
  type SubscriptionProviderId,
} from '@/lib/subscriptions/subscription-provider-service';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const checkoutSchema = z.object({
  tier: z.enum(['starter', 'professional', 'enterprise']),
  billingPeriod: z.enum(['monthly', 'annual']).default('monthly'),
  couponCode: z.string().optional(),
  provider: z.enum(['stripe', 'authorizenet', 'paypal', 'square', 'paddle', 'chargebee']).optional(),
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

    const { tier, billingPeriod, couponCode, provider } = parseResult.data;
    const tierConfig = getTier(tier);

    if (!tierConfig) {
      return errors.badRequest('Invalid subscription tier');
    }

    const resolvedProvider: SubscriptionProviderId = provider ?? await getSubscriptionProvider();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // Validate and create Stripe coupon if applicable (Stripe-only feature)
    let stripeCouponId: string | undefined;
    if (couponCode && resolvedProvider === 'stripe') {
      if (!adminDb) {
        return errors.internal('Database not available for coupon validation');
      }

      const normalizedCode = couponCode.toUpperCase().trim();
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

      const isFreeForever = coupon.is_free_forever ||
        (coupon.discount_type === 'percentage' && coupon.value === 100);
      if (isFreeForever) {
        return errors.badRequest(
          'This coupon grants free access and cannot be applied through checkout. Please contact support.'
        );
      }

      // Create ad-hoc Stripe coupon
      const stripeKeys = await apiKeyService.getServiceKey(PLATFORM_ID, 'stripe') as { secretKey?: string } | null;
      if (stripeKeys?.secretKey) {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(stripeKeys.secretKey, { apiVersion: '2023-10-16' });

        const stripeCoupon = await stripe.coupons.create({
          percent_off: coupon.discount_type === 'percentage' ? coupon.value : undefined,
          amount_off: coupon.discount_type === 'fixed' ? Math.round(coupon.value * 100) : undefined,
          currency: coupon.discount_type === 'fixed' ? 'usd' : undefined,
          duration: 'once',
          name: `Coupon: ${normalizedCode}`,
        });

        stripeCouponId = stripeCoupon.id;
      }

      logger.info('Platform coupon validated for subscription checkout', {
        route: '/api/subscriptions/checkout',
        couponCode: normalizedCode,
        discountType: coupon.discount_type,
        discountValue: coupon.value,
        userId: authResult.user.uid,
      });
    }

    const result = await createCheckoutSession({
      tier: tierConfig,
      billingPeriod,
      userId: authResult.user.uid,
      userEmail: authResult.user.email ?? '',
      couponCode: couponCode?.toUpperCase().trim(),
      stripeCouponId,
      appUrl,
    }, resolvedProvider);

    if (!result.success) {
      return errors.externalService(
        resolvedProvider,
        new Error(result.error ?? 'Checkout session creation failed')
      );
    }

    logger.info('Subscription checkout session created', {
      route: '/api/subscriptions/checkout',
      tier,
      billingPeriod,
      provider: resolvedProvider,
      userId: authResult.user.uid,
      sessionId: result.sessionId,
      couponApplied: couponCode !== undefined,
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      sessionId: result.sessionId,
      provider: result.provider,
    });
  } catch (error: unknown) {
    logger.error('Subscription checkout error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/subscriptions/checkout',
    });
    return errors.internal('Subscription checkout failed');
  }
}
