/**
 * Quotes API Routes
 * GET /api/crm/quotes - List quotes with filters
 * POST /api/crm/quotes - Create quote
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getQuotes, createQuote } from '@/lib/crm/quote-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { getAuthToken } from '@/lib/auth/server-auth';
import type { QuoteStatus } from '@/types/quote';

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

const createQuoteSchema = z.object({
  title: z.string().min(1, 'Quote title is required'),
  dealId: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  companyName: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1),
  validUntil: z.string().optional(),
  terms: z.string().optional(),
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
    const validStatuses = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted', 'all'];
    const status = statusParam && validStatuses.includes(statusParam)
      ? statusParam as QuoteStatus | 'all'
      : undefined;

    const filters = {
      status,
      dealId: searchParams.get('dealId') ?? undefined,
      contactId: searchParams.get('contactId') ?? undefined,
      companyId: searchParams.get('companyId') ?? undefined,
      ownerId: searchParams.get('ownerId') ?? undefined,
    };

    const pageSizeParam = searchParams.get('pageSize');
    const pageSize = parseInt(pageSizeParam ?? '50');

    const result = await getQuotes(filters, { pageSize });

    return NextResponse.json({
      success: true,
      data: result.data,
      hasMore: result.hasMore,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('Quotes GET failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
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
    const parsed = createQuoteSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const quote = await createQuote({
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
      currency: parsed.data.currency ?? 'USD',
      ownerId: token?.uid,
    });

    return NextResponse.json({
      success: true,
      data: quote,
    });
  } catch (error) {
    logger.error('Quote POST failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
