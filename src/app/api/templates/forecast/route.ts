/**
 * Revenue Forecasting API
 * POST /api/templates/forecast - Generate revenue forecast
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateRevenueForecast, calculateQuotaPerformance } from '@/lib/templates';
import type { ForecastPeriod } from '@/lib/templates';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/templates/forecast
 * Generate revenue forecast
 * 
 * Body:
 * {
 *   organizationId: string;
 *   workspaceId: string;
 *   period: '30-day' | '60-day' | '90-day' | 'quarter' | 'annual';
 *   quota?: number;
 *   templateId?: string;
 *   includeQuotaPerformance?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      organizationId,
      workspaceId,
      period = '90-day',
      quota,
      templateId,
      includeQuotaPerformance = true
    } = body;
    
    if (!organizationId) {
      return NextResponse.json({
        success: false,
        error: 'Missing organizationId'
      }, { status: 400 });
    }
    
    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'Missing workspaceId'
      }, { status: 400 });
    }
    
    logger.info('Generating revenue forecast', {
      orgId: organizationId,
      period,
      quota,
      templateId
    });
    
    const forecast = await generateRevenueForecast({
      organizationId,
      workspaceId,
      period: period as ForecastPeriod,
      quota,
      templateId
    });
    
    // Optionally calculate quota performance
    let quotaPerformance = null;
    if (includeQuotaPerformance && quota) {
      quotaPerformance = await calculateQuotaPerformance(
        organizationId,
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
    logger.error('Failed to generate revenue forecast', error as Error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to generate revenue forecast',
      message: (error as Error).message
    }, { status: 500 });
  }
}
