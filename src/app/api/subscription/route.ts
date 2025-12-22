/**
 * Subscription API Routes
 * GET: Get organization's subscription
 * POST: Update subscription plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeatureGate } from '@/lib/subscription/feature-gate';
import { requireAuth } from '@/lib/auth/api-auth';

/**
 * GET /api/subscription?orgId=xxx
 * Get subscription details for organization
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Get subscription
    const subscription = await FeatureGate.getSubscription(orgId);

    return NextResponse.json({
      success: true,
      subscription,
    });
  } catch (error: any) {
    console.error('[Subscription API] Error getting subscription:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get subscription' },
      { status: 500 }
    );
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
      return NextResponse.json(
        { success: false, error: 'Organization ID required' },
        { status: 400 }
      );
    }

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan required' },
        { status: 400 }
      );
    }

    // Validate plan
    const validPlans = ['starter', 'professional', 'enterprise', 'custom'];
    if (!validPlans.includes(plan)) {
      return NextResponse.json(
        { success: false, error: `Invalid plan. Must be one of: ${validPlans.join(', ')}` },
        { status: 400 }
      );
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
    console.error('[Subscription API] Error updating subscription:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update subscription' },
      { status: 500 }
    );
  }
}



















