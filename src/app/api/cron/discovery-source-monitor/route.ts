/**
 * Discovery Source Monitor Cron Endpoint
 *
 * Runs every 6 hours. Checks all active discovery sources for any that are
 * due for their next scheduled scrape and creates a queued operation for each.
 * After queuing, advances the source's schedule (lastRunAt / nextRunAt).
 *
 * Authentication: Bearer token via CRON_SECRET
 *
 * GET /api/cron/discovery-source-monitor
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { listSources, updateSourceSchedule } from '@/lib/intelligence/discovery-source-service';
import { createOperation } from '@/lib/intelligence/discovery-service';
import { type ScheduleFrequency } from '@/types/intelligence-discovery';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ============================================================================
// TYPES
// ============================================================================

interface OperationStarted {
  sourceId: string;
  sourceName: string;
  operationId: string;
}

interface DiscoverySourceMonitorResponse {
  success: boolean;
  sourcesChecked: number;
  operationsStarted: number;
  sources: OperationStarted[];
  timestamp: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculates the next run timestamp based on the source frequency.
 * All arithmetic is done in milliseconds off a base Date to avoid
 * fractional-day drift.
 */
function computeNextRunAt(frequency: ScheduleFrequency, from: Date): string {
  const MS_PER_HOUR = 60 * 60 * 1000;
  const hoursMap: Record<ScheduleFrequency, number> = {
    daily: 24,
    weekly: 24 * 7,
    biweekly: 24 * 14,
    monthly: 24 * 30,
  };
  const hours = hoursMap[frequency];
  return new Date(from.getTime() + hours * MS_PER_HOUR).toISOString();
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

/**
 * GET /api/cron/discovery-source-monitor
 * Check all active discovery sources and queue operations for those that are due.
 */
export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request, '/api/cron/discovery-source-monitor');
    if (authError) { return authError; }

    logger.info('Starting discovery source monitor', {
      route: '/api/cron/discovery-source-monitor',
      method: 'GET',
    });

    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Load all sources
    const allSources = await listSources();

    // 2. Filter to active, schedule-enabled sources
    const activeSources = allSources.filter(
      (source) => source.status === 'active' && source.schedule.enabled === true
    );

    // 3. Filter to sources that are due
    const dueSources = activeSources.filter((source) => {
      const nextRunAt = source.schedule.nextRunAt;
      return nextRunAt === null || nextRunAt <= nowIso;
    });

    logger.info(`Discovery source monitor: ${allSources.length} total, ${activeSources.length} active, ${dueSources.length} due`, {
      route: '/api/cron/discovery-source-monitor',
    });

    // 4. Create an operation for each due source and advance its schedule
    const operationsStarted: OperationStarted[] = [];

    for (const source of dueSources) {
      try {
        const operation = await createOperation({
          sourceId: source.id,
          sourceName: source.name,
          triggeredBy: 'schedule',
          config: {
            maxRecords: source.maxRecordsPerRun,
            enrichmentDepth: source.enrichmentDepth,
            enableMultiHop: true,
            secondarySources: source.enrichmentHints,
          },
          createdBy: 'cron:discovery-source-monitor',
        });

        // 5. Advance the schedule so the source is not triggered again until next interval
        await updateSourceSchedule(source.id, {
          lastRunAt: nowIso,
          nextRunAt: computeNextRunAt(source.schedule.frequency, now),
        });

        operationsStarted.push({
          sourceId: source.id,
          sourceName: source.name,
          operationId: operation.id,
        });

        logger.info(`Operation queued for source "${source.name}"`, {
          sourceId: source.id,
          operationId: operation.id,
        });
      } catch (sourceError: unknown) {
        const errorMessage = sourceError instanceof Error ? sourceError.message : 'Unknown error';
        const errorObj = sourceError instanceof Error ? sourceError : new Error(String(sourceError));
        logger.error(`Failed to queue operation for source "${source.name}"`, errorObj, {
          sourceId: source.id,
          error: errorMessage,
        });
        // Continue processing remaining sources — one failure must not block others
      }
    }

    const response: DiscoverySourceMonitorResponse = {
      success: true,
      sourcesChecked: activeSources.length,
      operationsStarted: operationsStarted.length,
      sources: operationsStarted,
      timestamp: nowIso,
    };

    logger.info(
      `Discovery source monitor complete: ${operationsStarted.length} operations queued`,
      { operationsStarted: operationsStarted.length }
    );

    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error('Discovery source monitor error', errorObj, {
      route: '/api/cron/discovery-source-monitor',
      method: 'GET',
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
