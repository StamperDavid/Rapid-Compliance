/**
 * Company Contacts API Route
 * GET /api/crm/companies/[companyId]/contacts - List contacts linked to a company
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getContactsByCompanyId } from '@/lib/crm/contact-service';
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
    const contacts = await getContactsByCompanyId(companyId);

    return NextResponse.json({
      success: true,
      data: contacts,
      count: contacts.length,
    });
  } catch (error) {
    logger.error('Company contacts GET failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
