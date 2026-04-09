/**
 * CRM Invoices API Routes
 * GET /api/crm/invoices - List invoices with filters
 * POST /api/crm/invoices - Create invoice
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getInvoices, createInvoice } from '@/lib/crm/invoice-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { getAuthToken } from '@/lib/auth/server-auth';
import type { InvoiceStatus } from '@/types/invoice';

export const dynamic = 'force-dynamic';

const lineItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional(),
  productName: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).max(100).optional(),
  tax: z.number().min(0).max(100).optional(),
  subtotal: z.number().optional(),
});

const createInvoiceSchema = z.object({
  title: z.string().min(1, 'Invoice title is required'),
  dealId: z.string().optional(),
  quoteId: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  companyName: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1),
  dueDate: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get('status');
    const validStatuses = ['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded', 'all'];
    const status = statusParam && validStatuses.includes(statusParam)
      ? statusParam as InvoiceStatus | 'all'
      : undefined;

    const filters = {
      status,
      dealId: searchParams.get('dealId') ?? undefined,
      quoteId: searchParams.get('quoteId') ?? undefined,
      contactId: searchParams.get('contactId') ?? undefined,
      companyId: searchParams.get('companyId') ?? undefined,
      ownerId: searchParams.get('ownerId') ?? undefined,
    };

    const pageSizeParam = searchParams.get('pageSize');
    const pageSize = parseInt(pageSizeParam ?? '50');

    const result = await getInvoices(filters, { pageSize });

    return NextResponse.json({
      success: true,
      data: result.data,
      hasMore: result.hasMore,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('Invoices GET failed', error instanceof Error ? error : new Error(String(error)));
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
    const parsed = createInvoiceSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const invoice = await createInvoice({
      ...parsed.data,
      status: 'draft',
      lineItems: parsed.data.lineItems.map((item, idx) => ({
        ...item,
        id: item.id ?? `li-${idx + 1}`,
        subtotal: item.subtotal ?? item.quantity * item.unitPrice,
      })),
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
      amountPaid: 0,
      amountDue: 0,
      currency: parsed.data.currency ?? 'USD',
      issueDate: new Date(),
      ownerId: token?.uid,
    });

    return NextResponse.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    logger.error('Invoice POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
