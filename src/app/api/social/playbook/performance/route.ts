/**
 * API Route: Performance Pattern Analysis
 *
 * POST /api/social/playbook/performance → Analyze engagement metrics for patterns
 * PUT  /api/social/playbook/performance → Apply detected patterns to active playbook
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/playbook/performance');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { analyzePerformancePatterns } = await import('@/lib/social/performance-pattern-service');
    const result = await analyzePerformancePatterns();

    logger.info('Performance API: Analysis complete', {
      postsAnalyzed: result.postsAnalyzed,
      patternsFound: result.patterns.length,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    logger.error('Performance API: POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to analyze performance patterns' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/playbook/performance');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    // First run analysis to get fresh patterns
    const { analyzePerformancePatterns, applyPatternsToPlaybook } = await import('@/lib/social/performance-pattern-service');
    const analysis = await analyzePerformancePatterns();

    if (analysis.patterns.length === 0) {
      return NextResponse.json({
        success: true,
        applied: false,
        message: 'No performance patterns detected. Need more published posts with engagement metrics.',
      });
    }

    const result = await applyPatternsToPlaybook(analysis.patterns);

    logger.info('Performance API: Patterns applied', {
      patternsApplied: analysis.patterns.length,
      newVersion: result.newVersion,
    });

    return NextResponse.json({
      success: true,
      applied: true,
      patternsApplied: analysis.patterns.length,
      newVersion: result.newVersion,
    });
  } catch (error: unknown) {
    logger.error('Performance API: PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to apply performance patterns' },
      { status: 500 }
    );
  }
}
