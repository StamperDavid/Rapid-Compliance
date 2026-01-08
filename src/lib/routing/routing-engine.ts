/**
 * Intelligent Lead Routing Engine
 * 
 * SOVEREIGN CORPORATE BRAIN - LEAD ROUTING MODULE
 * 
 * This engine implements AI-powered lead routing that optimizes lead assignment
 * based on rep performance, workload balancing, territory rules, and specializations.
 * 
 * KEY FEATURES:
 * - Performance-weighted routing (hot leads → top performers)
 * - Workload balancing (fair distribution across team)
 * - Territory-based routing (geographic + vertical)
 * - Skill-based matching (match to rep expertise)
 * - Round-robin with intelligence (skip at-capacity reps)
 * - Real-time capacity tracking
 * - Configurable routing strategies
 * - Audit trail for all assignments
 * 
 * INTEGRATION:
 * - Coaching module for rep performance data
 * - Deal scoring for lead quality assessment
 * - Signal Bus for routing events
 * - DAL for data persistence
 * 
 * @module routing/routing-engine
 */

import type {
  Lead,
  SalesRep,
  RoutingRule,
  LeadAssignment,
  RoutingAnalysis,
  RoutingConfiguration,
  RoutingStrategy,
  RepRoutingScore,
  LeadQualityAssessment,
  AssignmentRecommendation,
  AssignmentMethod,
  RoutingCondition,
  Territory,
  CompanySize} from './types';
import {
  ConditionOperator,
  RepWorkload,
  TerritoryType
} from './types';
import { PerformanceTier } from '../coaching/types';

/**
 * Lead Routing Engine
 * 
 * Core engine that analyzes leads and reps to make optimal routing decisions.
 */
export class LeadRoutingEngine {
  /**
   * Route a lead to the best-matched sales rep
   * 
   * @param lead - Lead to route
   * @param availableReps - Sales reps available for assignment
   * @param config - Organization routing configuration
   * @param rules - Optional routing rules to apply
   * @returns Routing analysis with recommended assignment
   */
  async routeLead(
    lead: Lead,
    availableReps: SalesRep[],
    config: RoutingConfiguration,
    rules?: RoutingRule[]
  ): Promise<RoutingAnalysis> {
    const startTime = Date.now();
    
    // Step 1: Assess lead quality
    const leadQuality = this.assessLeadQuality(lead);
    
    // Step 2: Filter eligible reps based on availability and capacity
    const eligibleReps = this.filterEligibleReps(availableReps, lead);
    
    if (eligibleReps.length === 0) {
      throw new Error('No eligible reps available for lead routing');
    }
    
    // Step 3: Apply routing rules if provided
    let filteredReps = eligibleReps;
    let matchedRules: string[] = [];
    
    if (rules && rules.length > 0) {
      const ruleResult = this.applyRoutingRules(lead, eligibleReps, rules);
      filteredReps = ruleResult.reps;
      matchedRules = ruleResult.matchedRules;
    }
    
    // Step 4: Score all eligible reps
    const repScores = this.scoreRepsForLead(
      lead,
      filteredReps,
      leadQuality,
      config
    );
    
    // Step 5: Sort by match score (highest first)
    const sortedScores = repScores.sort((a, b) => b.matchScore - a.matchScore);
    
    // Step 6: Generate recommendation
    const recommendation = this.generateRecommendation(
      sortedScores[0],
      leadQuality,
      config
    );
    
    // Step 7: Generate alternatives
    const alternatives = sortedScores
      .slice(1, 4) // Top 3 alternatives
      .map(score => this.generateRecommendation(score, leadQuality, config));
    
    const processingTimeMs = Date.now() - startTime;
    
    return {
      leadId: lead.id,
      analyzedAt: new Date(),
      leadQuality,
      availableReps: sortedScores,
      recommendation,
      alternatives,
      metadata: {
        rulesEvaluated: rules?.length ?? 0,
        repsConsidered: availableReps.length,
        processingTimeMs,
        strategyUsed: config.defaultStrategy,
      },
    };
  }
  
  /**
   * Assess lead quality and routing priority
   */
  assessLeadQuality(lead: Lead): LeadQualityAssessment {
    // Component scores
    const intentScore =lead.intentScore ?? lead.qualityScore;
    const fitScore =lead.fitScore ?? lead.qualityScore;
    const engagementScore = this.calculateEngagementScore(lead);
    const potentialScore = this.calculatePotentialScore(lead);
    
    // Weights for each component
    const weights = {
      intent: 0.35,
      fit: 0.30,
      engagement: 0.20,
      potential: 0.15,
    };
    
    // Calculate weighted overall score
    const overallScore = Math.round(
      intentScore * weights.intent +
      fitScore * weights.fit +
      engagementScore * weights.engagement +
      potentialScore * weights.potential
    );
    
    // Determine tier
    let tier: 'premium' | 'standard' | 'basic';
    if (overallScore >= 80) {
      tier = 'premium';
    } else if (overallScore >= 60) {
      tier = 'standard';
    } else {
      tier = 'basic';
    }
    
    // Calculate routing priority (1-10)
    const routingPriority = Math.ceil(overallScore / 10);
    
    // Build quality indicators
    const indicators = [
      { indicator: 'Intent Score', value: intentScore, weight: weights.intent },
      { indicator: 'Fit Score', value: fitScore, weight: weights.fit },
      { indicator: 'Engagement Score', value: engagementScore, weight: weights.engagement },
      { indicator: 'Potential Score', value: potentialScore, weight: weights.potential },
    ];
    
    return {
      overallScore,
      tier,
      scores: {
        intent: intentScore,
        fit: fitScore,
        engagement: engagementScore,
        potential: potentialScore,
      },
      indicators,
      routingPriority,
    };
  }
  
  /**
   * Calculate engagement score based on lead source and status
   */
  private calculateEngagementScore(lead: Lead): number {
    let score = 50; // Base score
    
    // Source scoring
    const sourceScores: Record<string, number> = {
      inbound_website: 20,
      inbound_form: 25,
      referral: 30,
      outbound_warm: 15,
      partner: 20,
      event: 15,
      outbound_cold: 5,
      social: 10,
      content: 15,
      paid_ads: 10,
      other: 5,
    };
    score += sourceScores[lead.source] || 0;
    
    // Priority scoring
    if (lead.priority === 'hot') {score += 25;}
    else if (lead.priority === 'warm') {score += 15;}
    
    return Math.min(100, score);
  }
  
  /**
   * Calculate potential value score
   */
  private calculatePotentialScore(lead: Lead): number {
    let score = 50; // Base score
    
    // Company size scoring
    const sizeScores: Record<string, number> = {
      enterprise: 30,
      mid_market: 20,
      smb: 10,
      startup: 5,
    };
    if (lead.companySize) {
      score += sizeScores[lead.companySize] || 0;
    }
    
    // Estimated value scoring
    if (lead.estimatedValue) {
      if (lead.estimatedValue >= 100000) {score += 20;}
      else if (lead.estimatedValue >= 50000) {score += 15;}
      else if (lead.estimatedValue >= 25000) {score += 10;}
      else {score += 5;}
    }
    
    return Math.min(100, score);
  }
  
  /**
   * Filter reps to only those eligible for assignment
   */
  filterEligibleReps(reps: SalesRep[], lead: Lead): SalesRep[] {
    return reps.filter(rep => {
      // Must be available
      if (!rep.isAvailable) {return false;}
      
      // Must not be at capacity
      if (rep.currentWorkload.isAtCapacity) {return false;}
      
      // Check daily limit
      if (rep.currentWorkload.leadsAssignedToday >= rep.capacity.maxNewLeadsPerDay) {
        return false;
      }
      
      // Check weekly limit
      if (rep.currentWorkload.leadsAssignedThisWeek >= rep.capacity.maxNewLeadsPerWeek) {
        return false;
      }
      
      // Check active leads limit
      if (rep.currentWorkload.activeLeads >= rep.capacity.maxActiveLeads) {
        return false;
      }
      
      // Check custom capacity rules
      if (rep.capacity.customRules) {
        const hasExceededRule = rep.capacity.customRules.some(rule => rule.isExceeded);
        if (hasExceededRule) {return false;}
      }
      
      return true;
    });
  }
  
  /**
   * Apply routing rules to filter reps
   */
  applyRoutingRules(
    lead: Lead,
    reps: SalesRep[],
    rules: RoutingRule[]
  ): { reps: SalesRep[]; matchedRules: string[] } {
    // Sort rules by priority (highest first)
    const sortedRules = [...rules]
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);
    
    let filteredReps = reps;
    const matchedRules: string[] = [];
    
    for (const rule of sortedRules) {
      // Check if rule conditions match the lead
      if (this.evaluateRuleConditions(lead, rule.conditions)) {
        matchedRules.push(rule.id);
        
        // Apply rule actions to filter reps
        // (Simplified - in production, this would execute the actual actions)
        if (rule.type === 'territory') {
          filteredReps = this.filterByTerritory(filteredReps, lead);
        } else if (rule.type === 'specialization') {
          filteredReps = this.filterBySpecialization(filteredReps, lead);
        } else if (rule.type === 'performance') {
          filteredReps = this.filterByPerformance(filteredReps, lead);
        }
      }
    }
    
    // If rules filtered out all reps, fall back to original list
    if (filteredReps.length === 0) {
      filteredReps = reps;
    }
    
    return { reps: filteredReps, matchedRules };
  }
  
  /**
   * Evaluate if rule conditions match the lead
   */
  private evaluateRuleConditions(lead: Lead, conditions: RoutingCondition[]): boolean {
    if (conditions.length === 0) {return true;}
    
    let result = true;
    let currentConnector: 'AND' | 'OR' = 'AND';
    
    for (const condition of conditions) {
      const conditionResult = this.evaluateCondition(lead, condition);
      
      if (currentConnector === 'AND') {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }
      
      currentConnector =(condition.connector !== '' && condition.connector != null) ? condition.connector : 'AND';
    }
    
    return result;
  }
  
  /**
   * Evaluate a single condition
   */
  private evaluateCondition(lead: Lead, condition: RoutingCondition): boolean {
    const fieldValue = this.getFieldValue(lead, condition.field);
    const { operator, value } = condition;
    
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'greater_than':
        return typeof fieldValue === 'number' && fieldValue > (value as number);
      case 'less_than':
        return typeof fieldValue === 'number' && fieldValue < (value as number);
      case 'greater_than_or_equal':
        return typeof fieldValue === 'number' && fieldValue >= (value as number);
      case 'less_than_or_equal':
        return typeof fieldValue === 'number' && fieldValue <= (value as number);
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(value as string);
      case 'not_contains':
        return typeof fieldValue === 'string' && !fieldValue.includes(value as string);
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(fieldValue);
      case 'matches_regex':
        if (typeof fieldValue === 'string' && typeof value === 'string') {
          const regex = new RegExp(value);
          return regex.test(fieldValue);
        }
        return false;
      default:
        return false;
    }
  }
  
  /**
   * Get field value from lead object
   */
  private getFieldValue(lead: Lead, field: string): unknown {
    const parts = field.split('.');
    let value: any = lead;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return value;
  }
  
  /**
   * Filter reps by territory match
   */
  private filterByTerritory(reps: SalesRep[], lead: Lead): SalesRep[] {
    return reps.filter(rep => {
      return rep.territories.some(territory => 
        this.matchesTerritory(lead, territory)
      );
    });
  }
  
  /**
   * Check if lead matches territory
   */
  private matchesTerritory(lead: Lead, territory: Territory): boolean {
    // Geographic match
    if (territory.geographic) {
      const geo = territory.geographic;
      
      if (geo.countries && lead.country) {
        if (!geo.countries.includes(lead.country)) {return false;}
      }
      
      if (geo.states && lead.state) {
        if (!geo.states.includes(lead.state)) {return false;}
      }
      
      if (geo.cities && lead.city) {
        if (!geo.cities.includes(lead.city)) {return false;}
      }
    }
    
    // Vertical match
    if (territory.vertical) {
      const vert = territory.vertical;
      
      if (vert.industries && lead.industry) {
        if (!vert.industries.includes(lead.industry)) {return false;}
      }
      
      if (vert.companySizes && lead.companySize) {
        if (!vert.companySizes.includes(lead.companySize)) {return false;}
      }
    }
    
    return true;
  }
  
  /**
   * Filter reps by specialization match
   */
  private filterBySpecialization(reps: SalesRep[], lead: Lead): SalesRep[] {
    return reps.filter(rep => {
      const spec = rep.specializations;
      
      // Check industry match
      if (spec.industries && lead.industry) {
        if (spec.industries.includes(lead.industry)) {return true;}
      }
      
      // Check company size match
      if (spec.companySizes && lead.companySize) {
        if (spec.companySizes.includes(lead.companySize)) {return true;}
      }
      
      return false;
    });
  }
  
  /**
   * Filter to top performers for hot leads
   */
  private filterByPerformance(reps: SalesRep[], lead: Lead): SalesRep[] {
    // Only filter if lead is hot/premium
    if (lead.priority !== 'hot') {return reps;}
    
    // Keep only top performers and high performers
    return reps.filter(rep => 
      rep.performanceTier === 'top_performer' || 
      rep.performanceTier === 'high_performer'
    );
  }
  
  /**
   * Score all reps for lead assignment
   */
  scoreRepsForLead(
    lead: Lead,
    reps: SalesRep[],
    leadQuality: LeadQualityAssessment,
    config: RoutingConfiguration
  ): RepRoutingScore[] {
    const weights = config.strategyWeights;
    
    return reps.map(rep => {
      // Calculate component scores
      const performanceScore = this.calculatePerformanceScore(rep);
      const capacityScore = this.calculateCapacityScore(rep);
      const specializationScore = this.calculateSpecializationScore(rep, lead);
      const territoryScore = this.calculateTerritoryScore(rep, lead);
      const availabilityScore = this.calculateAvailabilityScore(rep);
      
      // Calculate weighted match score
      const matchScore = Math.round(
        performanceScore * weights.performance +
        capacityScore * weights.capacity +
        specializationScore * weights.specialization +
        territoryScore * weights.territory +
        availabilityScore * weights.availability
      );
      
      // Check eligibility
      const isEligible = rep.isAvailable && !rep.currentWorkload.isAtCapacity;
      
      // Determine territory match
      const territoryMatch = rep.territories.some(t => 
        this.matchesTerritory(lead, t)
      );
      
      // Find specialization matches
      const specializationMatch: string[] = [];
      if (rep.specializations.industries?.includes(lead.industry ?? '')) {
        specializationMatch.push('Industry');
      }
      if (rep.specializations.companySizes?.includes((lead.companySize !== '' && lead.companySize != null) ? lead.companySize : '' as CompanySize)) {
        specializationMatch.push('Company Size');
      }
      
      return {
        repId: rep.id,
        repName: rep.name,
        matchScore,
        scores: {
          performance: performanceScore,
          capacity: capacityScore,
          specialization: specializationScore,
          territory: territoryScore,
          availability: availabilityScore,
        },
        weights,
        matchDetails: {
          territoryMatch,
          specializationMatch,
          capacityAvailable: rep.currentWorkload.remainingCapacity.leads,
          performanceTier: rep.performanceTier,
          currentWorkload: rep.currentWorkload.utilizationPercentage,
        },
        isEligible,
        ineligibilityReasons: isEligible ? undefined : this.getIneligibilityReasons(rep),
      };
    });
  }
  
  /**
   * Calculate rep performance score
   */
  private calculatePerformanceScore(rep: SalesRep): number {
    // Base on overall performance score
    return rep.overallScore;
  }
  
  /**
   * Calculate capacity score (more capacity = higher score)
   */
  private calculateCapacityScore(rep: SalesRep): number {
    const utilization = rep.currentWorkload.utilizationPercentage;
    
    // Invert utilization (0% = 100 score, 100% = 0 score)
    return 100 - utilization;
  }
  
  /**
   * Calculate specialization match score
   */
  private calculateSpecializationScore(rep: SalesRep, lead: Lead): number {
    let score = 0;
    const spec = rep.specializations;
    
    // Industry match (40 points)
    if (spec.industries && lead.industry && spec.industries.includes(lead.industry)) {
      score += 40;
    }
    
    // Company size match (30 points)
    if (spec.companySizes && lead.companySize && spec.companySizes.includes(lead.companySize)) {
      score += 30;
    }
    
    // Source preference match (15 points)
    if (rep.routingPreferences.preferredSources?.includes(lead.source)) {
      score += 15;
    }
    
    // Priority preference match (15 points)
    if (rep.routingPreferences.preferredPriorities?.includes(lead.priority)) {
      score += 15;
    }
    
    return Math.min(100, score);
  }
  
  /**
   * Calculate territory match score
   */
  private calculateTerritoryScore(rep: SalesRep, lead: Lead): number {
    if (rep.territories.length === 0) {return 50;} // Neutral if no territories
    
    // Find matching territories
    const matches = rep.territories.filter(t => 
      this.matchesTerritory(lead, t)
    );
    
    if (matches.length === 0) {return 0;}
    
    // Return score based on highest priority territory match
    const highestPriority = Math.max(...matches.map(t => t.priority));
    return Math.min(100, highestPriority * 10);
  }
  
  /**
   * Calculate availability score
   */
  private calculateAvailabilityScore(rep: SalesRep): number {
    if (!rep.isAvailable) {return 0;}
    
    let score = 100;
    
    // Reduce score based on availability status
    switch (rep.availabilityStatus) {
      case 'available':
        score = 100;
        break;
      case 'busy':
        score = 60;
        break;
      case 'meeting':
        score = 40;
        break;
      case 'out_of_office':
      case 'vacation':
      case 'training':
        score = 0;
        break;
      default:
        score = 80;
    }
    
    return score;
  }
  
  /**
   * Get reasons why rep is ineligible
   */
  private getIneligibilityReasons(rep: SalesRep): string[] {
    const reasons: string[] = [];
    
    if (!rep.isAvailable) {
      reasons.push('Rep is not available');
    }
    
    if (rep.currentWorkload.isAtCapacity) {
      reasons.push('Rep is at capacity');
    }
    
    if (rep.currentWorkload.leadsAssignedToday >= rep.capacity.maxNewLeadsPerDay) {
      reasons.push('Daily lead limit reached');
    }
    
    if (rep.currentWorkload.leadsAssignedThisWeek >= rep.capacity.maxNewLeadsPerWeek) {
      reasons.push('Weekly lead limit reached');
    }
    
    return reasons;
  }
  
  /**
   * Generate assignment recommendation
   */
  generateRecommendation(
    repScore: RepRoutingScore,
    leadQuality: LeadQualityAssessment,
    config: RoutingConfiguration
  ): AssignmentRecommendation {
    // Calculate confidence based on match score
    const confidence = Math.min(1, repScore.matchScore / 100);
    
    // Generate reasons
    const reasons: string[] = [];
    
    if (repScore.scores.performance >= 80) {
      reasons.push(`High performer (Score: ${repScore.scores.performance})`);
    }
    
    if (repScore.matchDetails.territoryMatch) {
      reasons.push('Territory match');
    }
    
    if (repScore.matchDetails.specializationMatch.length > 0) {
      reasons.push(`Specialization match: ${repScore.matchDetails.specializationMatch.join(', ')}`);
    }
    
    if (repScore.scores.capacity >= 50) {
      reasons.push(`Available capacity: ${repScore.matchDetails.capacityAvailable} leads`);
    }
    
    if (reasons.length === 0) {
      reasons.push('Best available option');
    }
    
    // Estimate conversion probability based on performance and match
    const conversionProbability = this.estimateConversionProbability(
      repScore,
      leadQuality
    );
    
    // Estimate time to contact (hours)
    const expectedTimeToContact = this.estimateTimeToContact(repScore);
    
    // Estimate time to qualify (days)
    const expectedTimeToQualify = this.estimateTimeToQualify(repScore);
    
    // Generate warnings
    const warnings: string[] = [];
    
    if (repScore.matchDetails.currentWorkload >= 80) {
      warnings.push('Rep is at high utilization (80%+)');
    }
    
    if (!repScore.matchDetails.territoryMatch) {
      warnings.push('Lead is outside rep\'s assigned territory');
    }
    
    if (repScore.matchDetails.specializationMatch.length === 0) {
      warnings.push('No direct specialization match');
    }
    
    return {
      repId: repScore.repId,
      repName: repScore.repName,
      confidence,
      matchScore: repScore.matchScore,
      reasons,
      expectedOutcomes: {
        conversionProbability,
        expectedTimeToContact,
        expectedTimeToQualify,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
  
  /**
   * Estimate conversion probability
   */
  private estimateConversionProbability(
    repScore: RepRoutingScore,
    leadQuality: LeadQualityAssessment
  ): number {
    // Base probability on rep performance tier
    let baseProbability = 0.20; // 20% base
    
    switch (repScore.matchDetails.performanceTier) {
      case 'top_performer':
        baseProbability = 0.45;
        break;
      case 'high_performer':
        baseProbability = 0.35;
        break;
      case 'average':
        baseProbability = 0.25;
        break;
      case 'needs_improvement':
        baseProbability = 0.15;
        break;
      case 'at_risk':
        baseProbability = 0.10;
        break;
    }
    
    // Adjust for lead quality
    const qualityMultiplier = leadQuality.overallScore / 100;
    baseProbability *= (0.5 + qualityMultiplier * 0.5); // 50% base + up to 50% quality bonus
    
    // Adjust for match score
    const matchMultiplier = repScore.matchScore / 100;
    baseProbability *= (0.7 + matchMultiplier * 0.3); // 70% base + up to 30% match bonus
    
    return Math.min(0.95, Math.max(0.05, baseProbability));
  }
  
  /**
   * Estimate time to first contact (hours)
   */
  private estimateTimeToContact(repScore: RepRoutingScore): number {
    let hours = 4; // Default 4 hours
    
    // Adjust for availability
    if (repScore.scores.availability >= 80) {
      hours = 1;
    } else if (repScore.scores.availability >= 60) {
      hours = 2;
    }
    
    // Adjust for workload
    if (repScore.matchDetails.currentWorkload >= 80) {
      hours *= 2;
    }
    
    return hours;
  }
  
  /**
   * Estimate time to qualify (days)
   */
  private estimateTimeToQualify(repScore: RepRoutingScore): number {
    let days = 14; // Default 2 weeks
    
    // Adjust for performance
    switch (repScore.matchDetails.performanceTier) {
      case 'top_performer':
        days = 7;
        break;
      case 'high_performer':
        days = 10;
        break;
      case 'average':
        days = 14;
        break;
      case 'needs_improvement':
        days = 21;
        break;
      case 'at_risk':
        days = 28;
        break;
    }
    
    return days;
  }
  
  /**
   * Create lead assignment record
   */
  createAssignment(
    lead: Lead,
    analysis: RoutingAnalysis,
    method: AssignmentMethod,
    strategy: RoutingStrategy
  ): LeadAssignment {
    const recommendation = analysis.recommendation;
    
    return {
      id: `assignment_${lead.id}_${Date.now()}`,
      leadId: lead.id,
      repId: recommendation.repId,
      orgId: lead.orgId,
      assignmentMethod: method,
      strategy,
      matchedRules: [], // Will be populated by caller
      matchScore: recommendation.matchScore,
      confidence: recommendation.confidence,
      reason: recommendation.reasons.join('; '),
      alternatives: analysis.alternatives.map((alt, idx) => ({
        repId: alt.repId,
        repName: alt.repName,
        matchScore: alt.matchScore,
        reasons: alt.reasons,
      })),
      status: 'pending',
      assignedAt: new Date(),
    };
  }
}

/**
 * Export singleton instance
 */
export const leadRoutingEngine = new LeadRoutingEngine();
