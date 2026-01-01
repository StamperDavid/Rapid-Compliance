/**
 * Deal Health Check API
 * 
 * POST /api/crm/deals/health-check
 * 
 * Runs batch health check on all active deals.
 * Calculates health scores and generates recommendations for at-risk deals.
 * Part of the CRM "Living Ledger" automated monitoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDealHealthCheck } from '@/lib/crm/deal-monitor';
import { logger } from '@/lib/logger/logger';

export async function POST(request: NextRequest) {
  try {
    // Get orgId and workspaceId from headers or body
    const body = await request.json().catch(() => ({}));
    const organizationId =
      body.organizationId ||
      request.headers.get('x-organization-id') ||
      'default-org';
    const workspaceId =
      body.workspaceId || request.headers.get('x-workspace-id') || 'default';

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
  } catch (error: any) {
    logger.error('Failed to run health check', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run health check',
      },
      { status: 500 }
    );
  }
}
