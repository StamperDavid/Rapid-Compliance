/**
 * Coaching Insights API Endpoint
 * 
 * POST /api/coaching/insights
 * 
 * Generates AI-powered coaching insights for a sales rep based on performance analysis
 * 
 * FEATURES:
 * - Rate limiting (10 requests/minute per user - AI calls are expensive)
 * - Request validation (Zod schemas)
 * - Response caching (1-hour TTL)
 * - Error handling
 * - Performance tracking
 * - Signal Bus integration
 * 
 * REQUEST BODY:
 * - repId (required): Sales rep user ID
 * - period (required): Time period ('last_7_days', 'last_30_days', 'last_90_days', etc.)
 * - customRange (optional): { startDate: Date, endDate: Date }
 * - includeDetailed (optional): Include detailed analysis (default: true)
 * - includeTraining (optional): Include training suggestions (default: true)
 * - includeActionItems (optional): Include action items (default: true)
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import { CoachingAnalyticsEngine } from '@/lib/coaching/coaching-analytics-engine';
import { CoachingGenerator } from '@/lib/coaching/coaching-generator';
import { 
  validateGenerateCoachingRequest,
  safeValidateGenerateCoachingRequest 
} from '@/lib/coaching/validation';
import { createCoachingInsightsGeneratedEvent } from '@/lib/coaching/events';
import type { 
  GenerateCoachingRequest,
  GenerateCoachingResponse 
} from '@/lib/coaching/types';
import { ZodError } from 'zod';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

// ============================================================================
// RATE LIMITING
// ============================================================================

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // Lower limit due to AI costs
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limiting middleware
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetAt) {
    // Reset or create new limit window
    const resetAt = now + RATE_LIMIT_WINDOW;
    rateLimitMap.set(userId, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt };
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: userLimit.resetAt };
  }
  
  // Increment count
  userLimit.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - userLimit.count,
    resetAt: userLimit.resetAt,
  };
}

// ============================================================================
// SIMPLE IN-MEMORY CACHE
// ============================================================================

interface CacheEntry {
  data: GenerateCoachingResponse;
  expiresAt: number;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const responseCache = new Map<string, CacheEntry>();

/**
 * Get cached response if available and not expired
 */
function getCachedResponse(cacheKey: string): GenerateCoachingResponse | null {
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
function cacheResponse(cacheKey: string, data: GenerateCoachingResponse): void {
  responseCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + CACHE_TTL
  });
}

/**
 * Generate cache key from request
 */
function getCacheKey(request: GenerateCoachingRequest): string {
  const { repId, period, customRange } = request;
  const rangeStr = customRange 
    ? `${customRange.startDate.toISOString()}_${customRange.endDate.toISOString()}`
    : period;
  return `coaching:${repId}:${rangeStr}`;
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * POST /api/coaching/insights
 * 
 * Generate coaching insights for a sales rep
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate request
    const validationResult = safeValidateGenerateCoachingRequest(body);
    
    if (!validationResult.success) {
      logger.warn('Invalid coaching insights request', {
        errors: validationResult.error.errors
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request parameters',
          details: validationResult.error.errors.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }
    
    // Type assertion: validation guarantees required fields are present
    const requestData = validationResult.data as GenerateCoachingRequest;
    
    // Check rate limit
    const rateLimit = checkRateLimit(requestData.repId);
    
    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      
      logger.warn('Rate limit exceeded for coaching insights', {
        repId: requestData.repId,
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
      logger.info('Returning cached coaching insights', {
        repId: requestData.repId,
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
    
    // Generate insights
    logger.info('Generating coaching insights', {
      repId: requestData.repId,
      period: requestData.period
    });
    
    if (!adminDal) {
      return errors.internal('Admin DAL not initialized');
    }

    // Step 1: Analyze performance metrics
    const analyticsEngine = new CoachingAnalyticsEngine(adminDal);
    const performance = await analyticsEngine.analyzeRepPerformance(
      requestData.repId,
      requestData.period,
      requestData.customRange
    );
    
    // Step 2: Generate AI coaching insights
    const generator = new CoachingGenerator();
    const insights = await generator.generateCoachingInsights(performance, {
      includeDetailed: requestData.includeDetailed,
      includeTraining: requestData.includeTraining,
      includeActionItems: requestData.includeActionItems
    });
    
    // Step 3: Emit Signal Bus event
    try {
      const coordinator = getServerSignalCoordinator();
      const event = createCoachingInsightsGeneratedEvent(
        performance,
        insights,
        'gpt-4o',
        Date.now() - startTime
      );
      // Signal coordinator expects the full event object
      await coordinator.emitSignal(event as any);
    } catch (signalError) {
      logger.error('Failed to emit coaching insights signal', { signalError });
      // Don't fail the request if signal emission fails
    }
    
    // Build response
    const processingTimeMs = Date.now() - startTime;
    const response: GenerateCoachingResponse = {
      success: true,
      performance,
      insights,
      metadata: {
        generatedAt: new Date(),
        modelUsed: 'gpt-4o',
        processingTimeMs,
        confidenceScore: insights.confidenceScore
      }
    };
    
    // Cache the response
    cacheResponse(cacheKey, response);
    
    logger.info('Coaching insights generated successfully', {
      repId: requestData.repId,
      recommendationCount: insights.recommendations.length,
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
    logger.error('Error generating coaching insights', { error });
    
    // Emit error signal
    try {
      const coordinator = getServerSignalCoordinator();
      await coordinator.emitSignal({
        type: 'coaching.error' as any,
        timestamp: new Date(),
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        }
      } as any);
    } catch (signalError) {
      logger.error('Failed to emit error signal', { signalError });
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
 * OPTIONS /api/coaching/insights
 * 
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
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
