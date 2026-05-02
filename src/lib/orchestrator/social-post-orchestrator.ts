/**
 * Social Post Mission Orchestrator
 *
 * Runs the three-step pipeline that backs every AI-generated social post:
 *
 *   Step 1 — generate_brief   : Platform specialist ({PLATFORM}_EXPERT) drafts
 *                               copy + format hints grounded in Brand DNA (baked
 *                               into the specialist's Golden Master at seed time,
 *                               Standing Rule #1 — no runtime Brand DNA merge).
 *
 *   Step 2 — materialize_content : Magic Studio step.
 *                               For text-only formats (single-post, thread) the
 *                               step is a passthrough — the step-1 text IS the
 *                               final asset. Text generation via a second LLM
 *                               call is explicitly unwired here: Studio's text
 *                               gen pipeline is not connected (confirmed by a
 *                               separate audit). This is documented honestly on
 *                               the step summary so Mission Control shows it.
 *                               For image-post / carousel, calls the
 *                               asset-generator route internally.
 *                               For video formats, calls the video-gen route.
 *
 *   Step 3 — await_review     : Status set to AWAITING_APPROVAL (mission-level).
 *                               The InlineReviewCard polls missions with this
 *                               status + metadata.kind='social_post_generation'.
 *
 * Standing Rule #2: this module does NOT touch any Golden Master document.
 * No createVersionFromEdit, no deployVersion, no TrainingFeedback writes.
 * Grading (if any) is a completely separate path via StepGradeWidget.
 *
 * @module orchestrator/social-post-orchestrator
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger/logger';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import {
  createMission,
  getMission,
  finalizeMission,
  updateMissionStep,
  type Mission,
  type MissionStep,
} from './mission-persistence';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import type { SocialPlatform } from '@/types/social';

// ============================================================================
// CONSTANTS
// ============================================================================

const FILE = 'orchestrator/social-post-orchestrator.ts';

/**
 * Platform string (from route param) → specialist ID.
 * Matches the mapping already used by MarketingManager.executeSinglePlatformPost.
 */
const SPECIALIST_BY_PLATFORM: Readonly<Record<string, string>> = {
  x: 'TWITTER_X_EXPERT',
  twitter: 'TWITTER_X_EXPERT',
  bluesky: 'BLUESKY_EXPERT',
  mastodon: 'MASTODON_EXPERT',
  linkedin: 'LINKEDIN_EXPERT',
  facebook: 'FACEBOOK_ADS_EXPERT',
  instagram: 'INSTAGRAM_EXPERT',
  pinterest: 'PINTEREST_EXPERT',
  reddit: 'REDDIT_EXPERT',
  threads: 'THREADS_EXPERT',
  'google-business': 'GOOGLE_BUSINESS_EXPERT',
  google_business: 'GOOGLE_BUSINESS_EXPERT',
  telegram: 'TELEGRAM_EXPERT',
  whatsapp: 'WHATSAPP_BUSINESS_EXPERT',
  whatsapp_business: 'WHATSAPP_BUSINESS_EXPERT',
  'whatsapp-business': 'WHATSAPP_BUSINESS_EXPERT',
  discord: 'DISCORD_EXPERT',
  twitch: 'TWITCH_EXPERT',
};

/**
 * Formats where step 2 is a pure passthrough (no second LLM / no image gen).
 * Step 2 adopts the step-1 output verbatim and documents the gap honestly.
 */
const TEXT_ONLY_FORMATS = new Set(['single-post', 'post', 'thread', 'text']);

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export interface SocialPostMissionInput {
  /** SocialPlatform-normalised string (e.g. "bluesky", "twitter"). */
  platform: SocialPlatform;
  /**
   * Free-form operator brief OR the hook+body from a Suggested Content card.
   * At least one of brief | hook+body must be provided.
   */
  brief?: string;
  hook?: string;
  body?: string;
  /** Content format hint passed to the specialist. Defaults to 'post'. */
  format?: string;
  /** Authenticated user uid — stored for audit. */
  createdByUid: string;
  /**
   * Optional reference to a Suggested Content card from the saved insights doc.
   * When provided, it is used as additional context for the specialist but does
   * not replace the brief/hook+body fields.
   */
  suggestionId?: string;
}

export interface SocialPostMissionCreated {
  missionId: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function deriveTopic(input: Pick<SocialPostMissionInput, 'brief' | 'hook' | 'body'>): string {
  if (input.brief && input.brief.trim().length > 0) {
    return input.brief.trim();
  }
  const parts: string[] = [];
  if (input.hook) { parts.push(input.hook.trim()); }
  if (input.body) { parts.push(input.body.trim()); }
  return parts.join('\n\n');
}

function makeStepId(missionId: string, index: number): string {
  return `sp_step_${missionId}_${index}`;
}

/**
 * Resolve the suggestionId to the hook+body from the saved insights doc.
 * Returns undefined if the doc or the card is missing — non-fatal.
 */
async function resolveSuggestion(
  platform: SocialPlatform,
  suggestionId: string,
): Promise<{ hook: string; body: string } | undefined> {
  try {
    if (!adminDb) { return undefined; }
    const insightsPath = getSubCollection('platform_insights');
    const snap = await adminDb
      .collection(insightsPath)
      .where('platform', '==', platform)
      .orderBy('generatedAt', 'desc')
      .limit(1)
      .get();
    if (snap.empty) { return undefined; }
    const data = snap.docs[0].data() as { insights?: { suggestedContent?: Array<{ hook: string; body: string }> } };
    const cards = data.insights?.suggestedContent;
    if (!Array.isArray(cards)) { return undefined; }
    const parsed = Number(suggestionId);
    const card = Number.isFinite(parsed) ? cards[parsed] : undefined;
    if (!card) { return undefined; }
    return { hook: card.hook, body: card.body };
  } catch (err) {
    logger.warn('[SocialPostOrchestrator] resolveSuggestion failed (non-fatal)', {
      platform,
      suggestionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

// ============================================================================
// STEP 1 — SPECIALIST GENERATE BRIEF
// ============================================================================

interface SpecialistGenerateBriefInput {
  platform: SocialPlatform;
  specialistId: string;
  topic: string;
  format: string;
  brandContext?: Record<string, unknown>;
}

interface SpecialistBriefResult {
  primaryPost: string;
  /** Verbatim JSON string from the specialist, stored as toolResult. */
  raw: string;
}

async function runSpecialistGenerateBrief(
  input: SpecialistGenerateBriefInput,
): Promise<SpecialistBriefResult> {
  // Dynamic import mirrors the pattern in MarketingManager.executeSinglePlatformPost
  // so we don't load all specialists at module level (expensive cold-start cost).
  const { getBlueskyExpert } = await import('@/lib/agents/marketing/bluesky/specialist');
  const { getTwitterExpert } = await import('@/lib/agents/marketing/twitter/specialist');
  const { getMastodonExpert } = await import('@/lib/agents/marketing/mastodon/specialist');
  const { getLinkedInExpert } = await import('@/lib/agents/marketing/linkedin/specialist');
  const { getFacebookAdsExpert } = await import('@/lib/agents/marketing/facebook/specialist');
  const { getInstagramExpert } = await import('@/lib/agents/marketing/instagram/specialist');
  const { getPinterestExpert } = await import('@/lib/agents/marketing/pinterest/specialist');
  const { getRedditExpert } = await import('@/lib/agents/marketing/reddit/specialist');
  const { getThreadsExpert } = await import('@/lib/agents/marketing/threads/specialist');
  const { getGoogleBusinessExpert } = await import('@/lib/agents/marketing/google-business/specialist');
  const { getTelegramExpert } = await import('@/lib/agents/marketing/telegram/specialist');
  const { getWhatsAppBusinessExpert } = await import('@/lib/agents/marketing/whatsapp-business/specialist');
  const { getDiscordExpert } = await import('@/lib/agents/marketing/discord/specialist');
  const { getTwitchExpert } = await import('@/lib/agents/marketing/twitch/specialist');

  const p = input.platform;
  const expert = (() => {
    switch (p) {
      case 'twitter': return getTwitterExpert();
      case 'bluesky': return getBlueskyExpert();
      case 'mastodon': return getMastodonExpert();
      case 'linkedin': return getLinkedInExpert();
      case 'facebook': return getFacebookAdsExpert();
      case 'instagram': return getInstagramExpert();
      case 'pinterest': return getPinterestExpert();
      case 'reddit': return getRedditExpert();
      case 'threads': return getThreadsExpert();
      case 'google_business': return getGoogleBusinessExpert();
      case 'telegram': return getTelegramExpert();
      case 'whatsapp_business': return getWhatsAppBusinessExpert();
      case 'discord': return getDiscordExpert();
      case 'twitch': return getTwitchExpert();
      default: throw new Error(`[SocialPostOrchestrator] No specialist factory for platform="${p}"`);
    }
  })();

  await expert.initialize();

  // Construct the delegation message directly — same shape as
  // MarketingManager.createDelegationMessage (which is private).
  // Avoids importing BaseManager here (circular-dependency risk).
  const msgId = `spog_${uuidv4()}`;
  const delegationMsg = {
    id: msgId,
    timestamp: new Date(),
    from: 'SOCIAL_POST_ORCHESTRATOR',
    to: input.specialistId,
    type: 'COMMAND' as const,
    priority: 'NORMAL' as const,
    payload: {
      action: 'generate_content',
      topic: input.topic,
      contentType: input.format,
      ...(input.brandContext ? { brandContext: input.brandContext } : {}),
    },
    requiresResponse: true,
    traceId: `spog-${msgId}`,
  };

  const report = await expert.execute(delegationMsg);
  if (report.status !== 'COMPLETED') {
    const errs = report.errors ?? ['generate_content returned non-COMPLETED status'];
    throw new Error(`[SocialPostOrchestrator] ${input.specialistId} step 1 failed: ${errs.join('; ')}`);
  }

  const data = report.data as Record<string, unknown> | null | undefined;
  const primaryPost = (() => {
    if (!data) { return ''; }
    if (typeof data.primaryPost === 'string') { return data.primaryPost; }
    if (typeof data.standaloneTweet === 'string') { return data.standaloneTweet; }
    if (typeof data.pinTitle === 'string' && typeof data.pinDescription === 'string') {
      return `${data.pinTitle}\n\n${data.pinDescription}`;
    }
    return '';
  })();

  if (!primaryPost) {
    throw new Error(
      `[SocialPostOrchestrator] ${input.specialistId} returned no extractable primaryPost. ` +
      `Keys: ${JSON.stringify(Object.keys(data ?? {}))}`,
    );
  }

  return {
    primaryPost,
    raw: JSON.stringify(data),
  };
}

// ============================================================================
// STEP 2 — MATERIALIZE CONTENT (Magic Studio step)
// ============================================================================

interface MaterializeInput {
  format: string;
  platform: SocialPlatform;
  briefText: string;
  topic: string;
  brandStyleHint?: string;
  missionId: string;
}

interface MaterializeResult {
  finalText: string;
  mediaUrls: string[];
  /**
   * Whether the materialization was a passthrough (text-only format) or
   * triggered real asset generation. Stored on the step summary so Mission
   * Control is transparent about what happened.
   */
  wasPassthrough: boolean;
  summary: string;
}

async function materializeContent(input: MaterializeInput): Promise<MaterializeResult> {
  const { format, platform, briefText, topic, brandStyleHint, missionId } = input;

  // Text-only formats: passthrough. Magic Studio text gen is intentionally
  // unwired here — it is not connected (separate audit confirmed, May 2026).
  // The step adopts the specialist output verbatim and notes this honestly.
  if (TEXT_ONLY_FORMATS.has(format.toLowerCase())) {
    return {
      finalText: briefText,
      mediaUrls: [],
      wasPassthrough: true,
      summary:
        `Text passthrough (format="${format}"): Magic Studio text generation is currently unwired. ` +
        `The specialist's primaryPost is used as-is. ` +
        `Media generation for this format is not applicable.`,
    };
  }

  // Image formats: call the asset-generator internally via fetch.
  if (format === 'image-post' || format === 'carousel') {
    try {
      const { generateAndStoreSocialPostImage } = await import('@/lib/content/social-post-image');
      const imageResult = await generateAndStoreSocialPostImage({
        imageId: `spog_img_${platform}_${missionId}_${Date.now()}`,
        platform,
        postText: briefText,
        topic,
        ...(brandStyleHint ? { brandStyleHint } : {}),
      });

      if (imageResult) {
        return {
          finalText: briefText,
          mediaUrls: [imageResult.url],
          wasPassthrough: false,
          summary: `Image materialised via DALL-E. URL: ${imageResult.url}`,
        };
      }
    } catch (err) {
      logger.warn('[SocialPostOrchestrator] Image generation failed in step 2 (non-fatal)', {
        missionId,
        platform,
        format,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    // Image gen failed — degrade gracefully to text-only passthrough.
    return {
      finalText: briefText,
      mediaUrls: [],
      wasPassthrough: true,
      summary:
        `Image materialization attempted for format="${format}" but failed (non-fatal). ` +
        `Falling back to text-only passthrough. Operator can attach media manually before posting.`,
    };
  }

  // Video formats: call video-gen route internally. These are aspirational for
  // current YC scope — the route exists but generation is slow. Degrade
  // gracefully to passthrough if unavailable.
  if (format === 'short-form-video' || format === 'long-form-video') {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const resp = await fetch(`${baseUrl}/api/content/video/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: briefText,
          platform,
          format,
          missionId,
        }),
      });
      if (resp.ok) {
        const result = await resp.json() as { videoUrl?: string };
        if (result.videoUrl) {
          return {
            finalText: briefText,
            mediaUrls: [result.videoUrl],
            wasPassthrough: false,
            summary: `Video materialized at: ${result.videoUrl}`,
          };
        }
      }
    } catch (err) {
      logger.warn('[SocialPostOrchestrator] Video generation failed in step 2 (non-fatal)', {
        missionId,
        platform,
        format,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return {
      finalText: briefText,
      mediaUrls: [],
      wasPassthrough: true,
      summary:
        `Video materialization for format="${format}" is unavailable or failed (YC scope: text-first). ` +
        `Falling back to text passthrough. Operator can attach video manually before posting.`,
    };
  }

  // Unknown format — passthrough and document.
  return {
    finalText: briefText,
    mediaUrls: [],
    wasPassthrough: true,
    summary:
      `Unknown format="${format}": no specialized materializer registered. ` +
      `Using specialist text output as-is.`,
  };
}

// ============================================================================
// MISSION FACTORY — builds the initial Mission document
// ============================================================================

/**
 * Build the three predefined steps in PROPOSED status so the orchestrator
 * runner can walk them. Steps land as PROPOSED (not PENDING) to match
 * the createMissionWithPlan pattern used elsewhere in the codebase.
 */
function buildInitialMission(input: {
  missionId: string;
  platform: SocialPlatform;
  specialistId: string;
  topic: string;
  format: string;
  createdByUid: string;
  now: string;
}): Mission {
  const { missionId, platform, specialistId, topic, format, createdByUid, now } = input;

  const step1: MissionStep = {
    stepId: makeStepId(missionId, 1),
    toolName: 'generate_brief',
    delegatedTo: specialistId,
    status: 'PROPOSED',
    startedAt: now,
    summary: `${specialistId} will generate a platform-optimised post brief for ${platform}.`,
    toolArgs: {
      action: 'generate_content',
      topic,
      contentType: format,
    },
    operatorApproved: true,
  };

  const step2: MissionStep = {
    stepId: makeStepId(missionId, 2),
    toolName: 'materialize_content',
    delegatedTo: 'MAGIC_STUDIO',
    status: 'PROPOSED',
    startedAt: now,
    summary: `Magic Studio will materialise the specialist brief into final assets (format="${format}").`,
    toolArgs: { format },
    operatorApproved: true,
  };

  const step3: MissionStep = {
    stepId: makeStepId(missionId, 3),
    toolName: 'await_review',
    delegatedTo: 'OPERATOR',
    status: 'PROPOSED',
    startedAt: now,
    summary: 'Awaiting operator review via InlineReviewCard.',
    operatorApproved: true,
  };

  const platformLabel = platform.replace(/_/g, ' ');

  return {
    missionId,
    conversationId: `social_post_${platform}_${missionId}`,
    status: 'IN_PROGRESS',
    title: `AI Post — ${platformLabel} — ${new Date(now).toLocaleDateString()}`,
    userPrompt: topic,
    steps: [step1, step2, step3],
    createdAt: now,
    updatedAt: now,
    metadata: {
      platform,
      kind: 'social_post_generation',
      specialistId,
      format,
      createdByUid,
    },
  };
}

// ============================================================================
// MAIN ORCHESTRATOR FUNCTION
// ============================================================================

/**
 * Create a social post mission and run it to AWAITING_APPROVAL.
 *
 * The function is intentionally synchronous from the API route's perspective:
 * it creates the mission, runs steps 1-2, flips step 3 to AWAITING_APPROVAL,
 * then returns the missionId. The API route returns immediately after the
 * create call below so the UI can start polling. The orchestration itself
 * runs fire-and-forget via `runSocialPostMission` which is called from the
 * route AFTER returning the 200 response.
 *
 * Two public exports:
 *   1. `initSocialPostMission`  — creates + persists the mission skeleton,
 *      returns { missionId }. Call this in the route handler synchronously
 *      so the client gets a missionId to poll immediately.
 *   2. `runSocialPostMission`   — executes steps 1-3, call fire-and-forget
 *      after the route has responded.
 */
export async function initSocialPostMission(
  input: SocialPostMissionInput,
): Promise<SocialPostMissionCreated> {
  const normalised = input.platform.toLowerCase() as SocialPlatform;
  const specialistId = SPECIALIST_BY_PLATFORM[normalised];
  if (!specialistId) {
    throw new Error(
      `[SocialPostOrchestrator] No specialist registered for platform="${normalised}". ` +
      `Supported: ${Object.keys(SPECIALIST_BY_PLATFORM).join(', ')}`,
    );
  }

  // Resolve suggestionId → supplementary hook+body
  let resolvedHook = input.hook;
  let resolvedBody = input.body;
  if (input.suggestionId && (!resolvedHook || !resolvedBody)) {
    const suggestion = await resolveSuggestion(normalised, input.suggestionId);
    if (suggestion) {
      resolvedHook = resolvedHook ?? suggestion.hook;
      resolvedBody = resolvedBody ?? suggestion.body;
    }
  }

  const topic = deriveTopic({ brief: input.brief, hook: resolvedHook, body: resolvedBody });
  if (!topic) {
    throw new Error(
      '[SocialPostOrchestrator] Cannot create mission: no topic derivable from brief/hook/body.',
    );
  }

  const format = input.format ?? 'post';
  const missionId = `spmission_${uuidv4()}`;
  const now = new Date().toISOString();

  const mission = buildInitialMission({
    missionId,
    platform: normalised,
    specialistId,
    topic,
    format,
    createdByUid: input.createdByUid,
    now,
  });

  await createMission(mission);

  logger.info('[SocialPostOrchestrator] Mission created', {
    file: FILE,
    missionId,
    platform: normalised,
    specialistId,
    format,
  });

  return { missionId };
}

/**
 * Execute the three steps of a social post mission.
 * Call this fire-and-forget AFTER the route has returned the 200 with { missionId }.
 */
export async function runSocialPostMission(missionId: string): Promise<void> {
  const mission = await getMission(missionId);
  if (!mission) {
    logger.error('[SocialPostOrchestrator] runSocialPostMission: mission not found', undefined, {
      file: FILE,
      missionId,
    });
    return;
  }

  const platform = ((mission.metadata?.['platform'] as string | undefined) ?? '') as SocialPlatform;
  const specialistId = (mission.metadata?.['specialistId'] as string | undefined) ?? '';
  const format = (mission.metadata?.['format'] as string | undefined) ?? 'post';
  const topic = mission.userPrompt;

  const step1Id = makeStepId(missionId, 1);
  const step2Id = makeStepId(missionId, 2);
  const step3Id = makeStepId(missionId, 3);

  // ── Step 1: specialist generate_brief ──────────────────────────────────
  const step1Start = Date.now();
  await updateMissionStep(missionId, step1Id, { status: 'RUNNING' });

  let briefText: string;
  try {
    const brand = await getBrandDNA();
    const brandContext = brand
      ? {
          industry: brand.industry,
          toneOfVoice: brand.toneOfVoice,
          keyPhrases: brand.keyPhrases,
          avoidPhrases: brand.avoidPhrases,
        }
      : undefined;

    const briefResult = await runSpecialistGenerateBrief({
      platform,
      specialistId,
      topic,
      format,
      brandContext: brandContext as Record<string, unknown> | undefined,
    });

    briefText = briefResult.primaryPost;

    await updateMissionStep(missionId, step1Id, {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - step1Start,
      toolResult: briefResult.raw,
      summary: `${specialistId} produced post copy for ${platform}.`,
      specialistsUsed: [specialistId],
    });
    logger.info('[SocialPostOrchestrator] Step 1 complete', { file: FILE, missionId, step1Id });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[SocialPostOrchestrator] Step 1 failed', err instanceof Error ? err : undefined, {
      file: FILE,
      missionId,
      step1Id,
      error: errorMsg,
    });
    await updateMissionStep(missionId, step1Id, {
      status: 'FAILED',
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - step1Start,
      error: errorMsg,
    });
    await finalizeMission(missionId, 'FAILED', `Step 1 (generate_brief) failed: ${errorMsg}`);
    return;
  }

  // ── Step 2: Magic Studio materialize_content ───────────────────────────
  const step2Start = Date.now();
  await updateMissionStep(missionId, step2Id, { status: 'RUNNING' });

  let materialised: MaterializeResult;
  try {
    const brand = await getBrandDNA();
    materialised = await materializeContent({
      format,
      platform,
      briefText,
      topic,
      brandStyleHint: brand?.toneOfVoice,
      missionId,
    });

    await updateMissionStep(missionId, step2Id, {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - step2Start,
      toolResult: JSON.stringify({
        finalText: materialised.finalText,
        mediaUrls: materialised.mediaUrls,
        wasPassthrough: materialised.wasPassthrough,
      }),
      summary: materialised.summary,
    });
    logger.info('[SocialPostOrchestrator] Step 2 complete', { file: FILE, missionId, step2Id, wasPassthrough: materialised.wasPassthrough });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[SocialPostOrchestrator] Step 2 failed', err instanceof Error ? err : undefined, {
      file: FILE,
      missionId,
      step2Id,
      error: errorMsg,
    });
    await updateMissionStep(missionId, step2Id, {
      status: 'FAILED',
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - step2Start,
      error: errorMsg,
    });
    await finalizeMission(missionId, 'FAILED', `Step 2 (materialize_content) failed: ${errorMsg}`);
    return;
  }

  // ── Step 3: flip to AWAITING_APPROVAL ─────────────────────────────────
  // Step 3 is the operator review gate. Its toolResult carries the finalised
  // content so the InlineReviewCard can render it without a second Firestore
  // query. Mission status becomes AWAITING_APPROVAL (mission-level), which is
  // the query the pending-mission-step endpoint uses.
  try {
    const { FieldValue } = await import('firebase-admin/firestore');

    if (adminDb) {
      const docRef = adminDb.collection(getSubCollection('missions')).doc(missionId);
      await adminDb.runTransaction(async (tx) => {
        const doc = await tx.get(docRef);
        if (!doc.exists) { return; }
        const m = doc.data() as Mission;
        const step3Index = m.steps.findIndex((s) => s.stepId === step3Id);
        if (step3Index === -1) { return; }
        const updatedSteps = [...m.steps];
        updatedSteps[step3Index] = {
          ...updatedSteps[step3Index],
          status: 'RUNNING',
          toolResult: JSON.stringify({
            finalText: materialised.finalText,
            mediaUrls: materialised.mediaUrls,
          }),
          summary: 'Content ready. Awaiting operator approval via InlineReviewCard.',
        };
        tx.update(docRef, {
          steps: updatedSteps,
          status: 'AWAITING_APPROVAL',
          approvalRequired: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      logger.info('[SocialPostOrchestrator] Mission moved to AWAITING_APPROVAL', { file: FILE, missionId });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[SocialPostOrchestrator] Step 3 transition failed', err instanceof Error ? err : undefined, {
      file: FILE,
      missionId,
      step3Id,
      error: errorMsg,
    });
    // Non-fatal path — the content is already materialised. Operator can still
    // find the mission via status=IN_PROGRESS. Finalize as FAILED to keep the
    // mission surfaced in Mission Control's attention queue.
    await finalizeMission(missionId, 'FAILED', `Step 3 (await_review transition) failed: ${errorMsg}`);
  }
}

// ============================================================================
// QUERY HELPER — used by pending-mission-step endpoint
// ============================================================================

/**
 * Find the most recent social-post-generation mission in AWAITING_APPROVAL
 * for the given platform.
 *
 * The pending-mission-step endpoint queries:
 *   organizations/{PLATFORM_ID}/missions
 *     where status == 'AWAITING_APPROVAL'
 *     where metadata.kind == 'social_post_generation'
 *     where metadata.platform == platform
 *     orderBy createdAt desc
 *     limit 1
 *
 * This helper encapsulates that query. If Firestore does not yet have the
 * composite index (status + metadata.kind + metadata.platform + createdAt),
 * it falls back to a status-only query with client-side filtering.
 */
export async function findPendingSocialPostMission(
  platform: SocialPlatform,
): Promise<Mission | null> {
  if (!adminDb) { return null; }

  try {
    const collPath = getSubCollection('missions');

    // Attempt composite query first.
    try {
      const snap = await adminDb
        .collection(collPath)
        .where('status', '==', 'AWAITING_APPROVAL')
        .where('metadata.kind', '==', 'social_post_generation')
        .where('metadata.platform', '==', platform)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!snap.empty) {
        return snap.docs[0].data() as Mission;
      }
      return null;
    } catch (indexErr) {
      // If the composite index is missing Firestore throws a FAILED_PRECONDITION
      // error with a link to create it. Fall back to filtering in memory.
      logger.warn('[SocialPostOrchestrator] Composite index query failed, using fallback', {
        file: FILE,
        platform,
        error: indexErr instanceof Error ? indexErr.message : String(indexErr),
      });
    }

    // Fallback: status-only query + client-side filter.
    const fallbackSnap = await adminDb
      .collection(collPath)
      .where('status', '==', 'AWAITING_APPROVAL')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    for (const doc of fallbackSnap.docs) {
      const m = doc.data() as Mission & { metadata?: { kind?: string; platform?: string } };
      if (m.metadata?.kind === 'social_post_generation' && m.metadata?.platform === platform) {
        return m;
      }
    }
    return null;
  } catch (err) {
    logger.error(
      '[SocialPostOrchestrator] findPendingSocialPostMission failed',
      err instanceof Error ? err : undefined,
      { file: FILE, platform },
    );
    return null;
  }
}
