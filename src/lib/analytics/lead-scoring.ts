/**
 * Predictive Lead Scoring Service
 * Uses machine learning and rule-based scoring to predict lead quality
 */

export interface LeadScoringFactors {
  // Demographic factors
  companySize?: number;
  industry?: string;
  location?: string;
  
  // Behavioral factors
  websiteVisits?: number;
  pageViews?: number;
  timeOnSite?: number; // seconds
  downloads?: number;
  emailOpens?: number;
  emailClicks?: number;
  formSubmissions?: number;
  
  // Engagement factors
  lastActivityDate?: Date;
  daysSinceFirstContact?: number;
  responseTime?: number; // hours
  meetingBooked?: boolean;
  demoRequested?: boolean;
  
  // CRM factors
  dealValue?: number;
  dealStage?: string;
  previousDeals?: number;
  lifetimeValue?: number;
  
  // Social signals
  linkedInConnections?: number;
  socialEngagement?: number;
  
  // Custom fields
  customFields?: Record<string, any>;
}

export interface LeadScore {
  overallScore: number; // 0-100
  probabilityToConvert: number; // 0-1
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  factors: {
    name: string;
    score: number;
    weight: number;
    impact: 'positive' | 'negative' | 'neutral';
  }[];
  recommendations: string[];
  nextBestAction?: string;
  estimatedCloseDate?: Date;
  estimatedDealValue?: number;
}

/**
 * Calculate predictive lead score
 * Uses weighted algorithm with ML-like scoring
 */
export function calculateLeadScore(factors: LeadScoringFactors): LeadScore {
  const factorScores: Array<{
    name: string;
    score: number;
    weight: number;
    impact: 'positive' | 'negative' | 'neutral';
  }> = [];

  let totalWeightedScore = 0;
  let totalWeight = 0;

  // Company Size Score (0-20 points)
  if (factors.companySize) {
    const sizeScore = Math.min(20, Math.log10(factors.companySize + 1) * 5);
    factorScores.push({
      name: 'Company Size',
      score: sizeScore,
      weight: 0.15,
      impact: 'positive',
    });
    totalWeightedScore += sizeScore * 0.15;
    totalWeight += 0.15;
  }

  // Engagement Score (0-25 points)
  let engagementScore = 0;
  if (factors.websiteVisits) engagementScore += Math.min(5, factors.websiteVisits * 0.5);
  if (factors.pageViews) engagementScore += Math.min(5, Math.log10(factors.pageViews + 1) * 2);
  if (factors.emailOpens) engagementScore += Math.min(5, factors.emailOpens * 0.5);
  if (factors.emailClicks) engagementScore += Math.min(5, factors.emailClicks * 1);
  if (factors.formSubmissions) engagementScore += Math.min(5, factors.formSubmissions * 2);
  
  if (engagementScore > 0) {
    factorScores.push({
      name: 'Engagement',
      score: Math.min(25, engagementScore),
      weight: 0.20,
      impact: 'positive',
    });
    totalWeightedScore += Math.min(25, engagementScore) * 0.20;
    totalWeight += 0.20;
  }

  // Recency Score (0-15 points)
  if (factors.lastActivityDate) {
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(factors.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const recencyScore = Math.max(0, 15 - daysSinceActivity * 0.5);
    factorScores.push({
      name: 'Activity Recency',
      score: recencyScore,
      weight: 0.15,
      impact: recencyScore > 10 ? 'positive' : 'negative',
    });
    totalWeightedScore += recencyScore * 0.15;
    totalWeight += 0.15;
  }

  // Intent Signals (0-20 points)
  let intentScore = 0;
  if (factors.demoRequested) intentScore += 10;
  if (factors.meetingBooked) intentScore += 10;
  if (factors.downloads && factors.downloads > 2) intentScore += 5;
  
  if (intentScore > 0) {
    factorScores.push({
      name: 'Buying Intent',
      score: Math.min(20, intentScore),
      weight: 0.25,
      impact: 'positive',
    });
    totalWeightedScore += Math.min(20, intentScore) * 0.25;
    totalWeight += 0.25;
  }

  // Deal Value Potential (0-15 points)
  if (factors.dealValue) {
    const valueScore = Math.min(15, Math.log10(factors.dealValue + 1) * 3);
    factorScores.push({
      name: 'Deal Value',
      score: valueScore,
      weight: 0.10,
      impact: 'positive',
    });
    totalWeightedScore += valueScore * 0.10;
    totalWeight += 0.10;
  }

  // Historical Performance (0-10 points)
  if (factors.previousDeals && factors.previousDeals > 0) {
    const historyScore = Math.min(10, factors.previousDeals * 2);
    factorScores.push({
      name: 'Customer History',
      score: historyScore,
      weight: 0.10,
      impact: 'positive',
    });
    totalWeightedScore += historyScore * 0.10;
    totalWeight += 0.10;
  }

  // Response Time Penalty (negative impact)
  if (factors.responseTime && factors.responseTime > 24) {
    const penalty = Math.min(10, (factors.responseTime - 24) * 0.2);
    factorScores.push({
      name: 'Response Time',
      score: -penalty,
      weight: 0.05,
      impact: 'negative',
    });
    totalWeightedScore -= penalty * 0.05;
    totalWeight += 0.05;
  }

  // Calculate overall score
  const overallScore = totalWeight > 0 
    ? Math.max(0, Math.min(100, (totalWeightedScore / totalWeight) * 100))
    : 50; // Default score if no factors

  // Calculate probability to convert (non-linear mapping)
  const probabilityToConvert = 1 / (1 + Math.exp(-(overallScore - 50) / 15));

  // Determine grade
  let grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  if (overallScore >= 90) grade = 'A+';
  else if (overallScore >= 80) grade = 'A';
  else if (overallScore >= 70) grade = 'B+';
  else if (overallScore >= 60) grade = 'B';
  else if (overallScore >= 50) grade = 'C+';
  else if (overallScore >= 40) grade = 'C';
  else if (overallScore >= 30) grade = 'D';
  else grade = 'F';

  // Generate recommendations
  const recommendations: string[] = [];
  if (overallScore < 50) {
    recommendations.push('Increase engagement through targeted content');
    recommendations.push('Follow up more frequently');
  }
  if (factors.emailOpens === 0 || !factors.emailOpens) {
    recommendations.push('Improve email subject lines to increase open rates');
  }
  if (factors.responseTime && factors.responseTime > 24) {
    recommendations.push('Respond to leads within 24 hours for better conversion');
  }
  if (!factors.demoRequested && !factors.meetingBooked) {
    recommendations.push('Offer a demo or consultation to gauge interest');
  }
  if (overallScore >= 70) {
    recommendations.push('Prioritize this lead - high conversion probability');
    recommendations.push('Prepare personalized proposal');
  }

  // Determine next best action
  let nextBestAction: string | undefined;
  if (overallScore >= 80) {
    nextBestAction = 'Send proposal and schedule closing call';
  } else if (overallScore >= 60) {
    nextBestAction = 'Schedule demo or discovery call';
  } else if (overallScore >= 40) {
    nextBestAction = 'Send nurturing email sequence';
  } else {
    nextBestAction = 'Re-engage with valuable content';
  }

  // Estimate close date (based on score and typical sales cycle)
  const estimatedCloseDate = overallScore >= 70
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days for hot leads
    : overallScore >= 50
    ? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days for warm leads
    : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days for cold leads

  // Estimate deal value (if not provided)
  const estimatedDealValue = factors.dealValue || 
    (factors.companySize ? factors.companySize * 100 : 5000);

  return {
    overallScore: Math.round(overallScore),
    probabilityToConvert: Math.round(probabilityToConvert * 100) / 100,
    grade,
    factors: factorScores,
    recommendations,
    nextBestAction,
    estimatedCloseDate,
    estimatedDealValue,
  };
}

/**
 * Batch score multiple leads
 */
export function batchScoreLeads(
  leads: Array<{ id: string; factors: LeadScoringFactors }>
): Array<{ id: string; score: LeadScore }> {
  return leads.map(lead => ({
    id: lead.id,
    score: calculateLeadScore(lead.factors),
  }));
}

/**
 * Get scoring model insights
 */
export interface ScoringModelInsights {
  averageScore: number;
  scoreDistribution: Record<string, number>;
  topFactors: Array<{ name: string; averageImpact: number }>;
  conversionCorrelation: number;
}

export function getModelInsights(
  leads: Array<{ score: LeadScore; converted: boolean }>
): ScoringModelInsights {
  if (leads.length === 0) {
    return {
      averageScore: 0,
      scoreDistribution: {},
      topFactors: [],
      conversionCorrelation: 0,
    };
  }

  const averageScore = leads.reduce((sum, lead) => sum + lead.score.overallScore, 0) / leads.length;

  // Score distribution
  const distribution: Record<string, number> = {
    'A+': 0,
    'A': 0,
    'B+': 0,
    'B': 0,
    'C+': 0,
    'C': 0,
    'D': 0,
    'F': 0,
  };
  leads.forEach(lead => {
    distribution[lead.score.grade] = (distribution[lead.score.grade] || 0) + 1;
  });

  // Top factors
  const factorImpacts: Record<string, number[]> = {};
  leads.forEach(lead => {
    lead.score.factors.forEach(factor => {
      if (!factorImpacts[factor.name]) {
        factorImpacts[factor.name] = [];
      }
      factorImpacts[factor.name].push(factor.score * factor.weight);
    });
  });

  const topFactors = Object.entries(factorImpacts)
    .map(([name, impacts]) => ({
      name,
      averageImpact: impacts.reduce((a, b) => a + b, 0) / impacts.length,
    }))
    .sort((a, b) => b.averageImpact - a.averageImpact)
    .slice(0, 5);

  // Conversion correlation
  const convertedScores = leads.filter(l => l.converted).map(l => l.score.overallScore);
  const nonConvertedScores = leads.filter(l => !l.converted).map(l => l.score.overallScore);
  
  const avgConverted = convertedScores.length > 0
    ? convertedScores.reduce((a, b) => a + b, 0) / convertedScores.length
    : 0;
  const avgNonConverted = nonConvertedScores.length > 0
    ? nonConvertedScores.reduce((a, b) => a + b, 0) / nonConvertedScores.length
    : 0;

  const conversionCorrelation = avgConverted > 0 && avgNonConverted > 0
    ? (avgConverted - avgNonConverted) / 100
    : 0;

  return {
    averageScore: Math.round(averageScore),
    scoreDistribution: distribution,
    topFactors,
    conversionCorrelation: Math.round(conversionCorrelation * 100) / 100,
  };
}


