/**
 * API Route: Calculate Lead Score
 * 
 * POST /api/lead-scoring/calculate
 * 
 * Calculates AI-powered lead score based on discovery data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import adminApp from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { calculateLeadScore, calculateLeadScoresBatch } from '@/lib/services/lead-scoring-engine';
import type { LeadScoreRequest, BatchLeadScoreRequest } from '@/types/lead-scoring';

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

    // Parse request body
    const body = await req.json();
    const { 
      leadId, 
      leadIds, 
      organizationId, 
      scoringRulesId, 
      forceRescore,
      discoveryData 
    } = body;

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Batch scoring
    if (leadIds && Array.isArray(leadIds)) {
      logger.info('Batch lead scoring request', {
        userId,
        organizationId,
        leadsCount: leadIds.length,
      });

      const request: BatchLeadScoreRequest = {
        leadIds,
        organizationId,
        scoringRulesId,
        forceRescore,
      };

      const scores = await calculateLeadScoresBatch(request);
      
      // Convert Map to object for JSON response
      const scoresObj: Record<string, any> = {};
      scores.forEach((score, leadId) => {
        scoresObj[leadId] = score;
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
      organizationId,
      forceRescore,
    });

    const request: LeadScoreRequest = {
      leadId,
      organizationId,
      scoringRulesId,
      forceRescore,
      discoveryData,
    };

    const score = await calculateLeadScore(request);

    return NextResponse.json({
      success: true,
      score,
    });
  } catch (error) {
    logger.error('Lead scoring API error', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
