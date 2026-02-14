/**
 * Create Stripe checkout session
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import Stripe from 'stripe';
import { z } from 'zod';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
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
  productId?: string;
  name: string;
  description?: string;
  image?: string;
  price: number;
  quantity: number;
}

interface Cart {
  items?: CartItem[];
  discountCode?: string;
  discountAmount?: number;
  discountType?: 'percentage' | 'fixed';
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

    // MAJ-3: Standardized Stripe key retrieval via apiKeyService
    const stripeKeys = await apiKeyService.getServiceKey(PLATFORM_ID, 'stripe') as { secretKey?: string } | null;
    if (!stripeKeys?.secretKey) {
      return errors.badRequest('Stripe not configured. Please add Stripe API keys in settings.');
    }

    const stripe = new Stripe(stripeKeys.secretKey, { apiVersion: '2023-10-16' });

    // Get cart (workspace-scoped path matching cart-service)
    const cart = await FirestoreService.get<Cart>(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/workspaces/${workspaceId}/carts`,
      authResult.user.uid
    );

    if (!cart?.items || cart.items.length === 0) {
      return errors.badRequest('Cart is empty');
    }

    // MAJ-6: Validate stock for items with product IDs
    for (const item of cart.items) {
      if (item.productId) {
        const product = await FirestoreService.get<{ stockLevel?: number }>(
          `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/workspaces/${workspaceId}/entities/products/records`,
          item.productId
        );
        if (product && typeof product.stockLevel === 'number' && product.stockLevel < item.quantity) {
          return errors.badRequest(
            `Insufficient stock for "${item.name}". Available: ${product.stockLevel}, Requested: ${item.quantity}`
          );
        }
      }
    }

    // MAJ-4: Calculate discount if cart has one applied
    let discountCents = 0;
    if (cart.discountAmount && cart.discountAmount > 0) {
      const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      if (cart.discountType === 'percentage') {
        discountCents = Math.round(subtotal * cart.discountAmount / 100);
      } else {
        discountCents = Math.round(cart.discountAmount);
      }
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

    // Create ad-hoc Stripe coupon if discount is applied
    const discounts: Array<{ coupon: string }> = [];
    if (discountCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: discountCents,
        currency: 'usd',
        duration: 'once',
        name: cart.discountCode ?? 'Discount',
      });
      discounts.push({ coupon: coupon.id });
    }

    // Create Stripe checkout session FIRST — only create order if this succeeds
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      ...(discounts.length > 0 ? { discounts } : {}),
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
