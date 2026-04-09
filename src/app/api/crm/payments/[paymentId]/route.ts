/**
 * Payment Detail API Routes
 * GET /api/crm/payments/[paymentId] - Get single payment
 * PUT /api/crm/payments/[paymentId] - Update payment
 * DELETE /api/crm/payments/[paymentId] - Delete payment
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPayment, updatePayment, deletePayment } from '@/lib/crm/payment-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const updatePaymentSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded', 'cancelled']).optional(),
  amount: z.number().min(0.01).optional(),
  method: z.enum(['credit_card', 'bank_transfer', 'wire', 'check', 'cash', 'paypal', 'stripe', 'other']).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { paymentId } = await params;
    const payment = await getPayment(paymentId);

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: payment });
  } catch (error) {
    logger.error('Payment GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { paymentId } = await params;
    const rawBody: unknown = await request.json();
    const parsed = updatePaymentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const payment = await updatePayment(paymentId, parsed.data);

    return NextResponse.json({ success: true, data: payment });
  } catch (error) {
    logger.error('Payment PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { paymentId } = await params;
    await deletePayment(paymentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Payment DELETE failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
