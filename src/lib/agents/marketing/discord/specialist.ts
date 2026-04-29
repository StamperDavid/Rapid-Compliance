/**
 * Discord Expert — REAL AI AGENT (LLM-backed, full coverage)
 *
 * Composes brand-voiced content for the brand's Discord server: channel
 * messages, server announcements, scheduled events, and (warm-only) DM
 * replies. Targets Discord's community-first culture: casual but on-brand,
 * server-context aware, light on marketing-speak.
 *
 * Loads its Golden Master from Firestore (collection
 * `specialistGoldenMasters`, doc id `sgm_discord_expert_<industry>_v<n>`).
 * Brand DNA is baked into the GM at seed time per Standing Rule #1 — the
 * specialist code reads `gm.config.systemPrompt` verbatim and never merges
 * Brand DNA at runtime.
 *
 * Supported actions:
 *   - generate_content    Marketing Manager's organic-content path. Produces
 *                         a platform-shaped Discord message: channel post,
 *                         announcement (with optional embed), or scheduled
 *                         event payload. 2000-char message ceiling enforced.
 *   - compose_dm_reply    Inbound DM dispatcher's path. Discord DMs are
 *                         WARM ONLY — we can only DM users who share a
 *                         guild with the bot OR installed the user-context
 *                         OAuth app. The specialist composes a single
 *                         brand-voice reply and the calling layer is
 *                         responsible for verifying delivery is permitted.
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

const FILE = 'marketing/discord/specialist.ts';
const SPECIALIST_ID = 'DISCORD_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content', 'compose_dm_reply'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

const DM_REPLY_MAX_TOKENS = 1200;

/**
 * Realistic max_tokens floor for the worst-case Discord Expert
 * generate_content response.
 *
 * Derivation:
 *   primaryMessage 2000 + 2 × alternativeMessages 2000 = 6000
 *   embed.title 256 + embed.description 4096 = 4352
 *   scheduledEvent name 100 + description 1000 = 1100
 *   bestPostingTime 300
 *   strategyReasoning 2000
 *   ≈ 13750 chars total prose
 *   /3.0 chars/token = 4585 tokens
 *   + JSON structure (~300 tokens)
 *   + 25% safety margin
 *   ≈ 6100 tokens minimum.
 *
 *   Setting to 6500 for comfortable headroom on full-length announcements
 *   with embeds + scheduled-event metadata.
 */
const GENERATE_CONTENT_MAX_TOKENS = 6500;

interface DiscordExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Discord Expert',
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
      primaryMessage: { type: 'string' },
      alternativeMessages: { type: 'array' },
      messageShape: { type: 'string' },
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

/**
 * Discord supports several message shapes. The contentType the operator
 * passes determines which one the specialist produces:
 *  - "channel_post"       : casual channel message, can be long-form prose
 *  - "announcement"       : announcement-channel post; embed strongly recommended
 *  - "scheduled_event"    : guild-level scheduled event (community + brand syncs)
 *  - "post" (fallback)    : treated as channel_post
 */
export interface GenerateContentRequest {
  action: 'generate_content';
  topic: string;
  contentType: string;
  targetAudience?: string;
  tone?: string;
  campaignGoal?: string;
  brandContext?: BrandContextInput;
  seoKeywords?: SeoKeywordsInput;
  /** When the operator provides exact message text, the LLM uses it as-is
   *  rather than drafting fresh copy. */
  verbatimText?: string;
}

const GenerateContentRequestSchema = z.object({
  action: z.literal('generate_content'),
  topic: z.string().min(1),
  contentType: z.string().min(1).default('channel_post'),
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
  platform: 'discord';
  inboundEventId: string;
  senderHandle?: string;
  senderId?: string;
  inboundText: string;
  brandContext?: BrandContextInput;
}

const ComposeDmReplyRequestSchema = z.object({
  action: z.literal('compose_dm_reply'),
  platform: z.literal('discord'),
  inboundEventId: z.string().min(1),
  senderHandle: z.string().optional(),
  senderId: z.string().optional(),
  inboundText: z.string().min(1),
  brandContext: z.record(z.unknown()).optional(),
});

const ComposeDmReplyResultSchema = z.object({
  replyText: z.string().min(1).max(2000),
  reasoning: z.string().min(20).max(1500),
  confidence: z.enum(['low', 'medium', 'high']),
  suggestEscalation: z.boolean(),
});

export type ComposeDmReplyResult = z.infer<typeof ComposeDmReplyResultSchema>;

// ============================================================================
// OUTPUT CONTRACT — generate_content
// ============================================================================

/**
 * Discord embed shape. Mirrors the subset of the Discord embed object the
 * brand will actually publish (title + description + optional URL + color).
 * Embed total payload limit is 6000 chars across all fields, which the
 * schema enforces by capping description at 4096.
 */
const DiscordEmbedSchema = z.object({
  title: z.string().min(1).max(256),
  description: z.string().min(1).max(4096),
  url: z.string().url().nullable(),
  /** Color as a hex string, e.g. "#5865F2" (Discord blurple). */
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
});

/**
 * Scheduled event payload. Discord guild scheduled events take a name (1-100),
 * description (0-1000), startTime (ISO), and endTime (ISO, optional) plus
 * an entityType (we always emit "EXTERNAL" for brand events with an
 * externalLocation string).
 */
const DiscordScheduledEventSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  startTimeIso: z.string().min(10),
  endTimeIso: z.string().nullable(),
  externalLocation: z.string().min(1).max(100),
});

const DiscordContentResultSchema = z.object({
  /** Which Discord message shape this output is meant to publish as. */
  messageShape: z.enum(['channel_post', 'announcement', 'scheduled_event']),
  /** Primary message body — Discord's hard limit is 2000 chars. */
  primaryMessage: z.string().min(1).max(2000),
  /** 2-3 alternative phrasings the operator can pick from. */
  alternativeMessages: z.array(z.string().min(1).max(2000)).min(2).max(3),
  /** Optional embed — null for plain channel posts, recommended for announcements. */
  embed: DiscordEmbedSchema.nullable(),
  /** Optional scheduled-event payload — present only when messageShape is "scheduled_event". */
  scheduledEvent: DiscordScheduledEventSchema.nullable(),
  /** Brief description of the best posting window for this content. */
  bestPostingTime: z.string().min(10).max(300),
  /** Engagement projection. Honest assessment, not optimistic theater. */
  estimatedEngagement: z.enum(['low', 'medium', 'high']),
  /** Why this content/strategy fits Discord culture + brand voice. */
  strategyReasoning: z.string().min(50).max(2000),
});

export type DiscordContentResult = z.infer<typeof DiscordContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: DiscordExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Discord Expert GM not found for industryKey=${industryKey}. ` +
      `Run npx tsx scripts/seed-discord-expert-gm.ts to seed.`,
    );
  }
  const config = gmRecord.config as Partial<DiscordExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Discord Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }
  const gmMaxTokens = config.maxTokens ?? GENERATE_CONTENT_MAX_TOKENS;
  const effectiveMaxTokens = Math.max(gmMaxTokens, GENERATE_CONTENT_MAX_TOKENS);
  const gm: DiscordExpertGMConfig = {
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
      `Discord Expert: LLM response truncated at maxTokens=${maxTokens}. ` +
      'Either raise the budget or shorten the brief.',
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('Discord Expert: OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// ACTION: generate_content
// ============================================================================

function normalizeContentType(raw: string): 'channel_post' | 'announcement' | 'scheduled_event' {
  const v = raw.toLowerCase().trim();
  if (v === 'announcement' || v === 'announce' || v === 'server_announcement') {
    return 'announcement';
  }
  if (v === 'scheduled_event' || v === 'event' || v === 'guild_event') {
    return 'scheduled_event';
  }
  return 'channel_post';
}

function buildGenerateContentUserPrompt(req: GenerateContentRequest): string {
  const messageShape = normalizeContentType(req.contentType);
  const sections: string[] = [
    'ACTION: generate_content',
    '',
    'Platform: Discord',
    `Topic: ${req.topic}`,
    `Content type (operator-provided): ${req.contentType}`,
    `Resolved messageShape: ${messageShape}`,
  ];

  if (req.targetAudience) { sections.push(`Target audience: ${req.targetAudience}`); }
  if (req.tone) { sections.push(`Tone override: ${req.tone}`); }
  if (req.campaignGoal) { sections.push(`Campaign goal: ${req.campaignGoal}`); }

  if (req.verbatimText) {
    sections.push('');
    sections.push('Operator-provided verbatim text (use as primary message unless it exceeds Discord\'s 2000-char limit):');
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
    sections.push('SEO keywords (use sparingly — Discord is community-first, not search-driven):');
    if (seo.primary) { sections.push(`  Primary: ${seo.primary}`); }
    if (seo.secondary && seo.secondary.length > 0) {
      sections.push(`  Secondary: ${seo.secondary.join(', ')}`);
    }
  }

  sections.push('');
  sections.push('Produce a complete Discord content plan. Respond with ONLY a valid JSON object — no markdown fences, no preamble. Schema:');
  sections.push('');
  sections.push('{');
  sections.push(`  "messageShape": "${messageShape}",`);
  sections.push('  "primaryMessage": "<message body — 1-2000 chars (Discord hard limit)>",');
  sections.push('  "alternativeMessages": ["<2-3 alternative phrasings, each 1-2000 chars>"],');
  sections.push('  "embed": <null OR { "title": "<1-256>", "description": "<1-4096>", "url": <null OR "https://..."> , "colorHex": <null OR "#RRGGBB"> }>,');
  sections.push('  "scheduledEvent": <null OR { "name": "<1-100>", "description": "<1-1000>", "startTimeIso": "<ISO timestamp>", "endTimeIso": <null OR "<ISO timestamp>">, "externalLocation": "<1-100, e.g. URL or place>" }>,');
  sections.push('  "bestPostingTime": "<window guidance, 10-300 chars>",');
  sections.push('  "estimatedEngagement": "<low | medium | high>",');
  sections.push('  "strategyReasoning": "<why this approach fits Discord culture + brand voice, 50-2000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules:');
  sections.push('- primaryMessage MUST be 1-2000 characters (Discord\'s hard limit). Aim for the right length for the shape — channel posts are conversational, announcements are crisp + scannable.');
  sections.push('- For messageShape="announcement": embed SHOULD be non-null (Discord announcements look flat without one). Use the embed for title + structured description.');
  sections.push('- For messageShape="channel_post": embed is OPTIONAL — use only when a link card or structured callout adds real value. Otherwise null.');
  sections.push('- For messageShape="scheduled_event": scheduledEvent MUST be non-null. primaryMessage is the channel post that ANNOUNCES the event (with @here or @<role> if appropriate, NEVER @everyone).');
  sections.push('- @everyone is FORBIDDEN. @here is acceptable only when the announcement is genuinely time-sensitive and the brand has explicitly told you to use it.');
  sections.push('- Engagement bait is FORBIDDEN ("React with X if...", "Drop a 🔥 below", "Tag a friend").');
  sections.push('- Marketing-speak is FORBIDDEN ("revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage").');
  sections.push('- Discord is community-first. Sound like a server moderator who happens to work for the brand, not a corporate broadcast bot.');
  sections.push('- Markdown is supported (** bold **, * italic *, `code`, ``` code block ```, > quote). Use it tastefully.');
  sections.push('- Emoji: light use is fine (Discord culture welcomes emoji), but don\'t spam them. Custom server emoji are typically referenced by name like :emoji_name: and only render in the server that owns them — prefer standard unicode emoji unless the brand has explicitly named custom emoji.');
  sections.push('- If verbatimText was provided, primaryMessage MUST be the verbatim text (or the closest version that fits 2000 chars). Alternatives can vary slightly.');
  sections.push('- If brandContext.avoidPhrases is provided, never use those phrases.');
  sections.push('- If brandContext.keyPhrases is provided, weave at least one in naturally (do NOT force them).');
  sections.push('- Output ONLY the JSON object.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<DiscordContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt, GENERATE_CONTENT_MAX_TOKENS);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Discord Expert generate_content output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = DiscordContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Discord Expert generate_content output did not match schema: ${issueSummary}`);
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
    'Inbound platform: Discord',
    `Inbound event id: ${req.inboundEventId}`,
  ];
  if (req.senderHandle) {
    sections.push(`Sender handle: ${req.senderHandle}`);
  }
  sections.push('');
  sections.push('IMPORTANT — Discord DM caveat:');
  sections.push('Discord allows a bot to DM a user ONLY when (a) the user shares a guild with the bot, OR (b) the user installed the bot via user-context OAuth. The dispatcher that called this action has already verified delivery is permitted. Compose the reply on that basis. If the inbound message indicates the sender is NOT a server member or app-installer (e.g. "I just found you online"), set suggestEscalation=true and produce a polite holding reply that asks them to join the server or install via the brand\'s public link before continuing.');
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
  sections.push('  "replyText": "<the reply text the brand will send, 1-2000 chars; brand playbook target ≤500>",');
  sections.push('  "reasoning": "<why this reply is appropriate given the inbound message and brand voice, 20-1500 chars>",');
  sections.push('  "confidence": "<low | medium | high>",');
  sections.push('  "suggestEscalation": <true | false>');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules:');
  sections.push('- replyText MUST be ≤2000 characters (Discord DM hard limit). Brand voice playbook prefers ≤500 chars for natural conversational tone in DMs.');
  sections.push('- Acknowledge the sender\'s SPECIFIC message — never reply with a generic template that ignores what they said.');
  sections.push('- Match brand tone of voice; default to professional yet approachable if none supplied.');
  sections.push('- If the sender asks about pricing, point to https://www.salesvelocity.ai instead of quoting prices in the DM.');
  sections.push('- Hostile / complaining / requests for things the brand cannot promise → suggestEscalation=true and a polite holding reply.');
  sections.push('- Discord light markdown is acceptable (** bold **, ` code `) — use sparingly. No code blocks in DMs unless the sender asked for code.');
  sections.push('- No marketing-speak, no exclamation overload, no engagement bait.');
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
    throw new Error(`Discord Expert compose_dm_reply output was not valid JSON: ${rawContent.slice(0, 200)}`);
  }

  const result = ComposeDmReplyResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Discord Expert compose_dm_reply output did not match schema: ${issueSummary}`);
  }
  return result.data;
}

// ============================================================================
// DISCORD EXPERT CLASS
// ============================================================================

export class DiscordExpert extends BaseSpecialist {
  constructor() { super(CONFIG); }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Discord Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Discord Expert: payload must be an object']);
      }
      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Discord Expert: no action specified in payload']);
      }
      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Discord Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;
      logger.info(`[DiscordExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'generate_content') {
        const validation = GenerateContentRequestSchema.safeParse({ ...payload, action });
        if (!validation.success) {
          const issueSummary = validation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Discord Expert generate_content: invalid input payload: ${issueSummary}`,
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
            `Discord Expert compose_dm_reply: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data = await executeComposeDmReply(validation.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      const _exhaustive: never = action;
      return this.createReport(taskId, 'FAILED', null, [
        `Discord Expert: action '${_exhaustive}' has no handler in execute()`,
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[DiscordExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 360, boilerplate: 50 };
  }
}

let instance: DiscordExpert | null = null;
export function getDiscordExpert(): DiscordExpert {
  instance ??= new DiscordExpert();
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
  normalizeContentType,
  ComposeDmReplyRequestSchema,
  ComposeDmReplyResultSchema,
  GenerateContentRequestSchema,
  DiscordContentResultSchema,
  DiscordEmbedSchema,
  DiscordScheduledEventSchema,
};
