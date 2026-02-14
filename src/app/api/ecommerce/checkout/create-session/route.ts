/**
 * Create Stripe checkout session
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import Stripe from 'stripe';
import { z } from 'zod';
import { getAPIKey } from '@/lib/config/api-keys';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

const addressSchema = z.object({
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

const checkoutSessionSchema = z.object({
  workspaceId: z.string().optional().default('default'),
  customerInfo: z.object({
    email: z.string().email('Valid email required'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
  }),
  shippingAddress: addressSchema.optional(),
  billingAddress: addressSchema.optional(),
  shippingMethodId: z.string().optional(),
});

interface CartItem {
  name: string;
  description?: string;
  image?: string;
  price: number;
  quantity: number;
}

interface Cart {
  items?: CartItem[];
}


export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/ecommerce/checkout/create-session');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody: unknown = await request.json();
    const parseResult = checkoutSessionSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid checkout data');
    }
    const { workspaceId, customerInfo, shippingAddress, billingAddress, shippingMethodId } = parseResult.data;

    // Penthouse model: use PLATFORM_ID
    const { PLATFORM_ID } = await import('@/lib/constants/platform');

    // Get Stripe API key
    const stripeKey = await getAPIKey('stripe_secret');
    if (!stripeKey) {
      return errors.badRequest('Stripe not configured');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Get cart
    const cart = await FirestoreService.get<Cart>(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/carts`,
      authResult.user.uid
    );

    if (!cart?.items || cart.items.length === 0) {
      return errors.badRequest('Cart is empty');
    }

    // Generate order ID upfront so it can be embedded in Stripe session metadata
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Build Stripe line items — cart prices are stored in cents (integer)
    const lineItems = cart.items.map((item: CartItem) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: item.description,
          images: item.image ? [item.image] : [],
        },
        unit_amount: Math.round(item.price), // cents — no dollar conversion
      },
      quantity: item.quantity,
    }));

    // Create Stripe checkout session FIRST — only create order if this succeeds
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/store/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/store/checkout/cancelled`,
      customer_email: customerInfo.email,
      metadata: {
        orderId,
        workspaceId: workspaceId,
        userId: authResult.user.uid,
        cartId: authResult.user.uid, // Cart ID is the user ID
        customer: JSON.stringify({
          email: customerInfo.email,
          firstName: customerInfo.firstName ?? '',
          lastName: customerInfo.lastName ?? '',
          phone: customerInfo.phone ?? '',
        }),
        shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : JSON.stringify({}),
        billingAddress: billingAddress ? JSON.stringify(billingAddress) : JSON.stringify({}),
        shippingMethodId: shippingMethodId ?? '',
      },
    });

    // Create pending order AFTER Stripe session succeeds (no ghost orders on Stripe failure)
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/orders`,
      orderId,
      {
        id: orderId,
        userId: authResult.user.uid,
        items: cart.items,
        customerInfo,
        shippingAddress: shippingAddress ?? null,
        billingAddress: billingAddress ?? null,
        shippingMethodId: shippingMethodId ?? null,
        stripeSessionId: session.id,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    return NextResponse.json({
      success: true,
      sessionId: session.id,
    });
  } catch (error: unknown) {
    logger.error('Checkout session creation error', error instanceof Error ? error : new Error(String(error)), { route: '/api/ecommerce/checkout/create-session' });
    return errors.externalService('Stripe', error instanceof Error ? error : new Error(String(error)));
  }
}
