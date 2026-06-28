/**
 * Lead Intelligence API
 * GET /api/leads/[leadId]/intelligence
 *
 * Computes a lead's predictive score + data-quality score SERVER-SIDE. These
 * calculations read the activity history via the Admin SDK (`getActivityStats`),
 * which can ONLY run on the server — the lead detail page previously imported and
 * ran them in the browser, where the Admin SDK is uninitialized ("Admin Firestore
 * DB not initialized"). Moving them behind this route fixes that.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { getLead } from '@/lib/crm/lead-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { leadId } = await params;
    const lead = await getLead(leadId, { useAdminSdk: true });
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    const { calculatePredictiveLeadScore } = await import('@/lib/crm/predictive-scoring');
    const { calculateLeadDataQuality } = await import('@/lib/crm/data-quality');

    const predictiveScore = await calculatePredictiveLeadScore(lead);
    const dataQuality = calculateLeadDataQuality(lead);

    return NextResponse.json({ success: true, predictiveScore, dataQuality });
  } catch (error: unknown) {
    logger.error('Failed to compute lead intelligence', error instanceof Error ? error : new Error(String(error)), { file: 'intelligence/route.ts' });
    return NextResponse.json({ success: false, error: 'Failed to compute lead intelligence' }, { status: 500 });
  }
}
