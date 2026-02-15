/**
 * Conversation Playbook Builder - Type Definitions
 * 
 * Extracts winning patterns, talk tracks, and best practices from
 * top performers' conversations to create reusable playbooks for
 * coaching and rep development.
 * 
 * CAPABILITIES:
 * - Pattern extraction from conversation intelligence data
 * - Talk track identification and cataloging
 * - Objection response library building
 * - Best practice playbook creation
 * - Success pattern matching
 * - Playbook adoption tracking
 * - A/B testing of different approaches
 * 
 * BUSINESS VALUE:
 * - Institutionalize what works (capture tribal knowledge)
 * - 3x faster rep onboarding with proven talk tracks
 * - Replicate top performer success across team
 * - Data-driven playbooks (not guesswork)
 * - Self-improving as more calls are analyzed
 * 
 * @module lib/playbook
 */

import type { Timestamp } from 'firebase/firestore';
import type {
  ConversationType,
  ObjectionType,
  CoachingCategory,
} from '@/lib/conversation/types';
import type { PerformanceTier } from '@/lib/performance/types';

// ============================================================================
// CORE PLAYBOOK TYPES
// ============================================================================

/**
 * Playbook - Collection of proven patterns and talk tracks
 */
export interface Playbook {
  id: string;

  // Metadata
  name: string;
  description: string;
  category: PlaybookCategory;
  tags: string[];
  
  // Applicability
  conversationType: ConversationType;
  industry?: string;
  dealSize?: DealSizeRange;
  
  // Content
  patterns: Pattern[];
  talkTracks: TalkTrack[];
  objectionResponses: ObjectionResponse[];
  bestPractices: PlaybookBestPractice[];
  
  // Evidence
  successMetrics: SuccessMetrics;
  sourceConversations: string[]; // conversation IDs
  topPerformers: string[]; // rep IDs who excel at this
  
  // Adoption
  adoptionRate: number; // 0-100
  effectiveness: number; // 0-100
  usageCount: number;
  
  // Status
  status: PlaybookStatus;
  confidence: number; // 0-100
  
  // Ownership
  createdBy: string;
  updatedBy?: string;
  
  // Timestamps
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  lastUsedAt?: Date | Timestamp;
  
  // Version
  version: number;
}

/**
 * Playbook category
 */
export type PlaybookCategory = 
  | 'discovery'
  | 'demo'
  | 'objection_handling'
  | 'closing'
  | 'negotiation'
  | 'follow_up'
  | 'prospecting'
  | 'relationship_building'
  | 'competitive_positioning'
  | 'value_articulation'
  | 'general';

/**
 * Deal size range
 */
export type DealSizeRange = 
  | 'smb' // < $10k
  | 'mid_market' // $10k - $100k
  | 'enterprise' // > $100k
  | 'any';

/**
 * Playbook status
 */
export type PlaybookStatus = 
  | 'draft'
  | 'active'
  | 'testing' // A/B testing
  | 'archived'
  | 'deprecated';

/**
 * Success metrics for a playbook
 */
export interface SuccessMetrics {
  // Conversion
  avgConversionRate: number; // 0-100
  vsBaselineConversion: number; // percentage points difference
  
  // Sentiment
  avgSentimentScore: number; // -1 to 1
  vsBaselineSentiment: number;
  
  // Scores
  avgOverallScore: number; // 0-100
  vsBaselineScore: number;
  
  // Objection handling
  objectionSuccessRate: number; // 0-100
  vsBaselineObjectionSuccess: number;
  
  // Win rate
  winRate: number; // 0-100 (when playbook is used)
  vsBaselineWinRate: number;
  
  // Sample size
  conversationsAnalyzed: number;
  repsUsing: number;
  
  // Statistical significance
  confidence: number; // 0-100
  pValue?: number;
}

// ============================================================================
// PATTERN TYPES
// ============================================================================

/**
 * Pattern - Recurring successful approach or technique
 */
export interface Pattern {
  id: string;
  
  // Description
  name: string;
  description: string;
  category: PatternCategory;
  
  // Context
  situation: string; // "When prospect says..."
  approach: string; // "Top performers respond with..."
  outcome: string; // "Resulting in..."
  
  // Examples
  examples: PatternExample[];
  
  // Evidence
  frequency: number; // How often seen in top performer calls
  successRate: number; // 0-100
  avgImpact: number; // 0-100
  
  // Sources
  sourceConversationIds: string[];
  topPerformerIds: string[];
  
  // Applicability
  applicableWhen: ApplicabilityRule[];
  notApplicableWhen?: ApplicabilityRule[];
  
  // Metrics
  avgSentimentChange: number; // Before vs after pattern
  avgScoreChange: number;
  
  // Confidence
  confidence: number; // 0-100
  sampleSize: number;
}

/**
 * Pattern category
 */
export type PatternCategory = 
  | 'opening'
  | 'discovery_question'
  | 'value_proposition'
  | 'objection_response'
  | 'closing_technique'
  | 'rapport_building'
  | 'pain_exploration'
  | 'feature_positioning'
  | 'competitor_dismissal'
  | 'urgency_creation'
  | 'stakeholder_engagement'
  | 'next_steps'
  | 'other';

/**
 * Pattern example from real conversation
 */
export interface PatternExample {
  conversationId: string;
  repId: string;
  repName: string;
  
  // Context
  timestamp: number; // seconds from start
  situation: string;
  
  // What was said
  quote: string;
  
  // Result
  outcome: string;
  sentimentBefore: number;
  sentimentAfter: number;
  
  // Metrics
  effectiveness: 'excellent' | 'good' | 'fair';
  
  // Why it worked
  keyFactors: string[];
}

/**
 * Applicability rule - When to use a pattern
 */
export interface ApplicabilityRule {
  type: ApplicabilityRuleType;
  condition: string;
  value?: string | number | string[];
  operator?: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in';
}

/**
 * Applicability rule type
 */
export type ApplicabilityRuleType = 
  | 'conversation_type'
  | 'deal_size'
  | 'industry'
  | 'stage'
  | 'sentiment'
  | 'objection_type'
  | 'topic'
  | 'competitor'
  | 'stakeholder_role'
  | 'time_in_call'
  | 'custom';

// ============================================================================
// TALK TRACK TYPES
// ============================================================================

/**
 * Talk Track - Proven script or messaging approach
 */
export interface TalkTrack {
  id: string;
  
  // Description
  name: string;
  description: string;
  purpose: TalkTrackPurpose;
  
  // Content
  script: string; // The actual talk track
  keyPhrases: string[]; // Critical words/phrases
  tonality: Tonality;
  pace: Pace;
  
  // Structure
  structure: TalkTrackSection[];
  
  // Variations
  variations: TalkTrackVariation[];
  
  // Context
  useWhen: string[];
  avoidWhen: string[];
  
  // Effectiveness
  successRate: number; // 0-100
  avgSentimentScore: number; // -1 to 1
  avgConversionRate: number; // 0-100
  
  // Sources
  sourceConversationIds: string[];
  originatingRepId: string; // Who first used it successfully
  originatingRepName: string;
  
  // Adoption
  adoptionRate: number; // 0-100
  usageCount: number;
  
  // Metrics
  avgTimeToDeliver: number; // seconds
  avgSentimentChange: number;
  
  // Confidence
  confidence: number; // 0-100
  sampleSize: number;
}

/**
 * Talk track purpose
 */
export type TalkTrackPurpose = 
  | 'opening'
  | 'value_prop'
  | 'discovery'
  | 'demo_intro'
  | 'objection_handling'
  | 'pricing_discussion'
  | 'closing'
  | 'follow_up'
  | 'competitor_comparison'
  | 'case_study'
  | 'feature_explanation'
  | 'pain_acknowledgment'
  | 'urgency_building'
  | 'stakeholder_alignment'
  | 'next_steps';

/**
 * Tonality
 */
export type Tonality = 
  | 'consultative'
  | 'assertive'
  | 'empathetic'
  | 'enthusiastic'
  | 'professional'
  | 'casual'
  | 'urgent'
  | 'educational';

/**
 * Pace
 */
export type Pace = 
  | 'slow' // Deliberate, thoughtful
  | 'moderate'
  | 'fast'; // Energetic, urgent

/**
 * Talk track section
 */
export interface TalkTrackSection {
  order: number;
  name: string;
  content: string;
  purpose: string;
  estimatedDuration: number; // seconds
  criticalPoints: string[];
}

/**
 * Talk track variation
 */
export interface TalkTrackVariation {
  id: string;
  name: string;
  script: string;
  differencesFrom: string; // Differences from main track
  
  // When to use this variation
  useCase: string;
  
  // Effectiveness
  successRate: number;
  sampleSize: number;
  
  // A/B test results (if available)
  abTestResults?: ABTestResults;
}

/**
 * A/B test results
 */
export interface ABTestResults {
  variantA: string; // variation ID
  variantB: string; // variation ID

  // Results
  variantASuccessRate: number;
  variantBSuccessRate: number;
  winner: string; // variation ID or 'inconclusive'

  // Stats
  sampleSizeA: number;
  sampleSizeB: number;
  confidence: number; // 0-100
  pValue: number;

  // Recommendation
  recommendation: string;
}

// ============================================================================
// OBJECTION RESPONSE TYPES
// ============================================================================

/**
 * Objection Response - Proven response to common objections
 */
export interface ObjectionResponse {
  id: string;
  
  // Objection
  objectionType: ObjectionType;
  objectionText: string; // Common phrasing
  variations: string[]; // Different ways prospects say it
  
  // Response
  response: string; // The proven response
  responseType: ResponseType;
  
  // Strategy
  strategy: ResponseStrategy;
  keyTechniques: string[];
  
  // Examples
  examples: ObjectionResponseExample[];
  
  // Effectiveness
  successRate: number; // 0-100 (how often it resolves objection)
  avgSentimentChange: number; // Before vs after
  dealSaveRate: number; // 0-100 (deals saved after this objection)
  
  // Sources
  sourceConversationIds: string[];
  topPerformerIds: string[];
  
  // Context
  worksWellWith: string[]; // Related patterns or talk tracks
  followUpWith: string[];
  
  // Metrics
  avgTimeToResolve: number; // seconds
  avgTurnsToResolve: number;
  
  // Confidence
  confidence: number; // 0-100
  sampleSize: number;
}

/**
 * Response type
 */
export type ResponseType = 
  | 'acknowledge_and_reframe'
  | 'question_based'
  | 'story_based'
  | 'data_driven'
  | 'social_proof'
  | 'risk_reversal'
  | 'comparison'
  | 'urgency'
  | 'value_reinforcement'
  | 'alternative_offer';

/**
 * Response strategy
 */
export type ResponseStrategy = 
  | 'empathize_then_educate'
  | 'feel_felt_found'
  | 'boomerang'
  | 'isolation'
  | 'reframe'
  | 'story'
  | 'question'
  | 'evidence'
  | 'trial_close';

/**
 * Objection response example
 */
export interface ObjectionResponseExample {
  conversationId: string;
  repId: string;
  repName: string;
  
  // Context
  dealSize: number;
  industry: string;
  stage: string;
  
  // Objection
  objectionQuote: string;
  objectionSeverity: 'critical' | 'high' | 'medium' | 'low';
  
  // Response
  responseQuote: string;
  
  // Outcome
  outcome: 'resolved' | 'partially_resolved' | 'unresolved';
  dealWon: boolean;
  sentimentBefore: number;
  sentimentAfter: number;
  
  // Why it worked (or didn't)
  successFactors: string[];
  lessonsLearned: string[];
}

// ============================================================================
// BEST PRACTICE TYPES
// ============================================================================

/**
 * Playbook best practice
 */
export interface PlaybookBestPractice {
  id: string;
  
  // Description
  title: string;
  description: string;
  category: CoachingCategory;
  
  // What to do
  whatToDo: string;
  whatNotToDo: string;
  
  // Why it works
  rationale: string;
  psychologicalPrinciples?: string[];
  
  // Evidence
  evidence: BestPracticeEvidence[];
  
  // Implementation
  implementationSteps: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  
  // Effectiveness
  impactOnConversions: number; // percentage point lift
  impactOnSentiment: number;
  impactOnWinRate: number;
  
  // Sources
  topPerformerIds: string[];
  sourceConversationIds: string[];
  
  // Adoption
  adoptionRate: number; // 0-100
  timeToMaster: string; // e.g., "1-2 weeks"
  
  // Metrics
  repsUsingIt: number;
  avgSuccessRate: number; // 0-100
  
  // Confidence
  confidence: number; // 0-100
  sampleSize: number;
}

/**
 * Best practice evidence
 */
export interface BestPracticeEvidence {
  metric: string;
  topPerformerAvg: number;
  teamAvg: number;
  lift: number; // percentage points
  significance: 'high' | 'medium' | 'low';
  description: string;
}

// ============================================================================
// PATTERN EXTRACTION TYPES
// ============================================================================

/**
 * Pattern extraction request
 */
export interface ExtractPatternsRequest {
  // Source data
  conversationIds?: string[]; // Specific conversations
  repIds?: string[]; // Specific reps (defaults to top performers)
  
  // Filters
  conversationType?: ConversationType;
  minPerformanceScore?: number; // Only analyze conversations above this score
  dateRange?: DateRange;
  
  // Extraction settings
  minFrequency?: number; // Pattern must appear at least N times
  minSuccessRate?: number; // Pattern must have at least N% success rate
  minConfidence?: number; // 0-100
  
  // What to extract
  extractPatterns?: boolean;
  extractTalkTracks?: boolean;
  extractObjectionResponses?: boolean;
  extractBestPractices?: boolean;
  
  // Options
  includeExamples?: boolean;
  maxExamplesPerPattern?: number;
  groupByCategory?: boolean;
}

/**
 * Date range
 */
export interface DateRange {
  startDate: Date | string;
  endDate: Date | string;
}

/**
 * Pattern extraction result
 */
export interface PatternExtractionResult {
  // Results
  patterns: Pattern[];
  talkTracks: TalkTrack[];
  objectionResponses: ObjectionResponse[];
  bestPractices: PlaybookBestPractice[];
  
  // Summary
  summary: ExtractionSummary;
  
  // Metadata
  extractedAt: Date;
  conversationsAnalyzed: number;
  repsAnalyzed: number;
  aiModel: string;
  processingTime: number; // ms
}

/**
 * Extraction summary
 */
export interface ExtractionSummary {
  totalPatternsFound: number;
  highConfidencePatterns: number; // confidence >= 80
  totalTalkTracksFound: number;
  totalObjectionResponsesFound: number;
  totalBestPracticesFound: number;
  
  // Top insights
  topPatterns: Pattern[];
  topTalkTracks: TalkTrack[];
  topObjectionResponses: ObjectionResponse[];
  
  // Recommendations
  recommendations: string[];
  suggestedPlaybooks: PlaybookSuggestion[];
}

/**
 * Playbook suggestion
 */
export interface PlaybookSuggestion {
  name: string;
  description: string;
  category: PlaybookCategory;
  includedPatternIds: string[];
  includedTalkTrackIds: string[];
  includedObjectionResponseIds: string[];
  estimatedImpact: 'high' | 'medium' | 'low';
  reasoning: string;
}

// ============================================================================
// PLAYBOOK USAGE TYPES
// ============================================================================

/**
 * Playbook usage tracking
 */
export interface PlaybookUsage {
  id: string;
  playbookId: string;
  
  // Context
  conversationId: string;
  repId: string;
  dealId?: string;
  
  // What was used
  patternsUsed: string[]; // pattern IDs
  talkTracksUsed: string[]; // talk track IDs
  objectionResponsesUsed: string[]; // objection response IDs
  
  // Outcome
  conversationScore: number; // 0-100
  sentimentScore: number; // -1 to 1
  objectionHandlingScore: number; // 0-100
  overallEffectiveness: 'excellent' | 'good' | 'fair' | 'poor';
  
  // Adherence
  adherenceScore: number; // 0-100 (how closely playbook was followed)
  deviations: PlaybookDeviation[];
  
  // Results
  dealProgressed: boolean;
  dealWon?: boolean;
  
  // Timestamps
  usedAt: Date | Timestamp;
}

/**
 * Playbook deviation
 */
export interface PlaybookDeviation {
  elementId: string; // pattern, talk track, or objection response ID
  elementType: 'pattern' | 'talk_track' | 'objection_response';
  expectedUsage: string;
  actualUsage: string;
  impact: 'positive' | 'negative' | 'neutral';
  reason?: string;
}

// ============================================================================
// PLAYBOOK ADOPTION TYPES
// ============================================================================

/**
 * Playbook adoption metrics
 */
export interface PlaybookAdoptionMetrics {
  playbookId: string;

  // Overall adoption
  overallAdoptionRate: number; // 0-100
  repsUsing: number;
  repsAvailable: number;
  
  // By tier
  adoptionByTier: Record<PerformanceTier, number>;
  
  // Usage
  totalUsageCount: number;
  usageOverTime: UsageDataPoint[];
  
  // Effectiveness
  avgEffectiveness: number; // 0-100
  effectivenessDistribution: EffectivenessDistribution;
  
  // Impact
  impactMetrics: ImpactMetrics;
  
  // Barriers
  adoptionBarriers: AdoptionBarrier[];
  
  // Recommendations
  adoptionRecommendations: string[];
  
  // Metadata
  generatedAt: Date;
  periodStartDate: Date;
  periodEndDate: Date;
}

/**
 * Usage data point
 */
export interface UsageDataPoint {
  date: Date;
  usageCount: number;
  uniqueReps: number;
  avgEffectiveness: number;
}

/**
 * Effectiveness distribution
 */
export interface EffectivenessDistribution {
  excellent: number; // percentage
  good: number;
  fair: number;
  poor: number;
}

/**
 * Impact metrics
 */
export interface ImpactMetrics {
  // Before vs after playbook adoption
  conversionRateBefore: number;
  conversionRateAfter: number;
  conversionRateLift: number;
  
  sentimentBefore: number;
  sentimentAfter: number;
  sentimentLift: number;
  
  avgScoreBefore: number;
  avgScoreAfter: number;
  scoreLift: number;
  
  winRateBefore: number;
  winRateAfter: number;
  winRateLift: number;
  
  // Statistical significance
  confidence: number; // 0-100
  pValue?: number;
}

/**
 * Adoption barrier
 */
export interface AdoptionBarrier {
  type: BarrierType;
  description: string;
  repsAffected: number;
  severity: 'high' | 'medium' | 'low';
  mitigation: string;
}

/**
 * Barrier type
 */
export type BarrierType = 
  | 'awareness' // Reps don't know about playbook
  | 'complexity' // Too complex to use
  | 'relevance' // Not relevant to their deals
  | 'training' // Need more training
  | 'time' // Takes too long to use
  | 'trust' // Don't trust the recommendations
  | 'other';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request to generate a playbook
 */
export interface GeneratePlaybookRequest {
  // Playbook details
  name: string;
  description?: string;
  category: PlaybookCategory;
  conversationType: ConversationType;
  
  // Source data
  sourceConversationIds?: string[];
  topPerformerIds?: string[];
  minPerformanceScore?: number;
  dateRange?: DateRange;
  
  // Options
  includePatterns?: boolean;
  includeTalkTracks?: boolean;
  includeObjectionResponses?: boolean;
  includeBestPractices?: boolean;
  autoActivate?: boolean;
}

/**
 * Response with generated playbook
 */
export interface GeneratePlaybookResponse {
  success: boolean;
  playbook: Playbook;
  extractionResult: PatternExtractionResult;
  metadata: {
    generatedAt: Date;
    processingTime: number;
    aiModel: string;
    confidence: number;
  };
  error?: string;
}

/**
 * Request to get playbook adoption metrics
 */
export interface GetAdoptionMetricsRequest {
  playbookId: string;
  startDate?: Date | string;
  endDate?: Date | string;
}

/**
 * Request to track playbook usage
 */
export interface TrackPlaybookUsageRequest {
  playbookId: string;
  conversationId: string;
  repId: string;
  patternsUsed: string[];
  talkTracksUsed: string[];
  objectionResponsesUsed: string[];
  overallEffectiveness: 'excellent' | 'good' | 'fair' | 'poor';
  adherenceScore: number;
  deviations?: PlaybookDeviation[];
}

/**
 * Request to search playbooks
 */
export interface SearchPlaybooksRequest {
  // Search criteria
  query?: string;
  category?: PlaybookCategory;
  conversationType?: ConversationType;
  status?: PlaybookStatus;
  tags?: string[];
  
  // Filters
  minEffectiveness?: number;
  minAdoptionRate?: number;
  
  // Sorting
  sortBy?: 'effectiveness' | 'adoption' | 'usage' | 'created' | 'updated';
  sortOrder?: 'asc' | 'desc';
  
  // Pagination
  limit?: number;
  offset?: number;
}

/**
 * Playbook search results
 */
export interface PlaybookSearchResults {
  playbooks: Playbook[];
  total: number;
  hasMore: boolean;
  metadata: {
    searchedAt: Date;
    processingTime: number;
  };
}

// ============================================================================
// ENGINE CONFIGURATION
// ============================================================================

/**
 * Playbook engine configuration
 */
export interface PlaybookEngineConfig {
  // AI Settings
  aiModel: string;
  temperature: number;
  maxTokens: number;
  
  // Extraction settings
  minFrequency: number; // Pattern must appear at least N times
  minSuccessRate: number; // Pattern must have at least N% success rate
  minConfidence: number; // 0-100
  minSampleSize: number; // Minimum conversations to analyze
  
  // Top performer criteria
  topPerformerPercentile: number; // e.g., 80 = top 20%
  minPerformanceScore: number; // 0-100
  
  // Pattern detection
  enablePatternDetection: boolean;
  enableTalkTrackExtraction: boolean;
  enableObjectionResponseExtraction: boolean;
  enableBestPracticeExtraction: boolean;
  
  // Effectiveness thresholds
  minPatternSuccessRate: number;
  minTalkTrackSuccessRate: number;
  minObjectionResponseSuccessRate: number;
  
  // Performance
  cacheTTL: number; // seconds
  enableCaching: boolean;
  batchSize: number; // Conversations to process in parallel
}

/**
 * Default configuration
 */
export const DEFAULT_PLAYBOOK_CONFIG: PlaybookEngineConfig = {
  aiModel: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4000,
  
  minFrequency: 3, // Pattern must appear at least 3 times
  minSuccessRate: 70, // 70% success rate
  minConfidence: 60,
  minSampleSize: 10, // At least 10 conversations
  
  topPerformerPercentile: 80, // Top 20%
  minPerformanceScore: 75,
  
  enablePatternDetection: true,
  enableTalkTrackExtraction: true,
  enableObjectionResponseExtraction: true,
  enableBestPracticeExtraction: true,
  
  minPatternSuccessRate: 70,
  minTalkTrackSuccessRate: 75,
  minObjectionResponseSuccessRate: 70,
  
  cacheTTL: 3600, // 1 hour
  enableCaching: true,
  batchSize: 5,
};

// ============================================================================
// FIRESTORE SCHEMA
// ============================================================================

/**
 * Firestore playbook document
 */
export interface PlaybookDocument {
  id: string;
  name: string;
  description: string;
  category: PlaybookCategory;
  tags: string[];
  conversationType: ConversationType;
  industry?: string;
  dealSize?: DealSizeRange;
  patterns: Pattern[];
  talkTracks: TalkTrack[];
  objectionResponses: ObjectionResponse[];
  bestPractices: PlaybookBestPractice[];
  successMetrics: SuccessMetrics;
  sourceConversations: string[];
  topPerformers: string[];
  adoptionRate: number;
  effectiveness: number;
  usageCount: number;
  status: PlaybookStatus;
  confidence: number;
  createdBy: string;
  updatedBy?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  lastUsedAt?: Timestamp;
  version: number;
}

/**
 * Firestore playbook usage document
 */
export interface PlaybookUsageDocument {
  id: string;
  playbookId: string;
  conversationId: string;
  repId: string;
  dealId?: string;
  patternsUsed: string[];
  talkTracksUsed: string[];
  objectionResponsesUsed: string[];
  conversationScore: number;
  sentimentScore: number;
  objectionHandlingScore: number;
  overallEffectiveness: 'excellent' | 'good' | 'fair' | 'poor';
  adherenceScore: number;
  deviations: PlaybookDeviation[];
  dealProgressed: boolean;
  dealWon?: boolean;
  usedAt: Timestamp;
}

/**
 * Firestore playbook adoption document
 */
export interface PlaybookAdoptionDocument {
  playbookId: string;
  overallAdoptionRate: number;
  repsUsing: number;
  repsAvailable: number;
  adoptionByTier: Record<PerformanceTier, number>;
  totalUsageCount: number;
  usageOverTime: UsageDataPoint[];
  avgEffectiveness: number;
  effectivenessDistribution: EffectivenessDistribution;
  impactMetrics: ImpactMetrics;
  adoptionBarriers: AdoptionBarrier[];
  adoptionRecommendations: string[];
  generatedAt: Timestamp;
  periodStartDate: Timestamp;
  periodEndDate: Timestamp;
}
