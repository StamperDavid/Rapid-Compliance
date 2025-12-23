import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  getOrCreateCart,
  addToCart,
  removeFromCart,
  updateCartItemQuantity,
  applyDiscountCode,
  removeDiscountCode,
} from '@/lib/ecommerce/cart-service';
import { z } from 'zod';
import { validateInput } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

const addToCartSchema = z.object({
  sessionId: z.string(),
  workspaceId: z.string(),
  productId: z.string(),
  quantity: z.number().min(1).default(1),
  variantId: z.string().optional(),
  variantOptions: z.record(z.string()).optional(),
});

const updateCartSchema = z.object({
  sessionId: z.string(),
  workspaceId: z.string(),
  itemId: z.string(),
  quantity: z.number().min(0),
});

const discountSchema = z.object({
  sessionId: z.string(),
  workspaceId: z.string(),
  code: z.string(),
});

/**
 * GET /api/ecommerce/cart - Get cart
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/ecommerce/cart');
    if (rateLimitResponse) return rateLimitResponse;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId') || request.headers.get('x-session-id') || 'anonymous';
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return errors.badRequest('workspaceId required');
    }

    const cart = await getOrCreateCart(sessionId, workspaceId, authResult.user?.uid);

    return NextResponse.json({
      success: true,
      cart,
    });
  } catch (error: any) {
    console.error('Error getting cart:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get cart' },
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

    const body = await request.json();
    const validation = validateInput(addToCartSchema, body);

    if (!validation.success) {
      const validationError = validation as { success: false; errors: any };
      const errorDetails = validationError.errors?.errors?.map((e: any) => ({
        path: e.path?.join('.') || 'unknown',
        message: e.message || 'Validation error',
      })) || [];
      
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errorDetails,
        },
        { status: 400 }
      );
    }

    const { sessionId, workspaceId, productId, quantity, variantId, variantOptions } = validation.data;

    const cart = await addToCart(sessionId, workspaceId, productId, quantity, variantId, variantOptions);

    return NextResponse.json({
      success: true,
      cart,
    });
  } catch (error: any) {
    logger.error('Error adding to cart', error, { route: '/api/ecommerce/cart' });
    return errors.database('Failed to add to cart', error);
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

    const body = await request.json();
    const validation = validateInput(updateCartSchema, body);

    if (!validation.success) {
      const validationError = validation as { success: false; errors: any };
      const errorDetails = validationError.errors?.errors?.map((e: any) => ({
        path: e.path?.join('.') || 'unknown',
        message: e.message || 'Validation error',
      })) || [];
      
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errorDetails,
        },
        { status: 400 }
      );
    }

    const { sessionId, workspaceId, itemId, quantity } = validation.data;

    const cart = await updateCartItemQuantity(sessionId, workspaceId, itemId, quantity);

    return NextResponse.json({
      success: true,
      cart,
    });
  } catch (error: any) {
    logger.error('Error updating cart', error, { route: '/api/ecommerce/cart' });
    return errors.database('Failed to update cart', error);
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
    const sessionId = searchParams.get('sessionId') || request.headers.get('x-session-id');
    const workspaceId = searchParams.get('workspaceId');
    const itemId = searchParams.get('itemId');

    if (!sessionId || !workspaceId || !itemId) {
      return NextResponse.json(
        { success: false, error: 'sessionId, workspaceId, and itemId required' },
        { status: 400 }
      );
    }

    const cart = await removeFromCart(sessionId, workspaceId, itemId);

    return NextResponse.json({
      success: true,
      cart,
    });
  } catch (error: any) {
    logger.error('Error removing from cart', error, { route: '/api/ecommerce/cart' });
    return errors.database('Failed to remove from cart', error);
  }
}

