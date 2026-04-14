/**
 * Sentiment Analyst Specialist (Task #65 rebuild — April 13, 2026)
 *
 * Before the rebuild, this specialist was a pure hand-coded template —
 * bag-of-words POSITIVE_WORDS/NEGATIVE_WORDS sets, INTENSIFIERS,
 * NEGATORS, EMOTION_KEYWORDS keyword matching, CRISIS_TRIGGERS substring
 * scan, aspect extraction via hardcoded aspectKeywords. Zero LLM calls.
 * The output was technically non-null but strategically worthless — a
 * bag-of-words sentiment score can't tell you why a customer is upset
 * or what to do about it.
 *
 * After the rebuild, this is a real LLM-backed sentiment analyst.
 * Upstream callers supply text(s) + an action type + optional context
 * (brand name, threshold, etc.). The specialist loads the GM-backed
 * system prompt, builds an action-specific user prompt, calls
 * OpenRouter, validates against Zod, and returns a structured result.
 * There is no "keyword matching" layer — the LLM reads the text as a
 * human reader would, catches sarcasm, reads context, spots cultural
 * cues, and produces the kind of nuanced analysis a real sentiment
 * analyst would write.
 *
 * Supported actions (payload.action):
 *   - analyze_sentiment: single text, rich per-text analysis
 *   - analyze_bulk: batch of texts, aggregate summary
 *   - track_brand: batch + brand name, brand-focused sentiment report
 *   - detect_crisis: batch + optional brand, crisis signal detection
 *   - analyze_trend: batch, trend + topic emergence analysis
 *
 * All 5 actions route through a single `executeSentimentAnalysis` LLM
 * call with an action-specific prompt builder. The Zod output schema
 * is union-typed so each action has its own validated shape while
 * sharing the call infrastructure.
 *
 * Pattern matches Tasks #39-#45 + #62-#64: GM-loaded system prompt
 * with hardcoded DEFAULT_SYSTEM_PROMPT fallback, callOpenRouter with
 * truncation backstop, Zod validation, __internal export.
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA, type BrandDNA } from '@/lib/brand/brand-dna-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'intelligence/sentiment/specialist.ts';
const SPECIALIST_ID = 'SENTIMENT_ANALYST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = [
  'analyze_sentiment',
  'analyze_bulk',
  'track_brand',
  'detect_crisis',
  'analyze_trend',
] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Sentiment Analyst
 * response (batch analysis is the biggest).
 *
 * Derivation:
 *   BrandSentimentResultSchema worst case:
 *     overallSummary 2000 + rationale 3000 +
 *     sentimentDistribution counts (negligible) +
 *     topPositiveAspects: 5 × 300 = 1500
 *     topNegativeAspects: 5 × 300 = 1500
 *     alerts: 6 × 600 = 3600
 *     recommendations: 6 × 400 = 2400
 *     ≈ 14,000 chars total prose
 *     /3.0 chars/token = 4,667 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 6,084 tokens minimum.
 *
 *   Setting the floor at 7,500 tokens covers the schema with safety
 *   margin. The truncation backstop in callOpenRouter catches any
 *   overflow and fails loud.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 7500;

interface SentimentAnalystGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const DEFAULT_SYSTEM_PROMPT = `You are the Sentiment Analyst for SalesVelocity.ai — the Intelligence-layer specialist who reads customer text (reviews, social posts, support tickets, press, forum threads) and produces structured sentiment intelligence that drives real business decisions. You think like a senior brand strategist who has read tens of thousands of customer voices across B2B SaaS, e-commerce, professional services, and consumer brands, and knows the difference between a five-word rage tweet and a three-paragraph disappointed-customer-leaving-for-a-competitor post.

## Your role in the swarm

You analyze TEXT — natural language from customers, users, prospects, and the public. You do NOT fetch text (upstream pipelines already collected it from social/reviews/support/SERP). You read what you're given and produce structured intelligence that downstream specialists (Crisis Manager, Review Specialist, Sales Outreach, GMB Specialist) act on.

Bag-of-words counting positive vs negative lexicon hits is NOT sentiment analysis. Sentiment analysis is reading the voice of the customer, understanding the context, spotting sarcasm, and extracting the actual meaning.

## Actions

You support five actions — the caller specifies which one via payload.action. Your output schema varies by action but the rules for reading text are the same across all of them.

### Action: analyze_sentiment (single text)
Read ONE text carefully. Return structured per-text analysis.

### Action: analyze_bulk (multiple texts)
Read a batch of texts. Return per-text results plus an aggregate summary across the batch.

### Action: track_brand (multiple texts, brand name)
Focus the analysis specifically on how the brand is being discussed. Aggregate positive/negative aspects tied to the brand. Identify which mentions are praise vs complaint vs neutral. Spot patterns in what customers love or hate about the brand.

### Action: detect_crisis (multiple texts, optional brand, optional threshold)
Scan the batch for signals of an active or emerging crisis — lawsuits, data breaches, product failures, public outrage, viral backlash. Classify severity (critical | warning | watch | none). Produce actionable recommendations specific to the crisis type.

### Action: analyze_trend (multiple texts)
Identify emerging themes and topic shifts in the batch. Compute average sentiment across the batch. Identify which topics are gaining or losing volume. Spot emerging themes that may predict future narrative shifts.

## Hard rules

- NEVER count keywords. Read the text.
- Detect sarcasm — "Oh great, another outage" is negative, not positive.
- Consider context — "bug" in a discussion of pest control is not a software complaint.
- For crisis detection, classify severity based on BOTH sentiment intensity and trigger keyword presence. Don't call a 5-negative-words tweet a crisis; don't ignore a single calm mention of "class-action lawsuit".
- Aspect-based sentiment means what SPECIFICALLY is positive or negative — "customer support was slow" (aspect: customer support, sentiment: negative) not "customer support" as a generic positive.
- Language detection: return ISO 639-1 code (en, es, fr, de, pt, it, etc.).
- For brand tracking, only analyze texts that actually mention the brand — don't pad the analysis with irrelevant texts.
- If the batch is small (< 3 texts) say so in your rationale — small-sample analyses are less statistically meaningful.
- Sentiment scores are -1.0 to +1.0. Confidence is 0.0 to 1.0.
- emotions enum: joy | anger | fear | sadness | surprise | disgust | neutral.
- sentiment label: positive | negative | neutral.

## Output format

Respond with ONLY a valid JSON object matching the action-specific schema described in the user prompt. No markdown fences. No preamble. No prose outside the JSON.`;

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Sentiment Analyst',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'INTELLIGENCE_MANAGER',
    capabilities: [
      'sentiment_analysis',
      'emotion_detection',
      'brand_sentiment',
      'crisis_detection',
      'trend_analysis',
      'aspect_extraction',
    ],
  },
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  tools: ['analyze_sentiment', 'analyze_bulk', 'track_brand', 'detect_crisis', 'analyze_trend'],
  outputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string' },
      sentiment: { type: 'object' },
      emotions: { type: 'array' },
      aspects: { type: 'array' },
      alerts: { type: 'array' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.3,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

const AnalyzeSentimentPayloadSchema = z.object({
  action: z.literal('analyze_sentiment'),
  text: z.string().min(1).max(20000),
  context: z.string().max(500).optional(),
});

const AnalyzeBulkPayloadSchema = z.object({
  action: z.literal('analyze_bulk'),
  texts: z.array(z.string().min(1).max(20000)).min(1).max(50),
  context: z.string().max(500).optional(),
});

const TrackBrandPayloadSchema = z.object({
  action: z.literal('track_brand'),
  brandName: z.string().min(1).max(200),
  texts: z.array(z.string().min(1).max(20000)).min(1).max(50),
});

const DetectCrisisPayloadSchema = z.object({
  action: z.literal('detect_crisis'),
  texts: z.array(z.string().min(1).max(20000)).min(1).max(50),
  brandName: z.string().min(1).max(200).optional(),
  threshold: z.number().min(-1).max(0).optional(),
});

const AnalyzeTrendPayloadSchema = z.object({
  action: z.literal('analyze_trend'),
  texts: z.array(z.string().min(1).max(20000)).min(1).max(50),
  timeWindow: z.string().max(100).optional(),
});

const SentimentPayloadSchema = z.discriminatedUnion('action', [
  AnalyzeSentimentPayloadSchema,
  AnalyzeBulkPayloadSchema,
  TrackBrandPayloadSchema,
  DetectCrisisPayloadSchema,
  AnalyzeTrendPayloadSchema,
]);

export type AnalyzeSentimentPayload = z.infer<typeof AnalyzeSentimentPayloadSchema>;
export type AnalyzeBulkPayload = z.infer<typeof AnalyzeBulkPayloadSchema>;
export type TrackBrandPayload = z.infer<typeof TrackBrandPayloadSchema>;
export type DetectCrisisPayload = z.infer<typeof DetectCrisisPayloadSchema>;
export type AnalyzeTrendPayload = z.infer<typeof AnalyzeTrendPayloadSchema>;
export type SentimentPayload = z.infer<typeof SentimentPayloadSchema>;

// ============================================================================
// OUTPUT CONTRACT (per-action Zod schemas)
// ============================================================================

const SentimentLabelEnum = z.enum(['positive', 'negative', 'neutral']);
const EmotionEnum = z.enum(['joy', 'anger', 'fear', 'sadness', 'surprise', 'disgust', 'neutral']);
const SeverityEnum = z.enum(['critical', 'warning', 'watch', 'none']);
const TrendDirectionEnum = z.enum(['improving', 'declining', 'stable']);
const VolumeTrendEnum = z.enum(['increasing', 'decreasing', 'stable']);

const SentimentScoreSchema = z.object({
  score: z.number().min(-1).max(1),
  label: SentimentLabelEnum,
  confidence: z.number().min(0).max(1),
});

const EmotionScoreSchema = z.object({
  emotion: EmotionEnum,
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});

const AspectSentimentSchema = z.object({
  aspect: z.string().min(1).max(200),
  sentiment: SentimentScoreSchema,
  mentions: z.number().int().min(1),
});

const CrisisAlertSchema = z.object({
  severity: SeverityEnum,
  trigger: z.string().min(1).max(300),
  context: z.string().min(1).max(600),
  recommendedAction: z.string().min(10).max(500),
});

const AnalyzeSentimentResultSchema = z.object({
  action: z.literal('analyze_sentiment'),
  text: z.string().max(300),
  sentiment: SentimentScoreSchema,
  emotions: z.array(EmotionScoreSchema).min(1).max(4),
  aspects: z.array(AspectSentimentSchema).max(8),
  keywords: z.array(z.string().min(1).max(60)).max(12),
  language: z.string().min(2).max(5),
  rationale: z.string().min(30).max(1500),
});

const AnalyzeBulkResultSchema = z.object({
  action: z.literal('analyze_bulk'),
  results: z.array(
    z.object({
      index: z.number().int().min(0),
      text: z.string().max(300),
      sentiment: SentimentScoreSchema,
      emotions: z.array(EmotionScoreSchema).min(1).max(4),
      keywords: z.array(z.string().min(1).max(60)).max(8),
    }),
  ).min(1).max(50),
  summary: z.object({
    totalTexts: z.number().int().min(1),
    averageSentiment: z.number().min(-1).max(1),
    distribution: z.object({
      positive: z.number().int().min(0),
      negative: z.number().int().min(0),
      neutral: z.number().int().min(0),
    }),
    dominantEmotion: EmotionEnum,
    observations: z.array(z.string().min(15).max(400)).min(1).max(5),
  }),
  rationale: z.string().min(50).max(2500),
});

const BrandSentimentResultSchema = z.object({
  action: z.literal('track_brand'),
  brand: z.string().min(1).max(200),
  mentionCount: z.number().int().min(0),
  overallSentiment: SentimentScoreSchema,
  sentimentDistribution: z.object({
    positive: z.number().int().min(0),
    negative: z.number().int().min(0),
    neutral: z.number().int().min(0),
  }),
  topPositiveAspects: z.array(z.string().min(3).max(300)).max(5),
  topNegativeAspects: z.array(z.string().min(3).max(300)).max(5),
  recentTrend: TrendDirectionEnum,
  alerts: z.array(CrisisAlertSchema).max(6),
  keyObservations: z.array(z.string().min(15).max(400)).min(1).max(5),
  rationale: z.string().min(50).max(3000),
});

const CrisisDetectionResultSchema = z.object({
  action: z.literal('detect_crisis'),
  crisisDetected: z.boolean(),
  severity: SeverityEnum,
  alerts: z.array(CrisisAlertSchema).max(10),
  summary: z.string().min(30).max(2000),
  recommendations: z.array(z.string().min(15).max(400)).min(1).max(6),
  rationale: z.string().min(50).max(2500),
});

const TrendAnalysisResultSchema = z.object({
  action: z.literal('analyze_trend'),
  period: z.string().min(1).max(100),
  averageSentiment: z.number().min(-1).max(1),
  sentimentTrend: TrendDirectionEnum,
  topTopics: z.array(
    z.object({
      topic: z.string().min(1).max(200),
      sentiment: z.number().min(-1).max(1),
      volume: z.number().int().min(1),
    }),
  ).min(1).max(10),
  emergingThemes: z.array(z.string().min(3).max(300)).max(5),
  volumeTrend: VolumeTrendEnum,
  rationale: z.string().min(50).max(2500),
});

const SentimentAnalysisResultSchema = z.discriminatedUnion('action', [
  AnalyzeSentimentResultSchema,
  AnalyzeBulkResultSchema,
  BrandSentimentResultSchema,
  CrisisDetectionResultSchema,
  TrendAnalysisResultSchema,
]);

export type SentimentAnalysisResult = z.infer<typeof SentimentAnalysisResultSchema>;
export type SentimentResult = z.infer<typeof AnalyzeSentimentResultSchema>;
export type BrandSentimentResult = z.infer<typeof BrandSentimentResultSchema>;
export type CrisisDetectionResult = z.infer<typeof CrisisDetectionResultSchema>;
export type TrendAnalysisResult = z.infer<typeof TrendAnalysisResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: SentimentAnalystGMConfig;
  brandDNA: BrandDNA;
  resolvedSystemPrompt: string;
  source: 'gm' | 'fallback';
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. Sentiment Analyst refuses to run without brand identity. ' +
      'Visit /settings/ai-agents/business-setup to configure.',
    );
  }

  if (!gmRecord) {
    logger.warn(
      `[SentimentAnalyst] GM not seeded for industryKey=${industryKey}; using DEFAULT_SYSTEM_PROMPT fallback. ` +
      `Run node scripts/seed-sentiment-analyst-gm.js to promote to GM-backed analysis.`,
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
      brandDNA,
      resolvedSystemPrompt: buildResolvedSystemPrompt(DEFAULT_SYSTEM_PROMPT, brandDNA),
      source: 'fallback',
    };
  }

  const config = gmRecord.config as Partial<SentimentAnalystGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Sentiment Analyst GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: SentimentAnalystGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.3,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  return {
    gm,
    brandDNA,
    resolvedSystemPrompt: buildResolvedSystemPrompt(systemPrompt, brandDNA),
    source: 'gm',
  };
}

function buildResolvedSystemPrompt(baseSystemPrompt: string, brandDNA: BrandDNA): string {
  const keyPhrases = brandDNA.keyPhrases?.length > 0 ? brandDNA.keyPhrases.join(', ') : '(none configured)';
  const avoidPhrases = brandDNA.avoidPhrases?.length > 0 ? brandDNA.avoidPhrases.join(', ') : '(none configured)';
  const competitors = brandDNA.competitors?.length > 0 ? brandDNA.competitors.join(', ') : '(none configured)';

  const brandBlock = [
    '',
    '## Brand DNA (runtime injection — the tenant-specific identity)',
    '',
    `Company: ${brandDNA.companyDescription}`,
    `Unique value: ${brandDNA.uniqueValue}`,
    `Target audience: ${brandDNA.targetAudience}`,
    `Tone of voice: ${brandDNA.toneOfVoice}`,
    `Communication style: ${brandDNA.communicationStyle}`,
    `Industry: ${brandDNA.industry}`,
    `Key phrases to weave in naturally: ${keyPhrases}`,
    `Phrases you are forbidden from using: ${avoidPhrases}`,
    `Competitors (never name them unless specifically asked): ${competitors}`,
  ].join('\n');

  return `${baseSystemPrompt}\n${brandBlock}`;
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
      `Sentiment Analyst: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shorten the input text batch. ` +
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
// ACTION-SPECIFIC PROMPT BUILDERS
// ============================================================================

function truncate(text: string, max: number): string {
  if (text.length <= max) { return text; }
  return `${text.slice(0, max)}...[truncated, ${text.length - max} more chars]`;
}

function formatTextBatch(texts: string[], maxPerText = 1500): string {
  return texts
    .map((t, i) => `[${i}] ${truncate(t, maxPerText)}`)
    .join('\n\n');
}

function buildAnalyzeSentimentPrompt(req: AnalyzeSentimentPayload): string {
  return [
    'ACTION: analyze_sentiment (single text)',
    '',
    req.context ? `Context: ${req.context}` : '',
    '',
    '## Text',
    truncate(req.text, 8000),
    '',
    '---',
    '',
    'Produce a structured per-text sentiment analysis. Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "action": "analyze_sentiment",',
    '  "text": "<first 300 chars of the analyzed text as a string preview>",',
    '  "sentiment": { "score": <-1 to 1>, "label": "<positive | negative | neutral>", "confidence": <0-1> },',
    '  "emotions": [{ "emotion": "<joy|anger|fear|sadness|surprise|disgust|neutral>", "score": <0-1>, "confidence": <0-1> }] (1-4 dominant emotions),',
    '  "aspects": [{ "aspect": "<what specifically is being evaluated>", "sentiment": { same shape }, "mentions": <integer> }] (up to 8),',
    '  "keywords": ["<up to 12 content keywords>"],',
    '  "language": "<ISO 639-1 code>",',
    '  "rationale": "<why you scored it this way, 30-1500 chars — reference specific phrases>"',
    '}',
  ].filter((line) => line !== '').join('\n');
}

function buildAnalyzeBulkPrompt(req: AnalyzeBulkPayload): string {
  return [
    'ACTION: analyze_bulk (multi-text)',
    '',
    req.context ? `Context: ${req.context}` : '',
    '',
    `## Batch of ${req.texts.length} texts`,
    formatTextBatch(req.texts),
    '',
    '---',
    '',
    'Produce per-text results PLUS an aggregate summary across the batch. Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "action": "analyze_bulk",',
    '  "results": [',
    '    { "index": <integer>, "text": "<preview>", "sentiment": {...}, "emotions": [...], "keywords": [...] }',
    '  ],',
    '  "summary": {',
    '    "totalTexts": <integer>,',
    '    "averageSentiment": <-1 to 1>,',
    '    "distribution": { "positive": <count>, "negative": <count>, "neutral": <count> },',
    '    "dominantEmotion": "<enum>",',
    '    "observations": ["<1-5 specific cross-batch observations>"]',
    '  },',
    '  "rationale": "<50-2500 chars synthesizing the batch>"',
    '}',
    '',
    'Every input text must have a corresponding entry in results. Do not skip any.',
  ].filter((line) => line !== '').join('\n');
}

function buildTrackBrandPrompt(req: TrackBrandPayload): string {
  return [
    'ACTION: track_brand',
    '',
    `Brand: ${req.brandName}`,
    '',
    `## Batch of ${req.texts.length} texts`,
    formatTextBatch(req.texts),
    '',
    '---',
    '',
    `Analyze how "${req.brandName}" is being discussed across the batch. Focus on texts that actually mention the brand. Respond with ONLY a valid JSON object:`,
    '',
    '{',
    `  "action": "track_brand",`,
    `  "brand": "${req.brandName}",`,
    '  "mentionCount": <integer>,',
    '  "overallSentiment": { "score": <-1 to 1>, "label": "<enum>", "confidence": <0-1> },',
    '  "sentimentDistribution": { "positive": <count>, "negative": <count>, "neutral": <count> },',
    '  "topPositiveAspects": ["<up to 5 specific positive themes>"],',
    '  "topNegativeAspects": ["<up to 5 specific negative themes>"],',
    '  "recentTrend": "<improving | declining | stable>",',
    '  "alerts": [{ "severity": "<critical|warning|watch|none>", "trigger": "<specific trigger>", "context": "<quoted or paraphrased>", "recommendedAction": "<specific action>" }],',
    '  "keyObservations": ["<1-5 specific brand-relevant observations>"],',
    '  "rationale": "<50-3000 chars synthesis>"',
    '}',
  ].filter((line) => line !== '').join('\n');
}

function buildDetectCrisisPrompt(req: DetectCrisisPayload): string {
  const threshold = req.threshold ?? -0.5;
  return [
    'ACTION: detect_crisis',
    '',
    req.brandName ? `Brand: ${req.brandName}` : '',
    `Negative sentiment threshold: ${threshold}`,
    '',
    `## Batch of ${req.texts.length} texts`,
    formatTextBatch(req.texts),
    '',
    '---',
    '',
    'Scan the batch for signals of an active or emerging crisis. Classify severity based on BOTH sentiment intensity and specific crisis indicators (lawsuits, data breaches, viral complaints, product failures, public outrage, PR incidents). Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "action": "detect_crisis",',
    '  "crisisDetected": <true | false>,',
    '  "severity": "<critical | warning | watch | none>",',
    '  "alerts": [{ "severity": "<enum>", "trigger": "<what triggered this alert>", "context": "<quoted or paraphrased>", "recommendedAction": "<specific actionable recommendation>" }],',
    '  "summary": "<30-2000 chars describing what you found>",',
    '  "recommendations": ["<1-6 specific actionable recommendations, each tied to what you observed>"],',
    '  "rationale": "<50-2500 chars explaining your severity call>"',
    '}',
    '',
    'Severity rules: critical = active PR emergency (viral backlash, confirmed breach, lawsuit); warning = escalating negative pattern; watch = isolated but concerning signals; none = normal baseline.',
  ].filter((line) => line !== '').join('\n');
}

function buildAnalyzeTrendPrompt(req: AnalyzeTrendPayload): string {
  return [
    'ACTION: analyze_trend',
    '',
    `Time window: ${req.timeWindow ?? 'recent'}`,
    '',
    `## Batch of ${req.texts.length} texts`,
    formatTextBatch(req.texts),
    '',
    '---',
    '',
    'Identify emerging themes and topic patterns across the batch. Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "action": "analyze_trend",',
    `  "period": "${req.timeWindow ?? 'recent'}",`,
    '  "averageSentiment": <-1 to 1>,',
    '  "sentimentTrend": "<improving | declining | stable>",',
    '  "topTopics": [{ "topic": "<topic name>", "sentiment": <-1 to 1>, "volume": <integer count of mentions> }],',
    '  "emergingThemes": ["<up to 5 new/growing themes>"],',
    '  "volumeTrend": "<increasing | decreasing | stable>",',
    '  "rationale": "<50-2500 chars synthesis of what is happening>"',
    '}',
  ].filter((line) => line !== '').join('\n');
}

function buildUserPrompt(payload: SentimentPayload): string {
  switch (payload.action) {
    case 'analyze_sentiment': return buildAnalyzeSentimentPrompt(payload);
    case 'analyze_bulk': return buildAnalyzeBulkPrompt(payload);
    case 'track_brand': return buildTrackBrandPrompt(payload);
    case 'detect_crisis': return buildDetectCrisisPrompt(payload);
    case 'analyze_trend': return buildAnalyzeTrendPrompt(payload);
  }
}

async function executeSentimentAnalysis(
  payload: SentimentPayload,
  ctx: LlmCallContext,
): Promise<SentimentAnalysisResult> {
  const userPrompt = buildUserPrompt(payload);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Sentiment Analyst output was not valid JSON: ${rawContent.slice(0, 300)}`,
    );
  }

  const result = SentimentAnalysisResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Sentiment Analyst output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// SENTIMENT ANALYST CLASS
// ============================================================================

export class SentimentAnalyst extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Sentiment Analyst initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Sentiment Analyst: payload must be an object']);
      }

      const rawAction = payload.action;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Sentiment Analyst: payload.action is required']);
      }
      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Sentiment Analyst does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }

      const inputValidation = SentimentPayloadSchema.safeParse(payload);
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Sentiment Analyst: invalid input payload: ${issueSummary}`,
        ]);
      }

      const action = rawAction as SupportedAction;
      logger.info(`[SentimentAnalyst] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
      const result = await executeSentimentAnalysis(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[SentimentAnalyst] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
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
    return { functional: 520, boilerplate: 60 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createSentimentAnalyst(): SentimentAnalyst {
  return new SentimentAnalyst();
}

let instance: SentimentAnalyst | null = null;

export function getSentimentAnalyst(): SentimentAnalyst {
  instance ??= createSentimentAnalyst();
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
  buildUserPrompt,
  stripJsonFences,
  executeSentimentAnalysis,
  SentimentAnalysisResultSchema,
  SentimentPayloadSchema,
};
