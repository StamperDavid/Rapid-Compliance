/**
 * Company Deals API Route
 * GET /api/crm/companies/[companyId]/deals - List deals linked to a company
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getDealsByCompanyId } from '@/lib/crm/deal-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { companyId } = await params;
    const deals = await getDealsByCompanyId(companyId);

    return NextResponse.json({
      success: true,
      data: deals,
      count: deals.length,
    });
  } catch (error) {
    logger.error('Company deals GET failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
