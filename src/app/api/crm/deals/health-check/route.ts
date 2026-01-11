/**
 * Deal Health Check API
 * 
 * POST /api/crm/deals/health-check
 * 
 * Runs batch health check on all active deals.
 * Calculates health scores and generates recommendations for at-risk deals.
 * Part of the CRM "Living Ledger" automated monitoring.
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { runDealHealthCheck } from '@/lib/crm/deal-monitor';
import { logger } from '@/lib/logger/logger';

export async function POST(request: NextRequest) {
  try {
    // Get orgId and workspaceId from headers or body
    const body = await request.json().catch(() => ({}));
    const orgIdFromBody = body.organizationId;
    const orgIdFromHeader = request.headers.get('x-organization-id');
    const organizationId = (orgIdFromBody !== '' && orgIdFromBody != null) ? orgIdFromBody 
      : (orgIdFromHeader !== '' && orgIdFromHeader != null) ? orgIdFromHeader 
      : 'default-org';
    
    const wsIdFromBody = body.workspaceId;
    const wsIdFromHeader = request.headers.get('x-workspace-id');
    const workspaceId = (wsIdFromBody !== '' && wsIdFromBody != null) ? wsIdFromBody 
      : (wsIdFromHeader !== '' && wsIdFromHeader != null) ? wsIdFromHeader 
      : 'default';

    logger.info('Running deal health check', {
      organizationId,
      workspaceId,
    });

    // Run health check
    const summary = await runDealHealthCheck(organizationId, workspaceId);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Failed to run health check', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to run health check';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
