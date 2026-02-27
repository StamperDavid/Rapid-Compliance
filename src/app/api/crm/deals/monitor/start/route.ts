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
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { startDealMonitor } from '@/lib/crm/deal-monitor';
import { logger } from '@/lib/logger/logger';

// Active monitor lifecycle tracking
const activeMonitors = new Map<string, string>(); // org → sessionId
const monitorUnsubscribers = new Map<string, () => void>(); // sessionId → unsubscribe fn

/** Stop a running monitor by session ID */
function stopMonitor(sessionId: string): boolean {
  const unsubscribe = monitorUnsubscribers.get(sessionId);
  if (unsubscribe) {
    unsubscribe();
    monitorUnsubscribers.delete(sessionId);
    // Remove from active monitors
    for (const [orgId, sId] of activeMonitors.entries()) {
      if (sId === sessionId) {
        activeMonitors.delete(orgId);
        break;
      }
    }
    logger.info('Deal monitor stopped', { sessionId });
    return true;
  }
  return false;
}

const StartMonitorSchema = z.object({
  autoGenerateRecommendations: z.boolean().optional(),
  autoRecalculateHealth: z.boolean().optional(),
  signalPriority: z.enum(['Low', 'Medium', 'High']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const orgId = 'default';

    // Get config from request body — body is optional for this endpoint
    const rawBody: unknown = await request.json().catch(() => ({}));
    const parsed = StartMonitorSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const config = {
      autoGenerateRecommendations: parsed.data.autoGenerateRecommendations ?? true,
      autoRecalculateHealth: parsed.data.autoRecalculateHealth ?? true,
      signalPriority: parsed.data.signalPriority ?? 'Medium',
    };

    // Check if a monitor is already running for this org
    const existingSessionId = activeMonitors.get(orgId);
    if (existingSessionId) {
      logger.info('Deal monitor already running, returning existing session', {
        sessionId: existingSessionId,
      });
      return NextResponse.json({
        success: true,
        data: {
          message: 'Deal monitor already running',
          sessionId: existingSessionId,
          config,
        },
      });
    }

    logger.info('Starting deal monitor', config);

    // Start monitoring and store unsubscribe function
    const unsubscribe = startDealMonitor(config);
    const sessionId = `monitor_${orgId}_${Date.now()}`;
    activeMonitors.set(orgId, sessionId);
    monitorUnsubscribers.set(sessionId, unsubscribe);

    logger.info('Deal monitor started', { sessionId });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Deal monitor started successfully',
        sessionId,
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

/**
 * DELETE /api/crm/deals/monitor/start
 *
 * Stop a running deal monitor by session ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId query parameter is required' },
        { status: 400 }
      );
    }

    const stopped = stopMonitor(sessionId);

    if (stopped) {
      return NextResponse.json({
        success: true,
        data: { message: 'Deal monitor stopped', sessionId },
      });
    }

    return NextResponse.json(
      { success: false, error: 'No active monitor found with that session ID' },
      { status: 404 }
    );
  } catch (error) {
    logger.error('Failed to stop deal monitor', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to stop deal monitor' },
      { status: 500 }
    );
  }
}
