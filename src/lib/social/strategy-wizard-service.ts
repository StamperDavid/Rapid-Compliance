/**
 * Social Strategy Wizard Service
 *
 * The "describe your business → full cross-platform strategy + a filled content
 * queue" magic moment. This service is a pure ASSEMBLY of existing pieces — it
 * does NOT contain its own LLM or any hardcoded strategy/posts:
 *
 *   - Cross-platform strategy + per-platform DRAFTS come from the real
 *     per-platform specialists via `generatePlatformInsights`
 *     (src/lib/agents/marketing/platform-insights-service.ts). Each specialist's
 *     Golden Master has Brand DNA baked in (Standing Rule #1), so every draft is
 *     in the brand's voice with no runtime Brand DNA merging here.
 *   - Platform availability (live vs coming-soon) is read from the single source
 *     of truth in `_platform-state.ts`.
 *
 * The wizard NEVER posts. It returns a plan of drafts the operator reviews; only
 * the drafts the operator keeps are written to the evergreen `social_queue` via
 * `addToQueue` (a separate, opt-in/rate-limited step).
 */

import { logger } from '@/lib/logger/logger';
import {
  generatePlatformInsights,
  type InsightsBriefContext,
} from '@/lib/agents/marketing/platform-insights-service';
import { getPlatformConfig } from '@/components/social/_platform-state';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { SocialPlatform } from '@/types/social';

const FILE = 'social/strategy-wizard-service.ts';

/** Platforms that are connectable + postable today (everything else is draft-only). */
const LIVE_STATES = new Set(['live_full', 'live_dm_blocked', 'live_no_dm']);

// ─── Public shapes ────────────────────────────────────────────────────────────

export interface StrategyWizardInput {
  businessDescription: string;
  goals?: string[];
  /** Platforms to draft for. Defaults to the live platforms when omitted. */
  platforms?: SocialPlatform[];
  /** Drafts to produce per platform (clamped 1-5). Defaults to 4. */
  postsPerPlatform?: number;
}

export interface WizardDraft {
  platform: SocialPlatform;
  platformLabel: string;
  /** Post copy (hook + body). Hashtags are kept separate so the queue can
   *  append them per its own settings. */
  content: string;
  suggestedTime?: string;
  hashtags: string[];
  rationale?: string;
  /** True when the platform can post today; false = draft now, posts when connected. */
  live: boolean;
}

export interface WizardPlatformStrategy {
  platform: SocialPlatform;
  platformLabel: string;
  specialistId: string;
  specialistName: string | null;
  live: boolean;
  audienceNotes: string;
  optimalPostingTimes: Array<{ dayOfWeek: string; timeWindow: string; reasoning: string }>;
  trendingTopics: Array<{ topic: string; whyItMatters: string; angleForBrand: string }>;
}

export interface WizardSkippedPlatform {
  platform: SocialPlatform;
  platformLabel: string;
  reason: string;
}

export interface StrategyWizardPlan {
  businessDescription: string;
  goals: string[];
  generatedAt: string;
  postsPerPlatform: number;
  strategy: {
    platforms: WizardPlatformStrategy[];
    skipped: WizardSkippedPlatform[];
  };
  drafts: WizardDraft[];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

/** Platforms postable today — the honest default when the operator picks none. */
export function getLivePlatforms(): SocialPlatform[] {
  return (Object.keys(PLATFORM_META) as SocialPlatform[]).filter((p) =>
    LIVE_STATES.has(getPlatformConfig(p).state),
  );
}

// ─── Core ─────────────────────────────────────────────────────────────────────

interface PlatformResult {
  strategy?: WizardPlatformStrategy;
  drafts: WizardDraft[];
  skipped?: WizardSkippedPlatform;
}

async function buildForPlatform(
  platform: SocialPlatform,
  briefContext: InsightsBriefContext,
): Promise<PlatformResult> {
  const label = PLATFORM_META[platform].label;
  const config = getPlatformConfig(platform);

  if (!config.specialistId) {
    return {
      drafts: [],
      skipped: {
        platform,
        platformLabel: label,
        reason: `No AI specialist exists for ${label} yet — nothing to draft.`,
      },
    };
  }

  if (config.state === 'parked') {
    return {
      drafts: [],
      skipped: {
        platform,
        platformLabel: label,
        reason: `${label} is parked, so drafting is disabled.`,
      },
    };
  }

  const live = LIVE_STATES.has(config.state);

  try {
    const insights = await generatePlatformInsights({
      specialistId: config.specialistId,
      platform,
      briefContext,
    });

    const strategy: WizardPlatformStrategy = {
      platform,
      platformLabel: label,
      specialistId: config.specialistId,
      specialistName: config.specialistName,
      live,
      audienceNotes: insights.audienceNotes,
      optimalPostingTimes: insights.optimalPostingTimes,
      trendingTopics: insights.trendingTopics,
    };

    const hashtags = insights.discoverySeo.recommendedHashtags;
    const drafts: WizardDraft[] = insights.suggestedContent.map((post) => ({
      platform,
      platformLabel: label,
      content: `${post.hook}\n\n${post.body}`.trim(),
      suggestedTime: post.bestPostedAt,
      hashtags,
      rationale: `Format: ${post.format}. Best posted: ${post.bestPostedAt}.`,
      live,
    }));

    return { strategy, drafts };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Specialist failed to respond';
    logger.warn('StrategyWizard: platform draft failed', { platform, file: FILE, error: message });
    return {
      drafts: [],
      skipped: {
        platform,
        platformLabel: label,
        // Honest, not fake: surface that this platform produced nothing and why.
        reason: `Couldn't generate drafts for ${label}: ${message}`,
      },
    };
  }
}

/**
 * Generate the full cross-platform plan. Runs every selected platform's
 * specialist in parallel; a platform that fails or has no specialist becomes a
 * `skipped` entry with an honest reason rather than silently disappearing.
 * Throws only when EVERY platform fails (so the route can surface a real error).
 */
export async function generateStrategyWizardPlan(
  input: StrategyWizardInput,
): Promise<StrategyWizardPlan> {
  const goals = (input.goals ?? []).map((g) => g.trim()).filter((g) => g.length > 0);
  const postsPerPlatform = Math.min(Math.max(input.postsPerPlatform ?? 4, 1), 5);

  const requested = input.platforms && input.platforms.length > 0
    ? Array.from(new Set(input.platforms))
    : getLivePlatforms();

  const briefContext: InsightsBriefContext = {
    businessDescription: input.businessDescription,
    goals,
    postsWanted: postsPerPlatform,
  };

  const results = await Promise.all(
    requested.map((platform) => buildForPlatform(platform, briefContext)),
  );

  const strategies: WizardPlatformStrategy[] = [];
  const skipped: WizardSkippedPlatform[] = [];
  const drafts: WizardDraft[] = [];

  for (const r of results) {
    if (r.strategy) { strategies.push(r.strategy); }
    if (r.skipped) { skipped.push(r.skipped); }
    drafts.push(...r.drafts);
  }

  if (strategies.length === 0) {
    const detail = skipped.map((s) => s.reason).join(' ');
    throw new Error(
      `No platform produced a strategy. ${detail || 'Check that platform specialists are seeded.'}`,
    );
  }

  return {
    businessDescription: input.businessDescription,
    goals,
    generatedAt: new Date().toISOString(),
    postsPerPlatform,
    strategy: { platforms: strategies, skipped },
    drafts,
  };
}
