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
import { getBrandDNA, type BrandDNA } from '@/lib/brand/brand-dna-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'copywriter/specialist.ts';
const SPECIALIST_ID = 'COPYWRITER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_page_copy', 'generate_proposal'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

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
    capabilities: ['generate_page_copy', 'generate_proposal'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['generate_page_copy', 'generate_proposal'],
  outputSchema: {
    type: 'object',
    properties: {
      headlines: { type: 'object' },
      sections: { type: 'array' },
      metadata: { type: 'object' },
      visuals: { type: 'array' },
    },
  },
  maxTokens: 4096,
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

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: CopywriterGMConfig;
  brandDNA: BrandDNA;
  resolvedSystemPrompt: string;
}

async function loadGMAndBrandDNA(industryKey: string): Promise<LlmCallContext> {
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

  const gm: CopywriterGMConfig = {
    systemPrompt,
    // Default to Sonnet 4.6 (proved safe by the regression harness on
    // April 11 2026). The GM can override this per-industry if needed.
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens ?? 4096,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. Copywriter refuses to generate copy without brand identity. ' +
      'Visit /settings/ai-agents/business-setup.',
    );
  }

  const resolvedSystemPrompt = buildResolvedSystemPrompt(gm.systemPrompt, brandDNA);
  return { gm, brandDNA, resolvedSystemPrompt };
}

function buildResolvedSystemPrompt(baseSystemPrompt: string, brandDNA: BrandDNA): string {
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

  return `${baseSystemPrompt}\n${brandBlock}`;
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

      const ctx = await loadGMAndBrandDNA(DEFAULT_INDUSTRY_KEY);

      if (action === 'generate_page_copy') {
        const req = payload as unknown as PageCopyRequest;
        const data = await executePageCopy(req, ctx);
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
  loadGMAndBrandDNA,
  buildResolvedSystemPrompt,
  buildPageCopyUserPrompt,
  buildProposalUserPrompt,
  stripJsonFences,
  PageCopyResultSchema,
  ProposalResultSchema,
};
