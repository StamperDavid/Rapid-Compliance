/**
 * Copywriter Specialist — REAL AI AGENT (Task #23 rebuild, April 11 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6 by default — locked in after the
 * regression harness proved Sonnet 4 → Sonnet 4.6 was a safe upgrade on
 * the seeded Copywriter case corpus) to produce marketing copy. No template
 * fallbacks. If the GM is missing, Brand DNA is missing, OpenRouter fails,
 * JSON won't parse, or Zod validation fails, the specialist returns a real
 * FAILED AgentReport with the honest reason.
 *
 * Supported actions (live code paths only):
 *   - generate_page_copy  (ContentManager.orchestrateContentProduction)
 *   - generate_proposal   (ContentManager.generatePersonalizedProposal)
 *
 * All other action branches from the pre-rebuild template engine were removed.
 * They were only called from ContentManager.processProductionQueue() dead code
 * deleted in Task #21.
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

const FILE = 'copywriter/specialist.ts';
const SPECIALIST_ID = 'COPYWRITER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_page_copy', 'generate_proposal', 'generate_email_sequence'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Copywriter response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   PageCopyResultSchema has NO .max() constraints (only .min(1)) so the
 *   bound has to come from the user prompt guidance, not Zod. The user
 *   prompt instructs:
 *     - h1: 6-12 words (~60 chars)
 *     - h2 array: one per section, each ~60 chars
 *     - sections: each with heading (~60) + content (40-120 words, cap
 *       ~720 chars) + optional cta (~200 chars) = ~980 chars per section
 *     - metadata: title 60 + description 160 + keywords ~150 + ogTitle 60
 *       + ogDescription 160 = ~590 chars
 *
 *   Realistic worst case (8-section page):
 *     8 × 980 + h1 60 + h2 array 480 + metadata 590 = ~8,970 chars prose
 *     /3.0 chars/token = 2,990 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin for tokenization variance and verbose styles
 *     ≈ 4,000 tokens minimum.
 *
 *   The prior 4,096 was right at the realistic floor with zero headroom.
 *   ProposalResultSchema is smaller (~5,100 chars worst case ≈ 1,900
 *   tokens) so generate_proposal fit comfortably; generate_page_copy did
 *   not. Setting the floor at 8,000 tokens = 2× the realistic max with
 *   room for verbose styles (pirate dialect, dense rationales) and any
 *   future schema growth. The truncation backstop in callOpenRouter
 *   catches anything that still overflows.
 *
 * If this constant ever changes, the prompt guidance in
 * buildPageCopyUserPrompt and buildProposalUserPrompt MUST be re-audited.
 * Cross-cutting context: this is part of the Task #45 follow-up
 * specialist audit (Email + SMS Specialists were fixed first; the same
 * latent bug existed across every Tasks #23-#41 specialist that calls
 * provider.chat() — the OpenRouter provider was hardcoding
 * finishReason='stop' and silently masking length-truncated responses).
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 8000;

interface CopywriterGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Copywriter',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'CONTENT_MANAGER',
    capabilities: ['generate_page_copy', 'generate_proposal', 'generate_email_sequence'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['generate_page_copy', 'generate_proposal', 'generate_email_sequence'],
  outputSchema: {
    type: 'object',
    properties: {
      headlines: { type: 'object' },
      sections: { type: 'array' },
      metadata: { type: 'object' },
      visuals: { type: 'array' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.7,
};

// ============================================================================
// INPUT CONTRACTS
// ============================================================================

export interface PageCopyRequest {
  action: 'generate_page_copy';
  pageId: string;
  pageName: string;
  pagePurpose?: string;
  sections?: Array<{ id: string; name: string; purpose?: string }>;
  seoKeywords?: string[];
  titleTemplate?: string;
  descriptionTemplate?: string;
  toneOfVoice?: string;
  keyPhrases?: string[];
  avoidPhrases?: string[];
}

export interface ProposalRequest {
  action: 'generate_proposal';
  leadId: string;
  companyName: string;
  contactName: string;
  industry?: string;
  painPoints?: string[];
  techStack?: string[];
  companySize?: string;
  requestedInfo?: string[];
}

export interface EmailSequenceRequest {
  action: 'generate_email_sequence';
  /** What the sequence is about (e.g. "Trial signup nurture", "Black Friday drip"). */
  topic: string;
  /** Who receives it (e.g. "new trial signups", "abandoned-cart shoppers"). */
  audience: string;
  /** How many emails to produce. Defaults to 5 if omitted. 1 is a single newsletter. */
  count?: number;
  /** Human cadence description passed through from the prompt (e.g. "over 14 days", "day 1, 3, 7, 14"). The copywriter uses this to annotate sendTimingHint for each email; the actual workflow scheduling happens elsewhere via create_workflow. */
  cadence?: string;
  /** What triggers the sequence for a given recipient (e.g. "trial_signup", "abandoned_cart"). */
  trigger?: string;
  /** Tone and phrase guidance threaded through from Content Manager. */
  toneOfVoice?: string;
  keyPhrases?: string[];
  avoidPhrases?: string[];
}

// ============================================================================
// OUTPUT CONTRACTS (Zod schemas — enforced on every LLM response)
// ============================================================================

const PageCopyResultSchema = z.object({
  headlines: z.object({
    h1: z.string().min(1),
    h2: z.array(z.string()),
    h3: z.array(z.string()),
  }),
  sections: z.array(z.object({
    sectionId: z.string().min(1),
    heading: z.string().min(1),
    content: z.string().min(1),
    cta: z.string().optional(),
  })).min(1),
  metadata: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    keywords: z.array(z.string()),
    ogTitle: z.string().min(1),
    ogDescription: z.string().min(1),
  }),
  visuals: z.array(z.unknown()),
}).superRefine((data, ctx) => {
  if (data.headlines.h2.length !== data.sections.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['headlines', 'h2'],
      message: `headlines.h2.length (${data.headlines.h2.length}) must equal sections.length (${data.sections.length}). The LLM must return one H2 per section in the same order, even when the first section is a hero whose H2 duplicates headlines.h1.`,
    });
  }
});

export type PageCopyResult = z.infer<typeof PageCopyResultSchema>;

const ProposalResultSchema = z.object({
  proposalId: z.string().min(1),
  leadId: z.string().min(1),
  openingHook: z.string().min(1),
  sections: z.array(z.object({
    heading: z.string().min(1),
    body: z.string().min(1),
  })).min(1),
  closingCta: z.string().min(1),
  generatedAt: z.string().min(1),
});

export type ProposalResult = z.infer<typeof ProposalResultSchema>;

const EmailSequenceResultSchema = z.object({
  sequenceId: z.string().min(1),
  topic: z.string().min(1),
  audience: z.string().min(1),
  trigger: z.string().optional(),
  cadence: z.string().optional(),
  emails: z.array(z.object({
    order: z.number().int().min(1),
    subjectLine: z.string().min(1).max(80),
    previewText: z.string().min(1).max(120),
    body: z.string().min(1),
    cta: z.string().min(1),
    sendTimingHint: z.string().min(1),
  })).min(1),
  generatedAt: z.string().min(1),
});

export type EmailSequenceResult = z.infer<typeof EmailSequenceResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: CopywriterGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Copywriter GM not found for industryKey=${industryKey}. ` +
      `Run POST /api/training/seed-copywriter-gm to seed.`,
    );
  }

  const config = gmRecord.config as Partial<CopywriterGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Copywriter GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: CopywriterGMConfig = {
    systemPrompt,
    // Default to Sonnet 4.6 (proved safe by the regression harness on
    // April 11 2026). The GM can override this per-industry if needed.
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
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
  // truncated responses. With the provider fix in place, a 'length'
  // finish_reason means the LLM hit max_tokens mid-response and the JSON
  // is incomplete. Fail loudly with the diagnostic information needed to
  // fix the root cause, instead of letting JSON.parse surface a confusing
  // "unexpected end of input" error.
  if (response.finishReason === 'length') {
    throw new Error(
      `Copywriter: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
// ACTION: generate_page_copy
// ============================================================================

function buildPageCopyUserPrompt(req: PageCopyRequest): string {
  const sections = req.sections ?? [
    { id: 'hero', name: 'Hero', purpose: 'Primary value proposition' },
    { id: 'features', name: 'Features', purpose: 'Key benefits and features' },
    { id: 'cta', name: 'CTA', purpose: 'Call to action' },
  ];

  const sectionsBlock = sections.map((s) =>
    `- id: "${s.id}", name: "${s.name}", purpose: "${s.purpose ?? s.name}"`,
  ).join('\n');

  const seoKeywords = (req.seoKeywords ?? []).join(', ') || '(none specified)';

  return [
    'ACTION: generate_page_copy',
    '',
    `Page ID: ${req.pageId}`,
    `Page name: ${req.pageName}`,
    `Page purpose: ${req.pagePurpose ?? `Main ${req.pageName} page`}`,
    `SEO keywords (primary first): ${seoKeywords}`,
    req.titleTemplate ? `Meta title template: ${req.titleTemplate}` : '',
    req.descriptionTemplate ? `Meta description template: ${req.descriptionTemplate}` : '',
    '',
    'Required sections (you MUST produce exactly this set, in this order):',
    sectionsBlock,
    '',
    'Produce copy for this page. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    '  "headlines": {',
    '    "h1": "6-12 word page-level headline (separate from section headings)",',
    `    "h2": ["exactly ${sections.length} strings — ONE H2 per section in the same order as the sections list below. Each h2[i] MUST equal sections[i].heading. Even if sections[0] is a hero whose visible heading matches headlines.h1, you still produce an h2 entry for it and copy the same text there."],`,
    '    "h3": []',
    '  },',
    '  "sections": [',
    '    {',
    '      "sectionId": "matches the id from the sections list above",',
    '      "heading": "the H2 for this section (same as headlines.h2[i])",',
    '      "content": "40-120 words of body copy for this section",',
    '      "cta": "OPTIONAL — include only on CTA-purpose sections, specific verb + outcome"',
    '    }',
    '  ],',
    '  "metadata": {',
    '    "title": "50-60 chars, includes the primary keyword",',
    '    "description": "140-160 chars, includes the primary keyword, ends with benefit or light CTA",',
    '    "keywords": ["echo the SEO keywords above, optionally adding 1-2 related ones"],',
    '    "ogTitle": "same as title or a social-optimized variant",',
    '    "ogDescription": "same as description or a social-optimized variant"',
    '  },',
    '  "visuals": []',
    '}',
    '',
    'Rules you MUST follow:',
    `- sections.length MUST equal ${sections.length}, in the same order as the list above.`,
    `- headlines.h2.length MUST equal ${sections.length} (one H2 per section, same order).`,
    '- For each i: headlines.h2[i] MUST equal sections[i].heading verbatim.',
    '- Each section.sectionId must match exactly one id from the list above.',
    '- Do not use any phrase from the avoid list in the Brand DNA injection.',
    '- Do not fabricate statistics, percentages, testimonials, or client names.',
  ].filter((line) => line !== '').join('\n');
}

async function executePageCopy(
  req: PageCopyRequest,
  ctx: LlmCallContext,
): Promise<PageCopyResult> {
  const userPrompt = buildPageCopyUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Copywriter output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = PageCopyResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Copywriter output did not match expected schema: ${issueSummary}`);
  }

  // Defensive post-check: sectionId set must match request section ids
  const requestedIds = new Set((req.sections ?? []).map((s) => s.id));
  if (requestedIds.size > 0) {
    const returnedIds = new Set(result.data.sections.map((s) => s.sectionId));
    for (const id of requestedIds) {
      if (!returnedIds.has(id)) {
        throw new Error(
          `Copywriter output missing required sectionId "${id}". ` +
          `Returned: ${[...returnedIds].join(', ')}`,
        );
      }
    }
  }

  return result.data;
}

// ============================================================================
// ACTION: generate_proposal
// ============================================================================

function buildProposalUserPrompt(req: ProposalRequest): string {
  const painPoints = (req.painPoints ?? []).length > 0
    ? (req.painPoints ?? []).map((p) => `- ${p}`).join('\n')
    : '- (not provided — infer from industry context)';
  const techStack = (req.techStack ?? []).join(', ') || '(not provided)';
  const requestedInfo = (req.requestedInfo ?? []).join(', ') || '(not specified)';

  return [
    'ACTION: generate_proposal',
    '',
    `Lead ID: ${req.leadId}`,
    `Company name: ${req.companyName}`,
    `Contact name: ${req.contactName}`,
    `Industry: ${req.industry ?? '(not provided)'}`,
    `Company size: ${req.companySize ?? '(not provided)'}`,
    `Tech stack: ${techStack}`,
    `Requested info: ${requestedInfo}`,
    '',
    'Prospect pain points:',
    painPoints,
    '',
    'Produce a personalized proposal body. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    '  "proposalId": "IGNORED — server overwrites this. Return any placeholder string.",',
    '  "leadId": "IGNORED — server overwrites this. Return any placeholder string.",',
    '  "openingHook": "2-3 sentence opening that references the prospect\'s specific situation and signals you did your homework",',
    '  "sections": [',
    '    {',
    '      "heading": "3-6 word section heading tied to one of their pain points",',
    '      "body": "60-120 words — address the pain, explain how we solve it, reference a concrete outcome"',
    '    }',
    '  ],',
    '  "closingCta": "a specific, low-friction next step — book a specific meeting length, review a specific artifact, etc.",',
    '  "generatedAt": "IGNORED — server overwrites this. Return any placeholder string."',
    '}',
    '',
    'Rules you MUST follow:',
    '- Produce 3 to 5 sections. Each section maps to a distinct pain point or requested info item.',
    '- Do not waste effort on proposalId, leadId, or generatedAt — the server replaces whatever you return for those fields. Just return non-empty placeholder strings so the JSON parses.',
    '- Do not fabricate statistics, percentages, testimonials, or client names.',
    '- Do not use any phrase from the avoid list in the Brand DNA injection.',
    '- The openingHook must reference at least one concrete detail from the prospect context (company name, industry, pain point, or tech stack).',
    '- The closingCta must be a concrete action, not "Learn more" or "Get in touch."',
  ].join('\n');
}

async function executeProposal(
  req: ProposalRequest,
  ctx: LlmCallContext,
): Promise<ProposalResult> {
  const userPrompt = buildProposalUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Copywriter proposal output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  // Server-side overwrite of identity/time fields — the LLM is not trusted to
  // generate accurate timestamps or our internal ID format. Any value the model
  // returned for proposalId, leadId, or generatedAt is discarded.
  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    obj.proposalId = `proposal_${req.leadId}_${Date.now()}`;
    obj.leadId = req.leadId;
    obj.generatedAt = new Date().toISOString();
  }

  const result = ProposalResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Copywriter proposal did not match expected schema: ${issueSummary}`);
  }

  if (result.data.sections.length < 3 || result.data.sections.length > 5) {
    throw new Error(
      `Copywriter proposal must have 3-5 sections, got ${result.data.sections.length}`,
    );
  }

  return result.data;
}

// ============================================================================
// ACTION: generate_email_sequence
// ============================================================================

function buildEmailSequenceUserPrompt(req: EmailSequenceRequest): string {
  const count = typeof req.count === 'number' && req.count >= 1 && req.count <= 20 ? req.count : 5;
  const cadence = req.cadence && req.cadence.trim().length > 0 ? req.cadence.trim() : 'operator will set the cadence downstream — annotate timing relative to the trigger event (day 1, day 3, etc.)';
  const trigger = req.trigger && req.trigger.trim().length > 0 ? req.trigger.trim() : 'sequence start';
  const keyPhrases = (req.keyPhrases ?? []).join(', ') || '(none specified)';
  const avoidPhrases = (req.avoidPhrases ?? []).join(', ') || '(none specified)';

  return [
    'ACTION: generate_email_sequence',
    '',
    `Topic: ${req.topic}`,
    `Audience: ${req.audience}`,
    `Trigger event: ${trigger}`,
    `Cadence: ${cadence}`,
    `Email count: ${count}`,
    `Tone of voice: ${req.toneOfVoice ?? '(follow the Brand DNA tone in the system prompt)'}`,
    `Key phrases to weave in: ${keyPhrases}`,
    `Phrases you must NOT use: ${avoidPhrases}`,
    '',
    'Produce a sequenced set of emails. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    '  "sequenceId": "IGNORED — server overwrites this. Return any placeholder string.",',
    '  "topic": "IGNORED — server overwrites this. Return any placeholder string.",',
    '  "audience": "IGNORED — server overwrites this. Return any placeholder string.",',
    '  "trigger": "IGNORED — server overwrites this. Return any placeholder string.",',
    '  "cadence": "IGNORED — server overwrites this. Return any placeholder string.",',
    '  "emails": [',
    '    {',
    '      "order": 1,',
    '      "subjectLine": "under 80 chars, specific, curiosity-driven, no clickbait",',
    '      "previewText": "under 120 chars, complements the subject without repeating it",',
    '      "body": "100-200 words of plain-text email body — conversational, one idea per paragraph, maximum 4 short paragraphs, address the reader directly as \\"you\\"",',
    '      "cta": "ONE concrete next action — a specific link text, a reply prompt, a booking step. Under 60 chars.",',
    '      "sendTimingHint": "when this email fires relative to the trigger — e.g. \\"immediately on trigger\\", \\"day 3\\", \\"day 7\\" — aligned with the cadence above"',
    '    }',
    '  ],',
    '  "generatedAt": "IGNORED — server overwrites this. Return any placeholder string."',
    '}',
    '',
    `Rules you MUST follow:`,
    `- Produce EXACTLY ${count} emails in the emails array.`,
    '- Each email must have a distinct narrative purpose. Do not repeat the same angle across emails.',
    '- A typical 5-email nurture arc: 1) welcome + orient, 2) name the core problem, 3) show the solution with a proof point, 4) handle the most likely objection, 5) conversion push with urgency.',
    '- If count differs from 5, adapt the arc — compress or expand, but never skip the "welcome/orient" and "conversion push" bookends when count >= 2.',
    '- order field must be 1, 2, 3, ... through count, no gaps, no duplicates.',
    '- Every email has exactly ONE cta. Multiple CTAs in one email dilute conversion.',
    '- Do not fabricate statistics, percentages, testimonials, or client names.',
    '- Do not use any phrase from the avoid list.',
    '- Weave in key phrases where they fit naturally — never force them.',
    '- Subject lines should NOT start with "RE:" or "FWD:" unless the sequence is explicitly a re-engagement flow. Do not fake reply threads.',
    '- Body should be plain-text, not HTML. No markdown headers. Paragraph breaks only.',
    '- sendTimingHint must be human-readable and align with the Cadence line above. If cadence is vague, infer reasonable spacing (day 1, day 3, day 7, day 10, day 14 for 5 emails over ~2 weeks).',
    '- Do not write proposalId, leadId, or generatedAt values — those are placeholders; server overwrites them.',
  ].join('\n');
}

async function executeEmailSequence(
  req: EmailSequenceRequest,
  ctx: LlmCallContext,
): Promise<EmailSequenceResult> {
  const userPrompt = buildEmailSequenceUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Copywriter email_sequence output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  // Server-side overwrite of identity/context fields. Echo the caller's
  // request values back so downstream consumers (UI, grade service) can
  // trust them without parsing the user prompt.
  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const now = Date.now();
    obj.sequenceId = `emailseq_${now}_${Math.random().toString(36).slice(2, 8)}`;
    obj.topic = req.topic;
    obj.audience = req.audience;
    if (req.trigger) { obj.trigger = req.trigger; }
    if (req.cadence) { obj.cadence = req.cadence; }
    obj.generatedAt = new Date(now).toISOString();
  }

  const result = EmailSequenceResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Copywriter email_sequence did not match expected schema: ${issueSummary}`);
  }

  const requestedCount = typeof req.count === 'number' && req.count >= 1 && req.count <= 20 ? req.count : 5;
  if (result.data.emails.length !== requestedCount) {
    throw new Error(
      `Copywriter email_sequence must have exactly ${requestedCount} emails, got ${result.data.emails.length}`,
    );
  }

  // order field must be a contiguous 1..N — the schema can't express this on its own.
  const orders = result.data.emails.map((e) => e.order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      throw new Error(
        `Copywriter email_sequence order fields must be contiguous 1..${requestedCount}, got [${orders.join(',')}]`,
      );
    }
  }

  return result.data;
}

// ============================================================================
// COPYWRITER CLASS
// ============================================================================

export class Copywriter extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Copywriter initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Copywriter: payload must be an object']);
      }

      // Accept both 'action' and 'method' for backwards compat with older callers
      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Copywriter: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Copywriter does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[Copywriter] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'generate_page_copy') {
        const req = payload as unknown as PageCopyRequest;
        const data = await executePageCopy(req, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      if (action === 'generate_email_sequence') {
        const req = payload as unknown as EmailSequenceRequest;
        if (typeof req.topic !== 'string' || req.topic.trim().length === 0) {
          return this.createReport(taskId, 'FAILED', null, [
            'Copywriter generate_email_sequence: topic is required and must be non-empty',
          ]);
        }
        if (typeof req.audience !== 'string' || req.audience.trim().length === 0) {
          return this.createReport(taskId, 'FAILED', null, [
            'Copywriter generate_email_sequence: audience is required and must be non-empty',
          ]);
        }
        const data = await executeEmailSequence(req, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      // action === 'generate_proposal'
      const proposalReq = payload as unknown as ProposalRequest;
      if (typeof proposalReq.leadId !== 'string' || typeof proposalReq.companyName !== 'string'
        || typeof proposalReq.contactName !== 'string') {
        return this.createReport(taskId, 'FAILED', null, [
          'Copywriter generate_proposal: leadId, companyName, and contactName are required',
        ]);
      }
      const data = await executeProposal(proposalReq, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[Copywriter] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 400, boilerplate: 50 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createCopywriter(): Copywriter {
  return new Copywriter();
}

let instance: Copywriter | null = null;

export function getCopywriter(): Copywriter {
  instance ??= createCopywriter();
  return instance;
}

// ============================================================================
// INTERNAL TEST HELPERS (exported for the proof-of-life harness)
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  loadGMConfig,
  buildPageCopyUserPrompt,
  buildProposalUserPrompt,
  buildEmailSequenceUserPrompt,
  stripJsonFences,
  PageCopyResultSchema,
  ProposalResultSchema,
  EmailSequenceResultSchema,
};
