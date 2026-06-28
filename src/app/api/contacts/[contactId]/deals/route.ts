/**
 * Contact Deals API Route
 * GET /api/contacts/[contactId]/deals - List deals linked to a contact (by contactId)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { findDealsByContactId } from '@/lib/crm/deal-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { contactId } = await params;
    const deals = await findDealsByContactId(contactId);

    return NextResponse.json({
      success: true,
      data: deals,
      count: deals.length,
    });
  } catch (error) {
    logger.error('Contact deals GET failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
