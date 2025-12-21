/**
 * API endpoint to create a Golden Master update request from training sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { aggregateSuggestions, filterByConfidence } from '@/lib/training/feedback-processor';
import { createUpdateRequest } from '@/lib/training/golden-master-updater';
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
    const { sessionIds, organizationId, goldenMasterId, minConfidence } = body;

    if (!sessionIds || !Array.isArray(sessionIds) || !organizationId || !goldenMasterId) {
      return NextResponse.json(
        { success: false, error: 'Session IDs, organization ID, and Golden Master ID required' },
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

    // Get all training sessions
    const sessions: TrainingSession[] = [];
    for (const sessionId of sessionIds) {
      const session = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/trainingSessions`,
        sessionId
      ) as TrainingSession;
      
      if (session && session.analysis) {
        sessions.push(session);
      }
    }

    if (sessions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No analyzed sessions found' },
        { status: 400 }
      );
    }

    // Aggregate suggestions from all sessions
    const allSuggestions = aggregateSuggestions(sessions);
    
    // Filter by confidence
    const filteredSuggestions = filterByConfidence(
      allSuggestions,
      minConfidence || 0.7
    );

    if (filteredSuggestions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No high-confidence suggestions found' },
        { status: 400 }
      );
    }

    // Create update request
    const updateRequest = await createUpdateRequest(
      organizationId,
      goldenMasterId,
      filteredSuggestions,
      sessionIds
    );

    return NextResponse.json({
      success: true,
      updateRequest,
    });
  } catch (error: any) {
    console.error('Error creating update request:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create update request' },
      { status: 500 }
    );
  }
}


















