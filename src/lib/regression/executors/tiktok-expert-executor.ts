/**
 * TikTok Expert Regression Executor
 *
 * Knows how to turn a RegressionCase into a live single-shot capture against
 * a specified model. Mirrors how the production TikTok Expert builds its
 * resolved system prompt (GM + Brand DNA) and user prompt by reusing the
 * specialist's own `__internal` exports so the harness stays locked to
 * whatever the real specialist does.
 *
 * One action is supported:
 *   - generate_content  (TikTok video concept with script, hooks, caption, strategy)
 *
 * Invariant severity notes:
 *   - hookPresent, captionPresent, hashtagsCountWithinRange,
 *     contentStrategyPresent are FAIL — structural contract violations.
 *   - noClicheHooks and topicEchoedInCaption are WARN — soft signals for
 *     owner review, not hard-blocking an upgrade.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import {
  __internal as tiktokInternal,
} from '@/lib/agents/marketing/tiktok/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import {
  captureSingleShot,
  type InvariantCheck,
} from '../capture/single-shot-capture';

const SPECIALIST_ID = 'TIKTOK_EXPERT';
const MAX_TOKENS = 8192;

// ============================================================================
// PAYLOAD VALIDATION
// ============================================================================

const GenerateContentPayloadSchema = z.object({
  action: z.literal('generate_content'),
  industryKey: z.string().optional(),
  topic: z.string().min(1),
  contentType: z.string().min(1),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
});

const CasePayloadSchema = z.object({}).passthrough().pipe(GenerateContentPayloadSchema);

interface ParsedGenerateContent {
  action: 'generate_content';
  industryKey: string | undefined;
  topic: string;
  contentType: string;
  targetAudience: string | undefined;
  tone: string | undefined;
  campaignGoal: string | undefined;
  brandContext: Record<string, unknown> | undefined;
  seoKeywords: Record<string, unknown> | undefined;
}

function parsePayload(raw: Record<string, unknown>): ParsedGenerateContent {
  const result = CasePayloadSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `[tiktok-expert-executor] invalid case.inputPayload: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  const data = result.data;

  // Validate through the specialist's own schema
  const innerResult = tiktokInternal.GenerateContentRequestSchema.safeParse({
    action: data.action,
    topic: data.topic,
    contentType: data.contentType,
    targetAudience: data.targetAudience,
    tone: data.tone,
    campaignGoal: data.campaignGoal,
    brandContext: data.brandContext,
    seoKeywords: data.seoKeywords,
  });
  if (!innerResult.success) {
    throw new Error(
      `[tiktok-expert-executor] invalid generate_content input: ${innerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }

  return {
    action: 'generate_content',
    industryKey: data.industryKey,
    topic: innerResult.data.topic,
    contentType: innerResult.data.contentType,
    targetAudience: innerResult.data.targetAudience,
    tone: innerResult.data.tone,
    campaignGoal: innerResult.data.campaignGoal,
    brandContext: innerResult.data.brandContext,
    seoKeywords: innerResult.data.seoKeywords,
  };
}

// ============================================================================
// HELPER
// ============================================================================

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ============================================================================
// INVARIANT FACTORIES
// ============================================================================

/**
 * videoScript.hook must be a non-empty string of at least 10 characters.
 * Default severity (FAIL) — a missing or stub hook is structurally broken.
 */
function hookPresent(): InvariantCheck {
  return {
    id: 'hook_present',
    description: 'videoScript.hook must be a non-empty string of at least 10 characters',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const videoScript = parsed.videoScript;
      if (!isObject(videoScript)) {
        return { passed: false, message: 'videoScript is not an object' };
      }
      const hook = videoScript.hook;
      if (typeof hook !== 'string') {
        return { passed: false, message: 'videoScript.hook is not a string' };
      }
      if (hook.length < 10) {
        return { passed: false, message: `videoScript.hook.length=${hook.length} (minimum 10)` };
      }
      return { passed: true };
    },
  };
}

/**
 * caption must be a non-empty string of at least 20 characters.
 * Default severity (FAIL) — a missing caption is structurally broken.
 */
function captionPresent(): InvariantCheck {
  return {
    id: 'caption_present',
    description: 'caption must be a non-empty string of at least 20 characters',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const caption = parsed.caption;
      if (typeof caption !== 'string') {
        return { passed: false, message: 'caption is not a string' };
      }
      if (caption.length < 20) {
        return { passed: false, message: `caption.length=${caption.length} (minimum 20)` };
      }
      return { passed: true };
    },
  };
}

/**
 * hashtags array length must be within [min, max].
 * Default severity (FAIL) — too few or too many hashtags is structurally broken.
 */
function hashtagsCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `hashtags_count_between_${min}_and_${max}`,
    description: `hashtags array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const hashtags = parsed.hashtags;
      if (!Array.isArray(hashtags)) {
        return { passed: false, message: 'hashtags is not an array' };
      }
      const ok = hashtags.length >= min && hashtags.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `hashtags.length=${hashtags.length} outside [${min}, ${max}]`,
      };
    },
  };
}

/**
 * contentStrategy must be a non-empty string of at least 50 characters.
 * Default severity (FAIL) — a missing or stub strategy is structurally broken.
 */
function contentStrategyPresent(): InvariantCheck {
  return {
    id: 'content_strategy_present',
    description: 'contentStrategy must be a non-empty string of at least 50 characters',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const strategy = parsed.contentStrategy;
      if (typeof strategy !== 'string') {
        return { passed: false, message: 'contentStrategy is not a string' };
      }
      if (strategy.length < 50) {
        return { passed: false, message: `contentStrategy.length=${strategy.length} (minimum 50)` };
      }
      return { passed: true };
    },
  };
}

/**
 * videoScript.hook must NOT contain TikTok cliches: "Hey guys", "So today",
 * "In this video" (case-insensitive).
 * Marked severityOnFail='WARN' — cliches are a quality signal, not a
 * structural contract violation.
 */
function noClicheHooks(): InvariantCheck {
  const CLICHES = [
    'hey guys',
    'so today',
    'in this video',
    'what\'s up everyone',
    'welcome back',
  ];
  return {
    id: 'no_cliche_hooks',
    description: 'videoScript.hook must not contain TikTok cliches (case-insensitive)',
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const videoScript = parsed.videoScript;
      if (!isObject(videoScript)) {
        return { passed: false, message: 'videoScript is not an object' };
      }
      const hook = videoScript.hook;
      if (typeof hook !== 'string') {
        return { passed: false, message: 'videoScript.hook is not a string' };
      }
      const lower = hook.toLowerCase();
      const found = CLICHES.filter((c) => lower.includes(c));
      if (found.length > 0) {
        return { passed: false, message: `videoScript.hook contains cliches: ${found.join(', ')}` };
      }
      return { passed: true };
    },
  };
}

/**
 * At least one word from the topic (3+ chars) should appear in the caption.
 * Marked severityOnFail='WARN' — the LLM may use synonyms or rephrase the
 * topic without using the exact words.
 */
function topicEchoedInCaption(topic: string): InvariantCheck {
  const words = topic
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 3);
  return {
    id: 'topic_echoed_in_caption',
    description: `at least one topic word (3+ chars) from "${topic}" should appear in caption`,
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const caption = parsed.caption;
      if (typeof caption !== 'string') {
        return { passed: false, message: 'caption is not a string' };
      }
      const lower = caption.toLowerCase();
      const found = words.some((w) => lower.includes(w));
      return {
        passed: found,
        message: found ? undefined : `no topic word from "${topic}" found in caption`,
      };
    },
  };
}

// ============================================================================
// PER-CASE INVARIANT WIRING
// ============================================================================

function invariantsForCase(caseDoc: RegressionCase): InvariantCheck[] {
  switch (caseDoc.caseId) {
    case 'tiktok_expert_saas_viral_hook':
      return [
        hookPresent(),
        captionPresent(),
        hashtagsCountWithinRange(3, 15),
        contentStrategyPresent(),
        noClicheHooks(),
        topicEchoedInCaption('AI sales automation agents'),
      ];
    case 'tiktok_expert_realestate_tutorial':
      return [
        hookPresent(),
        captionPresent(),
        hashtagsCountWithinRange(3, 15),
        contentStrategyPresent(),
        noClicheHooks(),
        topicEchoedInCaption('open house staging tricks luxury homes'),
      ];
    case 'tiktok_expert_trend_ecommerce':
      return [
        hookPresent(),
        captionPresent(),
        hashtagsCountWithinRange(3, 15),
        contentStrategyPresent(),
        noClicheHooks(),
        topicEchoedInCaption('dropshipping product research winning'),
      ];
    default:
      return [];
  }
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function tiktokExpertExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? tiktokInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(`[tiktok-expert-executor] No active GM found for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[tiktok-expert-executor] GM ${gmRecord.id} systemPrompt too short (${baseSystemPrompt.length} chars)`);
  }
  // Brand DNA is baked into the GM at seed time; baseSystemPrompt IS the resolved prompt.
  const resolvedSystemPrompt = baseSystemPrompt;

  const req: Parameters<typeof tiktokInternal.buildGenerateContentUserPrompt>[0] = {
    action: 'generate_content',
    topic: parsed.topic,
    contentType: parsed.contentType,
    targetAudience: parsed.targetAudience,
    tone: parsed.tone,
    campaignGoal: parsed.campaignGoal,
    brandContext: parsed.brandContext as Parameters<typeof tiktokInternal.buildGenerateContentUserPrompt>[0]['brandContext'],
    seoKeywords: parsed.seoKeywords as Parameters<typeof tiktokInternal.buildGenerateContentUserPrompt>[0]['seoKeywords'],
  };
  const userPrompt = tiktokInternal.buildGenerateContentUserPrompt(req);
  const schema: ZodTypeAny = tiktokInternal.TikTokContentResultSchema;

  const invariants = invariantsForCase(args.caseDoc);

  const capture = await captureSingleShot({
    modelId: args.modelId,
    systemPrompt: resolvedSystemPrompt,
    userMessage: userPrompt,
    temperature: REGRESSION_TEMPERATURE,
    maxTokens: MAX_TOKENS,
    schema,
    invariants,
    stripJsonFences: true,
  });

  return {
    signature: capture.signature,
    rawRequestBody: capture.rawRequestBody,
    rawResponseBody: capture.rawResponseBody,
  };
}
