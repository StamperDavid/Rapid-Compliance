/**
 * Deal Recommendations API
 * 
 * GET /api/crm/deals/[dealId]/recommendations
 * 
 * Returns AI-powered next best action recommendations for a deal.
 * Part of the CRM "Living Ledger" with real-time intelligence.
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
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
    const organizationId =
(request.headers.get('x-organization-id') !== '' && request.headers.get('x-organization-id') != null) ? request.headers.get('x-organization-id') : 'default-org';
    const workspaceId =(request.headers.get('x-workspace-id') !== '' && request.headers.get('x-workspace-id') != null) ? request.headers.get('x-workspace-id') : 'default';

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
  } catch (error: any) {
    logger.error('Failed to generate recommendations', error, {
      dealId: params.dealId,
    });

    return NextResponse.json(
      {
        success: false,
        error:(error.message !== '' && error.message != null) ? error.message : 'Failed to generate recommendations',
      },
      { status: 500 }
    );
  }
}
