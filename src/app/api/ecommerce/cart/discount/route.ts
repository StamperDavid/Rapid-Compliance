export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { applyDiscountCode, removeDiscountCode } from '@/lib/ecommerce/cart-service';
import { z } from 'zod';
import { validateInput } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

const discountSchema = z.object({
  sessionId: z.string(),
  workspaceId: z.string(),
  organizationId: z.string(),
  code: z.string(),
});

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
 * POST /api/ecommerce/cart/discount - Apply discount code
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/ecommerce/cart/discount');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const validation = validateInput(discountSchema, body);

    if (!validation.success) {
      const validationError = validation as ValidationFailure;
      const errorDetails = validationError.errors?.errors?.map((e: ValidationError) => {
        const joinedPath = e.path?.join('.');
        return {
          path: joinedPath ?? 'unknown',
          message: e.message ?? 'Validation error',
        };
      }) ?? [];

      return errors.validation('Validation failed', errorDetails);
    }

    const { sessionId, workspaceId, organizationId, code } = validation.data;

    const cart = await applyDiscountCode(sessionId, workspaceId, organizationId, code);

    return NextResponse.json({
      success: true,
      cart,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to apply discount code';
    logger.error('Error applying discount', error instanceof Error ? error : new Error(String(error)), { route: '/api/ecommerce/cart/discount' });
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ecommerce/cart/discount - Remove discount code
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId') ?? request.headers.get('x-session-id');
    const workspaceId = searchParams.get('workspaceId');
    const organizationId = searchParams.get('organizationId');
    const code = searchParams.get('code');

    if (!sessionId || !workspaceId || !organizationId || !code) {
      return NextResponse.json(
        { success: false, error: 'sessionId, workspaceId, organizationId, and code required' },
        { status: 400 }
      );
    }

    const cart = await removeDiscountCode(sessionId, workspaceId, organizationId, code);

    return NextResponse.json({
      success: true,
      cart,
    });
  } catch (error: unknown) {
    logger.error('Error removing discount', error instanceof Error ? error : new Error(String(error)), { route: '/api/ecommerce/cart/discount' });
    return errors.database('Failed to remove discount', error instanceof Error ? error : undefined);
  }
}
