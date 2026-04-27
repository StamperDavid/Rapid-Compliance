/**
 * Telegram Expert — REAL AI AGENT (LLM-backed, channel-post coverage)
 *
 * Composes brand-voiced organic posts for the brand's Telegram channel.
 * Telegram channels broadcast messages to subscribers; the platform
 * supports plain text, Markdown (MarkdownV2), and HTML formatting and a
 * generous 4096-character message limit per post.
 *
 * Inbound DM auto-reply via Telegram Bot API is a separate phase and is
 * NOT covered here — the specialist exposes only `generate_content`.
 *
 * Loads its Golden Master from Firestore (collection
 * `specialistGoldenMasters`, doc id `sgm_telegram_expert_<industry>_v<n>`).
 * Brand DNA is baked into the GM at seed time per Standing Rule #1.
 *
 * Supported actions:
 *   - generate_content    Marketing Manager's organic-post path. Produces
 *                         channel-shaped posts (≤4096 char Telegram limit,
 *                         ≤1500 char target for readability), 1-2
 *                         alternative phrasings, formatting hint
 *                         (plain | markdown | html), best posting time,
 *                         strategy reasoning.
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

const FILE = 'marketing/telegram/specialist.ts';
const SPECIALIST_ID = 'TELEGRAM_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Telegram Expert
 * generate_content response.
 *
 * Derivation:
 *   primaryPost 4096 + 2 × alternativePosts 4096 = 12,288
 *   formatting enum (~10 chars)
 *   bestPostingTime 300
 *   strategyReasoning 2000
 *   ≈ 14,600 chars total prose
 *   /3.0 chars/token ≈ 4,870 tokens
 *   + JSON structure (~250 tokens)
 *   + 25% safety margin
 *   ≈ 6,400 tokens minimum.
 *
 *   Setting to 7000 for comfortable headroom.
 */
const GENERATE_CONTENT_MAX_TOKENS = 7000;

interface TelegramExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Telegram Expert',
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
      primaryPost: { type: 'string' },
      alternativePosts: { type: 'array' },
      formatting: { type: 'string' },
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
// OUTPUT CONTRACT — generate_content
// ============================================================================

const TelegramContentResultSchema = z.object({
  /** Primary channel post — what the brand should publish. Telegram's
   *  hard limit is 4096; we cap at 4096 with a target of ≤1500 for
   *  scannable readability on the timeline. */
  primaryPost: z.string().min(10).max(4096),
  /** 1-2 alternative phrasings the operator can pick from. */
  alternativePosts: z.array(z.string().min(10).max(4096)).min(1).max(2),
  /** Formatting style for the primary post.
   *   plain    — no markup; safest for any send path.
   *   markdown — Telegram MarkdownV2 (escape rules apply on the send side).
   *   html     — Telegram HTML subset (limited tags only). */
  formatting: z.enum(['plain', 'markdown', 'html']),
  /** Brief description of the best posting window for this content. */
  bestPostingTime: z.string().min(10).max(300),
  /** Why this content/strategy fits Telegram channel culture + brand voice.
   *  Operator reads this in Mission Control during plan review. */
  strategyReasoning: z.string().min(50).max(2000),
});

export type TelegramContentResult = z.infer<typeof TelegramContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: TelegramExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Telegram Expert GM not found for industryKey=${industryKey}. ` +
      `Run npx tsx scripts/seed-telegram-expert-gm.ts to seed.`,
    );
  }
  const config = gmRecord.config as Partial<TelegramExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Telegram Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }
  const gmMaxTokens = config.maxTokens ?? GENERATE_CONTENT_MAX_TOKENS;
  const effectiveMaxTokens = Math.max(gmMaxTokens, GENERATE_CONTENT_MAX_TOKENS);
  const gm: TelegramExpertGMConfig = {
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
      `Telegram Expert: LLM response truncated at maxTokens=${maxTokens}. ` +
      'Either raise the budget or shorten the brief.',
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('Telegram Expert: OpenRouter returned empty response');
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
    `Platform: Telegram (channel post via Bot API)`,
    `Topic: ${req.topic}`,
    `Content type: ${req.contentType}`,
  ];

  if (req.targetAudience) { sections.push(`Target audience: ${req.targetAudience}`); }
  if (req.tone) { sections.push(`Tone override: ${req.tone}`); }
  if (req.campaignGoal) { sections.push(`Campaign goal: ${req.campaignGoal}`); }

  if (req.verbatimText) {
    sections.push('');
    sections.push('Operator-provided verbatim text (use as primary post unless it exceeds Telegram\'s 4096-char limit):');
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
    sections.push('SEO keywords (Telegram has no organic search; use these only as topical anchors in copy):');
    if (seo.primary) { sections.push(`  Primary: ${seo.primary}`); }
    if (seo.secondary && seo.secondary.length > 0) {
      sections.push(`  Secondary: ${seo.secondary.join(', ')}`);
    }
  }

  sections.push('');
  sections.push('Produce a complete Telegram channel post plan. Respond with ONLY a valid JSON object — no markdown fences, no preamble. Schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "primaryPost": "<the channel post text — 10-4096 chars, target ≤1500>",');
  sections.push('  "alternativePosts": ["<1-2 alternative phrasings, each 10-4096 chars>"],');
  sections.push('  "formatting": "<plain | markdown | html>",');
  sections.push('  "bestPostingTime": "<window guidance, 10-300 chars>",');
  sections.push('  "strategyReasoning": "<why this approach fits Telegram channel culture + brand voice, 50-2000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules:');
  sections.push('- primaryPost MUST be 10-4096 chars (Telegram\'s hard message limit). Brand playbook target: ≤1500 chars for scannable readability.');
  sections.push('- Telegram channels are broadcast — subscribers OPTED IN, expect substance over hype. Longer-form is acceptable when the topic warrants it.');
  sections.push('- Structure for skim: lead with the news/hook in the first 2 lines, then expand. Channel previews show ~150 chars in mobile notification.');
  sections.push('- formatting: choose "plain" unless the post genuinely benefits from emphasis (bold lead, code block, link inlining). When in doubt, "plain". "markdown" = Telegram MarkdownV2; "html" = the Telegram HTML subset (b, i, u, s, code, pre, a). The send-side handles escape sequences.');
  sections.push('- No marketing-speak: "revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage" are forbidden.');
  sections.push('- No exclamation overload (zero or one ! in primaryPost).');
  sections.push('- Light emoji is acceptable on Telegram (channel culture allows it) — 0-2 per post, only when functional (section markers, status indicators), never decoratively.');
  sections.push('- Hashtags work as in-channel filters (clickable inside the channel). Use 0-3 sparingly when they help subscribers retrieve a topic later. Place at the END of the post.');
  sections.push('- Channel posts can include a single link at the end. Do not stuff multiple links into a single post — open rate drops.');
  sections.push('- If verbatimText was provided, primaryPost MUST be the verbatim text (or the closest version that fits 4096 chars). Alternative posts can vary slightly.');
  sections.push('- If brandContext.avoidPhrases is provided, never use those phrases.');
  sections.push('- If brandContext.keyPhrases is provided, weave at least one in naturally (do NOT force them).');
  sections.push('- Output ONLY the JSON object.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<TelegramContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt, GENERATE_CONTENT_MAX_TOKENS);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Telegram Expert generate_content output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = TelegramContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Telegram Expert generate_content output did not match schema: ${issueSummary}`);
  }
  return result.data;
}

// ============================================================================
// TELEGRAM EXPERT CLASS
// ============================================================================

export class TelegramExpert extends BaseSpecialist {
  constructor() { super(CONFIG); }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Telegram Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Telegram Expert: payload must be an object']);
      }
      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Telegram Expert: no action specified in payload']);
      }
      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Telegram Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;
      logger.info(`[TelegramExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'generate_content') {
        const validation = GenerateContentRequestSchema.safeParse({ ...payload, action });
        if (!validation.success) {
          const issueSummary = validation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Telegram Expert generate_content: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data = await executeGenerateContent(validation.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      const _exhaustive: never = action;
      return this.createReport(taskId, 'FAILED', null, [
        `Telegram Expert: action '${_exhaustive}' has no handler in execute()`,
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[TelegramExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 250, boilerplate: 50 };
  }
}

let instance: TelegramExpert | null = null;
export function getTelegramExpert(): TelegramExpert {
  instance ??= new TelegramExpert();
  return instance;
}

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  GENERATE_CONTENT_MAX_TOKENS,
  loadGMConfig,
  buildGenerateContentUserPrompt,
  executeGenerateContent,
  GenerateContentRequestSchema,
  TelegramContentResultSchema,
};
