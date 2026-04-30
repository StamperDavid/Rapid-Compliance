/**
 * Create checkout session via the configured payment provider.
 * Stripe uses hosted Checkout Sessions; other providers use the payment-service dispatcher.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { z } from 'zod';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getEcommerceConfig } from '@/lib/ecommerce/types';
import { getCartsCollection, getOrdersCollection, getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { processPayment } from '@/lib/ecommerce/payment-service';

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

interface PaymentProvider {
  provider: string;
  isDefault: boolean;
  enabled: boolean;
}

interface EcommercePaymentConfig {
  payments?: {
    providers?: PaymentProvider[];
  };
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
    const { customerInfo, shippingAddress, billingAddress, shippingMethodId } = parseResult.data;

    // Get cart
    const cart = await AdminFirestoreService.get<Cart>(
      getCartsCollection(),
      authResult.user.uid
    );

    if (!cart?.items || cart.items.length === 0) {
      return errors.badRequest('Cart is empty');
    }

    // Validate stock for items with product IDs
    const ecomConfig = await getEcommerceConfig();
    const productSchema = ecomConfig?.productSchema ?? 'products';
    for (const item of cart.items) {
      if (item.productId) {
        const product = await AdminFirestoreService.get<{ stockLevel?: number }>(
          getSubCollection(productSchema),
          item.productId
        );
        if (product && typeof product.stockLevel === 'number' && product.stockLevel < item.quantity) {
          return errors.badRequest(
            `Insufficient stock for "${item.name}". Available: ${product.stockLevel}, Requested: ${item.quantity}`
          );
        }
      }
    }

    // Calculate discount if cart has one applied
    let discountCents = 0;
    if (cart.discountAmount && cart.discountAmount > 0) {
      const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      if (cart.discountType === 'percentage') {
        discountCents = Math.round(subtotal * cart.discountAmount / 100);
      } else {
        discountCents = Math.round(cart.discountAmount);
      }
    }

    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Determine configured payment provider
    const ecommerceFullConfig = await AdminFirestoreService.get<EcommercePaymentConfig>(
      getSubCollection('ecommerce'),
      'config'
    );

    const defaultProvider = ecommerceFullConfig?.payments?.providers?.find(
      (p) => p.isDefault && p.enabled
    );
    const provider = defaultProvider?.provider ?? 'stripe';

    if (provider === 'stripe') {
      return await handleStripeCheckout(
        cart, customerInfo, shippingAddress, billingAddress,
        shippingMethodId, orderId, discountCents, authResult.user.uid,
      );
    }

    // Non-Stripe: use the payment-service dispatcher
    const totalCents = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const totalDollars = (totalCents - discountCents) / 100;

    const paymentResult = await processPayment({
      amount: totalDollars,
      currency: 'usd',
      paymentMethod: 'card',
      customer: {
        email: customerInfo.email,
        firstName: customerInfo.firstName ?? '',
        lastName: customerInfo.lastName ?? '',
        phone: customerInfo.phone,
      },
      metadata: { orderId, userId: authResult.user.uid },
    });

    if (!paymentResult.success) {
      return errors.internal(paymentResult.error ?? 'Payment provider checkout failed');
    }

    const sessionId = paymentResult.transactionId ?? `${provider}_${Date.now()}`;

    // Create pending order
    await AdminFirestoreService.set(
      getOrdersCollection(),
      orderId,
      {
        id: orderId,
        userId: authResult.user.uid,
        items: cart.items,
        customerInfo,
        shippingAddress: shippingAddress ?? null,
        billingAddress: billingAddress ?? null,
        shippingMethodId: shippingMethodId ?? null,
        paymentProvider: provider,
        providerSessionId: sessionId,
        payment: {
          provider,
          transactionId: paymentResult.transactionId ?? null,
          status: paymentResult.pending ? 'pending' : 'processing',
        },
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    return NextResponse.json({
      success: true,
      sessionId,
      provider,
      redirectUrl: paymentResult.redirectUrl ?? null,
    });
  } catch (error: unknown) {
    logger.error('Checkout session creation error', error instanceof Error ? error : new Error(String(error)), { route: '/api/ecommerce/checkout/create-session' });
    return errors.internal('Checkout session creation failed');
  }
}

/**
 * Stripe-specific checkout session creation (hosted Checkout Sessions with line items + discounts).
 */
async function handleStripeCheckout(
  cart: Cart,
  customerInfo: { email: string; firstName?: string; lastName?: string; phone?: string },
  shippingAddress: Record<string, string | undefined> | undefined,
  billingAddress: Record<string, string | undefined> | undefined,
  shippingMethodId: string | undefined,
  orderId: string,
  discountCents: number,
  userId: string,
): Promise<NextResponse> {
  const stripeKeys = await apiKeyService.getServiceKey(PLATFORM_ID, 'stripe') as { secretKey?: string } | null;
  if (!stripeKeys?.secretKey) {
    return errors.badRequest('Stripe not configured. Please add Stripe API keys in settings.');
  }

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(stripeKeys.secretKey, { apiVersion: '2023-10-16' });

  const cartItems = cart.items ?? [];
  const lineItems = cartItems.map((item: CartItem) => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.name,
        description: item.description,
        images: item.image ? [item.image] : [],
      },
      unit_amount: Math.round(item.price),
    },
    quantity: item.quantity,
  }));

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
      userId,
      cartId: userId,
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

  await AdminFirestoreService.set(
    getOrdersCollection(),
    orderId,
    {
      id: orderId,
      userId,
      items: cart.items,
      customerInfo,
      shippingAddress: shippingAddress ?? null,
      billingAddress: billingAddress ?? null,
      shippingMethodId: shippingMethodId ?? null,
      paymentProvider: 'stripe',
      providerSessionId: session.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );

  return NextResponse.json({
    success: true,
    sessionId: session.id,
    provider: 'stripe',
  });
}
