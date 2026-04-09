/**
 * Quote Detail API Routes
 * GET /api/crm/quotes/[quoteId] - Get single quote
 * PUT /api/crm/quotes/[quoteId] - Update quote
 * DELETE /api/crm/quotes/[quoteId] - Delete quote
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getQuote, updateQuote, deleteQuote } from '@/lib/crm/quote-service';
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

const updateQuoteSchema = z.object({
  title: z.string().min(1).optional(),
  dealId: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  companyName: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted']).optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
  validUntil: z.string().optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { quoteId } = await params;
    const quote = await getQuote(quoteId);

    if (!quote) {
      return NextResponse.json(
        { success: false, error: 'Quote not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: quote });
  } catch (error) {
    logger.error('Quote GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { quoteId } = await params;
    const rawBody: unknown = await request.json();
    const parsed = updateQuoteSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const quote = await updateQuote(quoteId, parsed.data);

    return NextResponse.json({ success: true, data: quote });
  } catch (error) {
    logger.error('Quote PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { quoteId } = await params;
    await deleteQuote(quoteId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Quote DELETE failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
