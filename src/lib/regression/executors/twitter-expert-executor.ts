/**
 * Twitter/X Expert Regression Executor
 *
 * Knows how to turn a RegressionCase into a live single-shot capture against
 * a specified model. Mirrors how the production Twitter/X Expert builds its
 * resolved system prompt (GM + Brand DNA) and user prompt by reusing the
 * specialist's own `__internal` exports so the harness stays locked to
 * whatever the real specialist does.
 *
 * One action is supported:
 *   - generate_content  (Twitter/X thread + standalone tweet with strategic metadata)
 *
 * Invariant severity notes:
 *   - hookPresent, tweetCharacterLimit, threadMinLength, standaloneTweetPresent,
 *     contentStrategyPresent are FAIL — structural contract violations.
 *   - noClicheHooks and topicEchoedInThread are WARN — soft signals for
 *     owner review, not hard-blocking an upgrade.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import {
  __internal as twitterInternal,
} from '@/lib/agents/marketing/twitter/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import {
  captureSingleShot,
  type InvariantCheck,
} from '../capture/single-shot-capture';

const SPECIALIST_ID = 'TWITTER_X_EXPERT';
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
      `[twitter-expert-executor] invalid case.inputPayload: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  const data = result.data;

  const innerResult = twitterInternal.GenerateContentRequestSchema.safeParse({
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
      `[twitter-expert-executor] invalid generate_content input: ${innerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
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

function hookPresent(): InvariantCheck {
  return {
    id: 'hook_present',
    description: 'hooks.primary must be a non-empty string of at least 10 characters',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const hooks = parsed.hooks;
      if (!isObject(hooks)) {
        return { passed: false, message: 'hooks is not an object' };
      }
      const primary = hooks.primary;
      if (typeof primary !== 'string') {
        return { passed: false, message: 'hooks.primary is not a string' };
      }
      if (primary.length < 10) {
        return { passed: false, message: `hooks.primary.length=${primary.length} (minimum 10)` };
      }
      return { passed: true };
    },
  };
}

function tweetCharacterLimit(): InvariantCheck {
  return {
    id: 'tweet_character_limit',
    description: 'every tweet in thread must be 280 characters or fewer',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const thread = parsed.thread;
      if (!Array.isArray(thread)) {
        return { passed: false, message: 'thread is not an array' };
      }
      const violations: string[] = [];
      for (const tweet of thread) {
        if (isObject(tweet) && typeof tweet.text === 'string' && tweet.text.length > 280) {
          violations.push(`position ${String(tweet.position)}: ${tweet.text.length} chars`);
        }
      }
      if (violations.length > 0) {
        return { passed: false, message: `tweets exceeding 280 chars: ${violations.join(', ')}` };
      }
      return { passed: true };
    },
  };
}

function threadMinLength(min: number): InvariantCheck {
  return {
    id: `thread_min_length_${min}`,
    description: `thread must have at least ${min} tweets`,
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const thread = parsed.thread;
      if (!Array.isArray(thread)) {
        return { passed: false, message: 'thread is not an array' };
      }
      if (thread.length < min) {
        return { passed: false, message: `thread.length=${thread.length} (minimum ${min})` };
      }
      return { passed: true };
    },
  };
}

function standaloneTweetPresent(): InvariantCheck {
  return {
    id: 'standalone_tweet_present',
    description: 'standaloneTweet must be a non-empty string of 10-280 characters',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const tweet = parsed.standaloneTweet;
      if (typeof tweet !== 'string') {
        return { passed: false, message: 'standaloneTweet is not a string' };
      }
      if (tweet.length < 10 || tweet.length > 280) {
        return { passed: false, message: `standaloneTweet.length=${tweet.length} (must be 10-280)` };
      }
      return { passed: true };
    },
  };
}

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

function noClicheHooks(): InvariantCheck {
  const CLICHES = [
    'thread:',
    '1/',
    'a thread on',
    'here\'s what i learned',
    'let me tell you about',
  ];
  return {
    id: 'no_cliche_hooks',
    description: 'hooks.primary must not contain Twitter cliches (case-insensitive)',
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const hooks = parsed.hooks;
      if (!isObject(hooks)) {
        return { passed: false, message: 'hooks is not an object' };
      }
      const primary = hooks.primary;
      if (typeof primary !== 'string') {
        return { passed: false, message: 'hooks.primary is not a string' };
      }
      const lower = primary.toLowerCase();
      const found = CLICHES.filter((c) => lower.includes(c));
      if (found.length > 0) {
        return { passed: false, message: `hooks.primary contains cliches: ${found.join(', ')}` };
      }
      return { passed: true };
    },
  };
}

function topicEchoedInThread(topic: string): InvariantCheck {
  const words = topic
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 3);
  return {
    id: 'topic_echoed_in_thread',
    description: `at least one topic word (3+ chars) from "${topic}" should appear in thread tweets`,
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const thread = parsed.thread;
      if (!Array.isArray(thread)) {
        return { passed: false, message: 'thread is not an array' };
      }
      const allText = thread
        .map((t) => (isObject(t) && typeof t.text === 'string' ? t.text : ''))
        .join(' ')
        .toLowerCase();
      const found = words.some((w) => allText.includes(w));
      return {
        passed: found,
        message: found ? undefined : `no topic word from "${topic}" found in thread tweets`,
      };
    },
  };
}

// ============================================================================
// PER-CASE INVARIANT WIRING
// ============================================================================

function invariantsForCase(caseDoc: RegressionCase): InvariantCheck[] {
  switch (caseDoc.caseId) {
    case 'twitter_expert_saas_thread':
      return [
        hookPresent(),
        tweetCharacterLimit(),
        threadMinLength(3),
        standaloneTweetPresent(),
        contentStrategyPresent(),
        noClicheHooks(),
        topicEchoedInThread('AI agent swarm SaaS tool stack'),
      ];
    case 'twitter_expert_realestate_hot_take':
      return [
        hookPresent(),
        tweetCharacterLimit(),
        threadMinLength(3),
        standaloneTweetPresent(),
        contentStrategyPresent(),
        noClicheHooks(),
        topicEchoedInThread('real estate agents open houses virtual'),
      ];
    case 'twitter_expert_educational_ecommerce':
      return [
        hookPresent(),
        tweetCharacterLimit(),
        threadMinLength(3),
        standaloneTweetPresent(),
        contentStrategyPresent(),
        noClicheHooks(),
        topicEchoedInThread('ecommerce conversion checkout abandoned'),
      ];
    default:
      return [];
  }
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function twitterExpertExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? twitterInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(`[twitter-expert-executor] No active GM found for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[twitter-expert-executor] GM ${gmRecord.id} systemPrompt too short (${baseSystemPrompt.length} chars)`);
  }

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error('[twitter-expert-executor] Brand DNA not configured');
  }

  const resolvedSystemPrompt = twitterInternal.buildResolvedSystemPrompt(baseSystemPrompt, brandDNA);

  const req: Parameters<typeof twitterInternal.buildGenerateContentUserPrompt>[0] = {
    action: 'generate_content',
    topic: parsed.topic,
    contentType: parsed.contentType,
    targetAudience: parsed.targetAudience,
    tone: parsed.tone,
    campaignGoal: parsed.campaignGoal,
    brandContext: parsed.brandContext as Parameters<typeof twitterInternal.buildGenerateContentUserPrompt>[0]['brandContext'],
    seoKeywords: parsed.seoKeywords as Parameters<typeof twitterInternal.buildGenerateContentUserPrompt>[0]['seoKeywords'],
  };
  const userPrompt = twitterInternal.buildGenerateContentUserPrompt(req);
  const schema: ZodTypeAny = twitterInternal.TwitterContentResultSchema;

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
