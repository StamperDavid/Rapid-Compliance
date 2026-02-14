import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { checkoutCompleteSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

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

    // Create order record from payment intent
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const piMetadata = paymentIntent.metadata ?? {};
    const workspaceId = piMetadata.workspaceId ?? 'default';

    // Extract attribution fields from payment intent metadata
    const attributionSource = piMetadata.attributionSource ?? piMetadata.utm_source ?? undefined;

    const orderRecord = {
      id: orderId,
      paymentIntentId,
      stripePaymentStatus: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      customerEmail: piMetadata.customerEmail ?? _user.email ?? '',
      customerId: _user.uid,
      workspaceId,
      status: 'processing',
      paymentStatus: 'captured',
      source: attributionSource ?? 'web',
      // Attribution chain
      dealId: piMetadata.dealId ?? undefined,
      leadId: piMetadata.leadId ?? undefined,
      formId: piMetadata.formId ?? undefined,
      attributionSource: attributionSource ?? undefined,
      utmSource: piMetadata.utm_source ?? undefined,
      utmMedium: piMetadata.utm_medium ?? undefined,
      utmCampaign: piMetadata.utm_campaign ?? undefined,
      metadata: piMetadata,
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/orders`,
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

