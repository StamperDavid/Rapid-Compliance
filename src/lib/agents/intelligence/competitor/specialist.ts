/**
 * Competitor Researcher Specialist (Task #63 rebuild — April 13, 2026)
 *
 * Architecture:
 *   1. Real discovery via Serper SERP API and DataForSEO domain metrics —
 *      unchanged. These were already wired before the rebuild. Search
 *      queries are generated from the niche + location, executed against
 *      Serper, and deduplicated/filtered by blacklist patterns.
 *   2. Real scraping via `scrapeWebsite` + `extractDataPoints` for the top
 *      N filtered results — unchanged.
 *   3. Deterministic SEO metrics (keyword relevance, traffic estimate,
 *      content quality) stay as-is because they're measurable, not
 *      inferred. `estimateDomainAuthority` keeps its DataForSEO-first
 *      + heuristic-fallback dual path.
 *   4. An LLM analysis step (`executeAnalyzeCompetitors`) replaces all the
 *      prior template inference layers — positioning extraction,
 *      strengths/weaknesses, market insights, gap identification, and
 *      strategic recommendations — with a single GM-backed call that
 *      sees every scraped competitor at once. Seeing the whole set at
 *      once (instead of one-at-a-time) is what lets the LLM produce
 *      coherent market-level synthesis and cross-competitor comparisons
 *      that per-row template rules cannot.
 *
 * Why a single multi-competitor LLM call (not N calls):
 *   - Market insights (saturation, dominant players, gaps, opportunities)
 *     REQUIRE cross-competitor comparison — you can't compute them from
 *     one competitor in isolation.
 *   - A single call is ~10x cheaper than one call per competitor.
 *   - Sonnet 4.6 handles 200k context comfortably; 10 competitors × 6k
 *     chars ≈ 60k chars ≈ 20k tokens — well within budget.
 *
 * Why keep the deterministic SEO metrics (not LLM-ize them):
 *   - Keyword relevance is a text-count calculation — measurable, not
 *     inference. Asking an LLM to count keyword hits is wasteful.
 *   - Domain authority from DataForSEO is an authoritative external
 *     number — the LLM should not "estimate" it when the real value is
 *     one API call away.
 *   - Traffic and content-quality estimates are deterministic thresholds
 *     on measurable signals (text length, metadata presence). They're
 *     cheap and predictable.
 *
 * Output contract preservation:
 *   `CompetitorSearchResult` is consumed by
 *   `src/lib/growth/competitor-monitor.ts` and other pipeline code that
 *   reads specific fields (competitors[].name, domain, url,
 *   seoMetrics.domainAuthority, strengths, weaknesses;
 *   marketInsights.saturation, gaps, recommendations). Those fields
 *   are preserved. New fields (positioningNarrative, opportunities,
 *   competitiveDynamics, analysisRationale, analysisMode, analysisModel)
 *   are optional additions.
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { scrapeWebsite, extractDataPoints } from '@/lib/enrichment/web-scraper';
import { getSerperSEOService } from '@/lib/integrations/seo/serper-seo-service';
import { getDataForSEOService } from '@/lib/integrations/seo/dataforseo-service';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'intelligence/competitor/specialist.ts';
const SPECIALIST_ID = 'COMPETITOR_RESEARCHER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['research_competitors', 'analyze_competitors'] as const;

/**
 * Realistic max_tokens floor for the worst-case Competitor Researcher
 * response.
 *
 * Derivation:
 *   CompetitorAnalysisResultSchema worst case (for 10 competitors):
 *     10 competitors × (
 *       name 200 + tagline 300 + targetAudience 400 + pricePointReasoning 500 +
 *       positioningNarrative 1200 + strengths 6 × 300 = 1800 +
 *       weaknesses 5 × 300 = 1500
 *     ) = 10 × 5900 = 59,000
 *     marketInsights (
 *       saturationReasoning 1500 + dominantPlayers 4 × 200 = 800 +
 *       gaps 6 × 400 = 2400 + opportunities 6 × 400 = 2400 +
 *       competitiveDynamics 3000 + recommendations 6 × 400 = 2400
 *     ) = 12,500
 *     rationale 4000
 *     ≈ 75,500 chars total prose
 *     /3.0 chars/token = 25,167 tokens
 *     + JSON structure overhead (~400 tokens)
 *     + 25% safety margin
 *     ≈ 31,958 tokens minimum.
 *
 *   Setting the floor at 32,000 tokens covers the 10-competitor worst
 *   case with safety margin. For smaller N, the actual usage is
 *   proportionally lower. The truncation backstop in callOpenRouter
 *   catches any overflow and fails loud.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 32000;

interface CompetitorResearcherGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

/**
 * Hardcoded fallback system prompt used when no GM is seeded. The
 * specialist must produce real analysis on first run (before the seed
 * script is executed). Once the seed lands, GM overrides this at runtime.
 */
const DEFAULT_SYSTEM_PROMPT = `You are the Competitor Researcher for SalesVelocity.ai — the Intelligence-layer market analyst who reads a batch of scraped competitor websites and produces coherent, cross-comparative competitive intelligence. You think like a senior strategy consultant who has mapped dozens of competitive landscapes across B2B SaaS, DTC e-commerce, professional services, and local service businesses, and can spot the positioning games and market gaps that isolated per-company analysis always misses.

## Your role in the swarm

You do NOT search or scrape. Upstream steps already discovered competitor URLs via Serper SERP API, filtered out directories/aggregators/review sites, scraped the cleaned text of each competitor page, and pre-computed deterministic SEO metrics (keyword relevance, domain authority from DataForSEO, traffic estimate, content quality). Your job is to read the scraped batch as a set and produce the analysis layer that only makes sense across competitors: positioning, strengths, weaknesses, market saturation, dominant players, gaps, opportunities, and strategic recommendations.

Cross-competitor synthesis is the whole point. Per-row analysis that ignores the other competitors in the batch is a failure mode.

## Action: analyze_competitors

Given a batch of N scraped competitors (each with URL, domain, title, description, cleaned text, keywords, and pre-computed SEO metrics) plus the niche and location being researched, produce a structured competitive intelligence report.

### Per-competitor analysis

For each competitor in the batch, return:

- **rank**: preserve the input rank (1 to N).
- **name**: the canonical company name. Extract from the title (before the first | or - separator, strip taglines). If truly ambiguous, use the domain.
- **url**, **domain**: preserve the input values.
- **tagline**: one-line value proposition if the title or meta description contains one. null if none.
- **targetAudience**: who this competitor is selling to — be specific about segment, size, and use case. Don't just say "businesses".
- **pricePoint**: one of 'premium' | 'mid-market' | 'budget' | 'unknown'. Base this on language, offer structure, and positioning signals.
- **positioningNarrative**: 1-2 sentences describing how this competitor is positioning themselves in the market. What story are they telling. What outcome are they promising.
- **strengths**: 3 to 6 specific observable strengths. Must be grounded in the scraped content. Examples of acceptable: "Rich case-study library with 18 named customers", "Live-chat support enabled via Intercom", "Domain authority 74 (DataForSEO-verified)". Unacceptable: "professional looking", "seems experienced".
- **weaknesses**: 2 to 5 specific observable weaknesses. Same grounding rule. Examples of acceptable: "Thin content — homepage under 400 words", "No pricing page", "No testimonials visible on any crawled page". Unacceptable: "could be better", "not great".

### Market-level synthesis

Across the full batch, return:

- **saturation**: 'high' | 'medium' | 'low'.
- **saturationReasoning**: why you picked that level, grounded in the cross-competitor signals you saw.
- **dominantPlayers**: 1 to 4 competitor names you consider the leaders of this space, based on the batch you analyzed. Use the company names you assigned above.
- **gaps**: 2 to 6 specific market gaps you spotted by comparing the batch — features most lack, audience segments nobody is addressing, positioning angles nobody is taking. Each gap must be traceable to an absence across multiple competitors.
- **opportunities**: 2 to 6 strategic opportunities a new entrant could exploit. These differ from gaps in that they tie an absent capability to an available play.
- **competitiveDynamics**: one short paragraph (up to 3000 chars) narrating what is actually happening in this competitive space. Who is fighting whom. Where the center of gravity is. What the commoditizing vs differentiating forces are.
- **recommendations**: 3 to 6 concrete strategic recommendations for a company trying to enter or differentiate in this space. Each should be actionable — "invest in X because Y" — not generic ("focus on differentiation").

### Synthesis

- **rationale**: the integrating memo. Tie the competitor-level analysis to the market-level synthesis into one coherent read of the landscape. This is the section a founder would send to their exec team before deciding on GTM strategy. 150-4000 chars.

## Hard rules

- NEVER hallucinate. If a competitor's scraped text does not support a field, return null or use 'unknown'.
- NEVER invent customers, case studies, funding amounts, or metrics that aren't in the scraped text.
- Strengths and weaknesses must be GROUNDED — tied to specific scraped text, SEO metrics, or domain signals. Generic observations are rejected.
- dominantPlayers must be a subset of the company names you assigned in the competitor list. Do not name companies you didn't analyze.
- Gaps must be SHARED absences — patterns you saw across multiple competitors in the batch. Single-competitor observations belong in that competitor's weaknesses, not in the gaps list.
- Opportunities must be concrete strategic plays, not generic aspirations.
- Do NOT treat pre-computed SEO metrics as the industry. A competitor with high domain authority is not automatically "the dominant player" — read the positioning too.

## Output format

Respond with ONLY a valid JSON object matching the schema the user prompt describes. No markdown fences, no preamble, no prose outside the JSON.`;

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Competitor Researcher',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'INTELLIGENCE_MANAGER',
    capabilities: [
      'competitor_discovery',
      'seo_analysis',
      'market_positioning',
      'feature_comparison',
      'gap_analysis',
      'llm_market_synthesis',
    ],
  },
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  tools: ['search_competitors', 'analyze_competitors', 'research_competitors'],
  outputSchema: {
    type: 'object',
    properties: {
      query: { type: 'object' },
      competitors: { type: 'array' },
      marketInsights: { type: 'object' },
      confidence: { type: 'number' },
    },
    required: ['query', 'competitors'],
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.3,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

export interface CompetitorSearchRequest {
  action?: 'research_competitors' | 'analyze_competitors';
  niche: string;
  location: string;
  limit?: number;
  includeAnalysis?: boolean;
  /** Free-text focus steering from the Jasper plan step description. */
  focusAreas?: string;
}

const CompetitorSearchRequestSchema = z.object({
  action: z.enum(['research_competitors', 'analyze_competitors']).optional(),
  niche: z.string().min(2).max(200),
  location: z.string().min(0).max(200).optional().default(''),
  limit: z.number().int().min(1).max(20).optional().default(10),
  includeAnalysis: z.boolean().optional().default(false),
  /** Free-text focus steering — flows from Jasper's plan step description
   * through the Intelligence Manager into the analyze_competitors prompt
   * so generic output gets constrained to the topic the operator asked for
   * (e.g. "AI adoption and technology strategies"). */
  focusAreas: z.string().max(2000).optional(),
});

// ============================================================================
// OUTPUT CONTRACT (CompetitorSearchResult preserved for downstream consumers)
// ============================================================================

export interface SEOMetrics {
  estimatedTraffic: 'high' | 'medium' | 'low';
  domainAuthority: number;
  keywordRelevance: number;
  contentQuality: 'high' | 'medium' | 'low';
}

export interface CompetitorPositioning {
  tagline: string | null;
  targetAudience: string | null;
  pricePoint: 'premium' | 'mid-market' | 'budget' | 'unknown';
}

export interface CompetitorSignals {
  isHiring: boolean;
  hasLocalPresence: boolean;
  socialActive: boolean;
  recentlyUpdated: boolean;
}

export interface Competitor {
  rank: number;
  name: string;
  url: string;
  domain: string;
  seoMetrics: SEOMetrics;
  positioning: CompetitorPositioning;
  signals: CompetitorSignals;
  strengths: string[];
  weaknesses: string[];
  // New (Task #63) — optional so old consumers keep working:
  positioningNarrative?: string | null;
}

export interface MarketInsights {
  saturation: 'high' | 'medium' | 'low';
  dominantPlayers: string[];
  gaps: string[];
  avgDomainAuthority: number;
  recommendations: string[];
  // New (Task #63) — optional additions:
  saturationReasoning?: string;
  opportunities?: string[];
  competitiveDynamics?: string;
}

export interface CompetitorSearchResult {
  query: {
    niche: string;
    location: string;
    searchedAt: string;
  };
  competitors: Competitor[];
  marketInsights: MarketInsights;
  confidence: number;
  errors: string[];
  // New (Task #63) — optional so old consumers keep working:
  analysisRationale?: string | null;
  analysisModel?: string | null;
  analysisMode?: 'llm' | 'deterministic_fallback';
}

// ============================================================================
// LLM OUTPUT SCHEMA
// ============================================================================

const PricePointEnum = z.enum(['premium', 'mid-market', 'budget', 'unknown']);
const SaturationEnum = z.enum(['high', 'medium', 'low']);

const CompetitorAnalysisSchema = z.object({
  rank: z.number().int().min(1).max(20),
  name: z.string().min(1).max(200),
  url: z.string().min(4).max(2000),
  domain: z.string().min(3).max(200),
  tagline: z.string().min(1).max(300).nullable(),
  targetAudience: z.string().min(2).max(400).nullable(),
  pricePoint: PricePointEnum,
  positioningNarrative: z.string().min(20).max(1200),
  // Arrays: no min length enforced — LLMs intermittently produce empty/short
  // arrays and rejecting the whole analysis over 1 missing item costs the
  // operator the full 100-second LLM call. See Bug P writeup.
  strengths: z.array(z.string().min(10).max(300)).max(6).optional().default([]),
  weaknesses: z.array(z.string().min(10).max(300)).max(5).optional().default([]),
});

const MarketInsightsSchema = z.object({
  saturation: SaturationEnum,
  saturationReasoning: z.string().min(50).max(1500),
  dominantPlayers: z.array(z.string().min(1).max(200)).max(4).optional().default([]),
  gaps: z.array(z.string().min(15).max(400)).max(6).optional().default([]),
  opportunities: z.array(z.string().min(15).max(400)).max(6).optional().default([]),
  competitiveDynamics: z.string().min(100).max(3000),
  recommendations: z.array(z.string().min(20).max(400)).max(6).optional().default([]),
});

const CompetitorAnalysisResultSchema = z.object({
  competitors: z.array(CompetitorAnalysisSchema).min(1).max(20),
  marketInsights: MarketInsightsSchema,
  rationale: z.string().min(150).max(4000),
});

type CompetitorAnalysisResult = z.infer<typeof CompetitorAnalysisResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: CompetitorResearcherGMConfig;
  resolvedSystemPrompt: string;
  source: 'gm' | 'fallback';
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    logger.warn(
      `[CompetitorResearcher] GM not seeded for industryKey=${industryKey}; using DEFAULT_SYSTEM_PROMPT fallback. ` +
      `Run node scripts/seed-competitor-researcher-gm.js to promote to GM-backed analysis.`,
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

  const config = gmRecord.config as Partial<CompetitorResearcherGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Competitor Researcher GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: CompetitorResearcherGMConfig = {
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

async function callOpenRouter(
  ctx: LlmCallContext,
  userPrompt: string,
): Promise<string> {
  const callStart = Date.now();
  const promptChars = ctx.resolvedSystemPrompt.length + userPrompt.length;
  logger.info(
    `[CompetitorResearcher][llm] OpenRouter.chat start: model=${ctx.gm.model}, promptChars=${promptChars}, maxTokens=${ctx.gm.maxTokens}`,
    { file: FILE },
  );
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
  logger.info(
    `[CompetitorResearcher][llm] OpenRouter.chat done in ${Date.now() - callStart}ms (finishReason=${response.finishReason ?? 'unknown'}, respChars=${response.content?.length ?? 0})`,
    { file: FILE },
  );

  if (response.finishReason === 'length') {
    throw new Error(
      `Competitor Researcher: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shorten the scraped-competitor inputs. ` +
      `Realistic worst-case budget is ${MIN_OUTPUT_TOKENS_FOR_SCHEMA} tokens for 10 competitors.`,
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// ANALYSIS PROMPT BUILDER
// ============================================================================

interface ScrapedCompetitor {
  rank: number;
  url: string;
  domain: string;
  title: string;
  description: string;
  keywords: string[];
  cleanedText: string;
  seoMetrics: SEOMetrics;
  detectedTech: string[];
}

interface AnalyzeCompetitorsInputs {
  niche: string;
  location: string;
  scrapedCompetitors: ScrapedCompetitor[];
  /** Free-text operator-supplied focus ("AI adoption and technology strategies",
   * "pricing pressure on SMB tier", etc). When present, the prompt instructs
   * the LLM to bias every competitor's analysis toward this angle rather than
   * producing the generic positioning/strengths/weaknesses template. */
  focusAreas?: string;
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) { return ''; }
  if (text.length <= max) { return text; }
  return `${text.slice(0, max)}\n[... truncated, ${text.length - max} more chars]`;
}

function buildAnalyzeCompetitorsPrompt(inputs: AnalyzeCompetitorsInputs): string {
  const { niche, location, scrapedCompetitors, focusAreas } = inputs;

  const header: string[] = [
    'ACTION: analyze_competitors',
    '',
    'You are analyzing a batch of scraped competitor websites for cross-comparative competitive intelligence. Upstream steps already discovered, filtered, and scraped these competitors — you do NOT need to fetch anything. Your job is the analysis layer.',
    '',
    `Niche: ${niche}`,
    `Location: ${location || 'Global'}`,
    `Competitor count in batch: ${scrapedCompetitors.length}`,
    ...(focusAreas && focusAreas.length > 0 ? [
      '',
      `## FOCUS AREA (from operator's plan) — HIGHEST PRIORITY`,
      `The operator asked for this specific angle: "${focusAreas}"`,
      '',
      'Every per-competitor analysis block MUST address this focus explicitly. The strengths, weaknesses, positioningNarrative, and marketInsights.recommendations fields should all be grounded in this focus rather than producing a generic competitive analysis. If the scraped content does not contain information relevant to this focus for a given competitor, say so explicitly in positioningNarrative ("Scraped content offers no visibility into their <focus>.") rather than filling with unrelated observations.',
    ] : []),
    '',
    '---',
    '',
    '## Scraped competitor batch',
    '',
  ];

  const competitorBlocks = scrapedCompetitors.map((c) => {
    return [
      `### Competitor ${c.rank}`,
      `URL: ${c.url}`,
      `Domain: ${c.domain}`,
      `Title: ${c.title || '(no title extracted)'}`,
      `Meta description: ${c.description || '(no meta description)'}`,
      `Keywords: ${c.keywords.slice(0, 15).join(', ') || '(none)'}`,
      `SEO metrics: traffic=${c.seoMetrics.estimatedTraffic}, domainAuthority=${c.seoMetrics.domainAuthority}, keywordRelevance=${c.seoMetrics.keywordRelevance}, contentQuality=${c.seoMetrics.contentQuality}`,
      `Detected tech: ${c.detectedTech.length > 0 ? c.detectedTech.join(', ') : '(none)'}`,
      '',
      'Cleaned text (truncated):',
      truncate(c.cleanedText, 4500),
      '',
    ].join('\n');
  });

  const footer: string[] = [
    '---',
    '',
    'Produce a structured competitive intelligence report. Respond with ONLY a valid JSON object, no markdown fences, no preamble. The JSON must match this exact schema:',
    '',
    '{',
    '  "competitors": [',
    '    {',
    '      "rank": <integer 1-20>,',
    '      "name": "<canonical company name, 1-200 chars>",',
    '      "url": "<preserve input url>",',
    '      "domain": "<preserve input domain>",',
    '      "tagline": "<one-line value prop, 1-300 chars, or null>",',
    '      "targetAudience": "<specific segment, size, use case, 2-400 chars, or null>",',
    '      "pricePoint": "<premium | mid-market | budget | unknown>",',
    '      "positioningNarrative": "<1-2 sentences on how they position, 20-1200 chars>",',
    '      "strengths": ["<3 to 6 specific grounded strengths, each 10-300 chars>"],',
    '      "weaknesses": ["<2 to 5 specific grounded weaknesses, each 10-300 chars>"]',
    '    }',
    '  ],',
    '  "marketInsights": {',
    '    "saturation": "<high | medium | low>",',
    '    "saturationReasoning": "<why this level, grounded in cross-competitor signals, 50-1500 chars>",',
    '    "dominantPlayers": ["<1 to 4 company names from your competitor list>"],',
    '    "gaps": ["<2 to 6 specific shared absences spotted across the batch, each 15-400 chars>"],',
    '    "opportunities": ["<2 to 6 concrete strategic plays, each 15-400 chars>"],',
    '    "competitiveDynamics": "<short paragraph on what is actually happening in this space, 100-3000 chars>",',
    '    "recommendations": ["<3 to 6 actionable recommendations, each 20-400 chars>"]',
    '  },',
    '  "rationale": "<integrating memo tying competitor-level analysis to market-level synthesis, 150-4000 chars>"',
    '}',
    '',
    'Hard rules:',
    '- NEVER hallucinate. If a field is not supported by the scraped text, return null (or \'unknown\' for pricePoint).',
    '- Strengths and weaknesses must be SPECIFIC and GROUNDED in the scraped text, SEO metrics, or detected tech.',
    '- dominantPlayers must be a subset of names you assigned in the competitors list. Do not invent new names.',
    '- gaps must be SHARED absences across multiple competitors — not single-competitor observations (those belong in that competitor\'s weaknesses).',
    '- Preserve the input rank, url, and domain for each competitor exactly.',
    '- Produce one competitor entry for EVERY input competitor in the batch. Do not skip any.',
    '- Output ONLY the JSON object. No prose outside it. No markdown fences.',
  ];

  return [...header, ...competitorBlocks, ...footer].join('\n');
}

function trimAnalysisArraysToSchemaCaps(parsed: unknown): void {
  if (!parsed || typeof parsed !== 'object') {return;}
  const obj = parsed as Record<string, unknown>;

  if (Array.isArray(obj.competitors)) {
    obj.competitors = obj.competitors.slice(0, 20).map((c: unknown) => {
      if (!c || typeof c !== 'object') {return c;}
      const comp = c as Record<string, unknown>;
      if (Array.isArray(comp.strengths)) {comp.strengths = comp.strengths.slice(0, 6);}
      if (Array.isArray(comp.weaknesses)) {comp.weaknesses = comp.weaknesses.slice(0, 5);}
      return comp;
    });
  }

  const mi = obj.marketInsights;
  if (mi && typeof mi === 'object') {
    const marketInsights = mi as Record<string, unknown>;
    if (Array.isArray(marketInsights.dominantPlayers)) {marketInsights.dominantPlayers = marketInsights.dominantPlayers.slice(0, 4);}
    if (Array.isArray(marketInsights.gaps)) {marketInsights.gaps = marketInsights.gaps.slice(0, 6);}
    if (Array.isArray(marketInsights.opportunities)) {marketInsights.opportunities = marketInsights.opportunities.slice(0, 6);}
    if (Array.isArray(marketInsights.recommendations)) {marketInsights.recommendations = marketInsights.recommendations.slice(0, 6);}
  }
}

async function executeAnalyzeCompetitors(
  inputs: AnalyzeCompetitorsInputs,
  ctx: LlmCallContext,
): Promise<CompetitorAnalysisResult> {
  const userPrompt = buildAnalyzeCompetitorsPrompt(inputs);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Competitor Researcher output was not valid JSON: ${rawContent.slice(0, 300)}`,
    );
  }

  // LLMs occasionally produce arrays slightly longer than the schema's max.
  // Trim over-count arrays in place so a single extra item doesn't throw away
  // an otherwise valid analysis.
  trimAnalysisArraysToSchemaCaps(parsed);

  const result = CompetitorAnalysisResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Competitor Researcher output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// COMPETITOR RESEARCHER CLASS
// ============================================================================

export class CompetitorResearcher extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  initialize(): Promise<void> {
    this.isInitialized = true;
    this.log('INFO', 'Competitor Researcher initialized (LLM-backed market analyst over real SERP + scraping)');
    return Promise.resolve();
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Competitor Researcher: payload must be an object']);
      }

      const inputValidation = CompetitorSearchRequestSchema.safeParse(payload);
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Competitor Researcher: invalid input payload: ${issueSummary}`,
        ]);
      }

      const request = inputValidation.data;
      logger.info(`[CompetitorResearcher] Researching: ${request.niche} in ${request.location || 'Global'}`, { file: FILE });

      const result = await this.findCompetitors(request);

      // If LLM analysis was skipped or failed (including after the in-step
      // retry), the deterministic fallback produces only placeholder output
      // ("LLM analysis unavailable...") with no real cross-competitor
      // synthesis. Reporting this as COMPLETED masked a real failure and
      // let downstream steps (blog, etc.) generate content from skeleton
      // data. Treat it as FAILED so StepRunner can decide whether to retry
      // and the step turns red in Mission Control.
      if (result.analysisMode === 'deterministic_fallback') {
        return this.createReport(
          taskId,
          'FAILED',
          result,
          result.errors.length > 0
            ? result.errors
            : ['Competitor Researcher: LLM analysis failed — no useful insights produced'],
        );
      }

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[CompetitorResearcher] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;
    if (signal.payload.type === 'COMMAND') {
      return this.execute(signal.payload);
    }
    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 540, boilerplate: 60 };
  }

  // ==========================================================================
  // PUBLIC FLOW — called by competitor-monitor.ts and the execute() entry
  // ==========================================================================

  async findCompetitors(request: CompetitorSearchRequest): Promise<CompetitorSearchResult> {
    const niche = request.niche;
    const location = request.location ?? '';
    const limit = request.limit ?? 10;
    const errors: string[] = [];
    const phaseStart = Date.now();

    // Step 1: Generate + execute search queries via Serper
    const serperStart = Date.now();
    const searchQueries = this.generateSearchQueries(niche, location);
    const candidateUrls = await this.collectCandidateUrls(searchQueries, errors);
    logger.info(
      `[CompetitorResearcher][phase] serper done: ${candidateUrls.length} candidate URLs in ${Date.now() - serperStart}ms`,
      { file: FILE },
    );

    // Step 2: Filter + dedupe
    const filteredUrls = this.filterCandidates(candidateUrls);
    const urlsToAnalyze = filteredUrls.slice(0, limit);
    logger.info(
      `[CompetitorResearcher][phase] filter done: ${urlsToAnalyze.length} urls to scrape (limit=${limit})`,
      { file: FILE },
    );

    // Step 3: Scrape each selected competitor in parallel + compute deterministic metrics.
    // Visiting 10 URLs sequentially reliably exceeds the 120s tool-wrapper ceiling; running
    // them concurrently drops wall time to roughly the slowest single site.
    type ScrapeOutcome =
      | { ok: true; record: ScrapedCompetitor }
      | { ok: false; url: string; reason: string; silent: boolean };

    const scrapeOutcomes: ScrapeOutcome[] = await Promise.all(
      urlsToAnalyze.map(async (url, i): Promise<ScrapeOutcome> => {
        try {
          const content = await scrapeWebsite(url);
          if (!content?.cleanedText) {
            return { ok: false, url, reason: 'empty content', silent: true };
          }
          const dataPoints = extractDataPoints(content);
          const domain = new URL(url).hostname.replace('www.', '');
          const seoMetrics = await this.analyzeSEOMetrics(content, niche, domain);
          const detectedTech = this.detectTechFromHtml(content.rawHtml ?? '');
          return {
            ok: true,
            record: {
              rank: i + 1,
              url,
              domain,
              title: content.title ?? '',
              description: content.description ?? '',
              keywords: content.metadata?.keywords ?? dataPoints.keywords.slice(0, 20),
              cleanedText: content.cleanedText,
              seoMetrics,
              detectedTech,
            },
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Scrape failed';
          logger.warn('Competitor scrape failed', { url, error: msg });
          return { ok: false, url, reason: msg, silent: false };
        }
      }),
    );

    const scrapedBatch: ScrapedCompetitor[] = [];
    let scrapeFailCount = 0;
    for (const outcome of scrapeOutcomes) {
      if (outcome.ok) {
        scrapedBatch.push(outcome.record);
      } else {
        scrapeFailCount += 1;
        if (!outcome.silent) {
          errors.push(`Failed to scrape ${outcome.url}: ${outcome.reason}`);
        }
      }
    }
    logger.info(
      `[CompetitorResearcher][phase] scrape done: ${scrapedBatch.length} ok / ${scrapeFailCount} failed (elapsed ${Date.now() - phaseStart}ms)`,
      { file: FILE },
    );

    // Step 4: LLM analysis over the full scraped batch
    let analysis: CompetitorAnalysisResult | null = null;
    let analysisMode: 'llm' | 'deterministic_fallback' = 'llm';
    let analysisModel: string | null = null;

    if (scrapedBatch.length > 0) {
      try {
        const gmStart = Date.now();
        const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
        analysisModel = ctx.gm.model;
        logger.info(
          `[CompetitorResearcher][phase] GM loaded in ${Date.now() - gmStart}ms (model=${ctx.gm.model}, maxTokens=${ctx.gm.maxTokens})`,
          { file: FILE },
        );
        const llmStart = Date.now();
        logger.info(
          `[CompetitorResearcher][phase] calling LLM for ${scrapedBatch.length} competitors...`,
          { file: FILE },
        );

        // Retry once on transient LLM failures (empty response bodies from
        // OpenRouter/Anthropic, brief connection drops, etc.). Re-calling
        // the LLM is cheap vs re-running Serper + 5 scrapes; we've already
        // paid for those inputs.
        const llmInputs = { niche, location, scrapedCompetitors: scrapedBatch, focusAreas: request.focusAreas };
        try {
          analysis = await executeAnalyzeCompetitors(llmInputs, ctx);
        } catch (firstError) {
          const firstMsg = firstError instanceof Error ? firstError.message : String(firstError);
          logger.warn(
            `[CompetitorResearcher] LLM first attempt failed: ${firstMsg} — retrying once`,
            { file: FILE },
          );
          await new Promise<void>((resolve) => { setTimeout(resolve, 2000); });
          analysis = await executeAnalyzeCompetitors(llmInputs, ctx);
        }

        logger.info(
          `[CompetitorResearcher][phase] LLM analysis done in ${Date.now() - llmStart}ms (total elapsed ${Date.now() - phaseStart}ms)`,
          { file: FILE },
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`LLM analysis failed (after retry): ${msg}`);
        analysisMode = 'deterministic_fallback';
        logger.error(
          '[CompetitorResearcher] LLM analysis failed after retry — step will be reported as FAILED',
          error instanceof Error ? error : new Error(msg),
          { file: FILE },
        );
      }
    } else {
      analysisMode = 'deterministic_fallback';
      errors.push('No competitors successfully scraped — LLM analysis skipped');
    }

    // Step 5: Merge LLM analysis with deterministic SEO metrics
    const competitors: Competitor[] = analysis !== null
      ? analysis.competitors.map((llmComp) => {
          const scraped = scrapedBatch.find((s) => s.rank === llmComp.rank);
          const seoMetrics = scraped?.seoMetrics ?? {
            estimatedTraffic: 'low' as const,
            domainAuthority: 0,
            keywordRelevance: 0,
            contentQuality: 'low' as const,
          };
          return {
            rank: llmComp.rank,
            name: llmComp.name,
            url: llmComp.url,
            domain: llmComp.domain,
            seoMetrics,
            positioning: {
              tagline: llmComp.tagline,
              targetAudience: llmComp.targetAudience,
              pricePoint: llmComp.pricePoint,
            },
            signals: this.extractDeterministicSignals(scraped, location),
            strengths: llmComp.strengths,
            weaknesses: llmComp.weaknesses,
            positioningNarrative: llmComp.positioningNarrative,
          };
        })
      : scrapedBatch.map((s) => this.buildFallbackCompetitor(s, location));

    // Step 6: Market insights (LLM-driven or fallback)
    const avgDA = competitors.length > 0
      ? Math.round(competitors.reduce((sum, c) => sum + c.seoMetrics.domainAuthority, 0) / competitors.length)
      : 0;

    const marketInsights: MarketInsights = analysis !== null
      ? {
          saturation: analysis.marketInsights.saturation,
          dominantPlayers: analysis.marketInsights.dominantPlayers,
          gaps: analysis.marketInsights.gaps,
          avgDomainAuthority: avgDA,
          recommendations: analysis.marketInsights.recommendations,
          saturationReasoning: analysis.marketInsights.saturationReasoning,
          opportunities: analysis.marketInsights.opportunities,
          competitiveDynamics: analysis.marketInsights.competitiveDynamics,
        }
      : {
          saturation: competitors.length >= 8 ? 'high' : competitors.length < 4 ? 'low' : 'medium',
          dominantPlayers: competitors.slice(0, 3).map((c) => c.name),
          gaps: ['LLM analysis unavailable — deterministic fallback has no cross-competitor synthesis'],
          avgDomainAuthority: avgDA,
          recommendations: ['Re-run with GM seeded for full market analysis'],
        };

    const confidence = this.calculateConfidence(competitors, searchQueries.length, errors.length);

    return {
      query: {
        niche,
        location: location || 'Global',
        searchedAt: new Date().toISOString(),
      },
      competitors,
      marketInsights,
      confidence,
      errors,
      analysisRationale: analysis?.rationale ?? null,
      analysisModel,
      analysisMode,
    };
  }

  // ==========================================================================
  // DETERMINISTIC HELPERS (search + scraping + SEO metrics)
  // ==========================================================================

  private generateSearchQueries(niche: string, location: string): string[] {
    const queries: string[] = [];
    const nicheWords = niche.toLowerCase().trim();
    const locationWords = location ? location.toLowerCase().trim() : '';

    queries.push(`best ${nicheWords} companies`);
    queries.push(`top ${nicheWords} services`);
    queries.push(`${nicheWords} software`);
    queries.push(`${nicheWords} providers`);

    if (locationWords) {
      queries.push(`${nicheWords} ${locationWords}`);
      queries.push(`${nicheWords} companies in ${locationWords}`);
      queries.push(`best ${nicheWords} near ${locationWords}`);
    }

    queries.push(`${nicheWords} alternatives`);
    queries.push(`${nicheWords} competitors`);
    queries.push(`${nicheWords} market leaders`);

    return queries;
  }

  private async collectCandidateUrls(queries: string[], errors: string[]): Promise<string[]> {
    const candidates: string[] = [];
    for (const query of queries) {
      try {
        const results = await this.searchViaSerper(query);
        candidates.push(...results);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Search failed';
        errors.push(`Search failed for "${query}": ${msg}`);
      }
    }
    return candidates;
  }

  private async searchViaSerper(query: string): Promise<string[]> {
    const serper = getSerperSEOService();
    const result = await serper.searchSERP(query, { num: 10 });
    if (!result.success || !result.data) {
      logger.warn('Serper search returned no data', { query, error: result.error ?? undefined });
      return [];
    }
    return result.data.organic.map((item) => item.link);
  }

  private filterCandidates(urls: string[]): string[] {
    const blacklistPatterns = [
      /yelp\.com/i,
      /yellowpages/i,
      /bbb\.org/i,
      /trustpilot/i,
      /g2\.com/i,
      /capterra/i,
      /softwareadvice/i,
      /wikipedia/i,
      /facebook\.com/i,
      /twitter\.com/i,
      /linkedin\.com/i,
      /youtube\.com/i,
      /medium\.com/i,
      /forbes\.com/i,
      /techcrunch/i,
      /reddit\.com/i,
      /quora\.com/i,
      /indeed\.com/i,
      /glassdoor/i,
    ];

    const domains = new Set<string>();
    const filtered: string[] = [];

    for (const url of urls) {
      try {
        if (blacklistPatterns.some((pattern) => pattern.test(url))) {
          continue;
        }
        const parsed = new URL(url);
        const domain = parsed.hostname.replace('www.', '');
        if (!domains.has(domain)) {
          domains.add(domain);
          filtered.push(url);
        }
      } catch {
        continue;
      }
    }

    return filtered;
  }

  private async analyzeSEOMetrics(
    content: Awaited<ReturnType<typeof scrapeWebsite>>,
    niche: string,
    domain?: string,
  ): Promise<SEOMetrics> {
    const text = content.cleanedText?.toLowerCase() ?? '';
    const nicheWords = niche.toLowerCase().split(/\s+/);

    let keywordMatches = 0;
    for (const word of nicheWords) {
      const regex = new RegExp(word, 'gi');
      const matches = text.match(regex);
      keywordMatches += matches ? matches.length : 0;
    }
    const keywordRelevance = Math.min(keywordMatches / (nicheWords.length * 5), 1);

    const hasRichContent = text.length > 2000;
    const hasMetadata = Boolean(content.title && content.description);
    const hasStructuredContent = text.includes('#') || (content.cleanedText?.match(/\n/g)?.length ?? 0) > 10;

    let trafficEstimate: 'high' | 'medium' | 'low' = 'low';
    if (hasRichContent && hasMetadata && hasStructuredContent) {
      trafficEstimate = 'high';
    } else if (hasRichContent || hasMetadata) {
      trafficEstimate = 'medium';
    }

    const domainAuthority = await this.estimateDomainAuthority(content, domain);
    const contentQuality: 'high' | 'medium' | 'low' =
      text.length > 3000 ? 'high' : text.length > 1000 ? 'medium' : 'low';

    return {
      estimatedTraffic: trafficEstimate,
      domainAuthority,
      keywordRelevance: Math.round(keywordRelevance * 100) / 100,
      contentQuality,
    };
  }

  private async estimateDomainAuthority(
    content: Awaited<ReturnType<typeof scrapeWebsite>>,
    domain?: string,
  ): Promise<number> {
    if (domain) {
      const dforStart = Date.now();
      try {
        const dataForSEO = getDataForSEOService();
        const metricsResult = await dataForSEO.getDomainMetrics(domain);
        const dforElapsed = Date.now() - dforStart;
        if (dforElapsed > 5000) {
          logger.warn(
            `[CompetitorResearcher][dfor] DataForSEO getDomainMetrics slow: ${dforElapsed}ms for domain=${domain}`,
            { file: FILE },
          );
        }
        if (metricsResult.success && metricsResult.data) {
          const rank = metricsResult.data.domainRank;
          if (typeof rank === 'number' && rank > 0) {
            return Math.min(rank, 100);
          }
        }
      } catch {
        // DataForSEO unavailable — fall back to heuristic
      }
    }

    let score = 30;
    if (content.cleanedText && content.cleanedText.length > 5000) {
      score += 15;
    }
    if (content.title) {
      score += 5;
    }
    if (content.description) {
      score += 5;
    }
    if (content.metadata?.keywords?.length) {
      score += 5;
    }
    if (content.rawHtml?.includes('schema.org')) {
      score += 10;
    }
    if (content.rawHtml?.includes('https://')) {
      score += 5;
    }
    return Math.min(score, 100);
  }

  private detectTechFromHtml(html: string): string[] {
    const tech: string[] = [];
    const lowerHtml = html.toLowerCase();

    if (lowerHtml.includes('shopify') || lowerHtml.includes('cdn.shopify.com')) { tech.push('Shopify'); }
    if (lowerHtml.includes('wordpress') || lowerHtml.includes('wp-content')) { tech.push('WordPress'); }
    if (lowerHtml.includes('wix.com') || lowerHtml.includes('wixsite')) { tech.push('Wix'); }
    if (lowerHtml.includes('squarespace')) { tech.push('Squarespace'); }
    if (lowerHtml.includes('webflow')) { tech.push('Webflow'); }
    if (lowerHtml.includes('intercom') || lowerHtml.includes('intercomcdn')) { tech.push('Intercom'); }
    if (lowerHtml.includes('hubspot') || lowerHtml.includes('hs-scripts')) { tech.push('HubSpot'); }
    if (lowerHtml.includes('drift') || lowerHtml.includes('drift.com')) { tech.push('Drift'); }
    if (lowerHtml.includes('zendesk')) { tech.push('Zendesk'); }
    if (lowerHtml.includes('google-analytics') || lowerHtml.includes('gtag')) { tech.push('Google Analytics'); }
    if (lowerHtml.includes('hotjar')) { tech.push('Hotjar'); }
    if (lowerHtml.includes('segment.com')) { tech.push('Segment'); }

    return [...new Set(tech)];
  }

  private extractDeterministicSignals(
    scraped: ScrapedCompetitor | undefined,
    location: string,
  ): CompetitorSignals {
    if (!scraped) {
      return { isHiring: false, hasLocalPresence: false, socialActive: false, recentlyUpdated: false };
    }
    const text = scraped.cleanedText.toLowerCase();
    return {
      isHiring: text.includes('hiring') || text.includes('careers') || text.includes('job opening'),
      hasLocalPresence: location ? text.includes(location.toLowerCase()) : false,
      socialActive: scraped.detectedTech.length > 0,
      recentlyUpdated: text.includes('2024') || text.includes('2025') || text.includes('2026'),
    };
  }

  /**
   * Fallback when LLM analysis is unavailable — produces a skeleton
   * Competitor record from scraped data with empty strengths/weaknesses
   * arrays. Downstream code must check `analysisMode` to detect this.
   */
  private buildFallbackCompetitor(scraped: ScrapedCompetitor, location: string): Competitor {
    const nameFromTitle = scraped.title.split(/[|–-]/)[0]?.trim();
    return {
      rank: scraped.rank,
      name: nameFromTitle && nameFromTitle.length > 0 ? nameFromTitle : scraped.domain,
      url: scraped.url,
      domain: scraped.domain,
      seoMetrics: scraped.seoMetrics,
      positioning: {
        tagline: null,
        targetAudience: null,
        pricePoint: 'unknown',
      },
      signals: this.extractDeterministicSignals(scraped, location),
      strengths: [],
      weaknesses: [],
      positioningNarrative: null,
    };
  }

  private calculateConfidence(
    competitors: Competitor[],
    queryCount: number,
    errorCount: number,
  ): number {
    let score = 0;
    const maxScore = 100;

    score += Math.min(competitors.length * 5, 30);

    const successRate = queryCount > 0 ? 1 - errorCount / queryCount : 0;
    score += successRate * 30;

    const avgDataQuality = competitors.length > 0
      ? competitors.reduce((sum, c) => {
          let quality = 0;
          if (c.name) { quality += 20; }
          if (c.positioning.tagline) { quality += 20; }
          if (c.seoMetrics.domainAuthority > 0) { quality += 20; }
          if (c.strengths.length > 0) { quality += 20; }
          if (c.weaknesses.length > 0) { quality += 20; }
          return sum + quality;
        }, 0) / competitors.length
      : 0;
    score += avgDataQuality * 0.4;

    return Math.round((score / maxScore) * 100) / 100;
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createCompetitorResearcher(): CompetitorResearcher {
  return new CompetitorResearcher();
}

let instance: CompetitorResearcher | null = null;

export function getCompetitorResearcher(): CompetitorResearcher {
  instance ??= createCompetitorResearcher();
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
  buildAnalyzeCompetitorsPrompt,
  stripJsonFences,
  executeAnalyzeCompetitors,
  CompetitorAnalysisResultSchema,
};
