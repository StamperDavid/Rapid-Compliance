/**
 * Twitter/X Expert — REAL AI AGENT (Task #31 rebuild, April 12 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6 by default — locked tier policy for
 * leaf specialists, see Task #23.5) to produce high-performing Twitter/X
 * content with strategic metadata. No template fallbacks. If the GM is
 * missing, Brand DNA is missing, OpenRouter fails, JSON won't parse, or
 * Zod validation fails, the specialist returns a real FAILED AgentReport
 * with the honest reason.
 *
 * Supported actions (live code paths only):
 *   - generate_content  (MarketingManager — the only caller of this
 *                        specialist anywhere in the codebase)
 *
 * The pre-rebuild template engine supported 12 actions (3 core via template
 * switch tables, 5 LISTEN stubs with zero/mock data, 4 ENGAGE stubs with
 * template replies). Two methods had real Twitter API calls (fetchMentions,
 * fetchAudience) but returned unprocessed data with no AI analysis. Per
 * CLAUDE.md's no-stubs and no-features-beyond-what-was-requested rules,
 * the dead branches are not rebuilt. If a future caller needs another action,
 * it gets added then with its own GM update and regression cases.
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

const FILE = 'marketing/twitter/specialist.ts';
const SPECIALIST_ID = 'TWITTER_X_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content', 'compose_dm_reply'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Twitter/X Expert response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   TwitterContentResultSchema worst case (15-tweet thread):
 *     thread: 15 × (text 280 + purpose 300 + engagementTactic 300 +
 *     position int 5 + JSON 30) = 15 × 915 = 13,725
 *     standaloneTweet 280
 *     hooks: primary 280 + 4 alternatives × 280 = 1,400
 *     hashtags (5 × ~25) = 125
 *     estimatedEngagement enum 10
 *     bestPostingTime 600
 *     ratioRiskAssessment 1000
 *     contentStrategy 3000
 *     ≈ 20,140 chars total prose
 *     /3.0 chars/token = 6,713 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 8,641 tokens minimum.
 *
 *   The prior 8,192 was slightly below the 15-tweet worst case. Setting
 *   the floor at 9,000 covers the schema with a small safety margin.
 *   The truncation backstop in callOpenRouter catches any overflow.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 9000;

interface TwitterExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Twitter/X Expert',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['generate_content', 'compose_dm_reply'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['generate_content', 'compose_dm_reply'],
  outputSchema: {
    type: 'object',
    properties: {
      thread: { type: 'array' },
      caption: { type: 'string' },
      contentStrategy: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.7,
};

// ============================================================================
// INPUT CONTRACT
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
}

const GenerateContentRequestSchema = z.object({
  action: z.literal('generate_content'),
  topic: z.string().min(1),
  contentType: z.string().min(1).default('thread'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const TweetSchema = z.object({
  position: z.number().int().min(1),
  text: z.string().min(10).max(280),
  purpose: z.string().min(5).max(300),
  engagementTactic: z.string().min(5).max(300),
});

const TwitterContentResultSchema = z.object({
  thread: z.array(TweetSchema).min(1).max(15),
  standaloneTweet: z.string().min(10).max(280),
  hooks: z.object({
    primary: z.string().min(10).max(280),
    alternatives: z.array(z.string().min(10).max(280)).min(2).max(4),
  }),
  hashtags: z.array(z.string().min(1)).min(0).max(5),
  estimatedEngagement: z.enum(['low', 'medium', 'high', 'viral']),
  bestPostingTime: z.string().min(5).max(600),
  ratioRiskAssessment: z.string().min(20).max(1000),
  contentStrategy: z.string().min(50).max(3000),
});

export type TwitterContentResult = z.infer<typeof TwitterContentResultSchema>;

// ============================================================================
// INPUT/OUTPUT CONTRACT — compose_dm_reply
// ============================================================================
//
// The X Expert produces a single short reply to an inbound DM. The
// Marketing Manager's inbound-DM fast-path invokes this action with the
// full inbound context the synthetic-trigger captured from the
// inboundSocialEvents document. Output is hard-capped at 240 chars to
// match X's DM ergonomics + the brand's playbook (longer reads as a
// wall of text in DM threads). Includes a `reasoning` field so the
// operator can see WHY the specialist chose this reply when reviewing
// in Mission Control, and a `confidence` enum that the auto-approve
// toggle can use later for a high-confidence-only auto-send mode.

export interface ComposeDmReplyRequest {
  action: 'compose_dm_reply';
  platform: 'x';
  inboundEventId: string;
  senderHandle?: string;
  senderId?: string;
  inboundText: string;
  brandContext?: BrandContextInput;
}

const ComposeDmReplyRequestSchema = z.object({
  action: z.literal('compose_dm_reply'),
  platform: z.literal('x'),
  inboundEventId: z.string().min(1),
  senderHandle: z.string().optional(),
  senderId: z.string().optional(),
  inboundText: z.string().min(1),
  brandContext: z.record(z.unknown()).optional(),
});

// Schema upper-bound matches the system-side send cap in
// `twitter-dm-service.sendXDirectMessage` (500 chars). The brand voice
// playbook in the GM v2 systemPrompt asks for ≤240 chars for DM
// ergonomics — that's a quality target the LLM mostly honors.  The
// operator's edit-before-send affordance in Mission Control catches
// any rare overshoots before the DM actually goes out.  Hard-failing
// the specialist on a 245-char reply would just hide working drafts
// that an operator could have approved with one keystroke.
const ComposeDmReplyResultSchema = z.object({
  replyText: z.string().min(1).max(500),
  reasoning: z.string().min(20).max(1500),
  confidence: z.enum(['low', 'medium', 'high']),
  suggestEscalation: z.boolean(),
});

export type ComposeDmReplyResult = z.infer<typeof ComposeDmReplyResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: TwitterExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Twitter/X Expert GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-twitter-expert-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<TwitterExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Twitter/X Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: TwitterExpertGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };
  const resolvedSystemPrompt = gm.systemPrompt;
  return { gm, resolvedSystemPrompt };
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
): Promise<string> {
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

  // Truncation detection (cross-cutting fix). The OpenRouter provider was
  // hardcoding finishReason='stop' for months, silently masking length-
  // truncated responses. Now that the provider is honest, fail loudly on
  // any 'length' finish_reason instead of feeding incomplete JSON to
  // JSON.parse and surfacing a misleading "unexpected end of input".
  if (response.finishReason === 'length') {
    throw new Error(
      `Twitter/X Expert: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shorten the brief. ` +
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
// ACTION: generate_content
// ============================================================================

function buildGenerateContentUserPrompt(req: GenerateContentRequest): string {
  const sections: string[] = [
    'ACTION: generate_content',
    '',
    `Topic: ${req.topic}`,
    `Content type: ${req.contentType}`,
  ];

  if (req.targetAudience) {
    sections.push(`Target audience: ${req.targetAudience}`);
  }
  if (req.tone) {
    sections.push(`Tone: ${req.tone}`);
  }
  if (req.campaignGoal) {
    sections.push(`Campaign goal: ${req.campaignGoal}`);
  }

  // Brand context pass-through from MarketingManager
  const brand = req.brandContext;
  if (brand) {
    sections.push('');
    sections.push('Brand context from caller:');
    if (brand.industry) {
      sections.push(`  Industry: ${brand.industry}`);
    }
    if (brand.toneOfVoice) {
      sections.push(`  Tone of voice: ${brand.toneOfVoice}`);
    }
    if (brand.keyPhrases && brand.keyPhrases.length > 0) {
      sections.push(`  Key phrases: ${brand.keyPhrases.join(', ')}`);
    }
    if (brand.avoidPhrases && brand.avoidPhrases.length > 0) {
      sections.push(`  Avoid phrases: ${brand.avoidPhrases.join(', ')}`);
    }
  }

  // SEO keywords pass-through
  const seo = req.seoKeywords;
  if (seo) {
    sections.push('');
    sections.push('SEO keywords:');
    if (seo.primary) {
      sections.push(`  Primary: ${seo.primary}`);
    }
    if (seo.secondary && seo.secondary.length > 0) {
      sections.push(`  Secondary: ${seo.secondary.join(', ')}`);
    }
    if (seo.recommendations && seo.recommendations.length > 0) {
      sections.push(`  Recommendations: ${seo.recommendations.join(', ')}`);
    }
  }

  sections.push('');
  sections.push('Produce a Twitter/X thread plus a standalone tweet with strategic metadata. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "thread": [');
  sections.push('    {');
  sections.push('      "position": 1,');
  sections.push('      "text": "<tweet text, STRICT 280 character limit>",');
  sections.push('      "purpose": "<why this tweet exists in the thread, 5-300 chars>",');
  sections.push('      "engagementTactic": "<what engagement mechanism this tweet uses, 5-300 chars>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "standaloneTweet": "<a single standalone tweet on the same topic, 10-280 chars>",');
  sections.push('  "hooks": {');
  sections.push('    "primary": "<the thread opener / hook tweet, 10-280 chars>",');
  sections.push('    "alternatives": ["<2-4 alternative hook tweets, each 10-280 chars>"]');
  sections.push('  },');
  sections.push('  "hashtags": ["<0-5 hashtags without # prefix — Twitter uses fewer hashtags than other platforms>"],');
  sections.push('  "estimatedEngagement": "<low|medium|high|viral>",');
  sections.push('  "bestPostingTime": "<recommended posting time with rationale, 5-600 chars>",');
  sections.push('  "ratioRiskAssessment": "<assessment of potential negative reactions and how to mitigate, 20-1000 chars>",');
  sections.push('  "contentStrategy": "<strategic rationale for the content approach, 50-3000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- EVERY tweet in the thread MUST be 280 characters or fewer. This is Twitter\'s hard limit. Count carefully. No exceptions.');
  sections.push('- Tweet 1 (the hook) MUST stop the scroll. Use bold claims, contrarian takes, surprising stats, or direct questions. Never start with "Thread:" or "1/" — the platform shows thread indicators automatically.');
  sections.push('- Thread length: 3-12 tweets for most topics. Each tweet must stand alone AND flow into the next. End each tweet at a curiosity gap so readers click "Show this thread."');
  sections.push('- The final tweet MUST contain a clear CTA: follow, retweet, bookmark, reply, or link. "If this helped, follow me for more [topic]" works. "Let me know your thoughts" is weak.');
  sections.push('- standaloneTweet must work completely independently from the thread — a single punchy take on the same topic that could be posted on its own.');
  sections.push('- Hashtags: 0-3 is optimal on Twitter. More than 3 looks spammy. Use only if highly relevant. Many high-performing tweets use zero hashtags.');
  sections.push('- Ratio risk: assess whether the content could trigger negative pile-ons. Political topics, hot takes about specific companies, or dismissive language increase ratio risk. Flag it honestly.');
  sections.push('- The hook alternatives MUST use different psychological triggers (curiosity, controversy, authority, urgency, relatability). Not just rephrasing.');
  sections.push('- Write in the specified tone. Twitter rewards personality — bland corporate speak gets zero engagement.');
  sections.push('- If seoKeywords are provided, weave the primary keyword naturally into the hook tweet and standalone tweet.');
  sections.push('- If brandContext.avoidPhrases are provided, never use those phrases anywhere in the output.');
  sections.push('- If brandContext.keyPhrases are provided, weave at least one naturally into the thread.');
  sections.push('- Do NOT fabricate impression counts, engagement rates, follower counts, or specific performance predictions.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<TwitterContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Twitter/X Expert output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = TwitterContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Twitter/X Expert output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// ACTION: compose_dm_reply
// ============================================================================
//
// Output is small (≤240 chars + reasoning ≈ ~1500 chars max), so we
// override maxTokens to a much smaller budget than the thread schema's
// 9000-token floor — saves money and avoids unnecessary overhead per
// inbound DM. Provider validation still applies (truncation backstop,
// JSON parse, Zod schema) so a model that ignores the budget still
// fails loudly.

const DM_REPLY_MAX_TOKENS = 1200;

function buildComposeDmReplyUserPrompt(req: ComposeDmReplyRequest): string {
  const sections: string[] = [
    'ACTION: compose_dm_reply',
    '',
    `Inbound platform: X (Twitter)`,
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
    if (brand.industry) {
      sections.push(`  Industry: ${brand.industry}`);
    }
    if (brand.toneOfVoice) {
      sections.push(`  Tone of voice: ${brand.toneOfVoice}`);
    }
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
  sections.push('  "replyText": "<the reply text the brand will send, 1-240 chars>",');
  sections.push('  "reasoning": "<why this reply is appropriate given the inbound message and brand voice, 20-1500 chars>",');
  sections.push('  "confidence": "<low | medium | high>",');
  sections.push('  "suggestEscalation": <true | false — set true if a human should review before send because the inbound is hostile, off-topic, contains a complaint, or asks for something the brand cannot promise>');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules:');
  sections.push('- replyText MUST be ≤240 characters. This is the brand\'s DM playbook ceiling, not X\'s 10000-char limit. Count carefully.');
  sections.push('- Acknowledge the sender\'s SPECIFIC message — never reply with a generic template that ignores what they said.');
  sections.push('- Match the brand tone of voice supplied in brand context. If none was supplied, default to professional yet approachable.');
  sections.push('- If the sender asks about pricing, do NOT quote prices in the DM — point them to the website (https://www.salesvelocity.ai) for current pricing.');
  sections.push('- If the sender is hostile, complaining, or asking for something the brand cannot promise, set suggestEscalation=true and write a polite holding reply that does not commit the brand to anything.');
  sections.push('- Never invent product features, integrations, customer counts, pricing, or claims about the platform that were not provided in brand context.');
  sections.push('- No exclamation overload, no marketing-speak ("revolutionary", "industry-leading", "game-changing"), no emoji.');
  sections.push('- Plain text only. No URLs unless the inbound message explicitly asks where to find something — in which case https://www.salesvelocity.ai is the default destination.');
  sections.push('- confidence reflects how sure you are the replyText fits the brand voice and addresses the sender\'s actual question. low/medium = the operator should probably edit before sending.');
  sections.push('- Do NOT include the JSON in markdown fences. Output starts with `{` and ends with `}`.');

  return sections.join('\n');
}

async function executeComposeDmReply(
  req: ComposeDmReplyRequest,
  ctx: LlmCallContext,
): Promise<ComposeDmReplyResult> {
  const userPrompt = buildComposeDmReplyUserPrompt(req);

  const provider = new OpenRouterProvider(PLATFORM_ID);
  const response = await provider.chat({
    model: ctx.gm.model,
    messages: [
      { role: 'system', content: ctx.resolvedSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: ctx.gm.temperature,
    maxTokens: DM_REPLY_MAX_TOKENS,
  });

  if (response.finishReason === 'length') {
    throw new Error(
      `Twitter/X Expert compose_dm_reply: LLM truncated at maxTokens=${DM_REPLY_MAX_TOKENS}. ` +
      `Either raise the budget or shorten the inbound text.`,
    );
  }

  const rawContent = (response.content ?? '').trim();
  if (rawContent.length === 0) {
    throw new Error('Twitter/X Expert compose_dm_reply: LLM returned empty response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Twitter/X Expert compose_dm_reply output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = ComposeDmReplyResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Twitter/X Expert compose_dm_reply output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// TWITTER/X EXPERT CLASS
// ============================================================================

export class TwitterExpert extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Twitter/X Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Twitter/X Expert: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Twitter/X Expert: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Twitter/X Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[TwitterExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'generate_content') {
        const inputValidation = GenerateContentRequestSchema.safeParse({
          ...payload,
          action,
        });
        if (!inputValidation.success) {
          const issueSummary = inputValidation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Twitter/X Expert generate_content: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data = await executeGenerateContent(inputValidation.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      if (action === 'compose_dm_reply') {
        const inputValidation = ComposeDmReplyRequestSchema.safeParse({
          ...payload,
          action,
        });
        if (!inputValidation.success) {
          const issueSummary = inputValidation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Twitter/X Expert compose_dm_reply: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data = await executeComposeDmReply(inputValidation.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      // Exhaustiveness guard — if a new SUPPORTED_ACTIONS entry is added
      // without a handler, this fails loudly instead of silently passing.
      const _exhaustive: never = action;
      return this.createReport(taskId, 'FAILED', null, [
        `Twitter/X Expert: action '${_exhaustive}' has no handler in execute()`,
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[TwitterExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;
    if (signal.payload.type === 'COMMAND') {
      return this.execute(signal.payload);
    }
    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 380, boilerplate: 50 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createTwitterExpert(): TwitterExpert {
  return new TwitterExpert();
}

let instance: TwitterExpert | null = null;

export function getTwitterExpert(): TwitterExpert {
  instance ??= createTwitterExpert();
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
  DM_REPLY_MAX_TOKENS,
  loadGMConfig,
  buildGenerateContentUserPrompt,
  buildComposeDmReplyUserPrompt,
  executeComposeDmReply,
  stripJsonFences,
  GenerateContentRequestSchema,
  TwitterContentResultSchema,
  ComposeDmReplyRequestSchema,
  ComposeDmReplyResultSchema,
};
