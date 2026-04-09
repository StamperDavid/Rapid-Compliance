/**
 * Quote Conversion API
 * POST /api/crm/quotes/[quoteId]/convert - Convert accepted quote to invoice
 */

import { type NextRequest, NextResponse } from 'next/server';
import { convertQuoteToInvoice } from '@/lib/crm/quote-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { quoteId } = await params;
    const invoiceId = await convertQuoteToInvoice(quoteId);

    return NextResponse.json({
      success: true,
      data: { invoiceId },
    });
  } catch (error) {
    logger.error('Quote conversion failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
