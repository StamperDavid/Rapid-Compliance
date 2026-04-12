/**
 * LinkedIn Expert Regression Executor
 *
 * Knows how to turn a RegressionCase into a live single-shot capture against
 * a specified model. Mirrors how the production LinkedIn Expert builds its
 * resolved system prompt (GM + Brand DNA) and user prompt by reusing the
 * specialist's own `__internal` exports so the harness stays locked to
 * whatever the real specialist does.
 *
 * One action is supported:
 *   - generate_content  (LinkedIn post with hook, hashtags, strategy, angles)
 *
 * Invariant severity notes:
 *   - hookPresent, hashtagsCountWithinRange, alternativeAnglesCountWithinRange,
 *     contentStrategyPresent are FAIL — structural contract violations.
 *   - noClicheHooks and topicEchoedInContent are WARN — soft signals for
 *     owner review, not hard-blocking an upgrade.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import {
  __internal as linkedinInternal,
} from '@/lib/agents/marketing/linkedin/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import {
  captureSingleShot,
  type InvariantCheck,
} from '../capture/single-shot-capture';

const SPECIALIST_ID = 'LINKEDIN_EXPERT';
const MAX_TOKENS = 10000;

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
      `[linkedin-expert-executor] invalid case.inputPayload: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  const data = result.data;

  // Validate through the specialist's own schema
  const innerResult = linkedinInternal.GenerateContentRequestSchema.safeParse({
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
      `[linkedin-expert-executor] invalid generate_content input: ${innerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
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
 * post.hook must be a non-empty string of at least 10 characters.
 * Default severity (FAIL) — a missing or stub hook is structurally broken.
 */
function hookPresent(): InvariantCheck {
  return {
    id: 'hook_present',
    description: 'post.hook must be a non-empty string of at least 10 characters',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const post = parsed.post;
      if (!isObject(post)) {
        return { passed: false, message: 'post is not an object' };
      }
      const hook = post.hook;
      if (typeof hook !== 'string') {
        return { passed: false, message: 'post.hook is not a string' };
      }
      if (hook.length < 10) {
        return { passed: false, message: `post.hook.length=${hook.length} (minimum 10)` };
      }
      return { passed: true };
    },
  };
}

/**
 * post.hashtags array length must be within [min, max].
 * Default severity (FAIL) — too few or too many hashtags is structurally broken.
 */
function hashtagsCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `hashtags_count_between_${min}_and_${max}`,
    description: `post.hashtags array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const post = parsed.post;
      if (!isObject(post)) {
        return { passed: false, message: 'post is not an object' };
      }
      const hashtags = post.hashtags;
      if (!Array.isArray(hashtags)) {
        return { passed: false, message: 'post.hashtags is not an array' };
      }
      const ok = hashtags.length >= min && hashtags.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `post.hashtags.length=${hashtags.length} outside [${min}, ${max}]`,
      };
    },
  };
}

/**
 * alternativeAngles array length must be within [min, max].
 * Default severity (FAIL) — too few or too many angles is structurally broken.
 */
function alternativeAnglesCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `alternative_angles_count_between_${min}_and_${max}`,
    description: `alternativeAngles array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const angles = parsed.alternativeAngles;
      if (!Array.isArray(angles)) {
        return { passed: false, message: 'alternativeAngles is not an array' };
      }
      const ok = angles.length >= min && angles.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `alternativeAngles.length=${angles.length} outside [${min}, ${max}]`,
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
 * post.hook must NOT contain LinkedIn cliches: "I'm excited", "Thrilled to
 * announce", "Let's connect", "Thoughts?" (case-insensitive).
 * Marked severityOnFail='WARN' — cliches are a quality signal, not a
 * structural contract violation.
 */
function noClicheHooks(): InvariantCheck {
  const CLICHES = [
    "i'm excited",
    'thrilled to announce',
    "let's connect",
    'thoughts?',
  ];
  return {
    id: 'no_cliche_hooks',
    description: 'post.hook must not contain LinkedIn cliches (case-insensitive)',
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const post = parsed.post;
      if (!isObject(post)) {
        return { passed: false, message: 'post is not an object' };
      }
      const hook = post.hook;
      if (typeof hook !== 'string') {
        return { passed: false, message: 'post.hook is not a string' };
      }
      const lower = hook.toLowerCase();
      const found = CLICHES.filter((c) => lower.includes(c));
      if (found.length > 0) {
        return { passed: false, message: `post.hook contains cliches: ${found.join(', ')}` };
      }
      return { passed: true };
    },
  };
}

/**
 * At least one word from the topic (3+ chars) should appear in post.content.
 * Marked severityOnFail='WARN' — the LLM may use synonyms or rephrase the
 * topic without using the exact words.
 */
function topicEchoedInContent(topic: string): InvariantCheck {
  const words = topic
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 3);
  return {
    id: 'topic_echoed_in_content',
    description: `at least one topic word (3+ chars) from "${topic}" should appear in post.content`,
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const post = parsed.post;
      if (!isObject(post)) {
        return { passed: false, message: 'post is not an object' };
      }
      const content = post.content;
      if (typeof content !== 'string') {
        return { passed: false, message: 'post.content is not a string' };
      }
      const lower = content.toLowerCase();
      const found = words.some((w) => lower.includes(w));
      return {
        passed: found,
        message: found ? undefined : `no topic word from "${topic}" found in post.content`,
      };
    },
  };
}

// ============================================================================
// PER-CASE INVARIANT WIRING
// ============================================================================

function invariantsForCase(caseDoc: RegressionCase): InvariantCheck[] {
  switch (caseDoc.caseId) {
    case 'linkedin_expert_saas_thought_leadership':
      return [
        hookPresent(),
        hashtagsCountWithinRange(3, 10),
        alternativeAnglesCountWithinRange(2, 5),
        contentStrategyPresent(),
        noClicheHooks(),
        topicEchoedInContent('AI agent swarms'),
      ];
    case 'linkedin_expert_realestate_lead_gen':
      return [
        hookPresent(),
        hashtagsCountWithinRange(3, 10),
        alternativeAnglesCountWithinRange(2, 5),
        contentStrategyPresent(),
        noClicheHooks(),
        topicEchoedInContent('open house strategies luxury agents'),
      ];
    case 'linkedin_expert_carousel_agency':
      return [
        hookPresent(),
        hashtagsCountWithinRange(3, 10),
        alternativeAnglesCountWithinRange(2, 5),
        contentStrategyPresent(),
        noClicheHooks(),
        topicEchoedInContent('client onboarding agency churn'),
      ];
    default:
      return [];
  }
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function linkedinExpertExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? linkedinInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(`[linkedin-expert-executor] No active GM found for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[linkedin-expert-executor] GM ${gmRecord.id} systemPrompt too short (${baseSystemPrompt.length} chars)`);
  }

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error('[linkedin-expert-executor] Brand DNA not configured');
  }

  const resolvedSystemPrompt = linkedinInternal.buildResolvedSystemPrompt(baseSystemPrompt, brandDNA);

  const req: Parameters<typeof linkedinInternal.buildGenerateContentUserPrompt>[0] = {
    action: 'generate_content',
    topic: parsed.topic,
    contentType: parsed.contentType,
    targetAudience: parsed.targetAudience,
    tone: parsed.tone,
    campaignGoal: parsed.campaignGoal,
    brandContext: parsed.brandContext as Parameters<typeof linkedinInternal.buildGenerateContentUserPrompt>[0]['brandContext'],
    seoKeywords: parsed.seoKeywords as Parameters<typeof linkedinInternal.buildGenerateContentUserPrompt>[0]['seoKeywords'],
  };
  const userPrompt = linkedinInternal.buildGenerateContentUserPrompt(req);
  const schema: ZodTypeAny = linkedinInternal.LinkedInContentResultSchema;

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
