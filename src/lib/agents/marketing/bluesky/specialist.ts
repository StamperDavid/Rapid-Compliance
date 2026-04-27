/**
 * Bluesky Expert — REAL AI AGENT (LLM-backed, full coverage)
 *
 * Covers both organic post creation and inbound DM auto-reply for the
 * brand's Bluesky account on the AT Protocol network.
 *
 * Loads its Golden Master from Firestore (collection
 * `specialistGoldenMasters`, doc id `sgm_bluesky_expert_<industry>_v<n>`).
 * Brand DNA is baked into the GM at seed time per Standing Rule #1.
 *
 * Supported actions:
 *   - generate_content    Marketing Manager's organic-post path. Produces
 *                         platform-shaped posts (≤300 char Bluesky limit,
 *                         ≤240 char target), 2-3 alternatives, hashtag
 *                         strategy, suggested alt-text, best posting
 *                         time, strategy reasoning.
 *   - compose_dm_reply    Inbound DM dispatcher's path. Produces a single
 *                         brand-voice reply to a DM the brand received
 *                         via the AT Protocol chat service.
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

const FILE = 'marketing/bluesky/specialist.ts';
const SPECIALIST_ID = 'BLUESKY_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content', 'compose_dm_reply'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

const DM_REPLY_MAX_TOKENS = 1200;

/**
 * Realistic max_tokens floor for the worst-case Bluesky Expert
 * generate_content response.
 *
 * Derivation:
 *   primaryPost 300 + 3 × alternativePosts 300 = 1200
 *   5 hashtags × 30 = 150
 *   imageAltTextSuggestion 300
 *   bestPostingTime 300
 *   strategyReasoning 2000
 *   ≈ 3950 chars total prose
 *   /3.0 chars/token = 1320 tokens
 *   + JSON structure (~200 tokens)
 *   + 25% safety margin
 *   ≈ 1900 tokens minimum.
 *
 *   Setting to 2500 for comfortable headroom.
 */
const GENERATE_CONTENT_MAX_TOKENS = 2500;

interface BlueskyExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Bluesky Expert',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['generate_content', 'compose_dm_reply'],
  },
  systemPrompt: '',
  tools: ['generate_content', 'compose_dm_reply'],
  outputSchema: {
    type: 'object',
    properties: {
      primaryPost: { type: 'string' },
      alternativePosts: { type: 'array' },
      hashtags: { type: 'array' },
      strategyReasoning: { type: 'string' },
    },
  },
  maxTokens: GENERATE_CONTENT_MAX_TOKENS,
  temperature: 0.7,
};

// ============================================================================
// INPUT CONTRACT — generate_content
// ============================================================================

interface BrandContextInput {
  industry?: string;
  toneOfVoice?: string;
  keyPhrases?: string[];
  avoidPhrases?: string[];
}

interface SeoKeywordsInput {
  primary?: string;
  secondary?: string[];
  recommendations?: string[];
}

export interface GenerateContentRequest {
  action: 'generate_content';
  topic: string;
  contentType: string;
  targetAudience?: string;
  tone?: string;
  campaignGoal?: string;
  brandContext?: BrandContextInput;
  seoKeywords?: SeoKeywordsInput;
  /** When the operator provides exact post text, the LLM uses it as-is
   *  rather than drafting fresh copy. */
  verbatimText?: string;
}

const GenerateContentRequestSchema = z.object({
  action: z.literal('generate_content'),
  topic: z.string().min(1),
  contentType: z.string().min(1).default('post'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
  verbatimText: z.string().optional(),
});

// ============================================================================
// INPUT CONTRACT — compose_dm_reply
// ============================================================================

export interface ComposeDmReplyRequest {
  action: 'compose_dm_reply';
  platform: 'bluesky';
  inboundEventId: string;
  senderHandle?: string;
  senderId?: string;
  inboundText: string;
  brandContext?: BrandContextInput;
}

const ComposeDmReplyRequestSchema = z.object({
  action: z.literal('compose_dm_reply'),
  platform: z.literal('bluesky'),
  inboundEventId: z.string().min(1),
  senderHandle: z.string().optional(),
  senderId: z.string().optional(),
  inboundText: z.string().min(1),
  brandContext: z.record(z.unknown()).optional(),
});

const ComposeDmReplyResultSchema = z.object({
  replyText: z.string().min(1).max(1000),
  reasoning: z.string().min(20).max(1500),
  confidence: z.enum(['low', 'medium', 'high']),
  suggestEscalation: z.boolean(),
});

export type ComposeDmReplyResult = z.infer<typeof ComposeDmReplyResultSchema>;

// ============================================================================
// OUTPUT CONTRACT — generate_content
// ============================================================================

const BlueskyContentResultSchema = z.object({
  /** Primary post text — what the brand should publish. Bluesky's
   *  hard char limit is 300; we cap at 290 to leave a small buffer
   *  for any post-process formatting (e.g. handle expansion). */
  primaryPost: z.string().min(10).max(290),
  /** 2-3 alternative phrasings the operator can pick from. */
  alternativePosts: z.array(z.string().min(10).max(290)).min(2).max(3),
  /** 0-5 hashtags. Bluesky supports them but they're not discovery-
   *  primary like Mastodon. The brand voice prefers ≤2 well-chosen
   *  tags or none at all. */
  hashtags: z.array(z.string().min(1).max(50)).min(0).max(5),
  /** Suggested alt text if the post will have an attached image.
   *  Bluesky has alt text support and the culture values it. */
  imageAltTextSuggestion: z.string().max(300).nullable(),
  /** Brief description of the best posting window for this content. */
  bestPostingTime: z.string().min(10).max(300),
  /** Engagement projection. Honest assessment, not optimistic theater. */
  estimatedEngagement: z.enum(['low', 'medium', 'high']),
  /** Why this content/strategy fits Bluesky culture + brand voice.
   *  Operator reads this in Mission Control during plan review. */
  strategyReasoning: z.string().min(50).max(2000),
});

export type BlueskyContentResult = z.infer<typeof BlueskyContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: BlueskyExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Bluesky Expert GM not found for industryKey=${industryKey}. ` +
      `Run npx tsx scripts/seed-bluesky-expert-gm.ts to seed.`,
    );
  }
  const config = gmRecord.config as Partial<BlueskyExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Bluesky Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }
  const gmMaxTokens = config.maxTokens ?? GENERATE_CONTENT_MAX_TOKENS;
  const effectiveMaxTokens = Math.max(gmMaxTokens, GENERATE_CONTENT_MAX_TOKENS);
  const gm: BlueskyExpertGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };
  return { gm, resolvedSystemPrompt: systemPrompt };
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
  maxTokens: number,
): Promise<string> {
  const provider = new OpenRouterProvider(PLATFORM_ID);
  const response = await provider.chat({
    model: ctx.gm.model,
    messages: [
      { role: 'system', content: ctx.resolvedSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: ctx.gm.temperature,
    maxTokens,
  });

  if (response.finishReason === 'length') {
    throw new Error(
      `Bluesky Expert: LLM response truncated at maxTokens=${maxTokens}. ` +
      'Either raise the budget or shorten the brief.',
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('Bluesky Expert: OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// ACTION: generate_content
// ============================================================================

function buildGenerateContentUserPrompt(req: GenerateContentRequest): string {
  const sections: string[] = [
    'ACTION: generate_content',
    '',
    `Platform: Bluesky (AT Protocol)`,
    `Topic: ${req.topic}`,
    `Content type: ${req.contentType}`,
  ];

  if (req.targetAudience) { sections.push(`Target audience: ${req.targetAudience}`); }
  if (req.tone) { sections.push(`Tone override: ${req.tone}`); }
  if (req.campaignGoal) { sections.push(`Campaign goal: ${req.campaignGoal}`); }

  if (req.verbatimText) {
    sections.push('');
    sections.push('Operator-provided verbatim text (use as primary post unless it exceeds Bluesky\'s 300-char limit):');
    sections.push('"""');
    sections.push(req.verbatimText);
    sections.push('"""');
  }

  const brand = req.brandContext;
  if (brand) {
    sections.push('');
    sections.push('Brand context:');
    if (brand.industry) { sections.push(`  Industry: ${brand.industry}`); }
    if (brand.toneOfVoice) { sections.push(`  Tone of voice: ${brand.toneOfVoice}`); }
    if (brand.keyPhrases && brand.keyPhrases.length > 0) {
      sections.push(`  Key phrases: ${brand.keyPhrases.join(', ')}`);
    }
    if (brand.avoidPhrases && brand.avoidPhrases.length > 0) {
      sections.push(`  Avoid phrases: ${brand.avoidPhrases.join(', ')}`);
    }
  }

  const seo = req.seoKeywords;
  if (seo) {
    sections.push('');
    sections.push('SEO keywords:');
    if (seo.primary) { sections.push(`  Primary: ${seo.primary}`); }
    if (seo.secondary && seo.secondary.length > 0) {
      sections.push(`  Secondary: ${seo.secondary.join(', ')}`);
    }
  }

  sections.push('');
  sections.push('Produce a complete Bluesky content plan. Respond with ONLY a valid JSON object — no markdown fences, no preamble. Schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "primaryPost": "<the post text — 10-290 chars, target ≤240>",');
  sections.push('  "alternativePosts": ["<2-3 alternative phrasings, each 10-290 chars>"],');
  sections.push('  "hashtags": ["<0-5 hashtags WITHOUT the # symbol>"],');
  sections.push('  "imageAltTextSuggestion": "<descriptive alt text 50-300 chars if image attached, else null>",');
  sections.push('  "bestPostingTime": "<window guidance, 10-300 chars>",');
  sections.push('  "estimatedEngagement": "<low | medium | high>",');
  sections.push('  "strategyReasoning": "<why this approach fits Bluesky culture + brand voice, 50-2000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules:');
  sections.push('- primaryPost MUST be 10-290 chars (Bluesky\'s hard limit is 300; we leave a small buffer).');
  sections.push('- Bluesky culture skews tech-fluent, decentralization-curious, anti-corporate, conversational. Sound like a smart human at a small company, not a brand.');
  sections.push('- Bluesky users dislike marketing-speak more than X users do. "Revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage" — forbidden.');
  sections.push('- No exclamation overload (zero or one ! in primaryPost).');
  sections.push('- No emoji unless the brand voice playbook specifically allows it (most brands: zero).');
  sections.push('- Hashtags: prefer 0-2 well-chosen tags. Bluesky uses hashtags less prominently than Mastodon — clutter looks spammy.');
  sections.push('- imageAltTextSuggestion: if the post would benefit from an image, provide descriptive alt text. If the post stands alone, null.');
  sections.push('- If verbatimText was provided, primaryPost MUST be the verbatim text (or the closest version that fits 290 chars). Alternative posts can vary slightly.');
  sections.push('- If brandContext.avoidPhrases is provided, never use those phrases.');
  sections.push('- If brandContext.keyPhrases is provided, weave at least one in naturally (do NOT force them).');
  sections.push('- Output ONLY the JSON object.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<BlueskyContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt, GENERATE_CONTENT_MAX_TOKENS);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Bluesky Expert generate_content output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = BlueskyContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Bluesky Expert generate_content output did not match schema: ${issueSummary}`);
  }
  return result.data;
}

// ============================================================================
// ACTION: compose_dm_reply
// ============================================================================

function buildComposeDmReplyUserPrompt(req: ComposeDmReplyRequest): string {
  const sections: string[] = [
    'ACTION: compose_dm_reply',
    '',
    'Inbound platform: Bluesky (AT Protocol)',
    `Inbound event id: ${req.inboundEventId}`,
  ];
  if (req.senderHandle) {
    sections.push(`Sender handle: ${req.senderHandle}`);
  }
  sections.push('');
  sections.push('Inbound DM text (verbatim):');
  sections.push('"""');
  sections.push(req.inboundText);
  sections.push('"""');
  sections.push('');

  const brand = req.brandContext;
  if (brand) {
    sections.push('Brand context from caller:');
    if (brand.industry) { sections.push(`  Industry: ${brand.industry}`); }
    if (brand.toneOfVoice) { sections.push(`  Tone of voice: ${brand.toneOfVoice}`); }
    if (brand.keyPhrases && brand.keyPhrases.length > 0) {
      sections.push(`  Key phrases: ${brand.keyPhrases.join(', ')}`);
    }
    if (brand.avoidPhrases && brand.avoidPhrases.length > 0) {
      sections.push(`  Avoid phrases: ${brand.avoidPhrases.join(', ')}`);
    }
    sections.push('');
  }

  sections.push('Compose ONE direct message reply for the brand to send back to this sender. Respond with ONLY a valid JSON object, no markdown fences, no preamble. Schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "replyText": "<the reply text the brand will send, 1-1000 chars; brand playbook target ≤300>",');
  sections.push('  "reasoning": "<why this reply is appropriate given the inbound message and brand voice, 20-1500 chars>",');
  sections.push('  "confidence": "<low | medium | high>",');
  sections.push('  "suggestEscalation": <true | false>');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules:');
  sections.push('- replyText MUST be ≤1000 characters (Bluesky DM hard limit). Brand voice playbook prefers ≤300 chars for natural conversational tone.');
  sections.push('- Acknowledge the sender\'s SPECIFIC message — never reply with a generic template that ignores what they said.');
  sections.push('- Match brand tone of voice; default to professional yet approachable if none supplied.');
  sections.push('- If the sender asks about pricing, point to https://www.salesvelocity.ai instead of quoting prices in the DM.');
  sections.push('- Hostile / complaining / requests for things the brand cannot promise → suggestEscalation=true and a polite holding reply.');
  sections.push('- No marketing-speak, no emoji, no exclamation overload.');
  sections.push('- Plain text. No URLs unless the inbound message explicitly asks.');
  sections.push('- Output ONLY the JSON object.');

  return sections.join('\n');
}

async function executeComposeDmReply(
  req: ComposeDmReplyRequest,
  ctx: LlmCallContext,
): Promise<ComposeDmReplyResult> {
  const userPrompt = buildComposeDmReplyUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt, DM_REPLY_MAX_TOKENS);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Bluesky Expert compose_dm_reply output was not valid JSON: ${rawContent.slice(0, 200)}`);
  }

  const result = ComposeDmReplyResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Bluesky Expert compose_dm_reply output did not match schema: ${issueSummary}`);
  }
  return result.data;
}

// ============================================================================
// BLUESKY EXPERT CLASS
// ============================================================================

export class BlueskyExpert extends BaseSpecialist {
  constructor() { super(CONFIG); }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Bluesky Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Bluesky Expert: payload must be an object']);
      }
      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Bluesky Expert: no action specified in payload']);
      }
      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Bluesky Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;
      logger.info(`[BlueskyExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'generate_content') {
        const validation = GenerateContentRequestSchema.safeParse({ ...payload, action });
        if (!validation.success) {
          const issueSummary = validation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Bluesky Expert generate_content: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data = await executeGenerateContent(validation.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      if (action === 'compose_dm_reply') {
        const validation = ComposeDmReplyRequestSchema.safeParse({ ...payload, action });
        if (!validation.success) {
          const issueSummary = validation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Bluesky Expert compose_dm_reply: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data = await executeComposeDmReply(validation.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      const _exhaustive: never = action;
      return this.createReport(taskId, 'FAILED', null, [
        `Bluesky Expert: action '${_exhaustive}' has no handler in execute()`,
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[BlueskyExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;
    if (signal.payload.type === 'COMMAND') { return this.execute(signal.payload); }
    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean { return true; }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 320, boilerplate: 50 };
  }
}

let instance: BlueskyExpert | null = null;
export function getBlueskyExpert(): BlueskyExpert {
  instance ??= new BlueskyExpert();
  return instance;
}

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  DM_REPLY_MAX_TOKENS,
  GENERATE_CONTENT_MAX_TOKENS,
  loadGMConfig,
  buildGenerateContentUserPrompt,
  buildComposeDmReplyUserPrompt,
  executeGenerateContent,
  executeComposeDmReply,
  ComposeDmReplyRequestSchema,
  ComposeDmReplyResultSchema,
  GenerateContentRequestSchema,
  BlueskyContentResultSchema,
};
