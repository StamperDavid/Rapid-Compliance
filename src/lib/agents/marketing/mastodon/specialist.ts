/**
 * Mastodon Expert — REAL AI AGENT (LLM-backed, full coverage)
 *
 * Covers both organic post creation and inbound DM auto-reply for any
 * Mastodon-family instance (mastodon.social, hachyderm.io, fosstodon.org,
 * etc.) the brand connects via `instanceUrl` config.
 *
 * Loads its Golden Master from Firestore (collection
 * `specialistGoldenMasters`, doc id `sgm_mastodon_expert_<industry>_v<n>`).
 * Brand DNA is baked into the GM at seed time per Standing Rule #1.
 *
 * Supported actions:
 *   - generate_content    Marketing Manager's organic-post path. Produces
 *                         platform-shaped posts (≤500 char Mastodon limit,
 *                         ≤350 char target), 2-3 alternatives, hashtag
 *                         strategy, optional content warning, suggested
 *                         alt-text, best posting time, strategy reasoning.
 *   - compose_dm_reply    Inbound DM dispatcher's path. Produces a single
 *                         brand-voice reply to a direct-visibility
 *                         status the brand received. Body only — the
 *                         send-side service prefixes the @mention.
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import {
  ComposeDmReplyRequestSchema,
  executeComposeDmReply,
  type ComposeDmReplyResult,
} from '@/lib/agents/social/compose-dm-reply-shared';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'marketing/mastodon/specialist.ts';
const SPECIALIST_ID = 'MASTODON_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content', 'compose_dm_reply'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

const DM_REPLY_MAX_TOKENS = 1200;

/**
 * Realistic max_tokens floor for the worst-case Mastodon Expert
 * generate_content response.
 *
 * Derivation:
 *   primaryPost 450 + 3 × alternativePosts 450 = 1800
 *   contentWarning 100 + 5 hashtags × 30 = 150
 *   imageAltTextSuggestion 300
 *   bestPostingTime 300
 *   strategyReasoning 2000
 *   ≈ 4650 chars total prose
 *   /3.0 chars/token = 1550 tokens
 *   + JSON structure (~200 tokens)
 *   + 25% safety margin
 *   ≈ 2,200 tokens minimum.
 *
 *   Setting to 3000 for comfortable headroom.
 */
const GENERATE_CONTENT_MAX_TOKENS = 3000;

const DM_REPLY_OPTIONS = {
  platformLabel: 'Mastodon',
  maxReplyChars: 450,
  playbookCharsTarget: 280,
  brandUrl: 'https://www.salesvelocity.ai',
  forbidEmoji: false,
} as const;

interface MastodonExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Mastodon Expert',
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
   *  rather than drafting fresh copy. Useful when Jasper passes through
   *  a user's verbatim text from a "publish this exact post" request. */
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
// OUTPUT CONTRACT — generate_content
// ============================================================================

const MastodonContentResultSchema = z.object({
  /** Primary post text — what the brand should publish. Mastodon's
   *  default char limit is 500; we cap at 450 to leave headroom for
   *  long instance domains in any auto-mention threading. */
  primaryPost: z.string().min(10).max(450),
  /** 2-3 alternative phrasings the operator can pick from. */
  alternativePosts: z.array(z.string().min(10).max(450)).min(2).max(3),
  /** Optional content warning (Mastodon-specific feature for sensitive
   *  topics — politics, news, NSFW, etc.). null when not applicable. */
  contentWarning: z.string().max(100).nullable(),
  /** 0-5 hashtags. Mastodon uses hashtags as a primary discovery
   *  mechanism, but the brand voice prefers ≤2 well-chosen tags over
   *  cluttered #-walls. */
  hashtags: z.array(z.string().min(1).max(50)).min(0).max(5),
  /** Suggested alt text if the post will have an attached image.
   *  Mastodon culture strongly values alt text for accessibility. */
  imageAltTextSuggestion: z.string().max(300).nullable(),
  /** Brief description of the best posting window for this content. */
  bestPostingTime: z.string().min(10).max(300),
  /** Engagement projection. Honest assessment, not optimistic theater. */
  estimatedEngagement: z.enum(['low', 'medium', 'high']),
  /** Why this content/strategy fits Mastodon culture + brand voice.
   *  Operator reads this in Mission Control during plan review. */
  strategyReasoning: z.string().min(50).max(2000),
});

export type MastodonContentResult = z.infer<typeof MastodonContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: MastodonExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Mastodon Expert GM not found for industryKey=${industryKey}. ` +
      `Run npx tsx scripts/seed-mastodon-expert-gm.ts to seed.`,
    );
  }
  const config = gmRecord.config as Partial<MastodonExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Mastodon Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }
  // Take max of GM-stored value and the schema-derived minimum so old GM
  // docs honor the worst-case budget without requiring a Firestore migration.
  const gmMaxTokens = config.maxTokens ?? GENERATE_CONTENT_MAX_TOKENS;
  const effectiveMaxTokens = Math.max(gmMaxTokens, GENERATE_CONTENT_MAX_TOKENS);
  const gm: MastodonExpertGMConfig = {
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
      `Mastodon Expert: LLM response truncated at maxTokens=${maxTokens} ` +
      `(finish_reason='length'). Either raise the budget or shorten the brief.`,
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('Mastodon Expert: OpenRouter returned empty response');
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
    `Platform: Mastodon (federated, Mastodon-API instance)`,
    `Topic: ${req.topic}`,
    `Content type: ${req.contentType}`,
  ];

  if (req.targetAudience) { sections.push(`Target audience: ${req.targetAudience}`); }
  if (req.tone) { sections.push(`Tone override: ${req.tone}`); }
  if (req.campaignGoal) { sections.push(`Campaign goal: ${req.campaignGoal}`); }

  if (req.verbatimText) {
    sections.push('');
    sections.push('Operator-provided verbatim text (use this as the primary post unless it violates platform rules or hard char limit):');
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
    sections.push('SEO keywords (Mastodon SEO is hashtag-driven):');
    if (seo.primary) { sections.push(`  Primary: ${seo.primary}`); }
    if (seo.secondary && seo.secondary.length > 0) {
      sections.push(`  Secondary: ${seo.secondary.join(', ')}`);
    }
  }

  sections.push('');
  sections.push('Produce a complete Mastodon content plan. Respond with ONLY a valid JSON object — no markdown fences, no preamble, no explanation. Schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "primaryPost": "<the post text the brand should publish — 10-450 chars, target ≤350>",');
  sections.push('  "alternativePosts": ["<2-3 alternative phrasings, each 10-450 chars>"],');
  sections.push('  "contentWarning": "<short CW string if content is sensitive (politics, news, complaint), else null>",');
  sections.push('  "hashtags": ["<0-5 hashtags WITHOUT the # symbol — e.g. \\"AIagents\\" not \\"#AIagents\\">"],');
  sections.push('  "imageAltTextSuggestion": "<descriptive alt text 50-300 chars if an image will accompany this post, else null>",');
  sections.push('  "bestPostingTime": "<window guidance, 10-300 chars>",');
  sections.push('  "estimatedEngagement": "<low | medium | high>",');
  sections.push('  "strategyReasoning": "<why this approach fits Mastodon culture + brand voice, 50-2000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules:');
  sections.push('- primaryPost MUST be 10-450 chars. Mastodon\'s default hard limit is 500; we leave headroom.');
  sections.push('- Mastodon culture is conversational, anti-marketing, values authenticity. Sound like a smart human at a small company, not a brand.');
  sections.push('- No marketing-speak: "revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage" are forbidden.');
  sections.push('- No exclamation overload (zero or one ! in primaryPost).');
  sections.push('- Light emoji use is acceptable (Mastodon culture allows it) — 0-1 emoji per post, only when it adds genuine emphasis.');
  sections.push('- Hashtags: prefer 1-3 well-chosen tags over a wall of #s. Mastodon hashtags ARE a primary discovery mechanism, unlike Bluesky.');
  sections.push('- Content warning: set when the post discusses politics, sensitive industry news, complaints, or anything non-followers may want to opt out of seeing. Otherwise null.');
  sections.push('- imageAltTextSuggestion: Mastodon culture strongly values accessibility. If the post would benefit from an image, provide descriptive alt text. If the post stands alone without media, null.');
  sections.push('- If verbatimText was provided, primaryPost MUST be the verbatim text (or the closest version that fits 450 chars). Alternative posts can vary slightly.');
  sections.push('- If brandContext.avoidPhrases is provided, never use those phrases.');
  sections.push('- If brandContext.keyPhrases is provided, weave at least one in naturally (do NOT force them).');
  sections.push('- Output ONLY the JSON object.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<MastodonContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt, GENERATE_CONTENT_MAX_TOKENS);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Mastodon Expert generate_content output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = MastodonContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Mastodon Expert generate_content output did not match schema: ${issueSummary}`);
  }
  return result.data;
}

// ============================================================================
// MASTODON EXPERT CLASS
// ============================================================================

export class MastodonExpert extends BaseSpecialist {
  constructor() { super(CONFIG); }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Mastodon Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Mastodon Expert: payload must be an object']);
      }
      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Mastodon Expert: no action specified in payload']);
      }
      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Mastodon Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;
      logger.info(`[MastodonExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'generate_content') {
        const validation = GenerateContentRequestSchema.safeParse({ ...payload, action });
        if (!validation.success) {
          const issueSummary = validation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Mastodon Expert generate_content: invalid input payload: ${issueSummary}`,
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
            `Mastodon Expert compose_dm_reply: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data: ComposeDmReplyResult = await executeComposeDmReply(
          validation.data,
          {
            resolvedSystemPrompt: ctx.resolvedSystemPrompt,
            model: ctx.gm.model,
            temperature: ctx.gm.temperature,
            maxTokens: DM_REPLY_MAX_TOKENS,
          },
          DM_REPLY_OPTIONS,
        );
        return this.createReport(taskId, 'COMPLETED', data);
      }

      const _exhaustive: never = action;
      return this.createReport(taskId, 'FAILED', null, [
        `Mastodon Expert: action '${_exhaustive}' has no handler in execute()`,
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[MastodonExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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

let instance: MastodonExpert | null = null;
export function getMastodonExpert(): MastodonExpert {
  instance ??= new MastodonExpert();
  return instance;
}

// Re-export the Zod request schema as-is for symmetry with peer specialists
const MastodonComposeDmReplyRequestSchema = z.object({
  action: z.literal('compose_dm_reply'),
  platform: z.literal('mastodon'),
  inboundEventId: z.string().min(1),
  senderHandle: z.string().optional(),
  senderId: z.string().optional(),
  inboundText: z.string().min(1),
  brandContext: z.record(z.unknown()).optional(),
});

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  DM_REPLY_MAX_TOKENS,
  GENERATE_CONTENT_MAX_TOKENS,
  DM_REPLY_OPTIONS,
  loadGMConfig,
  buildGenerateContentUserPrompt,
  GenerateContentRequestSchema,
  MastodonContentResultSchema,
  MastodonComposeDmReplyRequestSchema,
};
