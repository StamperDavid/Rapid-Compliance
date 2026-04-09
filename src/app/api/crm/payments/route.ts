/**
 * CRM Payments API Routes
 * GET /api/crm/payments - List payments with filters
 * POST /api/crm/payments - Record payment
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPayments, createPayment } from '@/lib/crm/payment-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { getAuthToken } from '@/lib/auth/server-auth';
import type { PaymentStatus, CrmPaymentMethod } from '@/types/payment';

export const dynamic = 'force-dynamic';

const createPaymentSchema = z.object({
  invoiceId: z.string().optional(),
  dealId: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  companyName: z.string().optional(),
  contactName: z.string().optional(),
  amount: z.number().min(0.01, 'Amount must be greater than zero'),
  currency: z.string().optional(),
  method: z.enum(['credit_card', 'bank_transfer', 'wire', 'check', 'cash', 'paypal', 'stripe', 'other']),
  reference: z.string().optional(),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get('status');
    const validStatuses = ['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded', 'cancelled', 'all'];
    const status = statusParam && validStatuses.includes(statusParam)
      ? statusParam as PaymentStatus | 'all'
      : undefined;

    const methodParam = searchParams.get('method');
    const validMethods = ['credit_card', 'bank_transfer', 'wire', 'check', 'cash', 'paypal', 'stripe', 'other'];
    const method = methodParam && validMethods.includes(methodParam)
      ? methodParam as CrmPaymentMethod
      : undefined;

    const filters = {
      status,
      invoiceId: searchParams.get('invoiceId') ?? undefined,
      dealId: searchParams.get('dealId') ?? undefined,
      contactId: searchParams.get('contactId') ?? undefined,
      companyId: searchParams.get('companyId') ?? undefined,
      method,
    };

    const pageSizeParam = searchParams.get('pageSize');
    const pageSize = parseInt(pageSizeParam ?? '50');

    const result = await getPayments(filters, { pageSize });

    return NextResponse.json({
      success: true,
      data: result.data,
      hasMore: result.hasMore,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('Payments GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const token = await getAuthToken(request);

    const rawBody: unknown = await request.json();
    const parsed = createPaymentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const payment = await createPayment({
      ...parsed.data,
      status: 'completed',
      currency: parsed.data.currency ?? 'USD',
      paymentDate: parsed.data.paymentDate ? new Date(parsed.data.paymentDate) : new Date(),
      ownerId: token?.uid,
    });

    return NextResponse.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    logger.error('Payment POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
