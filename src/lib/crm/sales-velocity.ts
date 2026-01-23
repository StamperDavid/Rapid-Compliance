/**
 * Sales Velocity & Pipeline Intelligence
 * Calculate sales metrics like velocity, conversion rates, time-in-stage
 */

import { getDeals, type Deal } from './deal-service';
import { logger } from '@/lib/logger/logger';

export interface SalesVelocityMetrics {
  // Overall velocity
  velocity: number; // Deals value closed per day
  avgDealSize: number;
  avgSalesCycle: number; // Days from creation to close
  winRate: number; // Percentage of deals won
  
  // Stage metrics
  stageMetrics: Map<Deal['stage'], StageMetrics>;
  
  // Conversion rates between stages
  conversionRates: Map<string, number>; // "prospecting->qualification": 0.75
  
  // Forecasting
  forecastedRevenue: number;
  confidenceLevel: number;
  
  // Trends
  trends: {
    velocity30Days: number;
    velocity90Days: number;
    winRate30Days: number;
    winRate90Days: number;
  };
}

export interface StageMetrics {
  stage: Deal['stage'];
  totalDeals: number;
  totalValue: number;
  avgTimeInStage: number; // Days
  avgDealSize: number;
  conversionRate: number; // To next stage
  bottleneckScore: number; // 0-100 (higher = bigger bottleneck)
}

export interface PipelineInsight {
  type: 'warning' | 'info' | 'success';
  priority: 'high' | 'medium' | 'low';
  message: string;
  recommendation?: string;
  affectedDeals?: number;
}

/**
 * Calculate comprehensive sales velocity metrics
 */
export async function calculateSalesVelocity(
  organizationId: string,
  workspaceId: string,
  dateRange?: { start: Date; end: Date }
): Promise<SalesVelocityMetrics> {
  try {
    // Get all deals
    const { data: allDeals } = await getDeals(organizationId, workspaceId);
    
    // Define Firestore timestamp interface
    interface FirestoreTimestamp {
      toDate: () => Date;
    }

    // Filter by date range if provided
    const deals = dateRange
      ? allDeals.filter(d => {
          const createdAtValue = d.createdAt;
          const createdAt = typeof createdAtValue === 'object' && createdAtValue !== null && 'toDate' in createdAtValue
            ? (createdAtValue as FirestoreTimestamp).toDate()
            : new Date(createdAtValue as string | number);
          return createdAt >= dateRange.start && createdAt <= dateRange.end;
        })
      : allDeals;

    // Separate closed deals
    const closedWonDeals = deals.filter(d => d.stage === 'closed_won');
    const closedLostDeals = deals.filter(d => d.stage === 'closed_lost');
    const closedDeals = [...closedWonDeals, ...closedLostDeals];
    const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost');

    // Calculate avg deal size
    const avgDealSize = closedWonDeals.length > 0
      ? closedWonDeals.reduce((sum, d) => sum + d.value, 0) / closedWonDeals.length
      : 0;

    // Calculate avg sales cycle
    let totalCycleDays = 0;
    let cycleCount = 0;
    
    // Define Firestore timestamp interface
    interface FirestoreTimestamp {
      toDate: () => Date;
    }

    closedDeals.forEach(deal => {
      if (deal.actualCloseDate) {
        const createdAtValue = deal.createdAt;
        const createdAt = typeof createdAtValue === 'object' && createdAtValue !== null && 'toDate' in createdAtValue
          ? (createdAtValue as FirestoreTimestamp).toDate()
          : new Date(createdAtValue as string | number);

        const closedAtValue = deal.actualCloseDate;
        const closedAt = typeof closedAtValue === 'object' && closedAtValue !== null && 'toDate' in closedAtValue
          ? (closedAtValue as FirestoreTimestamp).toDate()
          : new Date(closedAtValue as string | number);

        const cycleDays = Math.floor((closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        totalCycleDays += cycleDays;
        cycleCount++;
      }
    });
    
    const avgSalesCycle = cycleCount > 0 ? Math.round(totalCycleDays / cycleCount) : 0;

    // Calculate win rate
    const winRate = closedDeals.length > 0
      ? (closedWonDeals.length / closedDeals.length) * 100
      : 0;

    // Calculate velocity (revenue closed per day)
    const totalRevenue = closedWonDeals.reduce((sum, d) => sum + d.value, 0);
    const daysInPeriod = dateRange
      ? Math.floor((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
      : 90; // Default to 90 days
    const velocity = daysInPeriod > 0 ? totalRevenue / daysInPeriod : 0;

    // Calculate stage metrics
    const stageMetrics = calculateStageMetrics(organizationId, workspaceId, deals);

    // Calculate conversion rates
    const conversionRates = calculateConversionRates(deals);

    // Forecast revenue
    const { forecastedRevenue, confidenceLevel } = calculateForecast(activeDeals, avgDealSize, winRate);

    // Calculate trends
    const trends = await calculateTrends(organizationId, workspaceId);

    const metrics: SalesVelocityMetrics = {
      velocity,
      avgDealSize,
      avgSalesCycle,
      winRate,
      stageMetrics,
      conversionRates,
      forecastedRevenue,
      confidenceLevel,
      trends,
    };

    logger.info('Sales velocity calculated', {
      organizationId,
      velocity,
      avgSalesCycle,
      winRate,
    });

    return metrics;

  } catch (error: unknown) {
    const errorInstance = error instanceof Error ? error : new Error(String(error));
    logger.error('Sales velocity calculation failed', errorInstance, { organizationId });
    throw new Error(`Sales velocity calculation failed: ${errorInstance.message}`);
  }
}

/**
 * Calculate metrics for each stage
 */
function calculateStageMetrics(
  _organizationId: string,
  _workspaceId: string,
  deals: Deal[]
): Map<Deal['stage'], StageMetrics> {
  const stages: Deal['stage'][] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
  const stageMetrics = new Map<Deal['stage'], StageMetrics>();

  for (const stage of stages) {
    const stageDeals = deals.filter(d => d.stage === stage);
    const totalValue = stageDeals.reduce((sum, d) => sum + d.value, 0);
    const avgDealSize = stageDeals.length > 0 ? totalValue / stageDeals.length : 0;

    // Define Firestore timestamp interface
    interface FirestoreTimestamp {
      toDate: () => Date;
    }

    // Calculate avg time in stage
    let totalDays = 0;
    stageDeals.forEach(deal => {
      const createdAtValue = deal.createdAt;
      const createdAt = typeof createdAtValue === 'object' && createdAtValue !== null && 'toDate' in createdAtValue
        ? (createdAtValue as FirestoreTimestamp).toDate()
        : new Date(createdAtValue as string | number);
      const now = new Date();
      const daysInStage = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      totalDays += daysInStage;
    });
    const avgTimeInStage = stageDeals.length > 0 ? Math.round(totalDays / stageDeals.length) : 0;

    // Calculate conversion rate (to next stage or closed_won)
    const _nextStageIndex = stages.indexOf(stage) + 1;
    const movedForward = deals.filter((d) => {
      const currentIndex = stages.indexOf(d.stage);
      return currentIndex > stages.indexOf(stage);
    });
    const conversionRate = stageDeals.length > 0 
      ? (movedForward.length / (stageDeals.length + movedForward.length)) * 100
      : 0;

    // Calculate bottleneck score (higher = bigger bottleneck)
    const expectedDays: Record<Deal['stage'], number> = {
      prospecting: 7,
      qualification: 14,
      proposal: 21,
      negotiation: 14,
      closed_won: 0,
      closed_lost: 0,
    };
    const expected = expectedDays[stage];
    const bottleneckScore = expected > 0 
      ? Math.min(100, Math.round((avgTimeInStage / expected) * 100))
      : 0;

    stageMetrics.set(stage, {
      stage,
      totalDeals: stageDeals.length,
      totalValue,
      avgTimeInStage,
      avgDealSize,
      conversionRate,
      bottleneckScore,
    });
  }

  return stageMetrics;
}

/**
 * Calculate conversion rates between stages
 */
function calculateConversionRates(deals: Deal[]): Map<string, number> {
  const stages: Deal['stage'][] = ['prospecting', 'qualification', 'proposal', 'negotiation'];
  const conversionRates = new Map<string, number>();

  for (let i = 0; i < stages.length - 1; i++) {
    const currentStage = stages[i];
    const nextStage = stages[i + 1];
    
    const currentStageDeals = deals.filter(d => d.stage === currentStage);
    const nextStageDeals = deals.filter(d => {
      const nextIndex = stages.indexOf(d.stage);
      return nextIndex > i;
    });
    
    const rate = currentStageDeals.length > 0
      ? (nextStageDeals.length / (currentStageDeals.length + nextStageDeals.length)) * 100
      : 0;
    
    conversionRates.set(`${currentStage}->${nextStage}`, rate);
  }

  return conversionRates;
}

/**
 * Calculate revenue forecast
 */
function calculateForecast(
  activeDeals: Deal[],
  _avgDealSize: number,
  _winRate: number
): { forecastedRevenue: number; confidenceLevel: number } {
  let forecastedRevenue = 0;
  let totalConfidence = 0;

  activeDeals.forEach(deal => {
    const dealProbability = deal.probability || 50;
    forecastedRevenue += deal.value * (dealProbability / 100);
    totalConfidence += dealProbability;
  });

  const confidenceLevel = activeDeals.length > 0
    ? Math.round(totalConfidence / activeDeals.length)
    : 0;

  return { forecastedRevenue, confidenceLevel };
}

/**
 * Calculate trends over time
 */
async function calculateTrends(
  organizationId: string,
  workspaceId: string
): Promise<SalesVelocityMetrics['trends']> {
  const now = new Date();
  
  // 30 days
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const metrics30 = await calculateSalesVelocity(organizationId, workspaceId, {
    start: thirtyDaysAgo,
    end: now,
  });

  // 90 days
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const metrics90 = await calculateSalesVelocity(organizationId, workspaceId, {
    start: ninetyDaysAgo,
    end: now,
  });

  return {
    velocity30Days: metrics30.velocity,
    velocity90Days: metrics90.velocity,
    winRate30Days: metrics30.winRate,
    winRate90Days: metrics90.winRate,
  };
}

/**
 * Get pipeline insights and warnings
 */
export async function getPipelineInsights(
  organizationId: string,
  workspaceId: string
): Promise<PipelineInsight[]> {
  try {
    const metrics = await calculateSalesVelocity(organizationId, workspaceId);
    const insights: PipelineInsight[] = [];

    // Check for bottlenecks
    metrics.stageMetrics.forEach((stageMetric, stage) => {
      if (stageMetric.bottleneckScore > 150) {
        insights.push({
          type: 'warning',
          priority: 'high',
          message: `Bottleneck in ${stage} stage`,
          recommendation: `Deals spending ${stageMetric.avgTimeInStage} days in ${stage} (expected: much less). Review and accelerate.`,
          affectedDeals: stageMetric.totalDeals,
        });
      }
    });

    // Check win rate
    if (metrics.winRate < 20) {
      insights.push({
        type: 'warning',
        priority: 'high',
        message: `Low win rate (${metrics.winRate.toFixed(1)}%)`,
        recommendation: 'Review qualification criteria and sales process',
      });
    } else if (metrics.winRate > 60) {
      insights.push({
        type: 'success',
        priority: 'low',
        message: `Strong win rate (${metrics.winRate.toFixed(1)}%)`,
      });
    }

    // Check velocity trend
    if (metrics.trends.velocity30Days < metrics.trends.velocity90Days * 0.7) {
      insights.push({
        type: 'warning',
        priority: 'medium',
        message: 'Sales velocity declining',
        recommendation: 'Recent velocity is 30% below 90-day average. Increase pipeline activity.',
      });
    }

    // Check sales cycle
    if (metrics.avgSalesCycle > 90) {
      insights.push({
        type: 'info',
        priority: 'medium',
        message: `Long sales cycle (${metrics.avgSalesCycle} days)`,
        recommendation: 'Consider ways to shorten time to close',
      });
    }

    logger.info('Pipeline insights generated', {
      organizationId,
      insightCount: insights.length,
    });

    return insights;

  } catch (error: unknown) {
    const errorInstance = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to generate pipeline insights', errorInstance, { organizationId });
    return [];
  }
}

