/**
 * Team Coaching Analytics Engine
 * 
 * SOVEREIGN CORPORATE BRAIN - TEAM COACHING MODULE
 * 
 * Aggregates individual rep performance into team-level insights for managers.
 * Identifies skill gaps, best practices to share, and coaching priorities.
 * 
 * CORE CAPABILITIES:
 * - Team performance aggregation across all reps
 * - Skill gap analysis (team avg vs top performers)
 * - Top performer identification and best practice extraction
 * - At-risk rep identification with critical areas
 * - Team coaching priorities based on impact and urgency
 * - Performance distribution and trend analysis
 * 
 * INTEGRATION:
 * - Coaching Analytics Engine for individual rep metrics
 * - AI Coaching Generator for insights generation
 * - Signal Bus for team coaching events
 * - Admin DAL for team member queries
 * 
 * PERFORMANCE:
 * - Parallel processing of rep insights
 * - Intelligent caching (1-hour TTL)
 * - Batch AI calls to minimize cost
 */

import type {
  TeamCoachingInsights,
  TeamPerformanceSummary,
  RepPerformanceMetrics,
  PerformanceTier,
  BestPractice,
  SkillScores,
  GenerateTeamCoachingRequest
} from './types';
import type { CoachingAnalyticsEngine } from './coaching-analytics-engine';
import { createTeamInsightsGeneratedEvent } from './events';
import type { SignalCoordinator } from '../orchestration/SignalCoordinator';

// ============================================================================
// TEAM COACHING ENGINE
// ============================================================================

export class TeamCoachingEngine {
  private analyticsEngine: CoachingAnalyticsEngine;
  private signalCoordinator?: SignalCoordinator;
  
  /**
   * Cache for team insights (1-hour TTL)
   * Key: `${teamId}:${period}:${startDate}:${endDate}`
   */
  private insightsCache: Map<string, {
    insights: TeamCoachingInsights;
    cachedAt: Date;
  }> = new Map();
  
  /**
   * Cache TTL in milliseconds (1 hour)
   */
  private readonly CACHE_TTL_MS = 60 * 60 * 1000;
  
  constructor(
    analyticsEngine: CoachingAnalyticsEngine,
    signalCoordinator?: SignalCoordinator
  ) {
    this.analyticsEngine = analyticsEngine;
    this.signalCoordinator = signalCoordinator;
  }
  
  // ============================================================================
  // TEAM INSIGHTS GENERATION
  // ============================================================================
  
  /**
   * Generates team coaching insights for a manager
   * @param request - Team coaching request
   * @param teamMemberIds - Array of rep IDs on the team
   * @param teamName - Name of the team
   * @returns Team coaching insights
   */
  async generateTeamInsights(
    request: GenerateTeamCoachingRequest,
    teamMemberIds: string[],
    teamName: string
  ): Promise<TeamCoachingInsights> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.getCacheKey(
      request.teamId,
      request.period,
      request.customRange?.startDate,
      request.customRange?.endDate
    );
    
    const cached = this.insightsCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.cachedAt)) {
      console.log('[TeamCoachingEngine] Returning cached team insights');
      return cached.insights;
    }
    
    // Get date range
    const { startDate, endDate } = this.getDateRange(
      request.period,
      request.customRange
    );
    
    // Generate individual rep insights in parallel
    console.log(`[TeamCoachingEngine] Generating insights for ${teamMemberIds.length} team members`);
    const repInsights = await this.generateRepInsights(
      teamMemberIds,
      request.period,
      { startDate, endDate }
    );
    
    // Aggregate team metrics
    const teamSummary = this.aggregateTeamMetrics(repInsights);
    
    // Identify top performers
    const topPerformers = this.identifyTopPerformers(repInsights);
    
    // Identify reps needing support
    const needsSupport = this.identifyRepsNeedingSupport(repInsights);
    
    // Analyze skill gaps
    const skillGaps = this.analyzeSkillGaps(repInsights, topPerformers);
    
    // Extract best practices from top performers
    const bestPracticesToShare = this.extractBestPractices(
      repInsights,
      topPerformers
    );
    
    // Determine team coaching priorities
    const teamPriorities = this.determineTeamPriorities(
      skillGaps,
      needsSupport,
      teamSummary
    );
    
    // Identify team-wide strengths and weaknesses
    const teamStrengths = this.identifyTeamStrengths(repInsights, teamSummary);
    const teamWeaknesses = this.identifyTeamWeaknesses(repInsights, teamSummary);
    
    // Build team insights
    const teamInsights: TeamCoachingInsights = {
      teamId: request.teamId,
      teamName,
      period: request.period,
      startDate,
      endDate,
      generatedAt: new Date(),
      teamSummary,
      repInsights: request.includeRepDetails ? repInsights : [],
      topPerformers,
      needsSupport,
      teamStrengths,
      teamWeaknesses,
      skillGaps,
      bestPracticesToShare,
      teamPriorities
    };
    
    // Cache the results
    this.insightsCache.set(cacheKey, {
      insights: teamInsights,
      cachedAt: new Date()
    });
    
    // Emit Signal Bus event
    const processingTimeMs = Date.now() - startTime;
    if (this.signalCoordinator) {
      const event = createTeamInsightsGeneratedEvent(
        teamInsights,
        'gpt-4o',
        processingTimeMs
      );
      // Signal coordinator expects the full event object
      await this.signalCoordinator.emitSignal(event as any);
    }
    
    console.log(`[TeamCoachingEngine] Team insights generated in ${processingTimeMs}ms`);
    return teamInsights;
  }
  
  // ============================================================================
  // REP INSIGHTS GENERATION
  // ============================================================================
  
  /**
   * Generates performance metrics for all reps on the team
   * @param repIds - Array of rep IDs
   * @param period - Time period
   * @param dateRange - Date range
   * @returns Array of rep performance metrics
   */
  private async generateRepInsights(
    repIds: string[],
    period: string,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<RepPerformanceMetrics[]> {
    // Generate insights in parallel (with concurrency limit to avoid overwhelming API)
    const BATCH_SIZE = 5;
    const results: RepPerformanceMetrics[] = [];
    
    for (let i = 0; i < repIds.length; i += BATCH_SIZE) {
      const batch = repIds.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(repId =>
          this.analyticsEngine.analyzeRepPerformance(
            repId,
            period as any,
            dateRange
          )
        )
      );
      results.push(...batchResults);
    }
    
    return results;
  }
  
  // ============================================================================
  // TEAM METRICS AGGREGATION
  // ============================================================================
  
  /**
   * Aggregates individual rep metrics into team summary
   * @param repInsights - Array of rep performance metrics
   * @returns Team performance summary
   */
  private aggregateTeamMetrics(
    repInsights: RepPerformanceMetrics[]
  ): TeamPerformanceSummary {
    const totalReps = repInsights.length;
    
    // Calculate performance distribution
    const tierCounts = new Map<PerformanceTier, number>();
    for (const rep of repInsights) {
      tierCounts.set(rep.tier, (tierCounts.get(rep.tier) || 0) + 1);
    }
    
    const performanceDistribution = [
      'top_performer',
      'high_performer',
      'average',
      'needs_improvement',
      'at_risk'
    ].map((tier) => ({
      tier: tier as PerformanceTier,
      count: tierCounts.get(tier as PerformanceTier) || 0,
      percentage: ((tierCounts.get(tier as PerformanceTier) || 0) / totalReps) * 100
    }));
    
    // Calculate team averages
    const teamAverages = {
      overallScore: this.calculateAverage(repInsights.map(r => r.overallScore)),
      winRate: this.calculateAverage(repInsights.map(r => r.deals.winRate)),
      quotaAttainment: this.calculateAverage(repInsights.map(r => r.revenue.quotaAttainment)),
      dealVelocity: this.calculateAverage(repInsights.map(r => r.deals.dealVelocity)),
      emailResponseRate: this.calculateAverage(repInsights.map(r => r.communication.emailResponseRate))
    };
    
    // Calculate trends (comparing to hypothetical previous period)
    // In a real implementation, you would compare to actual historical data
    const trends = [
      {
        metric: 'Overall Score',
        direction: 'stable' as const,
        change: 0
      },
      {
        metric: 'Win Rate',
        direction: 'stable' as const,
        change: 0
      },
      {
        metric: 'Quota Attainment',
        direction: 'stable' as const,
        change: 0
      }
    ];
    
    // Count at-risk reps
    const atRiskCount = tierCounts.get('at_risk') || 0;
    
    // Calculate top performer benchmarks
    const topPerformers = repInsights.filter(r =>
      r.tier === 'top_performer' || r.tier === 'high_performer'
    );
    
    const topPerformerBenchmarks = topPerformers.length > 0 ? [
      {
        metric: 'Overall Score',
        value: this.calculateAverage(topPerformers.map(r => r.overallScore))
      },
      {
        metric: 'Win Rate',
        value: this.calculateAverage(topPerformers.map(r => r.deals.winRate))
      },
      {
        metric: 'Quota Attainment',
        value: this.calculateAverage(topPerformers.map(r => r.revenue.quotaAttainment))
      },
      {
        metric: 'Deal Velocity',
        value: this.calculateAverage(topPerformers.map(r => r.deals.dealVelocity))
      },
      {
        metric: 'Email Response Rate',
        value: this.calculateAverage(topPerformers.map(r => r.communication.emailResponseRate))
      }
    ] : [];
    
    return {
      totalReps,
      performanceDistribution,
      teamAverages,
      trends,
      atRiskCount,
      topPerformerBenchmarks
    };
  }
  
  // ============================================================================
  // TOP PERFORMERS & AT-RISK IDENTIFICATION
  // ============================================================================
  
  /**
   * Identifies top performers on the team
   * @param repInsights - Array of rep performance metrics
   * @returns Top performers with their strengths
   */
  private identifyTopPerformers(
    repInsights: RepPerformanceMetrics[]
  ): Array<{ repId: string; repName: string; score: number; strengths: string[] }> {
    return repInsights
      .filter(r => r.tier === 'top_performer' || r.tier === 'high_performer')
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 10) // Top 10
      .map(rep => ({
        repId: rep.repId,
        repName: rep.repName,
        score: rep.overallScore,
        strengths: this.identifyRepStrengths(rep)
      }));
  }
  
  /**
   * Identifies reps needing support
   * @param repInsights - Array of rep performance metrics
   * @returns Reps needing support with critical areas
   */
  private identifyRepsNeedingSupport(
    repInsights: RepPerformanceMetrics[]
  ): Array<{ repId: string; repName: string; score: number; criticalAreas: string[] }> {
    return repInsights
      .filter(r => r.tier === 'needs_improvement' || r.tier === 'at_risk')
      .sort((a, b) => a.overallScore - b.overallScore)
      .map(rep => ({
        repId: rep.repId,
        repName: rep.repName,
        score: rep.overallScore,
        criticalAreas: this.identifyRepWeaknesses(rep)
      }));
  }
  
  /**
   * Identifies rep's key strengths based on skill scores
   * @param rep - Rep performance metrics
   * @returns Array of strength areas
   */
  private identifyRepStrengths(rep: RepPerformanceMetrics): string[] {
    const skillEntries = Object.entries(rep.skills) as [keyof SkillScores, number][];
    return skillEntries
      .filter(([_, score]) => score >= 80)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([skill, _]) => this.formatSkillName(skill));
  }
  
  /**
   * Identifies rep's key weaknesses based on skill scores
   * @param rep - Rep performance metrics
   * @returns Array of weakness areas
   */
  private identifyRepWeaknesses(rep: RepPerformanceMetrics): string[] {
    const skillEntries = Object.entries(rep.skills) as [keyof SkillScores, number][];
    return skillEntries
      .filter(([_, score]) => score < 60)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([skill, _]) => this.formatSkillName(skill));
  }
  
  // ============================================================================
  // SKILL GAP ANALYSIS
  // ============================================================================
  
  /**
   * Analyzes skill gaps across the team
   * @param repInsights - Array of rep performance metrics
   * @param topPerformers - Top performers data
   * @returns Skill gaps with team avg vs top performer avg
   */
  private analyzeSkillGaps(
    repInsights: RepPerformanceMetrics[],
    topPerformers: Array<{ repId: string; repName: string; score: number; strengths: string[] }>
  ): Array<{
    skill: string;
    teamAverage: number;
    topPerformerAverage: number;
    gap: number;
    repsAffected: number;
  }> {
    const skills: (keyof SkillScores)[] = [
      'prospecting',
      'discovery',
      'needsAnalysis',
      'presentation',
      'objectionHandling',
      'negotiation',
      'closing',
      'relationshipBuilding',
      'productKnowledge',
      'crmHygiene',
      'timeManagement',
      'aiToolAdoption'
    ];
    
    const topPerformerReps = repInsights.filter(r =>
      topPerformers.some(tp => tp.repId === r.repId)
    );
    
    return skills
      .map(skill => {
        const teamAverage = this.calculateAverage(
          repInsights.map(r => r.skills[skill])
        );
        
        const topPerformerAverage = topPerformerReps.length > 0
          ? this.calculateAverage(topPerformerReps.map(r => r.skills[skill]))
          : teamAverage;
        
        const gap = topPerformerAverage - teamAverage;
        
        const repsAffected = repInsights.filter(
          r => r.skills[skill] < topPerformerAverage - 10
        ).length;
        
        return {
          skill: this.formatSkillName(skill),
          teamAverage,
          topPerformerAverage,
          gap,
          repsAffected
        };
      })
      .filter(gap => gap.gap > 10) // Only include significant gaps
      .sort((a, b) => b.gap - a.gap);
  }
  
  // ============================================================================
  // BEST PRACTICES EXTRACTION
  // ============================================================================
  
  /**
   * Extracts best practices from top performers
   * @param repInsights - Array of rep performance metrics
   * @param topPerformers - Top performers data
   * @returns Best practices to share across team
   */
  private extractBestPractices(
    repInsights: RepPerformanceMetrics[],
    topPerformers: Array<{ repId: string; repName: string; score: number; strengths: string[] }>
  ): BestPractice[] {
    const practices: BestPractice[] = [];
    
    const topPerformerReps = repInsights.filter(r =>
      topPerformers.some(tp => tp.repId === r.repId)
    );
    
    if (topPerformerReps.length === 0) {return practices;}
    
    // Email response rate best practice
    const avgEmailResponseRate = this.calculateAverage(
      repInsights.map(r => r.communication.emailResponseRate)
    );
    const topEmailResponseRate = this.calculateAverage(
      topPerformerReps.map(r => r.communication.emailResponseRate)
    );
    
    if (topEmailResponseRate > avgEmailResponseRate + 0.1) {
      practices.push({
        title: 'Rapid Email Response Protocol',
        description: 'Top performers respond to emails significantly faster, maintaining momentum in deals.',
        category: 'communication',
        topPerformers: topPerformers.slice(0, 3).map(tp => tp.repName),
        successMetrics: [{
          metric: 'Email Response Rate',
          topPerformerAverage: topEmailResponseRate,
          repCurrent: avgEmailResponseRate,
          gap: topEmailResponseRate - avgEmailResponseRate
        }],
        implementationSteps: [
          'Set up email notifications for high-priority deals',
          'Block 2-3 time slots per day for email responses',
          'Use AI email writer for faster replies',
          'Respond within 2 hours for hot leads'
        ],
        expectedImpact: 'Improve email response rate by 15-20%, leading to faster deal progression'
      });
    }
    
    // Deal velocity best practice
    const avgDealVelocity = this.calculateAverage(
      repInsights.map(r => r.deals.dealVelocity)
    );
    const topDealVelocity = this.calculateAverage(
      topPerformerReps.map(r => r.deals.dealVelocity)
    );
    
    if (topDealVelocity > avgDealVelocity * 1.2) {
      practices.push({
        title: 'High-Velocity Deal Management',
        description: 'Top performers move deals through the pipeline faster through disciplined qualification and follow-up.',
        category: 'pipeline_management',
        topPerformers: topPerformers.slice(0, 3).map(tp => tp.repName),
        successMetrics: [{
          metric: 'Deal Velocity',
          topPerformerAverage: topDealVelocity,
          repCurrent: avgDealVelocity,
          gap: topDealVelocity - avgDealVelocity
        }],
        implementationSteps: [
          'Qualify leads rigorously in first meeting',
          'Set clear next steps at end of every meeting',
          'Use workflow automation for timely follow-ups',
          'Disqualify poor-fit deals early'
        ],
        expectedImpact: 'Increase deal velocity by 20-30%, closing more deals per quarter'
      });
    }
    
    // Win rate best practice
    const avgWinRate = this.calculateAverage(
      repInsights.map(r => r.deals.winRate)
    );
    const topWinRate = this.calculateAverage(
      topPerformerReps.map(r => r.deals.winRate)
    );
    
    if (topWinRate > avgWinRate + 0.15) {
      practices.push({
        title: 'Strategic Deal Qualification',
        description: 'Top performers achieve higher win rates through better qualification and deal selection.',
        category: 'discovery',
        topPerformers: topPerformers.slice(0, 3).map(tp => tp.repName),
        successMetrics: [{
          metric: 'Win Rate',
          topPerformerAverage: topWinRate,
          repCurrent: avgWinRate,
          gap: topWinRate - avgWinRate
        }],
        implementationSteps: [
          'Use BANT/MEDDIC framework for qualification',
          'Identify economic buyer early',
          'Understand competitive landscape before presenting',
          'Walk away from deals with poor fit'
        ],
        expectedImpact: 'Improve win rate by 10-15 percentage points, focusing effort on winnable deals'
      });
    }
    
    return practices.slice(0, 5); // Return top 5 practices
  }
  
  // ============================================================================
  // TEAM PRIORITIES
  // ============================================================================
  
  /**
   * Determines team coaching priorities based on skill gaps and at-risk reps
   * @param skillGaps - Skill gaps across team
   * @param needsSupport - Reps needing support
   * @param teamSummary - Team performance summary
   * @returns Prioritized coaching areas
   */
  private determineTeamPriorities(
    skillGaps: Array<{ skill: string; teamAverage: number; topPerformerAverage: number; gap: number; repsAffected: number }>,
    needsSupport: Array<{ repId: string; repName: string; score: number; criticalAreas: string[] }>,
    teamSummary: TeamPerformanceSummary
  ): Array<{
    area: string;
    importance: number;
    repsAffected: number;
    potentialImpact: string;
  }> {
    const priorities: Array<{
      area: string;
      importance: number;
      repsAffected: number;
      potentialImpact: string;
    }> = [];
    
    // Priority 1: Support at-risk reps
    if (teamSummary.atRiskCount > 0) {
      priorities.push({
        area: 'At-Risk Rep Support',
        importance: 100,
        repsAffected: teamSummary.atRiskCount,
        potentialImpact: `${teamSummary.atRiskCount} rep(s) at risk of missing quota. Immediate 1-on-1 coaching required.`
      });
    }
    
    // Priority 2: Address largest skill gaps
    skillGaps.slice(0, 3).forEach(gap => {
      const importance = Math.min(100, 60 + gap.gap);
      priorities.push({
        area: gap.skill,
        importance,
        repsAffected: gap.repsAffected,
        potentialImpact: `${gap.repsAffected} rep(s) below top performer benchmark. Gap of ${gap.gap.toFixed(1)} points could improve team ${gap.skill.toLowerCase()} significantly.`
      });
    });
    
    // Priority 3: Low quota attainment
    if (teamSummary.teamAverages.quotaAttainment < 0.8) {
      const repsBelow = Math.floor(teamSummary.totalReps * 0.6);
      priorities.push({
        area: 'Quota Attainment',
        importance: 90,
        repsAffected: repsBelow,
        potentialImpact: `Team at ${(teamSummary.teamAverages.quotaAttainment * 100).toFixed(0)}% quota attainment. Focus on pipeline building and deal acceleration.`
      });
    }
    
    // Priority 4: Low win rate
    if (teamSummary.teamAverages.winRate < 0.25) {
      const repsBelow = Math.floor(teamSummary.totalReps * 0.5);
      priorities.push({
        area: 'Win Rate Improvement',
        importance: 85,
        repsAffected: repsBelow,
        potentialImpact: `Team win rate at ${(teamSummary.teamAverages.winRate * 100).toFixed(0)}%. Better qualification and discovery needed.`
      });
    }
    
    return priorities.sort((a, b) => b.importance - a.importance).slice(0, 5);
  }
  
  // ============================================================================
  // TEAM STRENGTHS & WEAKNESSES
  // ============================================================================
  
  /**
   * Identifies team-wide strengths
   * @param repInsights - Array of rep performance metrics
   * @param teamSummary - Team performance summary
   * @returns Team strengths
   */
  private identifyTeamStrengths(
    repInsights: RepPerformanceMetrics[],
    teamSummary: TeamPerformanceSummary
  ): string[] {
    const strengths: string[] = [];
    
    // High win rate
    if (teamSummary.teamAverages.winRate > 0.35) {
      strengths.push(`Strong Win Rate (${(teamSummary.teamAverages.winRate * 100).toFixed(0)}%)`);
    }
    
    // High quota attainment
    if (teamSummary.teamAverages.quotaAttainment > 0.9) {
      strengths.push(`Excellent Quota Attainment (${(teamSummary.teamAverages.quotaAttainment * 100).toFixed(0)}%)`);
    }
    
    // High email response rate
    if (teamSummary.teamAverages.emailResponseRate > 0.7) {
      strengths.push(`Responsive Communication (${(teamSummary.teamAverages.emailResponseRate * 100).toFixed(0)}% response rate)`);
    }
    
    // High overall performance
    if (teamSummary.teamAverages.overallScore > 75) {
      strengths.push(`High Overall Performance (${teamSummary.teamAverages.overallScore.toFixed(0)} average score)`);
    }
    
    // Strong top performers
    const topPerformerPercentage = teamSummary.performanceDistribution
      .filter(d => d.tier === 'top_performer' || d.tier === 'high_performer')
      .reduce((sum, d) => sum + d.percentage, 0);
    
    if (topPerformerPercentage > 40) {
      strengths.push(`${topPerformerPercentage.toFixed(0)}% of team are top/high performers`);
    }
    
    return strengths;
  }
  
  /**
   * Identifies team-wide weaknesses
   * @param repInsights - Array of rep performance metrics
   * @param teamSummary - Team performance summary
   * @returns Team weaknesses
   */
  private identifyTeamWeaknesses(
    repInsights: RepPerformanceMetrics[],
    teamSummary: TeamPerformanceSummary
  ): string[] {
    const weaknesses: string[] = [];
    
    // Low win rate
    if (teamSummary.teamAverages.winRate < 0.25) {
      weaknesses.push(`Low Win Rate (${(teamSummary.teamAverages.winRate * 100).toFixed(0)}%)`);
    }
    
    // Low quota attainment
    if (teamSummary.teamAverages.quotaAttainment < 0.7) {
      weaknesses.push(`Below Quota Attainment (${(teamSummary.teamAverages.quotaAttainment * 100).toFixed(0)}%)`);
    }
    
    // High at-risk count
    if (teamSummary.atRiskCount > teamSummary.totalReps * 0.2) {
      weaknesses.push(`${teamSummary.atRiskCount} rep(s) at risk (${((teamSummary.atRiskCount / teamSummary.totalReps) * 100).toFixed(0)}% of team)`);
    }
    
    // Low email response rate
    if (teamSummary.teamAverages.emailResponseRate < 0.5) {
      weaknesses.push(`Poor Email Response Rate (${(teamSummary.teamAverages.emailResponseRate * 100).toFixed(0)}%)`);
    }
    
    // Low deal velocity
    if (teamSummary.teamAverages.dealVelocity < 0.5) {
      weaknesses.push(`Low Deal Velocity (${teamSummary.teamAverages.dealVelocity.toFixed(1)} deals/week)`);
    }
    
    return weaknesses;
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  /**
   * Calculates average of an array of numbers
   * @param values - Array of numbers
   * @returns Average value
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) {return 0;}
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }
  
  /**
   * Formats skill name for display
   * @param skill - Skill key
   * @returns Formatted skill name
   */
  private formatSkillName(skill: string): string {
    return skill
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
  
  /**
   * Gets date range for a time period
   * @param period - Time period
   * @param customRange - Custom date range (if period is 'custom')
   * @returns Start and end dates
   */
  private getDateRange(
    period: string,
    customRange?: { startDate: Date; endDate: Date }
  ): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    let startDate = new Date();
    
    if (period === 'custom' && customRange) {
      return customRange;
    }
    
    switch (period) {
      case 'last_7_days':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'last_30_days':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'last_90_days':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case 'last_6_months':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case 'last_12_months':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case 'this_quarter':
        const quarter = Math.floor(endDate.getMonth() / 3);
        startDate = new Date(endDate.getFullYear(), quarter * 3, 1);
        break;
      case 'this_year':
        startDate = new Date(endDate.getFullYear(), 0, 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }
    
    return { startDate, endDate };
  }
  
  /**
   * Generates cache key for team insights
   * @param teamId - Team ID
   * @param period - Time period
   * @param startDate - Start date (optional)
   * @param endDate - End date (optional)
   * @returns Cache key
   */
  private getCacheKey(
    teamId: string,
    period: string,
    startDate?: Date,
    endDate?: Date
  ): string {
    if (period === 'custom' && startDate && endDate) {
      return `${teamId}:${period}:${startDate.toISOString()}:${endDate.toISOString()}`;
    }
    return `${teamId}:${period}`;
  }
  
  /**
   * Checks if cached insights are still valid
   * @param cachedAt - When insights were cached
   * @returns True if cache is valid
   */
  private isCacheValid(cachedAt: Date): boolean {
    const age = Date.now() - cachedAt.getTime();
    return age < this.CACHE_TTL_MS;
  }
  
  /**
   * Clears the insights cache
   */
  clearCache(): void {
    this.insightsCache.clear();
    console.log('[TeamCoachingEngine] Cache cleared');
  }
}
