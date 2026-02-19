/**
 * API endpoint to create a Golden Master update request from training sessions
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService } from '@/lib/db/firestore-service';
import { aggregateSuggestions, filterByConfidence } from '@/lib/training/feedback-processor';
import { createUpdateRequest } from '@/lib/training/golden-master-updater';
import type { TrainingSession } from '@/types/training';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

const CreateUpdateRequestSchema = z.object({
  sessionIds: z.array(z.string().min(1)).min(1, 'At least one session ID is required'),
  goldenMasterId: z.string().min(1, 'Golden Master ID is required'),
  minConfidence: z.number().min(0).max(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/training/create-update-request');
    if (rateLimitResponse) {return rateLimitResponse;}

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user: _user } = authResult;

    // Parse and validate request
    const body: unknown = await request.json();
    const parseResult = CreateUpdateRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request body');
    }
    const { sessionIds, goldenMasterId, minConfidence } = parseResult.data;

    // Get all training sessions
    const sessions: TrainingSession[] = [];
    for (const sessionId of sessionIds) {
      const session = await FirestoreService.get(
        getSubCollection('trainingSessions'),
        sessionId
      ) as TrainingSession;
      
      if (session?.analysis) {
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
      minConfidence ?? 0.7
    );

    if (filteredSuggestions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No high-confidence suggestions found' },
        { status: 400 }
      );
    }

    // Create update request
    const updateRequest = await createUpdateRequest(
      goldenMasterId,
      filteredSuggestions,
      sessionIds
    );

    return NextResponse.json({
      success: true,
      updateRequest,
    });
  } catch (error: unknown) {
    logger.error('Error creating update request', error instanceof Error ? error : new Error(String(error)), { route: '/api/training/create-update-request' });
    return errors.database('Failed to create update request', error instanceof Error ? error : undefined);
  }
}



















