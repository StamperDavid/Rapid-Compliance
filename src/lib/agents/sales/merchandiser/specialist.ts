/**
 * Merchandiser Specialist — REAL AI AGENT (Task #48 rebuild, April 14 2026)
 *
 * Before the rebuild, this specialist was a 1585-LOC hardcoded nudge
 * decision engine. Seven `NUDGE_STRATEGY` constants (ENGAGEMENT_NUDGE,
 * CART_ABANDONMENT, TRIAL_EXPIRY, WELCOME_OFFER, etc.) with bolted-on
 * trigger conditions, deterministic segment LTV/conversion-rate lookup
 * tables, and hand-coded `evaluateNudge`/`scoreInteractions`/`calculateROI`
 * methods. Zero LLM calls. `SYSTEM_PROMPT` defined but never sent.
 *
 * The pre-rebuild specialist had ZERO live `.execute()` callers in the
 * Sales Manager. `merchandiserInstance` was assigned but never invoked.
 * This rebuild is forward-only.
 *
 * After the rebuild, Merchandiser is a real LLM-backed pricing/nudge
 * strategist. Given a lead interaction history + segment + optional
 * strategy hint, it reads the data, picks the right nudge strategy, and
 * produces a structured coupon decision with reasoning, Stripe-compatible
 * payload, and an ROI analysis.
 *
 * Supported action (single):
 *   - evaluate_nudge — analyze lead history + recommend nudge strategy
 *
 * Pattern matches Task #46 Lead Qualifier: pure LLM analyst with
 * DEFAULT_SYSTEM_PROMPT fallback (lead behavior analysis — not
 * customer-facing content generation).
 *
 * @module agents/sales/merchandiser/specialist
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

const FILE = 'sales/merchandiser/specialist.ts';
const SPECIALIST_ID = 'MERCHANDISER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['evaluate_nudge'] as const;

/**
 * Realistic max_tokens floor for the worst-case Merchandiser response.
 *
 * Derivation:
 *   EvaluateNudgeResultSchema worst case:
 *     reasoning: 6 × 400 = 2400
 *     constraints.violations: 5 × 300 = 1500
 *     roiAnalysis.rationale 1500
 *     strategyReasoning 2000
 *     rationale 2500
 *     stripeCouponPayload metadata ≈ 500
 *     enum/number overhead 300
 *     ≈ 10,700 chars total prose
 *     /3.0 chars/token = 3,567 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 4,709 tokens minimum.
 *
 *   Setting the floor at 6,000 tokens covers the schema with margin.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 6000;

interface MerchandiserGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const DEFAULT_SYSTEM_PROMPT = `You are the Merchandiser for SalesVelocity.ai — the Sales-layer specialist who decides when to drop a discount, promotion, or nudge coupon on a prospect or trial user to break conversion friction without burning margin. You think like a senior pricing strategist who has run thousands of nudge experiments across B2B SaaS, e-commerce, and subscription services, and knows the difference between a price-sensitive buyer who just needs a 10% push and a window-shopper who will never buy regardless of discount.

## Your role in the swarm

You read lead interaction history (page views, time on site, email engagement, trial usage, cart history, purchase history, segment) and decide:
1. Should we offer a nudge at all? (shouldNudge bool)
2. Which nudge strategy fits? (strategy enum pick)
3. What discount percent? (0-50%)
4. What's the expected ROI vs the cost of the discount? (roiAnalysis)
5. What's the Stripe-compatible coupon payload? (stripeCouponPayload)

You do NOT apply the coupon (that's infrastructure). You decide, justify, and hand off the decision as a structured report.

## Nudge strategies (pick exactly ONE)

- **ENGAGEMENT_NUDGE** — 10% off after 3+ pricing page visits without purchase. High-intent but price-hesitant.
- **CART_ABANDONMENT** — 15% off within 24h of abandoned cart. Break checkout friction.
- **TRIAL_EXPIRY** — 20% off when trial is in final 3 days with usage > 30%. Convert engaged trial users.
- **WELCOME_OFFER** — 15% off first-time buyer from high-intent source (referral, direct search).
- **WINBACK** — 25% off churned customer in the last 30 days with 3+ months prior tenure.
- **LOYALTY_REWARD** — 10% off renewal for high-LTV active customers 30 days before renewal.
- **STRATEGIC_DISCOUNT** — custom percentage for enterprise deals in negotiation with legitimate price objection.
- **NO_NUDGE** — do NOT offer a discount. Either the lead is not buying-ready, already buying at full price, or the segment's discount sensitivity is too low to justify the cost.

## Decision rules

- High trial usage (>60%) + trial day <= 10: DO NOT NUDGE. They're engaged and will convert.
- Trial usage <= 15% + trial day >= 10: DO NOT NUDGE. No product-market fit yet; discount won't fix that.
- Enterprise segment with LTV > $20k: be conservative with discounts. 10% max unless there's a specific competitor displacement opportunity.
- SMB/startup segment: more aggressive discounts acceptable (up to 25%) because price sensitivity is higher and LTV is lower.
- NEVER stack nudges. If the lead already has an active coupon, set shouldNudge=false and explain.
- ROI justification: expected LTV lift × probability increment must exceed the discount cost. If the math doesn't work, NO_NUDGE.

## Stripe coupon payload constraints

- id: unique alphanumeric (use \`nudge_{strategy}_{leadId}_{timestamp}\` pattern — you pick the timestamp as the current Unix seconds)
- percent_off: match your chosen discountPercent
- duration: usually 'once' for nudges, 'repeating' for LOYALTY_REWARD (3 months), 'forever' never
- max_redemptions: always 1 for a lead-targeted nudge
- redeem_by: Unix timestamp N hours from now where N matches strategy urgency
- metadata: strategy, lead_id, interaction_score (0-100), source (the decision trigger), expected_roi

## Hard rules

- NEVER recommend a nudge without grounding in specific interaction signals. Name the signal.
- NEVER inflate expectedROI to justify a decision. Be honest — if ROI is marginal, mark it 'marginal' or 'no'.
- NEVER stack nudges. One active nudge per lead max.
- ALWAYS include constraints.violations if any rule is broken (even if you still recommend shouldNudge=true with warnings).
- ALWAYS explain WHY shouldNudge=false is the right call when applicable — the caller needs to understand the no.
- Output ONLY the JSON object matching the schema in the user prompt. No markdown fences. No preamble.`;

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Merchandiser',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'REVENUE_DIRECTOR',
    capabilities: [
      'nudge_evaluation',
      'interaction_scoring',
      'coupon_generation',
      'roi_analysis',
      'constraint_validation',
    ],
  },
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  tools: ['evaluate_nudge'],
  outputSchema: {
    type: 'object',
    properties: {
      shouldNudge: { type: 'boolean' },
      strategy: { type: 'string' },
      discountPercent: { type: 'number' },
      stripeCouponPayload: { type: 'object' },
      roiAnalysis: { type: 'object' },
      rationale: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.3,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

const SegmentEnum = z.enum(['enterprise', 'mid_market', 'smb', 'startup', 'individual']);
const SubscriptionStatusEnum = z.enum(['none', 'trial', 'active', 'churned', 'paused']);

const NudgeStrategyIdEnum = z.enum([
  'ENGAGEMENT_NUDGE',
  'CART_ABANDONMENT',
  'TRIAL_EXPIRY',
  'WELCOME_OFFER',
  'WINBACK',
  'LOYALTY_REWARD',
  'STRATEGIC_DISCOUNT',
  'NO_NUDGE',
]);

const InteractionHistorySchema = z.object({
  leadId: z.string().min(1).max(300),
  segment: SegmentEnum,
  source: z.string().max(200).optional(),
  pageViews: z.object({
    pricingPageViews: z.number().int().min(0).max(10000).default(0),
    featurePageViews: z.number().int().min(0).max(10000).default(0),
    totalPageViews: z.number().int().min(0).max(10000).default(0),
    totalTimeOnSiteMinutes: z.number().min(0).max(100000).default(0),
  }).optional(),
  returnVisits: z.object({
    totalVisits: z.number().int().min(0).max(10000),
    daysActiveInLast30: z.number().int().min(0).max(30),
  }).optional(),
  emailEngagement: z.object({
    totalSent: z.number().int().min(0).max(10000),
    opened: z.number().int().min(0).max(10000),
    clicked: z.number().int().min(0).max(10000),
    replied: z.number().int().min(0).max(10000),
    unsubscribed: z.boolean(),
  }).optional(),
  trialUsage: z.object({
    isTrialUser: z.boolean(),
    trialDay: z.number().int().min(0).max(365).nullable(),
    usagePercentage: z.number().min(0).max(100),
    completedOnboarding: z.boolean(),
    teamMembersInvited: z.number().int().min(0).max(1000),
    featuresUsedCount: z.number().int().min(0).max(100),
  }).optional(),
  cartHistory: z.object({
    hasAbandonedCart: z.boolean(),
    abandonedCartValue: z.number().min(0).max(10_000_000).nullable(),
    hoursSinceAbandonment: z.number().min(0).max(1000).nullable(),
  }).optional(),
  purchaseHistory: z.object({
    hasPurchased: z.boolean(),
    totalPurchases: z.number().int().min(0).max(10000),
    lifetimeValue: z.number().min(0).max(100_000_000),
    subscriptionStatus: SubscriptionStatusEnum,
    daysSinceChurn: z.number().int().min(0).max(10000).nullable().optional(),
    tenureMonthsBeforeChurn: z.number().int().min(0).max(600).nullable().optional(),
  }).optional(),
  hasActiveCoupon: z.boolean().optional(),
});

const EvaluateNudgePayloadSchema = z.object({
  action: z.literal('evaluate_nudge'),
  interactionHistory: InteractionHistorySchema,
  strategyHint: NudgeStrategyIdEnum.optional(),
  segmentOverride: z.object({
    averageLTV: z.number().min(0),
    averageOrderValue: z.number().min(0),
    conversionRate: z.number().min(0).max(1),
    churnRate: z.number().min(0).max(1),
    discountSensitivity: z.number().min(0).max(1),
  }).optional(),
  roiThreshold: z.number().min(0).max(10).optional().default(1.5),
  currency: z.string().length(3).optional().default('usd'),
});

export type EvaluateNudgePayload = z.infer<typeof EvaluateNudgePayloadSchema>;
export type InteractionHistory = z.infer<typeof InteractionHistorySchema>;
export type NudgeStrategyId = z.infer<typeof NudgeStrategyIdEnum>;
export type Segment = z.infer<typeof SegmentEnum>;

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================

const StripeCouponPayloadSchema = z.object({
  id: z.string().min(1).max(200),
  percent_off: z.number().int().min(0).max(50),
  duration: z.enum(['once', 'repeating', 'forever']),
  duration_in_months: z.number().int().min(0).max(36).nullable(),
  max_redemptions: z.number().int().min(1).max(10),
  redeem_by: z.number().int().min(0).max(4_000_000_000).nullable(),
  currency: z.string().length(3),
  metadata: z.object({
    strategy: NudgeStrategyIdEnum,
    lead_id: z.string().min(1).max(300),
    interaction_score: z.number().int().min(0).max(100),
    source: z.string().min(1).max(200),
    expected_roi: z.number().min(0).max(20),
  }),
});

const ROIAnalysisSchema = z.object({
  expectedROI: z.number().min(0).max(20),
  meetsThreshold: z.boolean(),
  recommendation: z.enum(['strong_yes', 'yes', 'marginal', 'no']),
  rationale: z.string().min(30).max(1500),
});

const ConstraintsSchema = z.object({
  passed: z.boolean(),
  violations: z.array(z.string().min(5).max(300)).max(5),
});

const EvaluateNudgeResultSchema = z.object({
  action: z.literal('evaluate_nudge'),
  leadId: z.string().min(1).max(300),
  evaluatedAt: z.string().min(10).max(60),
  shouldNudge: z.boolean(),
  strategy: NudgeStrategyIdEnum,
  strategyReasoning: z.string().min(30).max(2000),
  discountPercent: z.number().int().min(0).max(50),
  interactionScore: z.number().int().min(0).max(100),
  reasoning: z.array(z.string().min(10).max(400)).min(2).max(6),
  constraints: ConstraintsSchema,
  roiAnalysis: ROIAnalysisSchema,
  stripeCouponPayload: StripeCouponPayloadSchema.nullable(),
  rationale: z.string().min(50).max(2500),
});

export type EvaluateNudgeResult = z.infer<typeof EvaluateNudgeResultSchema>;
export type StripeCouponPayload = z.infer<typeof StripeCouponPayloadSchema>;
export type ROIAnalysis = z.infer<typeof ROIAnalysisSchema>;
export type CouponDecision = EvaluateNudgeResult;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: MerchandiserGMConfig;
  resolvedSystemPrompt: string;
  source: 'gm' | 'fallback';
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    logger.warn(
      `[Merchandiser] GM not seeded for industryKey=${industryKey}; using DEFAULT_SYSTEM_PROMPT fallback.`,
      { file: FILE },
    );
    return {
      gm: {
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        model: 'claude-sonnet-4.6',
        temperature: 0.3,
        maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
        supportedActions: [...SUPPORTED_ACTIONS],
      },
      resolvedSystemPrompt: DEFAULT_SYSTEM_PROMPT,
      source: 'fallback',
    };
  }

  const config = gmRecord.config as Partial<MerchandiserGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(`Merchandiser GM ${gmRecord.id} has no usable systemPrompt`);
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  return {
    gm: {
      systemPrompt,
      model: config.model ?? 'claude-sonnet-4.6',
      temperature: config.temperature ?? 0.3,
      maxTokens: effectiveMaxTokens,
      supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
    },
    resolvedSystemPrompt: systemPrompt,
    source: 'gm',
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
      `Merchandiser: LLM response truncated at maxTokens=${ctx.gm.maxTokens} (finish_reason='length'). ` +
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
// ACTION: evaluate_nudge
// ============================================================================

function formatInteractionHistory(h: InteractionHistory): string {
  const lines: string[] = [
    `Lead ID: ${h.leadId}`,
    `Segment: ${h.segment}`,
  ];
  if (h.source) { lines.push(`Source: ${h.source}`); }
  if (h.pageViews) {
    lines.push(`Page views: pricing=${h.pageViews.pricingPageViews}, feature=${h.pageViews.featurePageViews}, total=${h.pageViews.totalPageViews}, time=${h.pageViews.totalTimeOnSiteMinutes}min`);
  }
  if (h.returnVisits) {
    lines.push(`Return visits: ${h.returnVisits.totalVisits} total, ${h.returnVisits.daysActiveInLast30}/30 days active`);
  }
  if (h.emailEngagement) {
    const e = h.emailEngagement;
    lines.push(`Email engagement: ${e.opened}/${e.totalSent} opened, ${e.clicked} clicked, ${e.replied} replied, unsubscribed=${e.unsubscribed}`);
  }
  if (h.trialUsage) {
    const t = h.trialUsage;
    lines.push(`Trial: isTrialUser=${t.isTrialUser}, day=${t.trialDay ?? 'n/a'}, usage=${t.usagePercentage}%, onboarding=${t.completedOnboarding}, teamInvites=${t.teamMembersInvited}, featuresUsed=${t.featuresUsedCount}`);
  }
  if (h.cartHistory) {
    const c = h.cartHistory;
    lines.push(`Cart: abandoned=${c.hasAbandonedCart}, value=${c.abandonedCartValue ?? 'n/a'}, hoursSince=${c.hoursSinceAbandonment ?? 'n/a'}`);
  }
  if (h.purchaseHistory) {
    const p = h.purchaseHistory;
    lines.push(`Purchase: hasPurchased=${p.hasPurchased}, total=${p.totalPurchases}, LTV=$${p.lifetimeValue}, subStatus=${p.subscriptionStatus}, daysSinceChurn=${p.daysSinceChurn ?? 'n/a'}, tenureBeforeChurn=${p.tenureMonthsBeforeChurn ?? 'n/a'}mo`);
  }
  lines.push(`Has active coupon: ${h.hasActiveCoupon ?? false}`);
  return lines.join('\n');
}

function buildEvaluateNudgePrompt(req: EvaluateNudgePayload): string {
  return [
    'ACTION: evaluate_nudge',
    '',
    `ROI threshold: ${req.roiThreshold}x (expected ROI must exceed this to recommend shouldNudge=true)`,
    `Currency: ${req.currency}`,
    req.strategyHint ? `Strategy hint from caller: ${req.strategyHint} (strong signal, override only if data clearly fits another)` : 'Strategy hint: (none — pick yourself)',
    '',
    '## Interaction history',
    formatInteractionHistory(req.interactionHistory),
    '',
    req.segmentOverride
      ? `## Segment economics (override)\nLTV=$${req.segmentOverride.averageLTV}, AOV=$${req.segmentOverride.averageOrderValue}, conversion=${(req.segmentOverride.conversionRate * 100).toFixed(1)}%, churn=${(req.segmentOverride.churnRate * 100).toFixed(1)}%, discountSensitivity=${req.segmentOverride.discountSensitivity}`
      : '## Segment economics: use your own assumptions for the segment based on typical B2B SaaS benchmarks',
    '',
    '---',
    '',
    'Evaluate this lead. Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "action": "evaluate_nudge",',
    `  "leadId": "${req.interactionHistory.leadId}",`,
    '  "evaluatedAt": "<current ISO 8601 timestamp>",',
    '  "shouldNudge": <bool>,',
    '  "strategy": "<one of: ENGAGEMENT_NUDGE | CART_ABANDONMENT | TRIAL_EXPIRY | WELCOME_OFFER | WINBACK | LOYALTY_REWARD | STRATEGIC_DISCOUNT | NO_NUDGE>",',
    '  "strategyReasoning": "<30-2000 chars — why this strategy fits the interaction pattern>",',
    '  "discountPercent": <integer 0-50 — 0 if shouldNudge=false>,',
    '  "interactionScore": <integer 0-100 — how engaged is this lead>,',
    '  "reasoning": ["<2-6 specific signals from the interaction history that drove the decision>"],',
    '  "constraints": {',
    '    "passed": <bool>,',
    '    "violations": ["<0-5 any rules broken, e.g. already has active coupon, stacked discount>"]',
    '  },',
    '  "roiAnalysis": {',
    '    "expectedROI": <0-20, ratio of expected LTV lift to discount cost>,',
    '    "meetsThreshold": <bool — expectedROI >= roiThreshold>,',
    '    "recommendation": "<strong_yes | yes | marginal | no>",',
    '    "rationale": "<30-1500 chars explaining the ROI math>"',
    '  },',
    '  "stripeCouponPayload": <null if shouldNudge=false, otherwise Stripe-compatible coupon object>,',
    '  "rationale": "<50-2500 chars synthesizing the decision>"',
    '}',
    '',
    'If shouldNudge=true, stripeCouponPayload MUST be non-null with:',
    `  id: "nudge_{strategy}_{leadId}_{currentUnixSeconds}"`,
    '  percent_off: same as discountPercent',
    '  duration: "once" (default) | "repeating" for LOYALTY_REWARD | "forever" never',
    '  duration_in_months: 3 for LOYALTY_REWARD repeating, null otherwise',
    '  max_redemptions: 1',
    `  redeem_by: <current unix seconds + N hours where N matches strategy urgency — e.g. 24 for CART_ABANDONMENT, 72 for ENGAGEMENT_NUDGE, 168 (7 days) for TRIAL_EXPIRY>`,
    `  currency: "${req.currency}"`,
    '  metadata: { strategy, lead_id, interaction_score, source, expected_roi }',
    '',
    'If shouldNudge=false, stripeCouponPayload MUST be null and strategy SHOULD be NO_NUDGE (unless another strategy fits but ROI does not justify it).',
    '',
    'Hard rules:',
    '- NEVER recommend a nudge if hasActiveCoupon=true. Set shouldNudge=false, strategy=NO_NUDGE, explain in rationale.',
    '- High trial engagement (usagePercentage > 60% and trialDay <= 10) = NO_NUDGE (they will convert naturally).',
    '- Low trial engagement (usagePercentage <= 15% and trialDay >= 10) = NO_NUDGE (discount will not fix product-market fit).',
    '- discountPercent must be 0 when shouldNudge=false.',
  ].join('\n');
}

async function executeEvaluateNudge(
  req: EvaluateNudgePayload,
  ctx: LlmCallContext,
): Promise<EvaluateNudgeResult> {
  const userPrompt = buildEvaluateNudgePrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Merchandiser output was not valid JSON: ${rawContent.slice(0, 300)}`);
  }

  const result = EvaluateNudgeResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Merchandiser output did not match expected schema: ${issueSummary}`);
  }

  const data = result.data;

  // Enforce shouldNudge ↔ stripeCouponPayload invariant
  if (data.shouldNudge && data.stripeCouponPayload === null) {
    throw new Error('Merchandiser: shouldNudge=true requires stripeCouponPayload to be non-null');
  }
  if (!data.shouldNudge && data.stripeCouponPayload !== null) {
    throw new Error('Merchandiser: shouldNudge=false requires stripeCouponPayload to be null');
  }
  if (!data.shouldNudge && data.discountPercent !== 0) {
    throw new Error('Merchandiser: shouldNudge=false requires discountPercent=0');
  }

  return data;
}

// ============================================================================
// MERCHANDISER CLASS
// ============================================================================

export class MerchandiserSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Merchandiser initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const rawPayload = message.payload as Record<string, unknown> | null;
      if (rawPayload === null || typeof rawPayload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Merchandiser: payload must be an object']);
      }

      const normalized = {
        ...rawPayload,
        action: rawPayload.action ?? 'evaluate_nudge',
      };

      const inputValidation = EvaluateNudgePayloadSchema.safeParse(normalized);
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Merchandiser: invalid input payload: ${issueSummary}`,
        ]);
      }

      const payload = inputValidation.data;
      logger.info(
        `[Merchandiser] Executing evaluate_nudge taskId=${taskId} leadId=${payload.interactionHistory.leadId} segment=${payload.interactionHistory.segment}`,
        { file: FILE },
      );

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
      const result = await executeEvaluateNudge(payload, ctx);

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[Merchandiser] Execution failed',
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
    return { functional: 480, boilerplate: 80 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createMerchandiserSpecialist(): MerchandiserSpecialist {
  return new MerchandiserSpecialist();
}

let instance: MerchandiserSpecialist | null = null;

export function getMerchandiserSpecialist(): MerchandiserSpecialist {
  instance ??= createMerchandiserSpecialist();
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
  DEFAULT_SYSTEM_PROMPT,
  loadGMConfig,
  stripJsonFences,
  buildEvaluateNudgePrompt,
  executeEvaluateNudge,
  EvaluateNudgePayloadSchema,
  EvaluateNudgeResultSchema,
};
