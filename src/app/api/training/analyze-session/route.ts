/**
 * API endpoint to analyze a training session
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { analyzeTrainingSession } from '@/lib/training/feedback-processor';
import type { TrainingSession } from '@/types/training';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/training/analyze-session');
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse request
    const body = await request.json();
    const { sessionId, organizationId } = body;

    if (!sessionId || !organizationId) {
      return errors.badRequest('Session ID and organization ID required');
    }

    // Verify access
    if (user.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get the training session
    const session = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/trainingSessions`,
      sessionId
    ) as TrainingSession;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Training session not found' },
        { status: 404 }
      );
    }

    // Analyze the session
    const analysis = await analyzeTrainingSession(session);

    // Update the session with analysis
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/trainingSessions`,
      sessionId,
      {
        ...session,
        analysis,
        status: 'analyzed',
        analyzedAt: new Date().toISOString(),
      },
      false
    );

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error: any) {
    logger.error('Error analyzing session', error, { route: '/api/training/analyze-session' });
    return errors.database('Failed to analyze session', error);
  }
}



















