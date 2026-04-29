/**
 * POST /api/subscriptions/portal
 * Creates a billing portal session for subscription management.
 *
 * Provider-agnostic: routes to Stripe Customer Portal, PayPal dashboard,
 * or falls back to local settings page for providers without hosted portals.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import {
  getPortalUrl,
  type SubscriptionProviderId,
} from '@/lib/subscriptions/subscription-provider-service';

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

    const subscription = await AdminFirestoreService.get(SUBSCRIPTIONS_PATH, authResult.user.uid);

    // Determine provider and subscription ID from stored subscription
    const provider = (subscription?.paymentProvider as SubscriptionProviderId | undefined) ??
      (subscription?.stripeSubscriptionId ? 'stripe' : null);
    const subscriptionId = (subscription?.providerSubscriptionId ?? subscription?.stripeSubscriptionId) as string | undefined;

    if (!provider || !subscriptionId) {
      return errors.notFound('No active payment subscription found. Use the billing portal after completing checkout.');
    }

    const origin = request.headers.get('origin') ?? 'https://salesvelocity.ai';
    const returnUrl = parseResult.data.returnUrl ?? `${origin}/settings/billing`;

    const result = await getPortalUrl(subscriptionId, returnUrl, provider);

    if (!result.success) {
      return errors.externalService(
        provider,
        new Error(result.error ?? 'Failed to create portal session')
      );
    }

    logger.info('Billing portal session created', {
      route: '/api/subscriptions/portal',
      userId: authResult.user.uid,
      provider,
    });

    return NextResponse.json({ success: true, url: result.url, provider });
  } catch (error: unknown) {
    logger.error(
      'Failed to create billing portal session',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/subscriptions/portal' }
    );
    return errors.internal('Failed to create billing portal session');
  }
}
