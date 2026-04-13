/**
 * Email Specialist — REAL AI AGENT (Task #43 rebuild, April 13 2026)
 *
 * The Outreach-department Email Specialist. Loads its Golden Master from
 * Firestore at runtime, loads the Brand DNA, loads the active Email Purpose
 * Types taxonomy (also Firestore-backed and expandable at runtime — see
 * Task #43 design notes), and calls OpenRouter (Claude Sonnet 4.6 by default
 * — locked tier policy for leaf specialists, see Task #23.5) to compose a
 * send-ready marketing email from a brief. No template fallbacks. If the GM
 * is missing, Brand DNA is missing, the purpose types list is empty,
 * OpenRouter fails, JSON won't parse, or Zod validation fails, the
 * specialist returns a real FAILED AgentReport with the honest reason.
 *
 * THIS IS NOT A SENDMAIL WRAPPER. The pre-rebuild template wrapped
 * `email-service.sendEmail()` and assumed upstream had already written the
 * email content. That assumption was fake — no upstream was actually writing
 * content anywhere. This rebuild flips the model: the specialist writes the
 * content, delivery stays in `email-service`. When the Outreach department
 * is rewired in Task #45, the OutreachManager will call this specialist's
 * `compose_email` action to get content, then hand that content to
 * `email-service.sendEmail()` for delivery. Content generation and delivery
 * are decoupled concerns.
 *
 * Supported actions (live code paths only):
 *   - compose_email  (Task #45 OutreachManager will dispatch
 *                     `payload.action = 'compose_email'` — today there are
 *                     NO live callers because `delegate_to_outreach` is
 *                     NOT_WIRED in jasper-tools.ts; this is intentional,
 *                     the specialist is rebuilt first, the manager is
 *                     rewired as a separate task per the same two-step
 *                     pattern used for Funnel Pathologist + Task #42)
 *
 * The pre-rebuild template engine supported 9 actions — 5 of them
 * (send_email, send_bulk_email, get_tracking, record_open, record_click)
 * were infrastructure wrappers around `email-service` and belong in that
 * module, not in an AI specialist. 4 of them (drip_campaign, spam_check,
 * personalize_email, subject_line_ab) were fake-AI lookup-table engines
 * with zero LLM calls. All 9 are dropped per CLAUDE.md no-stubs rules.
 *
 * Email purpose types are NOT hardcoded as a Zod enum. They are loaded
 * from Firestore at runtime via the email-purpose-types-service, which
 * means new types can be created from the UI (Task #43b) and become
 * immediately selectable by the LLM without a code deploy. The LLM
 * receives the current list of slugs + descriptions in the user prompt,
 * and the output is validated against the slug list at runtime inside
 * `executeComposeEmail()`.
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA, type BrandDNA } from '@/lib/brand/brand-dna-service';
import { getActiveEmailPurposeTypes } from '@/lib/services/email-purpose-types-service';
import type { EmailPurposeType } from '@/types/email-purpose-types';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'outreach/email/specialist.ts';
const SPECIALIST_ID = 'EMAIL_SPECIALIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['compose_email'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

interface EmailSpecialistGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Email Specialist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'OUTREACH_MANAGER',
    capabilities: ['compose_email'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['compose_email'],
  outputSchema: {
    type: 'object',
    properties: {
      emailPurpose: { type: 'string' },
      subjectLine: { type: 'string' },
      previewText: { type: 'string' },
      bodyPlainText: { type: 'string' },
      ctaLine: { type: 'string' },
      psLine: { type: 'string' },
      toneAndAngleReasoning: { type: 'string' },
      personalizationNotes: { type: 'string' },
      followupSuggestion: { type: 'string' },
      spamRiskNotes: { type: 'string' },
      rationale: { type: 'string' },
    },
  },
  maxTokens: 12000,
  temperature: 0.6,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================
//
// The Task #45 OutreachManager rewire will dispatch this shape. For now
// the proof-of-life harness and regression executor construct it directly.
// ============================================================================

export interface ComposeEmailRequest {
  action: 'compose_email';
  /** Short handle for the campaign or sequence this email belongs to. */
  campaignName: string;
  /** Free-form description of the target audience (who, pain, context). */
  targetAudience: string;
  /** What the email is trying to accomplish (one sentence). */
  goal: string;
  /**
   * Optional slug hint — if the caller already knows which purpose type
   * to use (because they picked it from the UI combobox), pass it and
   * the specialist will strongly prefer it unless the brief obviously
   * conflicts. If omitted, the LLM picks from the full active list.
   */
  suggestedPurposeSlug?: string;
  /**
   * Optional sequence step metadata for multi-step drips. Single-shot
   * emails leave this undefined. The LLM uses stepNumber and totalSteps
   * to calibrate tone (stage 1 = hook, stage 5 = final ask).
   */
  sequenceStep?: {
    stepNumber: number;
    totalSteps: number;
    priorInteractions?: string;
  };
  /** Free-form brief from the Outreach Manager. */
  brief: string;
}

const ComposeEmailRequestSchema = z.object({
  action: z.literal('compose_email'),
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
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================
//
// `emailPurpose` is validated in executeComposeEmail against the Firestore
// list of active types, not against a fixed Zod enum. This is the key
// design difference from prior specialists and the reason a new email type
// created in the UI becomes usable by the LLM within ~30 seconds (service
// cache TTL) without any code change.
//
// Top-level field names `subjectLine` and `bodyPlainText` are chosen to
// match what the Task #45 OutreachManager rewire will extract for delivery.
// Short `emailPurpose` slug sits alongside them for classification and
// analytics routing.
//
// All variable-length content is either prose or flat with generous caps
// (learned from Tasks #39/#40/#41 — tight caps cause baseline rejections
// at regression temperature 0).
// ============================================================================

const ComposeEmailResultSchema = z.object({
  emailPurpose: z.string().min(2).max(80),
  subjectLine: z.string().min(5).max(120),
  previewText: z.string().min(10).max(250),
  bodyPlainText: z.string().min(100).max(7000),
  ctaLine: z.string().min(10).max(500),
  psLine: z.string().min(5).max(500),
  toneAndAngleReasoning: z.string().min(50).max(5000),
  personalizationNotes: z.string().min(50).max(6000),
  followupSuggestion: z.string().min(50).max(5000),
  spamRiskNotes: z.string().min(30).max(4000),
  rationale: z.string().min(150).max(10000),
});

export type ComposeEmailResult = z.infer<typeof ComposeEmailResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: EmailSpecialistGMConfig;
  brandDNA: BrandDNA;
  purposeTypes: EmailPurposeType[];
  resolvedSystemPrompt: string;
}

async function loadGMBrandDNAAndPurposeTypes(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Email Specialist GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-email-specialist-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<EmailSpecialistGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Email Specialist GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gm: EmailSpecialistGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.6,
    maxTokens: config.maxTokens ?? 12000,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. Email Specialist refuses to compose without brand identity. ' +
      'Visit /settings/ai-agents/business-setup.',
    );
  }

  const purposeTypes = await getActiveEmailPurposeTypes();
  if (purposeTypes.length === 0) {
    throw new Error(
      'No active email purpose types found in Firestore. ' +
      'Run node scripts/seed-email-purpose-types.js to seed the defaults.',
    );
  }

  const resolvedSystemPrompt = buildResolvedSystemPrompt(gm.systemPrompt, brandDNA, purposeTypes);
  return { gm, brandDNA, purposeTypes, resolvedSystemPrompt };
}

function buildResolvedSystemPrompt(
  baseSystemPrompt: string,
  brandDNA: BrandDNA,
  purposeTypes: EmailPurposeType[],
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
    '## Email Purpose Taxonomy (runtime injection — current active list)',
    '',
    'These are the ONLY valid values for the emailPurpose field. Pick the ONE that best fits the brief.',
    'Do not invent new purpose slugs. If none of these fits the brief well, pick the closest one and explain in the rationale.',
    '',
    purposeLines,
  ].join('\n');

  return `${baseSystemPrompt}\n${brandBlock}\n${purposeBlock}`;
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
// ACTION: compose_email
// ============================================================================

function buildComposeEmailUserPrompt(req: ComposeEmailRequest, purposeTypes: EmailPurposeType[]): string {
  const slugList = purposeTypes.map((t) => t.slug).join(' | ');

  const sequenceLine = req.sequenceStep
    ? `Sequence step: ${req.sequenceStep.stepNumber} of ${req.sequenceStep.totalSteps}${req.sequenceStep.priorInteractions ? ` — prior interactions: ${req.sequenceStep.priorInteractions}` : ''}`
    : 'Single-shot email (not part of a sequence)';

  const suggestedLine = req.suggestedPurposeSlug
    ? `Suggested emailPurpose (caller hint — use it unless the brief clearly conflicts): ${req.suggestedPurposeSlug}`
    : 'No caller purpose hint — pick the best-fitting purpose from the active taxonomy';

  const sections: string[] = [
    'ACTION: compose_email',
    '',
    'You are writing ONE email. You are NOT writing a sequence, a landing page, a blog post, or marketing copy of any other kind.',
    'Your output is a single, send-ready email: subject line, preview text, plain-text body, CTA, PS line, plus strategic notes.',
    'The content you produce is what the recipient actually reads. Nothing downstream rewrites it. Write accordingly.',
    '',
    `Campaign: ${req.campaignName}`,
    `Goal: ${req.goal}`,
    `Target audience: ${req.targetAudience}`,
    sequenceLine,
    suggestedLine,
    '',
    'Brief from the Outreach Manager:',
    req.brief,
    '',
    'Produce a send-ready email. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    `  "emailPurpose": "<one of: ${slugList} — the slug from the Email Purpose Taxonomy list in the system prompt above>",`,
    '  "subjectLine": "<send-ready subject line, 5 to 120 chars — written to earn the open without tripping spam filters>",',
    '  "previewText": "<Gmail/Outlook preview text, 10 to 250 chars — extends the subject line, never repeats it>",',
    '  "bodyPlainText": "<send-ready plain-text body of the email, 100 to 7000 chars — this is what the recipient reads; the downstream email-service will render it to HTML if needed but this text is the canonical source>",',
    '  "ctaLine": "<the single call-to-action sentence embedded in the body — 10 to 500 chars — one clear ask, not three>",',
    '  "psLine": "<the PS line at the end of the email, 5 to 500 chars — high reply-lift zone; use it to restate the single most compelling reason to respond>",',
    '  "toneAndAngleReasoning": "<50 to 5000 chars — why this tone and angle for THIS audience, given the brand voice and the campaign goal>",',
    '  "personalizationNotes": "<50 to 6000 chars — which variables should be merged (e.g. {{first_name}}, {{company}}, {{recent_trigger}}) and WHERE in the body; also name the strategic personalization hooks beyond variable merging (e.g. opening line referencing their vertical, CTA pointing at their specific use case)>",',
    '  "followupSuggestion": "<50 to 5000 chars — if this email is ignored, what is the next step and when; if this is a sequence step, what changes for the next step; if single-shot, recommend the next touch>",',
    '  "spamRiskNotes": "<30 to 4000 chars — honest appraisal of spam risk in the subject, preview, body, and CTA; name specific trigger words or structures if present; recommend mitigations>",',
    '  "rationale": "<150 to 10000 chars — full strategic rationale tying purpose + subject + body + CTA + follow-up into a coherent composition that could only fit THIS audience and THIS brief>"',
    '}',
    '',
    'Hard rules you MUST follow:',
    `- emailPurpose MUST be one of the slugs from the taxonomy list above: ${slugList}. Do NOT invent new slugs. If the caller provided a suggestedPurposeSlug, use it unless the brief clearly conflicts (and if you override it, say so in the rationale).`,
    '- subjectLine must earn the open WITHOUT tripping spam filters. Avoid all-caps, excessive punctuation, and trigger words like "FREE!!", "ACT NOW", "LIMITED TIME". Use curiosity, specificity, or genuine relevance.',
    '- previewText extends the subject line — it does NOT repeat it. If the subject is "quick question about your outbound stack" then the preview should be something like "and why it might be costing you more than you think" — not another subject line.',
    '- bodyPlainText is the REAL email body. Write it as if you are sending it to a real person right now. Short paragraphs, scannable. No walls of text. No marketing-speak. No "I hope this finds you well." No "I wanted to reach out." Get to the point.',
    '- bodyPlainText MUST open with something specific to the recipient (pain, trigger, role, vertical) in the first 2 sentences — not a generic pleasantry.',
    '- bodyPlainText MUST contain exactly ONE call-to-action. The ctaLine field is a copy of that same CTA sentence, lifted out of the body for the Builder to target with a button if needed. Do not write a body with three CTAs and expect the reader to pick.',
    '- psLine is the high-reply-lift zone. Use it to restate the single most compelling reason to respond. Never use it for legal disclaimers.',
    '- personalizationNotes MUST name the specific variables the body uses ({{first_name}}, {{company}}, etc.) and where they appear, AND the strategic personalization hooks beyond variable merging. "Use {{first_name}}" alone is not enough.',
    '- followupSuggestion MUST name a specific next step with a specific timing — "follow up in 3 days with a social-proof email that leads with the {{industry}} case study", not "send another email eventually".',
    '- spamRiskNotes MUST be honest. If the subject has a risky word, say so. If the body is heavy on hype, say so. If the CTA asks for too much too soon, say so. The downstream Builder will act on these notes.',
    '- If the Brand DNA injection above includes avoidPhrases, none of your prose fields may use those phrases.',
    '- If the Brand DNA injection above includes keyPhrases, weave at least one naturally into the body or PS line.',
    '- The rationale MUST explicitly tie purpose + subject + body + CTA + follow-up together into a coherent composition that could only fit THIS audience and THIS brief. Generic rationales are a failure.',
    '- Do NOT invent metrics, open rates, or reply rates. The rationale is strategic reasoning, not performance forecasts.',
    '- Output ONLY the JSON object. No prose outside it. No markdown fences. No preamble.',
  ];

  return sections.join('\n');
}

async function executeComposeEmail(
  req: ComposeEmailRequest,
  ctx: LlmCallContext,
): Promise<ComposeEmailResult> {
  const userPrompt = buildComposeEmailUserPrompt(req, ctx.purposeTypes);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Email Specialist output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = ComposeEmailResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Email Specialist output did not match expected schema: ${issueSummary}`);
  }

  // Runtime enum validation against the live Firestore-backed taxonomy.
  // Done AFTER Zod parse so prose fields fail first — a malformed body
  // surfaces before a bad purpose slug, giving better error messages.
  const validSlugs = new Set(ctx.purposeTypes.map((t) => t.slug));
  if (!validSlugs.has(result.data.emailPurpose)) {
    throw new Error(
      `Email Specialist produced emailPurpose='${result.data.emailPurpose}' which is not in the active taxonomy. ` +
      `Valid slugs: ${[...validSlugs].join(', ')}. ` +
      `If this is a new type, create it via POST /api/email-purpose-types first.`,
    );
  }

  return result.data;
}

// ============================================================================
// EMAIL SPECIALIST CLASS
// ============================================================================

export class EmailSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Email Specialist initialized (LLM-backed, Golden Master + Purpose Types loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Email Specialist: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Email Specialist: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Email Specialist does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[EmailSpecialist] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const inputValidation = ComposeEmailRequestSchema.safeParse({
        ...payload,
        action,
      });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Email Specialist compose_email: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMBrandDNAAndPurposeTypes(DEFAULT_INDUSTRY_KEY);
      const data = await executeComposeEmail(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[EmailSpecialist] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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

export function createEmailSpecialist(): EmailSpecialist {
  return new EmailSpecialist();
}

let instance: EmailSpecialist | null = null;

export function getEmailSpecialist(): EmailSpecialist {
  instance ??= createEmailSpecialist();
  return instance;
}

// ============================================================================
// INTERNAL TEST HELPERS (exported for proof-of-life harness + regression executor)
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  loadGMBrandDNAAndPurposeTypes,
  buildResolvedSystemPrompt,
  buildComposeEmailUserPrompt,
  stripJsonFences,
  ComposeEmailRequestSchema,
  ComposeEmailResultSchema,
};
