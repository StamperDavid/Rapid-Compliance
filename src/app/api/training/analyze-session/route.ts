/**
 * API endpoint to analyze a training session
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { analyzeTrainingSession } from '@/lib/training/feedback-processor';
import type { TrainingSession } from '@/types/training';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

const AnalyzeSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/training/analyze-session');
    if (rateLimitResponse) {return rateLimitResponse;}

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate request
    const body: unknown = await request.json();
    const parseResult = AnalyzeSessionSchema.safeParse(body);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request body');
    }
    const { sessionId, organizationId } = parseResult.data;


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
  } catch (error: unknown) {
    logger.error('Error analyzing session', error instanceof Error ? error : undefined, { route: '/api/training/analyze-session' });
    return errors.database('Failed to analyze session', error instanceof Error ? error : undefined);
  }
}



















