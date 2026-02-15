/**
 * Conversation Intelligence - Type Definitions
 * 
 * AI-powered analysis of sales calls and meetings.
 * Provides sentiment analysis, coaching insights, competitor detection,
 * talk ratio analysis, and follow-up recommendations.
 * 
 * CAPABILITIES:
 * - Transcript analysis with AI
 * - Sentiment and tone detection
 * - Competitor mention tracking
 * - Talk ratio calculation (rep vs prospect)
 * - Key topics and objections extraction
 * - Coaching insights and recommendations
 * - Follow-up action suggestions
 * 
 * @module lib/conversation
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Conversation (call or meeting)
 */
export interface Conversation {
  id: string;

  // Metadata
  type: ConversationType;
  title: string;
  description?: string;
  
  // Participants
  participants: Participant[];
  repId: string; // Primary sales rep
  
  // Timing
  startedAt: Date | Timestamp;
  endedAt?: Date | Timestamp;
  duration: number; // seconds
  
  // Content
  transcript?: string;
  recordingUrl?: string;
  
  // Context
  dealId?: string;
  leadId?: string;
  accountId?: string;
  
  // Status
  status: ConversationStatus;
  
  // Timestamps
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  
  // Metadata
  source?: string; // 'zoom', 'teams', 'phone', 'manual'
  externalId?: string;
}

/**
 * Conversation type
 */
export type ConversationType = 
  | 'discovery_call'
  | 'demo'
  | 'follow_up'
  | 'negotiation'
  | 'close_call'
  | 'check_in'
  | 'internal_meeting'
  | 'other';

/**
 * Conversation status
 */
export type ConversationStatus = 
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/**
 * Participant in conversation
 */
export interface Participant {
  id: string;
  name: string;
  email?: string;
  role: ParticipantRole;
  company?: string;
  title?: string;
}

/**
 * Participant role
 */
export type ParticipantRole = 
  | 'sales_rep'
  | 'sales_manager'
  | 'sales_engineer'
  | 'prospect'
  | 'decision_maker'
  | 'influencer'
  | 'champion'
  | 'blocker'
  | 'other';

// ============================================================================
// ANALYSIS TYPES
// ============================================================================

/**
 * Complete conversation analysis
 */
export interface ConversationAnalysis {
  conversationId: string;

  // Core Analysis
  sentiment: SentimentAnalysis;
  talkRatio: TalkRatioAnalysis;
  topics: TopicAnalysis;
  objections: ObjectionAnalysis[];
  competitors: CompetitorMention[];
  
  // Insights
  keyMoments: KeyMoment[];
  coachingInsights: CoachingInsight[];
  followUpActions: FollowUpAction[];
  
  // Scores
  scores: ConversationScores;
  
  // Quality
  qualityIndicators: QualityIndicator[];
  redFlags: RedFlag[];
  positiveSignals: PositiveSignal[];
  
  // Summary
  summary: string;
  highlights: string[];
  
  // Metadata
  confidence: number; // 0-100
  analyzedAt: Date;
  analysisVersion: string;
  aiModel: string;
  tokensUsed: number;
  processingTime: number; // ms
}

/**
 * Sentiment analysis
 */
export interface SentimentAnalysis {
  overall: SentimentScore;
  byParticipant: Record<string, SentimentScore>;
  timeline: SentimentTimePoint[];
  trendDirection: 'improving' | 'declining' | 'stable';
  criticalMoments: CriticalMoment[];
}

/**
 * Sentiment score
 */
export interface SentimentScore {
  polarity: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  score: number; // -1 to 1
  confidence: number; // 0-100
  tone: string[]; // ['enthusiastic', 'professional', 'hesitant', etc.]
}

/**
 * Sentiment at a point in time
 */
export interface SentimentTimePoint {
  timestamp: number; // seconds from start
  sentiment: number; // -1 to 1
  speaker: string;
  context?: string;
}

/**
 * Critical moment (sentiment spike/drop)
 */
export interface CriticalMoment {
  timestamp: number;
  type: 'spike' | 'drop';
  magnitude: number; // Change in sentiment
  speaker: string;
  quote: string;
  context: string;
  impact: 'high' | 'medium' | 'low';
}

/**
 * Talk ratio analysis
 */
export interface TalkRatioAnalysis {
  overall: TalkRatio;
  byParticipant: Record<string, ParticipantTalkStats>;
  repTalkTime: number; // seconds
  prospectTalkTime: number; // seconds
  repPercentage: number; // 0-100
  prospectPercentage: number; // 0-100
  assessment: TalkRatioAssessment;
  recommendation: string;
}

/**
 * Talk ratio for a category
 */
export interface TalkRatio {
  speakerTime: number; // seconds
  listenerTime: number; // seconds
  ratio: number; // speaker:listener (e.g., 0.43 = 43:57)
  isIdeal: boolean;
}

/**
 * Individual participant talk stats
 */
export interface ParticipantTalkStats {
  totalTime: number; // seconds
  percentage: number; // 0-100
  turnCount: number;
  avgTurnDuration: number; // seconds
  longestTurn: number; // seconds
  interruptionCount: number;
  questionCount: number;
}

/**
 * Talk ratio assessment
 */
export type TalkRatioAssessment = 
  | 'ideal' // 30-40% rep, 60-70% prospect
  | 'rep_dominating' // >50% rep
  | 'prospect_dominating' // <20% rep
  | 'balanced' // 40-50% rep
  | 'needs_improvement';

/**
 * Topic analysis
 */
export interface TopicAnalysis {
  mainTopics: Topic[];
  coverageMap: Record<string, number>; // topic -> duration (seconds)
  uncoveredTopics: string[]; // Expected but not discussed
  timeAllocation: TopicTimeAllocation[];
}

/**
 * Individual topic
 */
export interface Topic {
  name: string;
  category: TopicCategory;
  mentions: number;
  duration: number; // seconds
  sentiment: number; // -1 to 1
  importance: 'critical' | 'high' | 'medium' | 'low';
  quotes: string[];
}

/**
 * Topic category
 */
export type TopicCategory = 
  | 'pain_points'
  | 'business_value'
  | 'technical_requirements'
  | 'pricing'
  | 'timeline'
  | 'competition'
  | 'stakeholders'
  | 'decision_process'
  | 'integration'
  | 'support'
  | 'other';

/**
 * Topic time allocation
 */
export interface TopicTimeAllocation {
  topic: string;
  duration: number; // seconds
  percentage: number; // 0-100
  isAppropriate: boolean;
  recommendation?: string;
}

/**
 * Objection raised during conversation
 */
export interface ObjectionAnalysis {
  id: string;
  type: ObjectionType;
  objection: string;
  quote: string;
  timestamp: number; // seconds from start
  speaker: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  wasAddressed: boolean;
  repResponse?: string;
  responseQuality?: 'excellent' | 'good' | 'poor' | 'none';
  recommendedResponse?: string;
}

/**
 * Objection type
 */
export type ObjectionType = 
  | 'pricing'
  | 'timing'
  | 'authority'
  | 'competition'
  | 'technical'
  | 'trust'
  | 'need'
  | 'urgency'
  | 'other';

/**
 * Competitor mention
 */
export interface CompetitorMention {
  competitor: string;
  mentions: number;
  context: string[];
  sentiment: number; // -1 to 1
  concernLevel: 'high' | 'medium' | 'low';
  recommendedResponse: string;
  battlecardId?: string;
}

/**
 * Key moment in conversation
 */
export interface KeyMoment {
  id: string;
  timestamp: number; // seconds from start
  type: KeyMomentType;
  title: string;
  description: string;
  speaker: string;
  quote: string;
  impact: 'positive' | 'negative' | 'neutral';
  significance: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Key moment type
 */
export type KeyMomentType = 
  | 'buying_signal'
  | 'objection'
  | 'commitment'
  | 'concern'
  | 'decision_maker_engagement'
  | 'competitor_mention'
  | 'timeline_discussed'
  | 'budget_revealed'
  | 'next_steps_agreed'
  | 'red_flag'
  | 'other';

/**
 * Coaching insight
 */
export interface CoachingInsight {
  id: string;
  category: CoachingCategory;
  priority: 'critical' | 'high' | 'medium' | 'low';
  insight: string;
  whatWentWell?: string;
  whatToImprove: string;
  specificExample: string;
  recommendedAction: string;
  skillArea: string;
  impact: number; // 0-100
}

/**
 * Coaching category
 */
export type CoachingCategory = 
  | 'discovery'
  | 'listening'
  | 'objection_handling'
  | 'value_articulation'
  | 'questioning'
  | 'closing'
  | 'rapport_building'
  | 'time_management'
  | 'technical_knowledge'
  | 'competitor_positioning'
  | 'next_steps'
  | 'other';

/**
 * Follow-up action
 */
export interface FollowUpAction {
  id: string;
  type: FollowUpActionType;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reasoning: string;
  deadline: string; // relative, e.g., "within 24 hours"
  assignee?: string;
  estimatedEffort: number; // hours
}

/**
 * Follow-up action type
 */
export type FollowUpActionType = 
  | 'send_follow_up_email'
  | 'schedule_meeting'
  | 'send_proposal'
  | 'share_resources'
  | 'introduce_stakeholder'
  | 'address_concern'
  | 'provide_pricing'
  | 'schedule_demo'
  | 'send_case_study'
  | 'internal_alignment'
  | 'other';

/**
 * Conversation scores
 */
export interface ConversationScores {
  overall: number; // 0-100
  discovery: number; // 0-100
  valueArticulation: number; // 0-100
  objectionHandling: number; // 0-100
  closing: number; // 0-100
  rapport: number; // 0-100
  engagement: number; // 0-100
}

/**
 * Quality indicator
 */
export interface QualityIndicator {
  type: QualityIndicatorType;
  status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  score: number; // 0-100
  description: string;
  recommendation?: string;
}

/**
 * Quality indicator type
 */
export type QualityIndicatorType = 
  | 'talk_ratio'
  | 'question_frequency'
  | 'discovery_depth'
  | 'next_steps_clarity'
  | 'stakeholder_engagement'
  | 'objection_handling'
  | 'time_management'
  | 'energy_level'
  | 'professionalism';

/**
 * Red flag (warning sign)
 */
export interface RedFlag {
  type: RedFlagType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  quote?: string;
  timestamp?: number;
  recommendation: string;
}

/**
 * Red flag type
 */
export type RedFlagType = 
  | 'no_next_steps'
  | 'no_decision_maker'
  | 'budget_concerns'
  | 'timeline_vague'
  | 'competitor_preference'
  | 'low_engagement'
  | 'multiple_objections'
  | 'ghosting_risk'
  | 'poor_fit'
  | 'unrealistic_expectations';

/**
 * Positive signal
 */
export interface PositiveSignal {
  type: PositiveSignalType;
  strength: 'strong' | 'moderate' | 'weak';
  description: string;
  quote?: string;
  timestamp?: number;
  impact: string;
}

/**
 * Positive signal type
 */
export type PositiveSignalType = 
  | 'buying_intent'
  | 'budget_confirmed'
  | 'timeline_committed'
  | 'decision_maker_engaged'
  | 'champion_identified'
  | 'competitor_dismissed'
  | 'urgency_expressed'
  | 'clear_pain_point'
  | 'value_acknowledged'
  | 'next_steps_confirmed';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request to analyze a conversation
 */
export interface AnalyzeConversationRequest {
  conversationId: string;

  // Optional context
  dealId?: string;
  leadId?: string;
  
  // Options
  includeCoaching?: boolean;
  includeFollowUps?: boolean;
  customContext?: string;
  
  // Force re-analysis
  forceRefresh?: boolean;
}

/**
 * Request to analyze raw transcript
 */
export interface AnalyzeTranscriptRequest {
  // Conversation data
  transcript: string;
  conversationType: ConversationType;
  participants: Participant[];
  repId: string;
  duration: number;
  
  // Optional context
  dealId?: string;
  leadId?: string;
  title?: string;
  
  // Options
  includeCoaching?: boolean;
  includeFollowUps?: boolean;
  customContext?: string;
}

/**
 * Batch analysis request
 */
export interface BatchAnalysisRequest {
  conversationIds: string[];
  includeCoaching?: boolean;
  includeFollowUps?: boolean;
}

/**
 * Batch analysis response
 */
export interface BatchAnalysisResponse {
  analyses: Map<string, ConversationAnalysis>;
  summary: AnalysisSummary;
  analyzedAt: Date;
}

/**
 * Analysis summary (for batch or team)
 */
export interface AnalysisSummary {
  totalConversations: number;
  avgOverallScore: number;
  avgSentiment: number;
  avgTalkRatio: number;
  
  // Aggregates
  topCoachingAreas: CoachingArea[];
  commonObjections: ObjectionSummary[];
  topCompetitors: CompetitorSummary[];
  
  // Trends
  sentimentTrend: 'improving' | 'declining' | 'stable';
  scoreTrend: 'improving' | 'declining' | 'stable';
}

/**
 * Coaching area summary
 */
export interface CoachingArea {
  area: string;
  frequency: number;
  avgImpact: number;
  recommendation: string;
}

/**
 * Objection summary
 */
export interface ObjectionSummary {
  type: ObjectionType;
  frequency: number;
  avgSeverity: number;
  successRate: number; // % addressed successfully
  bestResponse: string;
}

/**
 * Competitor summary
 */
export interface CompetitorSummary {
  competitor: string;
  mentions: number;
  avgSentiment: number;
  winRate: number; // When this competitor is mentioned
  positioning: string;
}

// ============================================================================
// ENGINE CONFIGURATION
// ============================================================================

/**
 * Conversation intelligence engine configuration
 */
export interface ConversationEngineConfig {
  // AI Settings
  aiModel: string;
  temperature: number;
  maxTokens: number;
  
  // Analysis Settings
  minTranscriptLength: number; // characters
  idealTalkRatioMin: number; // 0-1
  idealTalkRatioMax: number; // 0-1
  
  // Detection Settings
  minConfidence: number; // 0-100
  enableSentimentAnalysis: boolean;
  enableObjectionDetection: boolean;
  enableCompetitorTracking: boolean;
  
  // Coaching Settings
  maxCoachingInsights: number;
  maxFollowUpActions: number;
  coachingPriorityThreshold: 'critical' | 'high' | 'medium' | 'low';
  
  // Performance
  cacheTTL: number; // seconds
  enableCaching: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONVERSATION_CONFIG: ConversationEngineConfig = {
  aiModel: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4000,
  
  minTranscriptLength: 100,
  idealTalkRatioMin: 0.3, // 30% rep
  idealTalkRatioMax: 0.4, // 40% rep
  
  minConfidence: 60,
  enableSentimentAnalysis: true,
  enableObjectionDetection: true,
  enableCompetitorTracking: true,
  
  maxCoachingInsights: 5,
  maxFollowUpActions: 5,
  coachingPriorityThreshold: 'medium',
  
  cacheTTL: 3600, // 1 hour
  enableCaching: true,
};

// ============================================================================
// FIRESTORE SCHEMA
// ============================================================================

/**
 * Firestore conversation document
 */
export interface ConversationDocument {
  id: string;
  type: ConversationType;
  title: string;
  description?: string;
  participants: Participant[];
  repId: string;
  startedAt: Timestamp;
  endedAt?: Timestamp;
  duration: number;
  transcript?: string;
  recordingUrl?: string;
  dealId?: string;
  leadId?: string;
  accountId?: string;
  status: ConversationStatus;
  source?: string;
  externalId?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Firestore conversation analysis document
 */
export interface ConversationAnalysisDocument {
  conversationId: string;
  sentiment: SentimentAnalysis;
  talkRatio: TalkRatioAnalysis;
  topics: TopicAnalysis;
  objections: ObjectionAnalysis[];
  competitors: CompetitorMention[];
  keyMoments: KeyMoment[];
  coachingInsights: CoachingInsight[];
  followUpActions: FollowUpAction[];
  scores: ConversationScores;
  qualityIndicators: QualityIndicator[];
  redFlags: RedFlag[];
  positiveSignals: PositiveSignal[];
  summary: string;
  highlights: string[];
  confidence: number;
  analyzedAt: Timestamp;
  analysisVersion: string;
  aiModel: string;
  tokensUsed: number;
  processingTime: number;
}
