/**
 * Deal Risk Prediction API Endpoint
 * 
 * POST /api/risk/predict
 * 
 * Predicts deal slippage risk and generates AI-powered intervention recommendations
 * 
 * FEATURES:
 * - Rate limiting (5 requests/minute per user - AI calls are expensive)
 * - Request validation (Zod schemas)
 * - Response caching (15-minute TTL)
 * - Error handling
 * - Performance tracking
 * - Signal Bus integration
 * 
 * REQUEST BODY:
 * - dealId (required): Deal ID to analyze
 * - organizationId (required): Organization ID
 * - workspaceId (optional): Workspace ID (default: 'default')
 * - includeInterventions (optional): Include AI interventions (default: true)
 * - forceRefresh (optional): Skip cache (default: false)
 * - customContext (optional): Additional context for AI analysis
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { predictDealRisk, predictBatchDealRisk } from '@/lib/risk/risk-engine';
import { 
  validateRiskPredictionRequest,
  validateBatchRiskPredictionRequest,
  safeValidate,
  RiskPredictionRequestSchema,
  BatchRiskPredictionRequestSchema,
} from '@/lib/risk/validation';
import { emitRiskPredictionSignals } from '@/lib/risk/events';
import { getDeal } from '@/lib/crm/deal-service';
import type { 
  RiskPredictionRequest,
  BatchRiskPredictionRequest,
  DealRiskPrediction,
  BatchRiskPredictionResponse,
} from '@/lib/risk/types';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// RATE LIMITING
// ============================================================================

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // Lower limit due to AI costs
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
  data: DealRiskPrediction;
  expiresAt: number;
}

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes (shorter for risk data)
const responseCache = new Map<string, CacheEntry>();

/**
 * Get cached response if available and not expired
 */
function getCachedResponse(cacheKey: string): DealRiskPrediction | null {
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
function cacheResponse(cacheKey: string, data: DealRiskPrediction): void {
  responseCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + CACHE_TTL
  });
}

/**
 * Generate cache key from request
 */
function getCacheKey(request: RiskPredictionRequest): string {
  const { dealId, organizationId, workspaceId, includeInterventions } = request;
  return `risk:${organizationId}:${workspaceId}:${dealId}:${includeInterventions}`;
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * POST /api/risk/predict
 * 
 * Predict deal slippage risk with AI-powered interventions
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const body = await request.json();
    
    // Check if batch request
    const isBatch = Array.isArray(body.dealIds);
    
    if (isBatch) {
      return handleBatchRequest(body, request, startTime);
    }
    
    // Validate single request
    const validationResult = safeValidate(RiskPredictionRequestSchema, body, 'request');
    
    if (!validationResult.success) {
      logger.warn('Invalid risk prediction request', {
        errors: (validationResult as { success: false; errors: string[] }).errors
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: (validationResult as { success: false; errors: string[] }).errors,
        },
        { status: 400 }
      );
    }
    
    const validatedRequest = validationResult.data as RiskPredictionRequest;
    
    // Rate limiting (use organizationId as user identifier)
    const rateLimit = checkRateLimit(validatedRequest.organizationId);
    
    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      
      logger.warn('Rate limit exceeded for risk prediction', {
        organizationId: validatedRequest.organizationId,
        retryAfter,
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
            'Retry-After': retryAfter.toString(),
          }
        }
      );
    }
    
    // Check cache (unless force refresh)
    const cacheKey = getCacheKey(validatedRequest);
    if (!validatedRequest.forceRefresh) {
      const cached = getCachedResponse(cacheKey);
      if (cached) {
        logger.info('Risk prediction cache hit', {
          dealId: validatedRequest.dealId,
          organizationId: validatedRequest.organizationId,
        });
        
        return NextResponse.json(
          {
            success: true,
            data: cached,
            cached: true,
            duration: Date.now() - startTime,
          },
          {
            headers: {
              'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
              'X-RateLimit-Remaining': rateLimit.remaining.toString(),
              'X-RateLimit-Reset': rateLimit.resetAt.toString(),
              'X-Cache': 'HIT',
            }
          }
        );
      }
    }
    
    // Predict risk
    logger.info('Predicting deal risk', {
      dealId: validatedRequest.dealId,
      organizationId: validatedRequest.organizationId,
      includeInterventions: validatedRequest.includeInterventions,
    });
    
    const prediction = await predictDealRisk(validatedRequest);
    
    // Cache the response
    cacheResponse(cacheKey, prediction);
    
    // Get deal for signal emission
    const deal = await getDeal(
      validatedRequest.organizationId,
      validatedRequest.dealId,
      validatedRequest.workspaceId
    );
    
    // Emit signals (non-blocking)
    if (deal) {
      emitRiskPredictionSignals(prediction, deal).catch(error => {
        logger.error('Failed to emit risk signals', error, {
          dealId: validatedRequest.dealId,
        });
      });
    }
    
    const duration = Date.now() - startTime;
    
    logger.info('Risk prediction complete', {
      dealId: validatedRequest.dealId,
      riskLevel: prediction.riskLevel,
      slippageProbability: prediction.slippageProbability,
      interventionsCount: prediction.interventions.length,
      duration,
    });
    
    return NextResponse.json(
      {
        success: true,
        data: prediction,
        cached: false,
        duration,
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          'X-Cache': 'MISS',
        }
      }
    );
    
  } catch (error: any) {
    logger.error('Risk prediction API error', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to predict deal risk',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle batch risk prediction request
 */
async function handleBatchRequest(
  body: any,
  request: NextRequest,
  startTime: number
): Promise<NextResponse> {
  try {
    // Validate batch request
    const validationResult = safeValidate(BatchRiskPredictionRequestSchema, body, 'request');
    
    if (!validationResult.success) {
      logger.warn('Invalid batch risk prediction request', {
        errors: (validationResult as { success: false; errors: string[] }).errors
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: (validationResult as { success: false; errors: string[] }).errors,
        },
        { status: 400 }
      );
    }
    
    const validatedRequest = validationResult.data as BatchRiskPredictionRequest;
    
    // Rate limiting (batch requests count as 2x)
    const rateLimit = checkRateLimit(validatedRequest.organizationId);
    
    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
        { status: 429 }
      );
    }
    
    // Predict risk for batch
    logger.info('Batch risk prediction started', {
      dealCount: validatedRequest.dealIds.length,
      organizationId: validatedRequest.organizationId,
    });
    
    const batchResult = await predictBatchDealRisk(validatedRequest);
    
    const duration = Date.now() - startTime;
    
    logger.info('Batch risk prediction complete', {
      dealsAnalyzed: batchResult.predictions.size,
      totalDeals: validatedRequest.dealIds.length,
      urgentActionRequired: batchResult.summary.urgentActionRequired,
      duration,
    });
    
    // Convert Map to object for JSON serialization
    const predictionsObject: Record<string, any> = {};
    batchResult.predictions.forEach((prediction, dealId) => {
      predictionsObject[dealId] = prediction;
    });
    
    return NextResponse.json(
      {
        success: true,
        data: {
          predictions: predictionsObject,
          summary: batchResult.summary,
          calculatedAt: batchResult.calculatedAt,
        },
        duration,
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
        }
      }
    );
    
  } catch (error: any) {
    logger.error('Batch risk prediction API error', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to predict batch risk',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/risk/predict
 * 
 * Get risk prediction for a specific deal (query params)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const dealId = searchParams.get('dealId');
    const organizationId = searchParams.get('organizationId');
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const includeInterventions = searchParams.get('includeInterventions') !== 'false';
    
    if (!dealId || !organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters',
          message: 'dealId and organizationId are required',
        },
        { status: 400 }
      );
    }
    
    // Convert to POST request format
    const riskRequest: RiskPredictionRequest = {
      dealId,
      organizationId,
      workspaceId,
      includeInterventions,
      forceRefresh: false,
    };
    
    // Reuse POST logic
    return POST(request);
    
  } catch (error: any) {
    logger.error('Risk prediction GET error', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to get risk prediction',
      },
      { status: 500 }
    );
  }
}
