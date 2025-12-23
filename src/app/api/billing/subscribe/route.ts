import { NextRequest, NextResponse } from 'next/server';
import { createCustomer, createSubscription } from '@/lib/billing/stripe-service';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { subscriptionCreateSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

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
      return errors.forbidden('Only owners and admins can create subscriptions');
    }

    // Parse and validate input
    const body = await request.json();
    const validation = validateInput(subscriptionCreateSchema, body);

    if (!validation.success) {
      const validationError = validation as { success: false; errors: any };
      const errorDetails = validationError.errors?.errors?.map((e: any) => ({
        path: e.path?.join('.') || 'unknown',
        message: e.message || 'Validation error',
      })) || [];
      
      return errors.validation('Validation failed', errorDetails);
    }

    const { organizationId, email, name, planId, trialDays } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return errors.forbidden('Access denied to this organization');
    }

    logger.info('Creating subscription', {
      route: '/api/billing/subscribe',
      organizationId,
      planId,
      email,
    });

    // Create Stripe customer
    const customer = await createCustomer(email, name, {
      organizationId,
    });

    // Create subscription
    const subscription = await createSubscription(
      customer.id,
      planId,
      organizationId,
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

    logger.info('Subscription created successfully', {
      route: '/api/billing/subscribe',
      subscriptionId: subscription.id,
      customerId: customer.id,
    });

    return NextResponse.json({
      success: true,
      customerId: customer.id,
      subscriptionId: subscription.id,
      clientSecret: 
        typeof subscription.latest_invoice === 'object' && subscription.latest_invoice !== null
          ? (typeof subscription.latest_invoice.payment_intent === 'object' && subscription.latest_invoice.payment_intent !== null
              ? subscription.latest_invoice.payment_intent.client_secret
              : undefined)
          : undefined,
    });
  } catch (error: any) {
    logger.error('Error creating subscription', error, {
      route: '/api/billing/subscribe',
    });
    return errors.externalService('Stripe', error);
  }
}
