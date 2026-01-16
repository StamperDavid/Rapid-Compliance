/**
 * Subscription API Routes
 * GET: Get organization's subscription
 * POST: Update subscription plan
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FeatureGate } from '@/lib/subscription/feature-gate';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import type { SubscriptionPlan } from '@/types/subscription';

const querySchema = z.object({
  orgId: z.string().min(1, 'Organization ID required'),
});

const postBodySchema = z.object({
  orgId: z.string().min(1, 'Organization ID required'),
  plan: z.enum(['starter', 'professional', 'enterprise', 'custom']),
  billingCycle: z.enum(['monthly', 'yearly']).optional().default('monthly'),
});

/**
 * GET /api/subscription?orgId=xxx
 * Get subscription details for organization
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscription');
    if (rateLimitResponse) { return rateLimitResponse; }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const queryResult = querySchema.safeParse({
      orgId: searchParams.get('orgId') ?? undefined,
    });

    if (!queryResult.success) {
      return errors.badRequest(queryResult.error.errors[0]?.message ?? 'Invalid query parameters');
    }

    const { orgId } = queryResult.data;

    // Get subscription
    const subscription = await FeatureGate.getSubscription(orgId);

    return NextResponse.json({
      success: true,
      subscription,
    });
  } catch (error: unknown) {
    logger.error('Error getting subscription', error, { route: '/api/subscription' });
    return errors.database('Failed to get subscription', error instanceof Error ? error : undefined);
  }
}

/**
 * POST /api/subscription
 * Update subscription plan
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody: unknown = await request.json();
    const bodyResult = postBodySchema.safeParse(rawBody);

    if (!bodyResult.success) {
      return errors.badRequest(bodyResult.error.errors[0]?.message ?? 'Invalid request body');
    }

    const { orgId, plan, billingCycle } = bodyResult.data;

    // Update subscription
    const subscription = await FeatureGate.updatePlan(
      orgId,
      plan as SubscriptionPlan,
      billingCycle
    );

    return NextResponse.json({
      success: true,
      message: `Subscription updated to ${plan} plan`,
      subscription,
    });
  } catch (error: unknown) {
    logger.error('Error updating subscription', error, { route: '/api/subscription' });
    return errors.database('Failed to update subscription', error instanceof Error ? error : undefined);
  }
}
