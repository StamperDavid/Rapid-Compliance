/**
 * Growth Analyst — REAL AI AGENT (Task #33 rebuild, April 12 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6) to produce data-driven growth
 * analysis, experiment recommendations, and strategic insights.
 *
 * Supported actions (live code paths only):
 *   - generate_content  (MarketingManager GROWTH_LOOP — the only caller)
 *
 * The pre-rebuild template engine supported 7 actions (AGGREGATE_METRICS,
 * CALCULATE_KPIS, IDENTIFY_PATTERNS, GENERATE_MUTATIONS, TRACK_OBJECTIVES,
 * CONTENT_LIBRARY, WEEKLY_REPORT) — all using in-memory MemoryVault reads
 * with zero AI. Per CLAUDE.md rules, dead branches are not rebuilt.
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

const FILE = 'marketing/growth-analyst/specialist.ts';
const SPECIALIST_ID = 'GROWTH_ANALYST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

interface GrowthAnalystGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Growth Analyst',
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
      analysis: { type: 'object' },
      experiments: { type: 'array' },
      contentStrategy: { type: 'string' },
    },
  },
  maxTokens: 8192,
  temperature: 0.7,
};

// ============================================================================
// INPUT CONTRACT
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
}

const GenerateContentRequestSchema = z.object({
  action: z.literal('generate_content'),
  topic: z.string().min(1),
  contentType: z.string().min(1).default('growth_analysis'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const ExperimentSchema = z.object({
  name: z.string().min(5).max(200),
  hypothesis: z.string().min(20).max(600),
  channel: z.string().min(2).max(100),
  effort: z.enum(['low', 'medium', 'high']),
  expectedImpact: z.enum(['low', 'medium', 'high']),
  timeframe: z.string().min(3).max(200),
  successMetric: z.string().min(10).max(300),
});

const GrowthAnalysisResultSchema = z.object({
  analysis: z.object({
    currentState: z.string().min(50).max(3000),
    opportunities: z.array(z.string().min(20).max(500)).min(3).max(8),
    risks: z.array(z.string().min(20).max(500)).min(1).max(5),
    competitiveInsight: z.string().min(30).max(2000),
  }),
  experiments: z.array(ExperimentSchema).min(3).max(7),
  prioritizedActions: z.array(z.object({
    action: z.string().min(10).max(300),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    rationale: z.string().min(20).max(500),
  })).min(3).max(7),
  kpiTargets: z.array(z.object({
    metric: z.string().min(3).max(100),
    currentEstimate: z.string().min(2).max(200),
    target: z.string().min(2).max(200),
    timeframe: z.string().min(3).max(100),
  })).min(3).max(8),
  contentStrategy: z.string().min(50).max(4000),
});

export type GrowthAnalysisResult = z.infer<typeof GrowthAnalysisResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: GrowthAnalystGMConfig;
  brandDNA: BrandDNA;
  resolvedSystemPrompt: string;
}

async function loadGMAndBrandDNA(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Growth Analyst GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-growth-analyst-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<GrowthAnalystGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Growth Analyst GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gm: GrowthAnalystGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens ?? 8192,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. Growth Analyst refuses to generate analysis without brand identity. ' +
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

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
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
    `Topic: ${req.topic}`,
    `Analysis type: ${req.contentType}`,
  ];

  if (req.targetAudience) {sections.push(`Target audience: ${req.targetAudience}`);}
  if (req.tone) {sections.push(`Tone: ${req.tone}`);}
  if (req.campaignGoal) {sections.push(`Campaign goal: ${req.campaignGoal}`);}

  const brand = req.brandContext;
  if (brand) {
    sections.push('');
    sections.push('Brand context from caller:');
    if (brand.industry) {sections.push(`  Industry: ${brand.industry}`);}
    if (brand.toneOfVoice) {sections.push(`  Tone of voice: ${brand.toneOfVoice}`);}
    if (brand.keyPhrases && brand.keyPhrases.length > 0) {sections.push(`  Key phrases: ${brand.keyPhrases.join(', ')}`);}
    if (brand.avoidPhrases && brand.avoidPhrases.length > 0) {sections.push(`  Avoid phrases: ${brand.avoidPhrases.join(', ')}`);}
  }

  const seo = req.seoKeywords;
  if (seo) {
    sections.push('');
    sections.push('SEO keywords:');
    if (seo.primary) {sections.push(`  Primary: ${seo.primary}`);}
    if (seo.secondary && seo.secondary.length > 0) {sections.push(`  Secondary: ${seo.secondary.join(', ')}`);}
  }

  sections.push('');
  sections.push('Produce a growth analysis with experiments, prioritized actions, and KPI targets. Respond with ONLY a valid JSON object, no markdown fences. The JSON must match this exact schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "analysis": {');
  sections.push('    "currentState": "<assessment of the current growth situation, 50-3000 chars>",');
  sections.push('    "opportunities": ["<3-8 specific growth opportunities, each 20-500 chars>"],');
  sections.push('    "risks": ["<1-5 risks or threats to growth, each 20-500 chars>"],');
  sections.push('    "competitiveInsight": "<analysis of competitive landscape and positioning, 30-2000 chars>"');
  sections.push('  },');
  sections.push('  "experiments": [');
  sections.push('    {');
  sections.push('      "name": "<experiment name, 5-200 chars>",');
  sections.push('      "hypothesis": "<if we do X, we expect Y because Z, 20-600 chars>",');
  sections.push('      "channel": "<marketing channel: SEO, paid social, email, content, partnerships, etc.>",');
  sections.push('      "effort": "<low|medium|high>",');
  sections.push('      "expectedImpact": "<low|medium|high>",');
  sections.push('      "timeframe": "<how long to run the experiment, 3-200 chars>",');
  sections.push('      "successMetric": "<specific measurable outcome, 10-300 chars>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "prioritizedActions": [');
  sections.push('    {');
  sections.push('      "action": "<specific action to take, 10-300 chars>",');
  sections.push('      "priority": "<critical|high|medium|low>",');
  sections.push('      "rationale": "<why this priority ranking, 20-500 chars>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "kpiTargets": [');
  sections.push('    {');
  sections.push('      "metric": "<metric name: MRR, CAC, LTV, churn rate, etc.>",');
  sections.push('      "currentEstimate": "<estimated current value or range>",');
  sections.push('      "target": "<target value>",');
  sections.push('      "timeframe": "<when to hit the target>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "contentStrategy": "<overall growth strategy narrative connecting the analysis to the experiments and actions, 50-4000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- Experiments MUST have 3-7 entries. Each must be specific and actionable, not generic ("improve SEO" is bad; "Create 10 comparison landing pages targeting competitor brand keywords" is good).');
  sections.push('- Every experiment needs a clear hypothesis in "if X then Y because Z" format.');
  sections.push('- Effort/impact scoring must be honest. Not everything is high-impact/low-effort. Most real experiments are medium on both axes.');
  sections.push('- PrioritizedActions MUST have 3-7 entries ranked by priority. "Critical" means revenue or growth is at risk without it. "Low" means nice-to-have.');
  sections.push('- KPI targets MUST have 3-8 entries with realistic estimates — not aspirational fantasies. If you don\'t know the current value, say "unknown — needs measurement" rather than guessing.');
  sections.push('- Do NOT fabricate specific numbers (MRR, ARR, conversion rates, user counts) unless they are obviously illustrative ranges based on the industry context.');
  sections.push('- Competitive insights should be specific to the industry and topic, not generic advice.');
  sections.push('- The contentStrategy must tie everything together: why these experiments, why this priority order, what the growth thesis is.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<GrowthAnalysisResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Growth Analyst output was not valid JSON: ${rawContent.slice(0, 200)}`);
  }

  const result = GrowthAnalysisResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Growth Analyst output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// GROWTH ANALYST CLASS
// ============================================================================

export class GrowthAnalyst extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Growth Analyst initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Growth Analyst: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Growth Analyst: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Growth Analyst does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[GrowthAnalyst] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const inputValidation = GenerateContentRequestSchema.safeParse({ ...payload, action });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Growth Analyst generate_content: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMAndBrandDNA(DEFAULT_INDUSTRY_KEY);
      const data = await executeGenerateContent(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[GrowthAnalyst] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 370, boilerplate: 50 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createGrowthAnalyst(): GrowthAnalyst {
  return new GrowthAnalyst();
}

let instance: GrowthAnalyst | null = null;

export function getGrowthAnalyst(): GrowthAnalyst {
  instance ??= createGrowthAnalyst();
  return instance;
}

// ============================================================================
// INTERNAL TEST HELPERS
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  loadGMAndBrandDNA,
  buildResolvedSystemPrompt,
  buildGenerateContentUserPrompt,
  stripJsonFences,
  GenerateContentRequestSchema,
  GrowthAnalysisResultSchema,
};
