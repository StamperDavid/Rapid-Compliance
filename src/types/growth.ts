/**
 * Growth Command Center — Type Definitions
 *
 * Types for competitor monitoring, keyword tracking, strategy generation,
 * AI search visibility, and the growth activity feed.
 */

// ============================================================================
// COMPETITOR MONITORING
// ============================================================================

export interface CompetitorProfile {
  id: string;
  domain: string;
  name: string;
  /** URL of homepage */
  url: string;
  /** One-liner from meta or scraped tagline */
  tagline: string;
  /** Detected niche/industry */
  niche: string;
  /** Domain authority (from DataForSEO) */
  domainAuthority: number;
  /** Estimated monthly organic traffic */
  organicTraffic: number;
  /** Estimated number of keywords ranked */
  organicKeywords: number;
  /** Total backlink count */
  backlinks: number;
  /** Referring domain count */
  referringDomains: number;
  /** Detected tech stack */
  techStack: string[];
  /** Key competitive strengths */
  strengths: string[];
  /** Key competitive weaknesses */
  weaknesses: string[];
  /** Positioning statement inferred from site */
  positioning: string;
  /** When this competitor was first added */
  addedAt: string;
  /** Last time a full analysis was run */
  lastAnalyzedAt: string;
  /** Who added this competitor */
  addedBy: string;
  /** Is currently active for monitoring */
  isActive: boolean;
}

export interface CompetitorSnapshot {
  id: string;
  competitorId: string;
  domain: string;
  domainAuthority: number;
  organicTraffic: number;
  organicKeywords: number;
  backlinks: number;
  referringDomains: number;
  /** ISO timestamp */
  capturedAt: string;
}

export interface CompetitorSnapshotRef {
  competitorId: string;
  snapshotId: string;
  capturedAt: string;
}

// ============================================================================
// KEYWORD TRACKING
// ============================================================================

export interface KeywordTrackingEntry {
  id: string;
  keyword: string;
  /** Our domain's current SERP position (null if not ranking) */
  currentPosition: number | null;
  /** Previous check's position */
  previousPosition: number | null;
  /** Change since last check (positive = improved) */
  positionChange: number | null;
  /** Monthly search volume */
  searchVolume: number;
  /** Cost per click (USD) */
  cpc: number;
  /** Keyword difficulty or competition level */
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Competitor positions for this keyword */
  competitorPositions: CompetitorKeywordPosition[];
  /** History of our position over time */
  rankingHistory: KeywordRanking[];
  /** ISO timestamp of last check */
  lastCheckedAt: string;
  /** When this keyword was added */
  addedAt: string;
  /** Who added it */
  addedBy: string;
  /** Tags for grouping */
  tags: string[];
  /** Is actively tracked */
  isActive: boolean;
}

export interface KeywordRanking {
  position: number | null;
  checkedAt: string;
}

export interface CompetitorKeywordPosition {
  competitorId: string;
  domain: string;
  name: string;
  position: number | null;
  url: string;
}

// ============================================================================
// STRATEGY GENERATION
// ============================================================================

export type StrategyTier = 'aggressive' | 'competitive' | 'scrappy';

export interface GrowthStrategy {
  id: string;
  /** ISO timestamp of generation */
  generatedAt: string;
  /** Who requested it */
  requestedBy: string;
  /** Current status */
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'expired';
  /** Which tier was approved (null until approved) */
  approvedTier: StrategyTier | null;
  /** Approval details */
  approval: StrategyApproval | null;
  /** Budget constraints provided */
  budgetConstraints: BudgetConstraints;
  /** The three strategy tiers */
  tiers: Record<StrategyTier, StrategyTierDetail>;
  /** Data snapshot used to generate the strategy */
  dataContext: {
    competitorCount: number;
    trackedKeywords: number;
    avgDomainAuthority: number;
    topCompetitors: string[];
    topKeywordGaps: string[];
  };
}

export interface BudgetConstraints {
  /** Maximum monthly budget (USD) */
  maxMonthlyBudget: number;
  /** Minimum acceptable budget (USD) */
  minMonthlyBudget: number;
  /** Preferred channels */
  preferredChannels: string[];
  /** Business goals: growth, retention, awareness */
  primaryGoal: 'growth' | 'retention' | 'awareness' | 'revenue';
  /** Industry */
  industry: string;
}

export interface StrategyTierDetail {
  tier: StrategyTier;
  /** Human-friendly tier name */
  label: string;
  /** Monthly budget for this tier (USD) */
  monthlyBudget: number;
  /** Expected ROI multiplier (e.g. 3.5x) */
  expectedROI: number;
  /** Time to see results */
  timeToResults: string;
  /** Overall description */
  summary: string;
  /** Ordered list of actions */
  actions: StrategyAction[];
  /** Key metrics to track */
  kpis: string[];
  /** Risks at this tier */
  risks: string[];
}

export interface StrategyAction {
  /** Action identifier */
  id: string;
  /** Category: seo, paid, content, social, email, partnerships */
  channel: string;
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** Budget allocation for this action (USD/month) */
  budgetAllocation: number;
  /** Priority: 1=highest */
  priority: number;
  /** Expected impact: high, medium, low */
  impact: 'high' | 'medium' | 'low';
  /** Effort to implement: high, medium, low */
  effort: 'high' | 'medium' | 'low';
  /** Cheaper alternative for scrappy mode */
  cheaperAlternative: CheaperAlternative | null;
}

export interface CheaperAlternative {
  title: string;
  description: string;
  estimatedCost: number;
  tradeoffs: string[];
}

export interface StrategyApproval {
  approvedBy: string;
  approvedAt: string;
  tier: StrategyTier;
  notes: string;
  /** Jasper approval ID if routed through command authority */
  jasperApprovalId: string | null;
}

// ============================================================================
// AI SEARCH VISIBILITY
// ============================================================================

export interface AIVisibilityCheck {
  id: string;
  /** ISO timestamp */
  checkedAt: string;
  /** Our domain */
  targetDomain: string;
  /** Overall visibility score 0-100 */
  visibilityScore: number;
  /** Number of queries where we appear in AI overviews */
  aiOverviewMentions: number;
  /** Total queries checked */
  totalQueriesChecked: number;
  /** Individual query results */
  queryResults: AIVisibilityQueryResult[];
  /** Competitor mentions across all queries */
  competitorMentions: AICompetitorMention[];
  /** Who initiated this check */
  initiatedBy: string;
}

export interface AIVisibilityQueryResult {
  query: string;
  /** Whether our brand appears in AI overview */
  mentioned: boolean;
  /** Our position in organic results */
  organicPosition: number | null;
  /** Whether AI overview exists for this query */
  hasAIOverview: boolean;
  /** Snippet of the AI overview mentioning us */
  mentionSnippet: string | null;
  /** Competitors mentioned in AI overview */
  competitorsMentioned: string[];
}

export interface AICompetitorMention {
  domain: string;
  name: string;
  /** How many queries they appeared in AI overviews */
  mentionCount: number;
  /** Percentage of queries where they appear */
  mentionRate: number;
}

// ============================================================================
// ACTIVITY FEED
// ============================================================================

export type GrowthActivityType =
  | 'competitor_added'
  | 'competitor_analyzed'
  | 'competitor_removed'
  | 'keyword_added'
  | 'keyword_ranking_changed'
  | 'keyword_removed'
  | 'strategy_generated'
  | 'strategy_approved'
  | 'strategy_rejected'
  | 'ai_visibility_checked'
  | 'competitor_discovered'
  | 'cron_keyword_check'
  | 'cron_competitor_scan'
  | 'cron_ai_visibility';

export interface GrowthActivityEvent {
  id: string;
  type: GrowthActivityType;
  /** Human-readable message */
  message: string;
  /** ISO timestamp */
  timestamp: string;
  /** Who/what triggered it */
  actor: string;
  /** Related entity IDs */
  metadata: Record<string, unknown>;
}
