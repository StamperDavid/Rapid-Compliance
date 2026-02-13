/**
 * API Route: Social Correction Management
 *
 * GET  /api/social/corrections  → List corrections with optional filters
 * POST /api/social/corrections  → Trigger batch analysis of unanalyzed corrections
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

const analyzeSchema = z.object({
  action: z.literal('analyze'),
  playbookId: z.string().min(1),
  minCorrections: z.number().min(1).max(100).optional().default(3),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/corrections');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);

    // If requesting counts only
    if (searchParams.get('counts') === 'true') {
      const { CorrectionCaptureService } = await import('@/lib/social/correction-capture-service');
      const counts = await CorrectionCaptureService.getCorrectionCount();
      return NextResponse.json({ success: true, counts });
    }

    // If requesting patterns
    if (searchParams.get('patterns') === 'true') {
      const { CorrectionCaptureService } = await import('@/lib/social/correction-capture-service');
      const count = parseInt(searchParams.get('limit') ?? '5', 10);
      const patterns = await CorrectionCaptureService.getRecentPatterns(count);
      return NextResponse.json({ success: true, patterns });
    }

    const { CorrectionCaptureService } = await import('@/lib/social/correction-capture-service');

    const platform = searchParams.get('platform') as 'twitter' | 'linkedin' | null;
    const analyzed = searchParams.get('analyzed');
    const limit = searchParams.get('limit');

    const corrections = await CorrectionCaptureService.getCorrections({
      platform: platform ?? undefined,
      analyzed: analyzed !== null ? analyzed === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return NextResponse.json({ success: true, corrections, total: corrections.length });
  } catch (error: unknown) {
    logger.error('Corrections API: GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to list corrections' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/corrections');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const validation = analyzeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { playbookId, minCorrections } = validation.data;

    // Get unanalyzed corrections
    const { getUnanalyzedCorrections, createUpdateFromCorrections } = await import('@/lib/social/golden-playbook-updater');

    const corrections = await getUnanalyzedCorrections(minCorrections);

    if (corrections.length === 0) {
      return NextResponse.json({
        success: true,
        analyzed: false,
        message: `Need at least ${minCorrections} unanalyzed corrections to trigger analysis. Currently have 0.`,
      });
    }

    // Create update request from corrections
    const updateRequest = await createUpdateFromCorrections(playbookId, corrections);

    logger.info('Corrections API: Batch analysis complete', {
      correctionsAnalyzed: corrections.length,
      suggestionsGenerated: updateRequest.improvements.length,
      updateRequestId: updateRequest.id,
    });

    return NextResponse.json({
      success: true,
      analyzed: true,
      updateRequest,
      correctionsAnalyzed: corrections.length,
    });
  } catch (error: unknown) {
    logger.error('Corrections API: POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to analyze corrections' },
      { status: 500 }
    );
  }
}
