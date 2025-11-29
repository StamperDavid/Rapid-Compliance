import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { processCheckout } from '@/lib/ecommerce/checkout-service';
import { z } from 'zod';
import { validateInput } from '@/lib/validation/schemas';

const checkoutSchema = z.object({
  cartId: z.string(),
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

/**
 * POST /api/ecommerce/checkout - Process checkout
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const validation = validateInput(checkoutSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors.errors.map((e: any) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const checkoutData = validation.data;

    // Process checkout
    const order = await processCheckout(checkoutData);

    return NextResponse.json({
      success: true,
      order,
      message: 'Order placed successfully',
    });
  } catch (error: any) {
    console.error('Error processing checkout:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process checkout' },
      { status: 500 }
    );
  }
}

