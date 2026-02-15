import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { paymentIntentSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/checkout/create-payment-intent');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body: unknown = await request.json();
    const validation = validateInput(paymentIntentSchema, body);

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

    const { amount, currency, metadata } = validation.data;

    if (!currency) {
      return errors.badRequest('Currency is required');
    }

    // Get Stripe keys from API key service
    const stripeKeys = await apiKeyService.getServiceKey(PLATFORM_ID, 'stripe') as { secretKey?: string } | null;

    if (!stripeKeys?.secretKey) {
      return errors.badRequest('Stripe not configured. Please add Stripe API keys in settings.');
    }

    logger.info('Creating payment intent', {
      route: '/api/checkout/create-payment-intent',
      amount,
      currency,
    });

    const stripe = new Stripe(stripeKeys.secretKey, {
      apiVersion: '2023-10-16',
    });

    // Build attribution metadata for Stripe payment intent
    const attributionMetadata: Record<string, string> = {
      userId: user.uid,
    };

    // Preserve attribution fields explicitly in Stripe metadata
    if (metadata) {
      const attrFields = ['leadId', 'dealId', 'formId', 'utm_source', 'utm_medium', 'utm_campaign', 'attributionSource', 'customerEmail'];
      for (const [key, value] of Object.entries(metadata)) {
        if (typeof value === 'string' && value.length > 0) {
          attributionMetadata[key] = value;
        }
      }
      // Ensure attribution fields are always present even with short keys
      for (const field of attrFields) {
        if (metadata[field] && typeof metadata[field] === 'string') {
          attributionMetadata[field] = metadata[field];
        }
      }
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: attributionMetadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    logger.info('Payment intent created successfully', {
      route: '/api/checkout/create-payment-intent',
      paymentIntentId: paymentIntent.id,
      amount,
    });

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    logger.error('Payment intent creation error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/checkout/create-payment-intent',
    });
    return errors.externalService('Stripe', error instanceof Error ? error : undefined);
  }
}

