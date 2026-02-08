/**
 * Start Deal Monitor API
 *
 * POST /api/crm/deals/monitor/start
 *
 * Starts real-time deal monitoring via Signal Bus.
 * Observes deal signals and generates automated recommendations.
 * Part of the CRM "Living Ledger" real-time intelligence.
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { startDealMonitor } from '@/lib/crm/deal-monitor';
import { logger } from '@/lib/logger/logger';

/** Request body interface for starting deal monitor */
interface StartDealMonitorRequestBody {
  autoGenerateRecommendations?: boolean;
  autoRecalculateHealth?: boolean;
  signalPriority?: string;
}

/** Parse and validate body with fallback to empty object */
function parseBody(rawBody: unknown): StartDealMonitorRequestBody {
  if (typeof rawBody !== 'object' || rawBody === null) {
    return {};
  }
  const b = rawBody as Record<string, unknown>;
  return {
    autoGenerateRecommendations: typeof b.autoGenerateRecommendations === 'boolean' ? b.autoGenerateRecommendations : undefined,
    autoRecalculateHealth: typeof b.autoRecalculateHealth === 'boolean' ? b.autoRecalculateHealth : undefined,
    signalPriority: typeof b.signalPriority === 'string' ? b.signalPriority : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = 'default';

    // Get config from request body
    const rawBody = await request.json().catch(() => ({})) as unknown;
    const body = parseBody(rawBody);

    const signalPriorityValue = body.signalPriority;
    const validPriorities = ['Low', 'Medium', 'High'] as const;
    const signalPriority: 'Low' | 'Medium' | 'High' = (signalPriorityValue && validPriorities.includes(signalPriorityValue as typeof validPriorities[number]))
      ? signalPriorityValue as 'Low' | 'Medium' | 'High'
      : 'Medium';

    const config = {
      workspaceId,
      autoGenerateRecommendations: body.autoGenerateRecommendations ?? true,
      autoRecalculateHealth: body.autoRecalculateHealth ?? true,
      signalPriority,
    };

    logger.info('Starting deal monitor', config);

    // Start monitoring
    startDealMonitor(config);

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
  } catch (error) {
    logger.error('Failed to start deal monitor', error instanceof Error ? error : new Error(String(error)));

    const errorMessage = error instanceof Error ? error.message : 'Failed to start deal monitor';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
