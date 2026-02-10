import { type NextRequest, NextResponse } from 'next/server';
import { executeScheduledWorkflows } from '@/lib/workflows/triggers/schedule-trigger';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * Schedule trigger endpoint
 * Called by Cloud Scheduler or cron job to execute scheduled workflows
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting (strict - internal only)
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/workflows/triggers/schedule');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Verify cron secret (same pattern as cron routes)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      if (process.env.NODE_ENV !== 'development') {
        logger.error('CRON_SECRET not configured - rejecting schedule trigger', new Error('Missing CRON_SECRET'), {
          route: '/api/workflows/triggers/schedule',
        });
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }
    } else if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      logger.error('Unauthorized schedule trigger attempt', new Error('Invalid cron secret'), {
        route: '/api/workflows/triggers/schedule',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await executeScheduledWorkflows();

    return NextResponse.json({
      success: true,
      message: 'Scheduled workflows executed',
    });
  } catch (error: unknown) {
    logger.error('Error executing scheduled workflows', error instanceof Error ? error : new Error(String(error)), { route: '/api/workflows/triggers/schedule' });
    return errors.internal('Failed to execute scheduled workflows', error instanceof Error ? error : undefined);
  }
}
