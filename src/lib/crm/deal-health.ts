/**
 * Deal Health Scoring System
 * Analyzes deal health based on activity, stage duration, and engagement
 */

import { getActivityStats } from './activity-service';
import { getDeal, type Deal } from './deal-service';
import { logger } from '@/lib/logger/logger';
import type { ActivityStats } from '@/types/activity';

/**
 * Type guard to check if value has a toDate method (Firestore Timestamp)
 */
interface FirestoreTimestamp {
  toDate: () => Date;
}

/**
 * Safely convert Firestore timestamp or date-like value to Date
 * Handles any type from Firestore by checking structure at runtime
 */
function toDate(value: unknown): Date {
  // Check if it's a Firestore Timestamp with toDate method
  if (value && typeof value === 'object' && 'toDate' in value) {
    const timestamp = value as FirestoreTimestamp;
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
  }

  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }

  // Handle strings and numbers
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }

  // Fallback to current date if value is invalid
  return new Date();
}

export interface DealHealthScore {
  overall: number; // 0-100 (higher is healthier)
  status: 'healthy' | 'at-risk' | 'critical';
  factors: DealHealthFactor[];
  warnings: string[];
  recommendations: string[];
}

export interface DealHealthFactor {
  name: string;
  score: number; // 0-100
  weight: number; // How important this factor is
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

/**
 * Calculate comprehensive deal health score
 */
export async function calculateDealHealth(
  organizationId: string,
  workspaceId: string,
  dealId: string
): Promise<DealHealthScore> {
  try {
    const deal = await getDeal(dealId, workspaceId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    const factors: DealHealthFactor[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Factor 1: Activity Recency (20% weight)
    const activityStats = await getActivityStats(organizationId, workspaceId, 'deal', dealId);
    const activityRecencyFactor = calculateActivityRecencyFactor(activityStats);
    factors.push(activityRecencyFactor);
    
    if (activityRecencyFactor.impact === 'negative') {
      warnings.push(`No activity in ${getDaysSinceLastActivity(activityStats)} days`);
      recommendations.push('Schedule a follow-up call or send a check-in email');
    }

    // Factor 2: Stage Duration (25% weight)
    const stageDurationFactor = calculateStageDurationFactor(deal);
    factors.push(stageDurationFactor);
    
    if (stageDurationFactor.impact === 'negative') {
      warnings.push(stageDurationFactor.description);
      recommendations.push('Reassess deal requirements or identify blockers');
    }

    // Factor 3: Engagement Level (20% weight)
    const engagementFactor = calculateEngagementFactor(activityStats);
    factors.push(engagementFactor);
    
    if (engagementFactor.score < 50) {
      warnings.push('Low engagement from prospect');
      recommendations.push('Try a different outreach approach or escalate to decision maker');
    }

    // Factor 4: Deal Value vs Stage Probability (15% weight)
    const valueProbabilityFactor = calculateValueProbabilityFactor(deal);
    factors.push(valueProbabilityFactor);

    // Factor 5: Time to Expected Close (20% weight)
    const timeToCloseFactor = calculateTimeToCloseFactor(deal);
    factors.push(timeToCloseFactor);
    
    if (timeToCloseFactor.impact === 'negative') {
      warnings.push(timeToCloseFactor.description);
      recommendations.push('Update expected close date or accelerate deal process');
    }

    // Calculate weighted overall score
    let totalScore = 0;
    let totalWeight = 0;
    
    factors.forEach(factor => {
      totalScore += factor.score * factor.weight;
      totalWeight += factor.weight;
    });
    
    const overall = Math.round(totalScore / totalWeight);

    // Determine status
    let status: 'healthy' | 'at-risk' | 'critical';
    if (overall >= 70) {status = 'healthy';}
    else if (overall >= 40) {status = 'at-risk';}
    else {status = 'critical';}

    const healthScore: DealHealthScore = {
      overall,
      status,
      factors,
      warnings,
      recommendations,
    };

    logger.info('Deal health calculated', {
      organizationId,
      dealId,
      overall,
      status,
      factorCount: factors.length,
    });

    return healthScore;

  } catch (error: unknown) {
    logger.error('Failed to calculate deal health', error instanceof Error ? error : new Error(String(error)), { organizationId, dealId });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Deal health calculation failed: ${errorMessage}`);
  }
}

/**
 * Activity recency factor
 */
function calculateActivityRecencyFactor(activityStats: ActivityStats): DealHealthFactor {
  const daysSinceLastActivity = getDaysSinceLastActivity(activityStats);
  
  let score = 100;
  let impact: 'positive' | 'negative' | 'neutral' = 'positive';
  let description = '';

  if (daysSinceLastActivity === null) {
    score = 30;
    impact = 'negative';
    description = 'No activity recorded';
  } else if (daysSinceLastActivity < 3) {
    score = 100;
    impact = 'positive';
    description = 'Recent activity (within 3 days)';
  } else if (daysSinceLastActivity < 7) {
    score = 80;
    impact = 'neutral';
    description = `Last activity ${daysSinceLastActivity} days ago`;
  } else if (daysSinceLastActivity < 14) {
    score = 50;
    impact = 'negative';
    description = `No activity in ${daysSinceLastActivity} days`;
  } else {
    score = 20;
    impact = 'negative';
    description = `Deal stale: ${daysSinceLastActivity} days since last activity`;
  }

  return {
    name: 'Activity Recency',
    score,
    weight: 0.20,
    impact,
    description,
  };
}

/**
 * Stage duration factor
 */
function calculateStageDurationFactor(deal: Deal): DealHealthFactor {
  const createdAt = toDate(deal.createdAt);
  const daysSinceCreated = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  // Expected days per stage (industry averages)
  const expectedDays: Record<Deal['stage'], number> = {
    prospecting: 7,
    qualification: 14,
    proposal: 21,
    negotiation: 14,
    closed_won: 0,
    closed_lost: 0,
  };

  const expected = expectedDays[deal.stage];
  let score = 100;
  let impact: 'positive' | 'negative' | 'neutral' = 'positive';
  let description = '';

  if (deal.stage === 'closed_won' || deal.stage === 'closed_lost') {
    score = 100;
    impact = 'neutral';
    description = 'Deal closed';
  } else if (daysSinceCreated < expected) {
    score = 100;
    impact = 'positive';
    description = `On track (${daysSinceCreated}/${expected} days in ${deal.stage})`;
  } else if (daysSinceCreated < expected * 1.5) {
    score = 70;
    impact = 'neutral';
    description = `Slightly delayed (${daysSinceCreated}/${expected} days in ${deal.stage})`;
  } else if (daysSinceCreated < expected * 2) {
    score = 40;
    impact = 'negative';
    description = `Delayed (${daysSinceCreated}/${expected} days in ${deal.stage})`;
  } else {
    score = 20;
    impact = 'negative';
    description = `Significantly delayed (${daysSinceCreated} days in ${deal.stage}, expected ${expected})`;
  }

  return {
    name: 'Stage Duration',
    score,
    weight: 0.25,
    impact,
    description,
  };
}

/**
 * Engagement level factor
 */
function calculateEngagementFactor(activityStats: ActivityStats): DealHealthFactor {
  const engagementScore = activityStats.engagementScore ?? 0;
  
  let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let description = '';

  if (engagementScore >= 70) {
    impact = 'positive';
    description = 'High engagement from prospect';
  } else if (engagementScore >= 40) {
    impact = 'neutral';
    description = 'Moderate engagement';
  } else {
    impact = 'negative';
    description = 'Low engagement';
  }

  return {
    name: 'Engagement Level',
    score: engagementScore,
    weight: 0.20,
    impact,
    description,
  };
}

/**
 * Value vs probability factor
 */
function calculateValueProbabilityFactor(deal: Deal): DealHealthFactor {
  const probability = deal.probability || 0;
  const score = probability;
  let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let description = '';

  if (probability >= 75) {
    impact = 'positive';
    description = `High probability (${probability}%)`;
  } else if (probability >= 50) {
    impact = 'neutral';
    description = `Medium probability (${probability}%)`;
  } else {
    impact = 'negative';
    description = `Low probability (${probability}%)`;
  }

  return {
    name: 'Win Probability',
    score,
    weight: 0.15,
    impact,
    description,
  };
}

/**
 * Time to expected close factor
 */
function calculateTimeToCloseFactor(deal: Deal): DealHealthFactor {
  if (!deal.expectedCloseDate) {
    return {
      name: 'Time to Close',
      score: 50,
      weight: 0.20,
      impact: 'neutral',
      description: 'No expected close date set',
    };
  }

  const expectedDate = toDate(deal.expectedCloseDate);
  const daysToClose = Math.floor((expectedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  let score = 100;
  let impact: 'positive' | 'negative' | 'neutral' = 'positive';
  let description = '';

  if (daysToClose < 0) {
    score = 20;
    impact = 'negative';
    description = `Overdue by ${Math.abs(daysToClose)} days`;
  } else if (daysToClose <= 7) {
    score = 100;
    impact = 'positive';
    description = `Closing soon (${daysToClose} days)`;
  } else if (daysToClose <= 30) {
    score = 80;
    impact = 'neutral';
    description = `${daysToClose} days to expected close`;
  } else if (daysToClose <= 60) {
    score = 60;
    impact = 'neutral';
    description = `${daysToClose} days to expected close`;
  } else {
    score = 40;
    impact = 'neutral';
    description = `Long sales cycle (${daysToClose} days to close)`;
  }

  return {
    name: 'Time to Close',
    score,
    weight: 0.20,
    impact,
    description,
  };
}

/**
 * Helper to get days since last activity
 */
function getDaysSinceLastActivity(activityStats: ActivityStats): number | null {
  if (!activityStats.lastActivityDate) {return null;}
  
  const lastDate = new Date(activityStats.lastActivityDate);
  return Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get health scores for all deals in a pipeline
 */
export async function getPipelineHealth(
  organizationId: string,
  workspaceId: string,
  dealIds: string[]
): Promise<Map<string, DealHealthScore>> {
  const healthScores = new Map<string, DealHealthScore>();

  for (const dealId of dealIds) {
    try {
      const health = await calculateDealHealth(organizationId, workspaceId, dealId);
      healthScores.set(dealId, health);
    } catch (error) {
      logger.warn('Failed to calculate health for deal', { dealId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return healthScores;
}

