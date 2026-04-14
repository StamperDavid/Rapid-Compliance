/**
 * Review Specialist — REAL AI AGENT (Task #51 rebuild, April 14 2026)
 *
 * Before the rebuild, this specialist was a 1263-LOC hardcoded
 * sentiment-aware response engine. Branched by star rating
 * (1/2/3/4/5) over template constants (`StarRatingStrategy`,
 * `ResponseTemplate`), interpolated `{customer_name}`/`{business_name}`
 * placeholders, and produced "personalized" response text that was
 * really just a template with variables filled in. Zero LLM calls.
 *
 * Review Specialist has a LIVE caller:
 * `ReputationManager.handleReview` at `reputation/manager.ts:1262`
 * calls `delegateToSpecialist('REVIEW_SPECIALIST', message)` with
 * payload `{ platform, rating, content, author?, url? }`. The rebuild
 * preserves that input shape and produces a structured review
 * response with public reply text + sentiment analysis + escalation
 * decision + follow-up plan.
 *
 * Supported action (single):
 *   - handle_review — sentiment analysis + public response draft
 *
 * Pattern matches Task #49 Deal Closer: REQUIRED GM (customer-facing
 * content — the response text is posted verbatim on public review
 * platforms), single-action, Zod schemas, truncation backstop.
 *
 * @module agents/trust/review/specialist
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

const FILE = 'trust/review/specialist.ts';
const SPECIALIST_ID = 'REVIEW_SPECIALIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['handle_review'] as const;

/**
 * Realistic max_tokens floor for the worst-case Review Specialist response.
 *
 * Derivation:
 *   HandleReviewResultSchema worst case:
 *     responseText 2500
 *     sentimentAnalysis.rationale 1500
 *     escalation.reasoning 800
 *     escalation.recommendedActions: 5 × 300 = 1500
 *     followUpPlan.steps: 5 × 500 = 2500
 *     tags: 10 × 60 = 600
 *     rationale 2500
 *     ≈ 11,900 chars
 *     /3.0 = 3,967 tokens + overhead + margin ≈ 5,200 tokens.
 *
 *   Floor: 7,000 tokens.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 7000;

interface ReviewSpecialistGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Review Specialist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'REPUTATION_MANAGER',
    capabilities: [
      'review_response',
      'sentiment_analysis',
      'escalation_decision',
      'platform_adaptation',
      'follow_up_planning',
    ],
  },
  systemPrompt: '',
  tools: ['handle_review'],
  outputSchema: {
    type: 'object',
    properties: {
      responseText: { type: 'string' },
      sentimentAnalysis: { type: 'object' },
      escalation: { type: 'object' },
      rationale: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.5,
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
  'producthunt',
  'capterra',
  'generic',
]);

const HandleReviewPayloadSchema = z.object({
  action: z.literal('handle_review'),
  platform: PlatformEnum,
  rating: z.number().int().min(1).max(5),
  content: z.string().min(1).max(5000),
  author: z.string().min(1).max(200).optional(),
  url: z.string().url().max(500).optional(),
  reviewId: z.string().max(200).optional(),
  businessName: z.string().max(300).optional(),
  serviceUsed: z.string().max(300).optional(),
  managerName: z.string().max(200).optional(),
  priorResponseHistory: z.array(z.string().min(1).max(500)).max(10).optional(),
  brandTone: z.string().max(500).optional(),
});

export type HandleReviewPayload = z.infer<typeof HandleReviewPayloadSchema>;
export type ReviewPlatform = z.infer<typeof PlatformEnum>;

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================

const SentimentLabelEnum = z.enum(['positive', 'neutral', 'negative']);
const EscalationLevelEnum = z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const EmotionEnum = z.enum([
  'joy',
  'gratitude',
  'frustration',
  'anger',
  'disappointment',
  'confusion',
  'neutral',
]);

const SentimentAnalysisSchema = z.object({
  label: SentimentLabelEnum,
  score: z.number().min(-1).max(1),
  dominantEmotion: EmotionEnum,
  themes: z.array(z.string().min(3).max(200)).min(1).max(5),
  rationale: z.string().min(20).max(1500),
});

const EscalationSchema = z.object({
  level: EscalationLevelEnum,
  requiresManagerApproval: z.boolean(),
  legalRiskFlag: z.boolean(),
  reasoning: z.string().min(20).max(800),
  recommendedActions: z.array(z.string().min(10).max(300)).max(5),
});

const FollowUpStepSchema = z.object({
  daysFromNow: z.number().int().min(0).max(90),
  action: z.string().min(10).max(500),
  channel: z.enum(['email', 'phone', 'in_app', 'public_reply']),
});

const HandleReviewResultSchema = z.object({
  action: z.literal('handle_review').optional(),
  responseText: z.string().min(20).max(2500),
  responseFormattedForPlatform: z.string().min(20).max(2500),
  tone: z.enum([
    'professional',
    'apologetic',
    'grateful',
    'empathetic',
    'enthusiastic',
    'concerned',
  ]),
  sentimentAnalysis: SentimentAnalysisSchema,
  escalation: EscalationSchema,
  followUpPlan: z.array(FollowUpStepSchema).max(5),
  tags: z.array(z.string().min(2).max(60)).max(10),
  requiresApproval: z.boolean(),
  confidenceScore: z.number().min(0).max(1),
  rationale: z.string().min(50).max(2500),
});

export type HandleReviewResult = z.infer<typeof HandleReviewResultSchema>;
export type SentimentAnalysis = z.infer<typeof SentimentAnalysisSchema>;
export type EscalationAssessment = z.infer<typeof EscalationSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: ReviewSpecialistGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Review Specialist GM not found for industryKey=${industryKey}. ` +
      `Customer-facing content generation requires a Golden Master. ` +
      `Run node scripts/seed-review-specialist-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<ReviewSpecialistGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(`Review Specialist GM ${gmRecord.id} has no usable systemPrompt`);
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);
  return {
    gm: {
      systemPrompt,
      model: config.model ?? 'claude-sonnet-4.6',
      temperature: config.temperature ?? 0.5,
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
      `Review Specialist: LLM response truncated at maxTokens=${ctx.gm.maxTokens} (finish_reason='length'). ` +
      `Worst-case budget is ${MIN_OUTPUT_TOKENS_FOR_SCHEMA} tokens.`,
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// ACTION: handle_review
// ============================================================================

function buildHandleReviewPrompt(req: HandleReviewPayload): string {
  return [
    'ACTION: handle_review',
    '',
    `Platform: ${req.platform}`,
    `Star rating: ${req.rating}/5`,
    req.author ? `Author: ${req.author}` : '',
    req.businessName ? `Business: ${req.businessName}` : '',
    req.serviceUsed ? `Service used: ${req.serviceUsed}` : '',
    req.managerName ? `Manager name (for signature): ${req.managerName}` : '',
    req.brandTone ? `Brand tone: ${req.brandTone}` : '',
    req.url ? `Review URL: ${req.url}` : '',
    '',
    '## Review content',
    req.content,
    '',
    req.priorResponseHistory && req.priorResponseHistory.length > 0
      ? `## Prior response history\n${req.priorResponseHistory.map((h) => `  - ${h}`).join('\n')}`
      : '',
    '',
    '---',
    '',
    'Read the review, analyze sentiment, draft a public response, decide escalation, and plan follow-up. Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "responseText": "<20-2500 chars — the public reply text, plain text, ready to paste on the review platform>",',
    '  "responseFormattedForPlatform": "<platform-adapted version (same content, formatted for Google/Yelp/etc conventions — length limits, tone adjustments)>",',
    '  "tone": "<professional | apologetic | grateful | empathetic | enthusiastic | concerned>",',
    '  "sentimentAnalysis": {',
    '    "label": "<positive | neutral | negative>",',
    '    "score": <-1 to 1>,',
    '    "dominantEmotion": "<joy | gratitude | frustration | anger | disappointment | confusion | neutral>",',
    '    "themes": ["<1-5 specific themes you extracted from the review — product quality, customer service, pricing, etc.>"],',
    '    "rationale": "<20-1500 chars — why you scored it this way, quoting specific phrases>"',
    '  },',
    '  "escalation": {',
    '    "level": "<NONE | LOW | MEDIUM | HIGH | CRITICAL>",',
    '    "requiresManagerApproval": <bool>,',
    '    "legalRiskFlag": <bool — true if review mentions lawsuit, harm, discrimination, etc.>,',
    '    "reasoning": "<20-800 chars>",',
    '    "recommendedActions": ["<0-5 specific actions the business should take beyond posting the public reply>"]',
    '  },',
    '  "followUpPlan": [0-5 { "daysFromNow", "action", "channel": "<email | phone | in_app | public_reply>" } entries],',
    '  "tags": ["<0-10 short tags like product-quality, billing, onboarding>"],',
    '  "requiresApproval": <bool — true if the response is sensitive enough to need human review before posting>,',
    '  "confidenceScore": <0-1>,',
    '  "rationale": "<50-2500 chars synthesizing your sentiment read, response strategy, and escalation decision>"',
    '}',
    '',
    'Hard rules:',
    '- responseText is plain text — no markdown, no HTML. Public review platforms render verbatim.',
    `- NEVER apologize for something that is not actually your fault. A ${req.rating}-star positive review does not need apology.`,
    '- 1-2 star reviews ALWAYS require escalation >= MEDIUM. 3-star is LOW. 4-5 star is NONE.',
    '- Any mention of legal action, physical harm, discrimination, or fraud sets legalRiskFlag=true AND escalation=CRITICAL AND requiresApproval=true.',
    `- Use actual values: author name "${req.author ?? '(unknown)'}", business name "${req.businessName ?? '(unknown)'}", platform "${req.platform}". NO template placeholders like {customer_name}.`,
    '- responseFormattedForPlatform must respect platform norms: Google allows ~4000 chars but 500-800 is ideal; Yelp has strict rules against promotional language; Facebook is more conversational; trustpilot/g2/capterra are professional.',
    '- If rating is 4 or 5, tone is grateful/enthusiastic. If rating is 1 or 2, tone is apologetic/empathetic/concerned. If 3, professional/empathetic.',
    '- NEVER invent facts about the business or the customer experience. Acknowledge the review at face value.',
    '- Output ONLY the JSON object. No markdown fences. No prose outside it.',
  ].filter((line) => line !== '').join('\n');
}

async function executeHandleReview(
  req: HandleReviewPayload,
  ctx: LlmCallContext,
): Promise<HandleReviewResult> {
  const userPrompt = buildHandleReviewPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Review Specialist output was not valid JSON: ${rawContent.slice(0, 300)}`);
  }

  const result = HandleReviewResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Review Specialist output did not match expected schema: ${issueSummary}`);
  }

  const data = result.data;

  // Enforce low-rating → escalation invariant
  if (req.rating <= 2) {
    const highEscalations: z.infer<typeof EscalationLevelEnum>[] = ['MEDIUM', 'HIGH', 'CRITICAL'];
    if (!highEscalations.includes(data.escalation.level)) {
      throw new Error(
        `Review Specialist: ${req.rating}-star review requires escalation level >= MEDIUM, got ${data.escalation.level}`,
      );
    }
  }

  // Enforce legalRiskFlag → CRITICAL + requiresApproval invariant
  if (data.escalation.legalRiskFlag) {
    if (data.escalation.level !== 'CRITICAL') {
      throw new Error('Review Specialist: legalRiskFlag=true requires escalation level=CRITICAL');
    }
    if (!data.requiresApproval) {
      throw new Error('Review Specialist: legalRiskFlag=true requires requiresApproval=true');
    }
  }

  return data;
}

// ============================================================================
// REVIEW SPECIALIST CLASS
// ============================================================================

export class ReviewSpecialist extends BaseSpecialist {
  constructor(_config?: SpecialistConfig) {
    // Accept optional config arg for backward compatibility with ReputationManager's
    // local factory at trust/reputation/manager.ts:121, but always use the internal
    // CONFIG (with the LLM-backed tools list, not the old template config).
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Review Specialist initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const rawPayload = message.payload as Record<string, unknown> | null;
      if (rawPayload === null || typeof rawPayload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Review Specialist: payload must be an object']);
      }

      const normalized = this.normalizePayload(rawPayload);

      const inputValidation = HandleReviewPayloadSchema.safeParse(normalized);
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Review Specialist: invalid input payload: ${issueSummary}`,
        ]);
      }

      const payload = inputValidation.data;
      logger.info(
        `[ReviewSpecialist] Executing handle_review taskId=${taskId} platform=${payload.platform} rating=${payload.rating}`,
        { file: FILE },
      );

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
      const result = await executeHandleReview(payload, ctx);

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[ReviewSpecialist] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  private normalizePayload(raw: Record<string, unknown>): Record<string, unknown> {
    // Normalize platform to lowercase and map aliases
    const platformRaw = typeof raw.platform === 'string' ? raw.platform.toLowerCase() : 'generic';
    const platformMap: Record<string, string> = {
      'productHunt': 'producthunt',
      'producthunt': 'producthunt',
      'google': 'google',
      'yelp': 'yelp',
      'facebook': 'facebook',
      'trustpilot': 'trustpilot',
      'g2': 'g2',
      'capterra': 'capterra',
      'generic': 'generic',
    };
    const platform = platformMap[platformRaw] ?? 'generic';

    return {
      ...raw,
      action: raw.action ?? 'handle_review',
      platform,
      rating: typeof raw.rating === 'number' ? Math.round(raw.rating) : 3,
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
    return { functional: 480, boilerplate: 80 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createReviewSpecialist(): ReviewSpecialist {
  return new ReviewSpecialist();
}

let instance: ReviewSpecialist | null = null;

export function getReviewSpecialist(): ReviewSpecialist {
  instance ??= createReviewSpecialist();
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
  buildHandleReviewPrompt,
  executeHandleReview,
  HandleReviewPayloadSchema,
  HandleReviewResultSchema,
};
