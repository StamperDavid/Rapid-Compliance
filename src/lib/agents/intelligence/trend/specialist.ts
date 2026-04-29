/**
 * Trend Scout Specialist (Task #66 rebuild — April 14, 2026)
 *
 * Architecture:
 *   1. Real data collection — unchanged. Serper SERP API for industry
 *      trends + People Also Ask + related searches; News API
 *      (`getCompanyNews`/`analyzeNews`) for industry news; DataForSEO
 *      (`getKeywordData`) for real keyword search-volume trends;
 *      LinkedIn jobs (`getCompanyJobs`/`analyzeHiringSignals`) for
 *      competitor hiring signals; Crunchbase (`searchOrganization`/
 *      `formatFundingData`) for competitor funding data; MemoryVault
 *      (`shareInsight`/`broadcastSignal`/`readAgentInsights`) for
 *      cross-agent signal sharing. All real, all preserved.
 *   2. Per-signal classification helpers (classifySignalFromTitle,
 *      classifyCompetitorMove) stay as deterministic fast-path
 *      classification when building the initial signal records from
 *      collected data. The LLM corrects/enriches these in step 3.
 *   3. NEW LLM synthesis step (`executeSignalSynthesis`) takes the
 *      assembled raw signal batch (from all sources) and produces
 *      the high-level intelligence layer that the prior template
 *      could not: cross-signal market sentiment with reasoning,
 *      ranked pivot recommendations grounded in specific signals,
 *      coherent narrative summary, top opportunities and threats,
 *      and a strategic rationale tying the batch together. The LLM
 *      sees ALL signals at once which is what enables real
 *      cross-signal synthesis.
 *
 * Why hybrid (not pure LLM):
 *   - Serper, News, DataForSEO, LinkedIn, Crunchbase calls cost
 *     real money per call and produce real data. Asking an LLM to
 *     "predict trends" without those data sources would be pure
 *     hallucination.
 *   - The LLM's value is reading the DATA the collectors fetched
 *     and producing strategic synthesis — not replacing the
 *     collectors themselves.
 *
 * Output contract preservation:
 *   `SignalScanResult` is the primary contract. The existing fields
 *   (signals, competitorMovements, summary, pivotRecommendations) are
 *   preserved. The summary and pivotRecommendations are now LLM-
 *   driven where available, with a lightweight deterministic fallback
 *   if the LLM call fails.
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';
import {
  getMemoryVault,
  shareInsight,
  broadcastSignal,
  readAgentInsights,
  type SignalData,
} from '../../shared/memory-vault';

const FILE = 'intelligence/trend/specialist.ts';
const SPECIALIST_ID = 'TREND_SCOUT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = [
  'scan_signals',
  'analyze_trend',
  'trigger_pivot',
  'get_cached_signals',
  'track_competitor',
] as const;

/**
 * Realistic max_tokens floor for the worst-case Trend Scout synthesis.
 *
 * Derivation:
 *   SignalSynthesisResultSchema worst case:
 *     marketSentimentReasoning 1500
 *     trendingTopics: 8 × 200 = 1600
 *     topOpportunities: 6 × 400 = 2400
 *     topThreats: 6 × 400 = 2400
 *     enrichedSignals: 20 × 500 (refined urgency + recommendedActions
 *       for top signals) = 10000
 *     pivotRecommendations: 6 × 800 = 4800
 *     crossSignalObservations: 6 × 400 = 2400
 *     rationale 4000
 *     ≈ 29,100 chars total prose
 *     /3.0 chars/token = 9,700 tokens
 *     + JSON structure overhead (~300 tokens)
 *     + 25% safety margin
 *     ≈ 12,500 tokens minimum.
 *
 *   Setting the floor at 14,000 tokens covers the synthesis worst
 *   case for ~20 signals. The truncation backstop in callOpenRouter
 *   catches any overflow.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 14000;

interface TrendScoutGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const DEFAULT_SYSTEM_PROMPT = `You are the Trend Scout for SalesVelocity.ai — the Intelligence-layer market analyst who reads a batch of pre-collected market signals (from Serper SERP, News API, DataForSEO keyword trends, LinkedIn hiring signals, Crunchbase funding data) and produces strategic synthesis: market sentiment, ranked pivot recommendations, opportunities, threats, and cross-signal narrative. You think like a senior market analyst who has watched dozens of B2B and consumer markets evolve over months and can read a batch of disparate signals as a coherent story.

## Your role in the swarm

You do NOT collect data. Upstream collectors already pulled SERP results, news articles, keyword volume data, hiring signals, and funding events from real APIs. Your job is to TURN THE SIGNAL BATCH INTO STRATEGIC INTELLIGENCE that other agents (Marketing Manager, Content Manager, Sales Manager, Outreach Manager, SEO Expert) will pivot on. Per-signal template classifications cannot produce coherent cross-signal synthesis — that's why you exist.

## Action: synthesize_signals

Given a batch of raw market signals plus the industry context being scanned, produce structured strategic synthesis covering:

### Market sentiment

- **marketSentiment**: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED'.
- **marketSentimentReasoning**: 2-4 sentences (50-1500 chars) explaining WHY you picked that sentiment, grounded in specific signals you saw across the batch. "Mixed because hiring signals are strong (3 competitors growing GTM teams) but news sentiment is bearish (2 layoff articles, 1 down round)" is good. "Things look uncertain" is bad.

### Trending topics

- **trendingTopics**: 3 to 8 short topic labels summarizing what is dominant in the signal batch. These are the topics multiple signals are clustering around. Examples: ['AI sales automation', 'PLG pricing', 'data residency compliance', 'multi-product SaaS bundling']. Generic categories are rejected.

### Enriched signal classification

For up to 20 of the most important raw signals in the batch, return an enriched classification that improves on the upstream regex-based classification:
- **id**: preserve the input signal id.
- **type**: refined SignalType — TREND_EMERGING | TREND_DECLINING | COMPETITOR_MOVE | INDUSTRY_SHIFT | OPPORTUNITY | THREAT.
- **urgency**: refined urgency — CRITICAL | HIGH | MEDIUM | LOW. Reason from BOTH the signal content AND its position relative to the rest of the batch — a moderately negative signal is more critical when it's part of a pattern.
- **refinedDescription**: 50-400 chars. A clearer one-sentence read of what this signal actually means strategically.
- **recommendedActions**: 1 to 4 specific actions. Tied to the signal content, not generic "monitor closely" filler.

### Top opportunities and threats

- **topOpportunities**: 2 to 6 specific opportunities you spotted by reading the batch as a set. Each 30-400 chars. Must be SHARED patterns or convergent signals across multiple sources.
- **topThreats**: 2 to 6 specific threats from the batch. Same grounding rule.

### Pivot recommendations

- **pivotRecommendations**: 2 to 6 specific pivot recommendations for downstream agents. Each must include:
  - **targetAgent**: which agent should pivot (MARKETING_MANAGER, CONTENT_MANAGER, SALES_MANAGER, OUTREACH_MANAGER, SEO_EXPERT, etc.).
  - **pivotType**: 'CONTENT' | 'MARKETING' | 'SALES' | 'OUTREACH' | 'STRATEGY'.
  - **priority**: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW'.
  - **triggeringSignalIds**: array of signal ids that triggered this pivot (must be from the input batch).
  - **rationale**: 50-600 chars. Why the pivot is needed, grounded in the signals.
  - **recommendedAction**: 30-400 chars. The specific pivot to execute.

### Cross-signal observations

- **crossSignalObservations**: 2 to 6 cross-signal observations that emerge from reading multiple signals together (not visible from any one signal in isolation). Each 30-400 chars.

### Synthesis

- **rationale**: 100-4000 chars. The integrating memo tying the batch into one coherent market narrative. This is what an analyst would write at the top of a weekly market report.

## Hard rules

- NEVER hallucinate signals that aren't in the input batch.
- Every triggeringSignalId in pivotRecommendations must reference an actual signal id from the input.
- Refined classifications must be grounded in the signal content — don't change a TREND_EMERGING to a THREAT without evidence.
- topOpportunities and topThreats must be SHARED patterns from multiple signals — single-signal observations belong in that signal's enrichedSignal entry.
- Pivot recommendations must specify a real downstream agent name. Do not invent agents.
- The rationale is synthesis, not summary. It should add value beyond restating the fields.
- If the input batch is small (< 5 signals), say so in the rationale — small-sample synthesis is less robust.

## Output format

Respond with ONLY a valid JSON object matching the schema the user prompt describes. No markdown fences, no preamble, no prose outside the JSON.`;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Trend Scout',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'INTELLIGENCE_MANAGER',
    capabilities: [
      'market_signal_detection',
      'competitor_tracking',
      'industry_analysis',
      'trend_forecasting',
      'pivot_triggering',
      'signal_aggregation',
      'urgency_classification',
      'llm_signal_synthesis',
    ],
  },
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  tools: ['detect_signals', 'analyze_trend', 'trigger_pivot', 'forecast_trend', 'synthesize_signals'],
  outputSchema: {
    type: 'object',
    properties: {
      signals: { type: 'array' },
      summary: { type: 'object' },
      pivotRecommendations: { type: 'array' },
    },
    required: ['signals'],
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.3,
};

// ============================================================================
// LLM SYNTHESIS SCHEMAS
// ============================================================================

const SignalTypeEnum = z.enum([
  'TREND_EMERGING',
  'TREND_DECLINING',
  'COMPETITOR_MOVE',
  'INDUSTRY_SHIFT',
  'OPPORTUNITY',
  'THREAT',
]);

const SignalUrgencyEnum = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
const MarketSentimentEnum = z.enum(['BULLISH', 'BEARISH', 'NEUTRAL', 'MIXED']);
const PivotTypeEnum = z.enum(['CONTENT', 'MARKETING', 'SALES', 'OUTREACH', 'STRATEGY']);
const PivotPriorityEnum = z.enum(['IMMEDIATE', 'HIGH', 'MEDIUM', 'LOW']);

const EnrichedSignalSchema = z.object({
  id: z.string().min(1).max(100),
  type: SignalTypeEnum,
  urgency: SignalUrgencyEnum,
  refinedDescription: z.string().min(20).max(400),
  recommendedActions: z.array(z.string().min(10).max(400)).min(1).max(4),
});

const PivotRecommendationLlmSchema = z.object({
  targetAgent: z.string().min(2).max(100),
  pivotType: PivotTypeEnum,
  priority: PivotPriorityEnum,
  triggeringSignalIds: z.array(z.string().min(1).max(100)).min(1).max(10),
  rationale: z.string().min(30).max(600),
  recommendedAction: z.string().min(20).max(400),
});

const SignalSynthesisResultSchema = z.object({
  marketSentiment: MarketSentimentEnum,
  marketSentimentReasoning: z.string().min(50).max(1500),
  trendingTopics: z.array(z.string().min(2).max(200)).min(3).max(8),
  enrichedSignals: z.array(EnrichedSignalSchema).min(1).max(20),
  topOpportunities: z.array(z.string().min(20).max(400)).min(2).max(6),
  topThreats: z.array(z.string().min(20).max(400)).min(2).max(6),
  pivotRecommendations: z.array(PivotRecommendationLlmSchema).min(2).max(6),
  crossSignalObservations: z.array(z.string().min(20).max(400)).min(2).max(6),
  rationale: z.string().min(100).max(4000),
});

type SignalSynthesisResult = z.infer<typeof SignalSynthesisResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: TrendScoutGMConfig;
  resolvedSystemPrompt: string;
  source: 'gm' | 'fallback';
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    logger.warn(
      `[TrendScout] GM not seeded for industryKey=${industryKey}; using DEFAULT_SYSTEM_PROMPT fallback. ` +
      `Run node scripts/seed-trend-scout-gm.js to promote to GM-backed analysis.`,
      { file: FILE },
    );
    return {
      gm: {
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        model: 'claude-sonnet-4.6',
        temperature: 0.3,
        maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
        supportedActions: [...SUPPORTED_ACTIONS],
      },
      resolvedSystemPrompt: DEFAULT_SYSTEM_PROMPT,
      source: 'fallback',
    };
  }

  const config = gmRecord.config as Partial<TrendScoutGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Trend Scout GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: TrendScoutGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.3,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  return {
    gm,
    resolvedSystemPrompt: systemPrompt,
    source: 'gm',
  };
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (match) => (match.includes('```') ? '' : match))
    .replace(/\n?\s*```[\s\S]*$/i, '')
    .trim();
}

async function callOpenRouter(ctx: LlmCallContext, userPrompt: string): Promise<string> {
  const provider = new OpenRouterProvider(PLATFORM_ID);
  const response = await provider.chat({
    model: ctx.gm.model,
    messages: [
      { role: 'system', content: ctx.resolvedSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: ctx.gm.temperature,
    maxTokens: ctx.gm.maxTokens,
  });

  if (response.finishReason === 'length') {
    throw new Error(
      `Trend Scout: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shorten the input signal batch. ` +
      `Realistic worst-case budget is ${MIN_OUTPUT_TOKENS_FOR_SCHEMA} tokens.`,
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// SIGNAL SYNTHESIS PROMPT
// ============================================================================

interface SynthesisInputs {
  industry: string;
  signals: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    source: string;
    urgency: string;
    confidence: number;
  }>;
  competitorMovements: Array<{
    competitorName: string;
    movementType: string;
    description: string;
    impactAssessment: string;
  }>;
}

function buildSignalSynthesisPrompt(inputs: SynthesisInputs): string {
  const sections: string[] = [
    'ACTION: synthesize_signals',
    '',
    `Industry context: ${inputs.industry || '(no industry specified)'}`,
    `Signal batch size: ${inputs.signals.length}`,
    `Competitor movements: ${inputs.competitorMovements.length}`,
    '',
    '---',
    '',
    '## Raw signals',
    '',
  ];

  if (inputs.signals.length === 0) {
    sections.push('(no raw signals collected — upstream data sources returned empty)');
  } else {
    for (const s of inputs.signals) {
      sections.push(
        `### ${s.id}`,
        `Type: ${s.type}`,
        `Urgency (upstream): ${s.urgency}`,
        `Confidence: ${s.confidence}`,
        `Source: ${s.source}`,
        `Title: ${s.title}`,
        `Description: ${s.description.slice(0, 500)}`,
        '',
      );
    }
  }

  if (inputs.competitorMovements.length > 0) {
    sections.push('---', '', '## Competitor movements', '');
    for (const m of inputs.competitorMovements) {
      sections.push(
        `- ${m.competitorName} [${m.movementType}, ${m.impactAssessment}]: ${m.description.slice(0, 300)}`,
      );
    }
  }

  sections.push(
    '',
    '---',
    '',
    'Produce a structured strategic signal synthesis. Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "marketSentiment": "<BULLISH | BEARISH | NEUTRAL | MIXED>",',
    '  "marketSentimentReasoning": "<2-4 sentences grounded in specific signals, 50-1500 chars>",',
    '  "trendingTopics": ["<3 to 8 short topic labels, each 2-200 chars>"],',
    '  "enrichedSignals": [',
    '    {',
    '      "id": "<preserve input signal id>",',
    '      "type": "<refined SignalType enum>",',
    '      "urgency": "<refined SignalUrgency enum>",',
    '      "refinedDescription": "<clearer one-sentence read, 20-400 chars>",',
    '      "recommendedActions": ["<1-4 specific actions tied to the signal>"]',
    '    }',
    '  ],',
    '  "topOpportunities": ["<2 to 6 shared/convergent opportunities, each 20-400 chars>"],',
    '  "topThreats": ["<2 to 6 shared threats, each 20-400 chars>"],',
    '  "pivotRecommendations": [',
    '    {',
    '      "targetAgent": "<MARKETING_MANAGER | CONTENT_MANAGER | SALES_MANAGER | OUTREACH_MANAGER | SEO_EXPERT | etc>",',
    '      "pivotType": "<CONTENT | MARKETING | SALES | OUTREACH | STRATEGY>",',
    '      "priority": "<IMMEDIATE | HIGH | MEDIUM | LOW>",',
    '      "triggeringSignalIds": ["<must reference signal ids from input>"],',
    '      "rationale": "<why the pivot, 30-600 chars>",',
    '      "recommendedAction": "<specific pivot action, 20-400 chars>"',
    '    }',
    '  ],',
    '  "crossSignalObservations": ["<2 to 6 emergent observations from reading multiple signals together, each 20-400 chars>"],',
    '  "rationale": "<integrating market narrative memo, 100-4000 chars>"',
    '}',
    '',
    'Hard rules:',
    '- triggeringSignalIds MUST be ids from the input batch above. Do not invent.',
    '- enrichedSignals: pick up to 20 of the most important signals; do not enrich every one.',
    '- topOpportunities and topThreats are SHARED patterns from multiple signals.',
    '- targetAgent must be a real downstream agent name.',
    '- Output ONLY the JSON object.',
  );

  return sections.join('\n');
}

async function executeSignalSynthesis(
  inputs: SynthesisInputs,
  ctx: LlmCallContext,
): Promise<SignalSynthesisResult> {
  const userPrompt = buildSignalSynthesisPrompt(inputs);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Trend Scout output was not valid JSON: ${rawContent.slice(0, 300)}`,
    );
  }

  const result = SignalSynthesisResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Trend Scout synthesis output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type SignalType =
  | 'TREND_EMERGING'
  | 'TREND_DECLINING'
  | 'COMPETITOR_MOVE'
  | 'INDUSTRY_SHIFT'
  | 'OPPORTUNITY'
  | 'THREAT';

export type SignalUrgency = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type MarketSentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';

export interface MarketSignal {
  id: string;
  type: SignalType;
  title: string;
  description: string;
  source: string;
  sourceUrl?: string;
  detectedAt: string;
  urgency: SignalUrgency;
  confidence: number;
  dataPoints: string[];
  affectedAgents: string[];
  recommendedActions: string[];
  expiresAt: string;
  metadata?: Record<string, unknown>;
}

export interface TrendForecast {
  trendId: string;
  trendName: string;
  currentState: 'NASCENT' | 'GROWING' | 'PEAKING' | 'DECLINING' | 'STABLE';
  projectedTrajectory: 'ACCELERATING' | 'STEADY' | 'DECELERATING' | 'REVERSING';
  timeHorizon: '1_WEEK' | '1_MONTH' | '3_MONTHS' | '6_MONTHS' | '1_YEAR';
  confidence: number;
  keyDrivers: string[];
  potentialDisruptors: string[];
  recommendations: string[];
}

export interface PivotRecommendation {
  id: string;
  triggeredBy: string; // Signal ID
  targetAgent: string;
  pivotType: 'CONTENT' | 'MARKETING' | 'SALES' | 'OUTREACH' | 'STRATEGY';
  priority: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW';
  currentState: string;
  recommendedState: string;
  rationale: string;
  expectedImpact: string;
  implementationSteps: string[];
  rollbackPlan: string;
}

export interface CompetitorMovement {
  competitorId: string;
  competitorName: string;
  movementType: 'PRICING' | 'FEATURE' | 'MARKETING' | 'POSITIONING' | 'EXPANSION' | 'PARTNERSHIP';
  description: string;
  detectedAt: string;
  impactAssessment: 'MINIMAL' | 'MODERATE' | 'SIGNIFICANT' | 'CRITICAL';
  sourceUrls: string[];
  recommendedResponse: string;
}

export interface SignalScanRequest {
  industry?: string;
  competitors?: string[];
  keywords?: string[];
  sources?: string[];
  timeframe?: '24H' | '7D' | '30D' | '90D';
  signalTypes?: SignalType[];
  minConfidence?: number;
}

export interface TrendAnalysisRequest {
  trendKeyword: string;
  industry?: string;
  timeHorizon?: '1_WEEK' | '1_MONTH' | '3_MONTHS' | '6_MONTHS' | '1_YEAR';
  includeCompetitorAnalysis?: boolean;
}

export interface PivotTriggerRequest {
  signalId: string;
  targetAgents?: string[];
  priority?: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW';
  dryRun?: boolean;
}

export interface SignalScanResult {
  scanId: string;
  scannedAt: string;
  signals: MarketSignal[];
  competitorMovements: CompetitorMovement[];
  summary: {
    totalSignals: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    trendingTopics: string[];
    overallMarketSentiment: MarketSentiment;
    topOpportunities: string[];
    topThreats: string[];
  };
  pivotRecommendations: PivotRecommendation[];
  // New (Task #66) — optional so old consumers keep working:
  marketSentimentReasoning?: string;
  crossSignalObservations?: string[];
  synthesisRationale?: string | null;
  analysisModel?: string | null;
  analysisMode?: 'llm' | 'deterministic_fallback';
}

export interface TrendAnalysisResult {
  analysisId: string;
  analyzedAt: string;
  forecast: TrendForecast;
  relatedTrends: Array<{ name: string; correlation: number }>;
  historicalData: Array<{ date: string; value: number }>;
  competitorPositioning?: Array<{ competitor: string; position: string }>;
  actionPlan: string[];
}

type TrendPayload =
  | SignalScanRequest
  | TrendAnalysisRequest
  | PivotTriggerRequest;

// ============================================================================
// PER-ACTION LLM SCHEMAS (analyze_trend, trigger_pivot, track_competitor)
// ============================================================================

const TrendAnalysisLLMSchema = z.object({
  currentState: z.enum(['NASCENT', 'GROWING', 'PEAKING', 'DECLINING', 'STABLE']),
  projectedTrajectory: z.enum(['ACCELERATING', 'STEADY', 'DECELERATING', 'REVERSING']),
  confidence: z.number().min(0).max(1),
  forecastNarrative: z.string().min(30).max(1500),
  keyDrivers: z.array(z.string().min(5).max(300)).min(1).max(6),
  potentialDisruptors: z.array(z.string().min(5).max(300)).min(0).max(4),
  competitorPositioning: z.array(z.object({
    competitor: z.string().min(2).max(100),
    position: z.string().min(5).max(300),
  })).min(0).max(5),
  actionPlan: z.array(z.string().min(10).max(400)).min(1).max(6),
  relatedTrends: z.array(z.object({
    name: z.string().min(2).max(200),
    correlation: z.number().min(0).max(1),
  })).min(0).max(8),
});

const PivotTriggerLLMSchema = z.object({
  pivotWarranted: z.boolean(),
  pivotRationale: z.string().min(30).max(1000),
  urgencyAssessment: z.enum(['IMMEDIATE', 'HIGH', 'MEDIUM', 'LOW']),
  pivots: z.array(z.object({
    targetAgent: z.string().min(2).max(100),
    pivotType: z.enum(['CONTENT', 'MARKETING', 'SALES', 'OUTREACH', 'STRATEGY']),
    currentState: z.string().min(5).max(300),
    recommendedState: z.string().min(10).max(400),
    rationale: z.string().min(20).max(600),
    implementationSteps: z.array(z.string().min(5).max(300)).min(1).max(5),
    rollbackPlan: z.string().min(10).max(300),
  })).min(0).max(8),
});

const CompetitorTrackingLLMSchema = z.object({
  competitiveNarrative: z.string().min(30).max(2000),
  threatLevel: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  movements: z.array(z.object({
    competitorName: z.string().min(2).max(100),
    movementType: z.enum(['PRICING', 'FEATURE', 'MARKETING', 'POSITIONING', 'EXPANSION', 'PARTNERSHIP']),
    description: z.string().min(10).max(500),
    impactAssessment: z.enum(['MINIMAL', 'MODERATE', 'SIGNIFICANT', 'CRITICAL']),
    recommendedResponse: z.string().min(10).max(400),
    sourceUrls: z.array(z.string()).min(0).max(3),
  })).min(0).max(20),
  strategicRecommendations: z.array(z.string().min(10).max(400)).min(1).max(6),
});

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class TrendScout extends BaseSpecialist {
  private signalCache: Map<string, MarketSignal> = new Map();
  private readonly SIGNAL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Trend Scout initialized - market intelligence active');
  }

  /**
   * Main execution entry point
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as TrendPayload;
      const payloadWithAction = message.payload as { action?: string };
      const action = payloadWithAction.action ?? 'scan_signals';

      this.log('INFO', `Executing action: ${action}`);

      switch (action) {
        case 'scan_signals':
          return await this.handleSignalScan(taskId, payload as SignalScanRequest);

        case 'analyze_trend':
          return await this.handleTrendAnalysis(taskId, payload as TrendAnalysisRequest);

        case 'trigger_pivot':
          return await this.handlePivotTrigger(taskId, payload as PivotTriggerRequest);

        case 'get_cached_signals':
          return this.handleGetCachedSignals(taskId, payload as SignalScanRequest);

        case 'track_competitor':
          return await this.handleCompetitorTracking(taskId, payload as SignalScanRequest);

        default:
          return this.createReport(taskId, 'FAILED', null, [`Unknown action: ${action}`]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', `Execution failed: ${errorMessage}`);
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * Handle signals from the Signal Bus
   */
  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;
    const signalPayload = signal.payload as { type?: string; data?: Record<string, unknown> };

    if (signalPayload.type === 'MARKET_DATA_UPDATE') {
      // Process new market data and detect signals
      const scanResult = await this.processMarketDataUpdate(signalPayload.data ?? {});
      return this.createReport(taskId, 'COMPLETED', scanResult);
    }

    if (signalPayload.type === 'COMPETITOR_ALERT') {
      // Process competitor alert
      const movement = this.analyzeCompetitorAlert(signalPayload as Record<string, unknown>);
      return this.createReport(taskId, 'COMPLETED', movement);
    }

    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  /**
   * Generate a report for the manager
   */
  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  /**
   * Self-assessment - this agent has REAL logic
   */
  hasRealLogic(): boolean {
    return true;
  }

  /**
   * Lines of code assessment
   */
  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 650, boilerplate: 80 };
  }

  // ==========================================================================
  // CORE SIGNAL DETECTION LOGIC
  // ==========================================================================

  /**
   * Handle signal scanning request
   */
  private async handleSignalScan(
    taskId: string,
    request: SignalScanRequest
  ): Promise<AgentReport> {
    const { industry, competitors, keywords, timeframe } = request;
    const minConfidence = request.minConfidence ?? 0.5;

    // Seed existing market context from vault before scanning
    const marketContext = await this.getMarketContextFromVault().catch((err: unknown) => {
      this.log('WARN', `Could not read market vault context: ${err instanceof Error ? err.message : String(err)}`);
      return { sentiments: [], signals: [] };
    });

    if (marketContext.signals.length > 0) {
      this.log('INFO', `Vault context: ${marketContext.signals.length} pending signal(s), ${marketContext.sentiments.length} sentiment(s)`);
    }

    this.log('INFO', `Scanning signals for industry: ${industry ?? 'all'}`);

    // Generate scan ID
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Step 1: Detect signals from real upstream collectors (Serper, News, Keywords)
    const signals = await this.detectSignals(industry, keywords ?? [], timeframe ?? '7D');

    // Step 2: Track competitor movements via real LinkedIn/News/Crunchbase
    const competitorMovements = competitors?.length
      ? await this.trackCompetitorMovements(competitors)
      : [];

    // Step 3: Filter by confidence threshold
    const filteredSignals = signals.filter(s => s.confidence >= minConfidence);

    // Cache high-value signals (deterministic, by upstream urgency)
    filteredSignals
      .filter(s => s.urgency === 'CRITICAL' || s.urgency === 'HIGH')
      .forEach(s => this.signalCache.set(s.id, s));

    // Step 4: LLM synthesis over the assembled signal batch (Task #66 rebuild)
    let synthesis: SignalSynthesisResult | null = null;
    let analysisMode: 'llm' | 'deterministic_fallback' = 'llm';
    let analysisModel: string | null = null;

    if (filteredSignals.length > 0) {
      try {
        const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
        analysisModel = ctx.gm.model;
        synthesis = await executeSignalSynthesis(
          {
            industry: industry ?? '',
            signals: filteredSignals.map((s) => ({
              id: s.id,
              type: s.type,
              title: s.title,
              description: s.description,
              source: s.source,
              urgency: s.urgency,
              confidence: s.confidence,
            })),
            competitorMovements: competitorMovements.map((m) => ({
              competitorName: m.competitorName,
              movementType: m.movementType,
              description: m.description,
              impactAssessment: m.impactAssessment,
            })),
          },
          ctx,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.log('WARN', `LLM synthesis failed — using deterministic summary: ${msg}`);
        analysisMode = 'deterministic_fallback';
      }
    } else {
      analysisMode = 'deterministic_fallback';
    }

    // Step 5: Apply LLM enriched signal classifications (refines upstream regex)
    const enrichedSignalsById = new Map(
      synthesis?.enrichedSignals.map((es) => [es.id, es]) ?? [],
    );
    const finalSignals: MarketSignal[] = filteredSignals.map((sig) => {
      const enrichment = enrichedSignalsById.get(sig.id);
      if (!enrichment) {
        return sig;
      }
      return {
        ...sig,
        type: enrichment.type as SignalType,
        urgency: enrichment.urgency as SignalUrgency,
        description: enrichment.refinedDescription,
        recommendedActions: enrichment.recommendedActions,
      };
    });

    // Step 6: Build pivot recommendations from LLM (or fallback)
    const pivotRecommendations: PivotRecommendation[] = synthesis !== null
      ? synthesis.pivotRecommendations.map((p, idx) => ({
          id: `pivot-llm-${Date.now()}-${idx}`,
          triggeredBy: p.triggeringSignalIds[0] ?? 'unknown',
          targetAgent: p.targetAgent,
          pivotType: p.pivotType,
          priority: p.priority,
          currentState: 'as-is',
          recommendedState: p.recommendedAction,
          rationale: p.rationale,
          expectedImpact: 'see rationale',
          implementationSteps: [p.recommendedAction],
          rollbackPlan: 'Revert to as-is state if results degrade after 7 days',
        }))
      : this.generatePivotRecommendations(filteredSignals);

    // Step 7: Build summary — LLM-driven counts + sentiment, deterministic counts as fallback
    const counts = {
      criticalCount: finalSignals.filter((s) => s.urgency === 'CRITICAL').length,
      highCount: finalSignals.filter((s) => s.urgency === 'HIGH').length,
      mediumCount: finalSignals.filter((s) => s.urgency === 'MEDIUM').length,
      lowCount: finalSignals.filter((s) => s.urgency === 'LOW').length,
    };

    const summary: SignalScanResult['summary'] = synthesis !== null
      ? {
          totalSignals: finalSignals.length,
          ...counts,
          trendingTopics: synthesis.trendingTopics,
          overallMarketSentiment: synthesis.marketSentiment as MarketSentiment,
          topOpportunities: synthesis.topOpportunities,
          topThreats: synthesis.topThreats,
        }
      : this.buildScanSummary(finalSignals, competitorMovements);

    const result: SignalScanResult = {
      scanId,
      scannedAt: new Date().toISOString(),
      signals: finalSignals,
      competitorMovements,
      summary,
      pivotRecommendations,
      marketSentimentReasoning: synthesis?.marketSentimentReasoning,
      crossSignalObservations: synthesis?.crossSignalObservations,
      synthesisRationale: synthesis?.rationale ?? null,
      analysisModel,
      analysisMode,
    };

    return this.createReport(taskId, 'COMPLETED', result);
  }

  /**
   * Detect market signals from multiple sources
   */
  private async detectSignals(
    industry: string | undefined,
    keywords: string[],
    _timeframe: string
  ): Promise<MarketSignal[]> {
    const signals: MarketSignal[] = [];
    const now = new Date();

    // Run all signal detection in parallel for speed
    const [industrySignals, keywordSignals, newsSignals] = await Promise.all([
      industry ? this.detectIndustrySignals(industry, now) : Promise.resolve([]),
      keywords.length > 0 ? this.detectKeywordSignals(keywords, now) : Promise.resolve([]),
      industry ? this.detectNewsSignals(industry, now) : Promise.resolve([]),
    ]);

    signals.push(...industrySignals, ...keywordSignals, ...newsSignals);

    // Share high-value signals to Memory Vault for cross-agent access
    await this.shareSignalsToVault(signals).catch((err: unknown) => {
      this.log('WARN', `Memory Vault share failed: ${err instanceof Error ? err.message : String(err)}`);
    });

    this.cleanExpiredSignals();
    return signals;
  }

  /**
   * Detect industry-specific signals via Serper SERP analysis.
   * Searches for current trends/shifts in the industry and converts SERP
   * features (People Also Ask, related searches) into market signals.
   */
  private async detectIndustrySignals(
    industry: string,
    timestamp: Date
  ): Promise<MarketSignal[]> {
    const signals: MarketSignal[] = [];

    try {
      const { getSerperSEOService } = await import('@/lib/integrations/seo/serper-seo-service');
      const serper = getSerperSEOService();

      // Search for current trends in this industry
      const result = await serper.searchSERP(`${industry} trends 2026`, { num: 10 });

      if (!result.success || !result.data) {
        this.log('WARN', `Serper returned no data for industry "${industry}"`);
        return signals;
      }

      const { organic, peopleAlsoAsk, relatedSearches } = result.data;

      // Convert top organic results into signals
      for (const item of organic.slice(0, 5)) {
        const signalId = `sig-serp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const signalType = this.classifySignalFromTitle(item.title, item.snippet);

        signals.push({
          id: signalId,
          type: signalType,
          title: item.title.slice(0, 120),
          description: item.snippet.slice(0, 300),
          source: `SERP Analysis: ${item.domain}`,
          sourceUrl: item.link,
          detectedAt: timestamp.toISOString(),
          urgency: item.position <= 3 ? 'HIGH' : 'MEDIUM',
          confidence: Math.max(0.5, 0.9 - (item.position * 0.05)),
          dataPoints: [`SERP position: #${item.position}`, `Domain: ${item.domain}`, `Industry: ${industry}`],
          affectedAgents: this.determineAffectedAgents(signalType),
          recommendedActions: this.generateActionRecommendations(signalType, item.title),
          expiresAt: new Date(timestamp.getTime() + this.getSignalTTL('MEDIUM')).toISOString(),
        });
      }

      // Convert People Also Ask into opportunity signals
      for (const paa of peopleAlsoAsk.slice(0, 3)) {
        const signalId = `sig-paa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        signals.push({
          id: signalId,
          type: 'OPPORTUNITY',
          title: `Market Question: ${paa.question.slice(0, 100)}`,
          description: paa.snippet.slice(0, 300),
          source: 'Google People Also Ask',
          detectedAt: timestamp.toISOString(),
          urgency: 'MEDIUM',
          confidence: 0.75,
          dataPoints: [`Question: ${paa.question}`, `Industry: ${industry}`],
          affectedAgents: ['CONTENT_MANAGER', 'MARKETING_MANAGER', 'SEO_EXPERT'],
          recommendedActions: [
            `Create content that answers: "${paa.question}"`,
            `Use this question in FAQ sections and blog posts`,
            `Target this as a featured snippet opportunity`,
          ],
          expiresAt: new Date(timestamp.getTime() + this.getSignalTTL('MEDIUM')).toISOString(),
        });
      }

      // Convert related searches into emerging trend signals
      for (const related of relatedSearches.slice(0, 3)) {
        const signalId = `sig-rel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        signals.push({
          id: signalId,
          type: 'TREND_EMERGING',
          title: `Related Trend: ${related.slice(0, 100)}`,
          description: `Google surfaces "${related}" as a related search for ${industry} trends, indicating growing market interest.`,
          source: 'Google Related Searches',
          detectedAt: timestamp.toISOString(),
          urgency: 'LOW',
          confidence: 0.65,
          dataPoints: [`Related search: ${related}`, `Parent query: ${industry} trends`],
          affectedAgents: ['MARKETING_MANAGER', 'CONTENT_MANAGER'],
          recommendedActions: [
            `Research "${related}" for content opportunities`,
            `Monitor search volume for "${related}" over next 30 days`,
          ],
          expiresAt: new Date(timestamp.getTime() + this.getSignalTTL('LOW')).toISOString(),
        });
      }
    } catch (err: unknown) {
      this.log('WARN', `Industry signal detection failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return signals;
  }

  /**
   * Classify a signal type from SERP title/snippet content.
   */
  private classifySignalFromTitle(title: string, snippet: string): SignalType {
    const text = `${title} ${snippet}`.toLowerCase();
    if (/declin|drop|fall|crash|end of|dying|obsolete/.test(text)) { return 'TREND_DECLINING'; }
    if (/disrupt|shift|chang|transform|revolution|overhaul/.test(text)) { return 'INDUSTRY_SHIFT'; }
    if (/threat|risk|danger|warn|concern|crisis/.test(text)) { return 'THREAT'; }
    if (/opportunit|growth|boom|surge|rise|expand/.test(text)) { return 'OPPORTUNITY'; }
    if (/compet|rival|versus|vs\b|market share/.test(text)) { return 'COMPETITOR_MOVE'; }
    return 'TREND_EMERGING';
  }

  /**
   * Detect signals from recent news articles about the industry via News API.
   */
  private async detectNewsSignals(
    industry: string,
    timestamp: Date
  ): Promise<MarketSignal[]> {
    const signals: MarketSignal[] = [];

    try {
      const { getCompanyNews, analyzeNews } = await import('@/lib/outbound/apis/news-service');
      const articles = await getCompanyNews(industry, 10);

      if (articles.length === 0) { return signals; }

      const analysis = analyzeNews(articles);

      // Each article with a clear title becomes a signal
      for (const article of articles.slice(0, 5)) {
        const signalId = `sig-news-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const signalType = this.classifySignalFromTitle(article.title, article.summary ?? '');

        signals.push({
          id: signalId,
          type: signalType,
          title: article.title.slice(0, 120),
          description: article.summary?.slice(0, 300) ?? article.title,
          source: `News: ${article.source}`,
          sourceUrl: article.url,
          detectedAt: timestamp.toISOString(),
          urgency: 'MEDIUM',
          confidence: 0.7,
          dataPoints: [
            `Source: ${article.source}`,
            `Published: ${article.publishedDate}`,
            `Overall news sentiment: ${analysis.sentiment}`,
          ],
          affectedAgents: this.determineAffectedAgents(signalType),
          recommendedActions: this.generateActionRecommendations(signalType, article.title),
          expiresAt: new Date(timestamp.getTime() + this.getSignalTTL('MEDIUM')).toISOString(),
        });
      }
    } catch (err: unknown) {
      this.log('WARN', `News signal detection failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return signals;
  }

  /**
   * Detect keyword-based signals using real search volume data.
   */
  private async detectKeywordSignals(
    keywords: string[],
    timestamp: Date
  ): Promise<MarketSignal[]> {
    const signals: MarketSignal[] = [];

    const trendingKeywords = await this.analyzeTrendingKeywords(keywords);

    for (const { keyword, trendDirection, strength } of trendingKeywords) {
      const signalId = `sig-kw-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const type: SignalType = trendDirection === 'up' ? 'TREND_EMERGING' : 'TREND_DECLINING';
      const urgency: SignalUrgency = strength > 0.8 ? 'HIGH' : strength > 0.5 ? 'MEDIUM' : 'LOW';

      signals.push({
        id: signalId,
        type,
        title: `Keyword Trend: "${keyword}"`,
        description: `Search interest for "${keyword}" is ${trendDirection === 'up' ? 'increasing' : 'decreasing'} with ${Math.round(strength * 100)}% signal strength`,
        source: 'Keyword Trend Analysis',
        detectedAt: timestamp.toISOString(),
        urgency,
        confidence: Math.min(0.95, strength + 0.1),
        dataPoints: [`Keyword: ${keyword}`, `Direction: ${trendDirection}`, `Strength: ${strength}`],
        affectedAgents: ['MARKETING_MANAGER', 'CONTENT_MANAGER', 'SEO_EXPERT'],
        recommendedActions: trendDirection === 'up'
          ? [`Create content around "${keyword}"`, `Optimize existing pages for "${keyword}"`, `Consider PPC campaigns targeting "${keyword}"`]
          : [`Reduce investment in "${keyword}" content`, `Pivot to related emerging keywords`, `Monitor for potential comeback`],
        expiresAt: new Date(timestamp.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return signals;
  }

  // detectGeneralMarketSignals removed — news signals are now gathered via
  // detectNewsSignals() which is called in parallel from detectSignals().

  /**
   * Analyze trending keywords using DataForSEO for real search volume and competition data.
   */
  private async analyzeTrendingKeywords(
    keywords: string[]
  ): Promise<Array<{ keyword: string; trendDirection: 'up' | 'down'; strength: number }>> {
    if (keywords.length === 0) { return []; }

    try {
      const { getDataForSEOService } = await import('@/lib/integrations/seo/dataforseo-service');
      const seo = getDataForSEOService();

      const result = await seo.getKeywordData(keywords.slice(0, 20));

      if (!result.success || !result.data) {
        this.log('WARN', 'DataForSEO keyword data unavailable, using fallback');
        return keywords.map(kw => ({ keyword: kw, trendDirection: 'up' as const, strength: 0.3 }));
      }

      return result.data.map((kd) => {
        // Derive direction from monthly trend data if available
        const monthlySearches = (kd as unknown as Record<string, unknown>).monthlySearches as Array<{ month: string; searchVolume: number }> | undefined;
        let direction: 'up' | 'down' = 'up';
        let strength = 0.5;

        if (monthlySearches && monthlySearches.length >= 3) {
          const recent = monthlySearches.slice(-3).reduce((sum, m) => sum + m.searchVolume, 0) / 3;
          const older = monthlySearches.slice(0, 3).reduce((sum, m) => sum + m.searchVolume, 0) / 3;

          if (older > 0) {
            const changeRatio = (recent - older) / older;
            direction = changeRatio >= 0 ? 'up' : 'down';
            strength = Math.min(1, Math.abs(changeRatio));
          }
        } else {
          // Use search volume + competition as a proxy for strength
          const volume = kd.searchVolume ?? 0;
          const competition = kd.competition ?? 0;
          strength = Math.min(1, (volume / 10000) * 0.5 + competition * 0.5);
        }

        return {
          keyword: kd.keyword,
          trendDirection: direction,
          strength: Math.round(strength * 100) / 100,
        };
      });
    } catch (err: unknown) {
      this.log('WARN', `Keyword trend analysis failed: ${err instanceof Error ? err.message : String(err)}`);
      return keywords.map(kw => ({ keyword: kw, trendDirection: 'up' as const, strength: 0.3 }));
    }
  }

  // analyzeEconomicIndicators removed — real economic signals come from
  // news + SERP analysis in detectIndustrySignals() and detectNewsSignals().

  // ==========================================================================
  // COMPETITOR TRACKING
  // ==========================================================================

  /**
   * Track competitor movements
   */
  private async trackCompetitorMovements(
    competitors: string[]
  ): Promise<CompetitorMovement[]> {
    const movements: CompetitorMovement[] = [];

    // Seed competitor context from cross-agent vault insights
    const vaultContext = await this.readCompetitorInsightsFromVault().catch((err: unknown) => {
      this.log('WARN', `Could not read competitor vault context: ${err instanceof Error ? err.message : String(err)}`);
      return { competitors: [], recentMoves: [] };
    });

    if (vaultContext.recentMoves.length > 0) {
      this.log('INFO', `Vault seeded ${vaultContext.recentMoves.length} prior competitor move(s) for context`);
    }

    for (const competitor of competitors) {
      const competitorMovements = await this.analyzeCompetitor(competitor);
      movements.push(...competitorMovements);
    }

    return movements;
  }

  /**
   * Analyze individual competitor using News API, LinkedIn hiring signals,
   * and Crunchbase funding data to detect real competitive movements.
   */
  private async analyzeCompetitor(
    competitorName: string
  ): Promise<CompetitorMovement[]> {
    const movements: CompetitorMovement[] = [];
    const now = new Date().toISOString();

    // Run all competitor data sources in parallel
    const [newsResult, hiringResult, fundingResult] = await Promise.allSettled([
      this.getCompetitorNews(competitorName),
      this.getCompetitorHiring(competitorName),
      this.getCompetitorFunding(competitorName),
    ]);

    const competitorId = competitorName.toLowerCase().replace(/\s+/g, '-');

    // News → MARKETING / POSITIONING / FEATURE moves
    if (newsResult.status === 'fulfilled' && newsResult.value.length > 0) {
      for (const article of newsResult.value.slice(0, 3)) {
        const moveType = this.classifyCompetitorMove(article.title);
        movements.push({
          competitorId,
          competitorName,
          movementType: moveType,
          description: article.title,
          detectedAt: now,
          sourceUrls: [article.url],
          impactAssessment: 'MODERATE',
          recommendedResponse: `Analyze ${competitorName}'s move: "${article.title.slice(0, 80)}"`,
        });
      }
    }

    // Hiring signals → EXPANSION moves
    if (hiringResult.status === 'fulfilled' && hiringResult.value.isHiring) {
      const hiring = hiringResult.value;
      movements.push({
        competitorId,
        competitorName,
        movementType: 'EXPANSION',
        description: `${competitorName} is actively hiring (${hiring.hiringIntensity} intensity). Departments: ${hiring.departmentsHiring.join(', ')}`,
        detectedAt: now,
        sourceUrls: [],
        impactAssessment: hiring.hiringIntensity === 'high' ? 'SIGNIFICANT' : 'MODERATE',
        recommendedResponse: hiring.insights.join('; '),
      });
    }

    // Funding → EXPANSION moves
    if (fundingResult.status === 'fulfilled' && fundingResult.value) {
      const funding = fundingResult.value;
      movements.push({
        competitorId,
        competitorName,
        movementType: 'EXPANSION',
        description: `${competitorName} — ${funding.summary}`,
        detectedAt: now,
        sourceUrls: [],
        impactAssessment: 'SIGNIFICANT',
        recommendedResponse: `Monitor ${competitorName}'s post-funding strategy. Expect increased marketing spend and potential feature acceleration.`,
      });
    }

    return movements;
  }

  /**
   * Fetch recent news about a competitor.
   */
  private async getCompetitorNews(
    competitorName: string
  ): Promise<Array<{ title: string; url: string; source: string; publishedDate: string }>> {
    try {
      const { getCompanyNews } = await import('@/lib/outbound/apis/news-service');
      return await getCompanyNews(competitorName, 5);
    } catch (err: unknown) {
      this.log('WARN', `getCompetitorNews failed for "${competitorName}": ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  /**
   * Fetch LinkedIn hiring signals for a competitor.
   */
  private async getCompetitorHiring(
    competitorName: string
  ): Promise<{ isHiring: boolean; hiringIntensity: string; departmentsHiring: string[]; insights: string[] }> {
    try {
      const { getCompanyJobs, analyzeHiringSignals } = await import('@/lib/outbound/apis/linkedin-service');
      const jobs = await getCompanyJobs(competitorName, 10);
      return analyzeHiringSignals(jobs);
    } catch {
      return { isHiring: false, hiringIntensity: 'low', departmentsHiring: [], insights: [] };
    }
  }

  /**
   * Fetch Crunchbase funding data for a competitor.
   */
  private async getCompetitorFunding(
    competitorName: string
  ): Promise<{ summary: string } | null> {
    try {
      const { searchOrganization, formatFundingData } = await import('@/lib/outbound/apis/crunchbase-service');
      const org = await searchOrganization(competitorName);
      if (!org) { return null; }

      const formatted = formatFundingData(org);
      const parts: string[] = [];
      if (formatted.totalFunding) { parts.push(`Total funding: ${formatted.totalFunding}`); }
      if (formatted.lastRound) {
        parts.push(`Last round: ${formatted.lastRound.roundType} (${formatted.lastRound.amount})`);
      }
      return parts.length > 0 ? { summary: parts.join('. ') } : null;
    } catch (err: unknown) {
      this.log('WARN', `getCompetitorFunding failed for "${competitorName}": ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /**
   * Classify a competitor movement type from a news headline.
   */
  private classifyCompetitorMove(title: string): CompetitorMovement['movementType'] {
    const t = title.toLowerCase();
    if (/pric|cost|discount|free tier|plan/.test(t)) { return 'PRICING'; }
    if (/launch|releas|announc|new feature|updat|ship/.test(t)) { return 'FEATURE'; }
    if (/campaign|ad|brand|market|promot/.test(t)) { return 'MARKETING'; }
    if (/partner|acqui|merg|integrat|alliance/.test(t)) { return 'PARTNERSHIP'; }
    if (/expand|hire|office|grow|fund|rais/.test(t)) { return 'EXPANSION'; }
    return 'POSITIONING';
  }

  /**
   * Analyze competitor alert from signal bus
   */
  private analyzeCompetitorAlert(
    payload: Record<string, unknown>
  ): CompetitorMovement {
    return {
      competitorId: String(payload.competitorId ?? 'unknown'),
      competitorName: String(payload.competitorName ?? 'Unknown Competitor'),
      movementType: (payload.movementType as CompetitorMovement['movementType']) ?? 'MARKETING',
      description: String(payload.description ?? 'Competitor activity detected'),
      detectedAt: new Date().toISOString(),
      impactAssessment: 'MODERATE',
      sourceUrls: Array.isArray(payload.sourceUrls) ? payload.sourceUrls as string[] : [],
      recommendedResponse: 'Review and assess competitive impact',
    };
  }

  // ==========================================================================
  // TREND ANALYSIS
  // ==========================================================================

  /**
   * Handle trend analysis request.
   * Collects DataForSEO + Serper data first, then passes it to the LLM for
   * strategic synthesis. The LLM replaces the threshold-based forecast logic
   * and can reason about cross-signal patterns the data reveals.
   */
  private async handleTrendAnalysis(
    taskId: string,
    request: TrendAnalysisRequest
  ): Promise<AgentReport> {
    const { trendKeyword, industry, timeHorizon } = request;

    this.log('INFO', `Analyzing trend: "${trendKeyword}"`);

    const analysisId = `trend-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const horizon = timeHorizon ?? '3_MONTHS';

    // Step 1: Collect real data from all upstream sources in parallel
    const [keywordTrends, relatedTrendsRaw, historicalData, competitorPositioningRaw] = await Promise.all([
      this.analyzeTrendingKeywords([trendKeyword]),
      this.findRelatedTrends(trendKeyword, industry),
      this.generateHistoricalData(trendKeyword),
      request.includeCompetitorAnalysis
        ? this.analyzeCompetitorTrendPositioning(trendKeyword)
        : Promise.resolve(undefined),
    ]);

    const keywordTrend = keywordTrends[0];

    // Step 2: LLM synthesis — reason about what the collected data means strategically
    try {
      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      const dataContext = JSON.stringify({
        trendKeyword,
        industry: industry ?? 'unspecified',
        timeHorizon: horizon,
        keywordTrendData: keywordTrend ?? null,
        relatedTrends: relatedTrendsRaw.slice(0, 8),
        historicalVolumePoints: historicalData.slice(-12), // last 12 months
        competitorSERPPositions: competitorPositioningRaw ?? [],
      }, null, 2);

      const userPrompt = `ACTION: analyze_trend

Analyze the collected keyword and market data below for the trend "${trendKeyword}" and produce a strategic trend assessment. Do NOT hallucinate data — reason only from what is provided.

## COLLECTED DATA
${dataContext}

Respond with ONLY a valid JSON object:
{
  "currentState": "<NASCENT|GROWING|PEAKING|DECLINING|STABLE>",
  "projectedTrajectory": "<ACCELERATING|STEADY|DECELERATING|REVERSING>",
  "confidence": <0.0-1.0>,
  "forecastNarrative": "<2-3 sentence synthesis of what this data says about the trend's trajectory>",
  "keyDrivers": ["<specific driver visible in the data, citing sources or keywords where possible>"],
  "potentialDisruptors": ["<forces visible in the data that could shift the trend>"],
  "competitorPositioning": [
    { "competitor": "<domain>", "position": "<strategic read of their SERP presence vs this trend>" }
  ],
  "actionPlan": ["<specific action the operator should take, ordered by priority>"],
  "relatedTrends": [
    { "name": "<related trend name>", "correlation": <0.0-1.0> }
  ]
}`;

      const rawContent = await callOpenRouter(ctx, userPrompt);
      const parsed: unknown = JSON.parse(stripJsonFences(rawContent));
      const llmResult = TrendAnalysisLLMSchema.parse(parsed);

      const forecast: TrendForecast = {
        trendId: `trend-${trendKeyword.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        trendName: trendKeyword,
        currentState: llmResult.currentState,
        projectedTrajectory: llmResult.projectedTrajectory,
        timeHorizon: horizon,
        confidence: llmResult.confidence,
        keyDrivers: llmResult.keyDrivers,
        potentialDisruptors: llmResult.potentialDisruptors,
        recommendations: llmResult.actionPlan,
      };

      const result: TrendAnalysisResult = {
        analysisId,
        analyzedAt: new Date().toISOString(),
        forecast,
        relatedTrends: llmResult.relatedTrends,
        historicalData,
        competitorPositioning: llmResult.competitorPositioning,
        actionPlan: llmResult.actionPlan,
      };

      await this.shareTrendForecastToVault(forecast).catch(() => { /* non-blocking */ });

      return this.createReport(taskId, 'COMPLETED', {
        ...result,
        forecastNarrative: llmResult.forecastNarrative,
        analysisMethod: 'llm',
        analysisModel: ctx.gm.model,
      });
    } catch (err: unknown) {
      // Fallback: deterministic forecast from keyword data alone
      const msg = err instanceof Error ? err.message : String(err);
      this.log('WARN', `analyze_trend LLM synthesis failed — using keyword-data fallback: ${msg}`);

      const forecast = await this.buildTrendForecast(trendKeyword, horizon);
      const actionPlan = this.generateTrendActionPlan(forecast);

      const result: TrendAnalysisResult = {
        analysisId,
        analyzedAt: new Date().toISOString(),
        forecast,
        relatedTrends: relatedTrendsRaw,
        historicalData,
        competitorPositioning: competitorPositioningRaw,
        actionPlan,
      };

      await this.shareTrendForecastToVault(forecast).catch(() => { /* non-blocking */ });

      return this.createReport(taskId, 'COMPLETED', { ...result, analysisMethod: 'deterministic_fallback' });
    }
  }

  /**
   * Build trend forecast using keyword data from DataForSEO and SERP analysis.
   */
  private async buildTrendForecast(
    trendKeyword: string,
    timeHorizon: TrendForecast['timeHorizon']
  ): Promise<TrendForecast> {
    const trendId = `trend-${trendKeyword.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    // Get keyword trend data
    const trends = await this.analyzeTrendingKeywords([trendKeyword]);
    const keywordTrend = trends[0];

    // Derive forecast state from actual data
    let currentState: TrendForecast['currentState'] = 'STABLE';
    let projectedTrajectory: TrendForecast['projectedTrajectory'] = 'STEADY';
    let confidence = 0.5;

    if (keywordTrend && keywordTrend.strength > 0) {
      confidence = Math.min(0.9, 0.4 + keywordTrend.strength);

      if (keywordTrend.trendDirection === 'up') {
        currentState = keywordTrend.strength > 0.5 ? 'GROWING' : 'NASCENT';
        projectedTrajectory = keywordTrend.strength > 0.7 ? 'ACCELERATING' : 'STEADY';
      } else {
        currentState = 'DECLINING';
        projectedTrajectory = keywordTrend.strength > 0.5 ? 'DECELERATING' : 'REVERSING';
      }
    }

    // Get SERP data for additional context
    const keyDrivers: string[] = [];
    const potentialDisruptors: string[] = [];

    try {
      const { getSerperSEOService } = await import('@/lib/integrations/seo/serper-seo-service');
      const serper = getSerperSEOService();
      const serpResult = await serper.searchSERP(trendKeyword, { num: 5 });

      if (serpResult.success && serpResult.data) {
        for (const item of serpResult.data.organic.slice(0, 3)) {
          keyDrivers.push(`${item.title} (${item.domain})`);
        }
        for (const paa of serpResult.data.peopleAlsoAsk.slice(0, 2)) {
          potentialDisruptors.push(paa.question);
        }
      }
    } catch {
      // Serper unavailable — continue with keyword data only
    }

    return {
      trendId,
      trendName: trendKeyword,
      currentState,
      projectedTrajectory,
      timeHorizon,
      confidence: Math.round(confidence * 100) / 100,
      keyDrivers,
      potentialDisruptors,
      recommendations: this.generateTrendActionPlan({
        trendId, trendName: trendKeyword, currentState, projectedTrajectory,
        timeHorizon, confidence, keyDrivers, potentialDisruptors, recommendations: [],
      }),
    };
  }

  /**
   * Find related trends using Serper's related searches feature.
   */
  private async findRelatedTrends(
    keyword: string,
    _industry?: string
  ): Promise<Array<{ name: string; correlation: number }>> {
    try {
      const { getSerperSEOService } = await import('@/lib/integrations/seo/serper-seo-service');
      const serper = getSerperSEOService();
      const result = await serper.searchSERP(keyword, { num: 5 });

      if (result.success && result.data && result.data.relatedSearches.length > 0) {
        return result.data.relatedSearches.slice(0, 8).map((rs, idx) => ({
          name: rs,
          correlation: Math.round((0.9 - idx * 0.08) * 100) / 100,
        }));
      }
    } catch {
      // Serper unavailable
    }

    // Fallback to derived keyword variants
    return [
      { name: `${keyword} automation`, correlation: 0.7 },
      { name: `${keyword} analytics`, correlation: 0.65 },
      { name: `AI-powered ${keyword}`, correlation: 0.6 },
    ];
  }

  /**
   * Generate historical data from DataForSEO monthly search trends.
   */
  private async generateHistoricalData(
    keyword: string
  ): Promise<Array<{ date: string; value: number }>> {
    try {
      const { getDataForSEOService } = await import('@/lib/integrations/seo/dataforseo-service');
      const seo = getDataForSEOService();
      const result = await seo.getKeywordData([keyword]);

      if (result.success && result.data && result.data.length > 0) {
        const kd = result.data[0] as unknown as Record<string, unknown>;
        const monthly = kd.monthlySearches as Array<{ month: string; searchVolume: number }> | undefined;

        if (monthly && monthly.length > 0) {
          return monthly.map((m) => ({
            date: `${m.month}-01`,
            value: m.searchVolume,
          }));
        }
      }
    } catch {
      // DataForSEO unavailable
    }

    // Fallback — empty data with dates
    const data: Array<{ date: string; value: number }> = [];
    for (let i = 12; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      data.push({ date: d.toISOString().split('T')[0], value: 0 });
    }
    return data;
  }

  /**
   * Analyze competitor positioning around a trend via SERP presence.
   */
  private async analyzeCompetitorTrendPositioning(
    trendKeyword: string
  ): Promise<Array<{ competitor: string; position: string }>> {
    try {
      const { getSerperSEOService } = await import('@/lib/integrations/seo/serper-seo-service');
      const serper = getSerperSEOService();
      const result = await serper.searchSERP(trendKeyword, { num: 10 });

      if (result.success && result.data) {
        // Dedupe by domain and describe position based on SERP rank
        const seen = new Set<string>();
        const positions: Array<{ competitor: string; position: string }> = [];

        for (const item of result.data.organic) {
          if (seen.has(item.domain)) { continue; }
          seen.add(item.domain);

          const positionDesc = item.position <= 3
            ? 'Dominant SERP presence — actively investing in this trend'
            : item.position <= 7
              ? 'Visible presence — engaging with this trend'
              : 'Peripheral presence — monitoring but not leading';

          positions.push({
            competitor: item.domain,
            position: `#${item.position}: ${positionDesc}`,
          });

          if (positions.length >= 5) { break; }
        }

        return positions;
      }
    } catch {
      // Serper unavailable
    }

    return [];
  }

  /**
   * Generate action plan based on forecast
   */
  private generateTrendActionPlan(forecast: TrendForecast): string[] {
    const actions: string[] = [];

    switch (forecast.currentState) {
      case 'NASCENT':
        actions.push('Research and evaluate early adoption opportunities');
        actions.push('Build foundational knowledge and skills');
        actions.push('Identify pilot project opportunities');
        break;
      case 'GROWING':
        actions.push('Accelerate adoption and investment');
        actions.push('Develop competitive differentiation');
        actions.push('Create thought leadership content');
        break;
      case 'PEAKING':
        actions.push('Optimize and refine current implementations');
        actions.push('Focus on ROI maximization');
        actions.push('Begin evaluating next-generation alternatives');
        break;
      case 'DECLINING':
        actions.push('Plan transition to successor technologies');
        actions.push('Extract remaining value from current investments');
        actions.push('Reduce new investment in declining trend');
        break;
      case 'STABLE':
        actions.push('Maintain current position');
        actions.push('Focus on operational efficiency');
        actions.push('Monitor for disruption signals');
        break;
    }

    return actions;
  }

  // ==========================================================================
  // PIVOT TRIGGERING
  // ==========================================================================

  /**
   * Handle pivot trigger request.
   * Loads the cached signal and passes it to the LLM to reason about whether
   * a pivot is warranted and what specific pivots each agent should make.
   * Falls back to template-based pivots if the LLM call fails.
   */
  private async handlePivotTrigger(
    taskId: string,
    request: PivotTriggerRequest
  ): Promise<AgentReport> {
    const { signalId, targetAgents, priority, dryRun } = request;

    this.log('INFO', `Triggering pivot for signal ${signalId}`);

    // Retrieve signal from cache
    const signal = this.signalCache.get(signalId);

    if (!signal) {
      return this.createReport(taskId, 'FAILED', null, [`Signal ${signalId} not found in cache`]);
    }

    const agents = targetAgents ?? signal.affectedAgents;

    // Primary path: LLM reasons about whether and how to pivot given the signal
    let pivots: PivotRecommendation[] = [];

    try {
      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      const signalContext = JSON.stringify({
        signal: {
          id: signal.id,
          type: signal.type,
          title: signal.title,
          description: signal.description,
          urgency: signal.urgency,
          confidence: signal.confidence,
          dataPoints: signal.dataPoints,
          source: signal.source,
        },
        targetAgents: agents,
        requestedPriority: priority ?? null,
      }, null, 2);

      const userPrompt = `ACTION: trigger_pivot

A market signal has been flagged for pivot evaluation. Reason about whether this signal genuinely warrants a strategic pivot and, if so, what specific pivots each affected agent should make. Do not generate generic template pivots — ground recommendations in the signal content.

## SIGNAL DATA
${signalContext}

Respond with ONLY a valid JSON object:
{
  "pivotWarranted": <true|false>,
  "pivotRationale": "<why this signal does or does not warrant a pivot — cite signal content>",
  "urgencyAssessment": "<IMMEDIATE|HIGH|MEDIUM|LOW>",
  "pivots": [
    {
      "targetAgent": "<agent from the targetAgents list>",
      "pivotType": "<CONTENT|MARKETING|SALES|OUTREACH|STRATEGY>",
      "currentState": "<what the agent is presumably doing now>",
      "recommendedState": "<specific recommended new state>",
      "rationale": "<why this agent specifically needs to pivot, grounded in the signal>",
      "implementationSteps": ["<ordered step>"],
      "rollbackPlan": "<how to revert if the pivot doesn't improve outcomes>"
    }
  ]
}`;

      const rawContent = await callOpenRouter(ctx, userPrompt);
      const parsed: unknown = JSON.parse(stripJsonFences(rawContent));
      const llmResult = PivotTriggerLLMSchema.parse(parsed);

      if (llmResult.pivotWarranted) {
        pivots = llmResult.pivots.map((p, idx) => ({
          id: `pivot-llm-${signalId}-${idx}-${Date.now()}`,
          triggeredBy: signalId,
          targetAgent: p.targetAgent,
          pivotType: p.pivotType,
          priority: llmResult.urgencyAssessment,
          currentState: p.currentState,
          recommendedState: p.recommendedState,
          rationale: p.rationale,
          expectedImpact: 'see rationale',
          implementationSteps: p.implementationSteps,
          rollbackPlan: p.rollbackPlan,
        }));
      }

      if (!dryRun && pivots.length > 0) {
        this.log('INFO', `Emitting ${pivots.length} LLM-generated pivot signals`);
        await this.broadcastPivotSignals(pivots).catch((err: unknown) => {
          this.log('WARN', `Pivot signal broadcast failed: ${err instanceof Error ? err.message : String(err)}`);
        });
      }

      return this.createReport(taskId, 'COMPLETED', {
        signalId,
        triggeredAt: new Date().toISOString(),
        dryRun: dryRun ?? false,
        pivotWarranted: llmResult.pivotWarranted,
        pivotRationale: llmResult.pivotRationale,
        urgencyAssessment: llmResult.urgencyAssessment,
        pivots,
        analysisMethod: 'llm',
        analysisModel: ctx.gm.model,
        message: dryRun
          ? `Dry run: ${llmResult.pivotWarranted ? `${pivots.length} pivots recommended` : 'no pivot warranted'}`
          : `${pivots.length} pivot signals emitted to agents`,
      });
    } catch (err: unknown) {
      // Fallback: template-based pivots per agent
      const msg = err instanceof Error ? err.message : String(err);
      this.log('WARN', `trigger_pivot LLM call failed — using template fallback: ${msg}`);

      const pivotPriority = priority ?? this.urgencyToPriority(signal.urgency);
      for (const agent of agents) {
        const pivot = this.generatePivotForAgent(signal, agent, pivotPriority);
        if (pivot) {
          pivots.push(pivot);
        }
      }

      if (!dryRun && pivots.length > 0) {
        this.log('INFO', `Emitting ${pivots.length} template pivot signals (fallback)`);
        await this.broadcastPivotSignals(pivots).catch((broadcastErr: unknown) => {
          this.log('WARN', `Pivot signal broadcast failed: ${broadcastErr instanceof Error ? broadcastErr.message : String(broadcastErr)}`);
        });
      }

      return this.createReport(taskId, 'COMPLETED', {
        signalId,
        triggeredAt: new Date().toISOString(),
        dryRun: dryRun ?? false,
        pivots,
        analysisMethod: 'template-fallback',
        message: dryRun
          ? 'Dry run completed - no signals emitted'
          : `${pivots.length} pivot signals emitted to agents`,
      });
    }
  }

  /**
   * Generate pivot recommendations from signals
   */
  private generatePivotRecommendations(signals: MarketSignal[]): PivotRecommendation[] {
    const recommendations: PivotRecommendation[] = [];

    // Only generate pivots for HIGH or CRITICAL signals
    const significantSignals = signals.filter(
      s => s.urgency === 'CRITICAL' || s.urgency === 'HIGH'
    );

    for (const signal of significantSignals) {
      for (const agent of signal.affectedAgents) {
        const pivot = this.generatePivotForAgent(
          signal,
          agent,
          this.urgencyToPriority(signal.urgency)
        );
        if (pivot) {
          recommendations.push(pivot);
        }
      }
    }

    return recommendations;
  }

  /**
   * Generate pivot recommendation for specific agent
   */
  private generatePivotForAgent(
    signal: MarketSignal,
    targetAgent: string,
    priority: PivotRecommendation['priority']
  ): PivotRecommendation | null {
    const pivotId = `pivot-${signal.id}-${targetAgent}-${Date.now()}`;

    // Determine pivot type based on agent
    const pivotType = this.determinePivotType(targetAgent);
    if (!pivotType) {return null;}

    // Generate context-aware recommendations
    const { currentState, recommendedState, steps, rollback } = this.generatePivotDetails(
      signal,
      targetAgent,
      pivotType
    );

    return {
      id: pivotId,
      triggeredBy: signal.id,
      targetAgent,
      pivotType,
      priority,
      currentState,
      recommendedState,
      rationale: `Signal "${signal.title}" (${signal.type}) requires strategic adjustment`,
      expectedImpact: `Improved alignment with market conditions; ${signal.confidence * 100}% confidence level`,
      implementationSteps: steps,
      rollbackPlan: rollback,
    };
  }

  /**
   * Determine pivot type based on target agent
   */
  private determinePivotType(
    agent: string
  ): PivotRecommendation['pivotType'] | null {
    const agentPivotMap: Record<string, PivotRecommendation['pivotType']> = {
      CONTENT_MANAGER: 'CONTENT',
      COPYWRITER: 'CONTENT',
      MARKETING_MANAGER: 'MARKETING',
      SEO_EXPERT: 'MARKETING',
      TIKTOK_EXPERT: 'MARKETING',
      X_EXPERT: 'MARKETING',
      LINKEDIN_EXPERT: 'MARKETING',
      REVENUE_DIRECTOR: 'SALES',
      DEAL_CLOSER: 'SALES',
      OUTREACH_MANAGER: 'OUTREACH',
      EMAIL_SPECIALIST: 'OUTREACH',
      PRICING_STRATEGIST: 'STRATEGY',
    };

    return agentPivotMap[agent] ?? null;
  }

  /**
   * Generate detailed pivot information
   */
  private generatePivotDetails(
    signal: MarketSignal,
    _targetAgent: string,
    pivotType: PivotRecommendation['pivotType']
  ): {
    currentState: string;
    recommendedState: string;
    steps: string[];
    rollback: string;
  } {
    const pivotTemplates: Record<PivotRecommendation['pivotType'], {
      currentState: string;
      recommendedState: string;
      steps: string[];
      rollback: string;
    }> = {
      CONTENT: {
        currentState: 'Standard content calendar execution',
        recommendedState: `Content strategy aligned with ${signal.type.toLowerCase().replace('_', ' ')}`,
        steps: [
          'Audit current content pipeline for relevance',
          'Identify content gaps related to signal',
          'Prioritize signal-aligned content in calendar',
          'Brief content creators on new focus',
        ],
        rollback: 'Revert to previous content calendar; archive new content for future use',
      },
      MARKETING: {
        currentState: 'Current marketing mix and channels',
        recommendedState: 'Optimized marketing strategy responding to market signal',
        steps: [
          'Analyze signal impact on target audience',
          'Adjust messaging to address signal implications',
          'Reallocate budget to high-opportunity channels',
          'Update campaign targeting parameters',
        ],
        rollback: 'Restore previous campaign settings; A/B test old vs new approach',
      },
      SALES: {
        currentState: 'Current sales methodology and targets',
        recommendedState: 'Sales approach adapted to market conditions',
        steps: [
          'Brief sales team on market signal',
          'Update sales scripts and objection handling',
          'Adjust pricing/discounting guidelines if needed',
          'Modify lead scoring criteria',
        ],
        rollback: 'Return to previous sales playbook; monitor conversion rate changes',
      },
      OUTREACH: {
        currentState: 'Standard outreach cadence and messaging',
        recommendedState: 'Signal-responsive outreach strategy',
        steps: [
          'Review outreach templates for relevance',
          'Adjust timing/frequency based on signal',
          'Update personalization parameters',
          'Test new messaging variants',
        ],
        rollback: 'Revert to previous outreach sequences; monitor response rates',
      },
      STRATEGY: {
        currentState: 'Current strategic positioning',
        recommendedState: 'Strategically repositioned for market conditions',
        steps: [
          'Conduct strategic impact assessment',
          'Update positioning documents',
          'Communicate changes to stakeholders',
          'Align tactical teams with new direction',
        ],
        rollback: 'Maintain current strategy; document signal for future planning',
      },
    };

    return pivotTemplates[pivotType];
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Handle get cached signals request
   */
  private handleGetCachedSignals(
    taskId: string,
    request: SignalScanRequest
  ): AgentReport {
    const { signalTypes, minConfidence } = request;
    const confidence = minConfidence ?? 0;

    let signals = Array.from(this.signalCache.values());

    // Filter by signal types if specified
    if (signalTypes?.length) {
      signals = signals.filter(s => signalTypes.includes(s.type));
    }

    // Filter by confidence
    signals = signals.filter(s => s.confidence >= confidence);

    // Remove expired signals
    const now = new Date();
    signals = signals.filter(s => new Date(s.expiresAt) > now);

    return this.createReport(taskId, 'COMPLETED', {
      cachedSignals: signals,
      count: signals.length,
    });
  }

  /**
   * Handle competitor tracking request.
   * Collects News, LinkedIn hiring, and Crunchbase funding data first, then
   * passes the raw movements to the LLM to reason about patterns, strategic
   * implications, and recommended responses.
   */
  private async handleCompetitorTracking(
    taskId: string,
    request: SignalScanRequest
  ): Promise<AgentReport> {
    const { competitors } = request;

    if (!competitors?.length) {
      return this.createReport(taskId, 'FAILED', null, ['No competitors specified']);
    }

    // Step 1: Collect raw competitor data from all upstream sources
    const rawMovements = await this.trackCompetitorMovements(competitors);

    // Step 2: LLM synthesis — reason about what the competitor data means strategically
    try {
      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      const movementsContext = JSON.stringify({
        competitors,
        rawMovements: rawMovements.map(m => ({
          competitorName: m.competitorName,
          movementType: m.movementType,
          description: m.description,
          impactAssessment: m.impactAssessment,
          detectedAt: m.detectedAt,
          recommendedResponse: m.recommendedResponse,
          sourceUrls: m.sourceUrls.slice(0, 2),
        })),
        totalMovements: rawMovements.length,
        byType: this.groupMovementsByType(rawMovements),
      }, null, 2);

      const userPrompt = `ACTION: track_competitor

Analyze the collected competitor movement data below. Look for cross-competitor patterns — are multiple competitors making similar moves? What does the overall competitive landscape signal? Produce strategic recommendations grounded in the data, not generic advice.

## COMPETITOR MOVEMENT DATA
${movementsContext}

Respond with ONLY a valid JSON object:
{
  "competitiveNarrative": "<2-4 sentence narrative of what the competitor data reveals about the competitive landscape>",
  "threatLevel": "<CRITICAL|HIGH|MEDIUM|LOW — overall competitive threat level>",
  "movements": [
    {
      "competitorName": "<competitor name>",
      "movementType": "<PRICING|FEATURE|MARKETING|POSITIONING|EXPANSION|PARTNERSHIP>",
      "description": "<refined description of the movement with strategic context>",
      "impactAssessment": "<MINIMAL|MODERATE|SIGNIFICANT|CRITICAL>",
      "recommendedResponse": "<specific response action grounded in the movement>",
      "sourceUrls": []
    }
  ],
  "strategicRecommendations": ["<cross-competitor strategic recommendation — cite specific competitors>"]
}`;

      const rawContent = await callOpenRouter(ctx, userPrompt);
      const parsed: unknown = JSON.parse(stripJsonFences(rawContent));
      const llmResult = CompetitorTrackingLLMSchema.parse(parsed);

      const llmMovements: CompetitorMovement[] = llmResult.movements.map(m => ({
        competitorId: m.competitorName.toLowerCase().replace(/\s+/g, '-'),
        competitorName: m.competitorName,
        movementType: m.movementType,
        description: m.description,
        detectedAt: new Date().toISOString(),
        impactAssessment: m.impactAssessment,
        sourceUrls: m.sourceUrls,
        recommendedResponse: m.recommendedResponse,
      }));

      return this.createReport(taskId, 'COMPLETED', {
        trackedAt: new Date().toISOString(),
        competitors,
        movements: llmMovements,
        competitiveNarrative: llmResult.competitiveNarrative,
        threatLevel: llmResult.threatLevel,
        strategicRecommendations: llmResult.strategicRecommendations,
        summary: {
          totalMovements: llmMovements.length,
          byType: this.groupMovementsByType(llmMovements),
          highImpactCount: llmMovements.filter(m =>
            m.impactAssessment === 'SIGNIFICANT' || m.impactAssessment === 'CRITICAL'
          ).length,
        },
        analysisMethod: 'llm',
        analysisModel: ctx.gm.model,
      });
    } catch (err: unknown) {
      // Fallback: return raw collected movements without LLM synthesis
      const msg = err instanceof Error ? err.message : String(err);
      this.log('WARN', `track_competitor LLM synthesis failed — returning raw movements: ${msg}`);

      return this.createReport(taskId, 'COMPLETED', {
        trackedAt: new Date().toISOString(),
        competitors,
        movements: rawMovements,
        summary: {
          totalMovements: rawMovements.length,
          byType: this.groupMovementsByType(rawMovements),
          highImpactCount: rawMovements.filter(m =>
            m.impactAssessment === 'SIGNIFICANT' || m.impactAssessment === 'CRITICAL'
          ).length,
        },
        analysisMethod: 'raw-data-fallback',
      });
    }
  }

  /**
   * Process market data update from signal bus
   */
  private async processMarketDataUpdate(
    data: Record<string, unknown>
  ): Promise<SignalScanResult> {
    const keywords = Array.isArray(data.keywords) ? data.keywords as string[] : [];
    const industry = typeof data.industry === 'string' ? data.industry : undefined;

    const signals = await this.detectSignals(industry, keywords, '7D');
    const pivotRecommendations = this.generatePivotRecommendations(signals);
    const summary = this.buildScanSummary(signals, []);

    return {
      scanId: `auto-${Date.now()}`,
      scannedAt: new Date().toISOString(),
      signals,
      competitorMovements: [],
      summary,
      pivotRecommendations,
    };
  }

  /**
   * Build scan summary
   */
  private buildScanSummary(
    signals: MarketSignal[],
    _movements: CompetitorMovement[]
  ): SignalScanResult['summary'] {
    const criticalCount = signals.filter(s => s.urgency === 'CRITICAL').length;
    const highCount = signals.filter(s => s.urgency === 'HIGH').length;
    const mediumCount = signals.filter(s => s.urgency === 'MEDIUM').length;
    const lowCount = signals.filter(s => s.urgency === 'LOW').length;

    // Extract trending topics from signal titles
    const trendingTopics = signals
      .filter(s => s.type === 'TREND_EMERGING')
      .map(s => s.title)
      .slice(0, 5);

    // Determine market sentiment
    const opportunities = signals.filter(s => s.type === 'OPPORTUNITY' || s.type === 'TREND_EMERGING');
    const threats = signals.filter(s => s.type === 'THREAT' || s.type === 'TREND_DECLINING');

    let sentiment: MarketSentiment = 'NEUTRAL';
    if (opportunities.length > threats.length * 1.5) {sentiment = 'BULLISH';}
    else if (threats.length > opportunities.length * 1.5) {sentiment = 'BEARISH';}
    else if (opportunities.length > 0 && threats.length > 0) {sentiment = 'MIXED';}

    return {
      totalSignals: signals.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      trendingTopics,
      overallMarketSentiment: sentiment,
      topOpportunities: opportunities.slice(0, 3).map(s => s.title),
      topThreats: threats.slice(0, 3).map(s => s.title),
    };
  }

  /**
   * Determine affected agents based on signal type
   */
  private determineAffectedAgents(signalType: SignalType): string[] {
    const agentMap: Record<SignalType, string[]> = {
      TREND_EMERGING: ['MARKETING_MANAGER', 'CONTENT_MANAGER', 'SEO_EXPERT'],
      TREND_DECLINING: ['MARKETING_MANAGER', 'CONTENT_MANAGER', 'PRICING_STRATEGIST'],
      COMPETITOR_MOVE: ['REVENUE_DIRECTOR', 'MARKETING_MANAGER', 'PRICING_STRATEGIST'],
      INDUSTRY_SHIFT: ['REVENUE_DIRECTOR', 'MARKETING_MANAGER', 'OUTREACH_MANAGER'],
      OPPORTUNITY: ['REVENUE_DIRECTOR', 'MARKETING_MANAGER', 'DEAL_CLOSER'],
      THREAT: ['REVENUE_DIRECTOR', 'PRICING_STRATEGIST', 'MARKETING_MANAGER'],
    };

    return agentMap[signalType] ?? ['INTELLIGENCE_MANAGER'];
  }

  /**
   * Generate action recommendations based on signal
   */
  private generateActionRecommendations(signalType: SignalType, signalTitle: string): string[] {
    const baseActions: Record<SignalType, string[]> = {
      TREND_EMERGING: [
        'Create content strategy around this trend',
        'Evaluate product/service alignment',
        'Monitor early adopter engagement',
      ],
      TREND_DECLINING: [
        'Reduce investment in declining area',
        'Identify pivot opportunities',
        'Communicate changes to stakeholders',
      ],
      COMPETITOR_MOVE: [
        'Analyze competitive implications',
        'Review differentiation strategy',
        'Consider responsive actions',
      ],
      INDUSTRY_SHIFT: [
        'Assess compliance requirements',
        'Update strategic planning',
        'Brief leadership team',
      ],
      OPPORTUNITY: [
        'Develop action plan to capitalize',
        'Allocate resources appropriately',
        'Set success metrics',
      ],
      THREAT: [
        'Develop mitigation strategy',
        'Monitor threat evolution',
        'Prepare contingency plans',
      ],
    };

    return [
      `Review implications of "${signalTitle}"`,
      ...baseActions[signalType],
    ];
  }

  /**
   * Get signal TTL based on urgency
   */
  private getSignalTTL(urgency: SignalUrgency): number {
    const ttlMap: Record<SignalUrgency, number> = {
      CRITICAL: 24 * 60 * 60 * 1000, // 24 hours
      HIGH: 3 * 24 * 60 * 60 * 1000, // 3 days
      MEDIUM: 7 * 24 * 60 * 60 * 1000, // 7 days
      LOW: 14 * 24 * 60 * 60 * 1000, // 14 days
    };

    return ttlMap[urgency];
  }

  /**
   * Convert urgency to pivot priority
   */
  private urgencyToPriority(urgency: SignalUrgency): PivotRecommendation['priority'] {
    const priorityMap: Record<SignalUrgency, PivotRecommendation['priority']> = {
      CRITICAL: 'IMMEDIATE',
      HIGH: 'HIGH',
      MEDIUM: 'MEDIUM',
      LOW: 'LOW',
    };

    return priorityMap[urgency];
  }

  /**
   * Clean expired signals from cache
   */
  private cleanExpiredSignals(): void {
    const now = new Date();

    for (const [id, signal] of this.signalCache) {
      if (new Date(signal.expiresAt) < now) {
        this.signalCache.delete(id);
      }
    }
  }

  /**
   * Group movements by type
   */
  private groupMovementsByType(
    movements: CompetitorMovement[]
  ): Record<string, number> {
    const groups: Record<string, number> = {};

    for (const movement of movements) {
      groups[movement.movementType] = (groups[movement.movementType] ?? 0) + 1;
    }

    return groups;
  }

  // ==========================================================================
  // SHARED MEMORY INTEGRATION
  // ==========================================================================

  /**
   * Share detected market signals with the agent swarm via the memory vault
   */
  private async shareSignalsToVault(
    signals: MarketSignal[]
  ): Promise<void> {
    const vault = getMemoryVault();

    for (const signal of signals) {
      // Only share HIGH and CRITICAL signals to avoid noise
      if (signal.urgency === 'CRITICAL' || signal.urgency === 'HIGH') {
        const affectedAgentsArray = signal.affectedAgents.includes('ALL')
          ? ['MARKETING_MANAGER', 'CONTENT_MANAGER', 'REVENUE_DIRECTOR', 'OUTREACH_MANAGER']
          : signal.affectedAgents;

        const signalData: SignalData = {
          signalType: signal.type,
          urgency: signal.urgency,
          source: signal.source,
          affectedAgents: affectedAgentsArray,
          payload: {
            title: signal.title,
            description: signal.description,
            confidence: signal.confidence,
            dataPoints: signal.dataPoints,
            recommendedActions: signal.recommendedActions,
          },
          acknowledged: false,
        };

        await vault.writeSignal(
          `trend_${signal.id}`,
          signalData,
          this.identity.id,
          { tags: ['trend', signal.type.toLowerCase()], ttlMs: this.getSignalTTL(signal.urgency) }
        );
      }
    }

    // Share a summary insight for the swarm
    if (signals.length > 0) {
      const criticalCount = signals.filter(s => s.urgency === 'CRITICAL').length;
      const highCount = signals.filter(s => s.urgency === 'HIGH').length;

      await shareInsight(
        this.identity.id,
        'TREND',
        `Market Signal Scan: ${signals.length} Signals Detected`,
        `Detected ${signals.length} market signals. ` +
        `Critical: ${criticalCount}, High: ${highCount}. ` +
        `Top trending topics: ${signals.slice(0, 3).map(s => s.title).join(', ')}.`,
        {
          confidence: 80,
          relatedAgents: ['MARKETING_MANAGER', 'CONTENT_MANAGER', 'REVENUE_DIRECTOR'],
          actions: signals.flatMap(s => s.recommendedActions).slice(0, 5),
          tags: ['market-intelligence', 'trend-analysis'],
        }
      );
    }
  }

  /**
   * Broadcast pivot recommendations to affected agents
   */
  private async broadcastPivotSignals(
    pivots: PivotRecommendation[]
  ): Promise<void> {
    for (const pivot of pivots) {
      const urgency = pivot.priority === 'IMMEDIATE' ? ('CRITICAL' as const) :
                      pivot.priority === 'HIGH' ? ('HIGH' as const) : ('MEDIUM' as const);

      await broadcastSignal(
        this.identity.id,
        'PIVOT_RECOMMENDED',
        urgency,
        {
          pivotId: pivot.id,
          pivotType: pivot.pivotType,
          targetAgent: pivot.targetAgent,
          rationale: pivot.rationale,
          currentState: pivot.currentState,
          recommendedState: pivot.recommendedState,
          implementationSteps: pivot.implementationSteps,
        },
        [pivot.targetAgent]
      );
    }
  }

  /**
   * Read competitor insights from other agents
   */
  private async readCompetitorInsightsFromVault(): Promise<{ competitors: string[]; recentMoves: string[] }> {
    const insights = await readAgentInsights(this.identity.id, {
      type: 'COMPETITOR',
      minConfidence: 60,
      limit: 10,
    });

    const competitors: string[] = [];
    const recentMoves: string[] = [];

    for (const insight of insights) {
      if (insight.value.title) {
        competitors.push(insight.value.title);
      }
      if (insight.value.summary) {
        recentMoves.push(insight.value.summary);
      }
    }

    return { competitors, recentMoves };
  }

  /**
   * Share trend forecast to memory vault for other agents
   */
  private async shareTrendForecastToVault(
    forecast: TrendForecast
  ): Promise<void> {
    await shareInsight(
      this.identity.id,
      'TREND',
      `Trend Forecast: ${forecast.trendName}`,
      `${forecast.trendName} is currently ${forecast.currentState} with ${forecast.projectedTrajectory} trajectory. ` +
      `Confidence: ${Math.round(forecast.confidence * 100)}%. ` +
      `Key drivers: ${forecast.keyDrivers.slice(0, 2).join(', ')}.`,
      {
        confidence: Math.round(forecast.confidence * 100),
        relatedAgents: ['MARKETING_MANAGER', 'CONTENT_MANAGER', 'PRICING_STRATEGIST'],
        actions: forecast.recommendations,
        tags: ['forecast', forecast.currentState.toLowerCase()],
      }
    );
  }

  /**
   * Get market context from other intelligence agents
   */
  private async getMarketContextFromVault(): Promise<{ sentiments: string[]; signals: string[] }> {
    const vault = getMemoryVault();
    const pendingSignals = await vault.getPendingSignals(this.identity.id);

    const sentiments: string[] = [];
    const signals: string[] = [];

    for (const signal of pendingSignals) {
      signals.push(`${signal.value.signalType}: ${String(signal.value.payload.title ?? 'Unknown')}`);
    }

    // Read sentiment insights
    const sentimentInsights = await readAgentInsights(this.identity.id, {
      type: 'MARKET',
      limit: 5,
    });

    for (const insight of sentimentInsights) {
      sentiments.push(insight.value.summary);
    }

    return { sentiments, signals };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createTrendScout(): TrendScout {
  return new TrendScout();
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: TrendScout | null = null;

export function getTrendScout(): TrendScout {
  instance ??= createTrendScout();
  return instance;
}

// ============================================================================
// INTERNAL TEST HELPERS (exported for proof-of-life harness + regression executor)
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  DEFAULT_SYSTEM_PROMPT,
  loadGMConfig,
  buildSignalSynthesisPrompt,
  stripJsonFences,
  executeSignalSynthesis,
  SignalSynthesisResultSchema,
};
