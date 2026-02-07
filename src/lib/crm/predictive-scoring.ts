/**
 * Predictive Lead Scoring (ML-Ready Framework)
 * Uses configurable weights with ML-like training from historical conversion data.
 * Training adjusts weights based on actual conversion outcomes using logistic regression approximation.
 */

import type { Lead } from './lead-service';
import { getActivityStats } from './activity-service';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export interface PredictiveScore {
  score: number; // 0-100
  confidence: number; // 0-100
  tier: 'hot' | 'warm' | 'cold';
  conversionProbability: number; // 0-100
  factors: ScoringFactor[];
  recommendedActions: string[];
}

export interface ScoringFactor {
  name: string;
  weight: number;
  value: number;
  impact: 'positive' | 'negative' | 'neutral';
  contribution: number; // How much this factor contributed to final score
}

export interface ScoringWeights {
  demographics: number;
  firmographics: number;
  engagement: number;
  behavioral: number;
}

export interface ScoringModel {
  weights: ScoringWeights;
  modelVersion: string;
  trainedAt: Date;
  sampleSize: number;
  accuracy: number;
}

// Default weights (before training)
const DEFAULT_WEIGHTS: ScoringWeights = {
  demographics: 0.30,
  firmographics: 0.25,
  engagement: 0.30,
  behavioral: 0.15,
};


/**
 * Load scoring weights from Firestore, with fallback to defaults
 */
async function loadScoringWeights(): Promise<ScoringWeights> {
  try {
    if (!db) {
      return DEFAULT_WEIGHTS;
    }
    const docRef = doc(db, 'organizations', DEFAULT_ORG_ID, 'config', 'scoringWeights');
    const modelDoc = await getDoc(docRef);

    if (modelDoc.exists()) {
      const data = modelDoc.data();
      if (data?.weights && typeof data.weights === 'object') {
        const weights = data.weights as Record<string, unknown>;
        if (
          typeof weights.demographics === 'number' &&
          typeof weights.firmographics === 'number' &&
          typeof weights.engagement === 'number' &&
          typeof weights.behavioral === 'number'
        ) {
          logger.info('Loaded trained scoring weights from Firestore', {
            modelVersion: typeof data.modelVersion === 'string' ? data.modelVersion : 'unknown',
          });
          return {
            demographics: weights.demographics,
            firmographics: weights.firmographics,
            engagement: weights.engagement,
            behavioral: weights.behavioral,
          };
        }
      }
    }

    return DEFAULT_WEIGHTS;
  } catch (error) {
    logger.error('Failed to load scoring weights', error instanceof Error ? error : new Error(String(error)));
    return DEFAULT_WEIGHTS;
  }
}

// Training function is in predictive-scoring-training.ts (server-only module)
// Import directly from '@/lib/crm/predictive-scoring-training' for model training

/**
 * Calculate predictive lead score
 * Uses trained weights from Firestore when available, falls back to rule-based defaults.
 */
export async function calculatePredictiveLeadScore(
  workspaceId: string,
  lead: Lead
): Promise<PredictiveScore> {
  try {
    const factors: ScoringFactor[] = [];

    // Load trained weights (or defaults)
    const weights = await loadScoringWeights();

    // Factor 1: Demographics
    const demographicScore = scoreDemographics(lead);
    factors.push({
      name: 'Demographics',
      weight: weights.demographics,
      value: demographicScore,
      impact: demographicScore > 60 ? 'positive' : demographicScore < 40 ? 'negative' : 'neutral',
      contribution: 0,
    });

    // Factor 2: Firmographics
    const firmographicScore = scoreFirmographics(lead);
    factors.push({
      name: 'Firmographics',
      weight: weights.firmographics,
      value: firmographicScore,
      impact: firmographicScore > 60 ? 'positive' : firmographicScore < 40 ? 'negative' : 'neutral',
      contribution: 0,
    });

    // Factor 3: Engagement
    const activityStats = await getActivityStats(workspaceId, 'lead', lead.id);
    const engagementScore = activityStats.engagementScore ?? 0;
    factors.push({
      name: 'Engagement',
      weight: weights.engagement,
      value: engagementScore,
      impact: engagementScore > 60 ? 'positive' : engagementScore < 40 ? 'negative' : 'neutral',
      contribution: 0,
    });

    // Factor 4: Behavioral Signals
    const behavioralScore = scoreBehavioralSignals(lead, activityStats);
    factors.push({
      name: 'Behavioral Signals',
      weight: weights.behavioral,
      value: behavioralScore,
      impact: behavioralScore > 60 ? 'positive' : behavioralScore < 40 ? 'negative' : 'neutral',
      contribution: 0,
    });

    // Calculate weighted score
    let totalScore = 0;
    factors.forEach(factor => {
      const contribution = factor.value * factor.weight;
      factor.contribution = contribution;
      totalScore += contribution;
    });

    const score = Math.round(totalScore);

    // Determine tier
    let tier: 'hot' | 'warm' | 'cold';
    if (score >= 75) {tier = 'hot';}
    else if (score >= 50) {tier = 'warm';}
    else {tier = 'cold';}

    // Estimate conversion probability (simplified)
    // In production, this would be ML model output
    const conversionProbability = estimateConversionProbability(score, factors);

    // Generate recommended actions
    const recommendedActions = generateRecommendedActions(score, tier, factors);

    // Confidence (how sure we are about this score)
    const confidence = calculateConfidence(lead, activityStats);

    const predictiveScore: PredictiveScore = {
      score,
      confidence,
      tier,
      conversionProbability,
      factors,
      recommendedActions,
    };

    logger.info('Predictive lead score calculated', {
      leadId: lead.id,
      score,
      tier,
      conversionProbability,
    });

    return predictiveScore;

  } catch (error) {
    logger.error('Predictive scoring failed', error instanceof Error ? error : new Error(String(error)), { leadId: lead.id });
    throw new Error(`Predictive scoring failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Score demographics (title, seniority)
 */
function scoreDemographics(lead: Lead): number {
  let score = 50; // Base score

  if (lead.title) {
    const title = lead.title.toLowerCase();
    
    // Executive level
    if (/(ceo|cto|cfo|coo|president|vp|vice president|director)/.test(title)) {
      score += 30;
    }
    // Manager level
    else if (/(manager|lead|head)/.test(title)) {
      score += 15;
    }
    // Individual contributor
    else {
      score += 5;
    }
  } else {
    score -= 20; // Missing title
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Score firmographics (company size, industry, revenue)
 */
function scoreFirmographics(lead: Lead): number {
  let score = 50;

  // Enrichment data available
  if (lead.enrichmentData) {
    score += 10;

    const enrichment = lead.enrichmentData;

    // Company size
    if (enrichment.companySize) {
      if (enrichment.companySize >= 100) {score += 20;}
      else if (enrichment.companySize >= 50) {score += 15;}
      else if (enrichment.companySize >= 10) {score += 10;}
      else {score += 5;}
    }

    // Revenue
    if (enrichment.revenue) {
      if (enrichment.revenue >= 10000000) {score += 20;}
      else if (enrichment.revenue >= 1000000) {score += 15;}
      else if (enrichment.revenue >= 100000) {score += 10;}
    }

    // Industry (would have industry-specific scoring in production)
    if (enrichment.industry) {
      score += 10;
    }
  } else if (lead.company) {
    score += 5; // At least has company name
  } else {
    score -= 20; // No company info
  }

  return Math.min(100, Math.max(0, score));
}

interface BehavioralActivityStats {
  lastActivityDate?: string | Date;
  avgActivitiesPerDay?: number;
}

/**
 * Score behavioral signals
 */
function scoreBehavioralSignals(lead: Lead, activityStats: BehavioralActivityStats): number {
  let score = 50;

  // Recent activity
  if (activityStats.lastActivityDate) {
    const daysSince = (Date.now() - new Date(activityStats.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 1) {score += 25;}
    else if (daysSince < 3) {score += 15;}
    else if (daysSince < 7) {score += 5;}
    else {score -= 10;}
  }

  // Activity frequency
  if (activityStats.avgActivitiesPerDay) {
    if (activityStats.avgActivitiesPerDay > 1) {score += 15;}
    else if (activityStats.avgActivitiesPerDay > 0.5) {score += 10;}
    else if (activityStats.avgActivitiesPerDay > 0.2) {score += 5;}
  }

  // Lead source quality
  if (lead.source) {
    const highQualitySources = ['Referral', 'Website', 'Demo Request'];
    const mediumQualitySources = ['Social Media', 'Email Campaign'];
    
    if (highQualitySources.includes(lead.source)) {score += 10;}
    else if (mediumQualitySources.includes(lead.source)) {score += 5;}
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Estimate conversion probability
 * Uses weighted factor analysis to predict likelihood of conversion.
 * Base probability derived from overall score, adjusted by high-performing factors.
 */
function estimateConversionProbability(score: number, factors: ScoringFactor[]): number {
  // Base probability from overall score
  let probability = score * 0.7;

  // Boost probability for high-performing factors
  const engagementFactor = factors.find(f => f.name === 'Engagement');
  if (engagementFactor && engagementFactor.value > 80) {
    probability += 10;
  }

  const demographicFactor = factors.find(f => f.name === 'Demographics');
  if (demographicFactor && demographicFactor.value > 80) {
    probability += 10;
  }

  return Math.min(100, Math.round(probability));
}

/**
 * Generate recommended actions based on score
 */
function generateRecommendedActions(
  score: number,
  tier: 'hot' | 'warm' | 'cold',
  factors: ScoringFactor[]
): string[] {
  const actions: string[] = [];

  if (tier === 'hot') {
    actions.push('Schedule demo immediately');
    actions.push('Assign to senior sales rep');
    actions.push('Send personalized proposal');
  } else if (tier === 'warm') {
    actions.push('Enroll in nurture sequence');
    actions.push('Send educational content');
    actions.push('Schedule discovery call within 3 days');
  } else {
    actions.push('Add to long-term nurture campaign');
    actions.push('Monitor for engagement signals');
    actions.push('Verify contact information');
  }

  // Specific recommendations based on weak factors
  const weakFactors = factors.filter(f => f.value < 40);
  weakFactors.forEach(factor => {
    if (factor.name === 'Demographics') {
      actions.push('Update title and role information');
    } else if (factor.name === 'Firmographics') {
      actions.push('Enrich company data');
    } else if (factor.name === 'Engagement') {
      actions.push('Increase outreach frequency');
    }
  });

  return actions.slice(0, 5); // Return top 5 actions
}

interface ConfidenceActivityStats {
  totalActivities?: number;
}

/**
 * Calculate confidence in the score
 */
function calculateConfidence(lead: Lead, activityStats: ConfidenceActivityStats): number {
  let confidence = 60; // Base confidence

  // More data = higher confidence
  if (lead.email) {confidence += 5;}
  if (lead.phone) {confidence += 5;}
  if (lead.company) {confidence += 5;}
  if (lead.title) {confidence += 5;}
  if (lead.enrichmentData) {confidence += 10;}

  // More activity = higher confidence
  if ((activityStats.totalActivities ?? 0) > 10) {confidence += 10;}
  else if ((activityStats.totalActivities ?? 0) > 5) {confidence += 5;}

  return Math.min(100, confidence);
}

/**
 * Batch score leads (for leaderboards, prioritization)
 */
export async function batchScoreLeads(
  workspaceId: string,
  leads: Lead[]
): Promise<Map<string, PredictiveScore>> {
  const scores = new Map<string, PredictiveScore>();

  for (const lead of leads) {
    try {
      const score = await calculatePredictiveLeadScore(workspaceId, lead);
      scores.set(lead.id, score);
    } catch (error) {
      logger.warn('Failed to score lead in batch', { leadId: lead.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return scores;
}

