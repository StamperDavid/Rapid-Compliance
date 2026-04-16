/**
 * YouTube Expert — REAL AI AGENT
 *
 * Loads its Golden Master from Firestore at runtime and calls OpenRouter
 * (Claude Sonnet 4.6 by default — locked tier policy for leaf specialists)
 * to produce YouTube-optimized content: titles, descriptions, tags,
 * thumbnail concepts, script outlines, chapter markers, end screen CTAs,
 * and playlist strategy. No template fallbacks. If the GM is missing,
 * Brand DNA is missing, OpenRouter fails, JSON won't parse, or Zod
 * validation fails, the specialist returns a real FAILED AgentReport
 * with the honest reason.
 *
 * Supported actions (live code paths only):
 *   - generate_content  (MarketingManager.delegateToYouTube — the only
 *                        caller of this specialist anywhere in the codebase)
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

const FILE = 'marketing/youtube/specialist.ts';
const SPECIALIST_ID = 'YOUTUBE_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case YouTube Expert response.
 *
 * Derivation:
 *   YouTubeContentResultSchema worst case:
 *     title 200 + description 5000 + tags (15 × 50 = 750) +
 *     thumbnailConcept.headline 100 + thumbnailConcept.visualDescription 500 +
 *     thumbnailConcept.emotionalTrigger 200 +
 *     scriptOutline: 8 × (section 100 + keyPoints 3×200 + duration 20 + notes 300)
 *       = 8 × 1020 = 8160 +
 *     chapterMarkers: 10 × (timestamp 10 + title 100 + description 200) = 3100 +
 *     endScreenCTA.verbal 300 + endScreenCTA.visual 300 + endScreenCTA.timing 100 +
 *     playlistStrategy.suggestedPlaylist 200 + playlistStrategy.positionRationale 500 +
 *     playlistStrategy.relatedTopics 5×100 = 500
 *     ≈ 19,910 chars total prose
 *     /3.0 chars/token = 6,637 tokens
 *     + JSON structure overhead (~300 tokens)
 *     + 25% safety margin
 *     ≈ 8,671 tokens minimum.
 *
 *   Setting to 12000 for comfortable headroom.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 12000;

interface YouTubeExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'YouTube Expert',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['generate_content'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['generate_content'],
  outputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      tags: { type: 'array' },
      thumbnailConcept: { type: 'object' },
      scriptOutline: { type: 'array' },
      chapterMarkers: { type: 'array' },
      endScreenCTA: { type: 'object' },
      playlistStrategy: { type: 'object' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
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
  contentType: z.string().min(1).default('video'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const YouTubeContentResultSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(50).max(5000),
  tags: z.array(z.string().min(1)).min(5).max(15),
  thumbnailConcept: z.object({
    headline: z.string().min(3).max(100),
    visualDescription: z.string().min(20).max(2000),
    emotionalTrigger: z.string().min(5).max(1000),
  }),
  scriptOutline: z.array(z.object({
    section: z.string().min(3).max(100),
    keyPoints: z.array(z.string().min(5)).min(1).max(5),
    estimatedDuration: z.string().min(2).max(30),
    notes: z.string().max(300).optional(),
  })).min(3).max(10),
  chapterMarkers: z.array(z.object({
    timestamp: z.string().min(3).max(10),
    title: z.string().min(3).max(100),
    description: z.string().min(10).max(200),
  })).min(3).max(15),
  endScreenCTA: z.object({
    verbalCTA: z.string().min(10).max(1500),
    visualCTA: z.string().min(10).max(1500),
    timing: z.string().min(5).max(200),
  }),
  playlistStrategy: z.object({
    suggestedPlaylist: z.string().min(5).max(500),
    positionRationale: z.string().min(20).max(2000),
    relatedTopics: z.array(z.string().min(3)).min(2).max(5),
  }),
});

export type YouTubeContentResult = z.infer<typeof YouTubeContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: YouTubeExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `YouTube Expert GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-youtube-expert-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<YouTubeExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `YouTube Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: YouTubeExpertGMConfig = {
    systemPrompt,
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

  if (response.finishReason === 'length') {
    throw new Error(
      `YouTube Expert: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
// ACTION: generate_content
// ============================================================================

function buildGenerateContentUserPrompt(req: GenerateContentRequest): string {
  const sections: string[] = [
    'ACTION: generate_content',
    '',
    `Topic: ${req.topic}`,
    `Content type: ${req.contentType}`,
  ];

  if (req.targetAudience) {
    sections.push(`Target audience: ${req.targetAudience}`);
  }
  if (req.tone) {
    sections.push(`Tone: ${req.tone}`);
  }
  if (req.campaignGoal) {
    sections.push(`Campaign goal: ${req.campaignGoal}`);
  }

  const brand = req.brandContext;
  if (brand) {
    sections.push('');
    sections.push('Brand context from caller:');
    if (brand.industry) {
      sections.push(`  Industry: ${brand.industry}`);
    }
    if (brand.toneOfVoice) {
      sections.push(`  Tone of voice: ${brand.toneOfVoice}`);
    }
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
    sections.push('SEO keywords:');
    if (seo.primary) {
      sections.push(`  Primary: ${seo.primary}`);
    }
    if (seo.secondary && seo.secondary.length > 0) {
      sections.push(`  Secondary: ${seo.secondary.join(', ')}`);
    }
    if (seo.recommendations && seo.recommendations.length > 0) {
      sections.push(`  Recommendations: ${seo.recommendations.join(', ')}`);
    }
  }

  sections.push('');
  sections.push('Produce a complete YouTube video content plan. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "title": "<YouTube video title, SEO-optimized, 10-200 chars>",');
  sections.push('  "description": "<full YouTube video description with timestamps, links, and keywords, 50-5000 chars>",');
  sections.push('  "tags": ["<5-15 search-optimized tags>"],');
  sections.push('  "thumbnailConcept": {');
  sections.push('    "headline": "<thumbnail text overlay, 3-100 chars>",');
  sections.push('    "visualDescription": "<what the thumbnail should look like, 20-500 chars>",');
  sections.push('    "emotionalTrigger": "<what emotion/curiosity the thumbnail should evoke, 5-200 chars>"');
  sections.push('  },');
  sections.push('  "scriptOutline": [');
  sections.push('    {');
  sections.push('      "section": "<section name like Hook, Intro, Main Point 1, etc., 3-100 chars>",');
  sections.push('      "keyPoints": ["<key talking points for this section>"],');
  sections.push('      "estimatedDuration": "<e.g. 0:00-0:30>",');
  sections.push('      "notes": "<optional production/delivery notes, max 300 chars>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "chapterMarkers": [');
  sections.push('    {');
  sections.push('      "timestamp": "<e.g. 0:00>",');
  sections.push('      "title": "<chapter title, 3-100 chars>",');
  sections.push('      "description": "<what this chapter covers, 10-200 chars>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "endScreenCTA": {');
  sections.push('    "verbalCTA": "<what to say at the end to drive action, 10-300 chars>",');
  sections.push('    "visualCTA": "<what should appear on screen, 10-300 chars>",');
  sections.push('    "timing": "<when to start the end screen, e.g. last 20 seconds, 5-100 chars>"');
  sections.push('  },');
  sections.push('  "playlistStrategy": {');
  sections.push('    "suggestedPlaylist": "<playlist name this video belongs to, 5-200 chars>",');
  sections.push('    "positionRationale": "<why this video fits in this playlist and where, 20-500 chars>",');
  sections.push('    "relatedTopics": ["<2-5 topics for follow-up videos in the series>"]');
  sections.push('  }');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- The title MUST be click-worthy and SEO-optimized. Use numbers, power words, or curiosity gaps. Keep under 60 chars for full display in search results.');
  sections.push('- The description MUST include: a strong first line (shows in search), timestamps/chapters, relevant links placeholder, and 2-3 keyword-rich paragraphs. Front-load keywords in the first 150 chars.');
  sections.push('- Tags: mix broad (1-2 word) and long-tail (3-5 word) tags. Include the primary keyword as the FIRST tag.');
  sections.push('- Thumbnail concept MUST be designed for mobile-first viewing — bold text, high contrast, expressive face or dramatic visual.');
  sections.push('- Script outline MUST start with a hook section (first 5-10 seconds) that creates a reason to keep watching. Never start with "Hey guys" or channel intros.');
  sections.push('- Chapter markers MUST start at 0:00 and be realistic based on the script outline durations.');
  sections.push('- End screen CTA MUST drive a specific action (subscribe, watch next video, click link) — never a generic "thanks for watching."');
  sections.push('- Playlist strategy should group thematically related content to increase session watch time.');
  sections.push('- If seoKeywords are provided, the primary keyword MUST appear in the title, first line of description, and first tag.');
  sections.push('- If brandContext.avoidPhrases are provided, never use those phrases anywhere in the output.');
  sections.push('- If brandContext.keyPhrases are provided, weave at least one naturally into the description and script.');
  sections.push('- Do NOT fabricate view counts, subscriber numbers, or specific performance predictions.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<YouTubeContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `YouTube Expert output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = YouTubeContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`YouTube Expert output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// YOUTUBE EXPERT CLASS
// ============================================================================

export class YouTubeExpert extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'YouTube Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['YouTube Expert: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['YouTube Expert: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `YouTube Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[YouTubeExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const inputValidation = GenerateContentRequestSchema.safeParse({
        ...payload,
        action,
      });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `YouTube Expert generate_content: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      const data = await executeGenerateContent(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[YouTubeExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 380, boilerplate: 50 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createYouTubeExpert(): YouTubeExpert {
  return new YouTubeExpert();
}

let instance: YouTubeExpert | null = null;

export function getYouTubeExpert(): YouTubeExpert {
  instance ??= createYouTubeExpert();
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
  buildGenerateContentUserPrompt,
  stripJsonFences,
  GenerateContentRequestSchema,
  YouTubeContentResultSchema,
};
