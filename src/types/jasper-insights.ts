/**
 * Jasper Insights — shared contract for the INSIGHTS_ANALYST specialist.
 *
 * The INSIGHTS_ANALYST receives a snapshot of the operator's last-7-days
 * platform activity (missions, social posts, leads, deals, calendar events,
 * content drafts, connected integrations) and returns two parallel arrays:
 *
 *   1. setupItems — concrete onboarding gaps the operator hasn't closed yet.
 *      Each carries a stable `key` so the operator's "stop reminding me"
 *      preference can persist across regenerations.
 *
 *   2. insights — proactive, signal-driven recommendations. Each insight
 *      carries a `suggestedMissionPrompt` that, if the operator accepts,
 *      becomes the verbatim text routed to Jasper as a new mission.
 *
 * The specialist NEVER does the work itself — it only generates
 * recommendations. The operator decides whether to act.
 */

export interface SetupItem {
  /** Stable identifier (e.g. 'connect-microsoft', 'verify-twilio-tfn'). NOT random — the operator's "stop reminding me" preference is keyed off this. */
  key: string;
  title: string;
  description: string;
  /** Button label, e.g. "Connect Microsoft", "Verify number". */
  ctaLabel: string;
  /** Optional internal link (e.g. /settings/integrations/microsoft) where the operator goes to do it. */
  ctaHref?: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface Insight {
  /** Stable identifier for this insight occurrence (server-overwritten if the model returns junk). */
  id: string;
  title: string;
  summary: string;
  urgency: 'high' | 'medium' | 'low';
  category: 'pipeline' | 'content' | 'social' | 'engagement' | 'platform_health';
  /** Concrete data signals the analyst observed that triggered this insight. */
  signalsSeen: string[];
  /** The exact text the operator would send to Jasper if they accept this insight. */
  suggestedMissionPrompt: string;
  /** ISO 8601 timestamp the insight was generated (server-overwritten). */
  generatedAt: string;
  /** ISO 8601 timestamp after which the insight is considered stale. */
  expiresAt: string;
  /** ISO 8601 timestamp when the insight was dismissed by the operator. Null/undefined means active. Persisted by the dismiss route, not the LLM. */
  dismissedAt?: string | null;
  /** Mission id this insight was converted into when the operator clicked "Run as mission". Persisted by the run-as-mission route. */
  convertedToMissionId?: string | null;
}

export interface InsightsAnalystResult {
  setupItems: SetupItem[];
  insights: Insight[];
}

/**
 * Public entry point implemented by `src/lib/agents/intelligence/insights-analyst/specialist.ts`.
 *
 * @param snapshot opaque platform-activity object — the analyst expects a
 * shape covering the last 7 days of missions, social posts, leads, deals,
 * calendar events, content drafts, and connected integrations. Typed as
 * `unknown` here so the consumer side stays loose; the specialist
 * JSON-stringifies it and lets the LLM read whatever shape is provided.
 */
export type RunInsightsAnalyst = (snapshot: unknown) => Promise<InsightsAnalystResult>;

// ===========================================================================
// Back-compat aliases — the dashboard components were authored against
// `JasperInsight` / `JasperSetupItem` names.  The canonical names are
// `Insight` / `SetupItem`; these aliases keep the existing UI working
// without a rename sweep.
// ===========================================================================

export type JasperInsight = Insight;
export type JasperSetupItem = SetupItem;
export type JasperInsightsResult = InsightsAnalystResult;
