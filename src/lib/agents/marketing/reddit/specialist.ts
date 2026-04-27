/**
 * Reddit Expert — REAL AI AGENT (LLM-backed, organic post generation)
 *
 * Composes brand-voiced Reddit posts (link or self/text) tailored to the
 * subreddit's culture. Reddit's DM API is severely gated; this specialist
 * focuses on organic content generation only.
 *
 * Loads its Golden Master from Firestore (collection
 * `specialistGoldenMasters`, doc id `sgm_reddit_expert_<industry>_v<n>`).
 * Brand DNA is baked into the GM at seed time per Standing Rule #1.
 *
 * Supported actions:
 *   - generate_content    Marketing Manager's organic-post path. Produces
 *                         a primary Reddit post (title + body), 2-3
 *                         alternative phrasings, recommended subreddit,
 *                         best posting time, and strategy reasoning. The
 *                         body is allowed up to ~10k chars (Reddit allows
 *                         40k for self-posts) but the brand playbook
 *                         targets 500-2000 chars for higher engagement.
 *
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

const FILE = 'marketing/reddit/specialist.ts';
const SPECIALIST_ID = 'REDDIT_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Reddit Expert
 * generate_content response.
 *
 * Derivation:
 *   primaryPost.title 300 + primaryPost.body 4000 = 4300
 *   3 × alternativePosts (300 + 4000) = 12900
 *   recommendedSubreddit 100
 *   bestPostingTime 300
 *   strategyReasoning 2000
 *   ≈ 19600 chars total prose
 *   /3.0 chars/token = 6535 tokens
 *   + JSON structure (~300 tokens)
 *   + 25% safety margin
 *   ≈ 8500 tokens minimum.
 *
 *   Setting to 9000 for headroom.
 */
const GENERATE_CONTENT_MAX_TOKENS = 9000;

const TITLE_MAX_CHARS = 300;
const BODY_MAX_CHARS = 4000;

interface RedditExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Reddit Expert',
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
      primaryPost: { type: 'object' },
      alternativePosts: { type: 'array' },
      recommendedSubreddit: { type: 'string' },
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
  /** Operator can hint a specific subreddit; the LLM honors it if it's a real
   *  fit, otherwise notes the mismatch in strategyReasoning. */
  targetSubreddit?: string;
  brandContext?: BrandContextInput;
  seoKeywords?: SeoKeywordsInput;
  /** When the operator provides exact post body text, the LLM uses it as the
   *  primary post body rather than drafting fresh copy. */
  verbatimText?: string;
}

const GenerateContentRequestSchema = z.object({
  action: z.literal('generate_content'),
  topic: z.string().min(1),
  contentType: z.string().min(1).default('post'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  targetSubreddit: z.string().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
  verbatimText: z.string().optional(),
});

// ============================================================================
// OUTPUT CONTRACT — generate_content
// ============================================================================

const RedditPostShapeSchema = z.object({
  /** Reddit's title hard limit is 300 chars; we use 300 as the ceiling. */
  title: z.string().min(5).max(TITLE_MAX_CHARS),
  /** Self-post body. Reddit allows up to 40k but readers bail past ~2k. */
  body: z.string().min(20).max(BODY_MAX_CHARS),
});

const RedditContentResultSchema = z.object({
  primaryPost: RedditPostShapeSchema,
  alternativePosts: z.array(RedditPostShapeSchema).min(2).max(3),
  /** e.g. "r/smallbusiness" — the LLM picks the best fit from common
   *  industry-relevant subs unless the operator provided one. */
  recommendedSubreddit: z.string().min(3).max(100),
  /** Best posting window guidance for Reddit (US-business-hours typical). */
  bestPostingTime: z.string().min(10).max(300),
  /** Honest engagement projection; Reddit is volatile. */
  estimatedEngagement: z.enum(['low', 'medium', 'high']),
  /** Strategy reasoning the operator reads in Mission Control. */
  strategyReasoning: z.string().min(50).max(2000),
});

export type RedditContentResult = z.infer<typeof RedditContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: RedditExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Reddit Expert GM not found for industryKey=${industryKey}. ` +
      `Run npx tsx scripts/seed-reddit-expert-gm.ts to seed.`,
    );
  }
  const config = gmRecord.config as Partial<RedditExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Reddit Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }
  const gmMaxTokens = config.maxTokens ?? GENERATE_CONTENT_MAX_TOKENS;
  const effectiveMaxTokens = Math.max(gmMaxTokens, GENERATE_CONTENT_MAX_TOKENS);
  const gm: RedditExpertGMConfig = {
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
      `Reddit Expert: LLM response truncated at maxTokens=${maxTokens}. ` +
      'Either raise the budget or shorten the brief.',
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('Reddit Expert: OpenRouter returned empty response');
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
    `Platform: Reddit`,
    `Topic: ${req.topic}`,
    `Content type: ${req.contentType}`,
  ];

  if (req.targetAudience) { sections.push(`Target audience: ${req.targetAudience}`); }
  if (req.tone) { sections.push(`Tone override: ${req.tone}`); }
  if (req.campaignGoal) { sections.push(`Campaign goal: ${req.campaignGoal}`); }
  if (req.targetSubreddit) { sections.push(`Operator-suggested subreddit: ${req.targetSubreddit}`); }

  if (req.verbatimText) {
    sections.push('');
    sections.push('Operator-provided verbatim body text (use as primary post body unless it exceeds 4000 chars):');
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
    sections.push('SEO keywords (Reddit also indexes well in Google):');
    if (seo.primary) { sections.push(`  Primary: ${seo.primary}`); }
    if (seo.secondary && seo.secondary.length > 0) {
      sections.push(`  Secondary: ${seo.secondary.join(', ')}`);
    }
  }

  sections.push('');
  sections.push('Produce a complete Reddit content plan. Respond with ONLY a valid JSON object — no markdown fences, no preamble. Schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "primaryPost": {');
  sections.push(`    "title": "<post title — 5-${TITLE_MAX_CHARS} chars; target ≤120 for skimmability>",`);
  sections.push(`    "body": "<self-post body — 20-${BODY_MAX_CHARS} chars; target 500-2000 for engagement>"`);
  sections.push('  },');
  sections.push(`  "alternativePosts": [`);
  sections.push('    { "title": "<alt title>", "body": "<alt body>" },');
  sections.push('    { "title": "<alt title>", "body": "<alt body>" }');
  sections.push('  ],');
  sections.push('  "recommendedSubreddit": "<r/subreddit-name — choose the BEST fit for this topic + audience>",');
  sections.push('  "bestPostingTime": "<window guidance, 10-300 chars; Reddit US peaks ~9am-1pm ET weekdays>",');
  sections.push('  "estimatedEngagement": "<low | medium | high>",');
  sections.push('  "strategyReasoning": "<why this approach fits Reddit culture + the chosen sub + brand voice, 50-2000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules:');
  sections.push('- Reddit culture is allergic to obvious self-promotion. Posts that read as ads get downvoted into oblivion or removed by mods. Sound like a real person sharing experience or asking a genuine question.');
  sections.push('- The 9:1 rule: Reddit users expect you to engage with the community 9× for every 1× you self-promote. Frame posts to provide VALUE first; brand mention secondary or implicit.');
  sections.push('- Recommended subreddit: pick from common, high-engagement subs that match the topic + audience. For B2B SaaS: r/SaaS, r/smallbusiness, r/Entrepreneur, r/startups, r/sales, r/marketing. For technical: r/programming, r/devops, etc. Avoid niche subs that ban brand accounts.');
  sections.push('- Title rules: 5-300 chars hard limit, but skim-readers bail past 120. Specific > vague. Question titles ("Anyone else struggle with X?") often outperform statement titles ("Here\'s how to fix X"). NO clickbait — Reddit downvotes it ruthlessly.');
  sections.push('- Body rules: 20-4000 chars hard limit; sweet spot 500-2000. Use paragraph breaks every 2-3 sentences. Reddit markdown supported (bold, italics, lists, code blocks).');
  sections.push('- Forbidden marketing-speak: "revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage", "synergy", "best-in-class".');
  sections.push('- No exclamation overload (zero or one ! in title; minimal in body).');
  sections.push('- No emoji (Reddit culture skews against decorative emoji).');
  sections.push('- No "Edit:" preamble in primary draft (those get added after publication when responding to comments).');
  sections.push('- Avoid linking to brand site in body unless the post is explicitly a Show-and-Tell or value-add resource. When in doubt, no link.');
  sections.push('- If verbatimText was provided, primaryPost.body MUST be the verbatim text (or the closest version that fits 4000 chars). Title can be drafted by the LLM.');
  sections.push('- If brandContext.avoidPhrases is provided, never use those phrases.');
  sections.push('- If brandContext.keyPhrases is provided, weave at least one in naturally (do NOT force them).');
  sections.push('- Output ONLY the JSON object.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<RedditContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt, GENERATE_CONTENT_MAX_TOKENS);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Reddit Expert generate_content output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = RedditContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Reddit Expert generate_content output did not match schema: ${issueSummary}`);
  }
  return result.data;
}

// ============================================================================
// REDDIT EXPERT CLASS
// ============================================================================

export class RedditExpert extends BaseSpecialist {
  constructor() { super(CONFIG); }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Reddit Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Reddit Expert: payload must be an object']);
      }
      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Reddit Expert: no action specified in payload']);
      }
      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Reddit Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;
      logger.info(`[RedditExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'generate_content') {
        const validation = GenerateContentRequestSchema.safeParse({ ...payload, action });
        if (!validation.success) {
          const issueSummary = validation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Reddit Expert generate_content: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data = await executeGenerateContent(validation.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      const _exhaustive: never = action;
      return this.createReport(taskId, 'FAILED', null, [
        `Reddit Expert: action '${_exhaustive}' has no handler in execute()`,
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[RedditExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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

let instance: RedditExpert | null = null;
export function getRedditExpert(): RedditExpert {
  instance ??= new RedditExpert();
  return instance;
}

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  GENERATE_CONTENT_MAX_TOKENS,
  TITLE_MAX_CHARS,
  BODY_MAX_CHARS,
  loadGMConfig,
  buildGenerateContentUserPrompt,
  executeGenerateContent,
  GenerateContentRequestSchema,
  RedditContentResultSchema,
  RedditPostShapeSchema,
};
