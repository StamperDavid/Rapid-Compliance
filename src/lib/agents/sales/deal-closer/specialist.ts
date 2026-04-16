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

const FILE = 'sales/deal-closer/specialist.ts';
const SPECIALIST_ID = 'DEAL_CLOSER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_closing_strategy'] as const;

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
// OUTPUT CONTRACT — ClosingStrategyResult (preserved from pre-rebuild)
// ============================================================================

const LineItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1).max(10000),
  unitPrice: z.number().min(0).max(10_000_000),
  total: z.number().min(0).max(1_000_000_000),
  discount: z.number().min(0).max(100).optional(),
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
};
