/**
 * Subscription API Routes
 * GET: Get organization's subscription
 * POST: Update subscription plan
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { FeatureGate } from '@/lib/subscription/feature-gate';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * GET /api/subscription?orgId=xxx
 * Get subscription details for organization
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/subscription');
    if (rateLimitResponse) {return rateLimitResponse;}

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return errors.badRequest('Organization ID required');
    }

    // Get subscription
    const subscription = await FeatureGate.getSubscription(orgId);

    return NextResponse.json({
      success: true,
      subscription,
    });
  } catch (error: any) {
    logger.error('Error getting subscription', error, { route: '/api/subscription' });
    return errors.database('Failed to get subscription', error);
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

    const body = await request.json();
    const { orgId, plan, billingCycle } = body;

    if (!orgId) {
      return errors.badRequest('Organization ID required');
    }

    if (!plan) {
      return errors.badRequest('Plan required');
    }

    // Validate plan
    const validPlans = ['starter', 'professional', 'enterprise', 'custom'];
    if (!validPlans.includes(plan)) {
      return errors.badRequest(`Invalid plan. Must be one of: ${validPlans.join(', ')}`);
    }

    // Update subscription
    const subscription = await FeatureGate.updatePlan(
      orgId,
      plan,
      billingCycle || 'monthly'
    );

    return NextResponse.json({
      success: true,
      message: `Subscription updated to ${plan} plan`,
      subscription,
    });
  } catch (error: any) {
    logger.error('Error updating subscription', error, { route: '/api/subscription' });
    return errors.database('Failed to update subscription', error);
  }
}



















