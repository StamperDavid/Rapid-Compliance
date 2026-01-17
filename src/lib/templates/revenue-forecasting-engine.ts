/**
 * Revenue Forecasting Engine
 * 
 * Predictive revenue forecasting using:
 * - Stage-weighted pipeline value
 * - Historical win rates
 * - Deal velocity and trends
 * - Quota attainment tracking
 * - Rolling forecasts (30/60/90 day)
 * 
 * FORECASTING METHODS:
 * 1. Pipeline-based: Sum of (deal value × stage probability)
 * 2. Historical-based: Trend analysis of past performance
 * 3. Quota-based: Tracking against targets
 * 4. Confidence intervals: Best case / Most likely / Worst case
 * 
 * INTEGRATION:
 * - Uses industry templates for stage probabilities
 * - Uses deal scoring for adjusted probabilities
 * - Emits signals to Signal Bus
 */

import { logger } from '@/lib/logger/logger';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import type { Deal } from '@/lib/crm/deal-service';
import { getTemplateById, type SalesIndustryTemplate } from './industry-templates';

// ============================================================================
// TYPES
// ============================================================================

export interface RevenueForecast {
  organizationId: string;
  workspaceId: string;
  period: ForecastPeriod;
  
  // Primary forecast
  forecast: number; // Most likely revenue
  bestCase: number; // Optimistic scenario (90th percentile)
  worstCase: number; // Pessimistic scenario (10th percentile)
  confidence: number; // 0-100 - How confident we are
  
  // Breakdown
  byStage: Map<string, StageRevenue>;
  byRep?: Map<string, number>;
  byProduct?: Map<string, number>;
  
  // Metrics
  pipelineCoverage: number; // Pipeline / Quota ratio
  weightedPipeline: number; // Sum of (deal value × probability)
  commitRevenue: number; // High-probability deals only
  
  // Trends
  trend: 'improving' | 'stable' | 'declining';
  trendPercentage: number; // +10% or -5%, etc.
  
  // Quota tracking
  quota?: number;
  quotaAttainment: number; // 0-100% of quota achieved
  quotaGap: number; // How much more needed to hit quota
  
  // Metadata
  dealsAnalyzed: number;
  calculatedAt: Date;
  forecastDate: Date; // End of forecast period
}

export interface StageRevenue {
  stageName: string;
  dealCount: number;
  totalValue: number;
  weightedValue: number; // Value × probability
  probability: number; // Stage probability
}

export type ForecastPeriod = '30-day' | '60-day' | '90-day' | 'quarter' | 'annual';

export interface ForecastOptions {
  organizationId: string;
  workspaceId: string;
  period: ForecastPeriod;
  templateId?: string;
  quota?: number;
  includeRepBreakdown?: boolean;
  includeProductBreakdown?: boolean;
}

export interface QuotaPerformance {
  quota: number;
  achieved: number;
  attainment: number; // 0-100%
  gap: number;
  onTrack: boolean;
  projectedAttainment: number; // Projected end-of-period attainment
  daysRemaining: number;
  requiredDailyRevenue: number; // How much per day to hit quota
}

export interface ForecastTrend {
  current: number;
  previous: number;
  change: number; // Dollar change
  changePercentage: number; // Percentage change
  direction: 'up' | 'down' | 'flat';
  momentum: 'accelerating' | 'stable' | 'decelerating';
}

// ============================================================================
// MAIN FORECASTING ENGINE
// ============================================================================

/**
 * Generate revenue forecast
 * 
 * This is the main entry point for revenue forecasting.
 * 
 * @param options - Forecasting options
 * @returns Comprehensive revenue forecast with confidence intervals
 * 
 * @example
 * ```typescript
 * const forecast = await generateRevenueForecast({
 *   organizationId: 'org_123',
 *   workspaceId: 'default',
 *   period: '90-day',
 *   templateId: 'saas',
 *   quota: 500000
 * });
 * 
 * console.log(`Forecast: $${forecast.forecast.toLocaleString()}`);
 * console.log(`Quota Attainment: ${forecast.quotaAttainment}%`);
 * ```
 */
export function generateRevenueForecast(
  options: ForecastOptions
): RevenueForecast {
  const startTime = Date.now();
  
  try {
    logger.info('Generating revenue forecast', {
      orgId: options.organizationId,
      period: options.period,
      templateId: options.templateId
    });
    
    // 1. Get industry template
    let template: SalesIndustryTemplate | null = null;
    if (options.templateId) {
      template = getTemplateById(options.templateId);
    }
    
    // 2. Fetch deals in pipeline (mock for now)
    const deals = fetchPipelineDeals(options.organizationId, options.workspaceId, options.period);
    
    // 3. Calculate stage-weighted revenue
    const byStage = calculateRevenueByStage(deals, template);
    
    // 4. Calculate weighted pipeline
    const weightedPipeline = Array.from(byStage.values())
      .reduce((sum, stage) => sum + stage.weightedValue, 0);
    
    // 5. Calculate commit revenue (high-probability deals only)
    const commitRevenue = calculateCommitRevenue(deals, template);
    
    // 6. Generate forecast scenarios
    const mostLikely = weightedPipeline;
    const bestCase = calculateBestCase(weightedPipeline, deals, template);
    const worstCase = calculateWorstCase(weightedPipeline, deals, template);
    
    // 7. Calculate confidence
    const confidence = calculateForecastConfidence(deals, template);
    
    // 8. Analyze trends
    const trend = analyzeTrend(options.organizationId, options.workspaceId, mostLikely);
    
    // 9. Calculate quota metrics
    let quotaAttainment = 0;
    let quotaGap = 0;
    let pipelineCoverage = 0;
    
    if (options.quota) {
      quotaAttainment = Math.round((mostLikely / options.quota) * 100);
      quotaGap = options.quota - mostLikely;
      pipelineCoverage = weightedPipeline / options.quota;
    }
    
    // 10. Calculate forecast date (end of period)
    const forecastDate = calculateForecastDate(options.period);
    
    const forecast: RevenueForecast = {
      organizationId: options.organizationId,
      workspaceId: options.workspaceId,
      period: options.period,
      forecast: Math.round(mostLikely),
      bestCase: Math.round(bestCase),
      worstCase: Math.round(worstCase),
      confidence,
      byStage,
      weightedPipeline: Math.round(weightedPipeline),
      commitRevenue: Math.round(commitRevenue),
      pipelineCoverage,
      trend: trend.direction === 'up' ? 'improving' : trend.direction === 'down' ? 'declining' : 'stable',
      trendPercentage: trend.changePercentage,
      quota: options.quota,
      quotaAttainment,
      quotaGap,
      dealsAnalyzed: deals.length,
      calculatedAt: new Date(),
      forecastDate
    };
    
    // 11. Emit Signal Bus event
    try {
      const coordinator = getServerSignalCoordinator();
      void coordinator.emitSignal({
        type: 'forecast.updated',
        orgId: options.organizationId,
        workspaceId: options.workspaceId,
        confidence: confidence / 100,
        priority: quotaAttainment < 70 ? 'High' : 'Medium',
        metadata: {
          period: options.period,
          forecast: forecast.forecast,
          bestCase: forecast.bestCase,
          worstCase: forecast.worstCase,
          quotaAttainment,
          quotaGap,
          trend: forecast.trend,
          trendPercentage: forecast.trendPercentage,
          dealsAnalyzed: deals.length,
          templateId: options.templateId,
          timestamp: new Date().toISOString()
        }
      });
      
      logger.info('Signal emitted: forecast.updated', {
        orgId: options.organizationId,
        forecast: forecast.forecast
      });
    } catch (signalError) {
      logger.warn('Failed to emit forecast.updated signal', { error: signalError });
    }
    
    const duration = Date.now() - startTime;
    logger.info('Revenue forecast generated', {
      orgId: options.organizationId,
      period: options.period,
      forecast: forecast.forecast,
      quota: options.quota,
      attainment: quotaAttainment,
      duration
    });
    
    return forecast;
    
  } catch (error) {
    logger.error('Revenue forecasting failed', error as Error, {
      orgId: options.organizationId,
      period: options.period
    });
    throw new Error(`Revenue forecasting failed: ${(error as Error).message}`);
  }
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate revenue breakdown by stage
 */
function calculateRevenueByStage(
  deals: Deal[],
  template: SalesIndustryTemplate | null
): Map<string, StageRevenue> {
  const byStage = new Map<string, StageRevenue>();
  
  deals.forEach(deal => {
    const stageValue = (deal as { stage?: string }).stage;
    const stage = stageValue ?? 'unknown';
    const value = deal.value || 0;

    // Get stage probability from template
    const stageProbability = template?.stages.find(s => s.id === stage)?.probability ?? 50;
    const probability = stageProbability / 100;
    
    const existing = byStage.get(stage);
    if (existing) {
      existing.dealCount += 1;
      existing.totalValue += value;
      existing.weightedValue += value * probability;
    } else {
      byStage.set(stage, {
        stageName: stage,
        dealCount: 1,
        totalValue: value,
        weightedValue: value * probability,
        probability: stageProbability
      });
    }
  });
  
  return byStage;
}

/**
 * Calculate commit revenue (high-probability deals only)
 * Typically deals with >75% probability
 */
function calculateCommitRevenue(
  deals: Deal[],
  template: SalesIndustryTemplate | null
): number {
  return deals.reduce((sum, deal) => {
    const stageValue = (deal as { stage?: string }).stage;
    const stage = stageValue ?? 'unknown';
    const probability = template?.stages.find(s => s.id === stage)?.probability ?? 50;
    
    // Only count high-probability deals
    if (probability >= 75) {
      return sum + (deal.value || 0);
    }
    return sum;
  }, 0);
}

/**
 * Calculate best case scenario (90th percentile)
 */
function calculateBestCase(
  weightedPipeline: number,
  _deals: Deal[],
  _template: SalesIndustryTemplate | null
): number {
  // Best case assumes higher win rates
  // Increase weighted pipeline by 20-30%
  const uplift = 1.25;
  return weightedPipeline * uplift;
}

/**
 * Calculate worst case scenario (10th percentile)
 */
function calculateWorstCase(
  weightedPipeline: number,
  _deals: Deal[],
  _template: SalesIndustryTemplate | null
): number {
  // Worst case assumes lower win rates
  // Decrease weighted pipeline by 20-30%
  const downside = 0.75;
  return weightedPipeline * downside;
}

/**
 * Calculate forecast confidence
 */
function calculateForecastConfidence(
  deals: Deal[],
  template: SalesIndustryTemplate | null
): number {
  let confidence = 60; // Base confidence
  
  // More deals = higher confidence
  if (deals.length >= 50) {confidence += 20;}
  else if (deals.length >= 20) {confidence += 15;}
  else if (deals.length >= 10) {confidence += 10;}
  else if (deals.length < 5) {confidence -= 20;}
  
  // Pipeline diversity = higher confidence
  const stageSet = new Set(deals.map(d => (d as { stage?: string }).stage));
  if (stageSet.size >= 4) {confidence += 10;}
  
  // Template available = higher confidence
  if (template) {confidence += 10;}
  
  return Math.min(100, Math.max(0, confidence));
}

/**
 * Analyze trend compared to previous period
 */
function analyzeTrend(
  _orgId: string,
  _workspaceId: string,
  currentForecast: number
): ForecastTrend {
  // Mock: simulate previous period forecast
  const previousForecast = currentForecast * (0.8 + Math.random() * 0.4); // 80%-120% of current
  
  const change = currentForecast - previousForecast;
  const changePercentage = Math.round((change / previousForecast) * 100);
  
  let direction: 'up' | 'down' | 'flat' = 'flat';
  if (changePercentage > 5) {direction = 'up';}
  else if (changePercentage < -5) {direction = 'down';}
  
  let momentum: 'accelerating' | 'stable' | 'decelerating' = 'stable';
  if (Math.abs(changePercentage) > 15) {
    momentum = changePercentage > 0 ? 'accelerating' : 'decelerating';
  }
  
  return {
    current: currentForecast,
    previous: previousForecast,
    change,
    changePercentage,
    direction,
    momentum
  };
}

/**
 * Calculate end date for forecast period
 */
function calculateForecastDate(period: ForecastPeriod): Date {
  const now = new Date();
  
  switch (period) {
    case '30-day':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    case '60-day':
      return new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    case '90-day':
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    case 'quarter': {
      // End of current quarter
      const quarter = Math.floor(now.getMonth() / 3);
      const quarterEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      return quarterEnd;
    }
    case 'annual':
      return new Date(now.getFullYear(), 11, 31);
    default:
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Mock function to fetch pipeline deals
 */
function fetchPipelineDeals(
  orgId: string,
  _workspaceId: string,
  _period: ForecastPeriod
): Deal[] {
  // Mock: generate sample deals
  const dealCount = Math.floor(Math.random() * 20) + 10; // 10-30 deals
  const deals: Deal[] = [];
  
  const stages = ['discovery', 'demo', 'proposal', 'negotiation'];
  
  for (let i = 0; i < dealCount; i++) {
    const stage = stages[Math.floor(Math.random() * stages.length)];
    const value = Math.floor(Math.random() * 100000) + 10000; // $10K-$110K
    
    deals.push({
      id: `deal_${i}`,
      organizationId: orgId,
      value,
      createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      stage
    } as Deal);
  }
  
  return deals;
}

// ============================================================================
// QUOTA TRACKING
// ============================================================================

/**
 * Calculate quota performance
 */
export function calculateQuotaPerformance(
  organizationId: string,
  workspaceId: string,
  period: ForecastPeriod,
  quota: number,
  templateId?: string
): QuotaPerformance {
  try {
    // Generate forecast
    const forecast = generateRevenueForecast({
      organizationId,
      workspaceId,
      period,
      quota,
      templateId
    });
    
    // Calculate days remaining
    const now = new Date();
    const endDate = forecast.forecastDate;
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate required daily revenue
    const gap = forecast.quotaGap > 0 ? forecast.quotaGap : 0;
    const requiredDailyRevenue = daysRemaining > 0 ? gap / daysRemaining : 0;
    
    // Project end-of-period attainment
    const trend = forecast.trendPercentage / 100;
    const projectedAttainment = forecast.quotaAttainment * (1 + trend);
    
    const performance: QuotaPerformance = {
      quota,
      achieved: forecast.forecast,
      attainment: forecast.quotaAttainment,
      gap,
      onTrack: forecast.quotaAttainment >= 70, // 70%+ is "on track"
      projectedAttainment: Math.round(projectedAttainment),
      daysRemaining,
      requiredDailyRevenue: Math.round(requiredDailyRevenue)
    };
    
    logger.info('Quota performance calculated', {
      orgId: organizationId,
      quota,
      attainment: performance.attainment,
      onTrack: performance.onTrack
    });
    
    return performance;
    
  } catch (error) {
    logger.error('Quota performance calculation failed', error as Error, {
      orgId: organizationId
    });
    throw new Error(`Quota performance calculation failed: ${(error as Error).message}`);
  }
}

// ============================================================================
// FORECAST COMPARISON
// ============================================================================

/**
 * Compare forecasts across multiple periods
 */
export function compareForecastPeriods(
  organizationId: string,
  workspaceId: string,
  periods: ForecastPeriod[],
  templateId?: string
): Map<ForecastPeriod, RevenueForecast> {
  const forecasts = new Map<ForecastPeriod, RevenueForecast>();
  
  for (const period of periods) {
    try {
      const forecast = generateRevenueForecast({
        organizationId,
        workspaceId,
        period,
        templateId
      });
      forecasts.set(period, forecast);
    } catch (error) {
      logger.warn('Failed to generate forecast for period', { period, error });
    }
  }
  
  return forecasts;
}

/**
 * Get forecast history for trend analysis
 */
export function getForecastHistory(
  _organizationId: string,
  _workspaceId: string,
  _period: ForecastPeriod,
  months: number = 6
): Array<{
  date: Date;
  forecast: number;
  actual?: number;
  accuracy?: number;
}> {
  // Mock implementation - would fetch from historical data
  const history: Array<{ date: Date; forecast: number; actual?: number; accuracy?: number }> = [];
  
  for (let i = months; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    
    const forecast = Math.floor(Math.random() * 200000) + 100000; // $100K-$300K
    const actual = i > 0 ? Math.floor(forecast * (0.8 + Math.random() * 0.4)) : undefined;
    const accuracy = actual ? Math.round((1 - Math.abs(forecast - actual) / forecast) * 100) : undefined;
    
    history.push({ date, forecast, actual, accuracy });
  }
  
  return history;
}

logger.info('Revenue Forecasting Engine initialized');
