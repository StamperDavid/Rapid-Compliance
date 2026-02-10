/**
 * Subscription Management API
 * GET - Get current subscription
 * POST - Create subscription
 * PUT - Update subscription (upgrade, downgrade, cancel, reactivate)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SUBSCRIPTIONS_PATH = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/subscriptions`;

const createSubscriptionSchema = z.object({
  tier: z.enum(['free', 'starter', 'professional', 'enterprise']),
  billingPeriod: z.enum(['monthly', 'annual']).optional().default('monthly'),
});

const updateSubscriptionSchema = z.object({
  tier: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  action: z.enum(['upgrade', 'downgrade', 'cancel', 'reactivate']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscriptions');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const subscription = await FirestoreService.get<Record<string, unknown>>(
      SUBSCRIPTIONS_PATH,
      authResult.user.uid
    );

    if (!subscription) {
      return NextResponse.json({
        success: true,
        subscription: {
          tier: 'free',
          status: 'active',
          userId: authResult.user.uid,
        },
      });
    }

    return NextResponse.json({ success: true, subscription });
  } catch (error: unknown) {
    logger.error('Get subscription error', error instanceof Error ? error : new Error(String(error)));
    return errors.internal('Failed to get subscription');
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscriptions');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const validation = createSubscriptionSchema.safeParse(body);
    if (!validation.success) {
      return errors.badRequest(validation.error.errors[0]?.message ?? 'Invalid data');
    }

    const { tier, billingPeriod } = validation.data;

    const subscription = {
      userId: authResult.user.uid,
      tier,
      billingPeriod,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await FirestoreService.set(SUBSCRIPTIONS_PATH, authResult.user.uid, subscription);

    return NextResponse.json({ success: true, subscription }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Create subscription error', error instanceof Error ? error : new Error(String(error)));
    return errors.internal('Failed to create subscription');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscriptions');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const validation = updateSubscriptionSchema.safeParse(body);
    if (!validation.success) {
      return errors.badRequest(validation.error.errors[0]?.message ?? 'Invalid data');
    }

    const { tier, action } = validation.data;
    const existing = await FirestoreService.get<Record<string, unknown>>(
      SUBSCRIPTIONS_PATH,
      authResult.user.uid
    );

    if (!existing) {
      return errors.notFound('No subscription found');
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (action === 'cancel') {
      updates.status = 'cancelled';
      updates.cancelledAt = new Date().toISOString();
    } else if (action === 'reactivate') {
      updates.status = 'active';
      updates.reactivatedAt = new Date().toISOString();
    }

    if (tier) {
      updates.tier = tier;
      updates.tierChangedAt = new Date().toISOString();
      updates.previousTier = existing.tier;
    }

    await FirestoreService.update(SUBSCRIPTIONS_PATH, authResult.user.uid, updates);

    return NextResponse.json({
      success: true,
      subscription: { ...existing, ...updates },
    });
  } catch (error: unknown) {
    logger.error('Update subscription error', error instanceof Error ? error : new Error(String(error)));
    return errors.internal('Failed to update subscription');
  }
}
