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
import { Timestamp } from 'firebase/firestore';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getActiveEmailPurposeTypes } from '@/lib/services/email-purpose-types-service';
import type { EmailPurposeType } from '@/types/email-purpose-types';
import type { ModelName } from '@/types/ai-models';
import { createActivity } from '@/lib/crm/activity-service';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'outreach/email/specialist.ts';
const SPECIALIST_ID = 'EMAIL_SPECIALIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['compose_email', 'compose_outreach_sequence', 'send_email'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Schema-derived minimum max_tokens for the worst-case ComposeEmailResult.
 *
 * Derivation (Task #45 follow-up, April 13 2026):
 *   Sum of every prose field's max() in ComposeEmailResultSchema:
 *     emailPurpose 80 + subjectLine 120 + previewText 250 +
 *     bodyPlainText 7000 + ctaLine 500 + psLine 500 +
 *     toneAndAngleReasoning 5000 + personalizationNotes 6000 +
 *     followupSuggestion 5000 + spamRiskNotes 4000 + rationale 10000
 *   = 38,450 chars worst-case prose.
 *
 *   Conservative tokenization: 3.0 chars/token for English with punctuation
 *   = 12,816 tokens for prose alone.
 *   + JSON structure (keys, quotes, brackets, commas) ≈ 200 tokens.
 *   Floor: ~13,016 tokens.
 *   + 25% safety margin for tokenization variance and verbose styles
 *   (pirate dialect, dense rationales): 16,270 tokens.
 *   Round to a clean ceiling: 17,000 tokens.
 *
 * Why this matters: the prior 12,000-token request was below the schema's
 * own worst case, so the LLM would silently truncate mid-string when fields
 * ran long. Truncation manifested as "JSON parse failed" errors that hid
 * the true root cause. The Email Specialist's pirate test (Task #45)
 * surfaced the bug. Aligning maxTokens with the schema's actual prose
 * budget is the structural fix; truncation detection in callOpenRouter
 * is the defensive backstop. If this constant is ever changed, the schema
 * caps in ComposeEmailResultSchema MUST be re-totaled and re-derived.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 17000;

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
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
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
// INPUT CONTRACT — compose_outreach_sequence (multi-email cold drip)
// ============================================================================
//
// Used when Jasper or the Outreach Manager wants a coherent N-email cold
// outreach sequence personalized for ONE prospect, with a narrative arc
// across the emails (hook → escalate → close). Distinct from compose_email
// (single touch) and from the Copywriter's generate_email_sequence
// (broadcast nurture content, not lead-personalized).
// ============================================================================

export interface ComposeOutreachSequenceRequest {
  action: 'compose_outreach_sequence';
  campaignName: string;
  /** Description of the lead this sequence is for — name, role, company,
   * recent triggers, vertical. The narrative arc references these. */
  targetAudience: string;
  /** Overall objective the sequence is driving toward. */
  goal: string;
  /** How many emails in the sequence. 2-10. */
  sequenceLength: number;
  /** Optional cadence hint (e.g. "day 1, day 4, day 8"). The composer
   * adds sendTimingHint to each email; actual scheduling is handled by
   * create_workflow downstream. */
  cadence?: string;
  /** Optional hint for the dominant email purpose (e.g. cold_outbound,
   * meeting_request). Each step within the sequence may pick its own
   * purpose, but the LLM strongly prefers this if provided. */
  suggestedPurposeSlug?: string;
  brief: string;
}

const ComposeOutreachSequenceRequestSchema = z.object({
  action: z.literal('compose_outreach_sequence'),
  campaignName: z.string().min(2).max(120),
  targetAudience: z.string().min(5).max(1200),
  goal: z.string().min(5).max(500),
  sequenceLength: z.number().int().min(2).max(10),
  cadence: z.string().min(2).max(400).optional(),
  suggestedPurposeSlug: z.string().min(2).max(80).optional(),
  brief: z.string().min(20).max(8000),
});

// ============================================================================
// OUTPUT CONTRACT — compose_outreach_sequence
// ============================================================================
//
// Each email shares the per-email field caps from ComposeEmailResultSchema
// (subjectLine, previewText, bodyPlainText, ctaLine, psLine,
// personalizationNotes) plus a stepIndex, a stepPurposeSlug for analytics
// routing, a sendTimingHint that aligns with cadence, and a narrativeRole
// describing this email's place in the arc. Sequence-level fields capture
// the overall narrative spine.
// ============================================================================

const SequenceEmailSchema = z.object({
  stepIndex: z.number().int().min(1).max(20),
  totalSteps: z.number().int().min(2).max(20),
  stepPurposeSlug: z.string().min(2).max(80),
  narrativeRole: z.string().min(20).max(800),
  subjectLine: z.string().min(5).max(120),
  previewText: z.string().min(10).max(250),
  bodyPlainText: z.string().min(100).max(7000),
  ctaLine: z.string().min(10).max(500),
  psLine: z.string().min(5).max(500),
  personalizationNotes: z.string().min(50).max(6000),
  sendTimingHint: z.string().min(2).max(120),
});

const ComposeOutreachSequenceResultSchema = z.object({
  campaignName: z.string().min(2).max(120),
  sequenceLength: z.number().int().min(2).max(20),
  narrativeArcSummary: z.string().min(80).max(2000),
  emails: z.array(SequenceEmailSchema).min(2).max(20),
  toneAndAngleReasoning: z.string().min(50).max(5000),
  followupSuggestion: z.string().min(50).max(5000),
  spamRiskNotes: z.string().min(30).max(4000),
  rationale: z.string().min(150).max(10000),
});

export type ComposeOutreachSequenceResult = z.infer<typeof ComposeOutreachSequenceResultSchema>;

// ============================================================================
// INPUT CONTRACT — send_email (EXECUTOR action)
// ============================================================================
//
// send_email is the ONLY action on this specialist that produces a real-world
// side effect: it actually delivers an email through email-service and logs an
// 'email_sent' activity on the lead's CRM timeline. It is fail-closed behind an
// operator-approval gate (viaApprovedMissionStep), exactly like the Deal
// Closer's execute_close.
//
// The recipient address, subject, and body are DETERMINISTIC passthroughs —
// they were composed and operator-reviewed upstream (e.g. via compose_email +
// Mission Control approval). The LLM does NOT author or alter the email itself
// here. The only LLM work in this action is authoring the human-readable
// timeline note that records the send.
// ============================================================================

const SendEmailPayloadSchema = z.object({
  action: z.literal('send_email'),
  leadId: z.string().min(1).max(300),
  toEmail: z.string().email(),
  leadName: z.string().min(1).max(300).optional(),
  subject: z.string().min(1).max(998),
  bodyPlainText: z.string().min(1).max(100000),
  bodyHtml: z.string().min(1).max(500000).optional(),
  campaignName: z.string().min(1).max(200).optional(),
  /**
   * APPROVAL GATE. send_email performs an irreversible external side effect
   * (it sends a real email to a real recipient + logs an activity). It must
   * NEVER fire autonomously from a direct Jasper chat call. This flag is set
   * true ONLY when the mission StepRunner dispatched this as an
   * operator-approved mission step (context.viaApprovedMissionStep, threaded
   * down through Jasper's tool layer → Outreach Manager). Absent/false → the
   * specialist FAILS CLOSED, does not send, and returns guidance routing
   * Jasper through Mission Control approval. Defaults to false so any caller
   * that omits it gets the safe (no-send) behavior.
   */
  viaApprovedMissionStep: z.boolean().optional().default(false),
});

export type SendEmailRequest = z.infer<typeof SendEmailPayloadSchema>;

/**
 * LLM JSON contract for send_email. The model AUTHORS only the timeline note —
 * it does NOT emit, rewrite, or even echo the recipient address, subject, or
 * body (the code owns delivery). Output tokens for this action are small.
 */
const SendEmailActivityNoteSchema = z.object({
  rationale: z.string().min(10).max(2000),
  activity: z.object({
    subject: z.string().min(3).max(200),
    body: z.string().min(10).max(3000),
    outcome: z.enum(['positive', 'neutral', 'negative']),
  }),
});

export type SendEmailActivityNote = z.infer<typeof SendEmailActivityNoteSchema>;

/**
 * Result of a send_email run. `emailSent` is true once email-service reported a
 * successful delivery. `activityId` is null when the email sent but the
 * activity write failed afterward (partial success — we NEVER discard a
 * completed send).
 */
export interface SendEmailResult {
  rationale: string;
  executed: {
    leadId: string;
    toEmail: string;
    emailId: string | undefined;
    activityId: string | null;
    provider: string | undefined;
    emailSent: true;
  };
}

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: EmailSpecialistGMConfig;
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

  // Use max() of the GM-stored value and the schema-derived minimum so the
  // worst-case schema budget is always honored even when the GM doc was
  // seeded before the cap widenings of Task #43. This ALWAYS trends toward
  // the larger value; we never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: EmailSpecialistGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.6,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };
  const purposeTypes = await getActiveEmailPurposeTypes();
  if (purposeTypes.length === 0) {
    throw new Error(
      'No active email purpose types found in Firestore. ' +
      'Run node scripts/seed-email-purpose-types.js to seed the defaults.',
    );
  }

  // Brand DNA is baked into gm.systemPrompt at seed time. Only the
  // dynamic email-purpose-taxonomy gets injected at runtime here because
  // operators can add/remove purpose types from the UI between seeds.
  const resolvedSystemPrompt = appendPurposeTaxonomy(gm.systemPrompt, purposeTypes);
  return { gm, purposeTypes, resolvedSystemPrompt };
}

function appendPurposeTaxonomy(
  baseSystemPrompt: string,
  purposeTypes: EmailPurposeType[],
): string {
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

  return `${baseSystemPrompt}\n${purposeBlock}`;
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

  // Truncation detection (Task #45 follow-up). The provider was previously
  // hardcoding finishReason='stop', which silently masked length-based
  // truncation. With the provider fix in place, a 'length' finishReason
  // means the LLM hit our max_tokens ceiling mid-response and the JSON is
  // incomplete. Fail loudly with the diagnostic information needed to fix
  // the root cause (raise maxTokens or shorten the brief), instead of
  // letting the JSON parser surface a confusing "unexpected end of input".
  if (response.finishReason === 'length') {
    throw new Error(
      `Email Specialist: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shorten the brief. ` +
      `Schema worst-case budget is ${MIN_OUTPUT_TOKENS_FOR_SCHEMA} tokens.`,
    );
  }

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

// ============================================================================
// ACTION: compose_outreach_sequence
// ============================================================================

function buildComposeSequenceUserPrompt(
  req: ComposeOutreachSequenceRequest,
  purposeTypes: EmailPurposeType[],
): string {
  const slugList = purposeTypes.map((t) => t.slug).join(' | ');
  const cadenceLine = req.cadence
    ? `Cadence hint (use these to populate each email's sendTimingHint): ${req.cadence}`
    : 'No cadence hint — infer reasonable spacing per email (e.g. day 1, day 4, day 8 for a 3-email sequence).';
  const suggestedLine = req.suggestedPurposeSlug
    ? `Suggested dominant purpose (caller hint — most steps should use this slug, with steps adapting individually as the arc requires): ${req.suggestedPurposeSlug}`
    : 'No purpose hint — pick the best fit per step from the active taxonomy';

  const sections: string[] = [
    'ACTION: compose_outreach_sequence',
    '',
    `You are writing ONE coherent ${req.sequenceLength}-step cold outreach sequence personalized for the ONE prospect described in targetAudience. NOT broadcast marketing copy. NOT a nurture sequence. NOT N independent emails.`,
    'Every email must reference and build on the prior emails in the sequence. The recipient experiences this as a deliberate, escalating conversation, not a series of disconnected pitches.',
    '',
    `Campaign: ${req.campaignName}`,
    `Goal: ${req.goal}`,
    `Target prospect: ${req.targetAudience}`,
    `Sequence length: ${req.sequenceLength} emails`,
    cadenceLine,
    suggestedLine,
    '',
    'Brief from the Outreach Manager:',
    req.brief,
    '',
    'Produce a coherent sequence. Respond with ONLY a valid JSON object, no markdown fences, no preamble. The JSON must match this exact schema:',
    '',
    '{',
    `  "campaignName": "${req.campaignName}",`,
    `  "sequenceLength": ${req.sequenceLength},`,
    '  "narrativeArcSummary": "<80 to 2000 chars — name the arc in one paragraph: how each email builds on the last toward the goal. This is the test for arc coherence.>",',
    '  "emails": [',
    '    {',
    '      "stepIndex": 1,',
    `      "totalSteps": ${req.sequenceLength},`,
    `      "stepPurposeSlug": "<one of: ${slugList}>",`,
    '      "narrativeRole": "<20 to 800 chars — this email\'s job in the arc (e.g. opener that surfaces a specific pain), how it sets up step 2>",',
    '      "subjectLine": "<5 to 120 chars — earns the open without spam triggers>",',
    '      "previewText": "<10 to 250 chars — extends the subject, never repeats>",',
    '      "bodyPlainText": "<100 to 7000 chars — send-ready cold-outreach body, plain text, scannable, opens with prospect specificity, exactly ONE CTA>",',
    '      "ctaLine": "<10 to 500 chars — the single CTA in this email, lifted from the body>",',
    '      "psLine": "<5 to 500 chars — high reply-lift PS that restates the most compelling reason to respond>",',
    '      "personalizationNotes": "<50 to 6000 chars — variables and strategic personalization hooks for THIS step>",',
    '      "sendTimingHint": "<2 to 120 chars — when this email fires (e.g. \\"day 1\\", \\"day 4\\", \\"day 8\\") — must align with cadence above>"',
    '    }',
    `    ... continue for all ${req.sequenceLength} emails, each one referencing the prior steps`,
    '  ],',
    '  "toneAndAngleReasoning": "<50 to 5000 chars — why this tone and angle for this prospect across the whole arc>",',
    '  "followupSuggestion": "<50 to 5000 chars — if the entire sequence is ignored, what is the next step (different channel? wait + retry? deprioritize?)>",',
    '  "spamRiskNotes": "<30 to 4000 chars — honest spam-risk appraisal across the sequence; cumulative risk from sending N emails matters here>",',
    '  "rationale": "<150 to 10000 chars — the strategic case for this exact arc with this exact prospect; how the sequence as a whole earns the conversion>"',
    '}',
    '',
    'Hard rules you MUST follow:',
    `- emails array MUST have exactly ${req.sequenceLength} elements with stepIndex 1..${req.sequenceLength} in order, each with totalSteps=${req.sequenceLength}.`,
    `- stepPurposeSlug on each step MUST be one of the slugs from the taxonomy list: ${slugList}. Do NOT invent slugs.`,
    "- The narrativeArcSummary and each email's narrativeRole MUST make explicit how this email connects to the prior emails. Generic descriptions are a failure.",
    '- bodyPlainText for step 1 opens with prospect-specific context (pain, trigger, role, vertical). Step 2+ opens with continuity from prior step ("Following up on the {{vertical}} note", "Saw you didn\'t bite on the demo", etc.) — NOT a generic greeting.',
    '- Each step has exactly ONE call-to-action. The ctaLine is a copy of that CTA. Cumulative across the sequence, the asks should escalate (curiosity → specific question → meeting → final).',
    '- psLine on each step is a real PS, not a disclaimer.',
    '- sendTimingHint on each step must align with cadence above. If cadence is "day 1, day 4, day 8", then step 1 hint is "day 1", step 2 is "day 4", step 3 is "day 8". If no cadence given, infer reasonable spacing.',
    '- personalizationNotes on each step MUST name the variables ({{first_name}}, {{company}}, etc.) AND strategic hooks beyond merging.',
    '- Brand DNA in the system prompt above governs voice across ALL steps. avoidPhrases must not appear in any prose field across the whole sequence.',
    '- spamRiskNotes is sequence-level: account for cumulative risk from sending N emails to the same recipient. Burnout is real.',
    '- Output ONLY the JSON object. No prose outside it. No markdown fences. No preamble.',
  ];

  return sections.join('\n');
}

async function executeComposeOutreachSequence(
  req: ComposeOutreachSequenceRequest,
  ctx: LlmCallContext,
): Promise<ComposeOutreachSequenceResult> {
  const userPrompt = buildComposeSequenceUserPrompt(req, ctx.purposeTypes);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Email Specialist (sequence) output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = ComposeOutreachSequenceResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Email Specialist sequence output did not match expected schema: ${issueSummary}`);
  }

  // Sequence-length sanity: the LLM was told the count; reject if it drifted.
  if (result.data.emails.length !== req.sequenceLength) {
    throw new Error(
      `Email Specialist sequence: requested ${req.sequenceLength} emails, ` +
      `LLM returned ${result.data.emails.length}. Refusing partial sequence.`,
    );
  }

  // Step ordering sanity — must be 1..N contiguous, each with totalSteps=N.
  for (let i = 0; i < result.data.emails.length; i++) {
    const e = result.data.emails[i];
    if (e.stepIndex !== i + 1) {
      throw new Error(
        `Email Specialist sequence: emails[${i}].stepIndex was ${e.stepIndex}, expected ${i + 1}.`,
      );
    }
    if (e.totalSteps !== req.sequenceLength) {
      throw new Error(
        `Email Specialist sequence: emails[${i}].totalSteps was ${e.totalSteps}, expected ${req.sequenceLength}.`,
      );
    }
  }

  // Runtime taxonomy validation per step (Firestore-backed list, can change
  // between seeds). Same pattern as compose_email.
  const validSlugs = new Set(ctx.purposeTypes.map((t) => t.slug));
  for (let i = 0; i < result.data.emails.length; i++) {
    const slug = result.data.emails[i].stepPurposeSlug;
    if (!validSlugs.has(slug)) {
      throw new Error(
        `Email Specialist sequence: emails[${i}].stepPurposeSlug='${slug}' is not in the active taxonomy. ` +
        `Valid slugs: ${[...validSlugs].join(', ')}.`,
      );
    }
  }

  return result.data;
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
// ACTION: send_email — EXECUTOR (real delivery + LLM-authored timeline note)
// ============================================================================

function buildSendEmailNotePrompt(req: SendEmailRequest): string {
  return [
    'ACTION: send_email',
    '',
    'An operator-approved outbound email has just been (or is about to be) sent to a lead.',
    'Your ONLY job is to author the timeline note + a one-line rationale that records this send',
    'on the lead\'s CRM activity timeline. You do NOT write, rewrite, or echo the email itself —',
    'the recipient address, subject, and body are already composed, operator-reviewed, and owned',
    'by the delivery code. Do NOT reproduce the recipient email address anywhere in your output.',
    '',
    `Campaign: ${req.campaignName ?? '(none specified)'}`,
    req.leadName ? `Lead: ${req.leadName}` : '',
    `Email subject line that was sent: ${req.subject}`,
    '',
    'A short excerpt of the email body (context only — do NOT copy it verbatim into your note):',
    req.bodyPlainText.slice(0, 600),
    '',
    '---',
    '',
    'Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "rationale": "<1-3 sentences, plain English, why logging this send matters / what this outreach is doing for the lead>",',
    '  "activity": {',
    '    "subject": "<short timeline title for this send, e.g. \\"Outreach email sent — intro\\">",',
    '    "body": "<2-4 sentence note for the lead timeline summarizing that this email went out and what it asked for, plain text>",',
    '    "outcome": "<positive | neutral | negative — outbound sends are normally neutral>"',
    '  }',
    '}',
    '',
    'Hard rules:',
    '- NEVER emit the recipient email address. NEVER rewrite or restate the subject or body verbatim — the code owns the email.',
    '- Output ONLY the JSON note. Plain text in the note. No markdown, no placeholders, no prose outside the JSON.',
  ].filter((line) => line !== '').join('\n');
}

async function authorSendEmailNote(req: SendEmailRequest, ctx: LlmCallContext): Promise<SendEmailActivityNote> {
  const userPrompt = buildSendEmailNotePrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Email Specialist send_email note was not valid JSON: ${rawContent.slice(0, 300)}`);
  }

  const result = SendEmailActivityNoteSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Email Specialist send_email note did not match expected schema: ${issueSummary}`);
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

      // EXECUTOR path: actually send a (composed, operator-approved) email and
      // log it. The approval gate is checked INSIDE executeSendEmail BEFORE any
      // GM load or LLM call so an unapproved request never touches OpenRouter.
      if (action === 'send_email') {
        return await this.executeSendEmail(taskId, payload);
      }

      const ctx = await loadGMBrandDNAAndPurposeTypes(DEFAULT_INDUSTRY_KEY);

      if (action === 'compose_outreach_sequence') {
        const seqValidation = ComposeOutreachSequenceRequestSchema.safeParse({
          ...payload,
          action,
        });
        if (!seqValidation.success) {
          const issueSummary = seqValidation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Email Specialist compose_outreach_sequence: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data = await executeComposeOutreachSequence(seqValidation.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      // action === 'compose_email'
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

      const data = await executeComposeEmail(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[EmailSpecialist] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * EXECUTOR: actually send a (composed, operator-approved) email + log it.
   * Fail-closed behind viaApprovedMissionStep. Delivery routes through
   * email-delivery-service (which records the delivery + emits the email.sent
   * signal), and reuses the SAME CAN-SPAM compliance path the
   * /api/email-writer/send route uses (wrapEmailBody + injectUnsubscribe +
   * buildListUnsubscribeHeaders). No compliance wording/behavior is changed here.
   */
  private async executeSendEmail(taskId: string, rawPayload: Record<string, unknown>): Promise<AgentReport> {
    const validation = SendEmailPayloadSchema.safeParse(rawPayload);
    if (!validation.success) {
      const issues = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return this.createReport(taskId, 'FAILED', null, [`Email Specialist: invalid send_email payload: ${issues}`]);
    }
    const req = validation.data;

    // APPROVAL GATE — FAIL CLOSED. send_email delivers a real email and must never
    // fire from a direct Jasper chat call. viaApprovedMissionStep is set true ONLY
    // by the mission StepRunner for an operator-approved step. Checked BEFORE any
    // GM load / LLM call / send, so an unapproved request never touches OpenRouter
    // or the carrier.
    if (req.viaApprovedMissionStep !== true) {
      logger.warn(
        `[EmailSpecialist] send_email BLOCKED (no operator approval) taskId=${taskId} leadId=${req.leadId}`,
        { file: FILE },
      );
      return this.createReport(taskId, 'COMPLETED', {
        approvalRequired: true,
        mutated: false,
        leadId: req.leadId,
        toEmail: req.toEmail,
        message:
          'send_email delivers a real email and cannot run directly from chat. It requires explicit ' +
          'operator approval. Propose it as a mission step via propose_mission_plan (toolName ' +
          '"delegate_to_outreach", action "send_email") — the operator approves the step in Mission ' +
          'Control, then the email is sent.',
      });
    }

    // The LLM authors ONLY the timeline note (GM verbatim); recipient/subject/body
    // are deterministic passthroughs already composed + operator-reviewed upstream.
    const ctx = await loadGMBrandDNAAndPurposeTypes(DEFAULT_INDUSTRY_KEY);
    const note = await authorSendEmailNote(req, ctx);

    // COMPLIANCE: reuse the EXACT CAN-SPAM path the /api/email-writer/send route
    // uses — wrap the HTML, inject the unsubscribe footer, build the
    // List-Unsubscribe headers. We call the same functions the proven route calls;
    // nothing about the compliance wording/headers is changed here.
    const { wrapEmailBody, stripHTML } = await import('@/lib/email-writer/email-html-templates');
    const { injectUnsubscribe, buildListUnsubscribeHeaders } = await import('@/lib/compliance/can-spam-service');
    const { sendEmail: sendViaDelivery } = await import('@/lib/email-writer/email-delivery-service');

    let htmlBody = wrapEmailBody(req.bodyHtml ?? req.bodyPlainText, { subject: req.subject });
    const injected = injectUnsubscribe(htmlBody, undefined, req.toEmail, undefined);
    htmlBody = injected.html;
    const listUnsubHeaders = buildListUnsubscribeHeaders(injected.unsubscribeUrl);
    const plainTextBody = req.bodyPlainText.trim().length > 0 ? req.bodyPlainText : stripHTML(htmlBody);

    const result = await sendViaDelivery({
      userId: `agent:${SPECIALIST_ID}`,
      to: req.toEmail,
      toName: req.leadName,
      subject: req.subject,
      html: htmlBody,
      text: plainTextBody,
      headers: listUnsubHeaders,
      ...(req.campaignName ? { campaignId: req.campaignName } : {}),
    });

    if (!result.success) {
      return this.createReport(taskId, 'FAILED', null, [
        `Email Specialist: delivery failed: ${result.error ?? 'unknown error'}`,
      ]);
    }

    // Log the email_sent activity. Partial-success: NEVER discard a completed send —
    // if the activity write fails, keep the send and return activityId:null.
    let activityId: string | null = null;
    try {
      const activity = await createActivity({
        type: 'email_sent',
        subject: req.subject,
        body: note.activity.body,
        relatedTo: [{ entityType: 'lead', entityId: req.leadId, entityName: req.leadName }],
        createdBy: SPECIALIST_ID,
        occurredAt: Timestamp.fromDate(new Date()),
        metadata: { emailId: result.messageId, toEmail: req.toEmail },
      });
      activityId = activity.id;
    } catch (activityError) {
      logger.error(
        `[EmailSpecialist] Email sent but activity log failed for lead ${req.leadId}`,
        activityError instanceof Error ? activityError : new Error(String(activityError)),
        { file: FILE },
      );
    }

    const out: SendEmailResult = {
      rationale: note.rationale,
      executed: {
        leadId: req.leadId,
        toEmail: req.toEmail,
        emailId: result.messageId,
        activityId,
        provider: 'sendgrid',
        emailSent: true,
      },
    };
    return this.createReport(taskId, 'COMPLETED', out);
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
  MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  loadGMBrandDNAAndPurposeTypes,
  appendPurposeTaxonomy,
  buildComposeEmailUserPrompt,
  stripJsonFences,
  ComposeEmailRequestSchema,
  ComposeEmailResultSchema,
};
