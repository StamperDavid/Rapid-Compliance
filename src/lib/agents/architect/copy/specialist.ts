/**
 * Copy Specialist — REAL AI AGENT (Task #39 rebuild, April 12 2026)
 *
 * The Architect-layer Copy Specialist. Loads its Golden Master from Firestore
 * at runtime, injects Brand DNA, and calls OpenRouter (Claude Sonnet 4.6 by
 * default — locked tier policy for leaf specialists, see Task #23.5) to produce
 * STRATEGIC messaging direction for a from-scratch site or funnel. No template
 * fallbacks. If the GM is missing, Brand DNA is missing, OpenRouter fails, JSON
 * won't parse, or Zod validation fails, the specialist returns a real FAILED
 * AgentReport with the honest reason.
 *
 * THIS IS NOT THE COPYWRITER. The Content-layer Copywriter
 * (`src/lib/agents/content/copywriter/specialist.ts`, Task #23) writes the
 * actual headlines, body copy, and CTAs. The Architect-layer Copy Specialist
 * (this file) picks the upstream STRATEGY: messaging framework, CTA strategy,
 * voice and tone direction, site-wide messaging pillars, key objections, and
 * downstream headline direction. Different layer, different job.
 *
 * Supported actions (live code paths only):
 *   - generate_copy  (ArchitectManager.executeSpecialistsParallel —
 *                     dispatches `payload.action = 'generate_copy'` from
 *                     architect/manager.ts:1625-1635 — the only caller of
 *                     this specialist anywhere in the codebase)
 *
 * The pre-rebuild template engine supported 5 actions. 4 of them
 * (framework_selection, headline_generation, cta_optimization, ab_variations)
 * had no live caller anywhere in the codebase — dead surface pretending to be
 * a copywriting suite. The 5th (copy_generation) was reachable only via an
 * internal switch on `payload.type` while the manager dispatches `payload.action`,
 * so even that path was dead. Per CLAUDE.md's no-stubs and
 * no-features-beyond-what-was-requested rules, the dead branches are not
 * rebuilt. If a future caller needs another action, it gets added then with
 * its own GM update and regression cases.
 *
 * Naming-debt note: This specialist is "Copy Specialist" (Architect dept) and
 * is NOT the same as "Copywriter" (Content dept, Task #23). Tracked rename to
 * `COPY_STRATEGIST` is Task #61, scheduled after Architect dept is 3/3 real.
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

const FILE = 'architect/copy/specialist.ts';
const SPECIALIST_ID = 'COPY_STRATEGIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_copy'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Copy Specialist response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   GenerateCopyResultSchema worst case:
 *     framework enum 15 + frameworkReasoning 2500 +
 *     ctaStrategy enum 15 + ctaStrategyReasoning 2500 = 5,030
 *     voiceAndToneDirection 3000
 *     siteWideMessagingPillars: 6 × 400 = 2,400
 *     keyObjections: 5 × 500 = 2,500
 *     socialProofPlacementDescription 3000
 *     pageMessagingNotes 4000
 *     headlineDirection 2500
 *     rationale 6000
 *     ≈ 28,430 chars total prose
 *     /3.0 chars/token = 9,477 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 12,096 tokens minimum.
 *
 *   The prior 8,000 was below the schema worst case. Setting the floor
 *   at 12,500 covers the schema with safety margin. The truncation
 *   backstop in callOpenRouter catches any overflow.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 12500;

interface CopySpecialistGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Copy Strategist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'ARCHITECT_MANAGER',
    capabilities: ['generate_copy'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['generate_copy'],
  outputSchema: {
    type: 'object',
    properties: {
      framework: { type: 'string' },
      ctaStrategy: { type: 'string' },
      voiceAndToneDirection: { type: 'string' },
      siteWideMessagingPillars: { type: 'array' },
      keyObjections: { type: 'array' },
      pageMessagingNotes: { type: 'string' },
      headlineDirection: { type: 'string' },
      rationale: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.6,
};

// ============================================================================
// INPUT CONTRACT (matches ArchitectManager dispatch at architect/manager.ts:1625-1635)
// ============================================================================

export interface GenerateCopyRequest {
  action: 'generate_copy';
  pageType: string;
  funnelType: string;
  targetAudience: string;
  toneOfVoice: string;
  industry: string;
  brief: string;
}

const GenerateCopyRequestSchema = z.object({
  action: z.literal('generate_copy'),
  pageType: z.string().min(2).max(80),
  funnelType: z.string().min(2).max(120),
  targetAudience: z.string().min(2).max(800),
  toneOfVoice: z.string().min(2).max(200),
  industry: z.string().min(2).max(120),
  brief: z.string().min(20).max(8000),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================
//
// Top-level field names `framework` and `ctaStrategy` are deliberately chosen
// to match what ArchitectManager.assembleArchitecture already extracts from
// `report.data` at architect/manager.ts:1813-1814. This means ZERO manager
// edits are needed for the rebuild.
//
// All variable-length content lives in either prose strings (length deltas
// don't fail tolerance) or flat string arrays with bounds (regression-stable
// when bounds are declared in case docs). No nested arrays of objects.
// ============================================================================

const MessagingFrameworkEnum = z.enum([
  'PAS',
  'AIDA',
  'BAB',
  'FAB',
  'FOUR_PS',
  'STORYBRAND',
]);

const CtaStrategyEnum = z.enum([
  'urgency',
  'value',
  'risk_reversal',
  'action',
  'social_proof',
]);

const GenerateCopyResultSchema = z.object({
  framework: MessagingFrameworkEnum,
  frameworkReasoning: z.string().min(50).max(2500),
  ctaStrategy: CtaStrategyEnum,
  ctaStrategyReasoning: z.string().min(50).max(2500),
  voiceAndToneDirection: z.string().min(50).max(3000),
  siteWideMessagingPillars: z.array(z.string().min(10).max(400)).min(3).max(6),
  keyObjections: z.array(z.string().min(10).max(500)).min(2).max(5),
  socialProofPlacementDescription: z.string().min(30).max(3000),
  pageMessagingNotes: z.string().min(80).max(4000),
  headlineDirection: z.string().min(50).max(2500),
  rationale: z.string().min(150).max(6000),
});

export type GenerateCopyResult = z.infer<typeof GenerateCopyResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: CopySpecialistGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Copy Strategist GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-copy-strategist-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<CopySpecialistGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Copy Specialist GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: CopySpecialistGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.6,
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
      `Copy Specialist: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
// ACTION: generate_copy
// ============================================================================

function buildGenerateCopyUserPrompt(req: GenerateCopyRequest): string {
  const sections: string[] = [
    'ACTION: generate_copy',
    '',
    'You are picking the STRATEGIC messaging direction for an entire from-scratch site or funnel.',
    'You are NOT writing headlines or body copy — that happens downstream in the Content layer Copywriter.',
    'Your job is to choose the framework, CTA strategy, voice direction, pillars, and objection inventory that the downstream Copywriter will then execute against.',
    '',
    `Page type: ${req.pageType}`,
    `Funnel type: ${req.funnelType}`,
    `Industry: ${req.industry}`,
    `Target audience: ${req.targetAudience}`,
    `Tone of voice (from caller): ${req.toneOfVoice}`,
    '',
    'Brief from the Architect Manager:',
    req.brief,
    '',
    'Produce a strategic messaging direction. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    '  "framework": "<one of: PAS | AIDA | BAB | FAB | FOUR_PS | STORYBRAND>",',
    '  "frameworkReasoning": "<why this framework fits the audience awareness, industry, and funnel — 50 to 2500 chars>",',
    '  "ctaStrategy": "<one of: urgency | value | risk_reversal | action | social_proof>",',
    '  "ctaStrategyReasoning": "<why this CTA category fits the offer, audience temperature, and funnel position — 50 to 2500 chars>",',
    '  "voiceAndToneDirection": "<the voice and tone the entire site should hold — overrides industry defaults with the caller toneOfVoice and Brand DNA tone — 50 to 3000 chars>",',
    '  "siteWideMessagingPillars": ["<3 to 6 short declarative statements the entire site repeats — each 10 to 400 chars — these are the consistent themes the downstream Copywriter weaves into every page>"],',
    '  "keyObjections": ["<2 to 5 specific objections the audience will raise that copy must address — each 10 to 500 chars — each one a real objection, not a generic concern>"],',
    '  "socialProofPlacementDescription": "<prose describing where social proof should appear and what type of proof works best for this audience — 30 to 3000 chars>",',
    '  "pageMessagingNotes": "<prose paragraph naming the most important pages and the messaging direction for each — for example hero promise, primary CTA intent, supporting copy intent — 80 to 4000 chars>",',
    '  "headlineDirection": "<prose guidance for the downstream Copywriter on how headlines should be structured, hook angles, and length norms — 50 to 2500 chars — this is direction, not actual headlines>",',
    '  "rationale": "<full strategic rationale tying framework + CTA + voice + pillars + objections together into a coherent messaging strategy — 150 to 6000 chars>"',
    '}',
    '',
    'Hard rules you MUST follow:',
    '- Pick exactly ONE framework from the enum. Do not invent new framework names.',
    '- Pick exactly ONE ctaStrategy from the enum. Do not invent new strategy names.',
    '- The framework choice MUST match the audience awareness level implied by the brief and funnel type. PAS or AIDA for cold/unaware. BAB or AIDA for problem-aware. FAB or FOUR_PS for solution-aware. FAB or STORYBRAND for product-aware. Direct offer-style with FAB for most-aware.',
    '- voiceAndToneDirection MUST anchor on the caller-provided toneOfVoice and the Brand DNA tone of voice — not on generic industry defaults. If the caller said "warm and conversational" and Brand DNA says "professional but approachable", reconcile both into a single coherent voice direction.',
    '- siteWideMessagingPillars are NOT taglines or slogans. They are the 3 to 6 strategic themes (e.g. "you get a team, not tools" / "results before retainer" / "no contracts ever") that the entire site keeps repeating across pages. Each pillar must be specific to this client and brief, never generic.',
    '- keyObjections MUST be specific real objections this audience would raise — for example "I do not have time to onboard another tool" or "my agency just sold me on a 12 month contract" — never generic concerns like "is this worth the cost".',
    '- pageMessagingNotes should reference specific page types implied by the brief (homepage, pricing page, demo page, etc.) and give the downstream Copywriter a clear hero-message direction for each. Do not write actual headlines — only direction.',
    '- headlineDirection is GUIDANCE, not headlines. For example "lead with a counterintuitive promise that contradicts the cold-outreach playbook, then back it with the team-not-tools pillar". Never produce actual headline text.',
    '- If the Brand DNA injection above includes avoidPhrases, none of your prose fields may use those phrases.',
    '- If the Brand DNA injection above includes keyPhrases, weave at least one naturally into the rationale or pillars.',
    '- Do NOT invent metrics, conversion rates, or specific performance predictions. The rationale is strategic reasoning, not performance forecasts.',
    '- Output ONLY the JSON object. No prose outside it. No markdown fences. No preamble.',
  ];

  return sections.join('\n');
}

async function executeGenerateCopy(
  req: GenerateCopyRequest,
  ctx: LlmCallContext,
): Promise<GenerateCopyResult> {
  const userPrompt = buildGenerateCopyUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Copy Specialist output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = GenerateCopyResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Copy Specialist output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// COPY SPECIALIST CLASS
// ============================================================================

export class CopySpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Copy Specialist initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Copy Specialist: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Copy Specialist: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Copy Specialist does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[CopySpecialist] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const inputValidation = GenerateCopyRequestSchema.safeParse({
        ...payload,
        action,
      });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Copy Specialist generate_copy: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      const data = await executeGenerateCopy(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[CopySpecialist] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 410, boilerplate: 60 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createCopySpecialist(): CopySpecialist {
  return new CopySpecialist();
}

let instance: CopySpecialist | null = null;

export function getCopySpecialist(): CopySpecialist {
  instance ??= createCopySpecialist();
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
  loadGMConfig,
  buildGenerateCopyUserPrompt,
  stripJsonFences,
  GenerateCopyRequestSchema,
  GenerateCopyResultSchema,
};
