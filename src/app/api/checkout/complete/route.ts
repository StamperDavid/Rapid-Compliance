import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { checkoutCompleteSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/checkout/complete');
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
    const validation = validateInput(checkoutCompleteSchema, body);

    if (!validation.success) {
      const validationError = validation as { success: false; errors: any };
      const errorDetails = validationError.errors?.errors?.map((e: any) => {
        const joinedPath = e.path?.join('.');
        return {
          path: (joinedPath !== '' && joinedPath != null) ? joinedPath : 'unknown',
          message: (e.message !== '' && e.message != null) ? e.message : 'Validation error',
        };
      }) ?? [];
      
      return errors.validation('Validation failed', errorDetails);
    }

    const { organizationId, paymentIntentId } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Get Stripe keys
    const stripeKeys = await apiKeyService.getServiceKey(organizationId, 'stripe');
    
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

    // Here you would:
    // 1. Create order record in database
    // 2. Update inventory
    // 3. Send confirmation emails
    // 4. Trigger workflows
    // 5. Create customer entity if needed

    return NextResponse.json({
      success: true,
      paymentIntentId,
      orderId: `order_${Date.now()}`,
      status: 'completed',
    });
  } catch (error: any) {
    logger.error('Checkout completion error', error, { route: '/api/checkout/complete' });
    return errors.externalService('Stripe', error instanceof Error ? error : undefined);
  }
}

