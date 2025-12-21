import { NextRequest, NextResponse } from 'next/server';
import { createBillingPortalSession } from '@/lib/billing/stripe-service';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

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
      return NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Get organization's Stripe customer ID
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, organizationId);

    if (!org?.stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: 'No billing account found. Please set up a subscription first.' },
        { status: 400 }
      );
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
    console.error('Error creating billing portal session:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
}









