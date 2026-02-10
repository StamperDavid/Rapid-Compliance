/**
 * API Route: Calculate Lead Score
 * 
 * POST /api/lead-scoring/calculate
 * 
 * Calculates AI-powered lead score based on discovery data.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth } from 'firebase-admin/auth';
import adminApp from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { calculateLeadScore, calculateLeadScoresBatch } from '@/lib/services/lead-scoring-engine';
import type { LeadScoreRequest, BatchLeadScoreRequest, LeadScore } from '@/types/lead-scoring';

export const dynamic = 'force-dynamic';

// Zod schema for lead scoring request body
const leadScoringRequestSchema = z.object({
  leadId: z.string().optional(),
  leadIds: z.array(z.string()).optional(),
  scoringRulesId: z.string().optional(),
  forceRescore: z.boolean().optional(),
  discoveryData: z.record(z.unknown()).optional(),
});

/**
 * POST /api/lead-scoring/calculate
 * 
 * Calculate score for a single lead or batch of leads
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!adminApp) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const token = authHeader.substring(7);
    const decodedToken = await getAuth(adminApp).verifyIdToken(token);
    const userId = decodedToken.uid;

    // Parse and validate request body
    const body: unknown = await req.json();
    const validation = leadScoringRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { leadId, leadIds, scoringRulesId, forceRescore, discoveryData } = validation.data;

    // Batch scoring
    if (leadIds && leadIds.length > 0) {
      logger.info('Batch lead scoring request', {
        userId,
        leadsCount: leadIds.length,
      });

      const request: BatchLeadScoreRequest = {
        leadIds,
        scoringRulesId,
        forceRescore,
      };

      const scores = await calculateLeadScoresBatch(request);

      // Convert Map to object for JSON response
      const scoresObj: Record<string, LeadScore> = {};
      scores.forEach((score, id) => {
        scoresObj[id] = score;
      });

      return NextResponse.json({
        success: true,
        scores: scoresObj,
        count: scores.size,
      });
    }

    // Single lead scoring
    if (!leadId) {
      return NextResponse.json(
        { success: false, error: 'leadId or leadIds is required' },
        { status: 400 }
      );
    }

    logger.info('Lead scoring request', {
      userId,
      leadId,
      forceRescore,
    });

    const request: LeadScoreRequest = {
      leadId,
      scoringRulesId,
      forceRescore,
      discoveryData,
    };

    const score = await calculateLeadScore(request);

    return NextResponse.json({
      success: true,
      score,
    });
  } catch (error: unknown) {
    logger.error('Lead scoring API error', error instanceof Error ? error : new Error(String(error)));

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
