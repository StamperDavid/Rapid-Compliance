import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { checkoutCompleteSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getOrdersCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/checkout/complete');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user: _user } = authResult;

    // Parse and validate input
    const body: unknown = await request.json();
    const validation = validateInput(checkoutCompleteSchema, body);

    if (!validation.success) {
      interface ValidationErrorItem {
        path?: string[];
        message?: string;
      }
      interface ValidationErrorResult {
        success: false;
        errors?: { errors?: ValidationErrorItem[] };
      }
      const validationError = validation as ValidationErrorResult;
      const errorDetails = validationError.errors?.errors?.map((e: ValidationErrorItem) => {
        const joinedPath = e.path?.join('.');
        return {
          path: (joinedPath !== '' && joinedPath != null) ? joinedPath : 'unknown',
          message: (e.message !== '' && e.message != null) ? e.message : 'Validation error',
        };
      }) ?? [];

      return errors.validation('Validation failed', { errors: errorDetails });
    }

    const { paymentIntentId } = validation.data;

    // Get Stripe keys
    const stripeKeys = await apiKeyService.getServiceKey(PLATFORM_ID, 'stripe') as { secretKey?: string } | null;

    if (!stripeKeys?.secretKey) {
      return NextResponse.json(
        { success: false, error: 'Stripe not configured' },
        { status: 400 }
      );
    }

    const stripe = new Stripe(stripeKeys.secretKey, {
      apiVersion: '2023-10-16',
    });

    // Retrieve payment intent to verify status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { success: false, error: `Payment not completed. Status: ${paymentIntent.status}` },
        { status: 400 }
      );
    }

    // Create order record from payment intent (schema aligned with ecommerce checkout)
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const piMetadata = paymentIntent.metadata ?? {};

    // Extract attribution fields from payment intent metadata
    const attributionSource = piMetadata.attributionSource ?? piMetadata.utm_source ?? undefined;

    const orderRecord = {
      id: orderId,
      userId: _user.uid,
      // Canonical order fields (shared with ecommerce checkout)
      items: [{
        name: piMetadata.description ?? 'Payment',
        price: paymentIntent.amount,
        quantity: 1,
      }],
      customerInfo: {
        email: piMetadata.customerEmail ?? _user.email ?? '',
      },
      shippingAddress: null,
      billingAddress: null,
      shippingMethodId: null,
      // Payment tracking
      stripePaymentIntentId: paymentIntentId,
      stripeSessionId: null,
      status: 'processing',
      paymentStatus: 'captured',
      payment: {
        provider: 'stripe',
        transactionId: paymentIntentId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      },
      // Attribution
      source: attributionSource ?? 'web',
      dealId: piMetadata.dealId ?? null,
      leadId: piMetadata.leadId ?? null,
      formId: piMetadata.formId ?? null,
      attributionSource: attributionSource ?? null,
      utmSource: piMetadata.utm_source ?? null,
      utmMedium: piMetadata.utm_medium ?? null,
      utmCampaign: piMetadata.utm_campaign ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      getOrdersCollection(),
      orderId,
      orderRecord
    );

    logger.info('Order created from checkout completion', {
      route: '/api/checkout/complete',
      orderId,
      paymentIntentId,
      amount: paymentIntent.amount,
    });

    return NextResponse.json({
      success: true,
      paymentIntentId,
      orderId,
      status: 'completed',
    });
  } catch (error) {
    logger.error('Checkout completion error', error instanceof Error ? error : new Error(String(error)), { route: '/api/checkout/complete' });
    return errors.externalService('Stripe', error instanceof Error ? error : undefined);
  }
}

