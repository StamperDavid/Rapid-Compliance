/**
 * Sales Outreach Specialist — REAL AI AGENT (Task #47 rebuild, April 14 2026)
 *
 * Before the rebuild, this specialist was a 2005-LOC hardcoded template
 * engine. Eight `OUTREACH_FRAMEWORKS` constants (COLD_INTRO,
 * COMPETITOR_DISPLACEMENT, TRIGGER_EVENT, etc.) each with a fully written
 * subject/body template containing `{companyName}` / `{firstName}` /
 * `{competitorName}` placeholders, a library of hardcoded competitor
 * weaknesses keyed by "hubspot" / "salesforce" / "pipedrive" / etc., and
 * deterministic `generateSingleMessage`/`generateSequence` methods that
 * did string interpolation on those templates. Zero LLM calls anywhere.
 * The `SYSTEM_PROMPT` constant was defined but never sent to a model.
 *
 * The pre-rebuild specialist had ZERO live `.execute()` callers in the
 * Sales Manager. `outreachSpecialistInstance` was assigned in the manager
 * but never invoked. This rebuild is forward-only — no wiring
 * coordination needed for existing callers. The new output shape is the
 * contract future Sales Manager dispatch work slots into.
 *
 * After the rebuild, Sales Outreach Specialist is a real LLM-backed
 * strategic outreach planner. Given a lead profile + optional scraper
 * intelligence + optional framework hint, it picks the right framework,
 * writes the first-touch message, optionally plans a follow-up sequence,
 * and surfaces personalization hooks + anticipated objections.
 *
 * This is NOT the Outreach department's Email/SMS Specialists (Tasks
 * #43/#44). Those are channel-specific content composers that produce
 * ready-to-send email/sms bodies for any department. This Sales Outreach
 * Specialist is the Sales-layer tactical planner that picks the framework
 * AND writes the first message for a specific sales context (cold intro,
 * competitor displacement, trigger event, warm followup, nurture,
 * referral, event followup, re-engagement). Different layer, different
 * concern — a future multi-channel sales campaign can use both.
 *
 * Supported action (single):
 *   - generate_outreach — framework pick + first-touch message + optional
 *     sequence + personalization hooks + objections + rationale
 *
 * Pattern matches Task #39 Copy Strategist / Task #59 Alex: REQUIRED GM,
 * single-action, Zod input + output schemas, truncation backstop,
 * __internal export. REQUIRED GM is used because the output includes
 * customer-facing content (the primaryMessage is sent verbatim to real
 * prospects).
 *
 * @module agents/sales/outreach/specialist
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ScrapeResult } from '../../intelligence/scraper/specialist';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'sales/outreach/specialist.ts';
const SPECIALIST_ID = 'OUTREACH_SPECIALIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_outreach'] as const;

/**
 * Realistic max_tokens floor for the worst-case Sales Outreach response.
 *
 * Derivation:
 *   GenerateOutreachResultSchema worst case:
 *     primaryMessage (single): 2500
 *     followupSequence: 5 × { sendAfterDays, channel, subject, body 2000, rationale 500 } = 5 × 2700 = 13,500
 *     personalizationHooks: 5 × 400 = 2,000
 *     objectionsToAnticipate: 4 × 500 = 2,000
 *     frameworkReasoning: 2,500
 *     rationale: 3,000
 *     enum + int overhead: 300
 *     ≈ 25,800 chars total prose
 *     /3.0 chars/token = 8,600 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 11,000 tokens minimum.
 *
 *   Setting the floor at 12,500 tokens covers the schema with safety
 *   margin. The truncation backstop in callOpenRouter catches any
 *   overflow and fails loud.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 12500;

interface OutreachSpecialistGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Sales Outreach Specialist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'REVENUE_DIRECTOR',
    capabilities: [
      'framework_selection',
      'first_touch_message',
      'sequence_planning',
      'personalization',
      'competitor_displacement',
      'trigger_event_outreach',
    ],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['generate_outreach'],
  outputSchema: {
    type: 'object',
    properties: {
      framework: { type: 'string' },
      frameworkReasoning: { type: 'string' },
      primaryMessage: { type: 'object' },
      followupSequence: { type: 'array' },
      personalizationHooks: { type: 'array' },
      objectionsToAnticipate: { type: 'array' },
      expectedResponseRate: { type: 'string' },
      rationale: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.5,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

const FrameworkEnum = z.enum([
  'COLD_INTRO',
  'COMPETITOR_DISPLACEMENT',
  'TRIGGER_EVENT',
  'WARM_FOLLOWUP',
  'NURTURE',
  'REFERRAL',
  'EVENT_FOLLOWUP',
  'RE_ENGAGEMENT',
]);

const ChannelEnum = z.enum([
  'email',
  'linkedin_dm',
  'twitter_dm',
  'cold_call_script',
]);

const ToneEnum = z.enum(['formal', 'casual', 'professional', 'conversational']);
const UrgencyEnum = z.enum(['low', 'medium', 'high']);

const LeadProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
  email: z.string().max(320).optional(),
  companyName: z.string().min(1).max(300),
  industry: z.string().min(1).max(200),
  employeeRange: z.string().min(1).max(50),
  location: z.string().max(300).optional(),
  techStack: z.array(z.string().min(1).max(100)).max(40).optional(),
  recentFunding: z.string().max(300).optional(),
  recentNews: z.string().max(1000).optional(),
  triggerEvent: z.string().max(500).optional(),
  mutualConnections: z.array(z.string().min(1).max(200)).max(20).optional(),
  customInsights: z.array(z.string().min(1).max(500)).max(10).optional(),
});

const GenerateOutreachPayloadSchema = z.object({
  action: z.literal('generate_outreach'),
  lead: LeadProfileSchema,
  frameworkHint: FrameworkEnum.optional(),
  channel: ChannelEnum.optional().default('email'),
  sequenceLength: z.number().int().min(1).max(6).optional().default(1),
  tone: ToneEnum.optional().default('professional'),
  urgency: UrgencyEnum.optional().default('medium'),
  competitorContext: z.object({
    competitorName: z.string().min(1).max(200),
    knownWeaknesses: z.array(z.string().min(5).max(400)).max(6).optional(),
    similarSwitchCaseStudy: z.string().max(1000).optional(),
  }).optional(),
  scraperData: z.unknown().optional(), // ScrapeResult — validated at consumption time
  valueProposition: z.string().max(2000).optional(),
  campaignGoal: z.string().max(500).optional(),
  senderName: z.string().max(200).optional(),
});

export type GenerateOutreachPayload = z.infer<typeof GenerateOutreachPayloadSchema>;
export type LeadProfile = z.infer<typeof LeadProfileSchema>;
export type OutreachFramework = z.infer<typeof FrameworkEnum>;
export type OutreachChannel = z.infer<typeof ChannelEnum>;
export type OutreachTone = z.infer<typeof ToneEnum>;
export type OutreachUrgency = z.infer<typeof UrgencyEnum>;

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================

const MessageBodySchema = z.object({
  channel: ChannelEnum,
  subject: z.string().min(3).max(200).optional(), // Required for email, optional for DMs
  body: z.string().min(30).max(2500),
  personalizationUsed: z.array(z.string().min(3).max(300)).min(1).max(6),
  sendAfterDays: z.number().int().min(0).max(60),
  rationale: z.string().min(20).max(800),
});

const ObjectionAnticipationSchema = z.object({
  objection: z.string().min(10).max(300),
  counterAngle: z.string().min(20).max(500),
});

const GenerateOutreachResultSchema = z.object({
  action: z.literal('generate_outreach'),
  framework: FrameworkEnum,
  frameworkReasoning: z.string().min(50).max(2500),
  primaryMessage: MessageBodySchema,
  followupSequence: z.array(MessageBodySchema).max(5),
  personalizationHooks: z.array(z.string().min(5).max(400)).min(2).max(6),
  objectionsToAnticipate: z.array(ObjectionAnticipationSchema).min(1).max(4),
  expectedResponseRatePct: z.object({
    min: z.number().int().min(0).max(100),
    max: z.number().int().min(0).max(100),
  }),
  rationale: z.string().min(100).max(3000),
});

export type GenerateOutreachResult = z.infer<typeof GenerateOutreachResultSchema>;
export type OutreachMessage = z.infer<typeof MessageBodySchema>;
export type OutreachObjection = z.infer<typeof ObjectionAnticipationSchema>;

// Legacy type aliases preserved for future Sales Manager dispatch wiring.
export type MessageRequest = GenerateOutreachPayload;
export type OutreachResult = GenerateOutreachResult;
export type GeneratedMessage = OutreachMessage;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: OutreachSpecialistGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Sales Outreach Specialist GM not found for industryKey=${industryKey}. ` +
      `Customer-facing content generation requires a Golden Master. ` +
      `Run node scripts/seed-outreach-specialist-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<OutreachSpecialistGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Sales Outreach Specialist GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: OutreachSpecialistGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.5,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };
  return {
    gm,
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
      `Sales Outreach Specialist: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shorten the input payload / reduce sequenceLength. ` +
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
// ACTION: generate_outreach
// ============================================================================

function formatScraperData(scraperData: unknown): string {
  if (scraperData === undefined || scraperData === null || typeof scraperData !== 'object') {
    return '(no scraper intelligence)';
  }
  const sd = scraperData as Partial<ScrapeResult> & Record<string, unknown>;
  const lines: string[] = [];
  if (typeof sd.companyName === 'string') { lines.push(`Company: ${sd.companyName}`); }
  if (typeof sd.industry === 'string') { lines.push(`Industry (from scrape): ${sd.industry}`); }
  if (typeof sd.description === 'string') { lines.push(`Description: ${sd.description.slice(0, 800)}`); }
  if (typeof sd.valueProposition === 'string') { lines.push(`Value prop: ${sd.valueProposition.slice(0, 500)}`); }
  if (typeof sd.targetCustomer === 'string') { lines.push(`Target customer: ${sd.targetCustomer.slice(0, 500)}`); }
  if (Array.isArray(sd.strategicObservations)) {
    const obs = sd.strategicObservations.filter((o): o is string => typeof o === 'string').slice(0, 6);
    if (obs.length > 0) {
      lines.push(`Strategic observations:\n  - ${obs.join('\n  - ')}`);
    }
  }
  return lines.length > 0 ? lines.join('\n') : '(empty scraper object)';
}

function formatLead(lead: LeadProfile): string {
  const lines: string[] = [
    `Name: ${lead.firstName}${lead.lastName ? ` ${lead.lastName}` : ''}`,
    `Title: ${lead.title ?? '(unknown)'}`,
    `Email: ${lead.email ?? '(unknown)'}`,
    `Company: ${lead.companyName}`,
    `Industry: ${lead.industry}`,
    `Employee range: ${lead.employeeRange}`,
  ];
  if (lead.location) { lines.push(`Location: ${lead.location}`); }
  if (lead.techStack && lead.techStack.length > 0) {
    lines.push(`Tech stack: ${lead.techStack.join(', ')}`);
  }
  if (lead.recentFunding) { lines.push(`Recent funding: ${lead.recentFunding}`); }
  if (lead.recentNews) { lines.push(`Recent news: ${lead.recentNews}`); }
  if (lead.triggerEvent) { lines.push(`Trigger event: ${lead.triggerEvent}`); }
  if (lead.mutualConnections && lead.mutualConnections.length > 0) {
    lines.push(`Mutual connections: ${lead.mutualConnections.join(', ')}`);
  }
  if (lead.customInsights && lead.customInsights.length > 0) {
    lines.push(`Custom insights:\n  - ${lead.customInsights.join('\n  - ')}`);
  }
  return lines.join('\n');
}

function buildGenerateOutreachPrompt(req: GenerateOutreachPayload): string {
  const frameworkLine = req.frameworkHint
    ? `Framework hint: ${req.frameworkHint} (the caller suggests this framework — treat as a strong signal but override if the data clearly points to a better fit).`
    : 'Framework hint: (none — pick the best-fit framework yourself).';

  const competitorBlock = req.competitorContext
    ? [
        '## Competitor context (lead uses a competitor product)',
        `Competitor: ${req.competitorContext.competitorName}`,
        req.competitorContext.knownWeaknesses && req.competitorContext.knownWeaknesses.length > 0
          ? `Known weaknesses:\n  - ${req.competitorContext.knownWeaknesses.join('\n  - ')}`
          : '',
        req.competitorContext.similarSwitchCaseStudy
          ? `Case study: ${req.competitorContext.similarSwitchCaseStudy}`
          : '',
      ].filter((line) => line !== '').join('\n')
    : '';

  return [
    'ACTION: generate_outreach',
    '',
    frameworkLine,
    `Channel: ${req.channel}`,
    `Sequence length: ${req.sequenceLength} message(s) total (primary + ${req.sequenceLength - 1} follow-ups)`,
    `Tone: ${req.tone}`,
    `Urgency: ${req.urgency}`,
    req.senderName ? `Sender: ${req.senderName}` : 'Sender: (use a neutral first-person signature)',
    req.campaignGoal ? `Campaign goal: ${req.campaignGoal}` : '',
    req.valueProposition ? `Value proposition: ${req.valueProposition}` : '',
    '',
    '## Lead profile',
    formatLead(req.lead),
    '',
    '## Scraper intelligence',
    formatScraperData(req.scraperData),
    '',
    competitorBlock,
    '',
    '---',
    '',
    'Produce a strategic outreach plan. Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "action": "generate_outreach",',
    '  "framework": "<one of: COLD_INTRO | COMPETITOR_DISPLACEMENT | TRIGGER_EVENT | WARM_FOLLOWUP | NURTURE | REFERRAL | EVENT_FOLLOWUP | RE_ENGAGEMENT>",',
    '  "frameworkReasoning": "<50-2500 chars — why this framework fits the lead, their awareness level, and the signal pattern>",',
    '  "primaryMessage": {',
    `    "channel": "${req.channel}",`,
    '    "subject": "<5-120 chars, required for email channel, optional for DMs>",',
    '    "body": "<30-2500 chars, plain text, ready to send — NO template placeholders like {firstName}, use the actual lead name from the input>",',
    '    "personalizationUsed": ["<1-6 specific personalization hooks you wove into the body>"],',
    '    "sendAfterDays": 0,',
    '    "rationale": "<20-800 chars — why this message opens the sequence the way it does>"',
    '  },',
    `  "followupSequence": [${req.sequenceLength - 1} additional messages with sendAfterDays > 0 ascending, OR empty array if sequenceLength=1],`,
    '  "personalizationHooks": ["<2-6 specific hooks from the input data you leveraged — name the field or quote the signal>"],',
    '  "objectionsToAnticipate": [{ "objection": "<likely pushback>", "counterAngle": "<how you would respond to it, not in the message itself but prepared>" }],',
    '  "expectedResponseRatePct": { "min": <integer>, "max": <integer> },',
    '  "rationale": "<100-3000 chars strategic synthesis tying framework + channel + personalization + sequence shape>"',
    '}',
    '',
    'Hard rules:',
    '- NO template placeholders in any message body. Use the actual lead.firstName, lead.companyName, etc. from the input.',
    '- Email subject lines are REQUIRED when channel=email. Keep 5-120 chars.',
    '- DM channels may omit subject.',
    '- Body text is plain — no markdown, no HTML, no code fences.',
    '- Message bodies must NOT exceed 2500 chars. The sequence has 5 max followups at 2500 chars each — stay within budget.',
    '- Ground every personalizationHook in a specific field from the input. Do not fabricate.',
    '- If competitorContext is provided, the framework SHOULD be COMPLETEIT_DISPLACEMENT unless the data clearly points to something else. Weave the known weaknesses into the message body.',
    '- If triggerEvent is present in the lead profile, TRIGGER_EVENT is a natural fit — reference the event specifically.',
    '- followupSequence entries MUST have strictly ascending sendAfterDays, and sendAfterDays must be >0 (only primaryMessage uses 0).',
    '- Length of followupSequence MUST equal sequenceLength - 1. If sequenceLength=1, followupSequence is an empty array.',
    '- Never invent features, integrations, pricing, or facts about SalesVelocity.ai not implied by the input. If you need to mention product details, stay vague ("our platform" / "our approach").',
    '- Output ONLY the JSON object. No prose outside it. No markdown fences.',
  ].filter((line) => line !== '').join('\n');
}

async function executeGenerateOutreach(
  req: GenerateOutreachPayload,
  ctx: LlmCallContext,
): Promise<GenerateOutreachResult> {
  const userPrompt = buildGenerateOutreachPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Sales Outreach Specialist output was not valid JSON: ${rawContent.slice(0, 300)}`,
    );
  }

  const result = GenerateOutreachResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(
      `Sales Outreach Specialist output did not match expected schema: ${issueSummary}`,
    );
  }

  const data = result.data;

  // Enforce sequenceLength invariant — the LLM sometimes produces N follow-ups
  // instead of N-1, or an extra primary-as-followup. Reject and fail loud.
  const expectedFollowups = Math.max(0, req.sequenceLength - 1);
  if (data.followupSequence.length !== expectedFollowups) {
    throw new Error(
      `Sales Outreach Specialist: followupSequence has ${data.followupSequence.length} entries ` +
      `but sequenceLength=${req.sequenceLength} requires exactly ${expectedFollowups}.`,
    );
  }

  // Enforce strictly-ascending sendAfterDays on the followup sequence.
  let prevDays = 0;
  for (const [index, msg] of data.followupSequence.entries()) {
    if (msg.sendAfterDays <= prevDays) {
      throw new Error(
        `Sales Outreach Specialist: followupSequence[${index}].sendAfterDays=${msg.sendAfterDays} ` +
        `must be strictly greater than the previous entry (${prevDays}).`,
      );
    }
    prevDays = msg.sendAfterDays;
  }

  // Enforce email subject presence for email channel.
  if (data.primaryMessage.channel === 'email' && (data.primaryMessage.subject === undefined || data.primaryMessage.subject.length === 0)) {
    throw new Error('Sales Outreach Specialist: primaryMessage.subject is required when channel=email');
  }
  for (const [index, msg] of data.followupSequence.entries()) {
    if (msg.channel === 'email' && (msg.subject === undefined || msg.subject.length === 0)) {
      throw new Error(
        `Sales Outreach Specialist: followupSequence[${index}].subject is required when channel=email`,
      );
    }
  }

  return data;
}

// ============================================================================
// SALES OUTREACH SPECIALIST CLASS
// ============================================================================

export class OutreachSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Sales Outreach Specialist initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const rawPayload = message.payload as Record<string, unknown> | null;
      if (rawPayload === null || typeof rawPayload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, [
          'Sales Outreach Specialist: payload must be an object',
        ]);
      }

      const normalized = this.normalizePayload(rawPayload);

      const inputValidation = GenerateOutreachPayloadSchema.safeParse(normalized);
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Sales Outreach Specialist: invalid input payload: ${issueSummary}`,
        ]);
      }

      const payload = inputValidation.data;
      logger.info(
        `[OutreachSpecialist] Executing generate_outreach taskId=${taskId} company=${payload.lead.companyName} framework=${payload.frameworkHint ?? 'auto'} channel=${payload.channel} seqLen=${payload.sequenceLength}`,
        { file: FILE },
      );

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
      const result = await executeGenerateOutreach(payload, ctx);

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[OutreachSpecialist] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * Accept three input shapes:
   *   1. New flat: { action, lead, channel?, sequenceLength?, ... }
   *   2. Legacy:   { type: 'single'|'sequence', context: {...}, scraperData?, options? }
   *   3. Minimal:  { lead, scraperData? }
   */
  private normalizePayload(raw: Record<string, unknown>): Record<string, unknown> {
    if (typeof raw.action === 'string' && raw.action === 'generate_outreach') {
      return raw;
    }

    // Legacy { type, context, options, scraperData } shape from the pre-rebuild.
    if (raw.context !== null && typeof raw.context === 'object' && typeof raw.type === 'string') {
      const context = raw.context as Record<string, unknown>;
      const options = (raw.options ?? {}) as Record<string, unknown>;
      const sequenceLength = raw.type === 'sequence'
        ? (typeof options.sequenceLength === 'number' ? options.sequenceLength : 4)
        : 1;
      return {
        action: 'generate_outreach',
        lead: {
          firstName: context.firstName ?? 'there',
          lastName: context.lastName,
          title: context.title,
          email: context.email,
          companyName: context.companyName ?? 'Unknown Company',
          industry: context.industry ?? 'Unknown',
          employeeRange: context.employeeRange ?? 'unknown',
          location: context.location ?? undefined,
          techStack: context.techStack,
          recentFunding: context.recentFunding,
          recentNews: context.recentNews,
          triggerEvent: context.triggerEvent,
          mutualConnections: context.mutualConnections,
          customInsights: context.customInsights,
        },
        frameworkHint: raw.framework,
        channel: raw.channel ?? 'email',
        sequenceLength,
        tone: options.tone ?? 'professional',
        urgency: options.urgency ?? 'medium',
        scraperData: raw.scraperData,
      };
    }

    // Minimal { lead, scraperData? } passthrough.
    return { ...raw, action: 'generate_outreach' };
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
    return { functional: 580, boilerplate: 90 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createOutreachSpecialist(): OutreachSpecialist {
  return new OutreachSpecialist();
}

let instance: OutreachSpecialist | null = null;

export function getOutreachSpecialist(): OutreachSpecialist {
  instance ??= createOutreachSpecialist();
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
  stripJsonFences,
  buildGenerateOutreachPrompt,
  executeGenerateOutreach,
  GenerateOutreachPayloadSchema,
  GenerateOutreachResultSchema,
};
