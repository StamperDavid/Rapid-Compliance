/**
 * Create Stripe checkout session
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import Stripe from 'stripe';
import { getAPIKey } from '@/lib/config/api-keys';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

interface CustomerInfo {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface RequestPayload {
  workspaceId?: string;
  customerInfo: CustomerInfo;
  shippingAddress?: Address;
  billingAddress?: Address;
  shippingMethodId?: string;
}

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

    const body = await request.json() as RequestPayload;
    const { workspaceId = 'default', customerInfo, shippingAddress, billingAddress, shippingMethodId } = body;

    // Penthouse model: use PLATFORM_ID
    const { PLATFORM_ID } = await import('@/lib/constants/platform');

    if (!customerInfo?.email) {
      return errors.badRequest('Customer information required');
    }

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

    // Create a pending order so the webhook can update it after payment
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    // Create line items
    // Prices are stored in cents in Firestore. Stripe expects cents.
    // Guard: if a price looks like dollars (< 100 for any real product), convert to cents.
    const lineItems = cart.items.map((item: CartItem) => {
      // Ensure price is in cents - if it looks like dollars (has decimals), convert
      const priceInCents = item.price < 1 ? Math.round(item.price * 100)
        : Number.isInteger(item.price) ? item.price
        : Math.round(item.price * 100);

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
            description: item.description,
            images: item.image ? [item.image] : [],
          },
          unit_amount: priceInCents,
        },
        quantity: item.quantity,
      };
    });

    // Create checkout session with complete metadata for webhook processing
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/store/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/store/cart`,
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

    return NextResponse.json({
      success: true,
      sessionId: session.id,
    });
  } catch (error: unknown) {
    logger.error('Checkout session creation error', error instanceof Error ? error : new Error(String(error)), { route: '/api/ecommerce/checkout/create-session' });
    return errors.externalService('Stripe', error instanceof Error ? error : new Error(String(error)));
  }
}
