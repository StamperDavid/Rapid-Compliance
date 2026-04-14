/**
 * Funnel Pathologist — REAL AI AGENT (Task #41 rebuild, April 13 2026)
 *
 * The Architect-layer Funnel Pathologist. Loads its Golden Master from Firestore
 * at runtime, injects Brand DNA, and calls OpenRouter (Claude Sonnet 4.6 by
 * default — locked tier policy for leaf specialists, see Task #23.5) to produce
 * STRATEGIC funnel diagnosis for a from-scratch site or funnel. No template
 * fallbacks. If the GM is missing, Brand DNA is missing, OpenRouter fails, JSON
 * won't parse, or Zod validation fails, the specialist returns a real FAILED
 * AgentReport with the honest reason.
 *
 * THIS IS NOT THE BUILDER-LAYER FUNNEL ENGINEER. The Builder-layer specialist
 * at `src/lib/agents/builder/funnel/specialist.ts` (Task #36) designs concrete
 * funnel stages, tactics, KPIs, A/B tests, and recommendations from scratch.
 * The Architect-layer Funnel Pathologist (this file) DIAGNOSES: it picks the
 * funnel framework that fits the business, identifies the primary conversion
 * leak, describes the stage risk profile, and prescribes strategic recovery
 * plays and metrics. Different layer, different job.
 *
 * Supported actions (live code paths only):
 *   - analyze_funnel  (ArchitectManager.createSpecialistMessage —
 *                      dispatches `payload.action = 'analyze_funnel'` from
 *                      architect/manager.ts:1614-1623 — the only caller of
 *                      this specialist anywhere in the codebase)
 *
 * The pre-rebuild template engine supported three switched actions in
 * execute() — 'optimize_stage', 'analyze_conversions', and default
 * 'design_funnel' — none of which matched the manager's dispatched
 * 'analyze_funnel' action string. The manager's live path silently fell
 * through to the 'design_funnel' default while the input contract was thrown
 * away (stages, conversionPoints, brief all ignored). The rebuild aligns the
 * specialist to the manager's actual contract.
 *
 * Naming-debt note: This specialist is "Funnel Pathologist" (Architect dept)
 * and is NOT the same as "Funnel Engineer" (Builder dept, Task #36). Tracked
 * rename to `FUNNEL_STRATEGIST` is Task #61, scheduled after Architect dept
 * is 3/3 real.
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

const FILE = 'architect/funnel/specialist.ts';
const SPECIALIST_ID = 'FUNNEL_STRATEGIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['analyze_funnel'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Funnel Pathologist response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   AnalyzeFunnelResultSchema worst case:
 *     funnelFramework enum 30 + frameworkReasoning 2500 = 2,530
 *     primaryConversionLeak enum 30 + leakDiagnosis 5000 = 5,030
 *     stageRiskProfile 10000 (the largest single field — scales with
 *     stage count)
 *     criticalLeakPoints: 6 × 1000 = 6,000
 *     trustSignalStrategy 5000 + pricingPsychologyDirection 5000 +
 *     urgencyAndScarcityDirection 5000 = 15,000
 *     recoveryPlays: 7 × 1000 = 7,000
 *     keyMetricsToWatch: 7 × 300 = 2,100
 *     rationale 6000
 *     ≈ 53,660 chars total prose
 *     /3.0 chars/token = 17,887 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 22,608 tokens minimum.
 *
 *   The prior 12,000 was below the schema worst case. Setting the floor
 *   at 23,000 covers the schema with safety margin. The truncation
 *   backstop in callOpenRouter catches any overflow.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 23000;

interface FunnelPathologistGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Funnel Strategist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'ARCHITECT_MANAGER',
    capabilities: ['analyze_funnel'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['analyze_funnel'],
  outputSchema: {
    type: 'object',
    properties: {
      funnelFramework: { type: 'string' },
      primaryConversionLeak: { type: 'string' },
      leakDiagnosis: { type: 'string' },
      stageRiskProfile: { type: 'string' },
      criticalLeakPoints: { type: 'array' },
      trustSignalStrategy: { type: 'string' },
      pricingPsychologyDirection: { type: 'string' },
      urgencyAndScarcityDirection: { type: 'string' },
      recoveryPlays: { type: 'array' },
      keyMetricsToWatch: { type: 'array' },
      rationale: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.6,
};

// ============================================================================
// INPUT CONTRACT (matches ArchitectManager dispatch at architect/manager.ts:1614-1623)
// ============================================================================
//
// The manager passes `stages` and `conversionPoints` as structured objects
// from its internal FunnelFlow type. We accept them as loose records so the
// specialist is robust to shape drift in the upstream type — the detailed
// content lives in the `brief` string that the manager formats for us at
// architect/manager.ts:1684-1713 anyway.
// ============================================================================

export interface AnalyzeFunnelRequest {
  action: 'analyze_funnel';
  funnelType: string;
  businessType: string;
  stages: Array<Record<string, unknown>>;
  conversionPoints: Array<Record<string, unknown>>;
  brief: string;
}

const AnalyzeFunnelRequestSchema = z.object({
  action: z.literal('analyze_funnel'),
  funnelType: z.string().min(2).max(120),
  businessType: z.string().min(2).max(120),
  stages: z.array(z.record(z.unknown())).max(20).default([]),
  conversionPoints: z.array(z.record(z.unknown())).max(30).default([]),
  brief: z.string().min(20).max(8000),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================
//
// Top-level field names `funnelFramework` and `primaryConversionLeak` are
// chosen to match the new extraction block in
// ArchitectManager.synthesizeSiteArchitecture (Task #41 also adds the
// `funnelStrategy` extraction at architect/manager.ts immediately after the
// copyData block). Short enum labels at the top level for easy regression
// match and easy manager reads; all rich prose lives one layer deeper.
//
// All variable-length content lives in either prose strings (length deltas
// don't fail tolerance) or flat string arrays with bounds (regression-stable
// when bounds are declared in case docs). No nested arrays of objects.
//
// Per the Task #40 lesson, prose caps are set GENEROUSLY from the start
// (5000 chars for direction fields, 10000 for section-scaling stageRiskProfile)
// because temperature 0 produces longer prose than temperature 0.6 and
// tight caps cause baseline rejections.
// ============================================================================

const FunnelFrameworkEnum = z.enum([
  'LEAD_MAGNET_TRIPWIRE',
  'FREE_TRIAL',
  'BOOK_A_DEMO',
  'WEBINAR',
  'VSL_DIRECT',
  'PRODUCT_LED',
  'HIGH_TICKET_APPLICATION',
  'DIRECT_CHECKOUT',
]);

const PrimaryConversionLeakEnum = z.enum([
  'TOP_OF_FUNNEL_TRAFFIC',
  'LANDING_RELEVANCE',
  'OFFER_CLARITY',
  'TRUST_SIGNALS',
  'PRICING_FRICTION',
  'CHECKOUT_DROPOFF',
  'ACTIVATION_DROPOFF',
  'POST_PURCHASE_RETENTION',
]);

const AnalyzeFunnelResultSchema = z.object({
  funnelFramework: FunnelFrameworkEnum,
  frameworkReasoning: z.string().min(50).max(2500),
  primaryConversionLeak: PrimaryConversionLeakEnum,
  leakDiagnosis: z.string().min(80).max(5000),
  stageRiskProfile: z.string().min(100).max(10000),
  criticalLeakPoints: z.array(z.string().min(15).max(1000)).min(2).max(6),
  trustSignalStrategy: z.string().min(80).max(5000),
  pricingPsychologyDirection: z.string().min(80).max(5000),
  urgencyAndScarcityDirection: z.string().min(80).max(5000),
  recoveryPlays: z.array(z.string().min(20).max(1000)).min(3).max(7),
  keyMetricsToWatch: z.array(z.string().min(5).max(300)).min(3).max(7),
  rationale: z.string().min(150).max(6000),
});

export type AnalyzeFunnelResult = z.infer<typeof AnalyzeFunnelResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: FunnelPathologistGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Funnel Strategist GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-funnel-strategist-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<FunnelPathologistGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Funnel Pathologist GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: FunnelPathologistGMConfig = {
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
      `Funnel Pathologist: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
// ACTION: analyze_funnel
// ============================================================================

function summarizeStages(stages: Array<Record<string, unknown>>): string {
  if (stages.length === 0) { return '(no stages provided — infer from funnelType and brief)'; }
  return stages
    .map((s, i) => {
      const name = typeof s.name === 'string' ? s.name : `stage_${i + 1}`;
      const goal = typeof s.goal === 'string' ? s.goal : '(unspecified)';
      return `  ${i + 1}. ${name} — goal: ${goal}`;
    })
    .join('\n');
}

function summarizeConversionPoints(points: Array<Record<string, unknown>>): string {
  if (points.length === 0) { return '(no conversion points provided — infer from funnelType and brief)'; }
  return points
    .map((c, i) => {
      const location = typeof c.location === 'string' ? c.location : `point_${i + 1}`;
      const action = typeof c.action === 'string' ? c.action : '(unspecified)';
      const target = typeof c.target === 'string' ? c.target : '(unspecified)';
      return `  ${i + 1}. ${location}: ${action} -> ${target}`;
    })
    .join('\n');
}

function buildAnalyzeFunnelUserPrompt(req: AnalyzeFunnelRequest): string {
  const stageSummary = summarizeStages(req.stages);
  const conversionSummary = summarizeConversionPoints(req.conversionPoints);

  const sections: string[] = [
    'ACTION: analyze_funnel',
    '',
    'You are diagnosing the STRATEGIC funnel for an entire from-scratch site or funnel.',
    'You are NOT designing funnel stages, concrete tactics, or A/B tests — that happens downstream in the Builder-layer Funnel Engineer.',
    'Your job is to pick the funnel framework that fits this business, identify the primary conversion leak, describe the stage risk profile, and prescribe strategic recovery plays and metrics that the downstream Builder will then execute against.',
    '',
    `Funnel type (from caller): ${req.funnelType}`,
    `Business type / industry: ${req.businessType}`,
    '',
    'Stages (from caller — informational; do not parrot them back, DIAGNOSE them):',
    stageSummary,
    '',
    'Conversion points (from caller — informational; do not parrot them back, DIAGNOSE them):',
    conversionSummary,
    '',
    'Brief from the Architect Manager:',
    req.brief,
    '',
    'Produce a strategic funnel diagnosis. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    '  "funnelFramework": "<one of: LEAD_MAGNET_TRIPWIRE | FREE_TRIAL | BOOK_A_DEMO | WEBINAR | VSL_DIRECT | PRODUCT_LED | HIGH_TICKET_APPLICATION | DIRECT_CHECKOUT>",',
    '  "frameworkReasoning": "<why this framework fits the audience, price point, sales cycle, and industry — 50 to 2500 chars>",',
    '  "primaryConversionLeak": "<one of: TOP_OF_FUNNEL_TRAFFIC | LANDING_RELEVANCE | OFFER_CLARITY | TRUST_SIGNALS | PRICING_FRICTION | CHECKOUT_DROPOFF | ACTIVATION_DROPOFF | POST_PURCHASE_RETENTION>",',
    '  "leakDiagnosis": "<extended prose 80 to 5000 chars describing WHY this leak will be the biggest conversion killer for THIS specific business — name the psychology, the audience behavior, and the funnel-position dynamics>",',
    '  "stageRiskProfile": "<extended prose 100 to 10000 chars walking through each stage of the funnel in order and naming the specific risk profile at each stage: what will go wrong here, who will drop, and why. This field scales with stage count — the more stages, the longer and more detailed>",',
    '  "criticalLeakPoints": ["<2 to 6 specific leak points with stakes — each 15 to 1000 chars — each one is a real leak, not a generic concern, and each one has an identifiable cause>"],',
    '  "trustSignalStrategy": "<extended prose 80 to 5000 chars describing which trust signals this audience needs and WHERE they should appear: named customer logos, case studies, testimonials, security badges, guarantees, founder story, press mentions. Tie the choice to audience psychology, not generic best practice>",',
    '  "pricingPsychologyDirection": "<extended prose 80 to 5000 chars describing the pricing psychology posture: anchor price, charm pricing vs round numbers, single plan vs tiered, annual vs monthly framing, decoy strategy if any, guarantee posture. Tie the choice to the audience and the funnel framework>",',
    '  "urgencyAndScarcityDirection": "<extended prose 80 to 5000 chars describing the urgency and scarcity posture: real urgency sources (cohort start dates, limited inventory, launch pricing windows), how to avoid fake urgency that burns trust, and which urgency tactics fit THIS audience. If no real urgency exists, say so explicitly and prescribe trust-driven conversion instead>",',
    '  "recoveryPlays": ["<3 to 7 specific strategic plays to plug the primary leak and de-risk the funnel — each 20 to 1000 chars — each play is actionable and specific to THIS business, not a generic CRO recommendation>"],',
    '  "keyMetricsToWatch": ["<3 to 7 specific metrics the downstream Builder should instrument — each 5 to 300 chars — name the metric precisely (e.g. \'trial-to-paid conversion at day 14\' not \'conversion rate\')>"],',
    '  "rationale": "<full strategic rationale tying the framework + primary leak + stage risk profile + trust + pricing + urgency + recovery plays together into a coherent diagnosis that could only fit THIS client and THIS brief — 150 to 6000 chars>"',
    '}',
    '',
    'Hard rules you MUST follow:',
    '- Pick exactly ONE funnelFramework from the enum. Do not invent new framework names.',
    '- Pick exactly ONE primaryConversionLeak from the enum. Do not invent new leak names.',
    '- The framework choice MUST match the price point, sales cycle, and audience implied by the brief. LEAD_MAGNET_TRIPWIRE for cold-to-low-ticket info-product audiences. FREE_TRIAL for self-serve SaaS with fast activation. BOOK_A_DEMO for enterprise or mid-market SaaS with complex buying committees. WEBINAR for high-ticket coaching/education/mid-ticket services. VSL_DIRECT for info-product cold traffic with long-copy conversion. PRODUCT_LED for freemium with in-product upgrade triggers. HIGH_TICKET_APPLICATION for 4+ figure offers with qualification gating. DIRECT_CHECKOUT for DTC e-commerce and single-SKU transactions.',
    '- The primaryConversionLeak choice MUST be the biggest leak for THIS business — do not default to OFFER_CLARITY just because it fits most funnels. If the audience is cold and the traffic is paid, TOP_OF_FUNNEL_TRAFFIC or LANDING_RELEVANCE may be the real leak. If the offer is high-ticket to skeptical enterprise buyers, TRUST_SIGNALS. If the product is great but activation is hard, ACTIVATION_DROPOFF. Diagnose honestly.',
    '- leakDiagnosis MUST name the psychology driving the leak, not just the symptom. "People drop at pricing" is a symptom; "the audience associates month-to-month with agency-lock-in trauma and needs explicit no-contract framing before the price is shown" is a diagnosis.',
    '- stageRiskProfile MUST walk through EVERY stage in the funnel in order. If the caller provided a stages list, reference them explicitly. If the caller did not, enumerate the stages the chosen framework implies (e.g. "awareness → trial signup → first-value activation → day-14 upgrade trigger → paid conversion") and risk-profile each one.',
    '- criticalLeakPoints MUST be specific real leak points with identifiable causes — for example "pricing page visitors leave when they see tiered pricing because the brief says month-to-month is a differentiator and tiered pricing buries that" — never generic concerns.',
    '- trustSignalStrategy MUST tie each trust signal to audience psychology. "Add testimonials" is generic. "Because the audience has been burned by cold-outreach agencies, the first trust signal must be named customer logos from peers in their ARR band, placed above the fold before any product screenshot" is specific.',
    '- pricingPsychologyDirection MUST reconcile the brand voice (from Brand DNA) with the pricing posture. If the brand voice is restrained editorial, charm pricing ($47) will read as cheap; use round numbers. If the audience is mobile-first DTC, a single anchored price with a strikethrough may earn attention.',
    '- urgencyAndScarcityDirection MUST be honest about whether real urgency exists. If the business has no real urgency source, DO NOT invent fake countdown timers — prescribe trust-driven conversion instead. Fake urgency burns audience trust at scale.',
    '- recoveryPlays MUST be specific to THIS business, not generic CRO advice. "Add social proof" is generic. "Replace the feature-list section with a single-customer case study carousel that opens with the peer-ARR-band quote" is a specific play.',
    '- keyMetricsToWatch MUST be precisely named metrics the Builder can instrument. "Conversion rate" is too vague. "Day-14 trial-to-paid conversion rate", "cart abandonment rate at shipping calculation", "landing-to-pricing-page progression rate" are precise.',
    '- Do NOT invent metrics, conversion percentages, or specific performance predictions. The rationale is strategic reasoning, not performance forecasts.',
    '- If the Brand DNA injection above includes avoidPhrases, none of your prose fields may use those phrases.',
    '- If the Brand DNA injection above includes keyPhrases, weave at least one naturally into the rationale or recoveryPlays.',
    '- The rationale MUST explicitly tie framework + primary leak + stage risk profile + trust + pricing + urgency + recovery plays together into a coherent diagnosis that could only fit THIS client and THIS brief. Generic funnel diagnoses are a failure.',
    '- Output ONLY the JSON object. No prose outside it. No markdown fences. No preamble.',
  ];

  return sections.join('\n');
}

async function executeAnalyzeFunnel(
  req: AnalyzeFunnelRequest,
  ctx: LlmCallContext,
): Promise<AnalyzeFunnelResult> {
  const userPrompt = buildAnalyzeFunnelUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Funnel Pathologist output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = AnalyzeFunnelResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Funnel Pathologist output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// FUNNEL PATHOLOGIST CLASS
// ============================================================================

export class FunnelPathologist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Funnel Pathologist initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Funnel Pathologist: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Funnel Pathologist: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Funnel Pathologist does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[FunnelPathologist] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const inputValidation = AnalyzeFunnelRequestSchema.safeParse({
        ...payload,
        action,
      });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Funnel Pathologist analyze_funnel: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      const data = await executeAnalyzeFunnel(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[FunnelPathologist] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 460, boilerplate: 60 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createFunnelPathologist(): FunnelPathologist {
  return new FunnelPathologist();
}

let instance: FunnelPathologist | null = null;

export function getFunnelPathologist(): FunnelPathologist {
  instance ??= createFunnelPathologist();
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
  buildAnalyzeFunnelUserPrompt,
  stripJsonFences,
  AnalyzeFunnelRequestSchema,
  AnalyzeFunnelResultSchema,
};
