import { NextRequest, NextResponse } from 'next/server';
import { createBillingPortalSession } from '@/lib/billing/stripe-service';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/billing/portal');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse input
    const body = await request.json();
    const { organizationId } = body;

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return errors.forbidden('Access denied to this organization');
    }

    // Get organization's Stripe customer ID
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, organizationId);

    if (!org?.stripeCustomerId) {
      return errors.badRequest('No billing account found. Please set up a subscription first.');
    }

    // Create billing portal session
    const returnUrl = `${request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL}/workspace/${organizationId}/settings/billing`;
    
    const session = await createBillingPortalSession(
      org.stripeCustomerId,
      returnUrl
    );

    return NextResponse.json({
      success: true,
      url: session.url,
    });
  } catch (error: any) {
    logger.error('Error creating billing portal session', error, { route: '/api/billing/portal' });
    return errors.externalService('Stripe', error);
  }
}










