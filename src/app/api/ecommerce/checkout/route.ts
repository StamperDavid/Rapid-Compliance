import { type NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { processCheckout } from '@/lib/ecommerce/checkout-service';
import { z } from 'zod';
import { validateInput } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

const checkoutSchema = z.object({
  cartId: z.string(),
  organizationId: z.string(),
  workspaceId: z.string(),
  customer: z.object({
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().optional(),
  }),
  billingAddress: z.object({
    firstName: z.string(),
    lastName: z.string(),
    company: z.string().optional(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
    phone: z.string().optional(),
  }),
  shippingAddress: z.object({
    firstName: z.string(),
    lastName: z.string(),
    company: z.string().optional(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
    phone: z.string().optional(),
  }),
  shippingMethodId: z.string().optional(),
  paymentMethod: z.string(),
  paymentToken: z.string().optional(),
  notes: z.string().optional(),
  giftMessage: z.string().optional(),
});

type CheckoutData = z.infer<typeof checkoutSchema>;

interface ValidationError {
  path?: string[];
  message?: string;
}

interface ValidationFailure {
  success: false;
  errors?: {
    errors?: ValidationError[];
  };
}

/**
 * POST /api/ecommerce/checkout - Process checkout
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/ecommerce/checkout');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const validation = validateInput(checkoutSchema, body);

    if (!validation.success) {
      const validationError = validation as ValidationFailure;
      const errorDetails = validationError.errors?.errors?.map((e: ValidationError) => {
        const joinedPath = e.path?.join('.');
        return {
          path: joinedPath ?? 'unknown',
          message: e.message ?? 'Validation error',
        };
      }) ?? [];

      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errorDetails,
        },
        { status: 400 }
      );
    }

    const checkoutData: CheckoutData = validation.data;

    // Verify required fields
    if (!checkoutData.cartId || !checkoutData.organizationId || !checkoutData.workspaceId) {
      return NextResponse.json(
        { success: false, error: 'cartId, organizationId, and workspaceId are required' },
        { status: 400 }
      );
    }

    // Process checkout
    const order = await processCheckout(checkoutData);

    return NextResponse.json({
      success: true,
      order,
      message: 'Order placed successfully',
    });
  } catch (error: unknown) {
    logger.error('Checkout processing error', error, { route: '/api/ecommerce/checkout' });
    return errors.externalService('Checkout service', error instanceof Error ? error : undefined);
  }
}
