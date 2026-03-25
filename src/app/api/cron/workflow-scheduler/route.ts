/**
 * Workflow Scheduler Cron Endpoint
 * Polls for scheduled workflows that are due and executes them.
 * Should be called every 1 minute by a cron job (Vercel Cron or external service).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { executeScheduledWorkflows } from '@/lib/workflows/triggers/schedule-trigger';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/workflow-scheduler
 * Execute all due scheduled workflows
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      logger.error('CRON_SECRET not configured - rejecting request', new Error('Missing CRON_SECRET'), {
        route: '/api/cron/workflow-scheduler',
      });
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      logger.error('Unauthorized cron access attempt', new Error('Invalid cron secret'), {
        route: '/api/cron/workflow-scheduler',
        method: 'GET',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting workflow scheduler cron', {
      route: '/api/cron/workflow-scheduler',
    });

    await executeScheduledWorkflows();

    logger.info('Workflow scheduler cron completed', {
      route: '/api/cron/workflow-scheduler',
    });

    return NextResponse.json({
      success: true,
      message: 'Scheduled workflows processed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      'Workflow scheduler cron failed',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/cron/workflow-scheduler' },
    );
    return NextResponse.json(
      { error: 'Workflow scheduler failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
