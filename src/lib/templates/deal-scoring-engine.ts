/**
 * Deal Scoring Engine
 * 
 * Predictive deal scoring using 7+ factors to calculate:
 * - Deal score (0-100)
 * - Close probability (0-100%)
 * - Risk factors and recommendations
 * - Win/loss prediction
 * 
 * SCORING FACTORS:
 * 1. Deal Age - How long the deal has been in pipeline
 * 2. Stage Velocity - How fast deal is moving through stages
 * 3. Engagement - Activity level and recency
 * 4. Decision Maker Involvement - C-level engagement
 * 5. Budget Alignment - Deal value vs. stated budget
 * 6. Competition Presence - Competitors mentioned
 * 7. Historical Win Rate - Similar deals won in the past
 * 
 * INTEGRATION:
 * - Uses industry templates for scoring weights
 * - Emits signals to Signal Bus
 * - Powers revenue forecasting
 */

import { logger } from '@/lib/logger/logger';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import type { Deal } from '@/lib/crm/deal-service';
import { getTemplateById, type SalesIndustryTemplate } from './industry-templates';

// ============================================================================
// TYPES
// ============================================================================

export interface DealScore {
  dealId: string;
  score: number; // 0-100
  closeProbability: number; // 0-100%
  tier: 'hot' | 'warm' | 'cold' | 'at-risk';
  confidence: number; // 0-100 - How confident are we in this score
  factors: ScoringFactor[];
  riskFactors: RiskFactor[];
  recommendations: string[];
  predictedCloseDate: Date | null;
  predictedValue: number; // Predicted final deal value
  calculatedAt: Date;
}

export interface ScoringFactor {
  id: string;
  name: string;
  score: number; // 0-100
  weight: number; // 0-1
  contribution: number; // How much this contributed to final score
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  value: number | string; // The actual value
  benchmark?: number | string; // Expected/benchmark value
}

export interface RiskFactor {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'timing' | 'budget' | 'competition' | 'engagement' | 'stakeholder';
  description: string;
  impact: string; // Impact on deal
  mitigation: string; // How to mitigate this risk
}

export interface DealScoringOptions {
  dealId: string;
  deal?: Deal; // Optional if you already have the deal
  templateId?: string; // Industry template for custom scoring weights
}

export interface BatchScoringResult {
  scores: Map<string, DealScore>;
  summary: {
    totalDeals: number;
    avgScore: number;
    hotDeals: number;
    warmDeals: number;
    coldDeals: number;
    atRiskDeals: number;
  };
}

// ============================================================================
// MAIN SCORING ENGINE
// ============================================================================

/**
 * Calculate predictive deal score
 * 
 * This is the main entry point for deal scoring.
 * 
 * @param options - Scoring options including deal and template
 * @returns Comprehensive deal score with factors and recommendations
 * 
 * @example
 * ```typescript
 * const score = await calculateDealScore({
 *   dealId: 'deal_456',
 *   templateId: 'saas'
 * });
 *
 * console.log(`Score: ${score.score}, Probability: ${score.closeProbability}%`);
 * ```
 */
export function calculateDealScore(
  options: DealScoringOptions
): DealScore {
  const startTime = Date.now();
  
  try {
    logger.info('Calculating deal score', {
      dealId: options.dealId,
      templateId: options.templateId
    });
    
    // 1. Get deal data (mock for now)
    const deal = options.deal ?? fetchDeal(options.dealId);
    
    // 2. Get industry template for custom weights
    let template: SalesIndustryTemplate | null = null;
    if (options.templateId) {
      template = getTemplateById(options.templateId);
    }
    
    const weights = template?.scoringWeights ?? {
      dealAge: 0.15,
      stageVelocity: 0.20,
      engagement: 0.25,
      decisionMaker: 0.15,
      budget: 0.15,
      competition: 0.05,
      historicalWinRate: 0.05
    };
    
    // 3. Calculate individual factor scores
    const factors: ScoringFactor[] = [];
    
    // Factor 1: Deal Age
    const dealAgeFactor = calculateDealAgeFactor(deal);
    factors.push({
      id: 'deal_age',
      name: 'Deal Age',
      score: dealAgeFactor.score,
      weight: weights.dealAge,
      contribution: 0, // Will be calculated below
      impact: dealAgeFactor.impact,
      description: dealAgeFactor.description,
      value: dealAgeFactor.value,
      benchmark: dealAgeFactor.benchmark
    });
    
    // Factor 2: Stage Velocity
    const velocityFactor = calculateStageVelocityFactor(deal, template);
    factors.push({
      id: 'stage_velocity',
      name: 'Stage Velocity',
      score: velocityFactor.score,
      weight: weights.stageVelocity,
      contribution: 0,
      impact: velocityFactor.impact,
      description: velocityFactor.description,
      value: velocityFactor.value,
      benchmark: velocityFactor.benchmark
    });
    
    // Factor 3: Engagement
    const engagementFactor = calculateEngagementFactor(deal);
    factors.push({
      id: 'engagement',
      name: 'Engagement Level',
      score: engagementFactor.score,
      weight: weights.engagement,
      contribution: 0,
      impact: engagementFactor.impact,
      description: engagementFactor.description,
      value: engagementFactor.value,
      benchmark: engagementFactor.benchmark
    });
    
    // Factor 4: Decision Maker Involvement
    const decisionMakerFactor = calculateDecisionMakerFactor(deal);
    factors.push({
      id: 'decision_maker',
      name: 'Decision Maker Involvement',
      score: decisionMakerFactor.score,
      weight: weights.decisionMaker,
      contribution: 0,
      impact: decisionMakerFactor.impact,
      description: decisionMakerFactor.description,
      value: decisionMakerFactor.value,
      benchmark: decisionMakerFactor.benchmark
    });
    
    // Factor 5: Budget Alignment
    const budgetFactor = calculateBudgetFactor(deal);
    factors.push({
      id: 'budget',
      name: 'Budget Alignment',
      score: budgetFactor.score,
      weight: weights.budget,
      contribution: 0,
      impact: budgetFactor.impact,
      description: budgetFactor.description,
      value: budgetFactor.value,
      benchmark: budgetFactor.benchmark
    });
    
    // Factor 6: Competition
    const competitionFactor = calculateCompetitionFactor(deal);
    factors.push({
      id: 'competition',
      name: 'Competition Presence',
      score: competitionFactor.score,
      weight: weights.competition,
      contribution: 0,
      impact: competitionFactor.impact,
      description: competitionFactor.description,
      value: competitionFactor.value,
      benchmark: competitionFactor.benchmark
    });
    
    // Factor 7: Historical Win Rate
    const historicalFactor = calculateHistoricalWinRateFactor(deal, template);
    factors.push({
      id: 'historical_win_rate',
      name: 'Historical Win Rate',
      score: historicalFactor.score,
      weight: weights.historicalWinRate,
      contribution: 0,
      impact: historicalFactor.impact,
      description: historicalFactor.description,
      value: historicalFactor.value,
      benchmark: historicalFactor.benchmark
    });
    
    // 4. Calculate weighted score
    let totalScore = 0;
    factors.forEach(factor => {
      const contribution = factor.score * factor.weight;
      factor.contribution = contribution;
      totalScore += contribution;
    });
    
    const finalScore = Math.round(Math.min(100, Math.max(0, totalScore)));
    
    // 5. Calculate close probability
    const closeProbability = calculateCloseProbability(finalScore, factors, deal, template);
    
    // 6. Determine tier
    const tier = determineTier(finalScore, closeProbability, factors);
    
    // 7. Calculate confidence
    const confidence = calculateConfidence(deal, factors);
    
    // 8. Identify risk factors
    const riskFactors = identifyRiskFactors(deal, factors, template);
    
    // 9. Generate recommendations
    const recommendations = generateRecommendations(deal, factors, riskFactors, template);
    
    // 10. Predict close date and value
    const predictedCloseDate = predictCloseDate(deal, factors, template);
    const predictedValue = predictFinalValue(deal, factors);
    
    const dealScore: DealScore = {
      dealId: deal.id,
      score: finalScore,
      closeProbability,
      tier,
      confidence,
      factors,
      riskFactors,
      recommendations,
      predictedCloseDate,
      predictedValue,
      calculatedAt: new Date()
    };
    
    // 11. Emit Signal Bus event
    try {
      const coordinator = getServerSignalCoordinator();
      void coordinator.emitSignal({
        type: 'deal.scored',
        confidence: confidence / 100,
        priority: tier === 'at-risk' || tier === 'hot' ? 'High' : 'Medium',
        metadata: {
          dealId: deal.id,
          dealName:((deal as { name?: string }).name !== '' && (deal as { name?: string }).name != null) ? (deal as { name?: string }).name : 'Unknown Deal',
          score: finalScore,
          closeProbability,
          tier,
          riskFactorsCount: riskFactors.length,
          topRiskSeverity: riskFactors[0]?.severity || 'none',
          predictedCloseDate: predictedCloseDate?.toISOString(),
          predictedValue,
          templateId: options.templateId,
          timestamp: new Date().toISOString()
        }
      });

      logger.info('Signal emitted: deal.scored', {
        dealId: deal.id,
        score: finalScore
      });
    } catch (signalError) {
      logger.warn('Failed to emit deal.scored signal', { error: signalError instanceof Error ? signalError.message : String(signalError) });
    }
    
    const duration = Date.now() - startTime;
    logger.info('Deal score calculated', {
      dealId: deal.id,
      score: finalScore,
      probability: closeProbability,
      tier,
      duration
    });
    
    return dealScore;
    
  } catch (error) {
    logger.error('Deal scoring failed', error as Error, {
      dealId: options.dealId
    });
    throw new Error(`Deal scoring failed: ${(error as Error).message}`);
  }
}

// ============================================================================
// FACTOR CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate deal age factor
 * Deals that are too old or moving too slow get penalized
 */
function calculateDealAgeFactor(deal: Deal): {
  score: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  value: number;
  benchmark: number;
} {
  const createdAtValue = deal.createdAt as string | number | Date;
  const createdAt = new Date(createdAtValue);
  const now = new Date();
  const ageInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  
  let score = 50;
  let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let description = '';
  
  // Scoring logic based on age
  if (ageInDays < 7) {
    score = 90;
    impact = 'positive';
    description = 'New deal - high momentum';
  } else if (ageInDays < 30) {
    score = 80;
    impact = 'positive';
    description = 'Normal deal age - on track';
  } else if (ageInDays < 60) {
    score = 60;
    impact = 'neutral';
    description = 'Deal aging - needs attention';
  } else if (ageInDays < 90) {
    score = 40;
    impact = 'negative';
    description = 'Deal stale - at risk';
  } else {
    score = 20;
    impact = 'negative';
    description = 'Deal very old - likely dead';
  }
  
  return {
    score,
    impact,
    description,
    value: ageInDays,
    benchmark: 30 // 30 days is ideal
  };
}

/**
 * Calculate stage velocity factor
 * How fast is the deal moving through stages
 */
function calculateStageVelocityFactor(deal: Deal, template: SalesIndustryTemplate | null): {
  score: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  value: string;
  benchmark: string;
} {
  // Mock implementation - in real version, track stage history
  const currentStage =((deal as { stage?: string }).stage !== '' && (deal as { stage?: string }).stage != null) ? (deal as { stage?: string }).stage : 'unknown';
  const updatedAtValue = (deal.updatedAt ?? deal.createdAt) as string | number | Date;
  const stageEnteredAt = new Date(updatedAtValue);
  const now = new Date();
  const daysInStage = Math.floor((now.getTime() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24));
  
  // Get expected duration from template
  const expectedDuration = template?.stages.find(s => s.id === currentStage)?.averageDuration ?? 14;
  
  let score = 50;
  let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let description = '';
  
  if (daysInStage < expectedDuration * 0.5) {
    score = 90;
    impact = 'positive';
    description = 'Moving fast through stages';
  } else if (daysInStage < expectedDuration) {
    score = 75;
    impact = 'positive';
    description = 'Normal stage progression';
  } else if (daysInStage < expectedDuration * 1.5) {
    score = 50;
    impact = 'neutral';
    description = 'Slightly slow in current stage';
  } else {
    score = 30;
    impact = 'negative';
    description = 'Stuck in current stage';
  }
  
  return {
    score,
    impact,
    description,
    value: `${daysInStage} days in ${currentStage}`,
    benchmark: `${expectedDuration} days expected`
  };
}

/**
 * Calculate engagement factor
 * Activity level and recency
 */
function calculateEngagementFactor(_deal: Deal): {
  score: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  value: string;
  benchmark: string;
} {
  // Mock implementation - in real version, fetch activity stats
  const lastActivityDays = Math.floor(Math.random() * 14); // Mock: 0-14 days ago
  const totalActivities = Math.floor(Math.random() * 20) + 5; // Mock: 5-25 activities
  
  let score = 50;
  let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let description = '';
  
  // Recency score
  let recencyScore = 50;
  if (lastActivityDays === 0) {recencyScore = 100;}
  else if (lastActivityDays === 1) {recencyScore = 90;}
  else if (lastActivityDays <= 3) {recencyScore = 75;}
  else if (lastActivityDays <= 7) {recencyScore = 60;}
  else if (lastActivityDays <= 14) {recencyScore = 40;}
  else {recencyScore = 20;}
  
  // Volume score
  let volumeScore = 50;
  if (totalActivities >= 20) {volumeScore = 90;}
  else if (totalActivities >= 15) {volumeScore = 75;}
  else if (totalActivities >= 10) {volumeScore = 60;}
  else if (totalActivities >= 5) {volumeScore = 40;}
  else {volumeScore = 20;}
  
  score = Math.round((recencyScore * 0.6) + (volumeScore * 0.4));
  
  if (score >= 75) {
    impact = 'positive';
    description = 'Highly engaged prospect';
  } else if (score >= 50) {
    impact = 'neutral';
    description = 'Moderate engagement';
  } else {
    impact = 'negative';
    description = 'Low engagement - at risk';
  }
  
  return {
    score,
    impact,
    description,
    value: `${totalActivities} activities, last ${lastActivityDays}d ago`,
    benchmark: '10+ activities, <7d recency'
  };
}

/**
 * Calculate decision maker factor
 * Is C-level involved?
 */
function calculateDecisionMakerFactor(_deal: Deal): {
  score: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  value: string;
  benchmark: string;
} {
  // Mock implementation - in real version, check contact titles
  const hasDecisionMaker = Math.random() > 0.5; // Mock
  const decisionMakerEngaged = Math.random() > 0.3; // Mock
  
  let score = 50;
  let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let description = '';
  
  if (hasDecisionMaker && decisionMakerEngaged) {
    score = 90;
    impact = 'positive';
    description = 'C-level actively engaged';
  } else if (hasDecisionMaker) {
    score = 70;
    impact = 'positive';
    description = 'Decision maker identified';
  } else {
    score = 40;
    impact = 'negative';
    description = 'No decision maker engaged';
  }
  
  return {
    score,
    impact,
    description,
    value: hasDecisionMaker ? 'C-level involved' : 'No C-level',
    benchmark: 'C-level engaged'
  };
}

/**
 * Calculate budget factor
 * Deal value vs. stated budget
 */
function calculateBudgetFactor(deal: Deal): {
  score: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  value: string;
  benchmark: string;
} {
  const dealValue = deal.value || 0;
  const statedBudget = dealValue * 1.2; // Mock: assume budget is 20% higher
  
  let score = 50;
  let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let description = '';
  
  const ratio = dealValue / statedBudget;
  
  if (ratio <= 0.8) {
    score = 90;
    impact = 'positive';
    description = 'Well within budget';
  } else if (ratio <= 1.0) {
    score = 70;
    impact = 'positive';
    description = 'At budget';
  } else if (ratio <= 1.2) {
    score = 50;
    impact = 'neutral';
    description = 'Slightly over budget';
  } else {
    score = 30;
    impact = 'negative';
    description = 'Over budget - needs discount';
  }
  
  return {
    score,
    impact,
    description,
    value: `$${dealValue.toLocaleString()}`,
    benchmark: `$${statedBudget.toLocaleString()} budget`
  };
}

/**
 * Calculate competition factor
 */
function calculateCompetitionFactor(_deal: Deal): {
  score: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  value: string;
  benchmark: string;
} {
  // Mock: assume competitor mentioned in some deals
  const hasCompetitor = Math.random() > 0.6;
  const competitorCount = hasCompetitor ? Math.floor(Math.random() * 3) + 1 : 0;
  
  let score = 50;
  let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let description = '';
  
  if (competitorCount === 0) {
    score = 90;
    impact = 'positive';
    description = 'No competition detected';
  } else if (competitorCount === 1) {
    score = 70;
    impact = 'neutral';
    description = '1 competitor mentioned';
  } else if (competitorCount === 2) {
    score = 50;
    impact = 'neutral';
    description = '2 competitors mentioned';
  } else {
    score = 30;
    impact = 'negative';
    description = '3+ competitors - crowded deal';
  }
  
  return {
    score,
    impact,
    description,
    value: competitorCount === 0 ? 'None' : `${competitorCount} competitors`,
    benchmark: '0-1 competitors'
  };
}

/**
 * Calculate historical win rate factor
 */
function calculateHistoricalWinRateFactor(_deal: Deal, template: SalesIndustryTemplate | null): {
  score: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  value: string;
  benchmark: string;
} {
  // Mock: use benchmark from template
  const winRate = template?.benchmarks.avgWinRate ?? 30;
  
  let score = 50;
  let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let description = '';
  
  if (winRate >= 40) {
    score = 80;
    impact = 'positive';
    description = 'High win rate for similar deals';
  } else if (winRate >= 25) {
    score = 60;
    impact = 'neutral';
    description = 'Average win rate';
  } else {
    score = 40;
    impact = 'negative';
    description = 'Low win rate for similar deals';
  }
  
  return {
    score,
    impact,
    description,
    value: `${winRate}% historical win rate`,
    benchmark: '30%+ win rate'
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateCloseProbability(score: number, factors: ScoringFactor[], deal: Deal, template: SalesIndustryTemplate | null): number {
  // Base probability from score
  let probability = score * 0.7;
  
  // Adjust based on current stage
  const currentStage = (deal as { stage?: string }).stage;
  const stageProbability = template?.stages.find(s => s.id === currentStage)?.probability ?? 50;
  
  // Weighted combination
  probability = Math.round((probability * 0.6) + (stageProbability * 0.4));
  
  return Math.min(100, Math.max(0, probability));
}

function determineTier(score: number, probability: number, factors: ScoringFactor[]): 'hot' | 'warm' | 'cold' | 'at-risk' {
  // Check for at-risk indicators
  const hasNegativeFactors = factors.filter(f => f.impact === 'negative').length >= 3;
  if (hasNegativeFactors || score < 30) {
    return 'at-risk';
  }
  
  if (score >= 75 && probability >= 60) {return 'hot';}
  if (score >= 50 && probability >= 40) {return 'warm';}
  return 'cold';
}

function calculateConfidence(deal: Deal, factors: ScoringFactor[]): number {
  let confidence = 60;
  
  // More data = higher confidence
  if (deal.value > 0) {confidence += 10;}
  if ((deal as { stage?: string }).stage) {confidence += 10;}
  if (deal.createdAt) {confidence += 10;}
  
  // More factors with data = higher confidence
  const factorsWithData = factors.filter(f => f.value !== 'unknown').length;
  confidence += (factorsWithData / factors.length) * 10;
  
  return Math.min(100, Math.round(confidence));
}

function identifyRiskFactors(_deal: Deal, factors: ScoringFactor[], _template: SalesIndustryTemplate | null): RiskFactor[] {
  const risks: RiskFactor[] = [];
  
  factors.forEach(factor => {
    if (factor.impact === 'negative' && factor.score < 40) {
      let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
      if (factor.score < 20) {severity = 'critical';}
      else if (factor.score < 30) {severity = 'high';}
      
      risks.push({
        id: `risk_${factor.id}`,
        severity,
        category: mapFactorToCategory(factor.id),
        description: factor.description,
        impact: `Low ${factor.name} may cause deal to stall or close-lost`,
        mitigation: generateMitigation(factor.id, factor.description)
      });
    }
  });
  
  return risks.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

function mapFactorToCategory(factorId: string): RiskFactor['category'] {
  const mapping: Record<string, RiskFactor['category']> = {
    deal_age: 'timing',
    stage_velocity: 'timing',
    engagement: 'engagement',
    decision_maker: 'stakeholder',
    budget: 'budget',
    competition: 'competition',
    historical_win_rate: 'engagement'
  };
  return mapping[factorId] || 'engagement';
}

function generateMitigation(factorId: string, _description: string): string {
  const mitigations: Record<string, string> = {
    deal_age: 'Reach out immediately to re-engage. Consider offering limited-time incentive.',
    stage_velocity: 'Identify blockers and schedule next steps with clear timeline.',
    engagement: 'Increase touchpoints. Send valuable content. Schedule demo or call.',
    decision_maker: 'Request introduction to C-level. Escalate to senior sales leadership.',
    budget: 'Provide ROI justification or consider phased implementation.',
    competition: 'Generate battlecard. Highlight differentiation. Offer proof of concept.',
    historical_win_rate: 'Apply best practices from similar won deals. Get peer references.'
  };
  return mitigations[factorId] || 'Immediate action required';
}

function generateRecommendations(deal: Deal, factors: ScoringFactor[], risks: RiskFactor[], template: SalesIndustryTemplate | null): string[] {
  const recommendations: string[] = [];
  
  // Risk-based recommendations
  risks.slice(0, 3).forEach(risk => {
    recommendations.push(risk.mitigation);
  });
  
  // Factor-based recommendations
  const weakFactors = factors.filter(f => f.score < 50).slice(0, 2);
  weakFactors.forEach(factor => {
    recommendations.push(`Improve ${factor.name}: ${generateMitigation(factor.id, factor.description)}`);
  });
  
  // Template-based recommendations
  if (template?.bestPractices) {
    const topPractice = template.bestPractices.find(bp => bp.impact === 'high');
    if (topPractice) {
      recommendations.push(`Best Practice: ${topPractice.title}`);
    }
  }
  
  return recommendations.slice(0, 5);
}

function predictCloseDate(deal: Deal, factors: ScoringFactor[], template: SalesIndustryTemplate | null): Date | null {
  const avgCycle = template?.benchmarks.avgSalesCycle ?? 30;
  const velocityFactor = factors.find(f => f.id === 'stage_velocity');
  
  // Adjust based on velocity
  let adjustedCycle = avgCycle;
  if (velocityFactor && velocityFactor.score > 70) {
    adjustedCycle *= 0.8; // Faster
  } else if (velocityFactor && velocityFactor.score < 40) {
    adjustedCycle *= 1.3; // Slower
  }
  
  const dealCreatedAt = deal.createdAt as string | number | Date;
  const createdAt = new Date(dealCreatedAt);
  const predictedDate = new Date(createdAt.getTime() + (adjustedCycle * 24 * 60 * 60 * 1000));
  
  return predictedDate;
}

function predictFinalValue(deal: Deal, factors: ScoringFactor[]): number {
  const currentValue = deal.value || 0;
  const budgetFactor = factors.find(f => f.id === 'budget');
  
  // If over budget, likely to negotiate down
  if (budgetFactor && budgetFactor.score < 50) {
    return currentValue * 0.9; // 10% discount likely
  }
  
  return currentValue;
}

/**
 * Mock function to fetch deal
 * In real implementation, this would fetch from Firestore
 */
function fetchDeal(dealId: string): Deal {
  // Mock deal
  return {
    id: dealId,
    value: 50000,
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
  } as Deal;
}

/**
 * Batch score multiple deals
 */
export function batchScoreDeals(
  dealIds: string[],
  templateId?: string
): BatchScoringResult {
  const scores = new Map<string, DealScore>();

  for (const dealId of dealIds) {
    try {
      const score = calculateDealScore({
        dealId,
        templateId
      });
      scores.set(dealId, score);
    } catch (error) {
      logger.warn('Failed to score deal in batch', { dealId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  // Calculate summary
  const scoreValues = Array.from(scores.values());
  const avgScore = scoreValues.reduce((sum, s) => sum + s.score, 0) / scoreValues.length;
  
  return {
    scores,
    summary: {
      totalDeals: scores.size,
      avgScore: Math.round(avgScore),
      hotDeals: scoreValues.filter(s => s.tier === 'hot').length,
      warmDeals: scoreValues.filter(s => s.tier === 'warm').length,
      coldDeals: scoreValues.filter(s => s.tier === 'cold').length,
      atRiskDeals: scoreValues.filter(s => s.tier === 'at-risk').length
    }
  };
}

logger.info('Deal Scoring Engine initialized');
