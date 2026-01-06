import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { paymentIntentSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/checkout/create-payment-intent');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body = await request.json();
    const validation = validateInput(paymentIntentSchema, body);

    if (!validation.success) {
      const validationError = validation as { success: false; errors: any };
      const errorDetails = validationError.errors?.errors?.map((e: any) => ({
        path: e.path?.join('.') || 'unknown',
        message: e.message || 'Validation error',
      })) || [];
      
      return errors.validation('Validation failed', errorDetails);
    }

    const { organizationId, amount, currency, metadata } = validation.data;

    if (!currency) {
      return errors.badRequest('Currency is required');
    }

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return errors.forbidden('Access denied to this organization');
    }

    // Get Stripe keys from API key service
    const stripeKeys = await apiKeyService.getServiceKey(organizationId, 'stripe');
    
    if (!stripeKeys?.secretKey) {
      return errors.badRequest('Stripe not configured. Please add Stripe API keys in settings.');
    }

    logger.info('Creating payment intent', {
      route: '/api/checkout/create-payment-intent',
      organizationId,
      amount,
      currency,
    });

    const stripe = new Stripe(stripeKeys.secretKey, {
      apiVersion: '2023-10-16',
    });

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        organizationId,
        userId: user.uid,
        ...metadata,
      },
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
  } catch (error: any) {
    logger.error('Payment intent creation error', error, {
      route: '/api/checkout/create-payment-intent',
      organizationId: (await request.json()).organizationId,
    });
    return errors.externalService('Stripe', error);
  }
}

