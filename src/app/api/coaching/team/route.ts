/**
 * Team Coaching Insights API Endpoint
 * 
 * POST /api/coaching/team
 * 
 * Generates team-wide coaching insights for managers, aggregating individual rep
 * performance into team-level insights, skill gaps, and coaching priorities.
 * 
 * FEATURES:
 * - Rate limiting (5 requests/minute per manager - team analysis is expensive)
 * - Request validation (Zod schemas)
 * - Response caching (1-hour TTL)
 * - Error handling
 * - Performance tracking
 * - Signal Bus integration
 * - Parallel rep analysis with batching
 * 
 * REQUEST BODY:
 * - teamId (required): Team identifier
 * - period (required): Time period ('last_7_days', 'last_30_days', 'last_90_days', etc.)
 * - customRange (optional): { startDate: Date, endDate: Date }
 * - includeRepDetails (optional): Include individual rep metrics (default: true)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import { CoachingAnalyticsEngine } from '@/lib/coaching/coaching-analytics-engine';
import { TeamCoachingEngine } from '@/lib/coaching/team-coaching-engine';
import { 
  safeValidateGenerateTeamCoachingRequest 
} from '@/lib/coaching/validation';
import type { 
  GenerateTeamCoachingRequest,
  GenerateTeamCoachingResponse 
} from '@/lib/coaching/types';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

// ============================================================================
// RATE LIMITING
// ============================================================================

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // Lower limit - team analysis is expensive
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limiting middleware
 */
function checkRateLimit(teamId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const teamLimit = rateLimitMap.get(teamId);
  
  if (!teamLimit || now > teamLimit.resetAt) {
    // Reset or create new limit window
    const resetAt = now + RATE_LIMIT_WINDOW;
    rateLimitMap.set(teamId, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt };
  }
  
  if (teamLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: teamLimit.resetAt };
  }
  
  // Increment count
  teamLimit.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - teamLimit.count,
    resetAt: teamLimit.resetAt,
  };
}

// ============================================================================
// SIMPLE IN-MEMORY CACHE
// ============================================================================

interface CacheEntry {
  data: GenerateTeamCoachingResponse;
  expiresAt: number;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const responseCache = new Map<string, CacheEntry>();

/**
 * Get cached response if available and not expired
 */
function getCachedResponse(cacheKey: string): GenerateTeamCoachingResponse | null {
  const entry = responseCache.get(cacheKey);
  if (!entry) {return null;}
  
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(cacheKey);
    return null;
  }
  
  return entry.data;
}

/**
 * Cache a response
 */
function cacheResponse(cacheKey: string, data: GenerateTeamCoachingResponse): void {
  responseCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + CACHE_TTL
  });
}

/**
 * Generate cache key from request
 */
function getCacheKey(request: GenerateTeamCoachingRequest): string {
  const { teamId, period, customRange, includeRepDetails } = request;
  const rangeStr = customRange 
    ? `${customRange.startDate.toISOString()}_${customRange.endDate.toISOString()}`
    : period;
  const detailsFlag = includeRepDetails ? 'with_details' : 'summary_only';
  return `team_coaching:${teamId}:${rangeStr}:${detailsFlag}`;
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * POST /api/coaching/team
 * 
 * Generate team coaching insights for a manager
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const body: unknown = await request.json();
    
    // Validate request
    const validationResult = safeValidateGenerateTeamCoachingRequest(body);
    
    if (!validationResult.success) {
      logger.warn('Invalid team coaching insights request', {
        errors: JSON.stringify(validationResult.error.errors)
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request parameters',
          details: validationResult.error.errors.map((e) => ({
            field: e.path.map(String).join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }
    
    // Type assertion: validation guarantees required fields are present
    const requestData = validationResult.data as GenerateTeamCoachingRequest;
    
    // Check rate limit
    const rateLimit = checkRateLimit(requestData.teamId);
    
    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      
      logger.warn('Rate limit exceeded for team coaching insights', {
        teamId: requestData.teamId,
        retryAfter
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString()
          }
        }
      );
    }
    
    // Check cache
    const cacheKey = getCacheKey(requestData);
    const cachedResponse = getCachedResponse(cacheKey);
    
    if (cachedResponse) {
      logger.info('Returning cached team coaching insights', {
        teamId: requestData.teamId,
        cacheKey
      });
      
      return NextResponse.json(cachedResponse, {
        headers: {
          'X-Cache': 'HIT',
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString()
        }
      });
    }
    
    // Generate team insights
    logger.info('Generating team coaching insights', {
      teamId: requestData.teamId,
      period: requestData.period
    });
    
    // Step 1: Get team members
    // In a real implementation, fetch team members from database
    // For now, using mock data - you would replace this with actual team member queries
    const teamMemberIds = await getTeamMembers(requestData.teamId);
    const teamName = await getTeamName(requestData.teamId);
    
    if (teamMemberIds.length === 0) {
      logger.warn('No team members found', { teamId: requestData.teamId });
      return NextResponse.json(
        {
          success: false,
          error: 'No team members found for this team'
        },
        { status: 404 }
      );
    }
    
    if (!adminDal) {
      return errors.internal('Admin DAL not initialized');
    }

    // Step 2: Generate team insights
    const analyticsEngine = new CoachingAnalyticsEngine(adminDal);
    const coordinator = getServerSignalCoordinator();
    const teamEngine = new TeamCoachingEngine(analyticsEngine, coordinator);
    
    const teamInsights = await teamEngine.generateTeamInsights(
      requestData,
      teamMemberIds,
      teamName
    );
    
    // Build response
    const processingTimeMs = Date.now() - startTime;
    const response: GenerateTeamCoachingResponse = {
      success: true,
      teamInsights,
      metadata: {
        generatedAt: new Date(),
        modelUsed: 'gpt-4o',
        processingTimeMs
      }
    };
    
    // Cache the response
    cacheResponse(cacheKey, response);
    
    logger.info('Team coaching insights generated successfully', {
      teamId: requestData.teamId,
      repCount: teamInsights.repInsights.length,
      topPerformerCount: teamInsights.topPerformers.length,
      needsSupportCount: teamInsights.needsSupport.length,
      skillGapCount: teamInsights.skillGaps.length,
      processingTimeMs
    });
    
    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetAt.toString()
      }
    });
    
  } catch (error) {
    logger.error('Error generating team coaching insights', error instanceof Error ? error : new Error(String(error)));

    // Emit error signal
    try {
      const coordinator = getServerSignalCoordinator();
      // Using type assertion for signal bus compatibility with custom event types
      await coordinator.emitSignal({
        type: 'coaching.team.error',
        timestamp: new Date(),
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        }
      } as unknown as Parameters<typeof coordinator.emitSignal>[0]);
    } catch (signalError) {
      logger.error('Failed to emit error signal', signalError instanceof Error ? signalError : new Error(String(signalError)));
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS HANDLER (CORS)
// ============================================================================

/**
 * OPTIONS /api/coaching/team
 * 
 * Handle CORS preflight requests
 */
export function OPTIONS(_request: NextRequest) {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    }
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets team member IDs for a team
 * In a real implementation, this would query the database
 * @param teamId - Team identifier
 * @returns Array of team member user IDs
 */
function getTeamMembers(teamId: string): Promise<string[]> {
  // TODO: Implement actual team member query
  // For now, return mock data for development
  logger.warn('Using mock team members - implement actual database query', { teamId });

  // In production, this would be something like:
  // const teamDoc = await adminDal.getDocument(`teams/${teamId}`);
  // return teamDoc?.memberIds || [];

  return Promise.resolve([
    'rep_001',
    'rep_002',
    'rep_003',
    'rep_004',
    'rep_005'
  ]);
}

/**
 * Gets team name for a team
 * In a real implementation, this would query the database
 * @param teamId - Team identifier
 * @returns Team name
 */
function getTeamName(teamId: string): Promise<string> {
  // TODO: Implement actual team name query
  // For now, return mock data for development
  logger.warn('Using mock team name - implement actual database query', { teamId });

  // In production, this would be something like:
  // const teamDoc = await adminDal.getDocument(`teams/${teamId}`);
  // return teamDoc?.name || 'Unknown Team';

  return Promise.resolve(`Sales Team ${teamId}`);
}
