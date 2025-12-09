/**
 * API endpoint to analyze a training session
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { analyzeTrainingSession } from '@/lib/training/feedback-processor';
import type { TrainingSession } from '@/types/training';

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json(
        { success: false, error: 'Session ID and organization ID required' },
        { status: 400 }
      );
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
    console.error('Error analyzing training session:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to analyze session' },
      { status: 500 }
    );
  }
}










