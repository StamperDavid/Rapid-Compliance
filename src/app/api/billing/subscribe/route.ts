import { NextRequest, NextResponse } from 'next/server';
import { createCustomer, createSubscription } from '@/lib/billing/stripe-service';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { subscriptionCreateSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/billing/subscribe');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication - require owner or admin role
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Check if user is owner or admin
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only owners and admins can create subscriptions' },
        { status: 403 }
      );
    }

    // Parse and validate input
    const body = await request.json();
    const validation = validateInput(subscriptionCreateSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { organizationId, email, name, planId, trialDays } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Create Stripe customer
    const customer = await createCustomer(email, name, {
      organizationId,
    });

    // Create subscription
    const subscription = await createSubscription(
      customer.id,
      planId,
      trialDays || 14
    );

    // Update organization with subscription info
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    await FirestoreService.update(COLLECTIONS.ORGANIZATIONS, organizationId, {
      stripeCustomerId: customer.id,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      planId,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    });

    return NextResponse.json({
      success: true,
      customerId: customer.id,
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
