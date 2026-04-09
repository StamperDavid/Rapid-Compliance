/**
 * Invoice Detail API Routes
 * GET /api/crm/invoices/[invoiceId] - Get single invoice
 * PUT /api/crm/invoices/[invoiceId] - Update invoice
 * DELETE /api/crm/invoices/[invoiceId] - Delete invoice
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getInvoice, updateInvoice, deleteInvoice } from '@/lib/crm/invoice-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

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

const updateInvoiceSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded']).optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
  dueDate: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  companyName: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { invoiceId } = await params;
    const invoice = await getInvoice(invoiceId);

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    logger.error('Invoice GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { invoiceId } = await params;
    const rawBody: unknown = await request.json();
    const parsed = updateInvoiceSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const invoice = await updateInvoice(invoiceId, parsed.data);

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    logger.error('Invoice PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { invoiceId } = await params;
    await deleteInvoice(invoiceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Invoice DELETE failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
