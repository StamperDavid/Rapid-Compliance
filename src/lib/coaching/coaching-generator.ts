/**
 * AI Coaching Generator
 * 
 * SOVEREIGN CORPORATE BRAIN - COACHING MODULE
 * 
 * Uses GPT-4o to generate personalized coaching insights and recommendations
 * based on comprehensive performance analysis.
 * 
 * CAPABILITIES:
 * - Performance summary generation
 * - Strength identification and leverage strategies
 * - Weakness analysis with root cause identification
 * - Opportunity spotting with impact projections
 * - Risk assessment and mitigation strategies
 * - Best practice recommendations from top performers
 * - Personalized coaching recommendations
 * - Training suggestions with specific resources
 * - Actionable item creation with timelines
 * 
 * INTEGRATION:
 * - Uses unified-ai-service for GPT-4o access
 * - Coaching Analytics Engine for performance data
 * - Signal Bus for event tracking
 * 
 * AI MODEL:
 * - GPT-4o for high-quality coaching insights
 * - Structured output for consistency
 * - Temperature 0.7 for creative but grounded suggestions
 */

import { logger } from '@/lib/logger/logger';
import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';
import type {
  RepPerformanceMetrics,
  CoachingInsights,
  PerformanceSummary,
  Strength,
  Weakness,
  Opportunity,
  Risk,
  BestPractice,
  CoachingRecommendation,
  TrainingSuggestion,
  ActionItem,
  TeamCoachingInsights,
  TeamPerformanceSummary
} from './types';

// ============================================================================
// COACHING GENERATOR CLASS
// ============================================================================

export class CoachingGenerator {
  /**
   * Generates comprehensive coaching insights for a sales rep
   */
  async generateCoachingInsights(
    performance: RepPerformanceMetrics,
    options: {
      includeDetailed?: boolean;
      includeTraining?: boolean;
      includeActionItems?: boolean;
    } = {}
  ): Promise<CoachingInsights> {
    const startTime = Date.now();
    
    try {
      logger.info('Generating coaching insights', {
        repId: performance.repId,
        repName: performance.repName,
        tier: performance.tier,
        overallScore: performance.overallScore
      });
      
      // Generate all insight components
      const [
        performanceSummary,
        strengths,
        weaknesses,
        opportunities,
        risks,
        bestPractices,
        recommendations
      ] = await Promise.all([
        this.generatePerformanceSummary(performance),
        this.identifyStrengths(performance),
        this.identifyWeaknesses(performance),
        this.identifyOpportunities(performance),
        this.assessRisks(performance),
        this.identifyBestPractices(performance),
        this.generateRecommendations(performance)
      ]);
      
      // Generate training suggestions (if requested)
      const training = options.includeTraining !== false
        ? await this.generateTrainingSuggestions(performance, weaknesses)
        : [];
      
      // Generate action items (if requested)
      const actionItems = options.includeActionItems !== false
        ? await this.generateActionItems(performance, recommendations)
        : [];
      
      // Calculate overall confidence score
      const confidenceScore = this.calculateConfidenceScore(performance);
      
      const insights: CoachingInsights = {
        repId: performance.repId,
        repName: performance.repName,
        generatedAt: new Date(),
        performanceSummary,
        strengths,
        weaknesses,
        opportunities,
        risks,
        bestPractices,
        recommendations,
        training,
        actionItems,
        confidenceScore
      };
      
      logger.info('Coaching insights generated successfully', {
        repId: performance.repId,
        recommendationCount: recommendations.length,
        actionItemCount: actionItems.length,
        confidenceScore,
        durationMs: Date.now() - startTime
      });
      
      return insights;
    } catch (error) {
      logger.error('Error generating coaching insights', {
        repId: performance.repId,
        error
      });
      throw error;
    }
  }

  /**
   * Generates performance summary using AI
   */
  private async generatePerformanceSummary(
    performance: RepPerformanceMetrics
  ): Promise<PerformanceSummary> {
    const prompt = this.buildPerformanceSummaryPrompt(performance);
    
    const response = await sendUnifiedChatMessage({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      maxTokens: 1000
    });
    
    try {
      const parsed = JSON.parse(response.text);
      return {
        assessment: parsed.assessment || 'Performance analysis completed',
        currentTier: performance.tier,
        trend: parsed.trend || this.inferTrend(performance),
        keyMetrics: parsed.keyMetrics || this.getKeyMetrics(performance),
        focusAreas: parsed.focusAreas || this.getFocusAreas(performance)
      };
    } catch (error) {
      logger.error('Error parsing performance summary', { error });
      // Fallback to rule-based summary
      return this.generateFallbackSummary(performance);
    }
  }

  /**
   * Identifies rep strengths using AI
   */
  private async identifyStrengths(
    performance: RepPerformanceMetrics
  ): Promise<Strength[]> {
    const prompt = this.buildStrengthsPrompt(performance);
    
    const response = await sendUnifiedChatMessage({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      maxTokens: 1500
    });
    
    try {
      const parsed = JSON.parse(response.text);
      return parsed.strengths || this.identifyStrengthsFallback(performance);
    } catch (error) {
      logger.error('Error parsing strengths', { error });
      return this.identifyStrengthsFallback(performance);
    }
  }

  /**
   * Identifies rep weaknesses using AI
   */
  private async identifyWeaknesses(
    performance: RepPerformanceMetrics
  ): Promise<Weakness[]> {
    const prompt = this.buildWeaknessesPrompt(performance);
    
    const response = await sendUnifiedChatMessage({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      maxTokens: 1500
    });
    
    try {
      const parsed = JSON.parse(response.text);
      return parsed.weaknesses || this.identifyWeaknessesFallback(performance);
    } catch (error) {
      logger.error('Error parsing weaknesses', { error });
      return this.identifyWeaknessesFallback(performance);
    }
  }

  /**
   * Identifies improvement opportunities using AI
   */
  private async identifyOpportunities(
    performance: RepPerformanceMetrics
  ): Promise<Opportunity[]> {
    const prompt = this.buildOpportunitiesPrompt(performance);
    
    const response = await sendUnifiedChatMessage({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      maxTokens: 2000
    });
    
    try {
      const parsed = JSON.parse(response.text);
      return parsed.opportunities || this.identifyOpportunitiesFallback(performance);
    } catch (error) {
      logger.error('Error parsing opportunities', { error });
      return this.identifyOpportunitiesFallback(performance);
    }
  }

  /**
   * Assesses performance risks using AI
   */
  private async assessRisks(
    performance: RepPerformanceMetrics
  ): Promise<Risk[]> {
    const prompt = this.buildRisksPrompt(performance);
    
    const response = await sendUnifiedChatMessage({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
      maxTokens: 1500
    });
    
    try {
      const parsed = JSON.parse(response.text);
      return parsed.risks || this.assessRisksFallback(performance);
    } catch (error) {
      logger.error('Error parsing risks', { error });
      return this.assessRisksFallback(performance);
    }
  }

  /**
   * Identifies best practices from top performers
   */
  private async identifyBestPractices(
    performance: RepPerformanceMetrics
  ): Promise<BestPractice[]> {
    const prompt = this.buildBestPracticesPrompt(performance);
    
    const response = await sendUnifiedChatMessage({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      maxTokens: 2000
    });
    
    try {
      const parsed = JSON.parse(response.text);
      return parsed.bestPractices || [];
    } catch (error) {
      logger.error('Error parsing best practices', { error });
      return [];
    }
  }

  /**
   * Generates personalized coaching recommendations
   */
  private async generateRecommendations(
    performance: RepPerformanceMetrics
  ): Promise<CoachingRecommendation[]> {
    const prompt = this.buildRecommendationsPrompt(performance);
    
    const response = await sendUnifiedChatMessage({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      maxTokens: 3000
    });
    
    try {
      const parsed = JSON.parse(response.text);
      return parsed.recommendations || this.generateRecommendationsFallback(performance);
    } catch (error) {
      logger.error('Error parsing recommendations', { error });
      return this.generateRecommendationsFallback(performance);
    }
  }

  /**
   * Generates training suggestions
   */
  private async generateTrainingSuggestions(
    performance: RepPerformanceMetrics,
    weaknesses: Weakness[]
  ): Promise<TrainingSuggestion[]> {
    const prompt = this.buildTrainingPrompt(performance, weaknesses);
    
    const response = await sendUnifiedChatMessage({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      maxTokens: 2000
    });
    
    try {
      const parsed = JSON.parse(response.text);
      return parsed.trainingSuggestions || [];
    } catch (error) {
      logger.error('Error parsing training suggestions', { error });
      return [];
    }
  }

  /**
   * Generates actionable items
   */
  private async generateActionItems(
    performance: RepPerformanceMetrics,
    recommendations: CoachingRecommendation[]
  ): Promise<ActionItem[]> {
    const prompt = this.buildActionItemsPrompt(performance, recommendations);
    
    const response = await sendUnifiedChatMessage({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
      maxTokens: 2000
    });
    
    try {
      const parsed = JSON.parse(response.text);
      return parsed.actionItems || [];
    } catch (error) {
      logger.error('Error parsing action items', { error });
      return [];
    }
  }

  // ============================================================================
  // PROMPT BUILDERS
  // ============================================================================

  private buildPerformanceSummaryPrompt(performance: RepPerformanceMetrics): string {
    return `You are an expert sales coach analyzing a sales representative's performance.

PERFORMANCE DATA:
- Rep: ${performance.repName}
- Tier: ${performance.tier}
- Overall Score: ${performance.overallScore}/100
- Period: ${performance.period}

KEY METRICS:
- Win Rate: ${(performance.deals.winRate * 100).toFixed(1)}%
- Quota Attainment: ${(performance.revenue.quotaAttainment * 100).toFixed(1)}%
- Deal Velocity: ${performance.deals.dealVelocity.toFixed(1)} deals/week
- Email Response Rate: ${(performance.communication.emailResponseRate * 100).toFixed(1)}%
- AI Tool Adoption: ${performance.skills.aiToolAdoption.toFixed(1)}/100

VS TEAM AVERAGE:
- Score: ${performance.vsTeamAverage.overallScoreDelta > 0 ? '+' : ''}${performance.vsTeamAverage.overallScoreDelta.toFixed(1)} points
- Percentile Rank: ${performance.vsTeamAverage.percentileRank.toFixed(0)}th

Generate a concise performance summary with:
1. Overall assessment (2-3 sentences)
2. Trend (improving/stable/declining)
3. Top 3-5 key metrics with team comparison
4. Top 3 focus areas

Return as JSON:
{
  "assessment": "string",
  "trend": "improving|stable|declining",
  "keyMetrics": [
    {
      "metric": "string",
      "value": number,
      "vsTeamAverage": number,
      "trend": "up|down|stable"
    }
  ],
  "focusAreas": ["area1", "area2", "area3"]
}`;
  }

  private buildStrengthsPrompt(performance: RepPerformanceMetrics): string {
    return `You are an expert sales coach identifying a rep's key strengths.

REP SKILLS (0-100):
${Object.entries(performance.skills).map(([skill, score]) => `- ${skill}: ${score.toFixed(0)}`).join('\n')}

PERFORMANCE METRICS:
- Win Rate: ${(performance.deals.winRate * 100).toFixed(1)}%
- Quota Attainment: ${(performance.revenue.quotaAttainment * 100).toFixed(1)}%
- Email Response Rate: ${(performance.communication.emailResponseRate * 100).toFixed(1)}%

Identify top 3-5 strengths. For each strength:
1. Category (from skills above)
2. Title (clear, specific)
3. Description (why this is a strength)
4. Supporting metrics
5. How to leverage this strength
6. Impact level (high/medium/low)

Return as JSON:
{
  "strengths": [
    {
      "category": "string",
      "title": "string",
      "description": "string",
      "metrics": [{ "metric": "string", "value": number, "benchmark": number }],
      "leverageStrategy": "string",
      "impact": "high|medium|low"
    }
  ]
}`;
  }

  private buildWeaknessesPrompt(performance: RepPerformanceMetrics): string {
    return `You are an expert sales coach identifying areas for improvement.

REP SKILLS (0-100):
${Object.entries(performance.skills)
  .filter(([_, score]) => score < 60)
  .map(([skill, score]) => `- ${skill}: ${score.toFixed(0)}`)
  .join('\n')}

CONVERSION FUNNEL:
- Lead → Opportunity: ${(performance.conversion.leadToOpportunity * 100).toFixed(1)}%
- Opportunity → Proposal: ${(performance.conversion.opportunityToProposal * 100).toFixed(1)}%
- Proposal → Close: ${(performance.conversion.proposalToClose * 100).toFixed(1)}%

Identify top 3-5 weaknesses. For each:
1. Category
2. Title
3. Description
4. Supporting metrics with gaps
5. Root causes (2-3)
6. Impact level
7. Urgency (immediate/near_term/long_term)

Return as JSON:
{
  "weaknesses": [
    {
      "category": "string",
      "title": "string",
      "description": "string",
      "metrics": [{ "metric": "string", "value": number, "benchmark": number, "gap": number }],
      "rootCauses": ["cause1", "cause2"],
      "impact": "high|medium|low",
      "urgency": "immediate|near_term|long_term"
    }
  ]
}`;
  }

  private buildOpportunitiesPrompt(performance: RepPerformanceMetrics): string {
    return `You are an expert sales coach identifying improvement opportunities.

CURRENT PERFORMANCE:
- Overall Score: ${performance.overallScore}/100
- Win Rate: ${(performance.deals.winRate * 100).toFixed(1)}%
- Quota Attainment: ${(performance.revenue.quotaAttainment * 100).toFixed(1)}%
- AI Tool Usage: ${(performance.efficiency.automationUsage * 100).toFixed(1)}%

EFFICIENCY:
- Time to Close: ${performance.efficiency.timeToClose.toFixed(0)} days
- Touch Points per Deal: ${performance.efficiency.touchPointsPerDeal.toFixed(1)}
- Hours Saved via AI: ${performance.efficiency.hoursSaved.toFixed(1)}

Identify top 3-5 opportunities. For each:
1. Title
2. Description
3. Category
4. Potential impact (specific metric improvements)
5. Recommended actions (2-4)
6. Difficulty (easy/medium/hard)
7. Time to impact (immediate/short_term/long_term)
8. Priority (critical/high/medium/low)

Return as JSON:
{
  "opportunities": [
    {
      "title": "string",
      "description": "string",
      "category": "string",
      "potentialImpact": [
        { "metric": "string", "currentValue": number, "projectedValue": number, "improvement": number }
      ],
      "actions": ["action1", "action2"],
      "difficulty": "easy|medium|hard",
      "timeToImpact": "immediate|short_term|long_term",
      "priority": "critical|high|medium|low"
    }
  ]
}`;
  }

  private buildRisksPrompt(performance: RepPerformanceMetrics): string {
    return `You are an expert sales coach assessing performance risks.

RISK INDICATORS:
- Tier: ${performance.tier}
- Win Rate: ${(performance.deals.winRate * 100).toFixed(1)}%
- Quota Attainment: ${(performance.revenue.quotaAttainment * 100).toFixed(1)}%
- At-Risk Deals: ${performance.deals.atRiskDeals}
- Activity Level: ${performance.activity.activitiesPerDay.toFixed(1)}/day

Identify top 3-5 risks. For each:
1. Title
2. Description
3. Category
4. Severity (critical/high/medium/low)
5. Likelihood (very_likely/likely/possible/unlikely)
6. Indicators (2-4)
7. Mitigation strategies (2-4)
8. Escalation threshold (optional)

Return as JSON:
{
  "risks": [
    {
      "title": "string",
      "description": "string",
      "category": "string",
      "severity": "critical|high|medium|low",
      "likelihood": "very_likely|likely|possible|unlikely",
      "indicators": ["indicator1", "indicator2"],
      "mitigationStrategies": ["strategy1", "strategy2"],
      "escalationThreshold": "string"
    }
  ]
}`;
  }

  private buildBestPracticesPrompt(performance: RepPerformanceMetrics): string {
    return `You are an expert sales coach identifying best practices from top performers.

REP PERFORMANCE:
- Current Tier: ${performance.tier}
- Areas for Improvement: ${Object.entries(performance.skills)
  .filter(([_, score]) => score < 60)
  .map(([skill]) => skill)
  .join(', ')}

Suggest 2-4 best practices from top performers. For each:
1. Title
2. Description
3. Category
4. Top performers who use this
5. Success metrics comparison
6. Implementation steps (3-5)
7. Expected impact

Return as JSON:
{
  "bestPractices": [
    {
      "title": "string",
      "description": "string",
      "category": "string",
      "topPerformers": ["name1", "name2"],
      "successMetrics": [
        { "metric": "string", "topPerformerAverage": number, "repCurrent": number, "gap": number }
      ],
      "implementationSteps": ["step1", "step2", "step3"],
      "expectedImpact": "string"
    }
  ]
}`;
  }

  private buildRecommendationsPrompt(performance: RepPerformanceMetrics): string {
    return `You are an expert sales coach creating personalized coaching recommendations.

REP: ${performance.repName}
TIER: ${performance.tier}
SCORE: ${performance.overallScore}/100

TOP AREAS TO IMPROVE:
${Object.entries(performance.skills)
  .filter(([_, score]) => score < 60)
  .sort((a, b) => a[1] - b[1])
  .slice(0, 5)
  .map(([skill, score]) => `- ${skill}: ${score.toFixed(0)}/100`)
  .join('\n')}

Create 3-5 actionable coaching recommendations. For each:
1. ID (unique)
2. Title
3. Detailed recommendation (2-3 paragraphs)
4. Category
5. Rationale
6. Specific actions (3-5) with timeline and owner
7. Success criteria (2-4)
8. Expected outcomes with metrics
9. Priority
10. Effort required
11. Confidence score (0-1)

Return as JSON:
{
  "recommendations": [
    {
      "id": "string",
      "title": "string",
      "recommendation": "string",
      "category": "string",
      "rationale": "string",
      "actions": [
        { "action": "string", "timeline": "string", "owner": "rep|manager|both" }
      ],
      "successCriteria": ["criterion1", "criterion2"],
      "expectedOutcomes": [
        { "metric": "string", "baseline": number, "target": number, "timeframe": "string" }
      ],
      "priority": "critical|high|medium|low",
      "effort": "high|medium|low",
      "confidence": number
    }
  ]
}`;
  }

  private buildTrainingPrompt(
    performance: RepPerformanceMetrics,
    weaknesses: Weakness[]
  ): string {
    return `You are an expert sales coach recommending training for skill development.

SKILL GAPS:
${weaknesses.map(w => `- ${w.category}: ${w.title}`).join('\n')}

Recommend 2-4 training programs. For each:
1. Title
2. Description
3. Category
4. Type (course/workshop/mentorship/shadowing/self_study/certification)
5. Resources (with URLs if available)
6. Expected skill improvement
7. Priority

Return as JSON:
{
  "trainingSuggestions": [
    {
      "title": "string",
      "description": "string",
      "category": "string",
      "type": "course|workshop|mentorship|shadowing|self_study|certification",
      "resources": [
        { "name": "string", "type": "string", "url": "string", "duration": "string" }
      ],
      "skillImprovement": [
        { "skill": "string", "currentLevel": number, "targetLevel": number }
      ],
      "priority": "critical|high|medium|low"
    }
  ]
}`;
  }

  private buildActionItemsPrompt(
    performance: RepPerformanceMetrics,
    recommendations: CoachingRecommendation[]
  ): string {
    return `You are an expert sales coach creating actionable tasks from recommendations.

RECOMMENDATIONS:
${recommendations.map((r, i) => `${i + 1}. ${r.title}`).join('\n')}

Create 5-8 specific action items. For each:
1. ID (unique)
2. Title
3. Description
4. Category
5. Owner (rep/manager/both)
6. Due date (relative to now)
7. Estimated effort (hours)
8. Priority
9. Success metrics (2-3)
10. Related recommendations

Return as JSON:
{
  "actionItems": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "category": "string",
      "owner": "rep|manager|both",
      "daysFromNow": number,
      "estimatedEffort": number,
      "priority": "critical|high|medium|low",
      "successMetrics": ["metric1", "metric2"],
      "relatedRecommendations": ["id1", "id2"]
    }
  ]
}`;
  }

  // ============================================================================
  // FALLBACK METHODS (Rule-based)
  // ============================================================================

  private generateFallbackSummary(performance: RepPerformanceMetrics): PerformanceSummary {
    return {
      assessment: `${performance.repName} is currently a ${performance.tier.replace('_', ' ')} with an overall score of ${performance.overallScore.toFixed(0)}/100.`,
      currentTier: performance.tier,
      trend: this.inferTrend(performance),
      keyMetrics: this.getKeyMetrics(performance),
      focusAreas: this.getFocusAreas(performance)
    };
  }

  private inferTrend(performance: RepPerformanceMetrics): 'improving' | 'stable' | 'declining' {
    if (performance.revenue.growthRate > 0.1) return 'improving';
    if (performance.revenue.growthRate < -0.1) return 'declining';
    return 'stable';
  }

  private getKeyMetrics(performance: RepPerformanceMetrics): Array<{
    metric: string;
    value: number;
    vsTeamAverage: number;
    trend: 'up' | 'down' | 'stable';
  }> {
    return [
      {
        metric: 'Win Rate',
        value: performance.deals.winRate * 100,
        vsTeamAverage: performance.vsTeamAverage.winRateDelta * 100,
        trend: (performance.deals.winRate > 0.5 ? 'up' : 'down') as 'up' | 'down'
      },
      {
        metric: 'Quota Attainment',
        value: performance.revenue.quotaAttainment * 100,
        vsTeamAverage: performance.vsTeamAverage.overallScoreDelta,
        trend: (performance.revenue.quotaAttainment >= 1 ? 'up' : 'down') as 'up' | 'down'
      }
    ];
  }

  private getFocusAreas(performance: RepPerformanceMetrics): string[] {
    const areas: string[] = [];
    
    if (performance.deals.winRate < 0.4) areas.push('Win Rate Improvement');
    if (performance.revenue.quotaAttainment < 0.8) areas.push('Quota Attainment');
    if (performance.efficiency.automationUsage < 0.3) areas.push('AI Tool Adoption');
    
    return areas.slice(0, 3);
  }

  private identifyStrengthsFallback(performance: RepPerformanceMetrics): Strength[] {
    const strengths: Strength[] = [];
    
    if (performance.deals.winRate > 0.6) {
      strengths.push({
        category: 'closing',
        title: 'Strong Closing Ability',
        description: 'Consistently high win rate demonstrates effective closing techniques.',
        metrics: [{ metric: 'Win Rate', value: performance.deals.winRate * 100, benchmark: 50 }],
        leverageStrategy: 'Mentor other reps on closing techniques',
        impact: 'high'
      });
    }
    
    return strengths;
  }

  private identifyWeaknessesFallback(performance: RepPerformanceMetrics): Weakness[] {
    const weaknesses: Weakness[] = [];
    
    if (performance.deals.winRate < 0.4) {
      weaknesses.push({
        category: 'closing',
        title: 'Low Win Rate',
        description: 'Win rate is below team average and industry benchmarks.',
        metrics: [{
          metric: 'Win Rate',
          value: performance.deals.winRate * 100,
          benchmark: 50,
          gap: 50 - (performance.deals.winRate * 100)
        }],
        rootCauses: ['Proposal quality', 'Objection handling'],
        impact: 'high',
        urgency: 'immediate'
      });
    }
    
    return weaknesses;
  }

  private identifyOpportunitiesFallback(performance: RepPerformanceMetrics): Opportunity[] {
    return [];
  }

  private assessRisksFallback(performance: RepPerformanceMetrics): Risk[] {
    const risks: Risk[] = [];
    
    if (performance.tier === 'at_risk') {
      risks.push({
        title: 'Performance At Risk',
        description: 'Overall performance is significantly below expectations.',
        category: 'performance',
        severity: 'critical',
        likelihood: 'very_likely',
        indicators: ['Low overall score', 'Below quota'],
        mitigationStrategies: ['Immediate coaching intervention', 'Performance improvement plan'],
        escalationThreshold: 'If no improvement in 30 days'
      });
    }
    
    return risks;
  }

  private generateRecommendationsFallback(performance: RepPerformanceMetrics): CoachingRecommendation[] {
    return [];
  }

  private calculateConfidenceScore(performance: RepPerformanceMetrics): number {
    // Higher confidence with more data points
    const dataPoints = [
      performance.deals.totalDeals,
      performance.communication.emailsSent,
      performance.activity.totalActivities
    ];
    
    const totalDataPoints = dataPoints.reduce((sum, val) => sum + val, 0);
    
    // Scale confidence based on data volume
    if (totalDataPoints > 100) return 0.95;
    if (totalDataPoints > 50) return 0.85;
    if (totalDataPoints > 20) return 0.75;
    if (totalDataPoints > 10) return 0.65;
    return 0.50;
  }
}
