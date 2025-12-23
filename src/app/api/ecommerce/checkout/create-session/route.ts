/**
 * Create Stripe checkout session
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import Stripe from 'stripe';
import { getAPIKey } from '@/lib/config/api-keys';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/ecommerce/checkout/create-session');
    if (rateLimitResponse) return rateLimitResponse;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { orgId, customerInfo } = body;

    if (!orgId) {
      return errors.badRequest('Organization ID required');
    }

    // Get Stripe API key
    const stripeKey = await getAPIKey(orgId, 'stripe_secret');
    if (!stripeKey) {
      return errors.badRequest('Stripe not configured');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Get cart
    const cart = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/carts`,
      authResult.user.uid
    );

    if (!cart || !cart.items || cart.items.length === 0) {
      return errors.badRequest('Cart is empty');
    }

    // Create line items
    const lineItems = cart.items.map((item: any) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: item.description,
          images: item.image ? [item.image] : [],
        },
        unit_amount: item.price,
      },
      quantity: item.quantity,
    }));

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancel`,
      customer_email: customerInfo.email,
      metadata: {
        organizationId: orgId,
        userId: authResult.user.uid,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
    });
  } catch (error: any) {
    logger.error('Checkout session creation error', error, { route: '/api/ecommerce/checkout/create-session' });
    return errors.externalService('Stripe', error);
  }
}

