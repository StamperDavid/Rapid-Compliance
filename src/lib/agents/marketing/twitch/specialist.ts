/**
 * Twitch Expert — REAL AI AGENT (LLM-backed, creator-track addition).
 *
 * Composes brand-voiced creator-shape content for the brand's Twitch
 * channel: stream announcements, in-channel chat announcements, clip
 * captions, and schedule segment descriptions.
 *
 * Loads its Golden Master from Firestore (collection
 * `specialistGoldenMasters`, doc id `sgm_twitch_expert_<industry>_v<n>`).
 * Brand DNA is baked into the GM at seed time per Standing Rule #1 — the
 * specialist reads `gm.config.systemPrompt` verbatim and never merges
 * Brand DNA at runtime.
 *
 * Supported actions:
 *   - generate_content    Marketing Manager's organic-content path. The
 *                         caller passes a Twitch-specific contentType
 *                         ('stream_announcement' | 'chat_announcement' |
 *                         'clip_caption' | 'schedule_segment') and the
 *                         specialist returns platform-shaped copy plus 2-3
 *                         alternatives, hashtag strategy, and reasoning.
 *
 * Whispers (Twitch DMs) are intentionally NOT supported — the API is
 * gated/dying per the platform viability matrix (Apr 28 2026). This
 * specialist will never expose a compose_dm_reply action.
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

const FILE = 'marketing/twitch/specialist.ts';
const SPECIALIST_ID = 'TWITCH_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

const TWITCH_CONTENT_TYPES = [
  'stream_announcement',
  'chat_announcement',
  'clip_caption',
  'schedule_segment',
] as const;
type TwitchContentType = (typeof TWITCH_CONTENT_TYPES)[number];

/**
 * Twitch platform character ceilings.
 *
 * - Channel title (modify-channel-information): 140 chars hard cap.
 * - Chat announcement (POST /helix/chat/announcements): 500 chars hard cap.
 * - Clip captions: no hard limit on the platform itself, but Twitch's
 *   discovery surfaces truncate aggressively past ~140 chars — we treat
 *   140 as the working ceiling.
 * - Schedule segment description: 200 char working ceiling for clean
 *   render in the Schedule UI.
 */
const TWITCH_LIMITS: Record<TwitchContentType, { hardMax: number; targetMax: number }> = {
  stream_announcement: { hardMax: 140, targetMax: 120 },
  chat_announcement: { hardMax: 500, targetMax: 400 },
  clip_caption: { hardMax: 140, targetMax: 100 },
  schedule_segment: { hardMax: 200, targetMax: 160 },
};

/**
 * Realistic max_tokens floor for the worst-case Twitch Expert
 * generate_content response.
 *
 * Derivation (worst case = chat_announcement with full alternatives):
 *   primaryContent 500 + 3 × alternatives 500 = 2000
 *   5 hashtags × 25 = 125
 *   bestPostingTime 300
 *   strategyReasoning 2000
 *   ≈ 4425 chars total prose
 *   /3.0 chars/token = 1475 tokens
 *   + JSON structure (~200 tokens)
 *   + 25% safety margin
 *   ≈ 2100 tokens minimum.
 *
 *   Setting to 2500 for comfortable headroom.
 */
const GENERATE_CONTENT_MAX_TOKENS = 2500;

interface TwitchExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Twitch Expert',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['generate_content'],
  },
  systemPrompt: '',
  tools: ['generate_content'],
  outputSchema: {
    type: 'object',
    properties: {
      primaryContent: { type: 'string' },
      alternativeContent: { type: 'array' },
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
  /**
   * Twitch content variant. Determines hardMax/targetMax and platform-
   * shape rules the LLM must follow.
   */
  contentType: TwitchContentType;
  targetAudience?: string;
  tone?: string;
  campaignGoal?: string;
  brandContext?: BrandContextInput;
  seoKeywords?: SeoKeywordsInput;
  /** When the operator provides exact copy, the LLM uses it as-is. */
  verbatimText?: string;
  /** For stream_announcement / schedule_segment: the game/category name. */
  category?: string;
  /** For schedule_segment: the segment title (e.g. "Friday Night Devstream"). */
  segmentTitle?: string;
}

const GenerateContentRequestSchema = z.object({
  action: z.literal('generate_content'),
  topic: z.string().min(1),
  contentType: z.enum(TWITCH_CONTENT_TYPES),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
  verbatimText: z.string().optional(),
  category: z.string().optional(),
  segmentTitle: z.string().optional(),
});

// ============================================================================
// OUTPUT CONTRACT — generate_content
// ============================================================================

const TwitchContentResultSchema = z.object({
  /** Primary copy. Length ceiling is contentType-specific (see TWITCH_LIMITS). */
  primaryContent: z.string().min(5).max(500),
  /** 2-3 alternative phrasings the operator can pick from. */
  alternativeContent: z.array(z.string().min(5).max(500)).min(2).max(3),
  /**
   * 0-5 hashtags WITHOUT the # symbol. Twitch culture uses hashtags
   * sparingly — discovery is title/category/tags driven, not hashtag
   * driven. Most posts: 0-2 tags or none.
   */
  hashtags: z.array(z.string().min(1).max(50)).min(0).max(5),
  /** Brief description of the best posting/announcement window. */
  bestPostingTime: z.string().min(10).max(300),
  /** Engagement projection. Honest assessment, not optimistic theater. */
  estimatedEngagement: z.enum(['low', 'medium', 'high']),
  /** Why this copy fits Twitch culture + brand voice + the contentType. */
  strategyReasoning: z.string().min(50).max(2000),
});

export type TwitchContentResult = z.infer<typeof TwitchContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: TwitchExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Twitch Expert GM not found for industryKey=${industryKey}. ` +
      `Run npx tsx scripts/seed-twitch-expert-gm.ts to seed.`,
    );
  }
  const config = gmRecord.config as Partial<TwitchExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Twitch Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }
  const gmMaxTokens = config.maxTokens ?? GENERATE_CONTENT_MAX_TOKENS;
  const effectiveMaxTokens = Math.max(gmMaxTokens, GENERATE_CONTENT_MAX_TOKENS);
  const gm: TwitchExpertGMConfig = {
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
      `Twitch Expert: LLM response truncated at maxTokens=${maxTokens}. ` +
      'Either raise the budget or shorten the brief.',
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('Twitch Expert: OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// ACTION: generate_content
// ============================================================================

function describeContentType(contentType: TwitchContentType): string {
  switch (contentType) {
    case 'stream_announcement':
      return 'Stream title / "going live" announcement (PATCH /helix/channels — 140 char hard cap on the title field). The copy IS the channel title plus an optional supporting line; assume it will be truncated for the live notification.';
    case 'chat_announcement':
      return 'In-channel chat announcement (POST /helix/chat/announcements — 500 char hard cap). Pinned in chat with a colored highlight; readers are already in the stream, so context is implicit.';
    case 'clip_caption':
      return 'Clip caption shown alongside a clipped video moment. Goal is to make a viewer want to click play. Twitch discovery surfaces truncate past ~140 chars.';
    case 'schedule_segment':
      return 'Schedule segment description (POST /helix/schedule/segment). Shown on the channel\'s Schedule tab next to the day/time. Should orient followers on what the segment is about.';
  }
}

function buildGenerateContentUserPrompt(req: GenerateContentRequest): string {
  const limits = TWITCH_LIMITS[req.contentType];

  const sections: string[] = [
    'ACTION: generate_content',
    '',
    'Platform: Twitch (Helix)',
    `Content type: ${req.contentType}`,
    `Content-type description: ${describeContentType(req.contentType)}`,
    `Hard char cap: ${limits.hardMax}; brand target: ≤${limits.targetMax}`,
    `Topic: ${req.topic}`,
  ];

  if (req.category) { sections.push(`Twitch category / game: ${req.category}`); }
  if (req.segmentTitle) { sections.push(`Schedule segment title: ${req.segmentTitle}`); }
  if (req.targetAudience) { sections.push(`Target audience: ${req.targetAudience}`); }
  if (req.tone) { sections.push(`Tone override: ${req.tone}`); }
  if (req.campaignGoal) { sections.push(`Campaign goal: ${req.campaignGoal}`); }

  if (req.verbatimText) {
    sections.push('');
    sections.push(`Operator-provided verbatim text (use as primary copy unless it exceeds the ${limits.hardMax}-char cap):`);
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
  sections.push('Produce a complete Twitch content plan. Respond with ONLY a valid JSON object — no markdown fences, no preamble. Schema:');
  sections.push('');
  sections.push('{');
  sections.push(`  "primaryContent": "<the copy — 5-${limits.hardMax} chars, target ≤${limits.targetMax}>",`);
  sections.push(`  "alternativeContent": ["<2-3 alternative phrasings, each 5-${limits.hardMax} chars>"],`);
  sections.push('  "hashtags": ["<0-5 hashtags WITHOUT the # symbol>"],');
  sections.push('  "bestPostingTime": "<window guidance, 10-300 chars>",');
  sections.push('  "estimatedEngagement": "<low | medium | high>",');
  sections.push('  "strategyReasoning": "<why this fits Twitch culture + brand voice + content type, 50-2000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules:');
  sections.push(`- primaryContent MUST be 5-${limits.hardMax} chars (Twitch hard cap for this content type).`);
  sections.push('- Twitch culture is gaming/streaming-first. Audiences expect banter, hype-without-cringe, shoutouts to viewers and other streamers, and a casual lowercase-friendly tone (when the brand voice playbook allows it).');
  sections.push('- Beg-posting is forbidden. "Everyone come watch my stream", "drop a follow if you\'re here", "smash that like button" — banned.');
  sections.push('- No marketing-speak. "Revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage" — forbidden.');
  sections.push('- Emoji: only if the brand voice playbook allows. Even then, ≤2 per primaryContent. Twitch has Twitch-emote culture; if the brand has its own emotes, those are fair game (mention by name in copy when relevant).');
  sections.push('- Hashtags: prefer 0-2. Twitch discovery is title + category + tags driven, NOT hashtag driven. Spammy hashtag tails read as cringe.');
  sections.push('- If verbatimText was provided, primaryContent MUST be the verbatim text (or the closest version that fits the cap). Alternatives can vary slightly.');
  sections.push('- If brandContext.avoidPhrases is provided, never use those phrases.');
  sections.push('- If brandContext.keyPhrases is provided, weave at least one in naturally (do NOT force them).');
  sections.push('- Output ONLY the JSON object.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<TwitchContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt, GENERATE_CONTENT_MAX_TOKENS);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Twitch Expert generate_content output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = TwitchContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Twitch Expert generate_content output did not match schema: ${issueSummary}`);
  }

  // Belt-and-suspenders: verify the primary copy fits the contentType cap
  // even though the LLM was told. Cheap insurance against silent overrun.
  const limits = TWITCH_LIMITS[req.contentType];
  if (result.data.primaryContent.length > limits.hardMax) {
    throw new Error(
      `Twitch Expert generate_content: primaryContent exceeded ${limits.hardMax} ` +
      `chars for contentType=${req.contentType} (got ${result.data.primaryContent.length}).`,
    );
  }
  for (const alt of result.data.alternativeContent) {
    if (alt.length > limits.hardMax) {
      throw new Error(
        `Twitch Expert generate_content: alternativeContent entry exceeded ${limits.hardMax} ` +
        `chars for contentType=${req.contentType} (got ${alt.length}).`,
      );
    }
  }
  return result.data;
}

// ============================================================================
// TWITCH EXPERT CLASS
// ============================================================================

export class TwitchExpert extends BaseSpecialist {
  constructor() { super(CONFIG); }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Twitch Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Twitch Expert: payload must be an object']);
      }
      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Twitch Expert: no action specified in payload']);
      }
      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Twitch Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;
      logger.info(`[TwitchExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'generate_content') {
        const validation = GenerateContentRequestSchema.safeParse({ ...payload, action });
        if (!validation.success) {
          const issueSummary = validation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Twitch Expert generate_content: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data = await executeGenerateContent(validation.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      const _exhaustive: never = action;
      return this.createReport(taskId, 'FAILED', null, [
        `Twitch Expert: action '${_exhaustive as string}' has no handler in execute()`,
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[TwitchExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 280, boilerplate: 50 };
  }
}

let instance: TwitchExpert | null = null;
export function getTwitchExpert(): TwitchExpert {
  instance ??= new TwitchExpert();
  return instance;
}

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  TWITCH_CONTENT_TYPES,
  TWITCH_LIMITS,
  GENERATE_CONTENT_MAX_TOKENS,
  loadGMConfig,
  buildGenerateContentUserPrompt,
  executeGenerateContent,
  GenerateContentRequestSchema,
  TwitchContentResultSchema,
};
