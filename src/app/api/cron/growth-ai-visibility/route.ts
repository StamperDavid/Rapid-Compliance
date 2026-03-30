/**
 * GET /api/cron/growth-ai-visibility
 *
 * Weekly cron: AI search visibility sweep for brand monitoring.
 * Schedule: 0 4 * * 3 (Wednesdays at 4AM UTC)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { getAISearchMonitorService } from '@/lib/growth/ai-search-monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request, '/api/cron/growth-ai-visibility');
    if (authError) { return authError; }

    logger.info('Starting weekly AI visibility sweep', {
      route: '/api/cron/growth-ai-visibility',
    });

    const startTime = Date.now();
    const service = getAISearchMonitorService();
    const result = await service.runScheduledCheck();
    const durationMs = Date.now() - startTime;

    logger.info('Weekly AI visibility sweep complete', {
      route: '/api/cron/growth-ai-visibility',
      visibilityScore: result.visibilityScore,
      queriesChecked: result.totalQueriesChecked,
      aiMentions: result.aiOverviewMentions,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      visibilityScore: result.visibilityScore,
      aiOverviewMentions: result.aiOverviewMentions,
      totalQueriesChecked: result.totalQueriesChecked,
      durationMs,
    });
  } catch (err) {
    logger.error(
      'Growth AI visibility cron failed',
      err instanceof Error ? err : new Error(String(err))
    );
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
