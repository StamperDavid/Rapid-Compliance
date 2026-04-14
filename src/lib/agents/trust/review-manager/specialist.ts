/**
 * Review Manager Specialist (REV_MGR) — REAL AI AGENT (Task #53 rebuild, April 14 2026)
 *
 * Before the rebuild, this specialist was a 1400-LOC hardcoded sentiment
 * analysis + response generation engine. SENTIMENT_LEXICON with weighted
 * word lists, EMOTION_PATTERNS keyword matching, TOPIC_PATTERNS keyword
 * libraries, SEO_RESPONSE_TEMPLATES with `{rating}`/`{reviewerName}`
 * placeholder interpolation. Zero LLM calls.
 *
 * Pre-rebuild specialist has NO live `.execute()` callers — only
 * referenced by `agent-factory.ts` and `index.ts` exports. Forward-only
 * rebuild, full freedom over the input/output shape.
 *
 * Note: This is NOT the Review Specialist (Task #51), which is called by
 * the Reputation Manager. This is a SEPARATE bulk-analysis + campaign
 * generation specialist with different scope. Task #51 handles a single
 * review with public reply; Task #53 handles bulk analysis, review-
 * request campaign generation, and trend reports across a batch.
 *
 * Supported actions (discriminated union on `action`):
 *   - analyze_reviews — sentiment + topic + emotion analysis (single or batch)
 *   - generate_campaign — review solicitation campaign plan
 *   - trend_report — period-over-period reputation trend analysis
 *
 * Pattern matches Task #52 GMB Specialist (multi-action via
 * discriminatedUnion) + Task #51 Review Specialist (REQUIRED GM).
 *
 * @module agents/trust/review-manager/specialist
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'trust/review-manager/specialist.ts';
const SPECIALIST_ID = 'REV_MGR';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['analyze_reviews', 'generate_campaign', 'trend_report'] as const;

/**
 * Realistic max_tokens floor — `analyze_reviews` batch is the largest case.
 *
 *   perReviewAnalyses: 30 × (sentiment 200 + emotions 150 + topics 250 + rationale 400) = 30k
 *   aggregate 2500
 *   recommendations 6 × 400 = 2400
 *   rationale 3000
 *   ≈ 38,000 chars / 3 = 12,667 tokens + overhead + margin ≈ 16,000.
 *
 *   Floor: 18,000 tokens.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 18000;

interface ReviewManagerGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Review Manager',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'REPUTATION_MANAGER',
    capabilities: [
      'bulk_sentiment_analysis',
      'review_campaign_generation',
      'trend_reporting',
      'brand_voice_alignment',
      'topic_extraction',
    ],
  },
  systemPrompt: '',
  tools: ['analyze_reviews', 'generate_campaign', 'trend_report'],
  outputSchema: {
    type: 'object',
    properties: { action: { type: 'string' }, data: { type: 'object' } },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.3,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

const PlatformEnum = z.enum([
  'google',
  'yelp',
  'facebook',
  'trustpilot',
  'g2',
  'capterra',
  'tripadvisor',
  'bbb',
]);

const IncomingReviewSchema = z.object({
  id: z.string().min(1).max(300),
  platform: PlatformEnum,
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1).max(5000),
  reviewerName: z.string().min(1).max(200),
  reviewDate: z.union([z.string(), z.date()]),
  verified: z.boolean().optional(),
  photos: z.array(z.string()).max(20).optional(),
  helpfulVotes: z.number().int().min(0).max(10000).optional(),
});

const BusinessContextSchema = z.object({
  brandName: z.string().min(1).max(300),
  industry: z.string().min(1).max(200),
  keywords: z.array(z.string().min(1).max(100)).max(30).optional(),
  brandVoice: z.object({
    tone: z.enum(['professional', 'friendly', 'casual', 'luxury', 'technical']),
    personality: z.array(z.string().min(1).max(100)).max(10).optional(),
    avoidWords: z.array(z.string().min(1).max(100)).max(20).optional(),
    preferredPhrases: z.array(z.string().min(1).max(200)).max(20).optional(),
    signatureStyle: z.string().max(500).optional(),
  }).optional(),
  seoKeywords: z.array(z.string().min(1).max(100)).max(30).optional(),
  competitorNames: z.array(z.string().min(1).max(200)).max(10).optional(),
});

const AnalyzeReviewsPayloadSchema = z.object({
  action: z.literal('analyze_reviews'),
  businessContext: BusinessContextSchema,
  reviews: z.array(IncomingReviewSchema).min(1).max(30),
});

const GenerateCampaignPayloadSchema = z.object({
  action: z.literal('generate_campaign'),
  businessContext: BusinessContextSchema,
  campaignConfig: z.object({
    targetAudience: z.string().min(3).max(500),
    goal: z.enum(['volume', 'quality', 'recency', 'competitor_defense', 'new_location']),
    channels: z.array(z.enum(['email', 'sms', 'qr_code', 'receipt', 'post_purchase', 'review_widget'])).min(1).max(6),
    incentive: z.string().max(500).optional(),
    durationDays: z.number().int().min(1).max(90).optional().default(30),
  }),
});

const TrendReportPayloadSchema = z.object({
  action: z.literal('trend_report'),
  businessContext: BusinessContextSchema,
  reviewsByPeriod: z.array(z.object({
    periodLabel: z.string().min(1).max(100),
    reviewCount: z.number().int().min(0),
    averageRating: z.number().min(0).max(5),
    sentimentScore: z.number().min(-1).max(1).optional(),
    topThemes: z.array(z.string().min(1).max(200)).max(10).optional(),
  })).min(2).max(12),
});

const ReviewManagerPayloadSchema = z.discriminatedUnion('action', [
  AnalyzeReviewsPayloadSchema,
  GenerateCampaignPayloadSchema,
  TrendReportPayloadSchema,
]);

export type ReviewManagerPayload = z.infer<typeof ReviewManagerPayloadSchema>;
export type BusinessContext = z.infer<typeof BusinessContextSchema>;
export type IncomingReview = z.infer<typeof IncomingReviewSchema>;
export type ReviewManagerRequest = ReviewManagerPayload;

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================

const SentimentLevelEnum = z.enum(['VERY_NEGATIVE', 'NEGATIVE', 'NEUTRAL', 'POSITIVE', 'VERY_POSITIVE']);
const UrgencyEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const PerReviewAnalysisSchema = z.object({
  reviewId: z.string().min(1).max(300),
  sentiment: z.object({
    level: SentimentLevelEnum,
    score: z.number().min(-1).max(1),
    confidence: z.number().min(0).max(1),
  }),
  urgency: UrgencyEnum,
  dominantEmotion: z.enum([
    'frustration',
    'anger',
    'disappointment',
    'satisfaction',
    'delight',
    'gratitude',
    'trust',
    'concern',
    'neutral',
  ]),
  topics: z.array(z.object({
    topic: z.string().min(2).max(100),
    sentiment: SentimentLevelEnum,
    excerpt: z.string().min(5).max(400),
  })).min(1).max(6),
  rationale: z.string().min(20).max(600),
});

const AnalyzeReviewsResultSchema = z.object({
  action: z.literal('analyze_reviews'),
  perReviewAnalyses: z.array(PerReviewAnalysisSchema).min(1).max(30),
  aggregate: z.object({
    averageSentimentScore: z.number().min(-1).max(1),
    sentimentDistribution: z.object({
      VERY_NEGATIVE: z.number().int().min(0),
      NEGATIVE: z.number().int().min(0),
      NEUTRAL: z.number().int().min(0),
      POSITIVE: z.number().int().min(0),
      VERY_POSITIVE: z.number().int().min(0),
    }),
    topTopics: z.array(z.object({
      topic: z.string().min(2).max(100),
      mentions: z.number().int().min(1),
      averageSentiment: z.number().min(-1).max(1),
    })).max(8),
    criticalReviewsCount: z.number().int().min(0),
  }),
  recommendations: z.array(z.string().min(15).max(400)).min(2).max(6),
  rationale: z.string().min(100).max(3000),
});

const CampaignStepSchema = z.object({
  day: z.number().int().min(0).max(90),
  channel: z.enum(['email', 'sms', 'qr_code', 'receipt', 'post_purchase', 'review_widget']),
  messageTitle: z.string().min(3).max(200),
  messageBody: z.string().min(20).max(1500),
  callToAction: z.string().min(3).max(200),
  rationale: z.string().min(10).max(400),
});

const GenerateCampaignResultSchema = z.object({
  action: z.literal('generate_campaign'),
  campaignName: z.string().min(5).max(200),
  targetCount: z.object({
    low: z.number().int().min(1),
    mid: z.number().int().min(1),
    high: z.number().int().min(1),
  }),
  expectedResponseRate: z.object({
    min: z.number().min(0).max(1),
    max: z.number().min(0).max(1),
  }),
  steps: z.array(CampaignStepSchema).min(2).max(6),
  successMetrics: z.array(z.string().min(10).max(300)).min(2).max(5),
  riskFactors: z.array(z.string().min(10).max(300)).max(5),
  rationale: z.string().min(100).max(3000),
});

const TrendReportResultSchema = z.object({
  action: z.literal('trend_report'),
  trendDirection: z.enum(['improving', 'declining', 'stable', 'volatile']),
  periodOverPeriod: z.array(z.object({
    periodLabel: z.string().min(1).max(100),
    averageRatingDelta: z.number().min(-5).max(5),
    sentimentDelta: z.number().min(-2).max(2),
    keyShifts: z.array(z.string().min(5).max(300)).max(3),
  })),
  emergingThemes: z.array(z.string().min(5).max(300)).max(5),
  regressingThemes: z.array(z.string().min(5).max(300)).max(5),
  executiveSummary: z.string().min(100).max(2500),
  actionItems: z.array(z.string().min(15).max(400)).min(2).max(6),
  rationale: z.string().min(100).max(3000),
});

const ReviewManagerResultSchema = z.discriminatedUnion('action', [
  AnalyzeReviewsResultSchema,
  GenerateCampaignResultSchema,
  TrendReportResultSchema,
]);

export type ReviewManagerResult = z.infer<typeof ReviewManagerResultSchema>;
export type AnalyzeReviewsResult = z.infer<typeof AnalyzeReviewsResultSchema>;
export type GenerateCampaignResult = z.infer<typeof GenerateCampaignResultSchema>;
export type TrendReportResult = z.infer<typeof TrendReportResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: ReviewManagerGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Review Manager GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-review-manager-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<ReviewManagerGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(`Review Manager GM ${gmRecord.id} has no usable systemPrompt`);
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);
  return {
    gm: {
      systemPrompt,
      model: config.model ?? 'claude-sonnet-4.6',
      temperature: config.temperature ?? 0.3,
      maxTokens: effectiveMaxTokens,
      supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
    },
    resolvedSystemPrompt: systemPrompt,
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
      `Review Manager: LLM response truncated at maxTokens=${ctx.gm.maxTokens} (finish_reason='length')`,
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

function formatBusinessContext(ctx: BusinessContext): string {
  const lines = [
    `Brand: ${ctx.brandName}`,
    `Industry: ${ctx.industry}`,
  ];
  if (ctx.keywords && ctx.keywords.length > 0) {
    lines.push(`Brand keywords: ${ctx.keywords.join(', ')}`);
  }
  if (ctx.seoKeywords && ctx.seoKeywords.length > 0) {
    lines.push(`SEO keywords: ${ctx.seoKeywords.join(', ')}`);
  }
  if (ctx.brandVoice) {
    lines.push(`Brand voice: ${ctx.brandVoice.tone}${ctx.brandVoice.personality ? ` (${ctx.brandVoice.personality.join(', ')})` : ''}`);
    if (ctx.brandVoice.avoidWords && ctx.brandVoice.avoidWords.length > 0) {
      lines.push(`Avoid words: ${ctx.brandVoice.avoidWords.join(', ')}`);
    }
  }
  if (ctx.competitorNames && ctx.competitorNames.length > 0) {
    lines.push(`Competitors: ${ctx.competitorNames.join(', ')}`);
  }
  return lines.join('\n');
}

function buildAnalyzeReviewsPrompt(req: z.infer<typeof AnalyzeReviewsPayloadSchema>): string {
  return [
    'ACTION: analyze_reviews',
    '',
    '## Business context',
    formatBusinessContext(req.businessContext),
    '',
    `## ${req.reviews.length} reviews to analyze`,
    req.reviews
      .map((r) => `[${r.id}] ${r.platform} ${r.rating}★ by ${r.reviewerName}: "${r.text.slice(0, 600)}"`)
      .join('\n'),
    '',
    '---',
    '',
    'Analyze sentiment, emotions, topics across all reviews. Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "action": "analyze_reviews",',
    '  "perReviewAnalyses": [',
    '    { "reviewId", "sentiment": { "level": "<VERY_NEGATIVE|NEGATIVE|NEUTRAL|POSITIVE|VERY_POSITIVE>", "score": <-1 to 1>, "confidence": <0-1> }, "urgency": "<LOW|MEDIUM|HIGH|CRITICAL>", "dominantEmotion": "<frustration|anger|disappointment|satisfaction|delight|gratitude|trust|concern|neutral>", "topics": [{ "topic", "sentiment", "excerpt" }], "rationale" }',
    '  ],',
    '  "aggregate": { "averageSentimentScore", "sentimentDistribution": { "VERY_NEGATIVE", "NEGATIVE", "NEUTRAL", "POSITIVE", "VERY_POSITIVE" }, "topTopics": [{ "topic", "mentions", "averageSentiment" }], "criticalReviewsCount" },',
    '  "recommendations": ["<2-6 specific actions the business should take based on this batch>"],',
    '  "rationale": "<100-3000 chars synthesizing the batch>"',
    '}',
    '',
    `Hard rules: perReviewAnalyses MUST have exactly ${req.reviews.length} entries. Every reviewId MUST appear. sentimentDistribution sum MUST equal ${req.reviews.length}.`,
  ].join('\n');
}

function buildGenerateCampaignPrompt(req: z.infer<typeof GenerateCampaignPayloadSchema>): string {
  return [
    'ACTION: generate_campaign',
    '',
    '## Business context',
    formatBusinessContext(req.businessContext),
    '',
    '## Campaign config',
    `Target audience: ${req.campaignConfig.targetAudience}`,
    `Goal: ${req.campaignConfig.goal}`,
    `Channels: ${req.campaignConfig.channels.join(', ')}`,
    req.campaignConfig.incentive ? `Incentive: ${req.campaignConfig.incentive}` : 'No incentive',
    `Duration: ${req.campaignConfig.durationDays} days`,
    '',
    '---',
    '',
    'Design a review solicitation campaign. Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "action": "generate_campaign",',
    '  "campaignName": "<specific name>",',
    '  "targetCount": { "low", "mid", "high" },',
    '  "expectedResponseRate": { "min": <0-1>, "max": <0-1> },',
    '  "steps": [2-6 { "day" (0-90), "channel": "<from channels list>", "messageTitle", "messageBody" (plain text, actual brand name — NO placeholders), "callToAction", "rationale" }],',
    '  "successMetrics": ["<2-5 measurable KPIs>"],',
    '  "riskFactors": ["<0-5 risks — TOS violations, response fatigue, wrong timing>"],',
    '  "rationale": "<100-3000 chars>"',
    '}',
    '',
    'Hard rules: Plain text in messageBody, no markdown. Step channels MUST be from the input channels list. Use actual brand name. Respect platform TOS — never offer incentives explicitly tied to positive reviews (use "for your honest feedback" framing).',
  ].join('\n');
}

function buildTrendReportPrompt(req: z.infer<typeof TrendReportPayloadSchema>): string {
  return [
    'ACTION: trend_report',
    '',
    '## Business context',
    formatBusinessContext(req.businessContext),
    '',
    '## Historical period data',
    req.reviewsByPeriod
      .map((p) => `  - ${p.periodLabel}: ${p.reviewCount} reviews, avg rating ${p.averageRating}, sentiment ${p.sentimentScore ?? 'n/a'}, themes: ${p.topThemes?.join(', ') ?? 'n/a'}`)
      .join('\n'),
    '',
    '---',
    '',
    'Analyze reputation trends across periods. Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "action": "trend_report",',
    '  "trendDirection": "<improving|declining|stable|volatile>",',
    '  "periodOverPeriod": [{ "periodLabel", "averageRatingDelta", "sentimentDelta", "keyShifts": [] }],',
    '  "emergingThemes": ["<0-5 themes growing in frequency or intensity>"],',
    '  "regressingThemes": ["<0-5 themes fading>"],',
    '  "executiveSummary": "<100-2500 chars, C-suite audience>",',
    '  "actionItems": ["<2-6 specific actions>"],',
    '  "rationale": "<100-3000 chars>"',
    '}',
  ].join('\n');
}

function buildUserPrompt(payload: ReviewManagerPayload): string {
  switch (payload.action) {
    case 'analyze_reviews': return buildAnalyzeReviewsPrompt(payload);
    case 'generate_campaign': return buildGenerateCampaignPrompt(payload);
    case 'trend_report': return buildTrendReportPrompt(payload);
  }
}

async function executeReviewManagerAction(
  payload: ReviewManagerPayload,
  ctx: LlmCallContext,
): Promise<ReviewManagerResult> {
  const userPrompt = buildUserPrompt(payload);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Review Manager output was not valid JSON: ${rawContent.slice(0, 300)}`);
  }

  const result = ReviewManagerResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Review Manager output did not match expected schema: ${issueSummary}`);
  }

  const data = result.data;

  // Enforce analyze_reviews batch-count invariant
  if (payload.action === 'analyze_reviews' && data.action === 'analyze_reviews') {
    if (data.perReviewAnalyses.length !== payload.reviews.length) {
      throw new Error(
        `Review Manager: perReviewAnalyses has ${data.perReviewAnalyses.length} entries but expected ${payload.reviews.length}`,
      );
    }
    const distSum =
      data.aggregate.sentimentDistribution.VERY_NEGATIVE +
      data.aggregate.sentimentDistribution.NEGATIVE +
      data.aggregate.sentimentDistribution.NEUTRAL +
      data.aggregate.sentimentDistribution.POSITIVE +
      data.aggregate.sentimentDistribution.VERY_POSITIVE;
    if (distSum !== payload.reviews.length) {
      throw new Error(
        `Review Manager: aggregate.sentimentDistribution sums to ${distSum} but expected ${payload.reviews.length}`,
      );
    }
  }

  return data;
}

// ============================================================================
// REVIEW MANAGER CLASS
// ============================================================================

export class ReviewManagerSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Review Manager initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const rawPayload = message.payload as Record<string, unknown> | null;
      if (rawPayload === null || typeof rawPayload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Review Manager: payload must be an object']);
      }

      const normalized = this.normalizePayload(rawPayload);

      const inputValidation = ReviewManagerPayloadSchema.safeParse(normalized);
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Review Manager: invalid input payload: ${issueSummary}`,
        ]);
      }

      const payload = inputValidation.data;
      logger.info(
        `[ReviewManager] Executing action=${payload.action} taskId=${taskId}`,
        { file: FILE },
      );

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
      const result = await executeReviewManagerAction(payload, ctx);

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[ReviewManager] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * Accept legacy pre-rebuild payload shape:
   *   { action: 'ANALYZE'|'RESPOND'|'CAMPAIGN'|'BULK_ANALYZE'|'TREND_REPORT', businessContext, payload }
   * Map to new discriminatedUnion actions.
   */
  private normalizePayload(raw: Record<string, unknown>): Record<string, unknown> {
    const legacyMap: Record<string, 'analyze_reviews' | 'generate_campaign' | 'trend_report'> = {
      'ANALYZE': 'analyze_reviews',
      'BULK_ANALYZE': 'analyze_reviews',
      'RESPOND': 'analyze_reviews', // Response generation moved to REVIEW_SPECIALIST (Task #51)
      'CAMPAIGN': 'generate_campaign',
      'TREND_REPORT': 'trend_report',
      'analyze_reviews': 'analyze_reviews',
      'generate_campaign': 'generate_campaign',
      'trend_report': 'trend_report',
    };

    const rawAction = typeof raw.action === 'string' ? raw.action : 'analyze_reviews';
    const mappedAction = legacyMap[rawAction] ?? 'analyze_reviews';

    // Legacy payload-within-payload shape
    const nestedPayload = (raw.payload !== null && typeof raw.payload === 'object') ? raw.payload as Record<string, unknown> : {};
    const businessContext = raw.businessContext ?? raw.business_context;

    if (mappedAction === 'analyze_reviews') {
      const reviews = nestedPayload.reviews ?? (nestedPayload.review ? [nestedPayload.review] : raw.reviews);
      return { action: 'analyze_reviews', businessContext, reviews };
    }
    if (mappedAction === 'generate_campaign') {
      return {
        action: 'generate_campaign',
        businessContext,
        campaignConfig: nestedPayload.campaignConfig ?? raw.campaignConfig,
      };
    }
    return {
      action: 'trend_report',
      businessContext,
      reviewsByPeriod: nestedPayload.reviewsByPeriod ?? raw.reviewsByPeriod,
    };
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const message: AgentMessage = {
      id: signal.id,
      timestamp: signal.createdAt,
      from: signal.origin,
      to: this.identity.id,
      type: 'COMMAND',
      priority: 'NORMAL',
      payload: signal.payload.payload,
      requiresResponse: true,
      traceId: signal.id,
    };
    return this.execute(message);
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 640, boilerplate: 90 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createReviewManagerSpecialist(): ReviewManagerSpecialist {
  return new ReviewManagerSpecialist();
}

let instance: ReviewManagerSpecialist | null = null;

export function getReviewManagerSpecialist(): ReviewManagerSpecialist {
  instance ??= createReviewManagerSpecialist();
  return instance;
}

// ============================================================================
// INTERNAL TEST HELPERS
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  loadGMConfig,
  stripJsonFences,
  buildUserPrompt,
  executeReviewManagerAction,
  ReviewManagerPayloadSchema,
  ReviewManagerResultSchema,
};
