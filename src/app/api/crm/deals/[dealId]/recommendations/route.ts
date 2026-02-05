/**
 * Deal Recommendations API
 *
 * GET /api/crm/deals/[dealId]/recommendations
 *
 * Returns AI-powered next best action recommendations for a deal.
 * Part of the CRM "Living Ledger" with real-time intelligence.
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { generateNextBestActions } from '@/lib/crm/next-best-action-engine';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

export async function GET(
  request: NextRequest,
  { params }: { params: { dealId: string } }
) {
  try {
    const dealId = params.dealId;

    // Penthouse: orgId is always DEFAULT_ORG_ID
    const organizationId = DEFAULT_ORG_ID;
    const wsIdHeader = request.headers.get('x-workspace-id');
    const workspaceId = (wsIdHeader !== '' && wsIdHeader != null) ? wsIdHeader : 'default';

    logger.info('Generating deal recommendations', {
      dealId,
      organizationId,
      workspaceId,
    });

    // Generate recommendations
    const recommendations = await generateNextBestActions(
      organizationId,
      workspaceId,
      dealId
    );

    return NextResponse.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    logger.error('Failed to generate recommendations', error instanceof Error ? error : new Error(String(error)), {
      dealId: params.dealId,
    });

    const errorMessage = error instanceof Error ? error.message : 'Failed to generate recommendations';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
