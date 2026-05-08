/**
 * Type contracts for BUDGET_STRATEGIST.
 *
 * Marketing-budget allocation specialist that reads operator-provided
 * spend + conversion data and emits per-platform recommendations
 * (increase / decrease / hold / pause) with plain-English rationale.
 *
 * NOT to be confused with PRICING_STRATEGIST (that's a Stripe dispatcher).
 *
 * Per Standing Rule #1: every LLM call this specialist makes uses its
 * Golden Master's systemPrompt (Brand DNA baked in at seed time) verbatim.
 */

// ============================================================================
// INPUT — what the manager / dashboard sends to the specialist
// ============================================================================

/**
 * Conversion source determines how much weight the strategist gives the
 * platform's reported numbers. Order of trust:
 *   crm                     — UTM-attributed CRM source field (most truth)
 *   ga4                     — UTM-tagged links via GA4 (fallback)
 *   platform_self_reported  — what the ad platform itself claims (sanity check only)
 */
export type ConversionSource = 'crm' | 'ga4' | 'platform_self_reported';

export interface PlatformSpendSnapshot {
  /** Stable platform key — e.g. 'google_ads', 'meta_ads', 'google_lsa', 'seo_retainer'. */
  platform: string;
  /** Display name for the LLM's plain-English output, e.g. 'Google Ads'. */
  displayName: string;
  /** Total $ spent on this platform during `windowDays`. */
  currentSpendUsd: number;
  /** Number of attributed conversions in the same window. */
  conversions: number;
  /** Where the conversion count came from. Lower-trust sources get less weight. */
  conversionSource: ConversionSource;
  /** Optional: the platform's self-reported conversion count for sanity check. */
  platformReportedConversions?: number;
  /** True if we cannot programmatically change this platform's budget (manual retainer, LSA top-up, etc.). */
  requiresManualBudgetChange?: boolean;
}

export interface AnalyzeBudgetRequest {
  action: 'analyze_budget';
  /** The total marketing budget the operator wants allocated for the next window. */
  totalBudgetUsd: number;
  /** Number of days the spend snapshot covers (and roughly the window the recommendation applies to). */
  windowDays: number;
  /** Per-platform spend + conversion data. */
  platforms: PlatformSpendSnapshot[];
  /** Optional: the prior allocation, so the LLM can compare against itself over time. */
  previousAllocation?: Record<string, number>;
}

// ============================================================================
// OUTPUT — what the specialist returns to the manager
// ============================================================================

export type RecommendationActionType = 'increase' | 'decrease' | 'hold' | 'pause';
export type RecommendationConfidence = 'low' | 'medium' | 'high';

export interface BudgetRecommendation {
  platform: string;
  displayName: string;
  currentSpendUsd: number;
  recommendedSpendUsd: number;
  /** Positive = more spend, negative = less spend. */
  deltaUsd: number;
  actionType: RecommendationActionType;
  /** Plain-English explanation the operator can read and act on. */
  rationale: string;
  confidence: RecommendationConfidence;
  /** True when the platform's API can't accept a budget change — recommendation flows out as a Mission Control task instead of an auto-apply. */
  requiresManualMissionTask: boolean;
  /** Operator-readable mission prompt to copy into Jasper if requiresManualMissionTask=true. */
  manualMissionPrompt?: string;
}

export interface BudgetStrategistResult {
  /** One recommendation per platform. Order = priority (highest-impact first). */
  recommendations: BudgetRecommendation[];
  /** Cross-platform summary the operator reads first. */
  summaryRationale: string;
  /**
   * True when the data isn't dense enough to make confident recommendations
   * (e.g., < 10 attributed conversions across all platforms). When true, the
   * operator should treat the recommendations as exploratory only and the
   * dashboard widget should render an "insufficient data" callout.
   */
  insufficientData: boolean;
  insufficientDataMessage?: string;
}
