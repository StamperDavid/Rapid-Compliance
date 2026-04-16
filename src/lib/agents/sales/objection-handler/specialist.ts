/**
 * Objection Handler Specialist — REAL AI AGENT (Task #50 rebuild, April 14 2026)
 *
 * Before the rebuild, this specialist was a 1471-LOC hardcoded
 * lookup-and-reframing engine. `OBJECTION_PATTERNS` constant with
 * keyword libraries per category (PRICE/TIMING/AUTHORITY/etc.),
 * `REFRAMING_STRATEGIES` templates, deterministic `classifyObjection`
 * that counted keyword hits, `generateRebuttal` that filled template
 * strings, and a "triple-verified" theater layer that produced fake
 * verification scores via hand-coded heuristics. Zero LLM calls.
 *
 * Like Deal Closer (Task #49), Objection Handler has a LIVE caller:
 * `SalesManager.orchestrateObjectionHandling` at
 * `revenue/manager.ts:2186` builds an `ObjectionRequest` payload and
 * calls `objectionHandlerInstance.execute()`, expects a `RebuttalResponse`
 * back. The rebuild preserves input and output shapes so the manager
 * keeps working.
 *
 * After the rebuild, Objection Handler is a real LLM-backed objection
 * analyst and rebuttal writer. It reads the raw objection + context,
 * classifies it, picks the right reframing strategy, and writes a
 * primary rebuttal + alternative rebuttals that the SDR can use
 * verbatim. The old "triple verification" layer is preserved as output
 * shape (for backward compat with downstream consumers that destructure
 * those fields), but the verification scores are now real LLM
 * self-assessments rather than hand-coded heuristics.
 *
 * Supported action (single):
 *   - handle_objection — classify + rebut + reframe in one LLM call
 *
 * Pattern matches Task #49 Deal Closer: REQUIRED GM, single-action,
 * Zod input + output, truncation backstop.
 *
 * @module agents/sales/objection-handler/specialist
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

const FILE = 'sales/objection-handler/specialist.ts';
const SPECIALIST_ID = 'OBJ_HANDLER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['handle_objection'] as const;

/**
 * Realistic max_tokens floor for the worst-case Objection Handler response.
 *
 * Derivation:
 *   HandleObjectionResultSchema worst case:
 *     primaryRebuttal.rebuttalText 2000
 *     primaryRebuttal.verifications (3 × 300) = 900
 *     primaryRebuttal.supportingEvidence: 5 × 300 = 1500
 *     primaryRebuttal.adaptations: 3 × 600 = 1800
 *     alternativeRebuttals: 3 × 3000 = 9000
 *     strategyRationale 2000
 *     followUpQuestions: 5 × 300 = 1500
 *     valuePropsUsed: 5 × 200 = 1000
 *     escalationAdvice 600
 *     classification fields 600
 *     ≈ 20,900 chars prose
 *     /3.0 chars/token = 6,967 tokens
 *     + overhead + 25% margin ≈ 8,800 tokens.
 *
 *   Setting the floor at 10,000 tokens covers the schema with margin.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 10000;

interface ObjectionHandlerGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Objection Handler',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'REVENUE_DIRECTOR',
    capabilities: [
      'objection_classification',
      'rebuttal_generation',
      'reframing_strategy',
      'value_prop_mapping',
      'escalation_advice',
    ],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['handle_objection'],
  outputSchema: {
    type: 'object',
    properties: {
      primaryRebuttal: { type: 'object' },
      alternativeRebuttals: { type: 'array' },
      reframingStrategy: { type: 'string' },
      strategyRationale: { type: 'string' },
      confidenceScore: { type: 'number' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.4,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

const ObjectionCategoryEnum = z.enum([
  'PRICE',
  'TIMING',
  'AUTHORITY',
  'NEED',
  'TRUST',
  'COMPETITION',
  'IMPLEMENTATION',
  'CONTRACT',
  'FEATURE',
  'SUPPORT',
]);

const ReframingStrategyEnum = z.enum([
  'FEEL_FELT_FOUND',
  'BOOMERANG',
  'ACKNOWLEDGE_AND_PIVOT',
  'ISOLATION',
  'QUESTION_BACK',
  'THIRD_PARTY_STORY',
  'FUTURE_PACING',
  'COST_OF_INACTION',
]);

const VerificationLevelEnum = z.enum(['VERIFIED_1', 'VERIFIED_2', 'VERIFIED_3']);

const ObjectionInputSchema = z.object({
  rawObjection: z.string().min(3).max(3000),
  context: z.object({
    dealValue: z.number().min(0).max(1_000_000_000).optional(),
    industry: z.string().max(200).optional(),
    companySize: z.string().max(100).optional(),
    buyerPersona: z.string().max(100).optional(),
    competitorMentioned: z.string().max(200).optional(),
    previousObjections: z.array(z.string().min(1).max(500)).max(20).optional(),
    productName: z.string().max(200).optional(),
    valueProps: z.array(z.string().min(1).max(300)).max(20).optional(),
  }).optional(),
});

const ObjectionOptionsSchema = z.object({
  maxRebuttals: z.number().int().min(1).max(5).optional().default(3),
  preferredStrategy: ReframingStrategyEnum.optional(),
  industryFocus: z.string().max(200).optional(),
  includeEscalationAdvice: z.boolean().optional().default(true),
});

const HandleObjectionPayloadSchema = z.object({
  action: z.literal('handle_objection'),
  objection: ObjectionInputSchema,
  options: ObjectionOptionsSchema.optional().default({
    maxRebuttals: 3,
    includeEscalationAdvice: true,
  }),
});

export type ObjectionCategory = z.infer<typeof ObjectionCategoryEnum>;
export type ReframingStrategy = z.infer<typeof ReframingStrategyEnum>;
export type VerificationLevel = z.infer<typeof VerificationLevelEnum>;
export type ObjectionInput = z.infer<typeof ObjectionInputSchema>;
export type ObjectionRequest = z.infer<typeof HandleObjectionPayloadSchema>;

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================

const VerificationResultSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  notes: z.string().min(10).max(300),
});

const RebuttalAdaptationSchema = z.object({
  context: z.string().min(5).max(200),
  adaptedText: z.string().min(20).max(800),
});

const TripleVerifiedRebuttalSchema = z.object({
  rebuttalText: z.string().min(30).max(2000),
  verificationLevel: VerificationLevelEnum,
  verifications: z.object({
    factualAccuracy: VerificationResultSchema,
    valueAlignment: VerificationResultSchema,
    toneAppropriateness: VerificationResultSchema,
  }),
  supportingEvidence: z.array(z.string().min(5).max(300)).max(5),
  adaptations: z.array(RebuttalAdaptationSchema).max(3),
});

const HandleObjectionResultSchema = z.object({
  action: z.literal('handle_objection').optional(),
  classifiedCategory: ObjectionCategoryEnum,
  subcategory: z.string().min(3).max(200),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  underlyingConcern: z.string().min(10).max(600),
  emotionalTone: z.enum(['RATIONAL', 'EMOTIONAL', 'DEFENSIVE', 'SKEPTICAL', 'FRUSTRATED']),
  primaryRebuttal: TripleVerifiedRebuttalSchema,
  alternativeRebuttals: z.array(TripleVerifiedRebuttalSchema).max(4),
  reframingStrategy: ReframingStrategyEnum,
  strategyRationale: z.string().min(50).max(2000),
  followUpQuestions: z.array(z.string().min(10).max(300)).min(1).max(5),
  valuePropsUsed: z.array(z.string().min(5).max(200)).max(5),
  escalationAdvice: z.string().min(20).max(2000).optional(),
  confidenceScore: z.number().min(0).max(1),
});

export type RebuttalResponse = z.infer<typeof HandleObjectionResultSchema>;
export type TripleVerifiedRebuttal = z.infer<typeof TripleVerifiedRebuttalSchema>;
export type VerificationResult = z.infer<typeof VerificationResultSchema>;
export type RebuttalAdaptation = z.infer<typeof RebuttalAdaptationSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: ObjectionHandlerGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Objection Handler GM not found for industryKey=${industryKey}. ` +
      `Customer-facing content generation requires a Golden Master. ` +
      `Run node scripts/seed-objection-handler-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<ObjectionHandlerGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(`Objection Handler GM ${gmRecord.id} has no usable systemPrompt`);
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);
  return {
    gm: {
      systemPrompt,
      model: config.model ?? 'claude-sonnet-4.6',
      temperature: config.temperature ?? 0.4,
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
      `Objection Handler: LLM response truncated at maxTokens=${ctx.gm.maxTokens} (finish_reason='length'). ` +
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
// ACTION: handle_objection
// ============================================================================

function buildHandleObjectionPrompt(req: ObjectionRequest): string {
  const ctx = req.objection.context;
  const opts = req.options;

  const contextLines: string[] = [];
  if (ctx) {
    if (ctx.productName) { contextLines.push(`Product: ${ctx.productName}`); }
    if (ctx.dealValue !== undefined) { contextLines.push(`Deal value: $${ctx.dealValue.toLocaleString()}`); }
    if (ctx.industry) { contextLines.push(`Industry: ${ctx.industry}`); }
    if (ctx.companySize) { contextLines.push(`Company size: ${ctx.companySize}`); }
    if (ctx.buyerPersona) { contextLines.push(`Buyer persona: ${ctx.buyerPersona}`); }
    if (ctx.competitorMentioned) { contextLines.push(`Competitor mentioned: ${ctx.competitorMentioned}`); }
    if (ctx.valueProps && ctx.valueProps.length > 0) {
      contextLines.push(`Available value props: ${ctx.valueProps.join('; ')}`);
    }
    if (ctx.previousObjections && ctx.previousObjections.length > 0) {
      contextLines.push(`Previous objections: ${ctx.previousObjections.join('; ')}`);
    }
  }

  return [
    'ACTION: handle_objection',
    '',
    opts.preferredStrategy ? `Preferred reframing strategy (hint): ${opts.preferredStrategy}` : 'No preferred strategy — pick yourself.',
    `Max alternative rebuttals: ${opts.maxRebuttals - 1}`,
    `Include escalation advice: ${opts.includeEscalationAdvice}`,
    opts.industryFocus ? `Industry focus: ${opts.industryFocus}` : '',
    '',
    '## Raw objection from prospect',
    `"${req.objection.rawObjection}"`,
    '',
    contextLines.length > 0 ? `## Context\n${contextLines.join('\n')}` : '## Context: (none provided)',
    '',
    '---',
    '',
    'Classify, rebut, and reframe this objection. Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "classifiedCategory": "<one of: PRICE | TIMING | AUTHORITY | NEED | TRUST | COMPETITION | IMPLEMENTATION | CONTRACT | FEATURE | SUPPORT>",',
    '  "subcategory": "<more specific label, e.g. \'ROI uncertainty\' for PRICE>",',
    '  "severity": "<LOW | MEDIUM | HIGH | CRITICAL>",',
    '  "underlyingConcern": "<10-600 chars — the real issue beneath the surface objection>",',
    '  "emotionalTone": "<RATIONAL | EMOTIONAL | DEFENSIVE | SKEPTICAL | FRUSTRATED>",',
    '  "primaryRebuttal": {',
    '    "rebuttalText": "<30-2000 chars — the actual rebuttal the SDR will say, plain text, using any context fields like product name and deal value verbatim>",',
    '    "verificationLevel": "<VERIFIED_1 (basic) | VERIFIED_2 (validated) | VERIFIED_3 (high-confidence)>",',
    '    "verifications": {',
    '      "factualAccuracy": { "passed": <bool>, "score": <0-1>, "notes": "<10-300 chars>" },',
    '      "valueAlignment": { "passed": <bool>, "score": <0-1>, "notes": "<10-300 chars>" },',
    '      "toneAppropriateness": { "passed": <bool>, "score": <0-1>, "notes": "<10-300 chars>" }',
    '    },',
    '    "supportingEvidence": ["<0-5 specific facts/stats/stories that support the rebuttal>"],',
    '    "adaptations": [{ "context": "<alt scenario>", "adaptedText": "<reworded rebuttal for that scenario>" }]',
    '  },',
    `  "alternativeRebuttals": [${opts.maxRebuttals - 1} more entries with the same shape as primaryRebuttal, each using a different reframing angle],`,
    '  "reframingStrategy": "<one of: FEEL_FELT_FOUND | BOOMERANG | ACKNOWLEDGE_AND_PIVOT | ISOLATION | QUESTION_BACK | THIRD_PARTY_STORY | FUTURE_PACING | COST_OF_INACTION>",',
    '  "strategyRationale": "<50-2000 chars — why this reframing strategy fits this specific objection and context>",',
    '  "followUpQuestions": ["<1-5 questions the SDR should ask after delivering the rebuttal to keep the conversation moving>"],',
    '  "valuePropsUsed": ["<0-5 specific value propositions you leveraged in the rebuttals>"],',
    opts.includeEscalationAdvice
      ? '  "escalationAdvice": "<20-600 chars — when and how to escalate if the rebuttal fails>",'
      : '',
    '  "confidenceScore": <0-1 — how confident are you that this rebuttal will work for this specific objection>',
    '}',
    '',
    'Hard rules:',
    '- Rebuttal text is plain, conversational, spoken English — no markdown, no stage directions like "[pause]".',
    '- Classification MUST match the objection text. "Your pricing is too high" = PRICE, not NEED.',
    '- reframingStrategy MUST align with the emotional tone and severity. FEEL_FELT_FOUND for EMOTIONAL, BOOMERANG for SKEPTICAL, COST_OF_INACTION for rational price objections.',
    '- verificationLevel reflects your actual confidence: VERIFIED_3 only if the rebuttal is supported by specific evidence in the context (competitor data, real stats, customer stories). VERIFIED_2 if the logic is sound but evidence is general. VERIFIED_1 for a first-draft rebuttal that needs refinement.',
    '- verifications.passed booleans should reflect the score: passed=true if score >= 0.7.',
    '- alternativeRebuttals MUST use DIFFERENT reframing angles from the primary. Don\'t repeat the same argument three times.',
    '- NO template placeholders. Use actual context values (deal amount, product name, competitor) in the rebuttal text.',
    `- alternativeRebuttals array must have EXACTLY ${opts.maxRebuttals - 1} entries (maxRebuttals=${opts.maxRebuttals} total including primary).`,
    '- Output ONLY the JSON object. No markdown fences. No prose outside it.',
  ].filter((line) => line !== '').join('\n');
}

async function executeHandleObjection(
  req: ObjectionRequest,
  ctx: LlmCallContext,
): Promise<RebuttalResponse> {
  const userPrompt = buildHandleObjectionPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Objection Handler output was not valid JSON: ${rawContent.slice(0, 300)}`);
  }

  const result = HandleObjectionResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Objection Handler output did not match expected schema: ${issueSummary}`);
  }

  const data = result.data;

  // Enforce maxRebuttals invariant (primary + alternatives = maxRebuttals)
  const expectedAlternatives = req.options.maxRebuttals - 1;
  if (data.alternativeRebuttals.length !== expectedAlternatives) {
    throw new Error(
      `Objection Handler: alternativeRebuttals.length=${data.alternativeRebuttals.length} does not equal maxRebuttals-1=${expectedAlternatives}`,
    );
  }

  // Enforce escalationAdvice presence when requested
  if (req.options.includeEscalationAdvice && data.escalationAdvice === undefined) {
    throw new Error('Objection Handler: options.includeEscalationAdvice=true requires escalationAdvice output');
  }

  return data;
}

// ============================================================================
// OBJECTION HANDLER CLASS
// ============================================================================

export class ObjectionHandlerSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Objection Handler initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const rawPayload = message.payload as Record<string, unknown> | null;
      if (rawPayload === null || typeof rawPayload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, [
          'Objection Handler: payload must be an object',
        ]);
      }

      const normalized = { ...rawPayload, action: rawPayload.action ?? 'handle_objection' };

      const inputValidation = HandleObjectionPayloadSchema.safeParse(normalized);
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Objection Handler: invalid input payload: ${issueSummary}`,
        ]);
      }

      const payload = inputValidation.data;
      logger.info(
        `[ObjectionHandler] Executing handle_objection taskId=${taskId} rawObjection="${payload.objection.rawObjection.slice(0, 60)}..."`,
        { file: FILE },
      );

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
      const result = await executeHandleObjection(payload, ctx);

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[ObjectionHandler] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
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
    return { functional: 540, boilerplate: 90 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createObjectionHandlerSpecialist(): ObjectionHandlerSpecialist {
  return new ObjectionHandlerSpecialist();
}

let instance: ObjectionHandlerSpecialist | null = null;

export function getObjectionHandlerSpecialist(): ObjectionHandlerSpecialist {
  instance ??= createObjectionHandlerSpecialist();
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
  buildHandleObjectionPrompt,
  executeHandleObjection,
  HandleObjectionPayloadSchema,
  HandleObjectionResultSchema,
};
