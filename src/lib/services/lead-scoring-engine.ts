/**
 * Lead Scoring Engine
 * 
 * AI-powered lead scoring system that analyzes discovery data.
 * 
 * HUNTER-CLOSER COMPLIANCE:
 * - 100% native scoring (no Clearbit, ZoomInfo, etc.)
 * - Uses Discovery Engine data (person + company)
 * - Configurable scoring rules per organization
 * - Real-time score calculation with caching
 * - Intent signal detection from scraped data
 * 
 * Scoring Algorithm:
 * 1. Company Fit (0-40 points) - Industry, size, tech stack, growth
 * 2. Person Fit (0-30 points) - Title, seniority, department
 * 3. Intent Signals (0-20 points) - Hiring, funding, job changes
 * 4. Engagement (0-10 points) - Email opens, clicks, replies
 */

import { adminDal } from '@/lib/firebase/admin-dal';
import { logger } from '@/lib/logger/logger';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { discoverCompany, discoverPerson } from './discovery-engine';
import type { DiscoveredCompany, DiscoveredPerson } from './discovery-engine';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import type {
  LeadScore,
  LeadScoreReason,
  IntentSignal,
  IntentSignalType,
  ScoringRules,
  LeadScoreRequest,
  BatchLeadScoreRequest,
  StoredLeadScore,
  SeniorityLevel,
  Department,
} from '@/types/lead-scoring';
import { DEFAULT_SCORING_RULES } from '@/types/lead-scoring';

// ============================================================================
// CONSTANTS
// ============================================================================

const SCORE_CACHE_TTL_DAYS = 7; // Score expires after 7 days
const SCORING_VERSION = '1.0.0';

const GRADE_THRESHOLDS = {
  A: 90,
  B: 75,
  C: 60,
  D: 40,
  F: 0,
} as const;

const PRIORITY_THRESHOLDS_MAP = {
  hot: 80,
  warm: 60,
  cold: 0,
} as const;

// ============================================================================
// MAIN SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate lead score
 * 
 * This is the main entry point for scoring a lead.
 * Checks cache first, then calculates if needed.
 * 
 * @param request - Lead score request
 * @returns Complete lead score with breakdown
 * 
 * @example
 * ```typescript
 * const score = await calculateLeadScore({
 *   leadId: 'lead_123',
 *   organizationId: 'org_456',
 * });
 * console.log(`Score: ${score.totalScore}/100 (${score.grade})`);
 * console.log(`Priority: ${score.priority}`);
 * ```
 */
export async function calculateLeadScore(
  request: LeadScoreRequest
): Promise<LeadScore> {
  try {
    // Safety check for Admin DAL
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    const { leadId, organizationId, scoringRulesId, forceRescore, discoveryData } = request;

    logger.info('Calculating lead score', {
      leadId,
      organizationId,
      forceRescore,
    });

    // Step 1: Check cache (unless force rescore)
    if (!forceRescore) {
      const cached = await getCachedScore(leadId, organizationId);
      if (cached) {
        logger.info('Lead score cache HIT', {
          leadId,
          score: cached.totalScore,
          age: Date.now() - cached.metadata.scoredAt.getTime(),
        });
        return cached;
      }
    }

    // Step 2: Get scoring rules
    const rules = await getScoringRules(organizationId, scoringRulesId);
    if (!rules) {
      throw new Error('No active scoring rules found');
    }

    // Step 3: Get discovery data
    const { company, person } = await getDiscoveryData(
      leadId,
      organizationId,
      discoveryData
    );

    // Step 4: Calculate score components
    const companyFitScore = calculateCompanyFit(company, rules);
    const personFitScore = calculatePersonFit(person, rules);
    const intentSignalsScore = detectIntentSignals(company, person, rules);
    const engagementScore = await calculateEngagement(leadId, organizationId, rules);

    // Step 5: Calculate total score
    const totalScore = Math.min(
      100,
      companyFitScore.points +
        personFitScore.points +
        intentSignalsScore.totalPoints +
        engagementScore.points
    );

    // Step 6: Determine grade and priority
    const grade = calculateGrade(totalScore);
    const priority = calculatePriority(totalScore);

    // Step 7: Combine all reasons
    const reasons = [
      ...companyFitScore.reasons,
      ...personFitScore.reasons,
      ...intentSignalsScore.reasons,
      ...engagementScore.reasons,
    ];

    // Step 8: Build final score
    const score: LeadScore = {
      totalScore: Math.round(totalScore),
      grade,
      priority,
      breakdown: {
        companyFit: Math.round(companyFitScore.points),
        personFit: Math.round(personFitScore.points),
        intentSignals: Math.round(intentSignalsScore.totalPoints),
        engagement: Math.round(engagementScore.points),
      },
      reasons,
      detectedSignals: intentSignalsScore.signals,
      metadata: {
        scoredAt: new Date(),
        version: SCORING_VERSION,
        confidence: calculateConfidence(company, person),
        expiresAt: new Date(Date.now() + SCORE_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    };

    // Step 9: Cache the score
    await cacheScore(leadId, organizationId, rules.id, score, company, person);

    logger.info('Lead score calculated', {
      leadId,
      totalScore: score.totalScore,
      grade: score.grade,
      priority: score.priority,
    });

    // Step 10: Emit Signal Bus signals based on score
    await emitScoringSignals(leadId, organizationId, score, company, person);

    return score;
  } catch (error) {
    logger.error('Failed to calculate lead score', error, {
      leadId: request.leadId,
      organizationId: request.organizationId,
    });
    throw error;
  }
}

/**
 * Calculate scores for multiple leads in batch
 */
export async function calculateLeadScoresBatch(
  request: BatchLeadScoreRequest
): Promise<Map<string, LeadScore>> {
  const { leadIds, organizationId, scoringRulesId, forceRescore } = request;

  logger.info('Batch lead scoring started', {
    organizationId,
    leadsCount: leadIds.length,
  });

  const results = new Map<string, LeadScore>();

  // Process in parallel (limit concurrency to avoid overwhelming services)
  const concurrency = 5;
  for (let i = 0; i < leadIds.length; i += concurrency) {
    const batch = leadIds.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map((leadId) =>
        calculateLeadScore({
          leadId,
          organizationId,
          scoringRulesId,
          forceRescore,
        })
      )
    );

    batchResults.forEach((result, index) => {
      const leadId = batch[index];
      if (result.status === 'fulfilled') {
        results.set(leadId, result.value);
      } else {
        logger.error('Batch scoring failed for lead', result.reason, { leadId });
      }
    });
  }

  logger.info('Batch lead scoring complete', {
    organizationId,
    totalLeads: leadIds.length,
    successCount: results.size,
    failedCount: leadIds.length - results.size,
  });

  return results;
}

// ============================================================================
// COMPANY FIT SCORING
// ============================================================================

interface ScoringResult {
  points: number;
  reasons: LeadScoreReason[];
}

/**
 * Calculate company fit score (max 40 points)
 */
function calculateCompanyFit(
  company: DiscoveredCompany | null,
  rules: ScoringRules
): ScoringResult {
  const reasons: LeadScoreReason[] = [];
  let points = 0;

  if (!company) {
    reasons.push({
      category: 'company',
      factor: 'No company data',
      points: 0,
      explanation: 'Company data not available',
      impact: 'high',
    });
    return { points: 0, reasons };
  }

  // 1. Industry match (max 15 points)
  const industryScore = scoreIndustry(company, rules);
  points += industryScore.points;
  reasons.push(...industryScore.reasons);

  // 2. Company size (max 10 points)
  const sizeScore = scoreCompanySize(company, rules);
  points += sizeScore.points;
  reasons.push(...sizeScore.reasons);

  // 3. Tech stack match (max 10 points)
  const techScore = scoreTechStack(company, rules);
  points += techScore.points;
  reasons.push(...techScore.reasons);

  // 4. Growth indicators (max 5 points)
  const growthScore = scoreGrowthIndicators(company, rules);
  points += growthScore.points;
  reasons.push(...growthScore.reasons);

  return { points: Math.min(40, points), reasons };
}

/**
 * Score industry match
 */
function scoreIndustry(company: DiscoveredCompany, rules: ScoringRules): ScoringResult {
  const reasons: LeadScoreReason[] = [];
  let points = 0;

  const industry = company.industry?.toLowerCase() || '';

  // Check excluded first (auto-disqualify)
  if (rules.companyRules.industries.excluded.some((ex) => industry.includes(ex.toLowerCase()))) {
    reasons.push({
      category: 'company',
      factor: 'Industry excluded',
      points: -100, // Disqualify
      explanation: `Industry "${company.industry}" is excluded`,
      impact: 'high',
    });
    return { points: -100, reasons };
  }

  // Check preferred
  if (rules.companyRules.industries.preferred.some((pref) => industry.includes(pref.toLowerCase()))) {
    points = rules.companyRules.industries.preferredPoints;
    reasons.push({
      category: 'company',
      factor: 'Preferred industry',
      points,
      explanation: `Company is in preferred industry: ${company.industry}`,
      impact: 'high',
    });
  }
  // Check acceptable
  else if (
    rules.companyRules.industries.acceptable.some((acc) => industry.includes(acc.toLowerCase()))
  ) {
    points = rules.companyRules.industries.acceptablePoints;
    reasons.push({
      category: 'company',
      factor: 'Acceptable industry',
      points,
      explanation: `Company is in acceptable industry: ${company.industry}`,
      impact: 'medium',
    });
  } else {
    reasons.push({
      category: 'company',
      factor: 'Non-target industry',
      points: 0,
      explanation: `Industry "${company.industry}" is not a target`,
      impact: 'low',
    });
  }

  return { points, reasons };
}

/**
 * Score company size
 */
function scoreCompanySize(company: DiscoveredCompany, rules: ScoringRules): ScoringResult {
  const reasons: LeadScoreReason[] = [];
  let points = 0;

  const size = company.size;
  if (!size) {
    reasons.push({
      category: 'company',
      factor: 'Company size unknown',
      points: 0,
      explanation: 'Company size data not available',
      impact: 'low',
    });
    return { points: 0, reasons };
  }

  if (rules.companyRules.size.preferred.includes(size as any)) {
    points = rules.companyRules.size.preferredPoints;
    reasons.push({
      category: 'company',
      factor: 'Preferred company size',
      points,
      explanation: `Company size ${size} matches target`,
      impact: 'high',
    });
  } else {
    points = rules.companyRules.size.notPreferredPoints;
    reasons.push({
      category: 'company',
      factor: 'Non-preferred size',
      points,
      explanation: `Company size ${size} is not preferred but acceptable`,
      impact: 'low',
    });
  }

  return { points, reasons };
}

/**
 * Score tech stack match
 */
function scoreTechStack(company: DiscoveredCompany, rules: ScoringRules): ScoringResult {
  const reasons: LeadScoreReason[] = [];
  let points = 0;

  const companyTechStack = company.techStack.map((t) => t.name.toLowerCase());

  // Check required technologies
  const requiredMatches = rules.companyRules.techStack.required.filter((req) =>
    companyTechStack.some((tech) => tech.includes(req.toLowerCase()))
  );

  if (rules.companyRules.techStack.required.length > 0) {
    if (requiredMatches.length === rules.companyRules.techStack.required.length) {
      points += rules.companyRules.techStack.requiredPoints;
      reasons.push({
        category: 'company',
        factor: 'Required tech stack match',
        points: rules.companyRules.techStack.requiredPoints,
        explanation: `Uses all required technologies: ${requiredMatches.join(', ')}`,
        impact: 'high',
      });
    } else {
      reasons.push({
        category: 'company',
        factor: 'Missing required tech',
        points: 0,
        explanation: `Missing required technologies`,
        impact: 'high',
      });
    }
  }

  // Check preferred technologies
  const preferredMatches = rules.companyRules.techStack.preferred.filter((pref) =>
    companyTechStack.some((tech) => tech.includes(pref.toLowerCase()))
  );

  if (preferredMatches.length > 0) {
    const techPoints = Math.min(
      rules.companyRules.techStack.preferredPoints,
      preferredMatches.length * 2
    );
    points += techPoints;
    reasons.push({
      category: 'company',
      factor: 'Preferred tech match',
      points: techPoints,
      explanation: `Uses ${preferredMatches.length} preferred technologies: ${preferredMatches.join(', ')}`,
      impact: 'medium',
    });
  }

  return { points, reasons };
}

/**
 * Score growth indicators
 */
function scoreGrowthIndicators(company: DiscoveredCompany, rules: ScoringRules): ScoringResult {
  const reasons: LeadScoreReason[] = [];
  let points = 0;

  // Check funding stage
  if (
    company.signals.fundingStage &&
    rules.companyRules.growth.fundingStages.includes(company.signals.fundingStage)
  ) {
    points += rules.companyRules.growth.points;
    reasons.push({
      category: 'company',
      factor: 'Growth stage match',
      points: rules.companyRules.growth.points,
      explanation: `Company at ${company.signals.fundingStage} stage`,
      impact: 'medium',
    });
  }

  return { points, reasons };
}

// ============================================================================
// PERSON FIT SCORING
// ============================================================================

/**
 * Calculate person fit score (max 30 points)
 */
function calculatePersonFit(
  person: DiscoveredPerson | null,
  rules: ScoringRules
): ScoringResult {
  const reasons: LeadScoreReason[] = [];
  let points = 0;

  if (!person) {
    reasons.push({
      category: 'person',
      factor: 'No person data',
      points: 0,
      explanation: 'Person data not available',
      impact: 'high',
    });
    return { points: 0, reasons };
  }

  // 1. Title match (max 15 points)
  const titleScore = scoreTitle(person, rules);
  points += titleScore.points;
  reasons.push(...titleScore.reasons);

  // 2. Seniority level (max 10 points)
  const seniorityScore = scoreSeniority(person, rules);
  points += seniorityScore.points;
  reasons.push(...seniorityScore.reasons);

  // 3. Department (max 5 points)
  const deptScore = scoreDepartment(person, rules);
  points += deptScore.points;
  reasons.push(...deptScore.reasons);

  return { points: Math.min(30, points), reasons };
}

/**
 * Score job title
 */
function scoreTitle(person: DiscoveredPerson, rules: ScoringRules): ScoringResult {
  const reasons: LeadScoreReason[] = [];
  let points = 0;

  const title = person.title?.toLowerCase() || '';

  // Check excluded first
  if (rules.personRules.titles.excluded.some((ex) => title.includes(ex.toLowerCase()))) {
    reasons.push({
      category: 'person',
      factor: 'Title excluded',
      points: -100,
      explanation: `Job title "${person.title}" is excluded`,
      impact: 'high',
    });
    return { points: -100, reasons };
  }

  // Check preferred
  if (rules.personRules.titles.preferred.some((pref) => title.includes(pref.toLowerCase()))) {
    points = rules.personRules.titles.preferredPoints;
    reasons.push({
      category: 'person',
      factor: 'Preferred title',
      points,
      explanation: `Job title "${person.title}" is preferred`,
      impact: 'high',
    });
  }
  // Check acceptable
  else if (rules.personRules.titles.acceptable.some((acc) => title.includes(acc.toLowerCase()))) {
    points = rules.personRules.titles.acceptablePoints;
    reasons.push({
      category: 'person',
      factor: 'Acceptable title',
      points,
      explanation: `Job title "${person.title}" is acceptable`,
      impact: 'medium',
    });
  } else {
    reasons.push({
      category: 'person',
      factor: 'Non-target title',
      points: 0,
      explanation: `Title "${person.title}" is not a target`,
      impact: 'low',
    });
  }

  return { points, reasons };
}

/**
 * Detect seniority level from title
 */
function detectSeniority(title: string): SeniorityLevel {
  const lower = title.toLowerCase();

  if (/(ceo|cto|cfo|coo|chief|president)/i.test(lower)) {
    return 'C-Level';
  }
  if (/(vp|vice president)/i.test(lower)) {
    return 'VP';
  }
  if (/director/i.test(lower)) {
    return 'Director';
  }
  if (/manager|lead/i.test(lower)) {
    return 'Manager';
  }
  return 'Individual';
}

/**
 * Score seniority level
 */
function scoreSeniority(person: DiscoveredPerson, rules: ScoringRules): ScoringResult {
  const reasons: LeadScoreReason[] = [];

  const title = person.title || '';
  const seniority = detectSeniority(title);
  const points = rules.personRules.seniority.points[seniority] || 0;

  reasons.push({
    category: 'person',
    factor: 'Seniority level',
    points,
    explanation: `${seniority} level position`,
    impact: seniority === 'C-Level' || seniority === 'VP' ? 'high' : 'medium',
  });

  return { points, reasons };
}

/**
 * Detect department from title
 */
function detectDepartment(title: string): Department | null {
  const lower = title.toLowerCase();

  if (/(sales|business development|account|revenue)/i.test(lower)) {return 'Sales';}
  if (/(marketing|growth|demand gen|brand)/i.test(lower)) {return 'Marketing';}
  if (/(engineer|developer|tech|software|devops)/i.test(lower)) {return 'Engineering';}
  if (/(product|pm)/i.test(lower)) {return 'Product';}
  if (/(operations|ops|supply chain)/i.test(lower)) {return 'Operations';}
  if (/(finance|accounting|controller)/i.test(lower)) {return 'Finance';}
  if (/(hr|people|talent|recruit)/i.test(lower)) {return 'HR';}
  if (/(customer success|support|cs)/i.test(lower)) {return 'Customer Success';}

  return 'Other';
}

/**
 * Score department
 */
function scoreDepartment(person: DiscoveredPerson, rules: ScoringRules): ScoringResult {
  const reasons: LeadScoreReason[] = [];

  const title = person.title || '';
  const department = detectDepartment(title);

  if (department && rules.personRules.department.preferred.includes(department)) {
    const points = rules.personRules.department.points;
    reasons.push({
      category: 'person',
      factor: 'Target department',
      points,
      explanation: `Works in ${department} department`,
      impact: 'medium',
    });
    return { points, reasons };
  }

  reasons.push({
    category: 'person',
    factor: 'Non-target department',
    points: 0,
    explanation: `Department ${department || 'unknown'} is not a priority`,
    impact: 'low',
  });

  return { points: 0, reasons };
}

// ============================================================================
// INTENT SIGNALS DETECTION
// ============================================================================

interface IntentSignalsResult {
  totalPoints: number;
  signals: IntentSignal[];
  reasons: LeadScoreReason[];
}

/**
 * Detect intent signals (max 20 points)
 */
function detectIntentSignals(
  company: DiscoveredCompany | null,
  person: DiscoveredPerson | null,
  rules: ScoringRules
): IntentSignalsResult {
  const signals: IntentSignal[] = [];
  const reasons: LeadScoreReason[] = [];
  let totalPoints = 0;

  if (!company && !person) {
    return { totalPoints: 0, signals: [], reasons: [] };
  }

  const now = new Date();

  // Company-based signals
  if (company) {
    // 1. Hiring signal
    if (company.signals.isHiring && company.signals.jobCount > 0) {
      const points = rules.intentWeights.hiring;
      signals.push({
        type: 'hiring',
        confidence: 0.9,
        detectedAt: now,
        source: 'company-careers-page',
        description: `Company is hiring ${company.signals.jobCount} roles`,
        points,
      });
      totalPoints += points;
      reasons.push({
        category: 'intent',
        factor: 'Hiring activity',
        points,
        explanation: `Actively hiring (${company.signals.jobCount} open positions)`,
        impact: 'high',
      });
    }

    // 2. Funding signal
    if (company.signals.fundingStage) {
      const recentFunding = company.signals.growthIndicators.some((indicator) =>
        /raised|funding|investment/i.test(indicator)
      );
      if (recentFunding) {
        const points = rules.intentWeights.funding;
        signals.push({
          type: 'funding',
          confidence: 0.85,
          detectedAt: now,
          source: 'company-website',
          description: `Recent funding activity detected`,
          points,
        });
        totalPoints += points;
        reasons.push({
          category: 'intent',
          factor: 'Recent funding',
          points,
          explanation: 'Company raised funding recently',
          impact: 'high',
        });
      }
    }

    // 3. Tech stack match signal
    if (company.techStack.length > 5) {
      const points = rules.intentWeights.tech_stack_match;
      signals.push({
        type: 'tech_stack_match',
        confidence: 0.7,
        detectedAt: now,
        source: 'tech-stack-analysis',
        description: `Uses ${company.techStack.length} technologies`,
        points,
      });
      totalPoints += points;
    }

    // 4. Press mentions signal
    if (company.pressmentions && company.pressmentions.length > 0) {
      const points = rules.intentWeights.press_mention;
      signals.push({
        type: 'press_mention',
        confidence: 0.75,
        detectedAt: now,
        source: 'press-page',
        description: `${company.pressmentions.length} recent press mentions`,
        points,
      });
      totalPoints += points;
      reasons.push({
        category: 'intent',
        factor: 'Media coverage',
        points,
        explanation: `Featured in ${company.pressmentions.length} press articles`,
        impact: 'medium',
      });
    }

    // 5. Growth indicators
    if (company.signals.growthIndicators.length > 0) {
      const points = rules.intentWeights.high_growth;
      signals.push({
        type: 'high_growth',
        confidence: 0.8,
        detectedAt: now,
        source: 'company-analysis',
        description: `${company.signals.growthIndicators.length} growth signals detected`,
        points,
      });
      totalPoints += points;
    }
  }

  // Person-based signals
  if (person) {
    // 6. Job change signal
    const recentJobChange = isRecentJobChange(person);
    if (recentJobChange) {
      const points = rules.intentWeights.job_change;
      signals.push({
        type: 'job_change',
        confidence: 0.8,
        detectedAt: now,
        source: 'linkedin-profile',
        description: 'Recently changed jobs',
        points,
      });
      totalPoints += points;
      reasons.push({
        category: 'intent',
        factor: 'Recent job change',
        points,
        explanation: 'Person recently started new role',
        impact: 'high',
      });
    }
  }

  // Cap at 20 points
  totalPoints = Math.min(20, totalPoints);

  return { totalPoints, signals, reasons };
}

/**
 * Check if person recently changed jobs
 */
function isRecentJobChange(person: DiscoveredPerson): boolean {
  if (!person.currentRole?.startDate) {
    return false;
  }

  try {
    const startDate = new Date(person.currentRole.startDate);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    return startDate > threeMonthsAgo;
  } catch {
    return false;
  }
}

// ============================================================================
// ENGAGEMENT SCORING
// ============================================================================

/**
 * Calculate engagement score (max 10 points)
 */
async function calculateEngagement(
  leadId: string,
  organizationId: string,
  rules: ScoringRules
): Promise<ScoringResult> {
  const reasons: LeadScoreReason[] = [];
  let points = 0;

  try {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    // Get sequence enrollments for this lead
    const enrollments = await adminDal.safeQuery('SEQUENCE_ENROLLMENTS', (ref) =>
      ref
        .where('leadId', '==', leadId)
        .where('organizationId', '==', organizationId)
    );

    let hasEmailOpened = false;
    let hasEmailClicked = false;
    let hasEmailReplied = false;
    let hasLinkedInConnected = false;
    let hasPhoneAnswered = false;

    // Check for engagement signals in metadata
    enrollments.docs.forEach((doc) => {
      const data = doc.data();
      const conditions = data.metadata?.conditions || {};

      if (conditions.email_opened) {hasEmailOpened = true;}
      if (conditions.email_clicked) {hasEmailClicked = true;}
      if (conditions.email_replied) {hasEmailReplied = true;}
      if (conditions.linkedin_connected) {hasLinkedInConnected = true;}
      if (conditions.phone_answered) {hasPhoneAnswered = true;}
    });

    // Score email engagement
    if (hasEmailReplied) {
      points += rules.engagementRules.email.repliedPoints;
      reasons.push({
        category: 'engagement',
        factor: 'Email reply',
        points: rules.engagementRules.email.repliedPoints,
        explanation: 'Replied to outreach email',
        impact: 'high',
      });
    } else if (hasEmailClicked) {
      points += rules.engagementRules.email.clickedPoints;
      reasons.push({
        category: 'engagement',
        factor: 'Email click',
        points: rules.engagementRules.email.clickedPoints,
        explanation: 'Clicked link in email',
        impact: 'medium',
      });
    } else if (hasEmailOpened) {
      points += rules.engagementRules.email.openedPoints;
      reasons.push({
        category: 'engagement',
        factor: 'Email open',
        points: rules.engagementRules.email.openedPoints,
        explanation: 'Opened outreach email',
        impact: 'low',
      });
    }

    // Score LinkedIn engagement
    if (hasLinkedInConnected) {
      points += rules.engagementRules.linkedin.connectedPoints;
      reasons.push({
        category: 'engagement',
        factor: 'LinkedIn connection',
        points: rules.engagementRules.linkedin.connectedPoints,
        explanation: 'Accepted LinkedIn connection',
        impact: 'high',
      });
    }

    // Score phone engagement
    if (hasPhoneAnswered) {
      points += rules.engagementRules.phone.answeredPoints;
      reasons.push({
        category: 'engagement',
        factor: 'Phone answered',
        points: rules.engagementRules.phone.answeredPoints,
        explanation: 'Answered phone call',
        impact: 'high',
      });
    }

    if (points === 0) {
      reasons.push({
        category: 'engagement',
        factor: 'No engagement',
        points: 0,
        explanation: 'No engagement detected yet',
        impact: 'low',
      });
    }
  } catch (error) {
    logger.error('Failed to calculate engagement score', error, { leadId });
  }

  return { points: Math.min(10, points), reasons };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate grade from score
 */
function calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= GRADE_THRESHOLDS.A) {return 'A';}
  if (score >= GRADE_THRESHOLDS.B) {return 'B';}
  if (score >= GRADE_THRESHOLDS.C) {return 'C';}
  if (score >= GRADE_THRESHOLDS.D) {return 'D';}
  return 'F';
}

/**
 * Calculate priority from score
 */
function calculatePriority(score: number): 'hot' | 'warm' | 'cold' {
  if (score >= PRIORITY_THRESHOLDS_MAP.hot) {return 'hot';}
  if (score >= PRIORITY_THRESHOLDS_MAP.warm) {return 'warm';}
  return 'cold';
}

/**
 * Calculate confidence in the score
 */
function calculateConfidence(
  company: DiscoveredCompany | null,
  person: DiscoveredPerson | null
): number {
  let confidence = 0;

  if (company) {
    confidence += company.metadata.confidence * 0.5;
  }

  if (person) {
    confidence += person.metadata.confidence * 0.5;
  }

  return Math.min(1, confidence);
}

/**
 * Get discovery data for lead
 */
async function getDiscoveryData(
  leadId: string,
  organizationId: string,
  providedData?: {
    company?: DiscoveredCompany;
    person?: DiscoveredPerson;
  }
): Promise<{ company: DiscoveredCompany | null; person: DiscoveredPerson | null }> {
  // Use provided data if available
  if (providedData) {
    return {
      company: providedData.company || null,
      person: providedData.person || null,
    };
  }

  // Otherwise, fetch lead data and run discovery
  const leadData = await getLeadData(leadId, organizationId);
  if (!leadData) {
    return { company: null, person: null };
  }

  let company: DiscoveredCompany | null = null;
  let person: DiscoveredPerson | null = null;

  // Discover company
  if (leadData.company || leadData.companyDomain) {
    try {
      const domain = leadData.companyDomain || leadData.company;
      const result = await discoverCompany(domain, organizationId);
      company = result.company;
    } catch (error) {
      logger.warn('Failed to discover company for lead', { leadId, error });
    }
  }

  // Discover person
  if (leadData.email) {
    try {
      const result = await discoverPerson(leadData.email, organizationId);
      person = result.person;
    } catch (error) {
      logger.warn('Failed to discover person for lead', { leadId, error });
    }
  }

  return { company, person };
}

/**
 * Get lead data from database
 */
async function getLeadData(leadId: string, organizationId: string): Promise<any> {
  try {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    // Get all workspaces for this organization
    const workspacesRef = adminDal.getNestedCollection(
      'organizations/{orgId}/workspaces',
      { orgId: organizationId }
    );
    const workspacesSnapshot = await workspacesRef.get();

    for (const workspaceDoc of workspacesSnapshot.docs) {
      // Check leads collection
      const leadRef = adminDal.getNestedCollection(
        'organizations/{orgId}/workspaces/{wsId}/entities/leads/records',
        { orgId: organizationId, wsId: workspaceDoc.id }
      ).doc(leadId);
      
      const leadDoc = await leadRef.get();
      if (leadDoc.exists) {
        return { id: leadDoc.id, ...leadDoc.data() };
      }

      // Also check contacts
      const contactRef = adminDal.getNestedCollection(
        'organizations/{orgId}/workspaces/{wsId}/entities/contacts/records',
        { orgId: organizationId, wsId: workspaceDoc.id }
      ).doc(leadId);
      
      const contactDoc = await contactRef.get();
      if (contactDoc.exists) {
        return { id: contactDoc.id, ...contactDoc.data() };
      }
    }

    return null;
  } catch (error) {
    logger.error('Failed to get lead data', error, { leadId });
    return null;
  }
}

/**
 * Get scoring rules for organization
 */
async function getScoringRules(
  organizationId: string,
  scoringRulesId?: string
): Promise<ScoringRules | null> {
  try {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    const scoringRulesRef = adminDal.getNestedCollection(
      'organizations/{orgId}/scoringRules',
      { orgId: organizationId }
    );

    // If specific rules requested
    if (scoringRulesId) {
      const doc = await scoringRulesRef.doc(scoringRulesId).get();

      if (doc.exists) {
        const data = doc.data()!;
        return {
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as ScoringRules;
      }
    }

    // Otherwise get active rules
    const snapshot = await scoringRulesRef
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as ScoringRules;
    }

    // If no rules exist, create default
    return await createDefaultScoringRules(organizationId);
  } catch (error) {
    logger.error('Failed to get scoring rules', error, { organizationId });
    return null;
  }
}

/**
 * Create default scoring rules for organization
 */
async function createDefaultScoringRules(organizationId: string): Promise<ScoringRules> {
  if (!adminDal) {
    throw new Error('Admin DAL not initialized');
  }

  const now = new Date();
  const rulesId = adminDal.getCollection('ORGANIZATIONS').doc().id;

  const rules: ScoringRules = {
    id: rulesId,
    organizationId,
    ...DEFAULT_SCORING_RULES,
    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
  };

  const scoringRulesRef = adminDal.getNestedCollection(
    'organizations/{orgId}/scoringRules',
    { orgId: organizationId }
  );

  await scoringRulesRef.doc(rulesId).set({
    ...rules,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });

  logger.info('Created default scoring rules', { organizationId, rulesId });

  return rules;
}

/**
 * Get cached score
 */
async function getCachedScore(
  leadId: string,
  organizationId: string
): Promise<LeadScore | null> {
  try {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    const leadScoresRef = adminDal.getNestedCollection(
      'organizations/{orgId}/leadScores',
      { orgId: organizationId }
    );
    
    const doc = await leadScoresRef.doc(leadId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as StoredLeadScore;

    // Check if expired
    if (data.metadata.expiresAt < new Date()) {
      return null;
    }

    return {
      totalScore: data.totalScore,
      grade: data.grade,
      priority: data.priority,
      breakdown: data.breakdown,
      reasons: data.reasons,
      detectedSignals: data.detectedSignals,
      metadata: {
        ...data.metadata,
        scoredAt: data.metadata.scoredAt instanceof Timestamp 
          ? data.metadata.scoredAt.toDate() 
          : new Date(data.metadata.scoredAt),
        expiresAt: data.metadata.expiresAt instanceof Timestamp 
          ? data.metadata.expiresAt.toDate() 
          : new Date(data.metadata.expiresAt),
      },
    };
  } catch (error) {
    logger.error('Failed to get cached score', error, { leadId });
    return null;
  }
}

/**
 * Cache score in Firestore
 */
async function cacheScore(
  leadId: string,
  organizationId: string,
  scoringRulesId: string,
  score: LeadScore,
  company: DiscoveredCompany | null,
  person: DiscoveredPerson | null
): Promise<void> {
  try {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    const storedScore: Omit<StoredLeadScore, 'id'> = {
      ...score,
      leadId,
      organizationId,
      scoringRulesId,
      snapshot: {
        companyDomain: company?.domain,
        personEmail: person?.email,
        discoveredAt: new Date(),
      },
    };

    const leadScoresRef = adminDal.getNestedCollection(
      'organizations/{orgId}/leadScores',
      { orgId: organizationId }
    );

    await leadScoresRef.doc(leadId).set({
      ...storedScore,
      metadata: {
        ...storedScore.metadata,
        scoredAt: Timestamp.fromDate(storedScore.metadata.scoredAt),
        expiresAt: Timestamp.fromDate(storedScore.metadata.expiresAt),
      },
      snapshot: {
        ...storedScore.snapshot,
        discoveredAt: Timestamp.fromDate(storedScore.snapshot.discoveredAt),
      },
    });

    logger.info('Cached lead score', { leadId, score: score.totalScore });
  } catch (error) {
    logger.error('Failed to cache score', error, { leadId });
  }
}

// ============================================================================
// SIGNAL BUS INTEGRATION
// ============================================================================

/**
 * Emit Signal Bus signals based on lead scoring results
 * 
 * This function emits signals to the Neural Net when leads are scored.
 * Signals different events based on score, grade, and intent.
 */
async function emitScoringSignals(
  leadId: string,
  organizationId: string,
  score: LeadScore,
  company: DiscoveredCompany | null,
  person: DiscoveredPerson | null
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    // Signal 1: lead.qualified - High-quality leads (Grade A or B)
    if (score.grade === 'A' || score.grade === 'B') {
      await coordinator.emitSignal({
        type: 'lead.qualified',
        leadId,
        orgId: organizationId,
        confidence: score.metadata.confidence,
        priority: score.grade === 'A' ? 'High' : 'Medium',
        metadata: {
          source: 'lead-scoring-engine',
          totalScore: score.totalScore,
          grade: score.grade,
          priority: score.priority,
          breakdown: score.breakdown,
          reasons: score.reasons.map(r => ({
            category: r.category,
            factor: r.factor,
            points: r.points,
            impact: r.impact,
          })),
          companyDomain: company?.domain,
          personEmail: person?.email,
          scoredAt: score.metadata.scoredAt.toISOString(),
        },
      });
    }

    // Signal 2: lead.intent.high - High intent signals detected
    const highIntentSignals = score.detectedSignals.filter(s => 
      ['hiring', 'funding', 'high_growth', 'job_change'].includes(s.type)
    );
    
    if (highIntentSignals.length > 0 && score.breakdown.intentSignals >= 10) {
      await coordinator.emitSignal({
        type: 'lead.intent.high',
        leadId,
        orgId: organizationId,
        confidence: Math.max(...highIntentSignals.map(s => s.confidence)),
        priority: 'High',
        metadata: {
          source: 'lead-scoring-engine',
          intentScore: score.breakdown.intentSignals,
          detectedSignals: highIntentSignals.map(s => ({
            type: s.type,
            confidence: s.confidence,
            description: s.description,
            source: s.source,
          })),
          totalScore: score.totalScore,
          grade: score.grade,
          companyDomain: company?.domain,
          personEmail: person?.email,
          nextBestAction: determineNextBestAction(score, highIntentSignals),
        },
      });
    }

    // Signal 3: lead.intent.low - Low intent or cold lead
    if (score.breakdown.intentSignals < 5 && score.priority === 'cold') {
      await coordinator.emitSignal({
        type: 'lead.intent.low',
        leadId,
        orgId: organizationId,
        confidence: score.metadata.confidence,
        priority: 'Low',
        metadata: {
          source: 'lead-scoring-engine',
          intentScore: score.breakdown.intentSignals,
          totalScore: score.totalScore,
          grade: score.grade,
          priority: score.priority,
          companyDomain: company?.domain,
          personEmail: person?.email,
          recommendation: 'Consider nurture sequence or deprioritize',
        },
      });
    }

    logger.info('Lead scoring signals emitted', {
      leadId,
      organizationId,
      grade: score.grade,
      intentScore: score.breakdown.intentSignals,
      signalsEmitted: [
        score.grade === 'A' || score.grade === 'B' ? 'qualified' : null,
        highIntentSignals.length > 0 && score.breakdown.intentSignals >= 10 ? 'intent.high' : null,
        score.breakdown.intentSignals < 5 && score.priority === 'cold' ? 'intent.low' : null,
      ].filter(Boolean).length,
    });
  } catch (error) {
    // Don't fail scoring if signal emission fails
    logger.error('Failed to emit scoring signals', error, {
      leadId,
      organizationId,
    });
  }
}

/**
 * Determine next best action based on score and intent signals
 */
function determineNextBestAction(
  score: LeadScore,
  highIntentSignals: Array<{ type: string; description: string }>
): string {
  // High-grade + hiring signal = immediate outreach
  if (score.grade === 'A' && highIntentSignals.some(s => s.type === 'hiring')) {
    return 'Send personalized email referencing hiring activity';
  }

  // High-grade + funding signal = strategic outreach
  if (score.grade === 'A' && highIntentSignals.some(s => s.type === 'funding')) {
    return 'Send growth-focused email referencing recent funding';
  }

  // High-grade + job change = timing-based outreach
  if (score.grade === 'A' && highIntentSignals.some(s => s.type === 'job_change')) {
    return 'Reach out about new role responsibilities';
  }

  // Default high-grade action
  if (score.grade === 'A') {
    return 'Enroll in high-touch sales sequence';
  }

  if (score.grade === 'B') {
    return 'Enroll in standard outreach sequence';
  }

  return 'Monitor for engagement signals';
}
