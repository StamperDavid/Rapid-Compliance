/**
 * Revenue Forecasting API
 * POST /api/templates/forecast - Generate revenue forecast
 */

import { type NextRequest, NextResponse } from 'next/server';
import { generateRevenueForecast, calculateQuotaPerformance, type ForecastPeriod } from '@/lib/templates';
import { RevenueForecastSchema, validateRequestBody } from '@/lib/templates/validation';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware, RateLimitPresets } from '@/lib/middleware/rate-limiter';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/templates/forecast
 * Generate revenue forecast
 *
 * Body:
 * {
 *   workspaceId: string;
 *   period: '30-day' | '60-day' | '90-day' | 'quarter' | 'annual';
 *   quota?: number;
 *   templateId?: string;
 *   includeQuotaPerformance?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Rate limiting: 20 requests per minute (AI operation)
    const rateLimitResponse = await rateLimitMiddleware(request, RateLimitPresets.AI_OPERATIONS);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body: unknown = await request.json();
    
    // Validate request body with Zod schema
    const validation = validateRequestBody(RevenueForecastSchema, body);
    
    if (validation.success === false) {
      const { error, details } = validation;
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        message: error,
        details: details?.errors
      }, { status: 400 });
    }
    
    const {
      workspaceId,
      period,
      quota,
      templateId,
      includeQuotaPerformance
    } = validation.data;
    
    logger.info('Generating revenue forecast', {
      period,
      quota,
      templateId
    });

    const forecast = generateRevenueForecast({
      workspaceId,
      period: period as ForecastPeriod,
      quota,
      templateId
    });

    // Optionally calculate quota performance
    let quotaPerformance = null;
    if (includeQuotaPerformance && quota) {
      quotaPerformance = calculateQuotaPerformance(
        workspaceId,
        period as ForecastPeriod,
        quota,
        templateId
      );
    }
    
    return NextResponse.json({
      success: true,
      forecast,
      quotaPerformance
    });
    
  } catch (error) {
    logger.error('Failed to generate revenue forecast', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json({
      success: false,
      error: 'Failed to generate revenue forecast',
      message: (error as Error).message
    }, { status: 500 });
  }
}
