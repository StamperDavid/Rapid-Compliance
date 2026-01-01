/**
 * Start Deal Monitor API
 * 
 * POST /api/crm/deals/monitor/start
 * 
 * Starts real-time deal monitoring via Signal Bus.
 * Observes deal signals and generates automated recommendations.
 * Part of the CRM "Living Ledger" real-time intelligence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { startDealMonitor } from '@/lib/crm/deal-monitor';
import { logger } from '@/lib/logger/logger';

export async function POST(request: NextRequest) {
  try {
    // Get config from request body
    const body = await request.json().catch(() => ({}));
    const organizationId =
      body.organizationId ||
      request.headers.get('x-organization-id') ||
      'default-org';
    const workspaceId =
      body.workspaceId || request.headers.get('x-workspace-id') || 'default';

    const config = {
      organizationId,
      workspaceId,
      autoGenerateRecommendations: body.autoGenerateRecommendations ?? true,
      autoRecalculateHealth: body.autoRecalculateHealth ?? true,
      signalPriority: body.signalPriority || 'Medium',
    };

    logger.info('Starting deal monitor', config);

    // Start monitoring
    const unsubscribe = await startDealMonitor(config);

    // Store unsubscribe function (in production, this would be managed server-side)
    // For now, just return success
    // TODO: Add proper monitor lifecycle management

    return NextResponse.json({
      success: true,
      data: {
        message: 'Deal monitor started successfully',
        config,
      },
    });
  } catch (error: any) {
    logger.error('Failed to start deal monitor', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to start deal monitor',
      },
      { status: 500 }
    );
  }
}
