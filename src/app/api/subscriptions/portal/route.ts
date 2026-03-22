/**
 * POST /api/subscriptions/portal
 * Creates a Stripe Customer Portal session for subscription management.
 * The customer ID is resolved from the stored stripeSubscriptionId.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

const SUBSCRIPTIONS_PATH = getSubCollection('subscriptions');

const portalSchema = z.object({
  returnUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscriptions/portal');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody: unknown = await request.json();
    const parseResult = portalSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request body');
    }

    // Retrieve the user's subscription document to find the Stripe subscription ID
    const subscription = await AdminFirestoreService.get(SUBSCRIPTIONS_PATH, authResult.user.uid);

    const stripeSubscriptionId =
      subscription && typeof subscription.stripeSubscriptionId === 'string' && subscription.stripeSubscriptionId
        ? subscription.stripeSubscriptionId
        : null;

    if (!stripeSubscriptionId) {
      return errors.notFound('No Stripe subscription found. Use the billing portal after completing a Stripe checkout.');
    }

    // Resolve Stripe API key
    const stripeKeys = await apiKeyService.getServiceKey(PLATFORM_ID, 'stripe');
    const keys = stripeKeys as { secretKey?: string } | null;

    if (!keys?.secretKey) {
      return errors.badRequest('Stripe not configured. Please add Stripe API keys in settings.');
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(keys.secretKey, { apiVersion: '2023-10-16' });

    // Retrieve the Stripe subscription to obtain the customer ID
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const customerId =
      typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id;

    // Build return URL from request origin when the caller did not supply one
    const origin = request.headers.get('origin') ?? 'https://rapidcompliance.us';
    const returnUrl = parseResult.data.returnUrl ?? `${origin}/settings/billing`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    logger.info('Billing portal session created', {
      route: '/api/subscriptions/portal',
      userId: authResult.user.uid,
      customerId,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error: unknown) {
    logger.error(
      'Failed to create billing portal session',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/subscriptions/portal' }
    );
    return errors.externalService('Stripe', error instanceof Error ? error : new Error(String(error)));
  }
}
