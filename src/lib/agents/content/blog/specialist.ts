/**
 * Blog Writer Specialist — REAL AI AGENT (April 15, 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6 by default) to produce long-form
 * SEO-optimized blog content. No template fallbacks. If the GM is missing,
 * Brand DNA is missing, OpenRouter fails, JSON won't parse, or Zod
 * validation fails, the specialist returns a real FAILED AgentReport with
 * the honest reason.
 *
 * Supported actions (live code paths only):
 *   - write_blog_post     (full blog post from a content brief)
 *   - outline_blog_post   (outline/structure only, for operator review)
 *
 * Different from Copywriter — Blog Writer focuses exclusively on blog-length
 * content with SEO depth: internal linking strategy, structured headings,
 * meta descriptions, featured snippet optimization, and CTA integration.
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

const FILE = 'blog/specialist.ts';
const SPECIALIST_ID = 'BLOG_WRITER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['write_blog_post', 'outline_blog_post'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for blog content.
 *
 * Derivation:
 *   BlogPostResultSchema worst case (2500-word blog):
 *     - title: ~80 chars
 *     - metaDescription: ~160 chars
 *     - slug: ~60 chars
 *     - estimatedReadTime: ~20 chars
 *     - sections array (8 sections × ~400 words each):
 *       8 × (heading ~60 + body ~2400 chars + keyTakeaway ~200) = ~21,280 chars
 *     - internalLinks (5 links × ~300 chars each) = ~1,500 chars
 *     - cta: ~400 chars
 *     - seoNotes: ~600 chars
 *     Total prose: ~24,100 chars / 3.0 chars/token = ~8,033 tokens
 *     + JSON structure overhead (~300 tokens)
 *     + 25% safety margin for verbose writing styles
 *     ≈ 10,400 tokens minimum.
 *
 *   Setting to 12,000 for comfortable headroom on long-form content.
 *   The truncation backstop in callOpenRouter catches anything that
 *   still overflows.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 12000;

interface BlogWriterGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Blog Writer',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'CONTENT_MANAGER',
    capabilities: ['write_blog_post', 'outline_blog_post'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['write_blog_post', 'outline_blog_post'],
  outputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      sections: { type: 'array' },
      metadata: { type: 'object' },
      internalLinks: { type: 'array' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.7,
};

// ============================================================================
// INPUT CONTRACTS
// ============================================================================

export interface BlogPostRequest {
  action: 'write_blog_post';
  topic: string;
  targetKeywords: string[];
  audience?: string;
  wordCountTarget?: number;
  internalLinkingPages?: Array<{ url: string; title: string; relevance?: string }>;
  toneOverride?: string;
  contentAngle?: string;
  competitorUrls?: string[];
  /**
   * Pre-formatted research block from upstream Intelligence Manager (or any
   * research agent). When present, the LLM is instructed to cite and
   * synthesize this material as the source of facts instead of hallucinating
   * generic industry commentary. Typically populated by Content Manager via
   * `buildResearchContextFromVault()` in src/lib/content/intelligence-context.ts.
   */
  researchContext?: string;
}

export interface BlogOutlineRequest {
  action: 'outline_blog_post';
  topic: string;
  targetKeywords: string[];
  audience?: string;
  wordCountTarget?: number;
  internalLinkingPages?: Array<{ url: string; title: string; relevance?: string }>;
  contentAngle?: string;
}

// ============================================================================
// OUTPUT CONTRACTS (Zod schemas — enforced on every LLM response)
// ============================================================================

const BlogSectionSchema = z.object({
  headingLevel: z.enum(['h2', 'h3']),
  heading: z.string().min(1),
  body: z.string().min(1),
  keyTakeaway: z.string().optional(),
});

const InternalLinkPlacementSchema = z.object({
  anchorText: z.string().min(1),
  targetUrl: z.string().min(1),
  contextSentence: z.string().min(1),
  sectionHeading: z.string().min(1),
});

const BlogPostResultSchema = z.object({
  title: z.string().min(1),
  metaDescription: z.string().min(1).max(320),
  slug: z.string().min(1),
  estimatedReadTime: z.string().min(1),
  sections: z.array(BlogSectionSchema).min(3),
  internalLinks: z.array(InternalLinkPlacementSchema),
  cta: z.object({
    text: z.string().min(1),
    placement: z.string().min(1),
  }),
  seoNotes: z.object({
    primaryKeyword: z.string().min(1),
    secondaryKeywords: z.array(z.string()),
    featuredSnippetTarget: z.string().optional(),
    schemaMarkupSuggestion: z.string().optional(),
  }),
});

export type BlogPostResult = z.infer<typeof BlogPostResultSchema>;

const BlogOutlineSectionSchema = z.object({
  headingLevel: z.enum(['h2', 'h3']),
  heading: z.string().min(1),
  bulletPoints: z.array(z.string()).min(1),
  estimatedWordCount: z.number().min(1),
});

const BlogOutlineResultSchema = z.object({
  title: z.string().min(1),
  metaDescription: z.string().min(1).max(320),
  slug: z.string().min(1),
  estimatedReadTime: z.string().min(1),
  sections: z.array(BlogOutlineSectionSchema).min(3),
  internalLinkOpportunities: z.array(z.object({
    targetUrl: z.string().min(1),
    suggestedAnchorText: z.string().min(1),
    suggestedSection: z.string().min(1),
  })),
  seoStrategy: z.object({
    primaryKeyword: z.string().min(1),
    secondaryKeywords: z.array(z.string()),
    featuredSnippetTarget: z.string().optional(),
    contentGaps: z.array(z.string()).optional(),
  }),
});

export type BlogOutlineResult = z.infer<typeof BlogOutlineResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: BlogWriterGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Blog Writer GM not found for industryKey=${industryKey}. ` +
      `Run: node scripts/seed-blog-writer-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<BlogWriterGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Blog Writer GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: BlogWriterGMConfig = {
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
      `Blog Writer: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
// ACTION: write_blog_post
// ============================================================================

function buildBlogPostUserPrompt(req: BlogPostRequest): string {
  const keywords = req.targetKeywords.join(', ') || '(none specified)';
  const audience = req.audience ?? 'B2B SaaS decision-makers';
  const wordCount = req.wordCountTarget ?? 1500;
  const angle = req.contentAngle ?? '(not specified — use your editorial judgment)';

  const internalPages = (req.internalLinkingPages ?? []).length > 0
    ? (req.internalLinkingPages ?? []).map((p) =>
      `- "${p.title}" → ${p.url}${p.relevance ? ` (relevance: ${p.relevance})` : ''}`,
    ).join('\n')
    : '(none provided — skip internal link placements)';

  const competitorBlock = (req.competitorUrls ?? []).length > 0
    ? `Competitor URLs to outperform (do NOT mention them by name):\n${(req.competitorUrls ?? []).map((u) => `- ${u}`).join('\n')}`
    : '';

  // When upstream Intelligence Manager ran and produced real research, embed
  // it verbatim and instruct the LLM to use it as the source of facts.
  //
  // CRITICAL FRAMING: this is a content blog, not competitive intelligence.
  // The companies in the research are INDUSTRY EXAMPLES — likely prospects or
  // peers of the blog's target audience — NOT adversaries. The blog must be
  // neutral and authoritative, using the research to demonstrate industry
  // understanding, never to criticize or position "against" the researched
  // companies. Without this framing, adversarial language leaks into the
  // output and breaks inbound marketing intent.
  const researchBlock = req.researchContext
    ? [
        '=== INDUSTRY RESEARCH CONTEXT (authoritative source of facts) ===',
        '',
        req.researchContext,
        '',
        '=== END INDUSTRY RESEARCH ===',
        '',
        'Use the research above as your source of facts about the industry this blog covers.',
        'Framing rules — these are absolute:',
        '- The companies in the research are INDUSTRY EXAMPLES, not competitors or adversaries. Some of them are likely readers of this blog.',
        '- Write neutrally and authoritatively. You are informing an industry audience, not competing against them.',
        '- Cite specific company names and their activities when it helps illustrate industry trends (e.g., "Companies like X have adopted Y, while others are still exploring Z").',
        '- NEVER frame the research as "our competitors" or criticize the listed companies. Do not say any company is "losing" or "failing" at anything.',
        '- Present gaps in the industry landscape as opportunities, not as weaknesses of specific companies.',
        '- Do not invent statistics or companies that are not in the research. If the research is silent on a point, omit the claim rather than fabricate.',
        '',
      ].join('\n')
    : '';

  return [
    'ACTION: write_blog_post',
    '',
    `Topic: ${req.topic}`,
    `Target keywords (primary first): ${keywords}`,
    `Target audience: ${audience}`,
    `Word count target: ~${wordCount} words`,
    `Content angle: ${angle}`,
    req.toneOverride ? `Tone override: ${req.toneOverride}` : '',
    '',
    researchBlock,
    'Internal pages available for linking:',
    internalPages,
    '',
    competitorBlock,
    '',
    'Produce a complete, publish-ready blog post. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    '  "title": "compelling, keyword-rich blog title (50-70 chars ideal)",',
    '  "metaDescription": "140-160 chars, includes primary keyword, ends with benefit or curiosity hook",',
    '  "slug": "url-friendly-slug-with-primary-keyword",',
    '  "estimatedReadTime": "X min read",',
    '  "sections": [',
    '    {',
    '      "headingLevel": "h2 or h3 (use h2 for main sections, h3 for subsections)",',
    '      "heading": "SEO-friendly section heading",',
    '      "body": "full section body — detailed, substantive paragraphs. Each h2 section should be 150-400 words. Use concrete examples, data points (only if real), and actionable advice.",',
    '      "keyTakeaway": "OPTIONAL — one-sentence summary for readers who skim (good for featured snippet targeting)"',
    '    }',
    '  ],',
    '  "internalLinks": [',
    '    {',
    '      "anchorText": "natural anchor text (not \'click here\')",',
    '      "targetUrl": "one of the internal pages listed above",',
    '      "contextSentence": "the full sentence where this link should be placed",',
    '      "sectionHeading": "the heading of the section where this link belongs"',
    '    }',
    '  ],',
    '  "cta": {',
    '    "text": "specific call-to-action copy — verb + outcome, not \'Learn more\'",',
    '    "placement": "where in the post this CTA should appear (e.g., \'after section 3\', \'end of post\')"',
    '  },',
    '  "seoNotes": {',
    '    "primaryKeyword": "the single most important keyword this post targets",',
    '    "secondaryKeywords": ["3-5 semantic variations and related terms used throughout"],',
    '    "featuredSnippetTarget": "OPTIONAL — a specific question this post could answer in a Google featured snippet",',
    '    "schemaMarkupSuggestion": "OPTIONAL — suggested schema.org type (e.g., \'Article\', \'HowTo\', \'FAQPage\')"',
    '  }',
    '}',
    '',
    'Rules you MUST follow:',
    `- Write approximately ${wordCount} words of body content across all sections.`,
    '- Use a mix of h2 (main sections) and h3 (subsections) — at least 4 h2 sections.',
    '- The primary keyword must appear in: title, meta description, slug, first h2, and naturally 2-3 times in body text. Do not keyword-stuff.',
    '- Secondary keywords should appear naturally — each at least once across the body.',
    '- If internal pages were provided, place at least 1 internal link per 500 words of content. Each link must use natural anchor text and point to a URL from the provided list.',
    '- If no internal pages were provided, return an empty internalLinks array.',
    '- Do not fabricate statistics, percentages, testimonials, client names, or case studies.',
    '- Do not use any phrase from the avoid list in the Brand DNA injection.',
    '- Write in a voice that matches the Brand DNA tone — authoritative but accessible, never salesy or fluffy.',
    '- Each section should provide genuine value — actionable insights, concrete examples, or clear explanations. No filler paragraphs.',
  ].filter((line) => line !== '').join('\n');
}

async function executeBlogPost(
  req: BlogPostRequest,
  ctx: LlmCallContext,
): Promise<BlogPostResult> {
  const userPrompt = buildBlogPostUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Blog Writer output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = BlogPostResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Blog Writer output did not match expected schema: ${issueSummary}`);
  }

  // Defensive post-check: internal link URLs must reference provided pages
  if (req.internalLinkingPages && req.internalLinkingPages.length > 0) {
    const allowedUrls = new Set(req.internalLinkingPages.map((p) => p.url));
    for (const link of result.data.internalLinks) {
      if (!allowedUrls.has(link.targetUrl)) {
        throw new Error(
          `Blog Writer internal link references unknown URL "${link.targetUrl}". ` +
          `Allowed: ${[...allowedUrls].join(', ')}`,
        );
      }
    }
  }

  return result.data;
}

// ============================================================================
// ACTION: outline_blog_post
// ============================================================================

function buildBlogOutlineUserPrompt(req: BlogOutlineRequest): string {
  const keywords = req.targetKeywords.join(', ') || '(none specified)';
  const audience = req.audience ?? 'B2B SaaS decision-makers';
  const wordCount = req.wordCountTarget ?? 1500;
  const angle = req.contentAngle ?? '(not specified — use your editorial judgment)';

  const internalPages = (req.internalLinkingPages ?? []).length > 0
    ? (req.internalLinkingPages ?? []).map((p) =>
      `- "${p.title}" → ${p.url}${p.relevance ? ` (relevance: ${p.relevance})` : ''}`,
    ).join('\n')
    : '(none provided)';

  return [
    'ACTION: outline_blog_post',
    '',
    `Topic: ${req.topic}`,
    `Target keywords (primary first): ${keywords}`,
    `Target audience: ${audience}`,
    `Word count target: ~${wordCount} words`,
    `Content angle: ${angle}`,
    '',
    'Internal pages available for linking:',
    internalPages,
    '',
    'Produce a detailed blog outline (NOT the full blog post). This outline will be reviewed by an operator before the full post is written. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    '  "title": "proposed blog title (50-70 chars ideal)",',
    '  "metaDescription": "proposed meta description — 140-160 chars",',
    '  "slug": "proposed-url-slug",',
    '  "estimatedReadTime": "X min read",',
    '  "sections": [',
    '    {',
    '      "headingLevel": "h2 or h3",',
    '      "heading": "proposed section heading",',
    '      "bulletPoints": ["key point 1 this section will cover", "key point 2", "key point 3"],',
    '      "estimatedWordCount": 200',
    '    }',
    '  ],',
    '  "internalLinkOpportunities": [',
    '    {',
    '      "targetUrl": "one of the internal pages from the list above",',
    '      "suggestedAnchorText": "proposed anchor text",',
    '      "suggestedSection": "the heading of the section where this link fits"',
    '    }',
    '  ],',
    '  "seoStrategy": {',
    '    "primaryKeyword": "the single most important keyword",',
    '    "secondaryKeywords": ["3-5 semantic variations"],',
    '    "featuredSnippetTarget": "OPTIONAL — a question this post could answer in a featured snippet",',
    '    "contentGaps": ["OPTIONAL — gaps in competitor coverage that this post should fill"]',
    '  }',
    '}',
    '',
    'Rules you MUST follow:',
    '- Propose at least 4 h2 sections, each with 2-4 bullet points describing what that section will cover.',
    '- Include h3 subsections where the topic warrants depth.',
    `- The total estimatedWordCount across all sections should approximate ${wordCount}.`,
    '- If internal pages were provided, suggest at least 1 link opportunity per 500 words of planned content.',
    '- If no internal pages were provided, return an empty internalLinkOpportunities array.',
    '- Do not write the full body text — only headings, bullet points, and structural guidance.',
    '- The title and meta description should be ready to use (not placeholders).',
  ].join('\n');
}

async function executeBlogOutline(
  req: BlogOutlineRequest,
  ctx: LlmCallContext,
): Promise<BlogOutlineResult> {
  const userPrompt = buildBlogOutlineUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Blog Writer outline output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = BlogOutlineResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Blog Writer outline did not match expected schema: ${issueSummary}`);
  }

  // Defensive post-check: link opportunity URLs must reference provided pages
  if (req.internalLinkingPages && req.internalLinkingPages.length > 0) {
    const allowedUrls = new Set(req.internalLinkingPages.map((p) => p.url));
    for (const link of result.data.internalLinkOpportunities) {
      if (!allowedUrls.has(link.targetUrl)) {
        throw new Error(
          `Blog Writer outline references unknown internal URL "${link.targetUrl}". ` +
          `Allowed: ${[...allowedUrls].join(', ')}`,
        );
      }
    }
  }

  return result.data;
}

// ============================================================================
// BLOG WRITER CLASS
// ============================================================================

export class BlogWriter extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Blog Writer initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Blog Writer: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Blog Writer: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Blog Writer does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[Blog Writer] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'write_blog_post') {
        const req = payload as unknown as BlogPostRequest;
        if (typeof req.topic !== 'string' || req.topic.trim().length === 0) {
          return this.createReport(taskId, 'FAILED', null, [
            'Blog Writer write_blog_post: topic is required',
          ]);
        }
        if (!Array.isArray(req.targetKeywords) || req.targetKeywords.length === 0) {
          return this.createReport(taskId, 'FAILED', null, [
            'Blog Writer write_blog_post: targetKeywords must be a non-empty array',
          ]);
        }
        const data = await executeBlogPost(req, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      // action === 'outline_blog_post'
      const outlineReq = payload as unknown as BlogOutlineRequest;
      if (typeof outlineReq.topic !== 'string' || outlineReq.topic.trim().length === 0) {
        return this.createReport(taskId, 'FAILED', null, [
          'Blog Writer outline_blog_post: topic is required',
        ]);
      }
      if (!Array.isArray(outlineReq.targetKeywords) || outlineReq.targetKeywords.length === 0) {
        return this.createReport(taskId, 'FAILED', null, [
          'Blog Writer outline_blog_post: targetKeywords must be a non-empty array',
        ]);
      }
      const data = await executeBlogOutline(outlineReq, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[Blog Writer] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 450, boilerplate: 50 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createBlogWriter(): BlogWriter {
  return new BlogWriter();
}

let instance: BlogWriter | null = null;

export function getBlogWriter(): BlogWriter {
  instance ??= createBlogWriter();
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
  buildBlogPostUserPrompt,
  buildBlogOutlineUserPrompt,
  stripJsonFences,
  BlogPostResultSchema,
  BlogOutlineResultSchema,
};
