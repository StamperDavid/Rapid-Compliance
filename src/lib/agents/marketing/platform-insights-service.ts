/**
 * Platform Insights Service — generates per-platform AI guidance for the
 * operator-facing PlatformDashboard.
 *
 * Loads the platform specialist's active Golden Master (Brand DNA already
 * baked in per Standing Rule #1) and asks the LLM for three things grounded
 * in the brand voice + niche:
 *
 *   1. optimalPostingTimes — when this brand's audience is most likely
 *      online / engaging for the platform.
 *   2. trendingTopics      — 3-5 topics currently relevant to the brand's
 *                            niche on this platform.
 *   3. suggestedContent    — 3-5 specific post ideas the operator can
 *                            queue today.
 *
 * Read-only — never mutates GM, never writes feedback (Standing Rule #2).
 */

import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ModelName } from '@/types/ai-models';
import type { SocialPlatform } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';

const FILE = 'agents/marketing/platform-insights-service.ts';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const INSIGHTS_MAX_TOKENS = 3200;

// Field caps are deliberately generous — Zod is here to enforce structural
// shape (every required key present, arrays the right kind), not to police
// the model's prose length. A creative specialist with detailed Brand DNA
// can easily produce 1500+ chars of audience analysis; let it.
const OptimalPostingTimeSchema = z.object({
  dayOfWeek: z.string().min(1).max(120),
  timeWindow: z.string().min(1).max(160),
  reasoning: z.string().min(10).max(1500),
});

const TrendingTopicSchema = z.object({
  topic: z.string().min(1).max(300),
  whyItMatters: z.string().min(10).max(1200),
  angleForBrand: z.string().min(10).max(1200),
});

const SuggestedContentSchema = z.object({
  hook: z.string().min(1).max(400),
  body: z.string().min(10).max(2000),
  format: z.string().min(1).max(200),
  bestPostedAt: z.string().min(1).max(300),
});

// Generous caps — Zod validates structure, not prose length (see rationale
// in the banner comment at the top of the file). Arrays start at min(0) so
// the model can legitimately return an empty list for platforms where that
// field isn't relevant (e.g. hashtags for Google Business).
const TrendingTagSchema = z.object({
  tag: z.string().min(1).max(200),
  whyRelevant: z.string().min(1).max(600),
});

const DiscoverySeoSchema = z.object({
  /** 3-7 hashtags ready to copy into the post. Empty array OK for platforms that don't use them. */
  recommendedHashtags: z.array(z.string().min(1).max(200)).min(0).max(10),
  /** 0-5 trending-right-now tags worth riding if relevant. */
  trendingTags: z.array(TrendingTagSchema).min(0).max(5),
  /** 3-7 SEO keyword phrases to weave into body copy. */
  keywords: z.array(z.string().min(1).max(200)).min(0).max(10),
  /**
   * Free-form per-platform extras, keyed by a short descriptor.
   * Examples:
   *   { altTextGuidance: "...", videoTags: "...", boardCategory: "...", soundSuggestion: "..." }
   * Values are capped at 400 chars each to keep the model honest.
   */
  platformSpecific: z.record(z.string().min(1).max(400)),
});

const PlatformInsightsResultSchema = z.object({
  optimalPostingTimes: z.array(OptimalPostingTimeSchema).min(1).max(5),
  trendingTopics: z.array(TrendingTopicSchema).min(1).max(5),
  suggestedContent: z.array(SuggestedContentSchema).min(1).max(5),
  audienceNotes: z.string().min(20).max(3000),
  discoverySeo: DiscoverySeoSchema,
});

export type PlatformInsightsResult = z.infer<typeof PlatformInsightsResultSchema>;

interface GMConfigShape {
  systemPrompt?: string;
  model?: ModelName;
  temperature?: number;
  maxTokens?: number;
}

interface GeneratePlatformInsightsInput {
  specialistId: string;
  platform: SocialPlatform;
  industryKey?: string;
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (match) => (match.includes('```') ? '' : match))
    .replace(/\n?\s*```[\s\S]*$/i, '')
    .trim();
}

/** Per-platform instructions for the discoverySeo field. */
function buildDiscoverySeoInstructions(platform: SocialPlatform): string {
  // Which guidance to include depends on the platform's discovery mechanics.
  const hashtagPlatforms = new Set<SocialPlatform>([
    'twitter', 'bluesky', 'mastodon', 'linkedin', 'threads',
    'instagram', 'tiktok', 'pinterest',
  ]);
  const keywordPlatforms = new Set<SocialPlatform>([
    'linkedin', 'youtube', 'pinterest', 'google_business',
  ]);

  const useHashtags = hashtagPlatforms.has(platform);
  const useKeywords = keywordPlatforms.has(platform);

  // platformSpecific extras depend on the platform type.
  const platformSpecificNotes: string[] = [];
  if (platform === 'instagram' || platform === 'bluesky') {
    platformSpecificNotes.push('altTextGuidance: accessibility + SEO alt-text recommendation for the primary image attached to this type of post');
  }
  if (platform === 'youtube' || platform === 'tiktok') {
    platformSpecificNotes.push('videoTags: comma-separated video tags / search tags to add in the upload form');
  }
  if (platform === 'tiktok') {
    platformSpecificNotes.push('soundSuggestion: a trending audio clip or category that fits this brand right now');
  }
  if (platform === 'pinterest') {
    platformSpecificNotes.push('boardCategory: the Pinterest board category this brand should target (e.g. "Business & Finance", "Education")');
  }
  if (platform === 'youtube') {
    platformSpecificNotes.push('chapterGuidance: guidance on chapter-marker structure for a typical video in this niche');
  }
  if (platform === 'google_business') {
    platformSpecificNotes.push('callToActionType: recommended GBP CTA button type for this post (e.g. "Learn more", "Call now", "Book")');
  }

  const lines: string[] = [
    `  discoverySeo: an object with exactly these four keys:`,
    `    - recommendedHashtags: ${useHashtags ? `array of 3-7 hashtags (include the # prefix) tuned for this brand's niche on ${PLATFORM_META[platform].label}` : `empty array [] — ${PLATFORM_META[platform].label} does not use hashtags for discovery`}`,
    `    - trendingTags: array of 0-5 objects, each { "tag": "#name", "whyRelevant": "..." }. Include only tags that are genuinely trending right now in the brand's niche. Empty array if nothing relevant.`,
    `    - keywords: ${useKeywords ? `array of 3-7 SEO keyword phrases (no # prefix) that should appear naturally in the post copy to aid search on ${PLATFORM_META[platform].label}` : `array of 2-5 key phrases that help this brand's content get surfaced algorithmically on ${PLATFORM_META[platform].label}, even if the platform isn't classically SEO-driven`}`,
    `    - platformSpecific: object with per-platform metadata. Include ONLY the keys listed below that are relevant; omit keys where you have no brand-specific guidance:`,
  ];

  if (platformSpecificNotes.length > 0) {
    platformSpecificNotes.forEach((note) => lines.push(`        ${note}`));
  } else {
    lines.push(`        (no platform-specific extras for ${PLATFORM_META[platform].label} — return an empty object {})`);
  }

  return lines.join('\n');
}

function buildInsightsUserPrompt(platform: SocialPlatform): string {
  const platformLabel = PLATFORM_META[platform].label;
  return [
    `ACTION: get_platform_insights`,
    ``,
    `Platform: ${platformLabel}`,
    ``,
    `You are this brand's specialist for ${platformLabel}. Your Brand DNA, voice, audience, and niche are already established in your system prompt — ground every recommendation in them. Do not invent generic best-practice advice; tailor everything to the specific brand and audience above.`,
    ``,
    `Produce a JSON object with the following keys:`,
    ``,
    `  optimalPostingTimes: 1-3 entries. For each:`,
    `    - dayOfWeek: e.g. "Tuesday" or "Tue-Thu"`,
    `    - timeWindow: e.g. "9-11am ET" or "evening (6-9pm ET)"`,
    `    - reasoning: WHY this window works for THIS brand's audience on ${platformLabel}`,
    ``,
    `  trendingTopics: 3-5 entries. For each:`,
    `    - topic: a current/recurring topic in the brand's niche on ${platformLabel}`,
    `    - whyItMatters: relevance to the brand's audience right now`,
    `    - angleForBrand: how THIS brand specifically should weigh in (its differentiated voice/POV)`,
    ``,
    `  suggestedContent: 3-5 entries. Each is a concrete post idea ready to queue:`,
    `    - hook: opening line / scroll-stopper, in the brand's exact voice`,
    `    - body: the post copy or scaffold (respect ${platformLabel}'s norms — char limit, format, tone)`,
    `    - format: e.g. "single-image post", "thread", "short-form video", "carousel"`,
    `    - bestPostedAt: which posting window from above this is best for`,
    ``,
    `  audienceNotes: 1 short paragraph. Who specifically engages with this brand on ${platformLabel}, and how that should shape today's content.`,
    ``,
    buildDiscoverySeoInstructions(platform),
    ``,
    `Return ONLY the JSON object — no markdown fences, no commentary.`,
  ].join('\n');
}

/**
 * Generate platform-specific insights for the operator. Loads the
 * specialist's active GM, calls the LLM with the GM's systemPrompt, parses
 * structured JSON, validates against the Zod schema, returns it.
 *
 * Throws if:
 *   - the GM is not seeded for the industry/specialist combination
 *   - the LLM returns malformed or schema-invalid JSON
 *   - the model truncates the response (insufficient max_tokens)
 */
export async function generatePlatformInsights(
  input: GeneratePlatformInsightsInput,
): Promise<PlatformInsightsResult> {
  const industryKey = input.industryKey ?? DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(input.specialistId, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Platform insights: no active GM for specialist '${input.specialistId}' in industry '${industryKey}'. ` +
      `Seed the specialist (scripts/seed-${input.specialistId.toLowerCase()}-gm.ts) before requesting insights.`,
    );
  }

  const config = (gmRecord.config ?? {}) as GMConfigShape;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Platform insights: specialist '${input.specialistId}' GM ${gmRecord.id} has no usable systemPrompt.`,
    );
  }

  const model: ModelName = config.model ?? 'claude-sonnet-4.6';
  const temperature = config.temperature ?? 0.6;
  const maxTokens = Math.max(config.maxTokens ?? INSIGHTS_MAX_TOKENS, INSIGHTS_MAX_TOKENS);
  const userPrompt = buildInsightsUserPrompt(input.platform);

  const provider = new OpenRouterProvider(PLATFORM_ID);
  const response = await provider.chat({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    maxTokens,
  });

  if (response.finishReason === 'length') {
    throw new Error(
      `Platform insights: response truncated at maxTokens=${maxTokens}. Raise the budget or shorten the request.`,
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('Platform insights: OpenRouter returned empty response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch (err) {
    logger.error(
      'Platform insights: failed to parse JSON',
      err instanceof Error ? err : new Error(String(err)),
      { file: FILE, specialistId: input.specialistId, platform: input.platform },
    );
    throw new Error('Platform insights: model returned invalid JSON');
  }

  const validated = PlatformInsightsResultSchema.safeParse(parsed);
  if (!validated.success) {
    logger.warn('Platform insights: schema validation failed', {
      file: FILE,
      specialistId: input.specialistId,
      platform: input.platform,
      issues: JSON.stringify(validated.error.flatten()),
    });
    throw new Error('Platform insights: model output failed schema validation');
  }

  return validated.data;
}
