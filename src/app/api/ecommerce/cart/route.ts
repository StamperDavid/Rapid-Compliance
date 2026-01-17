import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  getOrCreateCart,
  addToCart,
  removeFromCart,
  updateCartItemQuantity,
} from '@/lib/ecommerce/cart-service';
import { z } from 'zod';
import { validateInput } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

// TypeScript interfaces for type-safe validation error handling
interface ZodValidationError {
  path: (string | number)[];
  message: string;
}

interface ValidationErrorDetails {
  path: string;
  message: string;
}

const addToCartSchema = z.object({
  sessionId: z.string(),
  workspaceId: z.string(),
  productId: z.string(),
  quantity: z.number().min(1).default(1),
  variantId: z.string().optional(),
  variantOptions: z.record(z.string()).optional(),
  organizationId: z.string().optional(), // Optional for backward compatibility
});

const updateCartSchema = z.object({
  sessionId: z.string(),
  workspaceId: z.string(),
  organizationId: z.string().optional(),
  itemId: z.string(),
  quantity: z.number().min(0),
});

/**
 * GET /api/ecommerce/cart - Get cart
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/ecommerce/cart');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const sessionIdParam = searchParams.get('sessionId');
    const sessionIdHeader = request.headers.get('x-session-id');
    const sessionId = (sessionIdParam !== '' && sessionIdParam != null) ? sessionIdParam :
      ((sessionIdHeader !== '' && sessionIdHeader != null) ? sessionIdHeader : 'anonymous');
    const workspaceId = searchParams.get('workspaceId');
    const organizationId = searchParams.get('organizationId');

    if (!workspaceId) {
      return errors.badRequest('workspaceId required');
    }

    if (!organizationId) {
      return errors.badRequest('organizationId required');
    }

    const cart = await getOrCreateCart(sessionId, workspaceId, organizationId, authResult.user?.uid);

    return NextResponse.json({
      success: true,
      cart,
    });
  } catch (error: unknown) {
    logger.error('Error getting cart', error instanceof Error ? error : undefined, { route: '/api/ecommerce/cart' });
    const errorMessage = error instanceof Error ? error.message : 'Failed to get cart';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ecommerce/cart - Add item to cart
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const validation = validateInput(addToCartSchema, body);

    if (!validation.success) {
      const errorDetails: ValidationErrorDetails[] = validation.errors.errors.map((e: ZodValidationError) => {
        const joinedPath = e.path.join('.');
        return {
          path: joinedPath !== '' ? joinedPath : 'unknown',
          message: e.message !== '' ? e.message : 'Validation error',
        };
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errorDetails,
        },
        { status: 400 }
      );
    }

    const { sessionId, workspaceId, productId, quantity, variantId, variantOptions, organizationId } = validation.data;

    if (!organizationId) {
      return errors.badRequest('organizationId required');
    }

    const cart = await addToCart(sessionId, workspaceId, organizationId, productId, quantity, variantId, variantOptions);

    return NextResponse.json({
      success: true,
      cart,
    });
  } catch (error: unknown) {
    logger.error('Error adding to cart', error instanceof Error ? error : undefined, { route: '/api/ecommerce/cart' });
    return errors.database('Failed to add to cart', error instanceof Error ? error : undefined);
  }
}

/**
 * PATCH /api/ecommerce/cart - Update cart item
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const validation = validateInput(updateCartSchema, body);

    if (!validation.success) {
      const errorDetails: ValidationErrorDetails[] = validation.errors.errors.map((e: ZodValidationError) => {
        const joinedPath = e.path.join('.');
        return {
          path: joinedPath !== '' ? joinedPath : 'unknown',
          message: e.message !== '' ? e.message : 'Validation error',
        };
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errorDetails,
        },
        { status: 400 }
      );
    }

    const { sessionId, workspaceId, itemId, quantity, organizationId } = validation.data;

    if (!organizationId) {
      return errors.badRequest('organizationId required');
    }

    const cart = await updateCartItemQuantity(sessionId, workspaceId, organizationId, itemId, quantity);

    return NextResponse.json({
      success: true,
      cart,
    });
  } catch (error: unknown) {
    logger.error('Error updating cart', error instanceof Error ? error : undefined, { route: '/api/ecommerce/cart' });
    return errors.database('Failed to update cart', error instanceof Error ? error : undefined);
  }
}

/**
 * DELETE /api/ecommerce/cart - Remove item from cart
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const sessionIdParam = searchParams.get('sessionId');
    const sessionIdHeader = request.headers.get('x-session-id');
    const sessionId = (sessionIdParam !== '' && sessionIdParam != null) ? sessionIdParam : sessionIdHeader;
    const workspaceId = searchParams.get('workspaceId');
    const organizationId = searchParams.get('organizationId');
    const itemId = searchParams.get('itemId');

    if (!sessionId || !workspaceId || !organizationId || !itemId) {
      return NextResponse.json(
        { success: false, error: 'sessionId, workspaceId, organizationId, and itemId required' },
        { status: 400 }
      );
    }

    const cart = await removeFromCart(sessionId, workspaceId, organizationId, itemId);

    return NextResponse.json({
      success: true,
      cart,
    });
  } catch (error: unknown) {
    logger.error('Error removing from cart', error instanceof Error ? error : undefined, { route: '/api/ecommerce/cart' });
    return errors.database('Failed to remove from cart', error instanceof Error ? error : undefined);
  }
}

