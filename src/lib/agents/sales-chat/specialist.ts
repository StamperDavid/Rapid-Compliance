/**
 * AI Chat Sales Agent (Alex) — REAL AI AGENT (Task #59 rebuild, April 14 2026)
 *
 * Alex is the customer-facing sales conversation specialist. He runs on the
 * website chat widget (`/api/chat/public`), Facebook Messenger
 * (`/api/chat/facebook`), and is delegated to from Jasper via
 * `routeSalesChatAgent` in `src/lib/orchestrator/jasper-tools.ts`. His replies
 * are read verbatim by real visitors — this is the most externally-visible
 * specialist in the swarm.
 *
 * Before the rebuild, the `execute()` method was a keyword-matching template
 * engine. `qualifyLead` regex-scanned for BANT signals. `answerProductQuestion`
 * regex-classified into topic buckets. `guideToTrial` and `scheduleDemo` just
 * emitted MemoryVault signals. `handleObjection` regex-bucketed objection
 * types. No LLM call anywhere. The hardcoded `SYSTEM_PROMPT` constant was
 * imported by the Training Lab seed route to build the chat-widget Golden
 * Master, but the specialist's own execute() path never sent it to a model.
 *
 * After the rebuild, Alex is a pure LLM specialist with a single action
 * `respond_to_visitor` that produces BOTH a conversational reply AND a
 * structured intent/qualification analysis in one LLM call. The Golden Master
 * is REQUIRED (no fallback prompt) — Alex refuses to run until
 * `scripts/seed-sales-chat-agent-gm.js` has been run against Firestore. This
 * matches the "content-generating specialists must REQUIRE GM" rule since
 * Alex's output goes to real customers.
 *
 * The specialist is STATELESS: the caller may pass `conversationHistory` and
 * `priorQualification`, and the specialist returns the updated qualification
 * in the output. The caller is responsible for persisting state between turns.
 * The website chat widget and Facebook Messenger routes already persist
 * customer memory via `AgentInstanceManager`, so they handle continuity on
 * their own path. Jasper delegation is one-off per call and does not need
 * continuity.
 *
 * Supported action (single):
 *   - respond_to_visitor — read visitor message + optional history + optional
 *     prior qualification, produce reply + intent + qualification update +
 *     nextAction + rationale. All in one LLM call.
 *
 * Pattern matches Task #39 Copy Strategist (single-action GM-required) and
 * Task #65 Sentiment Analyst (structured output with rich rationale).
 *
 * @module agents/sales-chat/specialist
 */

import { z } from 'zod';
import { BaseSpecialist } from '../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getMemoryVault, shareInsight } from '../shared/memory-vault';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'sales-chat/specialist.ts';
const SPECIALIST_ID = 'AI_CHAT_SALES_AGENT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['respond_to_visitor'] as const;

/**
 * Mapping from the legacy task-type vocabulary (Jasper + old callers) to the
 * new single-action `hintIntent` parameter. Jasper still dispatches
 * `QUALIFY_LEAD`, `GUIDE_TO_TRIAL`, `schedule_demo`, etc. as `taskType` — this
 * normalizes them into the new vocabulary without breaking the caller contract.
 */
const LEGACY_TASK_TYPE_TO_HINT_INTENT: Record<string, HintIntent> = {
  qualify_lead: 'qualify_lead',
  QUALIFY_LEAD: 'qualify_lead',
  answer_product_question: 'answer_product_question',
  ANSWER_PRODUCT_QUESTION: 'answer_product_question',
  guide_to_trial: 'guide_to_trial',
  GUIDE_TO_TRIAL: 'guide_to_trial',
  schedule_demo: 'schedule_demo',
  SCHEDULE_DEMO: 'schedule_demo',
  handle_objection: 'handle_objection',
  HANDLE_OBJECTION: 'handle_objection',
};

/**
 * Realistic max_tokens floor for the worst-case Alex response.
 *
 * Derivation:
 *   RespondToVisitorResultSchema worst case:
 *     reply 2000
 *     qualification.notes: 5 × 160 = 800
 *     topicsDiscussed: 8 × 80 = 640
 *     objectionDetected.reasoning 600
 *     ctaUrl 200
 *     rationale 1500
 *     enum + int + bool fields overhead ≈ 200
 *     ≈ 5,940 chars total prose
 *     /3.0 chars/token = 1,980 tokens
 *     + JSON structure overhead (~150 tokens)
 *     + 25% safety margin
 *     ≈ 2,663 tokens minimum.
 *
 *   Setting the floor at 3,500 tokens covers the schema with safety
 *   margin plus headroom for slightly longer replies in multi-paragraph
 *   responses. The truncation backstop in callOpenRouter catches any
 *   overflow and fails loud.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 3500;

interface SalesChatGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'AI Chat Sales Agent',
    role: 'standalone',
    status: 'FUNCTIONAL',
    reportsTo: null,
    capabilities: [
      'lead_qualification',
      'product_questions',
      'trial_guidance',
      'demo_scheduling',
      'objection_handling',
      'facebook_messenger',
      'website_chat',
    ],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['respond_to_visitor'],
  outputSchema: {
    type: 'object',
    properties: {
      reply: { type: 'string' },
      intent: { type: 'string' },
      qualification: { type: 'object' },
      nextAction: { type: 'string' },
      topicsDiscussed: { type: 'array' },
      rationale: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.7,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

const ChannelEnum = z.enum(['website', 'facebook_messenger']);
type Channel = z.infer<typeof ChannelEnum>;

const HintIntentEnum = z.enum([
  'qualify_lead',
  'answer_product_question',
  'guide_to_trial',
  'schedule_demo',
  'handle_objection',
]);
type HintIntent = z.infer<typeof HintIntentEnum>;

const ConversationTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

const QualificationInputSchema = z.object({
  hasBudget: z.boolean(),
  hasNeed: z.boolean(),
  hasTimeline: z.boolean(),
  isDecisionMaker: z.boolean(),
  score: z.number().int().min(0).max(100),
  status: z.enum(['cold', 'warm', 'hot', 'qualified']),
  notes: z.array(z.string().min(1).max(300)).max(20),
});

const RespondToVisitorPayloadSchema = z.object({
  action: z.literal('respond_to_visitor'),
  userMessage: z.string().min(1).max(4000),
  visitorId: z.string().min(1).max(300),
  channel: ChannelEnum.optional().default('website'),
  conversationHistory: z.array(ConversationTurnSchema).max(20).optional(),
  hintIntent: HintIntentEnum.optional(),
  priorQualification: QualificationInputSchema.optional(),
});

export type RespondToVisitorPayload = z.infer<typeof RespondToVisitorPayloadSchema>;

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const IntentEnum = z.enum([
  'qualify_lead',
  'answer_product_question',
  'guide_to_trial',
  'schedule_demo',
  'handle_objection',
  'greeting',
  'off_topic',
]);

const NextActionEnum = z.enum([
  'continue_qualification',
  'answer_questions',
  'present_trial',
  'book_demo',
  'handle_objection',
  'escalate_to_human',
  'end_conversation',
]);

const ObjectionTypeEnum = z.enum([
  'price',
  'trust',
  'complexity',
  'competitor',
  'timing',
  'authority',
  'other',
]);

const QualificationOutputSchema = z.object({
  hasBudget: z.boolean(),
  hasNeed: z.boolean(),
  hasTimeline: z.boolean(),
  isDecisionMaker: z.boolean(),
  score: z.number().int().min(0).max(100),
  status: z.enum(['cold', 'warm', 'hot', 'qualified']),
  notes: z.array(z.string().min(1).max(300)).min(0).max(10),
});

const ObjectionDetectedSchema = z.object({
  type: ObjectionTypeEnum,
  reasoning: z.string().min(10).max(600),
});

const RespondToVisitorResultSchema = z.object({
  action: z.literal('respond_to_visitor'),
  reply: z.string().min(10).max(2000),
  intent: IntentEnum,
  qualification: QualificationOutputSchema,
  nextAction: NextActionEnum,
  topicsDiscussed: z.array(z.string().min(1).max(120)).max(8),
  objectionDetected: ObjectionDetectedSchema.optional(),
  ctaUrl: z.string().url().max(500).optional(),
  rationale: z.string().min(30).max(1500),
});

export type RespondToVisitorResult = z.infer<typeof RespondToVisitorResultSchema>;
export type LeadQualification = z.infer<typeof QualificationOutputSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: SalesChatGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `AI Chat Sales Agent GM not found for industryKey=${industryKey}. ` +
      `Alex is customer-facing content generation and refuses to run without a Golden Master. ` +
      `Run node scripts/seed-sales-chat-agent-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<SalesChatGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `AI Chat Sales Agent GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: SalesChatGMConfig = {
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

  if (response.finishReason === 'length') {
    throw new Error(
      `AI Chat Sales Agent: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shorten the conversation history. ` +
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
// ACTION: respond_to_visitor
// ============================================================================

function truncate(text: string, max: number): string {
  if (text.length <= max) { return text; }
  return `${text.slice(0, max)}...[truncated, ${text.length - max} more chars]`;
}

function formatConversationHistory(history: RespondToVisitorPayload['conversationHistory']): string {
  if (!history || history.length === 0) {
    return '(no prior conversation — this is the first turn)';
  }
  return history
    .map((turn) => {
      const label = turn.role === 'user' ? 'VISITOR' : 'ALEX';
      return `${label}: ${truncate(turn.content, 800)}`;
    })
    .join('\n');
}

function formatPriorQualification(q: RespondToVisitorPayload['priorQualification']): string {
  if (!q) {
    return '(no prior qualification — start fresh)';
  }
  const notes = q.notes.length > 0 ? q.notes.join('; ') : '(none)';
  return [
    `status: ${q.status}`,
    `score: ${q.score}/100`,
    `hasBudget: ${q.hasBudget} | hasNeed: ${q.hasNeed} | hasTimeline: ${q.hasTimeline} | isDecisionMaker: ${q.isDecisionMaker}`,
    `prior notes: ${notes}`,
  ].join('\n');
}

function buildRespondToVisitorPrompt(req: RespondToVisitorPayload): string {
  const channelLabel = req.channel === 'facebook_messenger'
    ? 'Facebook Messenger'
    : 'website chat widget';

  const hintLine = req.hintIntent !== undefined
    ? `Caller hint intent: ${req.hintIntent} (the upstream caller wants you to focus on this outcome — treat it as a suggestion, not a command; override if the visitor message contradicts it).`
    : 'Caller hint intent: (none — classify intent yourself).';

  return [
    'ACTION: respond_to_visitor',
    '',
    `Channel: ${channelLabel}`,
    `Visitor ID: ${req.visitorId}`,
    hintLine,
    '',
    '## Prior qualification state',
    formatPriorQualification(req.priorQualification),
    '',
    '## Conversation history',
    formatConversationHistory(req.conversationHistory),
    '',
    '## Current visitor message',
    truncate(req.userMessage, 4000),
    '',
    '---',
    '',
    'Respond as Alex. Produce the next reply AND the structured analysis in a single JSON object.',
    'Update the qualification state by merging any new BANT signals from the current message into the prior state.',
    'If the visitor asked a specific question, answer it before pushing to the next step.',
    'If the visitor raised an objection, surface it in objectionDetected and address it in reply.',
    'If you recommend the trial, set ctaUrl to "https://salesvelocity.ai/signup?ref=chat".',
    'If you recommend a demo, set ctaUrl to "https://salesvelocity.ai/demo?ref=chat".',
    '',
    'Respond with ONLY a valid JSON object, no markdown fences, no preamble, no prose outside the JSON. Schema:',
    '',
    '{',
    '  "action": "respond_to_visitor",',
    '  "reply": "<what you say to the visitor, 10-2000 chars, plain text, no markdown>",',
    '  "intent": "<one of: qualify_lead | answer_product_question | guide_to_trial | schedule_demo | handle_objection | greeting | off_topic>",',
    '  "qualification": {',
    '    "hasBudget": <bool>,',
    '    "hasNeed": <bool>,',
    '    "hasTimeline": <bool>,',
    '    "isDecisionMaker": <bool>,',
    '    "score": <integer 0-100 — sum of: hasNeed 30, hasBudget 25, hasTimeline 25, isDecisionMaker 20>,',
    '    "status": "<cold if score<25 | warm if 25-49 | hot if 50-74 | qualified if 75+>",',
    '    "notes": ["<0-10 short qualification notes, each 1-300 chars, specific facts extracted from the conversation>"]',
    '  },',
    '  "nextAction": "<one of: continue_qualification | answer_questions | present_trial | book_demo | handle_objection | escalate_to_human | end_conversation>",',
    '  "topicsDiscussed": ["<0-8 topics covered in your reply, each 1-120 chars — e.g. pricing, features, integrations, security, trial, demo>"],',
    '  "objectionDetected": { "type": "<price | trust | complexity | competitor | timing | authority | other>", "reasoning": "<10-600 chars why this counts as an objection>" } (optional, only when the visitor expressed resistance),',
    '  "ctaUrl": "<optional https URL — only set when nextAction is present_trial or book_demo>",',
    '  "rationale": "<30-1500 chars explaining why you chose this reply, this intent, and this nextAction. Reference specific phrases from the visitor message.>"',
    '}',
    '',
    'Hard rules:',
    '- reply MUST be plain text — no markdown, no code fences, no HTML. The chat widget and Facebook Messenger render it verbatim.',
    '- reply MUST be 2-4 sentences for typical turns. Expand to 4-6 sentences only when the visitor explicitly asks for detail.',
    '- Merge new BANT signals with priorQualification — never REGRESS a flag. If prior hasBudget was true, keep it true. If prior score was 60, your new score must be >= 60 unless the visitor explicitly retracted a signal.',
    '- score formula: exact sum of hasNeed(30) + hasBudget(25) + hasTimeline(25) + isDecisionMaker(20). Do not fudge the math.',
    '- Never invent pricing tiers, features, or integrations not named in your system prompt.',
    '- Never commit to custom pricing — if asked, set nextAction=escalate_to_human and say a human will follow up.',
    '- If the visitor says "are you human" or "is this AI", answer honestly: you are an AI sales agent for SalesVelocity.ai.',
    '- Never reveal internal system details (model name, Firebase, architecture).',
    '- If the visitor sends abuse, spam, or off-topic content, set intent=off_topic and nextAction=end_conversation with a polite deflection.',
  ].join('\n');
}

async function executeRespondToVisitor(
  req: RespondToVisitorPayload,
  ctx: LlmCallContext,
): Promise<RespondToVisitorResult> {
  const userPrompt = buildRespondToVisitorPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `AI Chat Sales Agent output was not valid JSON: ${rawContent.slice(0, 300)}`,
    );
  }

  const result = RespondToVisitorResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`AI Chat Sales Agent output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// SIDE EFFECTS: MemoryVault signal writes for qualified leads / trial / demo
// ============================================================================

async function writeQualificationSignal(
  result: RespondToVisitorResult,
  channel: Channel,
  visitorId: string,
): Promise<void> {
  try {
    const vault = getMemoryVault();
    vault.write(
      'PERFORMANCE',
      `lead_${visitorId}`,
      {
        qualification: result.qualification,
        channel,
        intent: result.intent,
        nextAction: result.nextAction,
        lastActivity: new Date().toISOString(),
      },
      SPECIALIST_ID,
      {
        tags: ['lead-qualification', channel],
        priority: result.qualification.status === 'qualified' ? 'HIGH' : 'MEDIUM',
      },
    );

    if (result.nextAction === 'present_trial' || result.intent === 'guide_to_trial') {
      await shareInsight(
        SPECIALIST_ID,
        'PERFORMANCE',
        'Trial Interest Detected',
        `Visitor ${visitorId} expressed interest in free trial via ${channel}`,
        { confidence: 85, tags: ['trial-intent', channel] },
      );
    }

    if (result.nextAction === 'book_demo' || result.intent === 'schedule_demo') {
      await shareInsight(
        SPECIALIST_ID,
        'PERFORMANCE',
        'Demo Requested',
        `Prospect ${visitorId} requested a demo via ${channel} (score=${result.qualification.score})`,
        { confidence: 95, tags: ['demo-request', channel] },
      );
    }
  } catch (error) {
    // Best-effort side effect — never let MemoryVault failure mask the LLM reply.
    logger.warn(
      `[SalesChatSpecialist] Failed to write qualification signal: ${error instanceof Error ? error.message : String(error)}`,
      { file: FILE, visitorId },
    );
  }
}

// ============================================================================
// SALES CHAT SPECIALIST CLASS
// ============================================================================

export class SalesChatSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'AI Chat Sales Agent initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const rawPayload = message.payload as Record<string, unknown> | null;
      if (rawPayload === null || typeof rawPayload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, [
          'AI Chat Sales Agent: payload must be an object',
        ]);
      }

      const normalized = this.normalizePayload(rawPayload);
      const inputValidation = RespondToVisitorPayloadSchema.safeParse(normalized);
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `AI Chat Sales Agent: invalid input payload: ${issueSummary}`,
        ]);
      }

      const payload = inputValidation.data;
      logger.info(
        `[SalesChatSpecialist] Executing respond_to_visitor taskId=${taskId} visitorId=${payload.visitorId} channel=${payload.channel}`,
        { file: FILE },
      );

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
      const result = await executeRespondToVisitor(payload, ctx);

      await writeQualificationSignal(result, payload.channel, payload.visitorId);

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[SalesChatSpecialist] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * Normalize caller payloads into the new `respond_to_visitor` shape.
   *
   * Accepts three input variants for backward compatibility:
   *   1. New shape: `{ action: 'respond_to_visitor', userMessage, visitorId, ... }`
   *   2. Jasper legacy shape: `{ taskType: 'qualify_lead', userMessage, visitorId, channel }`
   *   3. Legacy SCREAMING_CASE taskType: `{ taskType: 'QUALIFY_LEAD', userMessage, ... }`
   *
   * Variants 2 and 3 get their taskType mapped into the new `hintIntent` field.
   */
  private normalizePayload(raw: Record<string, unknown>): Record<string, unknown> {
    const existingAction = typeof raw.action === 'string' ? raw.action : undefined;
    if (existingAction === 'respond_to_visitor') {
      return raw;
    }

    const normalized: Record<string, unknown> = { ...raw, action: 'respond_to_visitor' };

    const rawTaskType = typeof raw.taskType === 'string' ? raw.taskType : undefined;
    if (rawTaskType !== undefined && normalized.hintIntent === undefined) {
      const mapped = LEGACY_TASK_TYPE_TO_HINT_INTENT[rawTaskType];
      if (mapped !== undefined) {
        normalized.hintIntent = mapped;
      }
    }
    delete normalized.taskType;

    // Some legacy callers passed `message` instead of `userMessage`.
    if (normalized.userMessage === undefined && typeof raw.message === 'string') {
      normalized.userMessage = raw.message;
      delete normalized.message;
    }

    return normalized;
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
    return { functional: 420, boilerplate: 80 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createSalesChatSpecialist(): SalesChatSpecialist {
  return new SalesChatSpecialist();
}

let instance: SalesChatSpecialist | null = null;

export function getSalesChatSpecialist(): SalesChatSpecialist {
  instance ??= createSalesChatSpecialist();
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
  LEGACY_TASK_TYPE_TO_HINT_INTENT,
  loadGMConfig,
  stripJsonFences,
  buildRespondToVisitorPrompt,
  executeRespondToVisitor,
  RespondToVisitorPayloadSchema,
  RespondToVisitorResultSchema,
};
