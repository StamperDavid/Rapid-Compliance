/**
 * Deal Closer Specialist — REAL AI AGENT (Task #49 rebuild, April 14 2026)
 *
 * Before the rebuild, this specialist was a 1289-LOC hardcoded template
 * engine. `CLOSING_STRATEGIES` constant with 8 strategies, each with
 * subject/body templates full of `{contactName}` / `{deadline}` /
 * `{discount}` placeholders, a hand-coded decision tree via
 * `buildDecisionTree`/`traverseDecisionTree` that walked binary
 * conditions on `lead.temperature`/`lead.dealValue`/`lead.signals`, and
 * `generatePersonalizedScript`/`generateContractTemplate`/`generateClosingEmail`
 * methods that did string interpolation on templates. Zero LLM calls.
 *
 * Unlike Tasks #46-#48, Deal Closer DOES have a live caller:
 * `SalesManager.orchestrateDealClosing` at revenue/manager.ts:2008-2077
 * builds a LeadHistory + options payload and calls
 * `dealCloserInstance.execute(message)`, then expects a
 * `ClosingStrategyResult` back with specific field names. The rebuild
 * preserves the input and output shapes so the manager keeps working.
 *
 * After the rebuild, Deal Closer is a real LLM-backed closing strategist.
 * Given a LeadHistory + options, it reads the lead's stage, temperature,
 * signals, and interaction history; picks the right closing strategy;
 * produces a personalized script; optionally drafts a contract template
 * and closing email; surfaces a follow-up sequence; and preempts
 * objections. All in one LLM call.
 *
 * Supported action (single):
 *   - generate_closing_strategy — full closing plan for a lead
 *
 * Pattern matches Task #47 Sales Outreach / Task #59 Alex: REQUIRED GM
 * single-action, Zod input + output, truncation backstop.
 *
 * @module agents/sales/deal-closer/specialist
 */

import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getDeal, moveDealToStage } from '@/lib/crm/deal-service';
import type { Deal } from '@/lib/crm/deal-service-types';
import { createActivity } from '@/lib/crm/activity-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'sales/deal-closer/specialist.ts';
const SPECIALIST_ID = 'DEAL_CLOSER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_closing_strategy', 'execute_close'] as const;

/**
 * The CRM pipeline order, lowest → highest. Used to compute the "next
 * stage after current" for an `advance` decision. The two terminal stages
 * (closed_won / closed_lost) are deliberately NOT in this progression — they
 * are reached only via an explicit `won` / `lost` decision, never by walking
 * forward from `negotiation`.
 */
const CRM_STAGE_ORDER: ReadonlyArray<Deal['stage']> = [
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
] as const;

/** Every valid CRM stage string — used to validate an operator-supplied targetStage. */
const ALL_CRM_STAGES: ReadonlySet<Deal['stage']> = new Set<Deal['stage']>([
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
]);

function isCrmStage(value: string): value is Deal['stage'] {
  return ALL_CRM_STAGES.has(value as Deal['stage']);
}

/**
 * Realistic max_tokens floor for the worst-case Deal Closer response.
 *
 * Derivation:
 *   GenerateClosingStrategyResultSchema worst case:
 *     strategyRationale 2500
 *     personalizedScript 3000
 *     recommendedActions: 6 × 300 = 1800
 *     contractTemplate: sections (4) × lineItems (5) × ~200 + rest ≈ 4500
 *     closingEmail: body 3000 + rest ≈ 4000
 *     followUpSequence: 5 × (message 1500 + escalationTrigger 200) = 8500
 *     objectionPreemptions: 5 × (all fields ≈ 1500) = 7500
 *     rationale 2500
 *     ≈ 34,300 chars
 *     /3.0 chars/token = 11,433 tokens
 *     + overhead + 25% margin ≈ 14,500 tokens.
 *
 *   Setting the floor at 16,000 tokens covers the schema with margin.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 16000;

interface DealCloserGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Deal Closer',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'REVENUE_DIRECTOR',
    capabilities: [
      'closing_strategy',
      'readiness_assessment',
      'personalized_scripting',
      'contract_drafting',
      'closing_email',
      'objection_preemption',
    ],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['generate_closing_strategy'],
  outputSchema: {
    type: 'object',
    properties: {
      primaryStrategy: { type: 'string' },
      readinessScore: { type: 'number' },
      personalizedScript: { type: 'string' },
      followUpSequence: { type: 'array' },
      objectionPreemptions: { type: 'array' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.5,
};

// ============================================================================
// INPUT CONTRACT — LeadHistory (preserved from pre-rebuild)
// ============================================================================

const ClosingStrategyEnum = z.enum([
  'URGENCY_PLAY',
  'VALUE_STACK',
  'TRIAL_CLOSE',
  'ASSUMPTIVE_CLOSE',
  'ALTERNATIVE_CLOSE',
  'SUMMARY_CLOSE',
  'SCARCITY_CLOSE',
  'SOCIAL_PROOF_CLOSE',
]);

const LeadTemperatureEnum = z.enum(['COLD', 'WARM', 'HOT', 'READY_TO_BUY']);
const DealStageEnum = z.enum([
  'DISCOVERY',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSING',
  'WON',
  'LOST',
]);
const BuyerPersonaEnum = z.enum([
  'ECONOMIC_BUYER',
  'TECHNICAL_BUYER',
  'USER_BUYER',
  'CHAMPION',
  'INFLUENCER',
  'GATEKEEPER',
]);

const LeadSignalSchema = z.object({
  type: z.enum(['ENGAGEMENT', 'INTENT', 'BEHAVIORAL', 'FIRMOGRAPHIC', 'TIMING']),
  name: z.string().min(1).max(200),
  value: z.union([z.number(), z.string(), z.boolean()]),
  weight: z.number().min(0).max(10),
  timestamp: z.union([z.string(), z.date()]),
});

const InteractionRecordSchema = z.object({
  type: z.enum(['EMAIL', 'CALL', 'MEETING', 'DEMO', 'PROPOSAL_SENT', 'FOLLOW_UP']),
  date: z.union([z.string(), z.date()]),
  outcome: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']),
  notes: z.string().max(2000),
  nextSteps: z.string().max(500).optional(),
});

const LeadHistorySchema = z.object({
  leadId: z.string().min(1).max(300),
  companyName: z.string().min(1).max(300),
  contactName: z.string().min(1).max(200),
  contactTitle: z.string().max(200),
  contactEmail: z.string().max(320),
  industry: z.string().max(200),
  companySize: z.string().max(100),
  dealValue: z.number().min(0).max(1_000_000_000),
  currentStage: DealStageEnum,
  temperature: LeadTemperatureEnum,
  persona: BuyerPersonaEnum,
  signals: z.array(LeadSignalSchema).max(40).default([]),
  interactions: z.array(InteractionRecordSchema).max(50).default([]),
  objectionHistory: z.array(z.string().min(1).max(500)).max(30).default([]),
  competitorMentions: z.array(z.string().min(1).max(200)).max(20).default([]),
  painPoints: z.array(z.string().min(1).max(500)).max(20).default([]),
  customFields: z.record(z.unknown()).optional(),
});

const ClosingOptionsSchema = z.object({
  includeContract: z.boolean().optional().default(true),
  includeEmail: z.boolean().optional().default(true),
  urgencyLevel: z.enum(['NORMAL', 'HIGH', 'CRITICAL']).optional().default('NORMAL'),
  customDiscounts: z.array(z.number().min(0).max(100)).max(5).optional(),
  competitorDisplacement: z.boolean().optional(),
});

const GenerateClosingStrategyPayloadSchema = z.object({
  action: z.literal('generate_closing_strategy'),
  lead: LeadHistorySchema,
  options: ClosingOptionsSchema.optional().default({
    includeContract: true,
    includeEmail: true,
    urgencyLevel: 'NORMAL',
  }),
});

export type ClosingStrategy = z.infer<typeof ClosingStrategyEnum>;
export type LeadTemperature = z.infer<typeof LeadTemperatureEnum>;
export type DealStage = z.infer<typeof DealStageEnum>;
export type BuyerPersona = z.infer<typeof BuyerPersonaEnum>;
export type LeadHistory = z.infer<typeof LeadHistorySchema>;
export type ClosingRequest = z.infer<typeof GenerateClosingStrategyPayloadSchema>;

// ============================================================================
// INPUT CONTRACT — execute_close (EXECUTOR action)
// ============================================================================

/**
 * Operator/Jasper → Revenue Director → Deal Closer execute_close payload.
 *
 * `decision` is the SEMANTIC intent (advance / won / lost). The specialist
 * maps it to a concrete CRM stage DETERMINISTICALLY IN CODE — the LLM never
 * picks the raw stage string. `targetStage` is an optional override for the
 * `advance` case (e.g. skip straight to negotiation); it is validated against
 * the real CRM stage union before use and ignored if unrecognized.
 */
const ExecuteClosePayloadSchema = z.object({
  action: z.literal('execute_close'),
  dealId: z.string().min(1).max(300),
  decision: z.enum(['advance', 'won', 'lost']),
  targetStage: z.string().min(1).max(60).optional(),
  callNotes: z.string().max(4000).optional(),
  /**
   * APPROVAL GATE. execute_close performs an irreversible CRM write (it moves a
   * real deal stage + logs an activity). It must NEVER fire autonomously from a
   * direct Jasper chat call. This flag is set true ONLY when the mission
   * StepRunner dispatched this as an operator-approved mission step
   * (context.viaApprovedMissionStep, threaded down through Jasper's tool layer
   * → Revenue Director). Absent/false → the specialist FAILS CLOSED and does
   * not mutate; it returns guidance telling Jasper to propose the action as a
   * mission step for operator approval.
   *
   * Defaults to `false` so any caller that omits it gets the safe (no-mutation)
   * behavior.
   */
  viaApprovedMissionStep: z.boolean().optional().default(false),
});

export type ExecuteCloseRequest = z.infer<typeof ExecuteClosePayloadSchema>;

/**
 * LLM JSON contract for execute_close. The model AUTHORS the activity note
 * and explains its reasoning — it does NOT emit a CRM stage. Output tokens
 * for this action are small; the schema floor still applies via the GM.
 */
const ActivityNoteSchema = z.object({
  rationale: z.string().min(10).max(2000),
  activity: z.object({
    subject: z.string().min(3).max(200),
    body: z.string().min(10).max(3000),
    outcome: z.enum(['positive', 'neutral', 'negative']),
  }),
});

export type ActivityNote = z.infer<typeof ActivityNoteSchema>;

// ============================================================================
// OUTPUT CONTRACT — ClosingStrategyResult (preserved from pre-rebuild)
// ============================================================================

const LineItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().int().min(1).max(10000),
  unitPrice: z.coerce.number().min(0).max(10_000_000),
  total: z.coerce.number().min(0).max(1_000_000_000),
  discount: z.coerce.number().min(0).optional(),
});

const ContractSectionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(600),
  lineItems: z.array(LineItemSchema).min(1).max(8),
  subtotal: z.number().min(0).max(1_000_000_000),
});

const SignatureBlockSchema = z.object({
  role: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  signatureLine: z.string().min(1).max(200),
  dateLine: z.string().min(1).max(100),
});

const ContractTemplateSchema = z.object({
  title: z.string().min(3).max(200),
  sections: z.array(ContractSectionSchema).min(1).max(6),
  totalValue: z.number().min(0).max(1_000_000_000),
  paymentTerms: z.string().min(5).max(500),
  validUntil: z.string().min(5).max(60),
  specialConditions: z.array(z.string().min(5).max(400)).max(6),
  signatures: z.array(SignatureBlockSchema).min(1).max(4),
});

const ClosingEmailSchema = z.object({
  subject: z.string().min(5).max(200),
  body: z.string().min(100).max(3500),
  tone: z.enum(['PROFESSIONAL', 'URGENT', 'FRIENDLY', 'AUTHORITATIVE']),
  callToAction: z.string().min(5).max(500),
  urgencyElements: z.array(z.string().min(3).max(300)).max(6),
  valueStackElements: z.array(z.string().min(3).max(300)).max(6),
  socialProofElements: z.array(z.string().min(3).max(300)).max(6),
});

const FollowUpStepSchema = z.object({
  day: z.number().int().min(0).max(90),
  action: z.string().min(5).max(300),
  channel: z.enum(['EMAIL', 'PHONE', 'LINKEDIN', 'TEXT']),
  message: z.string().min(20).max(1500),
  escalationTrigger: z.string().max(300).optional(),
});

const ObjectionPreemptionSchema = z.object({
  likelyObjection: z.string().min(5).max(400),
  preemptionStrategy: z.string().min(20).max(600),
  reframingStatement: z.string().min(20).max(2000),
  proofPoint: z.string().min(10).max(2000),
});

const GenerateClosingStrategyResultSchema = z.object({
  action: z.literal('generate_closing_strategy').optional(),
  primaryStrategy: ClosingStrategyEnum,
  secondaryStrategy: ClosingStrategyEnum.nullable(),
  strategyRationale: z.string().min(50).max(2500),
  readinessScore: z.number().min(0).max(100),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  recommendedActions: z.array(z.string().min(10).max(400)).min(2).max(6),
  personalizedScript: z.string().min(50).max(3000),
  contractTemplate: ContractTemplateSchema.optional(),
  closingEmail: ClosingEmailSchema.optional(),
  followUpSequence: z.array(FollowUpStepSchema).min(1).max(5),
  objectionPreemptions: z.array(ObjectionPreemptionSchema).min(1).max(5),
});

export type ClosingStrategyResult = z.infer<typeof GenerateClosingStrategyResultSchema>;
export type ContractTemplate = z.infer<typeof ContractTemplateSchema>;
export type ClosingEmail = z.infer<typeof ClosingEmailSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: DealCloserGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Deal Closer GM not found for industryKey=${industryKey}. ` +
      `Customer-facing content generation requires a Golden Master. ` +
      `Run node scripts/seed-deal-closer-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<DealCloserGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(`Deal Closer GM ${gmRecord.id} has no usable systemPrompt`);
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);
  return {
    gm: {
      systemPrompt,
      model: config.model ?? 'claude-sonnet-4.6',
      temperature: config.temperature ?? 0.5,
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
      `Deal Closer: LLM response truncated at maxTokens=${ctx.gm.maxTokens} (finish_reason='length'). ` +
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
// ACTION: generate_closing_strategy
// ============================================================================

function formatSignals(signals: LeadHistory['signals']): string {
  if (signals.length === 0) { return '(no signals)'; }
  return signals
    .slice(0, 15)
    .map((s) => `  - [${s.type}] ${s.name}: ${String(s.value)} (weight ${s.weight})`)
    .join('\n');
}

function formatInteractions(interactions: LeadHistory['interactions']): string {
  if (interactions.length === 0) { return '(no prior interactions)'; }
  return interactions
    .slice(0, 10)
    .map((i) => `  - ${i.type} (${i.outcome}): ${i.notes.slice(0, 200)}`)
    .join('\n');
}

function buildClosingStrategyPrompt(req: z.infer<typeof GenerateClosingStrategyPayloadSchema>): string {
  const lead = req.lead;
  const opts = req.options;

  return [
    'ACTION: generate_closing_strategy',
    '',
    `Urgency level (from caller): ${opts.urgencyLevel}`,
    `Include contract template: ${opts.includeContract}`,
    `Include closing email: ${opts.includeEmail}`,
    opts.customDiscounts && opts.customDiscounts.length > 0
      ? `Approved custom discount percentages: ${opts.customDiscounts.join(', ')}%`
      : '',
    opts.competitorDisplacement ? 'Competitor displacement in play: YES' : '',
    '',
    '## Lead',
    `Lead ID: ${lead.leadId}`,
    `Contact: ${lead.contactName}, ${lead.contactTitle} at ${lead.companyName}`,
    `Email: ${lead.contactEmail}`,
    `Industry: ${lead.industry} | Company size: ${lead.companySize}`,
    `Deal value: $${lead.dealValue.toLocaleString()}`,
    `Current stage: ${lead.currentStage}`,
    `Temperature: ${lead.temperature}`,
    `Persona: ${lead.persona}`,
    '',
    '## Signals',
    formatSignals(lead.signals),
    '',
    '## Interaction history',
    formatInteractions(lead.interactions),
    '',
    lead.objectionHistory.length > 0
      ? `## Prior objections\n${lead.objectionHistory.map((o) => `  - ${o}`).join('\n')}`
      : '',
    lead.competitorMentions.length > 0
      ? `## Competitors mentioned\n${lead.competitorMentions.join(', ')}`
      : '',
    lead.painPoints.length > 0
      ? `## Pain points\n${lead.painPoints.map((p) => `  - ${p}`).join('\n')}`
      : '',
    '',
    '---',
    '',
    'Produce a full closing strategy. Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "primaryStrategy": "<one of: URGENCY_PLAY | VALUE_STACK | TRIAL_CLOSE | ASSUMPTIVE_CLOSE | ALTERNATIVE_CLOSE | SUMMARY_CLOSE | SCARCITY_CLOSE | SOCIAL_PROOF_CLOSE>",',
    '  "secondaryStrategy": "<same enum or null>",',
    '  "strategyRationale": "<50-2500 chars — why this strategy fits the lead\'s stage, temperature, and signals>",',
    '  "readinessScore": <0-100 — how ready is this lead to close>,',
    '  "riskLevel": "<LOW | MEDIUM | HIGH>",',
    '  "recommendedActions": ["<2-6 specific next steps — not generic advice>"],',
    '  "personalizedScript": "<50-3000 chars — ready-to-use verbal script using the actual contact name, company, deal value, and signals>",',
    opts.includeContract ? '  "contractTemplate": { "title", "sections": [{ "name", "description", "lineItems": [{ "name", "description", "quantity", "unitPrice", "total", "discount?" }], "subtotal" }], "totalValue", "paymentTerms", "validUntil", "specialConditions": [], "signatures": [{ "role", "name", "title", "signatureLine", "dateLine" }] },' : '',
    opts.includeEmail ? '  "closingEmail": { "subject", "body" (100-3500 chars, plain text, personalized), "tone": "<PROFESSIONAL | URGENT | FRIENDLY | AUTHORITATIVE>", "callToAction", "urgencyElements": [], "valueStackElements": [], "socialProofElements": [] },' : '',
    '  "followUpSequence": [1-5 steps with { "day" (0-90), "action", "channel": "<EMAIL | PHONE | LINKEDIN | TEXT>", "message" (20-1500 chars, personalized), "escalationTrigger"? }],',
    '  "objectionPreemptions": [1-5 entries with { "likelyObjection", "preemptionStrategy", "reframingStatement", "proofPoint" }]',
    '}',
    '',
    'Hard rules:',
    `- Use the ACTUAL contact name "${lead.contactName}", company name "${lead.companyName}", and deal value $${lead.dealValue.toLocaleString()} — NO template placeholders like {contactName}.`,
    '- personalizedScript is plain conversational text — no markdown, no stage directions.',
    '- closingEmail.body is plain text — no markdown, no HTML.',
    `- readinessScore MUST reflect the data: temperature=${lead.temperature} and stage=${lead.currentStage} should anchor your score. HOT + CLOSING → 80+, COLD + DISCOVERY → <30.`,
    '- Strategy must match the data. URGENCY_PLAY only if there is a real deadline signal. SOCIAL_PROOF_CLOSE only if the lead persona responds to social proof.',
    `- If includeContract is false, OMIT the contractTemplate field entirely.`,
    `- If includeEmail is false, OMIT the closingEmail field entirely.`,
    '- Output ONLY the JSON object. No markdown fences. No prose outside it.',
  ].filter((line) => line !== '').join('\n');
}

async function executeGenerateClosingStrategy(
  req: z.infer<typeof GenerateClosingStrategyPayloadSchema>,
  ctx: LlmCallContext,
): Promise<ClosingStrategyResult> {
  const userPrompt = buildClosingStrategyPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Deal Closer output was not valid JSON: ${rawContent.slice(0, 300)}`);
  }

  const result = GenerateClosingStrategyResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Deal Closer output did not match expected schema: ${issueSummary}`);
  }

  const data = result.data;

  // Enforce includeContract / includeEmail invariants
  if (req.options.includeContract && !data.contractTemplate) {
    throw new Error('Deal Closer: options.includeContract=true but LLM did not produce contractTemplate');
  }
  if (req.options.includeEmail && !data.closingEmail) {
    throw new Error('Deal Closer: options.includeEmail=true but LLM did not produce closingEmail');
  }

  // Enforce contract total = sum of section subtotals
  if (data.contractTemplate) {
    const sectionSum = data.contractTemplate.sections.reduce((acc, s) => acc + s.subtotal, 0);
    if (Math.abs(sectionSum - data.contractTemplate.totalValue) > 1) {
      throw new Error(
        `Deal Closer: contractTemplate.totalValue=${data.contractTemplate.totalValue} does not equal sum of section subtotals=${sectionSum}`,
      );
    }
  }

  return data;
}

// ============================================================================
// ACTION: execute_close — EXECUTOR (deterministic CRM write + LLM-authored note)
// ============================================================================

/**
 * Result of an execute_close run. `dealMoved` is true once the CRM stage
 * write succeeded. `activityId` is null when the stage moved but the activity
 * write failed (partial success — we never discard a completed move).
 */
export interface ExecuteCloseResult {
  rationale: string;
  executed: {
    dealId: string;
    previousStage: Deal['stage'];
    newStage: Deal['stage'];
    activityId: string | null;
    dealMoved: boolean;
  };
}

/**
 * DETERMINISTIC decision → CRM stage mapping. The LLM never reaches this code
 * path; the stage is chosen purely from the decision + the deal's current
 * stage (+ an optional, validated operator override for `advance`).
 *
 * Throws when an `advance` cannot produce a forward move (already at the end
 * of the pipeline, or the resolved target equals the current stage).
 */
function resolveTargetStage(
  decision: ExecuteCloseRequest['decision'],
  currentStage: Deal['stage'],
  targetStageRaw: string | undefined,
): Deal['stage'] {
  if (decision === 'won') { return 'closed_won'; }
  if (decision === 'lost') { return 'closed_lost'; }

  // decision === 'advance'
  // 1) Honor an explicit, valid target stage if one was supplied.
  if (targetStageRaw !== undefined) {
    const candidate = targetStageRaw.toLowerCase();
    if (isCrmStage(candidate)) {
      if (candidate === currentStage) {
        throw new Error(`Cannot advance: target stage '${candidate}' equals the current stage`);
      }
      return candidate;
    }
    // Unrecognized override → fall through to next-in-order.
  }

  // 2) Otherwise advance to the next stage in the pipeline order.
  const idx = CRM_STAGE_ORDER.indexOf(currentStage);
  if (idx === -1) {
    throw new Error(
      `Cannot advance from stage '${currentStage}' — it is not an open pipeline stage. ` +
      `Use decision 'won' or 'lost' for a closed deal.`,
    );
  }
  const next = CRM_STAGE_ORDER[idx + 1];
  if (next === undefined) {
    throw new Error(
      `Cannot advance: deal is already at the last open stage '${currentStage}'. ` +
      `Use decision 'won' or 'lost' to close it.`,
    );
  }
  return next;
}

function buildExecuteClosePrompt(req: ExecuteCloseRequest, deal: Deal): string {
  const decisionLabel =
    req.decision === 'won' ? 'WIN the deal (mark Closed Won)' :
    req.decision === 'lost' ? 'LOSE the deal (mark Closed Lost)' :
    'ADVANCE the deal to the next pipeline stage';

  return [
    'ACTION: execute_close',
    '',
    `Decision to record: ${decisionLabel}`,
    '',
    '## Deal',
    `Deal ID: ${deal.id}`,
    `Name: ${deal.name}`,
    (deal.companyName ?? deal.company) ? `Company: ${deal.companyName ?? deal.company}` : '',
    `Current pipeline stage: ${deal.stage}`,
    `Value: ${deal.currency ?? 'USD'} ${deal.value.toLocaleString()}`,
    '',
    '## Call notes from the rep',
    req.callNotes && req.callNotes.trim().length > 0 ? req.callNotes.trim() : '(no call notes provided)',
    '',
    '---',
    '',
    'Author the timeline note + rationale for this decision. Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "rationale": "<1-3 sentences, plain English, why this decision is correct given the call notes and deal context>",',
    '  "activity": {',
    '    "subject": "<short timeline title for this call/event>",',
    '    "body": "<2-5 sentence call note for the deal timeline, plain text>",',
    '    "outcome": "<positive | neutral | negative>"',
    '  }',
    '}',
    '',
    'Hard rules:',
    '- Do NOT name any raw CRM stage string (the system moves the stage in code).',
    '- Plain text only. No markdown, no placeholders.',
    `- outcome must match the decision: ${req.decision === 'won' ? 'positive' : req.decision === 'lost' ? 'negative' : 'positive or neutral'}.`,
    '- Output ONLY the JSON object. No markdown fences. No prose outside it.',
  ].filter((line) => line !== '').join('\n');
}

async function authorActivityNote(req: ExecuteCloseRequest, deal: Deal, ctx: LlmCallContext): Promise<ActivityNote> {
  const userPrompt = buildExecuteClosePrompt(req, deal);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Deal Closer execute_close output was not valid JSON: ${rawContent.slice(0, 300)}`);
  }

  const result = ActivityNoteSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Deal Closer execute_close output did not match expected schema: ${issueSummary}`);
  }
  return result.data;
}

// ============================================================================
// DEAL CLOSER CLASS
// ============================================================================

export class DealCloserSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Deal Closer initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const rawPayload = message.payload as Record<string, unknown> | null;
      if (rawPayload === null || typeof rawPayload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Deal Closer: payload must be an object']);
      }

      // EXECUTOR path: move a deal stage / mark won-lost and log the call.
      if (rawPayload.action === 'execute_close') {
        return await this.executeClose(taskId, rawPayload);
      }

      const normalized = { ...rawPayload, action: rawPayload.action ?? 'generate_closing_strategy' };

      const inputValidation = GenerateClosingStrategyPayloadSchema.safeParse(normalized);
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Deal Closer: invalid input payload: ${issueSummary}`,
        ]);
      }

      const payload = inputValidation.data;
      logger.info(
        `[DealCloser] Executing generate_closing_strategy taskId=${taskId} leadId=${payload.lead.leadId} stage=${payload.lead.currentStage} temp=${payload.lead.temperature}`,
        { file: FILE },
      );

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
      const result = await executeGenerateClosingStrategy(payload, ctx);

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[DealCloser] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * EXECUTOR: move a deal forward (advance / won / lost) and log the call.
   *
   * The DECISION + the call note are LLM work (governed by the Golden Master).
   * The CRM stage chosen and the database writes are plain deterministic
   * TypeScript — the LLM never picks the raw stage string.
   */
  private async executeClose(taskId: string, rawPayload: Record<string, unknown>): Promise<AgentReport> {
    const inputValidation = ExecuteClosePayloadSchema.safeParse(rawPayload);
    if (!inputValidation.success) {
      const issueSummary = inputValidation.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return this.createReport(taskId, 'FAILED', null, [
        `Deal Closer: invalid execute_close payload: ${issueSummary}`,
      ]);
    }
    const req = inputValidation.data;

    // (0) APPROVAL GATE — FAIL CLOSED. execute_close is an irreversible CRM
    //     mutation and must never run autonomously from a direct Jasper chat
    //     call. It mutates ONLY when this run is an operator-approved mission
    //     step (the StepRunner sets viaApprovedMissionStep; a direct chat call
    //     does not). Without the approval signal we DO NOT touch the CRM —
    //     instead we return COMPLETED guidance that routes Jasper through the
    //     Mission Control approval flow (propose_mission_plan → operator
    //     approves the step → runner re-invokes this with the flag set).
    if (req.viaApprovedMissionStep !== true) {
      logger.warn(
        `[DealCloser] execute_close BLOCKED (no operator approval) taskId=${taskId} dealId=${req.dealId} decision=${req.decision}`,
        { file: FILE },
      );
      return this.createReport(taskId, 'COMPLETED', {
        approvalRequired: true,
        mutated: false,
        dealId: req.dealId,
        decision: req.decision,
        message:
          'execute_close moves a real CRM deal and cannot run directly from chat. ' +
          'It requires explicit operator approval. Propose it as a mission step via ' +
          'propose_mission_plan (toolName "delegate_to_sales", action "execute_close", ' +
          `with dealId "${req.dealId}" and decision "${req.decision}"). The operator ` +
          'approves the step in Mission Control, then the deal is moved.',
      });
    }

    logger.info(
      `[DealCloser] Executing execute_close taskId=${taskId} dealId=${req.dealId} decision=${req.decision}`,
      { file: FILE },
    );

    // (a) Idempotency / existence guard.
    const deal = await getDeal(req.dealId);
    if (!deal) {
      return this.createReport(taskId, 'FAILED', null, [
        `Deal Closer: deal '${req.dealId}' not found — cannot execute close.`,
      ]);
    }
    if (deal.stage === 'closed_won' || deal.stage === 'closed_lost') {
      return this.createReport(taskId, 'FAILED', null, [
        `Deal Closer: deal '${req.dealId}' is already ${deal.stage} — nothing to execute.`,
      ]);
    }

    // (c) DETERMINISTIC decision → CRM stage mapping (in code, not the LLM).
    let newStage: Deal['stage'];
    try {
      newStage = resolveTargetStage(req.decision, deal.stage, req.targetStage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createReport(taskId, 'FAILED', null, [`Deal Closer: ${errorMessage}`]);
    }

    // (b) LLM authors the activity note + rationale (GM prompt, verbatim).
    const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
    const note = await authorActivityNote(req, deal, ctx);

    // (d) Move the deal stage (deterministic CRM write).
    await moveDealToStage(req.dealId, newStage);

    // (e) Log the call/activity. If THIS fails, report partial success — the
    //     stage move already landed and must not be thrown away.
    let activityId: string | null = null;
    try {
      const activity = await createActivity({
        type: req.decision === 'advance' ? 'deal_stage_changed' : 'call_made',
        subject: note.activity.subject,
        body: note.activity.body,
        relatedTo: [{ entityType: 'deal', entityId: req.dealId, entityName: deal.name }],
        createdBy: SPECIALIST_ID,
        occurredAt: Timestamp.fromDate(new Date()),
        metadata: {
          sentiment: note.activity.outcome,
          previousValue: deal.stage,
          newValue: newStage,
          fieldChanged: 'stage',
          callNotes: req.callNotes,
        },
      });
      activityId = activity.id;
    } catch (activityError) {
      logger.error(
        `[DealCloser] Stage move succeeded but activity log failed for deal ${req.dealId}`,
        activityError instanceof Error ? activityError : new Error(String(activityError)),
        { file: FILE },
      );
    }

    const result: ExecuteCloseResult = {
      rationale: note.rationale,
      executed: {
        dealId: req.dealId,
        previousStage: deal.stage,
        newStage,
        activityId,
        dealMoved: true,
      },
    };

    return this.createReport(taskId, 'COMPLETED', result);
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
    return { functional: 560, boilerplate: 90 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createDealCloserSpecialist(): DealCloserSpecialist {
  return new DealCloserSpecialist();
}

let instance: DealCloserSpecialist | null = null;

export function getDealCloserSpecialist(): DealCloserSpecialist {
  instance ??= createDealCloserSpecialist();
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
  buildClosingStrategyPrompt,
  executeGenerateClosingStrategy,
  GenerateClosingStrategyPayloadSchema,
  GenerateClosingStrategyResultSchema,
  ExecuteClosePayloadSchema,
  ActivityNoteSchema,
  resolveTargetStage,
  buildExecuteClosePrompt,
};
