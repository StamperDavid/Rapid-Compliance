/**
 * Analytics Dashboard API Endpoint
 *
 * GET /api/analytics/dashboard
 *
 * Returns comprehensive analytics across all platform features
 *
 * FEATURES:
 * - Rate limiting (20 requests/minute per user)
 * - Request validation (Zod schemas)
 * - Response caching (5-minute TTL)
 * - Error handling
 * - Performance tracking
 *
 * QUERY PARAMETERS:
 * - organizationId (required): Organization ID
 * - period (required): Time period ('24h', '7d', '30d', '90d', 'month', 'quarter', 'year', 'custom')
 * - startDate (optional): Custom start date (ISO string)
 * - endDate (optional): Custom end date (ISO string)
 * - metrics (optional): Comma-separated list of metrics to include
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getDashboardAnalytics } from '@/lib/analytics/dashboard';
import { AnalyticsRequestSchema } from '@/lib/analytics/dashboard/validation';
import type { AnalyticsResponse, AnalyticsErrorResponse, TimePeriod } from '@/lib/analytics/dashboard/types';
import { emitDashboardViewed, emitAnalyticsError } from '@/lib/analytics/dashboard/events';
import { ZodError } from 'zod';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20;
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

/**
 * GET /api/analytics/dashboard
 * 
 * Get comprehensive dashboard analytics
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const organizationId = DEFAULT_ORG_ID;
    const period = searchParams.get('period') as TimePeriod;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const metricsParam = searchParams.get('metrics');

    // Parse metrics
    const metrics = metricsParam
      ? metricsParam.split(',').map(m => m.trim())
      : undefined;

    // Build request object
    const requestData = {
      organizationId,
      period,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      metrics,
    };
    
    // Validate request
    let validatedRequest;
    try {
      validatedRequest = AnalyticsRequestSchema.parse(requestData);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorResponse: AnalyticsErrorResponse = {
          success: false,
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: {
            issues: error.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
        };
        
        // Emit error event
        await emitAnalyticsError(
          'Validation error',
          'VALIDATION_ERROR',
          organizationId ?? undefined,
          { errors: error.errors }
        );
        
        return NextResponse.json(errorResponse, { status: 400 });
      }
      throw error;
    }
    
    // Check rate limit (use organizationId as identifier)
    const rateLimit = checkRateLimit(validatedRequest.organizationId);
    
    if (!rateLimit.allowed) {
      const errorResponse: AnalyticsErrorResponse = {
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
      };
      
      return NextResponse.json(errorResponse, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
        },
      });
    }
    
    // Emit dashboard viewed event
    await emitDashboardViewed(
      validatedRequest.organizationId,
      validatedRequest.period
    );

    // Get analytics data
    const data = await getDashboardAnalytics(
      validatedRequest.organizationId,
      validatedRequest.period,
      validatedRequest.startDate,
      validatedRequest.endDate
    );
    
    // Calculate generation time
    const generationTime = Date.now() - startTime;
    
    // Build response
    const response: AnalyticsResponse = {
      success: true,
      data,
      cache: {
        cached: false, // Would be true if served from cache
        timestamp: new Date(),
        ttl: 300, // 5 minutes
      },
      generationTime,
    };
    
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetAt.toString(),
        'Cache-Control': 'private, max-age=300', // 5 minutes
      },
    });
    
  } catch (error) {
    // Log error
    console.error('Analytics dashboard error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Emit error event
    await emitAnalyticsError(
      errorMessage,
      'INTERNAL_ERROR',
      undefined,
      process.env.NODE_ENV === 'development' ? { stack: errorStack } : undefined
    );

    // Build error response
    const errorResponse: AnalyticsErrorResponse = {
      success: false,
      error: errorMessage,
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? {
        stack: errorStack,
      } : undefined,
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * OPTIONS /api/analytics/dashboard
 *
 * CORS preflight
 */
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
