/**
 * SMS Specialist — REAL AI AGENT (Task #44 rebuild, April 13 2026)
 *
 * The Outreach-department SMS Specialist. Loads its Golden Master from
 * Firestore at runtime, loads the Brand DNA, loads the active SMS Purpose
 * Types taxonomy + SMS Settings (maxCharCap, compliance region), and calls
 * OpenRouter (Claude Sonnet 4.6 by default) to compose a send-ready SMS
 * message from a brief. No template fallbacks. If any dependency is
 * missing, OpenRouter fails, JSON won't parse, or Zod validation fails,
 * the specialist returns a real FAILED AgentReport with the honest reason.
 *
 * THIS IS NOT A CARRIER-API WRAPPER. The pre-rebuild template wrapped
 * `sms-service.sendSMS()` (Twilio/Vonage) and assumed upstream had already
 * written the SMS content. That assumption was fake — no upstream was
 * actually writing content. This rebuild flips the model: specialist
 * writes content, sms-service sends. Same decoupling as Email Specialist
 * (Task #43). When `delegate_to_outreach` is rewired in Task #45, the
 * OutreachManager will call this specialist's compose_sms action to get
 * content, then hand that content to sms-service for delivery.
 *
 * Supported actions:
 *   - compose_sms  (Task #45 OutreachManager will dispatch
 *                   payload.action = 'compose_sms' — today NO live callers
 *                   because delegate_to_outreach is NOT_WIRED)
 *
 * The pre-rebuild template engine supported 6 actions. 5 of them
 * (send_sms, send_bulk_sms, send_template_sms, get_status, validate_phone,
 * render_template) were infrastructure wrappers around sms-service and
 * belong in that module, not in an AI specialist. All dropped per
 * CLAUDE.md no-stubs rules.
 *
 * SMS purpose types are NOT hardcoded as a Zod enum — they are loaded
 * from Firestore at runtime (expandable from UI via Task #44b). Same
 * pattern as Email Specialist's email purpose types.
 *
 * SMS length cap is NOT hardcoded — it is loaded from sms-settings
 * (Firestore, configurable from UI) and injected into the LLM prompt at
 * runtime. Zod has a generous ceiling (1600 chars = carrier absolute max)
 * so Zod enforcement does not block the LLM when settings change. The
 * strict per-call enforcement happens in the sending layer (Task #45)
 * where money actually leaves.
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA, type BrandDNA } from '@/lib/brand/brand-dna-service';
import { getActiveSmsPurposeTypes } from '@/lib/services/sms-purpose-types-service';
import { getSmsSettings } from '@/lib/services/sms-settings-service';
import type { SmsPurposeType } from '@/types/sms-purpose-types';
import type { SmsSettings } from '@/types/sms-settings';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'outreach/sms/specialist.ts';
const SPECIALIST_ID = 'SMS_SPECIALIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['compose_sms'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

interface SmsSpecialistGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'SMS Specialist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'OUTREACH_MANAGER',
    capabilities: ['compose_sms'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['compose_sms'],
  outputSchema: {
    type: 'object',
    properties: {
      smsPurpose: { type: 'string' },
      segmentStrategy: { type: 'string' },
      primaryMessage: { type: 'string' },
      charCount: { type: 'number' },
      ctaText: { type: 'string' },
      complianceFooter: { type: 'string' },
      linkPlacementNotes: { type: 'string' },
      personalizationNotes: { type: 'string' },
      toneAndAngleReasoning: { type: 'string' },
      followupSuggestion: { type: 'string' },
      complianceRisks: { type: 'string' },
      rationale: { type: 'string' },
    },
  },
  maxTokens: 8000,
  temperature: 0.6,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

export interface ComposeSmsRequest {
  action: 'compose_sms';
  campaignName: string;
  targetAudience: string;
  goal: string;
  suggestedPurposeSlug?: string;
  sequenceStep?: {
    stepNumber: number;
    totalSteps: number;
    priorInteractions?: string;
  };
  brief: string;
}

const ComposeSmsRequestSchema = z.object({
  action: z.literal('compose_sms'),
  campaignName: z.string().min(2).max(120),
  targetAudience: z.string().min(5).max(1200),
  goal: z.string().min(5).max(500),
  suggestedPurposeSlug: z.string().min(2).max(80).optional(),
  sequenceStep: z.object({
    stepNumber: z.number().int().min(1).max(20),
    totalSteps: z.number().int().min(1).max(20),
    priorInteractions: z.string().max(2000).optional(),
  }).optional(),
  brief: z.string().min(20).max(8000),
});

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================
//
// Top-level fields chosen for the Task #45 OutreachManager rewire:
// primaryMessage is the send-ready SMS body, smsPurpose is the Firestore-
// taxonomy slug for analytics routing, charCount is the post-compose size
// check.
//
// primaryMessage max is 1600 (carrier absolute ceiling). The SOFT cap from
// sms-settings is injected into the prompt but NOT enforced at Zod level —
// that would make the Zod schema change based on runtime config, and
// regression baselines would be non-deterministic when settings change.
// Strict soft-cap enforcement lives in the sending layer (Task #45).
// ============================================================================

const SegmentStrategyEnum = z.enum([
  'single_segment',      // <=160 chars, 1 SMS segment, cheapest
  'concat_short',        // 161-320 chars, 2 segments
  'concat_medium',       // 321-480 chars, 3 segments
  'concat_long',         // 481-960 chars, up to 6 segments (use sparingly)
  'concat_max',          // 961-1600 chars, up to 10 segments (only for rich transactional)
]);

const ComposeSmsResultSchema = z.object({
  smsPurpose: z.string().min(2).max(80),
  segmentStrategy: SegmentStrategyEnum,
  primaryMessage: z.string().min(20).max(1600),
  charCount: z.number().int().min(20).max(1600),
  ctaText: z.string().min(2).max(120),
  complianceFooter: z.string().min(5).max(200),
  linkPlacementNotes: z.string().min(20).max(3000),
  personalizationNotes: z.string().min(30).max(3500),
  toneAndAngleReasoning: z.string().min(50).max(3500),
  followupSuggestion: z.string().min(50).max(3500),
  complianceRisks: z.string().min(20).max(3000),
  rationale: z.string().min(100).max(6000),
});

export type ComposeSmsResult = z.infer<typeof ComposeSmsResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: SmsSpecialistGMConfig;
  brandDNA: BrandDNA;
  purposeTypes: SmsPurposeType[];
  smsSettings: SmsSettings;
  resolvedSystemPrompt: string;
}

async function loadRuntimeContext(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `SMS Specialist GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-sms-specialist-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<SmsSpecialistGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `SMS Specialist GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gm: SmsSpecialistGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.6,
    maxTokens: config.maxTokens ?? 8000,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. SMS Specialist refuses to compose without brand identity. ' +
      'Visit /settings/ai-agents/business-setup.',
    );
  }

  const purposeTypes = await getActiveSmsPurposeTypes();
  if (purposeTypes.length === 0) {
    throw new Error(
      'No active SMS purpose types found in Firestore. ' +
      'Run node scripts/seed-sms-purpose-types.js to seed the defaults.',
    );
  }

  const smsSettings = await getSmsSettings();

  const resolvedSystemPrompt = buildResolvedSystemPrompt(gm.systemPrompt, brandDNA, purposeTypes, smsSettings);
  return { gm, brandDNA, purposeTypes, smsSettings, resolvedSystemPrompt };
}

function buildResolvedSystemPrompt(
  baseSystemPrompt: string,
  brandDNA: BrandDNA,
  purposeTypes: SmsPurposeType[],
  smsSettings: SmsSettings,
): string {
  const keyPhrases = brandDNA.keyPhrases?.length > 0 ? brandDNA.keyPhrases.join(', ') : '(none configured)';
  const avoidPhrases = brandDNA.avoidPhrases?.length > 0 ? brandDNA.avoidPhrases.join(', ') : '(none configured)';
  const competitors = brandDNA.competitors?.length > 0 ? brandDNA.competitors.join(', ') : '(none configured)';

  const brandBlock = [
    '',
    '## Brand DNA (runtime injection — do not confuse with system prompt)',
    '',
    `Company: ${brandDNA.companyDescription}`,
    `Unique value: ${brandDNA.uniqueValue}`,
    `Target audience: ${brandDNA.targetAudience}`,
    `Tone of voice: ${brandDNA.toneOfVoice}`,
    `Communication style: ${brandDNA.communicationStyle}`,
    `Industry: ${brandDNA.industry}`,
    `Key phrases to weave in naturally: ${keyPhrases}`,
    `Phrases you are forbidden from using: ${avoidPhrases}`,
    `Competitors (never name them unless specifically asked): ${competitors}`,
  ].join('\n');

  const purposeLines = purposeTypes
    .map((t) => `  - ${t.slug} — ${t.name}: ${t.description}`)
    .join('\n');

  const purposeBlock = [
    '',
    '## SMS Purpose Taxonomy (runtime injection — current active list)',
    '',
    'These are the ONLY valid values for the smsPurpose field. Pick the ONE that best fits the brief.',
    'Do not invent new purpose slugs. If none fits well, pick the closest one and explain in the rationale.',
    '',
    purposeLines,
  ].join('\n');

  const senderIdLine = smsSettings.defaultSenderId
    ? `Default sender ID: ${smsSettings.defaultSenderId}`
    : 'Default sender ID: not configured (UI must configure via /api/sms-settings)';

  const shortenerLine = smsSettings.defaultShortenerDomain
    ? `Default URL shortener: ${smsSettings.defaultShortenerDomain}`
    : 'Default URL shortener: not configured (advise on long-URL handling explicitly)';

  const settingsBlock = [
    '',
    '## SMS Settings (runtime injection)',
    '',
    `Maximum character cap (MUST NOT EXCEED): ${smsSettings.maxCharCap}`,
    `Compliance region: ${smsSettings.complianceRegion}`,
    `Require compliance footer (STOP/HELP): ${smsSettings.requireComplianceFooter}`,
    senderIdLine,
    shortenerLine,
    '',
    'Character budget guidance:',
    '- single_segment: up to 160 chars (1 SMS segment, cheapest)',
    '- concat_short: 161 to 320 chars (2 segments)',
    '- concat_medium: 321 to 480 chars (3 segments)',
    '- concat_long: 481 to 960 chars (up to 6 segments — use only when the content truly requires it)',
    '- concat_max: 961 to 1600 chars (up to 10 segments — reserved for rich transactional only)',
    '',
    `Target the smallest segment strategy that fits the content. NEVER exceed the ${smsSettings.maxCharCap} char cap.`,
  ].join('\n');

  return `${baseSystemPrompt}\n${brandBlock}\n${purposeBlock}\n${settingsBlock}`;
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

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// ACTION: compose_sms
// ============================================================================

function buildComposeSmsUserPrompt(
  req: ComposeSmsRequest,
  purposeTypes: SmsPurposeType[],
  smsSettings: SmsSettings,
): string {
  const slugList = purposeTypes.map((t) => t.slug).join(' | ');

  const sequenceLine = req.sequenceStep
    ? `Sequence step: ${req.sequenceStep.stepNumber} of ${req.sequenceStep.totalSteps}${req.sequenceStep.priorInteractions ? ` — prior interactions: ${req.sequenceStep.priorInteractions}` : ''}`
    : 'Single-shot SMS (not part of a sequence)';

  const suggestedLine = req.suggestedPurposeSlug
    ? `Suggested smsPurpose (caller hint — use it unless the brief clearly conflicts): ${req.suggestedPurposeSlug}`
    : 'No caller purpose hint — pick the best-fitting purpose from the active taxonomy';

  const sections: string[] = [
    'ACTION: compose_sms',
    '',
    'You are writing ONE send-ready SMS message. You are NOT writing a sequence, a landing page, an email, or any other kind of copy.',
    'SMS is ruthlessly constrained — every character costs money and attention. Every word must earn its place.',
    'The message you write is exactly what lands in the recipient\'s phone. Nothing downstream rewrites it.',
    '',
    `Campaign: ${req.campaignName}`,
    `Goal: ${req.goal}`,
    `Target audience: ${req.targetAudience}`,
    sequenceLine,
    suggestedLine,
    '',
    `MAXIMUM CHARACTER CAP (hard limit): ${smsSettings.maxCharCap} — primaryMessage + complianceFooter must together fit within this cap.`,
    `COMPLIANCE REGION: ${smsSettings.complianceRegion}${smsSettings.requireComplianceFooter ? ' — compliance footer (e.g. "Reply STOP to opt out") is REQUIRED' : ''}`,
    '',
    'Brief from the Outreach Manager:',
    req.brief,
    '',
    'Produce a send-ready SMS. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    `  "smsPurpose": "<one of: ${slugList} — the slug from the SMS Purpose Taxonomy list in the system prompt above>",`,
    '  "segmentStrategy": "<one of: single_segment | concat_short | concat_medium | concat_long | concat_max — pick the smallest that fits the content>",',
    '  "primaryMessage": "<send-ready SMS body, 20 to 1600 chars — what the recipient sees in their phone; use {{first_name}} and similar merge tags for personalization; include the CTA text and any link(s)>",',
    '  "charCount": <integer count of the primaryMessage body, including merge tags counted as their placeholder length for budgeting>,',
    '  "ctaText": "<the single call-to-action text or shortlink — 2 to 120 chars — one ask, not three>",',
    '  "complianceFooter": "<5 to 200 chars — the compliance footer text that will be appended; e.g. \'Reply STOP to opt out\' for US TCPA, or longer for EU/GDPR; use exactly what the compliance region requires>",',
    '  "linkPlacementNotes": "<20 to 3000 chars — where links should go in the body, how to shorten them, which shortener domain to use, how many characters the shortlink consumes>",',
    '  "personalizationNotes": "<30 to 3500 chars — which merge variables the message uses and WHERE in the body; also name strategic personalization hooks beyond variable merging>",',
    '  "toneAndAngleReasoning": "<50 to 3500 chars — why this tone and angle for THIS audience, given the brand voice, the 160-char-segment discipline, and the campaign goal>",',
    '  "followupSuggestion": "<50 to 3500 chars — if this SMS is ignored, what is the next step and when; if sequence step, what changes for the next step>",',
    '  "complianceRisks": "<20 to 3000 chars — honest appraisal of compliance risks: consent language, opt-out wording, disclosure requirements, time-of-day rules, carrier filtering risks. Region-specific.>",',
    '  "rationale": "<100 to 6000 chars — full strategic rationale tying purpose + segment strategy + message + CTA + follow-up into a coherent composition that could only fit THIS audience and THIS brief>"',
    '}',
    '',
    'Hard rules you MUST follow:',
    `- smsPurpose MUST be one of the slugs from the taxonomy list above: ${slugList}. Do NOT invent new slugs.`,
    `- primaryMessage + complianceFooter combined length MUST NOT exceed ${smsSettings.maxCharCap} chars. The downstream sender enforces this strictly — if you exceed it, the message gets rejected at send time, so count carefully.`,
    '- segmentStrategy MUST match the actual character count of primaryMessage (single_segment=<=160, concat_short=161-320, concat_medium=321-480, concat_long=481-960, concat_max=961-1600). Pick the SMALLEST strategy that fits — every extra segment is money.',
    '- charCount MUST equal the actual length of the primaryMessage field in chars (counting merge tags as literal placeholder text like "{{first_name}}" = 14 chars).',
    '- primaryMessage MUST open with something specific to the recipient in the first 60 characters — a first name, a trigger event, a vertical reference. Never generic pleasantries.',
    '- primaryMessage MUST contain exactly ONE call-to-action. SMS cannot support multiple CTAs — attention is too constrained.',
    '- ctaText is a copy of the single CTA lifted out of the message — could be a phrase ("Reply YES"), a shortlink ("svai.link/xy3"), or a keyword ("Text DEALS").',
    '- complianceFooter MUST match the compliance region. US/CA: "Reply STOP to opt out" or similar TCPA language. EU/UK: GDPR opt-out link or direct opt-out keyword. AU: OPT OUT keyword.',
    '- linkPlacementNotes MUST specify whether links should be at the start, middle, or end, and MUST recommend a shortener if long URLs are in play (shortened URLs save 10-30 chars). If no shortener is configured in SMS settings, advise handling long URLs explicitly.',
    '- personalizationNotes MUST name specific merge variables ({{first_name}}, {{company}}, {{order_id}}, {{appointment_time}}, etc.) and WHERE they appear. For transactional patterns (shipping, appointment, payment reminder), variables are the core of the message.',
    '- toneAndAngleReasoning MUST justify the tone against BOTH the brand voice AND the SMS channel constraints (no verbose prose, no marketing-speak, every character earns its place).',
    '- followupSuggestion MUST name specific next step and timing. "Send another SMS eventually" is a failure.',
    '- complianceRisks MUST be honest and region-specific. US: TCPA consent proof, time-of-day restrictions, shortcode vs long code rules. EU: GDPR double opt-in, explicit unsubscribe. Carrier filtering: avoid prohibited categories (cannabis, payday loans, some health) unless the account is certified for them.',
    '- Do NOT invent metrics or delivery rates. The rationale is strategic reasoning, not performance forecasts.',
    '- If brandDNA.avoidPhrases contains a phrase, never use it in primaryMessage or ctaText.',
    '- If brandDNA.keyPhrases are provided, weave at least one naturally into primaryMessage if it fits within the character cap — but skip it if the cap is tight.',
    '- The rationale MUST tie purpose + segment strategy + message + CTA + follow-up together into a coherent composition that could only fit THIS audience and THIS brief. Generic rationales are a failure.',
    '- Output ONLY the JSON object. No prose outside it. No markdown fences. No preamble.',
  ];

  return sections.join('\n');
}

async function executeComposeSms(
  req: ComposeSmsRequest,
  ctx: LlmCallContext,
): Promise<ComposeSmsResult> {
  const userPrompt = buildComposeSmsUserPrompt(req, ctx.purposeTypes, ctx.smsSettings);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `SMS Specialist output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = ComposeSmsResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`SMS Specialist output did not match expected schema: ${issueSummary}`);
  }

  // Runtime validation against the live Firestore-backed taxonomy.
  const validSlugs = new Set(ctx.purposeTypes.map((t) => t.slug));
  if (!validSlugs.has(result.data.smsPurpose)) {
    throw new Error(
      `SMS Specialist produced smsPurpose='${result.data.smsPurpose}' which is not in the active taxonomy. ` +
      `Valid slugs: ${[...validSlugs].join(', ')}. ` +
      `If this is a new type, create it via POST /api/sms-purpose-types first.`,
    );
  }

  return result.data;
}

// ============================================================================
// SMS SPECIALIST CLASS
// ============================================================================

export class SmsSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'SMS Specialist initialized (LLM-backed, Golden Master + Purpose Types + Settings loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['SMS Specialist: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['SMS Specialist: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `SMS Specialist does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[SmsSpecialist] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const inputValidation = ComposeSmsRequestSchema.safeParse({
        ...payload,
        action,
      });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `SMS Specialist compose_sms: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadRuntimeContext(DEFAULT_INDUSTRY_KEY);
      const data = await executeComposeSms(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[SmsSpecialist] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 490, boilerplate: 60 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createSmsSpecialist(): SmsSpecialist {
  return new SmsSpecialist();
}

let instance: SmsSpecialist | null = null;

export function getSmsSpecialist(): SmsSpecialist {
  instance ??= createSmsSpecialist();
  return instance;
}

// ============================================================================
// INTERNAL TEST HELPERS (exported for proof-of-life harness + regression executor)
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  loadRuntimeContext,
  buildResolvedSystemPrompt,
  buildComposeSmsUserPrompt,
  stripJsonFences,
  ComposeSmsRequestSchema,
  ComposeSmsResultSchema,
};
