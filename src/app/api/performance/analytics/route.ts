/**
 * Performance Analytics API
 * 
 * POST /api/performance/analytics
 * 
 * Generates team-wide performance analytics with benchmarking,
 * top performers, improvement opportunities, and coaching priorities.
 * 
 * RATE LIMITS:
 * - 10 requests per minute per organization
 * 
 * CACHING:
 * - 1 hour TTL (can be bypassed with forceRefresh)
 * 
 * @module api/performance/analytics
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import {
  generatePerformanceAnalytics,
  validatePerformanceAnalyticsRequest,
  type PerformanceAnalyticsRequest,
  type TeamPerformanceAnalytics,
} from '@/lib/performance';

// ============================================================================
// CONFIGURATION
// ============================================================================

const RATE_LIMIT = {
  MAX_REQUESTS: 10,
  WINDOW_MS: 60 * 1000, // 1 minute
};

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ============================================================================
// RATE LIMITING
// ============================================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(organizationId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const key = `performance-analytics:${organizationId}`;
  
  let record = rateLimitMap.get(key);
  
  // Clean up expired records
  if (record && now > record.resetAt) {
    record = undefined;
  }
  
  if (!record) {
    record = {
      count: 0,
      resetAt: now + RATE_LIMIT.WINDOW_MS,
    };
    rateLimitMap.set(key, record);
  }
  
  const allowed = record.count < RATE_LIMIT.MAX_REQUESTS;
  
  if (allowed) {
    record.count++;
  }
  
  return {
    allowed,
    remaining: Math.max(0, RATE_LIMIT.MAX_REQUESTS - record.count),
    resetAt: record.resetAt,
  };
}

// ============================================================================
// CACHING
// ============================================================================

interface CacheEntry {
  data: TeamPerformanceAnalytics;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(request: PerformanceAnalyticsRequest): string {
  const parts = [
    request.organizationId,
(request.workspaceId !== '' && request.workspaceId != null) ? request.workspaceId : 'default',
(request.periodType !== '' && request.periodType != null) ? request.periodType : 'month',
    request.startDate?.toString() ?? '',
    request.endDate?.toString() ?? '',
    request.repIds?.join(',') ?? '',
  ];
  return parts.join(':');
}

function getFromCache(key: string): TeamPerformanceAnalytics | null {
  const entry = cache.get(key);
  if (!entry) {return null;}
  
  const age = Date.now() - entry.cachedAt;
  if (age > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  logger.info('Performance analytics cache hit', { key, age });
  return entry.data;
}

function setCache(key: string, data: TeamPerformanceAnalytics): void {
  cache.set(key, {
    data,
    cachedAt: Date.now(),
  });
  
  // Clean up old entries (keep only last 100)
  if (cache.size > 100) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {cache.delete(oldestKey);}
  }
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. Parse and validate request
    const body = await request.json();
    
    let validatedRequest: PerformanceAnalyticsRequest;
    try {
      validatedRequest = validatePerformanceAnalyticsRequest(body) as PerformanceAnalyticsRequest;
    } catch (error) {
      logger.warn('Invalid performance analytics request', { error });
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_REQUEST',
          message: error instanceof Error ? error.message : 'Invalid request data',
        },
        { status: 400 }
      );
    }
    
    // 2. Check rate limit
    const rateLimit = checkRateLimit(validatedRequest.organizationId);
    
    if (!rateLimit.allowed) {
      logger.warn('Performance analytics rate limit exceeded', {
        organizationId: validatedRequest.organizationId,
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT.MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          },
        }
      );
    }
    
    // 3. Check cache (unless forceRefresh)
    const cacheKey = getCacheKey(validatedRequest);
    
    if (!validatedRequest.forceRefresh) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        const processingTime = Date.now() - startTime;
        
        return NextResponse.json(
          {
            success: true,
            data: cached,
            cached: true,
            processingTime,
          },
          {
            headers: {
              'X-RateLimit-Limit': RATE_LIMIT.MAX_REQUESTS.toString(),
              'X-RateLimit-Remaining': rateLimit.remaining.toString(),
              'X-RateLimit-Reset': rateLimit.resetAt.toString(),
              'X-Cache': 'HIT',
            },
          }
        );
      }
    }
    
    // 4. Generate analytics
    logger.info('Generating performance analytics', {
      organizationId: validatedRequest.organizationId,
      periodType: validatedRequest.periodType,
    });
    
    const analytics = await generatePerformanceAnalytics(validatedRequest);
    
    // 5. Cache result
    setCache(cacheKey, analytics);
    
    const processingTime = Date.now() - startTime;
    
    logger.info('Performance analytics generated', {
      organizationId: validatedRequest.organizationId,
      repsAnalyzed: analytics.repsIncluded,
      conversationsAnalyzed: analytics.conversationsAnalyzed,
      processingTime,
    });
    
    // 6. Return response
    return NextResponse.json(
      {
        success: true,
        data: analytics,
        cached: false,
        processingTime,
      },
      {
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT.MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          'X-Cache': 'MISS',
        },
      }
    );
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Failed to generate performance analytics', {
      error,
      processingTime,
    });
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('No conversation analyses found')) {
        return NextResponse.json(
          {
            success: false,
            error: 'NO_DATA',
            message: 'No conversation data found for the specified period',
          },
          { status: 404 }
        );
      }
      
      if (error.message.includes('No reps meet minimum conversation threshold')) {
        return NextResponse.json(
          {
            success: false,
            error: 'INSUFFICIENT_DATA',
            message: 'Not enough conversations to generate analytics',
          },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to generate performance analytics',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS HANDLER (CORS)
// ============================================================================

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Allow': 'POST, OPTIONS',
      },
    }
  );
}
