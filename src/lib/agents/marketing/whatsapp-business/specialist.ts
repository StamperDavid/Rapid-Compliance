/**
 * WhatsApp Business Expert — REAL AI AGENT (LLM-backed, broadcast-template coverage)
 *
 * Composes brand-voiced broadcast / template messages for the brand's
 * WhatsApp Business account (Cloud API or BSP). WhatsApp Business
 * messaging is template-driven and category-aware: every outbound
 * message MUST fall under one of MARKETING, UTILITY, or AUTHENTICATION.
 *
 * Inbound webhook handling (auto-reply to user-initiated 24-hour
 * service window) is a SEPARATE phase and is NOT covered here — the
 * specialist exposes only `generate_content`.
 *
 * Loads its Golden Master from Firestore (collection
 * `specialistGoldenMasters`, doc id
 * `sgm_whatsapp_business_expert_<industry>_v<n>`). Brand DNA is baked
 * into the GM at seed time per Standing Rule #1.
 *
 * Supported actions:
 *   - generate_content    Marketing Manager's broadcast-template path.
 *                         Produces concise, opt-in-respectful messages
 *                         (≤4096 char WhatsApp body limit, target ≤700
 *                         for read-through), 1-2 alternative phrasings,
 *                         WhatsApp template category, optional CTA
 *                         (text + url or phone), audience segment
 *                         suggestion, strategy reasoning.
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

const FILE = 'marketing/whatsapp-business/specialist.ts';
const SPECIALIST_ID = 'WHATSAPP_BUSINESS_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case WhatsApp Business
 * Expert generate_content response.
 *
 * Derivation:
 *   primaryMessage 4096 + 2 × alternativeMessages 4096 = 12,288
 *   templateCategory enum (~15 chars)
 *   callToAction { text 60, url 200, phone 30 } ≈ 300
 *   audienceSegmentSuggestion 500
 *   strategyReasoning 2000
 *   ≈ 15,100 chars total prose
 *   /3.0 chars/token ≈ 5,030 tokens
 *   + JSON structure (~300 tokens)
 *   + 25% safety margin
 *   ≈ 6,700 tokens minimum.
 *
 *   Setting to 7500 for comfortable headroom.
 */
const GENERATE_CONTENT_MAX_TOKENS = 7500;

interface WhatsAppBusinessExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'WhatsApp Business Expert',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['generate_content'],
  },
  systemPrompt: '',
  tools: ['generate_content'],
  outputSchema: {
    type: 'object',
    properties: {
      primaryMessage: { type: 'string' },
      alternativeMessages: { type: 'array' },
      templateCategory: { type: 'string' },
      callToAction: { type: 'object' },
      audienceSegmentSuggestion: { type: 'string' },
      strategyReasoning: { type: 'string' },
    },
  },
  maxTokens: GENERATE_CONTENT_MAX_TOKENS,
  temperature: 0.7,
};

// ============================================================================
// INPUT CONTRACT — generate_content
// ============================================================================

interface BrandContextInput {
  industry?: string;
  toneOfVoice?: string;
  keyPhrases?: string[];
  avoidPhrases?: string[];
}

interface SeoKeywordsInput {
  primary?: string;
  secondary?: string[];
  recommendations?: string[];
}

export interface GenerateContentRequest {
  action: 'generate_content';
  topic: string;
  contentType: string;
  targetAudience?: string;
  tone?: string;
  campaignGoal?: string;
  brandContext?: BrandContextInput;
  seoKeywords?: SeoKeywordsInput;
  /** When the operator provides exact message text, the LLM uses it
   *  as-is rather than drafting fresh copy. */
  verbatimText?: string;
}

const GenerateContentRequestSchema = z.object({
  action: z.literal('generate_content'),
  topic: z.string().min(1),
  contentType: z.string().min(1).default('broadcast_template'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
  verbatimText: z.string().optional(),
});

// ============================================================================
// OUTPUT CONTRACT — generate_content
// ============================================================================

const CallToActionSchema = z.object({
  text: z.string().min(1).max(60),
  url: z.string().url().max(2000).optional(),
  phone: z.string().min(5).max(30).optional(),
});

const WhatsAppContentResultSchema = z.object({
  /** Primary broadcast/template message — what the brand should send.
   *  WhatsApp body hard limit is 4096; brand playbook target ≤700 for
   *  read-through and to keep templates approvable in MARKETING. */
  primaryMessage: z.string().min(10).max(4096),
  /** 1-2 alternative phrasings the operator can pick from. */
  alternativeMessages: z.array(z.string().min(10).max(4096)).min(1).max(2),
  /** Required WhatsApp Business message category. Determines pricing,
   *  approval rules, and opt-in requirements:
   *    MARKETING       — promotional / awareness content
   *    UTILITY         — transactional updates the user expects
   *    AUTHENTICATION  — OTP / login codes (do NOT use for marketing) */
  templateCategory: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  /** Optional call-to-action button. WhatsApp templates allow a single
   *  URL or phone CTA. Omit when the message is purely informational. */
  callToAction: CallToActionSchema.optional(),
  /** Suggested audience segment for the broadcast. Examples:
   *  "opted-in trial users from the past 30 days",
   *  "customers who completed onboarding step 3 but not step 4". */
  audienceSegmentSuggestion: z.string().min(20).max(500),
  /** Why this approach fits WhatsApp Business culture + the chosen
   *  category + brand voice. Operator reads this in Mission Control. */
  strategyReasoning: z.string().min(50).max(2000),
});

export type WhatsAppContentResult = z.infer<typeof WhatsAppContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: WhatsAppBusinessExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `WhatsApp Business Expert GM not found for industryKey=${industryKey}. ` +
      `Run npx tsx scripts/seed-whatsapp-business-expert-gm.ts to seed.`,
    );
  }
  const config = gmRecord.config as Partial<WhatsAppBusinessExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `WhatsApp Business Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }
  const gmMaxTokens = config.maxTokens ?? GENERATE_CONTENT_MAX_TOKENS;
  const effectiveMaxTokens = Math.max(gmMaxTokens, GENERATE_CONTENT_MAX_TOKENS);
  const gm: WhatsAppBusinessExpertGMConfig = {
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
  maxTokens: number,
): Promise<string> {
  const provider = new OpenRouterProvider(PLATFORM_ID);
  const response = await provider.chat({
    model: ctx.gm.model,
    messages: [
      { role: 'system', content: ctx.resolvedSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: ctx.gm.temperature,
    maxTokens,
  });

  if (response.finishReason === 'length') {
    throw new Error(
      `WhatsApp Business Expert: LLM response truncated at maxTokens=${maxTokens}. ` +
      'Either raise the budget or shorten the brief.',
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('WhatsApp Business Expert: OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// ACTION: generate_content
// ============================================================================

function buildGenerateContentUserPrompt(req: GenerateContentRequest): string {
  const sections: string[] = [
    'ACTION: generate_content',
    '',
    `Platform: WhatsApp Business (Cloud API broadcast / template)`,
    `Topic: ${req.topic}`,
    `Content type: ${req.contentType}`,
  ];

  if (req.targetAudience) { sections.push(`Target audience: ${req.targetAudience}`); }
  if (req.tone) { sections.push(`Tone override: ${req.tone}`); }
  if (req.campaignGoal) { sections.push(`Campaign goal: ${req.campaignGoal}`); }

  if (req.verbatimText) {
    sections.push('');
    sections.push('Operator-provided verbatim text (use as primary message unless it exceeds WhatsApp\'s 4096-char body limit):');
    sections.push('"""');
    sections.push(req.verbatimText);
    sections.push('"""');
  }

  const brand = req.brandContext;
  if (brand) {
    sections.push('');
    sections.push('Brand context:');
    if (brand.industry) { sections.push(`  Industry: ${brand.industry}`); }
    if (brand.toneOfVoice) { sections.push(`  Tone of voice: ${brand.toneOfVoice}`); }
    if (brand.keyPhrases && brand.keyPhrases.length > 0) {
      sections.push(`  Key phrases: ${brand.keyPhrases.join(', ')}`);
    }
    if (brand.avoidPhrases && brand.avoidPhrases.length > 0) {
      sections.push(`  Avoid phrases: ${brand.avoidPhrases.join(', ')}`);
    }
  }

  const seo = req.seoKeywords;
  if (seo) {
    sections.push('');
    sections.push('SEO keywords (WhatsApp has no organic search; use these only as topical anchors in copy):');
    if (seo.primary) { sections.push(`  Primary: ${seo.primary}`); }
    if (seo.secondary && seo.secondary.length > 0) {
      sections.push(`  Secondary: ${seo.secondary.join(', ')}`);
    }
  }

  sections.push('');
  sections.push('Produce a complete WhatsApp Business broadcast plan. Respond with ONLY a valid JSON object — no markdown fences, no preamble. Schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "primaryMessage": "<the message body — 10-4096 chars, target ≤700>",');
  sections.push('  "alternativeMessages": ["<1-2 alternative phrasings, each 10-4096 chars>"],');
  sections.push('  "templateCategory": "<MARKETING | UTILITY | AUTHENTICATION>",');
  sections.push('  "callToAction": { "text": "<button label, 1-60 chars>", "url": "<https://... optional>", "phone": "<E.164 optional>" } | omit entirely,');
  sections.push('  "audienceSegmentSuggestion": "<who should receive this broadcast, 20-500 chars>",');
  sections.push('  "strategyReasoning": "<why this approach fits WhatsApp + chosen category + brand voice, 50-2000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules:');
  sections.push('- primaryMessage MUST be 10-4096 chars (WhatsApp body hard limit). Brand playbook target: ≤700 chars for read-through and template approvability.');
  sections.push('- WhatsApp Business is OPT-IN ONLY. Recipients have explicitly granted permission. Speak to them like an existing relationship — no cold-pitch energy.');
  sections.push('- templateCategory selection is critical:');
  sections.push('    MARKETING       — promotional, awareness, re-engagement, drip nurture. Subject to MARKETING template approval and opt-out controls. Default for most outbound.');
  sections.push('    UTILITY         — transactional updates the user expects (order status, account changes, appointment reminders, payment confirmations). Cheaper, faster approval.');
  sections.push('    AUTHENTICATION  — ONE-TIME PASSWORDS / login codes ONLY. Never use for marketing or onboarding messages.');
  sections.push('- If the topic is a promotional announcement, choose MARKETING. If it is a transactional update tied to a specific user action, choose UTILITY. AUTHENTICATION is reserved for OTP only.');
  sections.push('- Concise + scannable. Lead with the value or the news in line 1. Avoid wall-of-text.');
  sections.push('- No spam markers: ALL CAPS shouting, ">>> URGENT <<<", excessive emoji, "ACT NOW", "LIMITED TIME!!!" all violate WhatsApp policy and reduce deliverability.');
  sections.push('- No marketing-speak: "revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage" are forbidden.');
  sections.push('- No exclamation overload (zero or one ! in primaryMessage).');
  sections.push('- Light emoji is acceptable on WhatsApp (the platform culture allows it) — 0-2 per message, only when functional, never decoratively.');
  sections.push('- callToAction: include ONE CTA only when the message has a clear next step. WhatsApp templates support either a URL button OR a phone-call button (or none) — never both. If the CTA is a URL, set url; if it is a phone call, set phone. Omit callToAction entirely when the message is purely informational.');
  sections.push('- audienceSegmentSuggestion: be specific about who should receive this. "All opted-in subscribers" is too broad — segment by lifecycle stage, recent action, or product usage.');
  sections.push('- If verbatimText was provided, primaryMessage MUST be the verbatim text (or the closest version that fits 4096 chars). Alternative messages can vary slightly.');
  sections.push('- If brandContext.avoidPhrases is provided, never use those phrases.');
  sections.push('- If brandContext.keyPhrases is provided, weave at least one in naturally (do NOT force them).');
  sections.push('- Output ONLY the JSON object.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<WhatsAppContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt, GENERATE_CONTENT_MAX_TOKENS);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `WhatsApp Business Expert generate_content output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = WhatsAppContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`WhatsApp Business Expert generate_content output did not match schema: ${issueSummary}`);
  }
  return result.data;
}

// ============================================================================
// WHATSAPP BUSINESS EXPERT CLASS
// ============================================================================

export class WhatsAppBusinessExpert extends BaseSpecialist {
  constructor() { super(CONFIG); }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'WhatsApp Business Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['WhatsApp Business Expert: payload must be an object']);
      }
      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['WhatsApp Business Expert: no action specified in payload']);
      }
      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `WhatsApp Business Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;
      logger.info(`[WhatsAppBusinessExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'generate_content') {
        const validation = GenerateContentRequestSchema.safeParse({ ...payload, action });
        if (!validation.success) {
          const issueSummary = validation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `WhatsApp Business Expert generate_content: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data = await executeGenerateContent(validation.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      const _exhaustive: never = action;
      return this.createReport(taskId, 'FAILED', null, [
        `WhatsApp Business Expert: action '${_exhaustive}' has no handler in execute()`,
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[WhatsAppBusinessExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;
    if (signal.payload.type === 'COMMAND') { return this.execute(signal.payload); }
    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean { return true; }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 270, boilerplate: 50 };
  }
}

let instance: WhatsAppBusinessExpert | null = null;
export function getWhatsAppBusinessExpert(): WhatsAppBusinessExpert {
  instance ??= new WhatsAppBusinessExpert();
  return instance;
}

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  GENERATE_CONTENT_MAX_TOKENS,
  loadGMConfig,
  buildGenerateContentUserPrompt,
  executeGenerateContent,
  GenerateContentRequestSchema,
  WhatsAppContentResultSchema,
  CallToActionSchema,
};
