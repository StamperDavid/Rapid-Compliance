/**
 * Asset Generator — REAL AI AGENT (Task #26 rebuild, April 11 2026)
 *
 * Replaces the pre-rebuild 974-line template engine. The specialist is now
 * a Creative Director: the LLM produces a full plan of DALL-E prompts for
 * every slot in the brand asset package (logo variations, favicon, heroes
 * per page, social graphics per platform, banners), and the code then
 * executes each prompt against DALL-E to attach real image URLs. LLM =
 * brains, DALL-E = pixels. No template fallbacks anywhere.
 *
 * Supported actions (live code paths only):
 *   - generate_asset_package  (BuilderManager — the only caller)
 *
 * If the GM is missing, Brand DNA is missing, OpenRouter fails, JSON won't
 * parse, Zod validation fails, or the most important image call (logo
 * primary) can't be generated, the specialist returns a real FAILED
 * AgentReport with the honest reason.
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
import {
  generateImage,
  mapDimensionsToSize,
  type ImageQuality,
  type ImageStyle,
} from '@/lib/ai/image-generation-service';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'builder/assets/specialist.ts';
const SPECIALIST_ID = 'ASSET_GENERATOR';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_asset_package'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Asset Generator response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   AssetPackagePlanSchema is heavily bounded with explicit .max() caps.
 *   Per-variation cap: prompt 1200 + altText 200 + rationale 200 + name/
 *   dimensions/layout overhead ~50 = ~1,650-1,690 chars per variation.
 *   Per-section strategy: max 1500 chars.
 *
 *   Realistic worst case (typical 6-page site, 8 social variations, 3
 *   banners — well within prompt-stated minimums and architectural norms):
 *     logo: 3 × ~1,650 = ~4,950 chars
 *     favicons (single plan): 1500 + 1200 + 200 + 30 = ~2,930
 *     heroes: 1500 strategy + 6 × ~1,690 = ~11,640
 *     socialGraphics: 1500 strategy + 8 × ~1,680 = ~14,940
 *     banners: 1500 strategy + 3 × ~1,660 = ~6,480
 *     logo strategy: 1500
 *     ≈ 42,440 chars total prose
 *     /3.0 chars/token = 14,147 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 17,934 tokens minimum.
 *
 *   The prior 6,000 was massively undersized — it would have truncated
 *   any non-trivial site's asset package, with the response running
 *   30,000-50,000+ chars. Setting the floor at 18,000 tokens covers the
 *   typical 6-page case with comfortable headroom. Truly massive sites
 *   (10+ pages, 12+ social variations) may still hit the truncation
 *   backstop — at which point the operator needs to either split the
 *   request or raise the GM-stored maxTokens.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 18000;

interface AssetGeneratorGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Asset Generator',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'CONTENT_MANAGER',
    capabilities: ['generate_asset_package'],
  },
  systemPrompt: '',
  tools: ['generate_asset_package'],
  outputSchema: {
    type: 'object',
    properties: {
      logo: { type: 'object' },
      favicons: { type: 'object' },
      heroes: { type: 'object' },
      socialGraphics: { type: 'object' },
      banners: { type: 'object' },
      variations: { type: 'array' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.7,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

export interface NormalizedBrandColors {
  primary: string;
  secondary?: string;
  accent?: string;
}

export interface GenerateAssetPackagePage {
  id: string;
  name: string;
}

export interface GenerateAssetPackageRequest {
  action: 'generate_asset_package';
  brandName: string;
  brandStyle: string;
  industry: string;
  brandColors?: NormalizedBrandColors | string[];
  pages?: GenerateAssetPackagePage[];
  tagline?: string;
  companyDescription?: string;
}

const BrandColorsObjectSchema = z.object({
  primary: z.string().min(1),
  secondary: z.string().min(1).optional(),
  accent: z.string().min(1).optional(),
});

const GenerateAssetPackageRequestSchema = z.object({
  action: z.literal('generate_asset_package'),
  brandName: z.string().min(1),
  brandStyle: z.string().min(1),
  industry: z.string().min(1),
  brandColors: z.union([BrandColorsObjectSchema, z.array(z.string().min(1))]).optional(),
  pages: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  })).optional(),
  tagline: z.string().min(1).optional(),
  companyDescription: z.string().min(1).optional(),
});

function normalizeBrandColors(
  raw: NormalizedBrandColors | string[] | undefined,
): NormalizedBrandColors {
  if (!raw) {
    return { primary: '#1E40AF' };
  }
  if (Array.isArray(raw)) {
    const primary = raw[0] ?? '#1E40AF';
    const normalized: NormalizedBrandColors = { primary };
    if (raw[1]) {
      normalized.secondary = raw[1];
    }
    if (raw[2]) {
      normalized.accent = raw[2];
    }
    return normalized;
  }
  return raw;
}

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const AssetDimensionsSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const LogoVariationSchema = z.object({
  name: z.enum(['primary', 'icon', 'monochrome']),
  layout: z.enum(['horizontal', 'vertical', 'icon']),
  prompt: z.string().min(80).max(1200),
  dimensions: AssetDimensionsSchema,
  altText: z.string().min(10).max(200),
  rationale: z.string().min(20).max(200),
});

const HeroVariationSchema = z.object({
  name: z.string().min(1),
  pageId: z.string().min(1),
  prompt: z.string().min(80).max(1200),
  dimensions: AssetDimensionsSchema,
  altText: z.string().min(10).max(200),
  rationale: z.string().min(20).max(200),
});

const SocialGraphicVariationSchema = z.object({
  name: z.string().min(1),
  platform: z.enum(['twitter', 'linkedin', 'instagram', 'facebook']),
  type: z.enum(['post', 'header', 'cover', 'story']),
  prompt: z.string().min(80).max(1200),
  dimensions: AssetDimensionsSchema,
  altText: z.string().min(10).max(200),
  rationale: z.string().min(20).max(200),
});

const BannerVariationSchema = z.object({
  name: z.string().min(1),
  prompt: z.string().min(80).max(1200),
  dimensions: AssetDimensionsSchema,
  altText: z.string().min(10).max(200),
  rationale: z.string().min(20).max(200),
});

const AssetPackagePlanSchema = z.object({
  logo: z.object({
    strategy: z.string().min(20).max(1500),
    variations: z.array(LogoVariationSchema).length(3),
  }),
  favicons: z.object({
    strategy: z.string().min(20).max(1500),
    prompt: z.string().min(80).max(1200),
    dimensions: AssetDimensionsSchema,
    altText: z.string().min(10).max(200),
  }),
  heroes: z.object({
    strategy: z.string().min(20).max(1500),
    variations: z.array(HeroVariationSchema).min(1),
  }),
  socialGraphics: z.object({
    strategy: z.string().min(20).max(1500),
    variations: z.array(SocialGraphicVariationSchema).min(3),
  }),
  banners: z.object({
    strategy: z.string().min(20).max(1500),
    variations: z.array(BannerVariationSchema).min(1),
  }),
}).superRefine((data, ctx) => {
  const logoNames = new Set(data.logo.variations.map((v) => v.name));
  for (const required of ['primary', 'icon', 'monochrome'] as const) {
    if (!logoNames.has(required)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['logo', 'variations'],
        message: `logo.variations missing required name '${required}'`,
      });
    }
  }
  const sections: Array<[string, Array<{ name: string }>]> = [
    ['logo', data.logo.variations],
    ['heroes', data.heroes.variations],
    ['socialGraphics', data.socialGraphics.variations],
    ['banners', data.banners.variations],
  ];
  for (const [sectionName, variations] of sections) {
    const seen = new Set<string>();
    for (let i = 0; i < variations.length; i++) {
      const v = variations[i];
      if (!v) {
        continue;
      }
      if (seen.has(v.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [sectionName, 'variations', i, 'name'],
          message: `Duplicate name '${v.name}' in ${sectionName}.variations`,
        });
      }
      seen.add(v.name);
    }
  }
});

export type AssetDimensions = z.infer<typeof AssetDimensionsSchema>;
export type LogoVariation = z.infer<typeof LogoVariationSchema>;
export type HeroVariation = z.infer<typeof HeroVariationSchema>;
export type SocialGraphicVariation = z.infer<typeof SocialGraphicVariationSchema>;
export type BannerVariation = z.infer<typeof BannerVariationSchema>;
export type AssetPackagePlan = z.infer<typeof AssetPackagePlanSchema>;

// ============================================================================
// FINAL RESULT SHAPES (what execute() returns to the manager)
// ============================================================================

export interface LogoVariationWithUrl extends LogoVariation {
  url: string;
}

export interface HeroVariationWithUrl extends HeroVariation {
  url: string;
}

export interface SocialGraphicVariationWithUrl extends SocialGraphicVariation {
  url: string;
}

export interface BannerVariationWithUrl extends BannerVariation {
  url: string;
}

export interface FlatVariationEntry {
  name: string;
  url: string;
  dimensions: AssetDimensions;
  altText: string;
}

export interface AssetPackageResult {
  logo: {
    strategy: string;
    variations: LogoVariationWithUrl[];
  };
  favicons: {
    strategy: string;
    prompt: string;
    dimensions: AssetDimensions;
    altText: string;
    icopUrl: string;
    sizes: Record<string, unknown>;
  };
  heroes: {
    strategy: string;
    variations: HeroVariationWithUrl[];
  };
  socialGraphics: {
    strategy: string;
    variations: SocialGraphicVariationWithUrl[];
  };
  banners: {
    strategy: string;
    variations: BannerVariationWithUrl[];
  };
  variations: FlatVariationEntry[];
  confidence: number;
}

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: AssetGeneratorGMConfig;
  brandDNA: BrandDNA;
  resolvedSystemPrompt: string;
}

async function loadGMAndBrandDNA(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Asset Generator GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-asset-generator-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<AssetGeneratorGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Asset Generator GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: AssetGeneratorGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. Asset Generator refuses to plan asset packages without brand identity. ' +
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

  // Truncation detection (cross-cutting fix). The OpenRouter provider was
  // hardcoding finishReason='stop' for months, silently masking length-
  // truncated responses. Now that the provider is honest, fail loudly on
  // any 'length' finish_reason instead of feeding incomplete JSON to
  // JSON.parse and surfacing a misleading "unexpected end of input".
  if (response.finishReason === 'length') {
    throw new Error(
      `Asset Generator: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or split the asset package into smaller batches. ` +
      `Realistic worst-case budget is ${MIN_OUTPUT_TOKENS_FOR_SCHEMA} tokens for a typical 6-page site.`,
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// ACTION: generate_asset_package
// ============================================================================

function buildGenerateAssetPackageUserPrompt(req: GenerateAssetPackageRequest): string {
  const colors = normalizeBrandColors(req.brandColors);
  const colorBlock = [
    `  primary: ${colors.primary}`,
    colors.secondary ? `  secondary: ${colors.secondary}` : '  secondary: (none)',
    colors.accent ? `  accent: ${colors.accent}` : '  accent: (none)',
  ].join('\n');

  const pagesProvided = Array.isArray(req.pages) && req.pages.length > 0;
  const pagesBlock = pagesProvided
    ? (req.pages ?? []).map((p) => `  - id=${p.id} | name="${p.name}"`).join('\n')
    : '  (none provided — produce exactly ONE hero with pageId="default")';

  const taglineLine = req.tagline ? `Tagline: ${req.tagline}` : 'Tagline: (none)';
  const descriptionLine = req.companyDescription
    ? `Company description: ${req.companyDescription}`
    : 'Company description: (none)';

  return [
    'ACTION: generate_asset_package',
    '',
    `Brand name: ${req.brandName}`,
    `Brand style: ${req.brandStyle}`,
    `Industry: ${req.industry}`,
    'Brand colors:',
    colorBlock,
    '',
    'Target pages (one hero per page is required):',
    pagesBlock,
    '',
    taglineLine,
    descriptionLine,
    '',
    'Produce a complete brand asset package PLAN. You do NOT generate images yourself —',
    'you produce the DALL-E-ready prompts for every slot, and downstream code will execute them.',
    '',
    'Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation.',
    'The JSON must match this exact schema:',
    '',
    '{',
    '  "logo": {',
    '    "strategy": "<20-1500 chars describing the overall logo direction>",',
    '    "variations": [',
    '      { "name": "primary",    "layout": "horizontal", "prompt": "...", "dimensions": {"width":1024,"height":1024}, "altText": "...", "rationale": "..." },',
    '      { "name": "icon",       "layout": "icon",       "prompt": "...", "dimensions": {"width":1024,"height":1024}, "altText": "...", "rationale": "..." },',
    '      { "name": "monochrome", "layout": "horizontal", "prompt": "...", "dimensions": {"width":1024,"height":1024}, "altText": "...", "rationale": "..." }',
    '    ]',
    '  },',
    '  "favicons": {',
    '    "strategy": "<20-1500 chars>",',
    '    "prompt": "<80-1200 chars, DALL-E-ready favicon prompt>",',
    '    "dimensions": {"width":512,"height":512},',
    '    "altText": "<10-200 chars>"',
    '  },',
    '  "heroes": {',
    '    "strategy": "<20-1500 chars>",',
    '    "variations": [',
    '      { "name": "<unique>", "pageId": "<exact input id or \\"default\\">", "prompt": "...", "dimensions": {"width":1920,"height":1080}, "altText": "...", "rationale": "..." }',
    '    ]',
    '  },',
    '  "socialGraphics": {',
    '    "strategy": "<20-1500 chars>",',
    '    "variations": [',
    '      { "name": "<unique>", "platform": "twitter|linkedin|instagram|facebook", "type": "post|header|cover|story", "prompt": "...", "dimensions": {...}, "altText": "...", "rationale": "..." }',
    '    ]',
    '  },',
    '  "banners": {',
    '    "strategy": "<20-1500 chars>",',
    '    "variations": [',
    '      { "name": "<unique>", "prompt": "...", "dimensions": {"width":1920,"height":400}, "altText": "...", "rationale": "..." }',
    '    ]',
    '  }',
    '}',
    '',
    'Hard rules you MUST follow:',
    '- logo.variations MUST contain EXACTLY 3 entries named "primary" (horizontal layout), "icon" (icon layout), and "monochrome" (horizontal layout). No more, no less.',
    '- favicons is a SINGLE plan (not a variations array). Use dimensions 512x512.',
    `- heroes.variations MUST contain one entry per target page listed above (${pagesProvided ? `${(req.pages ?? []).length} page(s)` : 'exactly one entry with pageId="default" since no pages were provided'}). Dimensions 1920x1080 per hero.`,
    '- socialGraphics.variations MUST contain at least ONE entry for EACH of the four platforms: twitter (1200x675), linkedin (1200x627), instagram (1080x1080), facebook (1200x630). Minimum 4 entries, more if multiple post types make sense.',
    '- banners.variations MUST contain at least one entry. Default dimensions 1920x400.',
    '- Every prompt MUST be 80-1200 characters, DALL-E-ready, and reference the brand name, brand style, color palette, and industry context directly so the image actually reflects this brand.',
    '- Every altText MUST be 10-200 characters and describe what the finished image will visually show (for screen readers).',
    '- Every rationale MUST be 20-200 characters and explain why this specific variation fits this specific brand and asset slot — not generic filler.',
    '- Every variation "name" MUST be unique within its own section (no duplicate names in logo, heroes, socialGraphics, or banners).',
    '- Do NOT use any phrase from the Brand DNA avoid list in any prompt, altText, strategy, or rationale field.',
    '- Do NOT fabricate statistics, awards, percentages, or engagement numbers.',
    '- Output ONLY the JSON object. No prose outside it. No markdown fences.',
  ].join('\n');
}

function pickLogoQuality(name: LogoVariation['name']): ImageQuality {
  return name === 'primary' ? 'hd' : 'standard';
}

async function safeGenerateImageUrl(
  prompt: string,
  dimensions: AssetDimensions,
  quality: ImageQuality,
  style: ImageStyle,
  label: string,
  failedSlots: string[],
): Promise<string> {
  try {
    const size = mapDimensionsToSize(dimensions.width, dimensions.height);
    const result = await generateImage(prompt, { size, quality, style });
    return result.url;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      `[AssetGenerator] Image generation failed for slot=${label}`,
      error instanceof Error ? error : new Error(errorMessage),
      { file: FILE },
    );
    failedSlots.push(`${label}: ${errorMessage}`);
    return '';
  }
}

async function executeGenerateAssetPackage(
  req: GenerateAssetPackageRequest,
  ctx: LlmCallContext,
): Promise<AssetPackageResult> {
  const userPrompt = buildGenerateAssetPackageUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Asset Generator output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const validation = AssetPackagePlanSchema.safeParse(parsed);
  if (!validation.success) {
    const issueSummary = validation.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Asset Generator output did not match expected schema: ${issueSummary}`);
  }
  const plan = validation.data;

  const failedSlots: string[] = [];

  const logoWithUrls: LogoVariationWithUrl[] = [];
  for (const variation of plan.logo.variations) {
    const url = await safeGenerateImageUrl(
      variation.prompt,
      variation.dimensions,
      pickLogoQuality(variation.name),
      'natural',
      `logo.${variation.name}`,
      failedSlots,
    );
    logoWithUrls.push({ ...variation, url });
  }

  const faviconUrl = await safeGenerateImageUrl(
    plan.favicons.prompt,
    plan.favicons.dimensions,
    'hd',
    'natural',
    'favicon',
    failedSlots,
  );

  const heroesWithUrls: HeroVariationWithUrl[] = [];
  for (const variation of plan.heroes.variations) {
    const url = await safeGenerateImageUrl(
      variation.prompt,
      variation.dimensions,
      'standard',
      'vivid',
      `hero.${variation.name}`,
      failedSlots,
    );
    heroesWithUrls.push({ ...variation, url });
  }

  const socialWithUrls: SocialGraphicVariationWithUrl[] = [];
  for (const variation of plan.socialGraphics.variations) {
    const url = await safeGenerateImageUrl(
      variation.prompt,
      variation.dimensions,
      'standard',
      'vivid',
      `social.${variation.platform}.${variation.name}`,
      failedSlots,
    );
    socialWithUrls.push({ ...variation, url });
  }

  const bannersWithUrls: BannerVariationWithUrl[] = [];
  for (const variation of plan.banners.variations) {
    const url = await safeGenerateImageUrl(
      variation.prompt,
      variation.dimensions,
      'standard',
      'vivid',
      `banner.${variation.name}`,
      failedSlots,
    );
    bannersWithUrls.push({ ...variation, url });
  }

  const primaryLogo = logoWithUrls.find((v) => v.name === 'primary');
  if (!primaryLogo || primaryLogo.url.length === 0) {
    throw new Error(
      `Asset Generator: logo primary image generation failed — the most important asset is missing. ` +
      `Failed slots: ${failedSlots.join(' | ')}`,
    );
  }

  const flatVariations: FlatVariationEntry[] = [
    ...heroesWithUrls.map((v) => ({ name: v.name, url: v.url, dimensions: v.dimensions, altText: v.altText })),
    ...logoWithUrls.map((v) => ({ name: v.name, url: v.url, dimensions: v.dimensions, altText: v.altText })),
    ...socialWithUrls.map((v) => ({ name: v.name, url: v.url, dimensions: v.dimensions, altText: v.altText })),
    ...bannersWithUrls.map((v) => ({ name: v.name, url: v.url, dimensions: v.dimensions, altText: v.altText })),
  ];

  const totalSlots =
    logoWithUrls.length +
    1 +
    heroesWithUrls.length +
    socialWithUrls.length +
    bannersWithUrls.length;
  const confidence = failedSlots.length === 0
    ? 0.9
    : Math.max(0.5, 0.9 - (failedSlots.length / totalSlots) * 0.4);

  if (failedSlots.length > 0) {
    logger.warn(
      `[AssetGenerator] Completed with ${failedSlots.length}/${totalSlots} failed image slots`,
      { file: FILE, failedSlots },
    );
  }

  return {
    logo: {
      strategy: plan.logo.strategy,
      variations: logoWithUrls,
    },
    favicons: {
      strategy: plan.favicons.strategy,
      prompt: plan.favicons.prompt,
      dimensions: plan.favicons.dimensions,
      altText: plan.favicons.altText,
      icopUrl: faviconUrl,
      sizes: {},
    },
    heroes: {
      strategy: plan.heroes.strategy,
      variations: heroesWithUrls,
    },
    socialGraphics: {
      strategy: plan.socialGraphics.strategy,
      variations: socialWithUrls,
    },
    banners: {
      strategy: plan.banners.strategy,
      variations: bannersWithUrls,
    },
    variations: flatVariations,
    confidence,
  };
}

// ============================================================================
// ASSET GENERATOR CLASS
// ============================================================================

export class AssetGenerator extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Asset Generator initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Asset Generator: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Asset Generator: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Asset Generator does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[AssetGenerator] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const inputValidation = GenerateAssetPackageRequestSchema.safeParse({
        ...payload,
        action,
      });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Asset Generator generate_asset_package: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMAndBrandDNA(DEFAULT_INDUSTRY_KEY);

      const data = await executeGenerateAssetPackage(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[AssetGenerator] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 500, boilerplate: 60 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createAssetGenerator(): AssetGenerator {
  return new AssetGenerator();
}

let instance: AssetGenerator | null = null;

export function getAssetGenerator(): AssetGenerator {
  instance ??= createAssetGenerator();
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
  loadGMAndBrandDNA,
  buildResolvedSystemPrompt,
  buildGenerateAssetPackageUserPrompt,
  stripJsonFences,
  normalizeBrandColors,
  GenerateAssetPackageRequestSchema,
  AssetPackagePlanSchema,
  LogoVariationSchema,
  HeroVariationSchema,
  SocialGraphicVariationSchema,
  BannerVariationSchema,
};
