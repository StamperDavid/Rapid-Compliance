/**
 * Email Sequence Intelligence API Endpoint
 *
 * Rate-limited API for analyzing email sequences with comprehensive insights,
 * pattern detection, and optimization recommendations.
 *
 * POST /api/sequence/analyze
 *
 * Features:
 * - AI-powered pattern detection
 * - Performance optimization recommendations
 * - Timing analysis
 * - A/B test insights
 * - Rate limiting (10 req/min)
 * - Response caching (1 hour TTL)
 *
 * @module api/sequence/analyze
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  sequenceEngine,
  sequenceAnalysisInputSchema,
  createSequenceAnalyzedEvent,
  createPatternDetectedEvent,
  createUnderperformingSequenceEvent,
  createOptimizationNeededEvent,
  type SequenceAnalysisResponse,
  type SequenceAnalysis,
  type SequenceAnalysisInput,
} from '@/lib/sequence';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import { requireAuth } from '@/lib/auth/api-auth';

// ============================================================================
// RATE LIMITING & CACHING
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface CacheEntry {
  data: SequenceAnalysis;
  expiresAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();
const cache = new Map<string, CacheEntry>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Check rate limit for user
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimits.get(userId);
  
  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    };
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }
  
  entry.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Generate cache key
 */
function getCacheKey(input: SequenceAnalysisInput): string {
  return JSON.stringify({
    sequenceId: input.sequenceId,
    sequenceIds: input.sequenceIds,
    startDate: input.startDate,
    endDate: input.endDate,
    recipientSegment: input.recipientSegment,
  });
}

/**
 * Get cached analysis
 */
function getCachedAnalysis(key: string): SequenceAnalysis | null {
  const entry = cache.get(key);
  if (!entry) {return null;}
  
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

/**
 * Cache analysis
 */
function cacheAnalysis(key: string, data: SequenceAnalysis): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * POST /api/sequence/analyze
 * 
 * Analyze email sequences with AI-powered insights
 */
export async function POST(request: NextRequest): Promise<NextResponse<SequenceAnalysisResponse>> {
  const startTime = Date.now();

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult as NextResponse<SequenceAnalysisResponse>;
    }

    // Extract user ID from request (in production, use actual auth)
    const userIdHeader = request.headers.get('x-user-id');
    const userId = (userIdHeader !== '' && userIdHeader != null) ? userIdHeader : 'default-user';
    
    // Check rate limit
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)} seconds.`,
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          cached: false,
        },
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
        },
      });
    }
    
    // Parse and validate request body
    const body: unknown = await request.json();

    let validatedInput: SequenceAnalysisInput;
    try {
      validatedInput = sequenceAnalysisInputSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: error.errors,
          },
          metadata: {
            generatedAt: new Date().toISOString(),
            processingTime: Date.now() - startTime,
            cached: false,
          },
        }, { status: 400 });
      }
      throw error;
    }
    
    // Check cache
    const cacheKey = getCacheKey(validatedInput);
    const cachedAnalysis = getCachedAnalysis(cacheKey);
    
    if (cachedAnalysis) {
      return NextResponse.json({
        success: true,
        analysis: cachedAnalysis,
        metadata: {
          generatedAt: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          cached: true,
          cacheExpiresAt: new Date(Date.now() + CACHE_TTL).toISOString(),
        },
      }, {
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          'X-Cache': 'HIT',
        },
      });
    }
    
    // Perform analysis
    const analysis = await sequenceEngine.analyzeSequences(validatedInput);
    
    // Cache result
    cacheAnalysis(cacheKey, analysis);
    
    // Emit signals to Signal Bus
    try {
      const coordinator = getServerSignalCoordinator();
      
      // Main analysis event
      await coordinator.emitSignal(createSequenceAnalyzedEvent(analysis));
      
      // Pattern detection events
      if (analysis.patterns && analysis.patterns.topPatterns.length > 0) {
        for (const pattern of analysis.patterns.topPatterns.slice(0, 3)) {
          await coordinator.emitSignal(
            createPatternDetectedEvent(pattern, analysis.sequences.length)
          );
        }
      }
      
      // Underperforming sequence events
      if (analysis.metrics.length > 0) {
        const avgReplyRate = analysis.summary.avgReplyRate;
        for (const metric of analysis.metrics) {
          if (metric.overallReplyRate < avgReplyRate * 0.7) { // 30% below average
            await coordinator.emitSignal(
              createUnderperformingSequenceEvent(metric, avgReplyRate)
            );
          }
        }
      }
      
      // Critical optimization events
      if (analysis.optimizations && analysis.optimizations.topPriority.length > 0) {
        for (const rec of analysis.optimizations.topPriority.filter(r => r.priority === 'critical')) {
          await coordinator.emitSignal(
            createOptimizationNeededEvent(rec, analysis.sequences[0]?.id || 'unknown')
          );
        }
      }
    } catch (signalError) {
      console.error('Error emitting signals:', signalError);
      // Don't fail the request if signal emission fails
    }
    
    // Return analysis
    return NextResponse.json({
      success: true,
      analysis,
      metadata: {
        generatedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        cached: false,
        cacheExpiresAt: new Date(Date.now() + CACHE_TTL).toISOString(),
      },
    }, {
      headers: {
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
        'X-Cache': 'MISS',
      },
    });
    
  } catch (error) {
    console.error('Error analyzing sequences:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to analyze sequences',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        cached: false,
      },
    }, { status: 500 });
  }
}

// ============================================================================
// PERIODIC CACHE CLEANUP
// ============================================================================

/**
 * Clean up expired cache entries
 * Should be called periodically (e.g., every 5 minutes)
 */
function cleanupExpiredCache(): void {
  const now = Date.now();
  
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredCache, 5 * 60 * 1000);
}
