/**
 * Deal Recommendations API
 * 
 * GET /api/crm/deals/[dealId]/recommendations
 * 
 * Returns AI-powered next best action recommendations for a deal.
 * Part of the CRM "Living Ledger" with real-time intelligence.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { generateNextBestActions } from '@/lib/crm/next-best-action-engine';
import { logger } from '@/lib/logger/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { dealId: string } }
) {
  try {
    const dealId = params.dealId;

    // Get orgId and workspaceId from headers or session
    // For now, using default values (TODO: Add proper auth)
    const orgIdHeader = request.headers.get('x-organization-id');
    const organizationId = (orgIdHeader !== '' && orgIdHeader != null) ? orgIdHeader : 'default-org';
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
    logger.error('Failed to generate recommendations', error, {
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
