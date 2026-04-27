/**
 * Threads Expert — REAL AI AGENT (LLM-backed, organic post generation)
 *
 * Composes brand-voiced posts for Meta's Threads. Threads has no public
 * DM API at this time, so this specialist focuses on organic content
 * generation only — single posts and optional thread chains.
 *
 * Loads its Golden Master from Firestore (collection
 * `specialistGoldenMasters`, doc id `sgm_threads_expert_<industry>_v<n>`).
 * Brand DNA is baked into the GM at seed time per Standing Rule #1.
 *
 * Supported actions:
 *   - generate_content    Marketing Manager's organic-post path. Produces
 *                         a primary post (≤500 char Threads limit), 2-3
 *                         alternative phrasings, hashtag strategy,
 *                         optional multi-post thread chain, best posting
 *                         time, and strategy reasoning.
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

const FILE = 'marketing/threads/specialist.ts';
const SPECIALIST_ID = 'THREADS_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

const POST_MAX_CHARS = 500;
const HASHTAG_MAX_COUNT = 5;
const THREAD_CHAIN_MAX_COUNT = 5;

/**
 * Realistic max_tokens floor for the worst-case Threads Expert
 * generate_content response.
 *
 * Derivation:
 *   primaryPost 500 + 3 × alternativePosts 500 = 2000
 *   5 hashtags × 30 = 150
 *   threadChain 5 × 500 = 2500
 *   bestPostingTime 300
 *   strategyReasoning 2000
 *   ≈ 6950 chars total prose
 *   /3.0 chars/token = 2317 tokens
 *   + JSON structure (~250 tokens)
 *   + 25% safety margin
 *   ≈ 3200 tokens minimum.
 *
 *   Setting to 4000 for comfortable headroom.
 */
const GENERATE_CONTENT_MAX_TOKENS = 4000;

interface ThreadsExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Threads Expert',
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
      hashtags: { type: 'array' },
      threadChainSuggestion: { type: 'array' },
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
  /** When the operator provides exact post text, the LLM uses it as the
   *  primary post rather than drafting fresh copy. */
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

const ThreadsContentResultSchema = z.object({
  /** Primary post text — Threads hard limit is 500 chars. */
  primaryPost: z.string().min(10).max(POST_MAX_CHARS),
  /** 2-3 alternative phrasings the operator can pick from. */
  alternativePosts: z.array(z.string().min(10).max(POST_MAX_CHARS)).min(2).max(3),
  /** 0-5 hashtags. Threads supports them but they're not heavily weighted
   *  for discovery yet — prefer 0-2 tasteful tags. */
  hashtags: z.array(z.string().min(1).max(50)).min(0).max(HASHTAG_MAX_COUNT),
  /** Optional multi-post thread chain. When the topic genuinely needs more
   *  than 500 chars, the LLM proposes 2-5 posts that read in sequence.
   *  Each post still capped at 500 chars. null when single post suffices. */
  threadChainSuggestion: z.array(z.string().min(10).max(POST_MAX_CHARS)).max(THREAD_CHAIN_MAX_COUNT).nullable(),
  /** Best posting window for Threads (Meta-network audience). */
  bestPostingTime: z.string().min(10).max(300),
  /** Honest engagement projection. */
  estimatedEngagement: z.enum(['low', 'medium', 'high']),
  /** Strategy reasoning for operator review. */
  strategyReasoning: z.string().min(50).max(2000),
});

export type ThreadsContentResult = z.infer<typeof ThreadsContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: ThreadsExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Threads Expert GM not found for industryKey=${industryKey}. ` +
      `Run npx tsx scripts/seed-threads-expert-gm.ts to seed.`,
    );
  }
  const config = gmRecord.config as Partial<ThreadsExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Threads Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }
  const gmMaxTokens = config.maxTokens ?? GENERATE_CONTENT_MAX_TOKENS;
  const effectiveMaxTokens = Math.max(gmMaxTokens, GENERATE_CONTENT_MAX_TOKENS);
  const gm: ThreadsExpertGMConfig = {
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
      `Threads Expert: LLM response truncated at maxTokens=${maxTokens}. ` +
      'Either raise the budget or shorten the brief.',
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('Threads Expert: OpenRouter returned empty response');
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
    `Platform: Threads (Meta)`,
    `Topic: ${req.topic}`,
    `Content type: ${req.contentType}`,
  ];

  if (req.targetAudience) { sections.push(`Target audience: ${req.targetAudience}`); }
  if (req.tone) { sections.push(`Tone override: ${req.tone}`); }
  if (req.campaignGoal) { sections.push(`Campaign goal: ${req.campaignGoal}`); }

  if (req.verbatimText) {
    sections.push('');
    sections.push('Operator-provided verbatim text (use as primary post unless it exceeds the 500-char limit):');
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
  sections.push('Produce a complete Threads content plan. Respond with ONLY a valid JSON object — no markdown fences, no preamble. Schema:');
  sections.push('');
  sections.push('{');
  sections.push(`  "primaryPost": "<the post text — 10-${POST_MAX_CHARS} chars; target ≤350 for natural reading>",`);
  sections.push(`  "alternativePosts": ["<2-3 alternative phrasings, each 10-${POST_MAX_CHARS} chars>"],`);
  sections.push(`  "hashtags": ["<0-${HASHTAG_MAX_COUNT} hashtags WITHOUT the # symbol>"],`);
  sections.push(`  "threadChainSuggestion": [<2-${THREAD_CHAIN_MAX_COUNT} follow-on posts as strings if topic justifies a chain, else null>],`);
  sections.push('  "bestPostingTime": "<window guidance, 10-300 chars>",');
  sections.push('  "estimatedEngagement": "<low | medium | high>",');
  sections.push('  "strategyReasoning": "<why this approach fits Threads culture + brand voice, 50-2000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules:');
  sections.push(`- primaryPost MUST be 10-${POST_MAX_CHARS} chars (Threads hard limit). Brand playbook target: ≤350 chars for posts that read naturally on a Threads feed.`);
  sections.push('- Threads culture is conversational, minimalist, and skews younger than LinkedIn. Posts that feel personal or ask genuine questions outperform corporate broadcasts.');
  sections.push('- The Threads algorithm currently favors original posts (not just cross-posts from Instagram), short hooks, and engagement-friendly conversation starters.');
  sections.push('- Hashtags: Threads only allows ONE hashtag per post in many display contexts but the API accepts multiple — prefer 0-2 hashtags max in the array. NEVER use the # symbol in the hashtag value (just the word).');
  sections.push('- Thread chain (threadChainSuggestion): only populate when the topic genuinely needs more than 500 chars (e.g. multi-step explanation, narrative arc). Otherwise null. Each chain post still capped at 500 chars and should read as a coherent sequence.');
  sections.push('- Forbidden marketing-speak: "revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage", "synergy", "best-in-class".');
  sections.push('- No exclamation overload (zero or one ! per post).');
  sections.push('- Light emoji is OK (Threads culture allows it more than Bluesky/Reddit) — 0-1 emoji per post when it adds genuine emphasis. Never decorative emoji walls.');
  sections.push('- No engagement bait ("Comment below!", "Tag a friend!", "Drop a 🔥 if you agree") — Threads users see through it.');
  sections.push('- If verbatimText was provided, primaryPost MUST be the verbatim text (or the closest version that fits 500 chars). Alternative posts can vary slightly.');
  sections.push('- If brandContext.avoidPhrases is provided, never use those phrases.');
  sections.push('- If brandContext.keyPhrases is provided, weave at least one in naturally (do NOT force them).');
  sections.push('- Output ONLY the JSON object.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<ThreadsContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt, GENERATE_CONTENT_MAX_TOKENS);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Threads Expert generate_content output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = ThreadsContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Threads Expert generate_content output did not match schema: ${issueSummary}`);
  }
  return result.data;
}

// ============================================================================
// THREADS EXPERT CLASS
// ============================================================================

export class ThreadsExpert extends BaseSpecialist {
  constructor() { super(CONFIG); }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Threads Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Threads Expert: payload must be an object']);
      }
      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Threads Expert: no action specified in payload']);
      }
      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Threads Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;
      logger.info(`[ThreadsExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'generate_content') {
        const validation = GenerateContentRequestSchema.safeParse({ ...payload, action });
        if (!validation.success) {
          const issueSummary = validation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Threads Expert generate_content: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data = await executeGenerateContent(validation.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      const _exhaustive: never = action;
      return this.createReport(taskId, 'FAILED', null, [
        `Threads Expert: action '${_exhaustive}' has no handler in execute()`,
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[ThreadsExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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

let instance: ThreadsExpert | null = null;
export function getThreadsExpert(): ThreadsExpert {
  instance ??= new ThreadsExpert();
  return instance;
}

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  GENERATE_CONTENT_MAX_TOKENS,
  POST_MAX_CHARS,
  HASHTAG_MAX_COUNT,
  THREAD_CHAIN_MAX_COUNT,
  loadGMConfig,
  buildGenerateContentUserPrompt,
  executeGenerateContent,
  GenerateContentRequestSchema,
  ThreadsContentResultSchema,
};
