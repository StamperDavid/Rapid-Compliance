/**
 * API Route: Golden Playbook Coaching
 *
 * POST /api/social/playbook/coach → Generate a coaching session with insights
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/playbook/coach');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    // Load active playbook
    const { getActivePlaybook } = await import('@/lib/social/golden-playbook-builder');
    const playbook = await getActivePlaybook();

    if (!playbook) {
      return NextResponse.json(
        { success: false, error: 'No playbook exists. Create one first in the Playbook Versions tab.' },
        { status: 404 }
      );
    }

    // Load recent corrections
    const { CorrectionCaptureService } = await import('@/lib/social/correction-capture-service');
    const corrections = await CorrectionCaptureService.getCorrections({ limit: 50 });

    // Generate coaching session
    const { generateCoachingSession } = await import('@/lib/social/playbook-coaching-service');
    const session = await generateCoachingSession(playbook, corrections);

    logger.info('Coaching API: Session generated', {
      sessionId: session.id,
      insightCount: session.insights.length,
      correctionsAnalyzed: session.correctionsAnalyzed,
    });

    return NextResponse.json({ success: true, session });
  } catch (error: unknown) {
    logger.error('Coaching API: POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to generate coaching session' },
      { status: 500 }
    );
  }
}
