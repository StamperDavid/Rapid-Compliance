/**
 * Deal Health Check API
 *
 * POST /api/crm/deals/health-check
 *
 * Runs batch health check on all active deals.
 * Calculates health scores and generates recommendations for at-risk deals.
 * Part of the CRM "Living Ledger" automated monitoring.
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { runDealHealthCheck } from '@/lib/crm/deal-monitor';
import { logger } from '@/lib/logger/logger';

export async function POST(_request: NextRequest) {
  try {
    const workspaceId = 'default';

    logger.info('Running deal health check', { workspaceId });

    // Run health check
    const summary = await runDealHealthCheck(workspaceId);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Failed to run health check', error instanceof Error ? error : new Error(String(error)));

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
