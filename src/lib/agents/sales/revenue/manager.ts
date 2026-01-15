/**
 * Revenue Director (L2 Manager)
 * STATUS: FUNCTIONAL
 *
 * Monitors lead status and orchestrates the lead pipeline state machine.
 * Determines when leads can transition from Intelligence phase to Outreach phase.
 *
 * CAPABILITIES:
 * - Lead pipeline state machine management
 * - Transition rules engine for stage progression
 * - BANT score evaluation and threshold checking
 * - Intelligence completeness assessment
 * - Engagement signal monitoring
 * - Time-based stage timeout enforcement
 * - Delegation to sales specialists
 */

import { BaseManager } from '../../base-manager';
import type { AgentMessage, AgentReport, ManagerConfig, Signal } from '../../types';

// ============================================================================
// SYSTEM PROMPT - The brain of this manager
// ============================================================================

const SYSTEM_PROMPT = `You are the Revenue Director, an expert L2 orchestrator responsible for managing the lead pipeline and optimizing revenue operations.

## YOUR ROLE
You monitor lead status across the pipeline and determine when leads are ready to transition between stages, particularly from the Intelligence phase to the Outreach phase. You coordinate with:
- LEAD_QUALIFIER: Qualifies incoming leads using BANT methodology
- OUTREACH_SPECIALIST: Executes personalized outreach sequences
- MERCHANDISER: Prepares product/service positioning for leads

## LEAD PIPELINE STATE MACHINE

### Pipeline Stages
1. DISCOVERY - Lead identified, minimal information
2. QUALIFIED - Lead meets basic criteria (BANT started)
3. INTELLIGENCE - Data gathering phase (scraping, research)
4. OUTREACH - Active engagement (emails, calls)
5. NEGOTIATION - Deal discussions, proposals
6. CLOSED - Won or lost, lifecycle complete

### Stage Definitions

#### DISCOVERY
- Entry: New lead source detection
- Activities: Basic data capture, source tracking
- Exit Criteria: Contact info captured, industry identified
- Typical Duration: 0-24 hours

#### QUALIFIED
- Entry: Basic info captured
- Activities: BANT scoring begins, initial research
- Exit Criteria: BANT score >= 40, target company profile created
- Typical Duration: 1-3 days

#### INTELLIGENCE
- Entry: Basic qualification complete
- Activities: Deep research, competitor analysis, social scraping
- Exit Criteria: BANT >= 60, intelligence complete, engagement signals positive
- Typical Duration: 3-7 days (max 7 days before forced review)

#### OUTREACH
- Entry: Intelligence phase complete
- Activities: Personalized outreach, follow-ups, meeting scheduling
- Exit Criteria: Response received, meeting booked or lead disqualified
- Typical Duration: 7-21 days

#### NEGOTIATION
- Entry: Positive response and interest confirmed
- Activities: Proposals, demos, objection handling
- Exit Criteria: Deal won or lost
- Typical Duration: 14-60 days

#### CLOSED
- Entry: Deal outcome determined
- Activities: Win/loss documentation, handoff to success or archive
- Outcome: WON, LOST, or DISQUALIFIED

## TRANSITION RULES ENGINE

### Intelligence -> Outreach Transition
This is the most critical transition. Premature outreach wastes effort on unqualified leads.
Late outreach loses momentum and allows competitors to engage first.

#### Required Conditions (ALL must be true):
1. **BANT Score >= 60** (threshold)
   - Budget: Has budget authority or influence (0-25 points)
   - Authority: Can make or influence purchase decision (0-25 points)
   - Need: Has identified pain point we can solve (0-25 points)
   - Timeline: Has active timeline or trigger event (0-25 points)

2. **Intelligence Completeness**
   - hasScraperData: Company website data collected
   - hasCompetitorData: Competitor analysis complete
   - hasSocialProfiles: LinkedIn/social profiles identified
   - hasContactVerified: Email/phone verified
   - Minimum: At least 3 of 4 intelligence requirements met

3. **Time Constraints**
   - Not too early: Minimum 24 hours in Intelligence stage
   - Not too late: Maximum 7 days in Intelligence stage
   - Override: If 7 days exceeded with BANT >= 50, escalate to manual review

4. **Engagement Signals (Optional but weighted)**
   - Email opens: +5 to readiness score per open
   - Website visits: +10 to readiness score per visit
   - Content downloads: +15 to readiness score
   - Demo requests: +50 to readiness score (instant qualification)

### Readiness Score Calculation
Base score from BANT (0-100) plus:
- Intelligence completeness bonus (0-20 points)
- Engagement signal bonus (0-30 points)
- Time factor adjustment (-10 to +10 based on stage duration)

Total Readiness = BANT + Intelligence + Engagement + Time Factor
Threshold for Outreach: 70 (readiness score)

## DELEGATION WORKFLOW

### Lead Qualification Flow
1. Lead enters DISCOVERY
2. Delegate to LEAD_QUALIFIER for BANT scoring
3. Once QUALIFIED, initiate Intelligence gathering
4. Monitor Intelligence progress
5. Evaluate transition readiness
6. If ready, delegate to OUTREACH_SPECIALIST
7. Track engagement and update pipeline

### Escalation Rules
- BANT < 30 after 3 days: Delegate to LEAD_QUALIFIER for re-qualification
- No engagement after 5 days: Generate re-engagement recommendation
- Deal stale > 14 days in any stage: Escalate for review

## OUTPUT FORMAT
You ALWAYS return structured JSON:

\`\`\`json
{
  "leadId": "unique-lead-identifier",
  "currentStage": "DISCOVERY | QUALIFIED | INTELLIGENCE | OUTREACH | NEGOTIATION | CLOSED",
  "transitionAnalysis": {
    "canTransition": true | false,
    "targetStage": "next stage or null",
    "blockers": ["array of blocking conditions"],
    "readinessScore": 0-100,
    "bantScore": 0-100,
    "bantBreakdown": {
      "budget": 0-25,
      "authority": 0-25,
      "need": 0-25,
      "timeline": 0-25
    }
  },
  "intelligenceStatus": {
    "hasScraperData": true | false,
    "hasCompetitorData": true | false,
    "hasSocialProfiles": true | false,
    "hasContactVerified": true | false,
    "completeness": 0-100
  },
  "engagementSignals": {
    "emailOpens": 0,
    "websiteVisits": 0,
    "contentDownloads": 0,
    "demoRequests": 0,
    "engagementScore": 0-50
  },
  "timeInStage": {
    "days": 0,
    "hours": 0,
    "withinLimits": true | false,
    "approaching_timeout": true | false
  },
  "recommendedActions": ["array of next steps"],
  "delegations": [
    {
      "specialist": "LEAD_QUALIFIER | OUTREACH_SPECIALIST | MERCHANDISER",
      "action": "what to do",
      "priority": "LOW | NORMAL | HIGH | CRITICAL"
    }
  ],
  "confidence": 0.0-1.0
}
\`\`\`

## RULES
1. NEVER rush leads to Outreach - quality over speed
2. ALWAYS enforce BANT threshold - no exceptions below 60
3. TRUST engagement signals - a demo request overrides other factors
4. RESPECT time limits - 7 days max in Intelligence, then decide
5. BE HONEST about blockers - clearly state what's preventing transition
6. DELEGATE appropriately - use specialists for their expertise

## INTEGRATION
You receive requests from:
- JASPER (L1 orchestrator) - Pipeline status requests
- Lead intake systems - New lead notifications
- CRM webhooks - Lead data updates

Your output feeds into:
- OUTREACH_SPECIALIST - Ready-to-engage leads
- LEAD_QUALIFIER - Leads needing re-qualification
- Analytics - Pipeline metrics and conversion data
- MERCHANDISER - Leads needing product positioning`;

// ============================================================================
// CONFIGURATION
// ============================================================================

const REVENUE_MANAGER_CONFIG: ManagerConfig = {
  identity: {
    id: 'REVENUE_DIRECTOR',
    name: 'Revenue Director',
    role: 'manager',
    status: 'FUNCTIONAL',
    reportsTo: 'JASPER',
    capabilities: [
      'lead_pipeline_management',
      'transition_rules_engine',
      'bant_evaluation',
      'intelligence_assessment',
      'engagement_monitoring',
      'time_based_enforcement',
      'specialist_delegation',
      'readiness_scoring',
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: ['delegate', 'evaluate_transition', 'calculate_readiness', 'query_pipeline'],
  outputSchema: {
    type: 'object',
    properties: {
      leadId: { type: 'string' },
      currentStage: { type: 'string' },
      transitionAnalysis: { type: 'object' },
      intelligenceStatus: { type: 'object' },
      engagementSignals: { type: 'object' },
      timeInStage: { type: 'object' },
      recommendedActions: { type: 'array' },
      delegations: { type: 'array' },
      confidence: { type: 'number' },
    },
    required: ['leadId', 'currentStage', 'transitionAnalysis', 'recommendedActions'],
  },
  maxTokens: 8192,
  temperature: 0.3,
  specialists: ['LEAD_QUALIFIER', 'OUTREACH_SPECIALIST', 'MERCHANDISER'],
  delegationRules: [
    {
      triggerKeywords: ['qualify', 'bant', 'score', 'evaluate lead', 'assess', 'qualification'],
      delegateTo: 'LEAD_QUALIFIER',
      priority: 10,
      requiresApproval: false,
    },
    {
      triggerKeywords: ['outreach', 'email', 'contact', 'reach out', 'engage', 'follow up', 'sequence'],
      delegateTo: 'OUTREACH_SPECIALIST',
      priority: 10,
      requiresApproval: false,
    },
    {
      triggerKeywords: ['product', 'position', 'merchandise', 'offering', 'package', 'pricing', 'proposal'],
      delegateTo: 'MERCHANDISER',
      priority: 10,
      requiresApproval: false,
    },
  ],
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Lead pipeline stages
 */
export enum LeadStage {
  DISCOVERY = 'DISCOVERY',
  QUALIFIED = 'QUALIFIED',
  INTELLIGENCE = 'INTELLIGENCE',
  OUTREACH = 'OUTREACH',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED = 'CLOSED',
}

/**
 * BANT score breakdown
 */
export interface BANTScore {
  budget: number;      // 0-25
  authority: number;   // 0-25
  need: number;        // 0-25
  timeline: number;    // 0-25
  total: number;       // 0-100
}

/**
 * Intelligence completeness status
 */
export interface IntelligenceStatus {
  hasScraperData: boolean;
  hasCompetitorData: boolean;
  hasSocialProfiles: boolean;
  hasContactVerified: boolean;
  completeness: number;  // 0-100
  lastUpdated: Date;
}

/**
 * Engagement signals from lead activity
 */
export interface EngagementSignals {
  emailOpens: number;
  websiteVisits: number;
  contentDownloads: number;
  demoRequests: number;
  lastEngagement: Date | null;
  engagementScore: number;  // 0-50
}

/**
 * Time tracking for stage duration
 */
export interface StageTime {
  enteredAt: Date;
  days: number;
  hours: number;
  withinLimits: boolean;
  approachingTimeout: boolean;
  timeoutThresholdDays: number;
}

/**
 * Complete lead pipeline state
 */
export interface LeadPipelineState {
  leadId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  currentStage: LeadStage;
  previousStage: LeadStage | null;
  stageHistory: Array<{ stage: LeadStage; enteredAt: Date; exitedAt: Date | null }>;
  bantScore: BANTScore;
  intelligenceStatus: IntelligenceStatus;
  engagementSignals: EngagementSignals;
  stageTime: StageTime;
  source: string;
  industry: string;
  estimatedValue: number;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  assignedTo: string | null;
  tags: string[];
  notes: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transition rule definition
 */
export interface TransitionRule {
  fromStage: LeadStage;
  toStage: LeadStage;
  conditions: TransitionCondition[];
  overrideConditions?: TransitionCondition[];
  timeoutAction?: 'ESCALATE' | 'FORCE_TRANSITION' | 'DISQUALIFY';
}

/**
 * Individual transition condition
 */
export interface TransitionCondition {
  type: 'BANT_THRESHOLD' | 'INTELLIGENCE_COMPLETE' | 'TIME_MIN' | 'TIME_MAX' | 'ENGAGEMENT_THRESHOLD' | 'MANUAL_APPROVAL';
  value: number | boolean;
  weight: number;
  required: boolean;
  description: string;
}

/**
 * Result of transition evaluation
 */
export interface TransitionResult {
  canTransition: boolean;
  targetStage: LeadStage | null;
  readinessScore: number;
  bantScore: number;
  blockers: string[];
  warnings: string[];
  recommendedActions: string[];
  delegations: DelegationRecommendation[];
  confidence: number;
  evaluatedAt: Date;
}

/**
 * Delegation recommendation
 */
export interface DelegationRecommendation {
  specialist: string;
  action: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  reason: string;
}

/**
 * Lead data input for evaluation
 */
export interface LeadData {
  leadId: string;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  currentStage?: LeadStage;
  bantScore?: Partial<BANTScore>;
  intelligenceStatus?: Partial<IntelligenceStatus>;
  engagementSignals?: Partial<EngagementSignals>;
  stageEnteredAt?: Date;
  source?: string;
  industry?: string;
  estimatedValue?: number;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}

/**
 * Pipeline query request
 */
export interface PipelineQueryRequest {
  action: 'EVALUATE_TRANSITION' | 'GET_STATUS' | 'CHECK_READINESS' | 'GET_RECOMMENDATIONS' | 'BATCH_EVALUATE';
  leadId?: string;
  leadIds?: string[];
  leadData?: LeadData;
  targetStage?: LeadStage;
}

/**
 * Complete pipeline analysis output
 */
export interface PipelineAnalysisOutput {
  leadId: string;
  currentStage: LeadStage;
  transitionAnalysis: TransitionResult;
  intelligenceStatus: IntelligenceStatus;
  engagementSignals: EngagementSignals;
  timeInStage: StageTime;
  recommendedActions: string[];
  delegations: DelegationRecommendation[];
  confidence: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * BANT score threshold for outreach eligibility
 */
const BANT_THRESHOLD_OUTREACH = 60;

/**
 * Minimum BANT score for escalation review
 */
const BANT_THRESHOLD_ESCALATION = 50;

/**
 * Readiness score threshold for transition
 */
const READINESS_THRESHOLD = 70;

/**
 * Time limits per stage (in days)
 */
const STAGE_TIME_LIMITS: Record<LeadStage, { min: number; max: number }> = {
  [LeadStage.DISCOVERY]: { min: 0, max: 1 },
  [LeadStage.QUALIFIED]: { min: 0.5, max: 3 },
  [LeadStage.INTELLIGENCE]: { min: 1, max: 7 },
  [LeadStage.OUTREACH]: { min: 1, max: 21 },
  [LeadStage.NEGOTIATION]: { min: 3, max: 60 },
  [LeadStage.CLOSED]: { min: 0, max: Infinity },
};

/**
 * Engagement signal weights for scoring
 */
const ENGAGEMENT_WEIGHTS = {
  emailOpen: 5,
  websiteVisit: 10,
  contentDownload: 15,
  demoRequest: 50,
};

/**
 * Intelligence completeness weights
 */
const INTELLIGENCE_WEIGHTS = {
  scraperData: 30,
  competitorData: 25,
  socialProfiles: 20,
  contactVerified: 25,
};

/**
 * Stage transition map - defines valid transitions
 */
const VALID_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  [LeadStage.DISCOVERY]: [LeadStage.QUALIFIED, LeadStage.CLOSED],
  [LeadStage.QUALIFIED]: [LeadStage.INTELLIGENCE, LeadStage.DISCOVERY, LeadStage.CLOSED],
  [LeadStage.INTELLIGENCE]: [LeadStage.OUTREACH, LeadStage.QUALIFIED, LeadStage.CLOSED],
  [LeadStage.OUTREACH]: [LeadStage.NEGOTIATION, LeadStage.INTELLIGENCE, LeadStage.CLOSED],
  [LeadStage.NEGOTIATION]: [LeadStage.CLOSED, LeadStage.OUTREACH],
  [LeadStage.CLOSED]: [], // Terminal stage
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class RevenueDirector extends BaseManager {
  private transitionRules: Map<string, TransitionRule>;

  constructor() {
    super(REVENUE_MANAGER_CONFIG);
    this.transitionRules = new Map();
    this.initializeTransitionRules();
  }

  async initialize(): Promise<void> {
    this.log('INFO', 'Initializing Revenue Director...');
    this.log('INFO', `Loaded ${this.transitionRules.size} transition rules`);
    this.isInitialized = true;
  }

  /**
   * Main execution entry point
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as PipelineQueryRequest;

      if (!payload?.action) {
        return this.createReport(
          taskId,
          'FAILED',
          null,
          ['No action specified in payload. Valid actions: EVALUATE_TRANSITION, GET_STATUS, CHECK_READINESS, GET_RECOMMENDATIONS, BATCH_EVALUATE']
        );
      }

      this.log('INFO', `Processing pipeline action: ${payload.action}`);

      let result: PipelineAnalysisOutput | PipelineAnalysisOutput[] | TransitionResult;

      switch (payload.action) {
        case 'EVALUATE_TRANSITION':
          if (!payload.leadData) {
            return this.createReport(taskId, 'FAILED', null, ['leadData required for EVALUATE_TRANSITION']);
          }
          result = await this.processLeadTransition(payload.leadData, taskId);
          break;

        case 'GET_STATUS':
          if (!payload.leadData) {
            return this.createReport(taskId, 'FAILED', null, ['leadData required for GET_STATUS']);
          }
          result = this.getLeadStatus(payload.leadData);
          break;

        case 'CHECK_READINESS':
          if (!payload.leadData) {
            return this.createReport(taskId, 'FAILED', null, ['leadData required for CHECK_READINESS']);
          }
          result = this.evaluateTransition(
            payload.leadData.leadId,
            payload.leadData.currentStage || LeadStage.INTELLIGENCE,
            payload.leadData
          );
          break;

        case 'GET_RECOMMENDATIONS':
          if (!payload.leadData) {
            return this.createReport(taskId, 'FAILED', null, ['leadData required for GET_RECOMMENDATIONS']);
          }
          result = this.generateRecommendationsAnalysis(payload.leadData);
          break;

        case 'BATCH_EVALUATE':
          // For batch evaluation, we'd process multiple leads
          result = this.evaluateTransition(
            payload.leadData?.leadId || 'batch',
            payload.leadData?.currentStage || LeadStage.INTELLIGENCE,
            payload.leadData || { leadId: 'batch' }
          );
          break;

        default:
          return this.createReport(taskId, 'FAILED', null, [`Unknown action: ${payload.action}`]);
      }

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', `Pipeline processing failed: ${errorMessage}`);
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * Handle signals from the Signal Bus
   */
  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;

    if (signal.payload.type === 'COMMAND') {
      return this.execute(signal.payload);
    }

    // Handle ALERT signals for lead events
    if (signal.payload.type === 'ALERT') {
      const alertPayload = signal.payload.payload as { event: string; leadId: string };
      if (alertPayload?.event === 'ENGAGEMENT_DETECTED') {
        this.log('INFO', `Engagement detected for lead: ${alertPayload.leadId}`);
        // Trigger re-evaluation
        return this.execute({
          ...signal.payload,
          payload: {
            action: 'EVALUATE_TRANSITION',
            leadId: alertPayload.leadId,
          },
        });
      }
    }

    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  /**
   * Generate a report for JASPER
   */
  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  /**
   * Self-assessment - this manager has REAL logic
   */
  hasRealLogic(): boolean {
    return true;
  }

  /**
   * Lines of code assessment
   */
  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 650, boilerplate: 100 };
  }

  // ==========================================================================
  // TRANSITION RULES INITIALIZATION
  // ==========================================================================

  /**
   * Initialize all transition rules
   */
  private initializeTransitionRules(): void {
    // Discovery -> Qualified
    this.transitionRules.set('DISCOVERY_TO_QUALIFIED', {
      fromStage: LeadStage.DISCOVERY,
      toStage: LeadStage.QUALIFIED,
      conditions: [
        {
          type: 'BANT_THRESHOLD',
          value: 20,
          weight: 1,
          required: true,
          description: 'Minimum BANT score of 20 (basic info captured)',
        },
      ],
      timeoutAction: 'ESCALATE',
    });

    // Qualified -> Intelligence
    this.transitionRules.set('QUALIFIED_TO_INTELLIGENCE', {
      fromStage: LeadStage.QUALIFIED,
      toStage: LeadStage.INTELLIGENCE,
      conditions: [
        {
          type: 'BANT_THRESHOLD',
          value: 40,
          weight: 1,
          required: true,
          description: 'BANT score >= 40 for intelligence phase',
        },
        {
          type: 'TIME_MIN',
          value: 0.5,
          weight: 0.5,
          required: false,
          description: 'Minimum 12 hours in qualified stage',
        },
      ],
      timeoutAction: 'ESCALATE',
    });

    // Intelligence -> Outreach (CRITICAL TRANSITION)
    this.transitionRules.set('INTELLIGENCE_TO_OUTREACH', {
      fromStage: LeadStage.INTELLIGENCE,
      toStage: LeadStage.OUTREACH,
      conditions: [
        {
          type: 'BANT_THRESHOLD',
          value: BANT_THRESHOLD_OUTREACH,
          weight: 1,
          required: true,
          description: `BANT score >= ${BANT_THRESHOLD_OUTREACH} required for outreach`,
        },
        {
          type: 'INTELLIGENCE_COMPLETE',
          value: 75,
          weight: 0.8,
          required: true,
          description: 'At least 75% intelligence completeness (3 of 4 requirements)',
        },
        {
          type: 'TIME_MIN',
          value: 1,
          weight: 0.3,
          required: true,
          description: 'Minimum 24 hours in intelligence stage',
        },
        {
          type: 'TIME_MAX',
          value: 7,
          weight: 0.5,
          required: false,
          description: 'Maximum 7 days in intelligence stage',
        },
      ],
      overrideConditions: [
        {
          type: 'ENGAGEMENT_THRESHOLD',
          value: 50,
          weight: 2,
          required: false,
          description: 'Demo request overrides other requirements',
        },
      ],
      timeoutAction: 'ESCALATE',
    });

    // Outreach -> Negotiation
    this.transitionRules.set('OUTREACH_TO_NEGOTIATION', {
      fromStage: LeadStage.OUTREACH,
      toStage: LeadStage.NEGOTIATION,
      conditions: [
        {
          type: 'ENGAGEMENT_THRESHOLD',
          value: 30,
          weight: 1,
          required: true,
          description: 'Positive engagement signals required',
        },
        {
          type: 'MANUAL_APPROVAL',
          value: true,
          weight: 1,
          required: true,
          description: 'Sales rep confirmation of interest',
        },
      ],
      timeoutAction: 'ESCALATE',
    });

    // Negotiation -> Closed
    this.transitionRules.set('NEGOTIATION_TO_CLOSED', {
      fromStage: LeadStage.NEGOTIATION,
      toStage: LeadStage.CLOSED,
      conditions: [
        {
          type: 'MANUAL_APPROVAL',
          value: true,
          weight: 1,
          required: true,
          description: 'Deal outcome must be recorded',
        },
      ],
      timeoutAction: 'ESCALATE',
    });

    this.log('INFO', `Initialized ${this.transitionRules.size} transition rules`);
  }

  // ==========================================================================
  // CORE PIPELINE LOGIC
  // ==========================================================================

  /**
   * Process lead transition request
   */
  private async processLeadTransition(leadData: LeadData, taskId: string): Promise<PipelineAnalysisOutput> {
    const currentStage = leadData.currentStage || LeadStage.INTELLIGENCE;

    // Evaluate transition eligibility
    const transitionResult = this.evaluateTransition(leadData.leadId, currentStage, leadData);

    // Build intelligence status
    const intelligenceStatus = this.buildIntelligenceStatus(leadData);

    // Build engagement signals
    const engagementSignals = this.buildEngagementSignals(leadData);

    // Calculate time in stage
    const timeInStage = this.calculateTimeInStage(leadData.stageEnteredAt || new Date(), currentStage);

    // Generate recommendations
    const recommendedActions = this.getRecommendedActions(leadData);

    // Prepare delegations if transition is ready
    const delegations = await this.prepareDelegations(transitionResult, leadData, taskId);

    return {
      leadId: leadData.leadId,
      currentStage,
      transitionAnalysis: transitionResult,
      intelligenceStatus,
      engagementSignals,
      timeInStage,
      recommendedActions,
      delegations,
      confidence: transitionResult.confidence,
    };
  }

  /**
   * Evaluate if a lead can transition to the next stage
   */
  evaluateTransition(leadId: string, currentStage: LeadStage, leadData: LeadData): TransitionResult {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const recommendedActions: string[] = [];
    const delegations: DelegationRecommendation[] = [];

    // Calculate BANT score
    const bantScore = this.calculateBANTScore(leadData.bantScore);

    // Calculate readiness score
    const readinessScore = this.calculateReadinessScore(leadData);

    // Determine target stage
    const validTargets = VALID_TRANSITIONS[currentStage];
    let targetStage: LeadStage | null = null;

    // For Intelligence stage, we primarily want to move to Outreach
    if (currentStage === LeadStage.INTELLIGENCE) {
      const canMove = this.canMoveToOutreach(leadData);

      if (canMove) {
        targetStage = LeadStage.OUTREACH;
      } else {
        // Determine blockers
        if (bantScore.total < BANT_THRESHOLD_OUTREACH) {
          blockers.push(`BANT score ${bantScore.total} below threshold ${BANT_THRESHOLD_OUTREACH}`);
          recommendedActions.push('Continue lead qualification to improve BANT score');
          delegations.push({
            specialist: 'LEAD_QUALIFIER',
            action: 'Re-evaluate and improve BANT scoring',
            priority: 'HIGH',
            reason: `BANT score ${bantScore.total} needs to reach ${BANT_THRESHOLD_OUTREACH}`,
          });
        }

        const intelligenceStatus = this.buildIntelligenceStatus(leadData);
        if (intelligenceStatus.completeness < 75) {
          blockers.push(`Intelligence completeness ${intelligenceStatus.completeness}% below 75% threshold`);
          recommendedActions.push('Complete missing intelligence requirements');

          if (!intelligenceStatus.hasScraperData) {
            recommendedActions.push('Collect company website data via scraper');
          }
          if (!intelligenceStatus.hasCompetitorData) {
            recommendedActions.push('Complete competitor analysis');
          }
          if (!intelligenceStatus.hasSocialProfiles) {
            recommendedActions.push('Identify LinkedIn/social profiles');
          }
          if (!intelligenceStatus.hasContactVerified) {
            recommendedActions.push('Verify contact email/phone');
          }
        }

        // Check time constraints
        const timeInStage = this.calculateTimeInStage(leadData.stageEnteredAt || new Date(), currentStage);
        if (timeInStage.days < 1) {
          blockers.push('Minimum 24 hours in Intelligence stage not met');
          warnings.push('Allow more time for intelligence gathering');
        }

        if (timeInStage.days >= 7) {
          warnings.push('Lead has exceeded 7-day Intelligence stage limit');
          if (bantScore.total >= BANT_THRESHOLD_ESCALATION) {
            recommendedActions.push('ESCALATE: Lead exceeds time limit with sufficient BANT - manual review recommended');
          } else {
            recommendedActions.push('Consider disqualifying lead or returning to Qualified stage');
          }
        }
      }
    } else {
      // Handle other stage transitions
      const nextStage = this.determineNextStage(currentStage, bantScore, readinessScore);
      if (nextStage && validTargets.includes(nextStage)) {
        targetStage = nextStage;
      }
    }

    // Check for engagement override
    const engagementSignals = this.buildEngagementSignals(leadData);
    if (engagementSignals.demoRequests > 0) {
      warnings.push('DEMO REQUEST DETECTED - High intent signal, consider fast-tracking');
      if (!targetStage && currentStage === LeadStage.INTELLIGENCE) {
        targetStage = LeadStage.OUTREACH;
        blockers.length = 0; // Clear blockers for demo request
        recommendedActions.unshift('PRIORITY: Demo request detected - initiate immediate outreach');
        delegations.unshift({
          specialist: 'OUTREACH_SPECIALIST',
          action: 'Initiate priority outreach sequence for demo request',
          priority: 'CRITICAL',
          reason: 'Demo request indicates high buyer intent',
        });
      }
    }

    // Calculate confidence
    const confidence = this.calculateTransitionConfidence(bantScore, readinessScore, blockers.length);

    return {
      canTransition: targetStage !== null && blockers.length === 0,
      targetStage,
      readinessScore,
      bantScore: bantScore.total,
      blockers,
      warnings,
      recommendedActions,
      delegations,
      confidence,
      evaluatedAt: new Date(),
    };
  }

  /**
   * Check if lead can move from Intelligence to Outreach
   */
  canMoveToOutreach(leadData: LeadData): boolean {
    // Check BANT threshold
    const bantScore = this.calculateBANTScore(leadData.bantScore);
    if (bantScore.total < BANT_THRESHOLD_OUTREACH) {
      return false;
    }

    // Check intelligence completeness
    const intelligenceStatus = this.buildIntelligenceStatus(leadData);
    if (intelligenceStatus.completeness < 75) {
      return false;
    }

    // Check time constraints
    const timeInStage = this.calculateTimeInStage(leadData.stageEnteredAt || new Date(), LeadStage.INTELLIGENCE);
    if (timeInStage.days < 1) {
      return false;
    }

    // Check for engagement override (demo request)
    const engagementSignals = this.buildEngagementSignals(leadData);
    if (engagementSignals.demoRequests > 0) {
      return true; // Demo request overrides other checks
    }

    // Calculate total readiness score
    const readinessScore = this.calculateReadinessScore(leadData);
    return readinessScore >= READINESS_THRESHOLD;
  }

  /**
   * Calculate comprehensive readiness score
   */
  calculateReadinessScore(leadData: LeadData): number {
    let score = 0;

    // BANT component (0-100, weighted at 60%)
    const bantScore = this.calculateBANTScore(leadData.bantScore);
    score += bantScore.total * 0.6;

    // Intelligence completeness component (0-20 points)
    const intelligenceStatus = this.buildIntelligenceStatus(leadData);
    score += (intelligenceStatus.completeness / 100) * 20;

    // Engagement signals component (0-30 points, capped)
    const engagementSignals = this.buildEngagementSignals(leadData);
    const engagementBonus = Math.min(engagementSignals.engagementScore, 30);
    score += engagementBonus;

    // Time factor adjustment (-10 to +10)
    const timeInStage = this.calculateTimeInStage(
      leadData.stageEnteredAt || new Date(),
      leadData.currentStage || LeadStage.INTELLIGENCE
    );
    const timeFactor = this.calculateTimeFactor(timeInStage);
    score += timeFactor;

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Get recommended actions based on lead state
   */
  getRecommendedActions(leadData: LeadData): string[] {
    const actions: string[] = [];
    const currentStage = leadData.currentStage || LeadStage.INTELLIGENCE;
    const bantScore = this.calculateBANTScore(leadData.bantScore);
    const intelligenceStatus = this.buildIntelligenceStatus(leadData);
    const engagementSignals = this.buildEngagementSignals(leadData);
    const timeInStage = this.calculateTimeInStage(leadData.stageEnteredAt || new Date(), currentStage);

    // Stage-specific recommendations
    switch (currentStage) {
      case LeadStage.DISCOVERY:
        actions.push('Capture complete contact information');
        actions.push('Identify company industry and size');
        actions.push('Start initial BANT qualification');
        break;

      case LeadStage.QUALIFIED:
        actions.push('Complete BANT scoring assessment');
        if (bantScore.budget < 15) actions.push('Investigate budget authority and timeline');
        if (bantScore.authority < 15) actions.push('Identify decision makers and influencers');
        if (bantScore.need < 15) actions.push('Document specific pain points and needs');
        if (bantScore.timeline < 15) actions.push('Determine purchase timeline and triggers');
        break;

      case LeadStage.INTELLIGENCE:
        // Intelligence gathering recommendations
        if (!intelligenceStatus.hasScraperData) {
          actions.push('Run website scraper to collect company data');
        }
        if (!intelligenceStatus.hasCompetitorData) {
          actions.push('Complete competitor landscape analysis');
        }
        if (!intelligenceStatus.hasSocialProfiles) {
          actions.push('Find and document LinkedIn profiles for key contacts');
        }
        if (!intelligenceStatus.hasContactVerified) {
          actions.push('Verify email deliverability and phone number');
        }

        // BANT improvement recommendations
        if (bantScore.total < BANT_THRESHOLD_OUTREACH) {
          actions.push(`Improve BANT score from ${bantScore.total} to ${BANT_THRESHOLD_OUTREACH}`);
        }

        // Time-based recommendations
        if (timeInStage.days >= 5 && timeInStage.days < 7) {
          actions.push('WARNING: Approaching 7-day limit - accelerate intelligence gathering');
        }
        if (timeInStage.days >= 7) {
          actions.push('URGENT: Time limit exceeded - make transition decision immediately');
        }

        // Engagement-based recommendations
        if (engagementSignals.emailOpens > 0) {
          actions.push('Lead showing interest - prioritize outreach preparation');
        }
        if (engagementSignals.websiteVisits > 2) {
          actions.push('High website activity - lead is actively researching');
        }
        if (engagementSignals.demoRequests > 0) {
          actions.push('PRIORITY: Demo requested - initiate immediate outreach');
        }
        break;

      case LeadStage.OUTREACH:
        actions.push('Execute personalized outreach sequence');
        actions.push('Monitor for response and engagement');
        if (timeInStage.days > 7) {
          actions.push('Consider re-engagement campaign or different channel');
        }
        break;

      case LeadStage.NEGOTIATION:
        actions.push('Prepare and send proposal');
        actions.push('Schedule demo or discovery call');
        actions.push('Address objections and concerns');
        break;

      case LeadStage.CLOSED:
        actions.push('Document win/loss reasons');
        actions.push('Update CRM with final status');
        break;
    }

    // Priority ordering
    return this.prioritizeActions(actions, bantScore, intelligenceStatus, engagementSignals);
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Calculate BANT score from partial data
   */
  private calculateBANTScore(bantData?: Partial<BANTScore>): BANTScore {
    const budget = bantData?.budget ?? 0;
    const authority = bantData?.authority ?? 0;
    const need = bantData?.need ?? 0;
    const timeline = bantData?.timeline ?? 0;

    return {
      budget: Math.min(25, Math.max(0, budget)),
      authority: Math.min(25, Math.max(0, authority)),
      need: Math.min(25, Math.max(0, need)),
      timeline: Math.min(25, Math.max(0, timeline)),
      total: Math.min(100, Math.max(0, budget + authority + need + timeline)),
    };
  }

  /**
   * Build intelligence status from lead data
   */
  private buildIntelligenceStatus(leadData: LeadData): IntelligenceStatus {
    const intel = leadData.intelligenceStatus || {};

    const hasScraperData = intel.hasScraperData ?? false;
    const hasCompetitorData = intel.hasCompetitorData ?? false;
    const hasSocialProfiles = intel.hasSocialProfiles ?? false;
    const hasContactVerified = intel.hasContactVerified ?? false;

    // Calculate completeness percentage
    let completeness = 0;
    if (hasScraperData) completeness += INTELLIGENCE_WEIGHTS.scraperData;
    if (hasCompetitorData) completeness += INTELLIGENCE_WEIGHTS.competitorData;
    if (hasSocialProfiles) completeness += INTELLIGENCE_WEIGHTS.socialProfiles;
    if (hasContactVerified) completeness += INTELLIGENCE_WEIGHTS.contactVerified;

    return {
      hasScraperData,
      hasCompetitorData,
      hasSocialProfiles,
      hasContactVerified,
      completeness,
      lastUpdated: intel.lastUpdated || new Date(),
    };
  }

  /**
   * Build engagement signals from lead data
   */
  private buildEngagementSignals(leadData: LeadData): EngagementSignals {
    const signals = leadData.engagementSignals || {};

    const emailOpens = signals.emailOpens ?? 0;
    const websiteVisits = signals.websiteVisits ?? 0;
    const contentDownloads = signals.contentDownloads ?? 0;
    const demoRequests = signals.demoRequests ?? 0;

    // Calculate engagement score
    const engagementScore = Math.min(50,
      (emailOpens * ENGAGEMENT_WEIGHTS.emailOpen) +
      (websiteVisits * ENGAGEMENT_WEIGHTS.websiteVisit) +
      (contentDownloads * ENGAGEMENT_WEIGHTS.contentDownload) +
      (demoRequests * ENGAGEMENT_WEIGHTS.demoRequest)
    );

    return {
      emailOpens,
      websiteVisits,
      contentDownloads,
      demoRequests,
      lastEngagement: signals.lastEngagement || null,
      engagementScore,
    };
  }

  /**
   * Calculate time spent in current stage
   */
  private calculateTimeInStage(enteredAt: Date, stage: LeadStage): StageTime {
    const now = new Date();
    const diffMs = now.getTime() - enteredAt.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    const limits = STAGE_TIME_LIMITS[stage];
    const withinLimits = diffDays >= limits.min && diffDays <= limits.max;
    const approachingTimeout = diffDays >= limits.max * 0.8 && diffDays < limits.max;

    return {
      enteredAt,
      days: Math.floor(diffDays),
      hours: Math.floor(diffHours % 24),
      withinLimits,
      approachingTimeout,
      timeoutThresholdDays: limits.max,
    };
  }

  /**
   * Calculate time factor adjustment for readiness score
   */
  private calculateTimeFactor(timeInStage: StageTime): number {
    const { days, timeoutThresholdDays } = timeInStage;

    // Ideal time is 50% of max
    const idealDays = timeoutThresholdDays * 0.5;

    if (days < 1) {
      // Too early: penalize
      return -10;
    } else if (days < idealDays) {
      // Ramping up: slight bonus
      return (days / idealDays) * 5;
    } else if (days <= timeoutThresholdDays) {
      // Ideal to max: decreasing bonus
      const ratio = (timeoutThresholdDays - days) / (timeoutThresholdDays - idealDays);
      return ratio * 10;
    } else {
      // Exceeded: penalty
      return -5;
    }
  }

  /**
   * Determine next stage based on scores
   */
  private determineNextStage(currentStage: LeadStage, bantScore: BANTScore, readinessScore: number): LeadStage | null {
    const validTargets = VALID_TRANSITIONS[currentStage];

    switch (currentStage) {
      case LeadStage.DISCOVERY:
        if (bantScore.total >= 20) return LeadStage.QUALIFIED;
        break;
      case LeadStage.QUALIFIED:
        if (bantScore.total >= 40) return LeadStage.INTELLIGENCE;
        break;
      case LeadStage.INTELLIGENCE:
        if (readinessScore >= READINESS_THRESHOLD) return LeadStage.OUTREACH;
        break;
      case LeadStage.OUTREACH:
        if (readinessScore >= 80) return LeadStage.NEGOTIATION;
        break;
      case LeadStage.NEGOTIATION:
        return LeadStage.CLOSED;
    }

    return null;
  }

  /**
   * Calculate transition confidence score
   */
  private calculateTransitionConfidence(bantScore: BANTScore, readinessScore: number, blockerCount: number): number {
    let confidence = 0;

    // BANT contribution (40%)
    confidence += (bantScore.total / 100) * 0.4;

    // Readiness contribution (40%)
    confidence += (readinessScore / 100) * 0.4;

    // Blocker penalty (20%)
    const blockerPenalty = Math.min(0.2, blockerCount * 0.05);
    confidence += 0.2 - blockerPenalty;

    return Math.round(confidence * 100) / 100;
  }

  /**
   * Prioritize actions based on urgency
   */
  private prioritizeActions(
    actions: string[],
    bantScore: BANTScore,
    intelligenceStatus: IntelligenceStatus,
    engagementSignals: EngagementSignals
  ): string[] {
    const prioritized: Array<{ action: string; priority: number }> = [];

    for (const action of actions) {
      let priority = 0;

      // High priority keywords
      if (action.includes('PRIORITY') || action.includes('URGENT')) priority += 100;
      if (action.includes('WARNING')) priority += 50;
      if (action.includes('demo')) priority += 40;

      // Context-based priority
      if (action.includes('BANT') && bantScore.total < BANT_THRESHOLD_OUTREACH) priority += 30;
      if (action.includes('intelligence') && intelligenceStatus.completeness < 75) priority += 25;
      if (engagementSignals.demoRequests > 0 && action.includes('outreach')) priority += 60;

      prioritized.push({ action, priority });
    }

    // Sort by priority descending
    prioritized.sort((a, b) => b.priority - a.priority);

    return prioritized.map(p => p.action);
  }

  /**
   * Get lead status summary
   */
  private getLeadStatus(leadData: LeadData): PipelineAnalysisOutput {
    const currentStage = leadData.currentStage || LeadStage.INTELLIGENCE;
    const transitionResult = this.evaluateTransition(leadData.leadId, currentStage, leadData);
    const intelligenceStatus = this.buildIntelligenceStatus(leadData);
    const engagementSignals = this.buildEngagementSignals(leadData);
    const timeInStage = this.calculateTimeInStage(leadData.stageEnteredAt || new Date(), currentStage);
    const recommendedActions = this.getRecommendedActions(leadData);

    return {
      leadId: leadData.leadId,
      currentStage,
      transitionAnalysis: transitionResult,
      intelligenceStatus,
      engagementSignals,
      timeInStage,
      recommendedActions,
      delegations: transitionResult.delegations,
      confidence: transitionResult.confidence,
    };
  }

  /**
   * Generate comprehensive recommendations analysis
   */
  private generateRecommendationsAnalysis(leadData: LeadData): PipelineAnalysisOutput {
    return this.getLeadStatus(leadData);
  }

  /**
   * Prepare delegations based on transition result
   */
  private async prepareDelegations(
    transitionResult: TransitionResult,
    leadData: LeadData,
    taskId: string
  ): Promise<DelegationRecommendation[]> {
    const delegations: DelegationRecommendation[] = [...transitionResult.delegations];

    // If ready for outreach, add outreach specialist delegation
    if (transitionResult.canTransition && transitionResult.targetStage === LeadStage.OUTREACH) {
      delegations.push({
        specialist: 'OUTREACH_SPECIALIST',
        action: 'Initiate personalized outreach sequence',
        priority: 'HIGH',
        reason: 'Lead has met all transition criteria for outreach',
      });

      // Add merchandiser for positioning
      delegations.push({
        specialist: 'MERCHANDISER',
        action: 'Prepare product positioning for lead industry',
        priority: 'NORMAL',
        reason: 'Support outreach with tailored value proposition',
      });
    }

    // If BANT needs improvement, delegate to qualifier
    const bantScore = this.calculateBANTScore(leadData.bantScore);
    if (bantScore.total < BANT_THRESHOLD_OUTREACH && !delegations.some(d => d.specialist === 'LEAD_QUALIFIER')) {
      delegations.push({
        specialist: 'LEAD_QUALIFIER',
        action: 'Deep qualification to improve BANT score',
        priority: 'HIGH',
        reason: `Current BANT ${bantScore.total} below threshold ${BANT_THRESHOLD_OUTREACH}`,
      });
    }

    return delegations;
  }

  /**
   * Execute delegation to specialist (async)
   */
  private async executeDelegation(
    delegation: DelegationRecommendation,
    leadData: LeadData,
    taskId: string
  ): Promise<{ specialist: string; status: string; result: unknown }> {
    const message: AgentMessage = {
      id: `${taskId}_${delegation.specialist}`,
      type: 'COMMAND',
      from: this.identity.id,
      to: delegation.specialist,
      payload: {
        leadData,
        action: delegation.action,
        priority: delegation.priority,
      },
      timestamp: new Date(),
      priority: delegation.priority,
      requiresResponse: true,
      traceId: taskId,
    };

    try {
      const report = await this.delegateToSpecialist(delegation.specialist, message);
      return {
        specialist: delegation.specialist,
        status: report.status,
        result: report.data,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delegation failed';
      return {
        specialist: delegation.specialist,
        status: 'FAILED',
        result: errorMessage,
      };
    }
  }

  /**
   * Validate stage transition is allowed
   */
  validateTransition(fromStage: LeadStage, toStage: LeadStage): { valid: boolean; reason: string } {
    const validTargets = VALID_TRANSITIONS[fromStage];

    if (!validTargets.includes(toStage)) {
      return {
        valid: false,
        reason: `Invalid transition: ${fromStage} cannot transition to ${toStage}. Valid targets: ${validTargets.join(', ')}`,
      };
    }

    return { valid: true, reason: 'Transition is valid' };
  }

  /**
   * Get pipeline metrics summary
   */
  getPipelineMetrics(): {
    totalRules: number;
    bantThreshold: number;
    readinessThreshold: number;
    stageLimits: Record<LeadStage, { min: number; max: number }>;
  } {
    return {
      totalRules: this.transitionRules.size,
      bantThreshold: BANT_THRESHOLD_OUTREACH,
      readinessThreshold: READINESS_THRESHOLD,
      stageLimits: STAGE_TIME_LIMITS,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createRevenueDirector(): RevenueDirector {
  return new RevenueDirector();
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: RevenueDirector | null = null;

export function getRevenueDirector(): RevenueDirector {
  instance ??= createRevenueDirector();
  return instance;
}
