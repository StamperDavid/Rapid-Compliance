/**
 * Facebook Ads Expert Regression Executor
 *
 * One action: generate_content (Facebook/Meta ad creative with variations)
 *
 * Invariant severity:
 *   - headlinePresent, variationsCountWithinRange, contentStrategyPresent,
 *     validCTAButton are FAIL — structural contract violations.
 *   - topicEchoedInPrimaryText is WARN — soft signal.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import {
  __internal as facebookInternal,
} from '@/lib/agents/marketing/facebook/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import {
  captureSingleShot,
  type InvariantCheck,
} from '../capture/single-shot-capture';

const SPECIALIST_ID = 'FACEBOOK_ADS_EXPERT';
const MAX_TOKENS = 8192;

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
      `[facebook-ads-expert-executor] invalid case.inputPayload: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  const data = result.data;

  const innerResult = facebookInternal.GenerateContentRequestSchema.safeParse({
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
      `[facebook-ads-expert-executor] invalid generate_content input: ${innerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
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

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function headlinePresent(): InvariantCheck {
  return {
    id: 'headline_present',
    description: 'adCreative.primary.headline must be a non-empty string',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const ad = parsed.adCreative;
      if (!isObject(ad)) {return { passed: false, message: 'adCreative not an object' };}
      const primary = ad.primary;
      if (!isObject(primary)) {return { passed: false, message: 'adCreative.primary not an object' };}
      const headline = primary.headline;
      if (typeof headline !== 'string' || headline.length < 5) {
        return { passed: false, message: `headline missing or too short (${typeof headline === 'string' ? headline.length : 0} chars)` };
      }
      return { passed: true };
    },
  };
}

function variationsCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `variations_count_between_${min}_and_${max}`,
    description: `adCreative.variations array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const ad = parsed.adCreative;
      if (!isObject(ad)) {return { passed: false, message: 'adCreative not an object' };}
      const variations = ad.variations;
      if (!Array.isArray(variations)) {return { passed: false, message: 'variations not an array' };}
      const ok = variations.length >= min && variations.length <= max;
      return { passed: ok, message: ok ? undefined : `variations.length=${variations.length} outside [${min}, ${max}]` };
    },
  };
}

function contentStrategyPresent(): InvariantCheck {
  return {
    id: 'content_strategy_present',
    description: 'contentStrategy must be at least 50 characters',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const strategy = parsed.contentStrategy;
      if (typeof strategy !== 'string' || strategy.length < 50) {
        return { passed: false, message: `contentStrategy missing or too short (${typeof strategy === 'string' ? strategy.length : 0})` };
      }
      return { passed: true };
    },
  };
}

const VALID_CTAS = [
  'learn more', 'sign up', 'get started', 'shop now', 'download',
  'book now', 'contact us', 'apply now', 'get offer', 'get quote',
];

function validCTAButton(): InvariantCheck {
  return {
    id: 'valid_cta_button',
    description: 'adCreative.primary.callToAction must be a valid Facebook CTA option',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const ad = parsed.adCreative;
      if (!isObject(ad)) {return { passed: false, message: 'adCreative not an object' };}
      const primary = ad.primary;
      if (!isObject(primary)) {return { passed: false, message: 'primary not an object' };}
      const cta = primary.callToAction;
      if (typeof cta !== 'string') {return { passed: false, message: 'callToAction not a string' };}
      const normalized = cta.toLowerCase().trim();
      const isValid = VALID_CTAS.some((v) => normalized.includes(v));
      return { passed: isValid, message: isValid ? undefined : `CTA "${cta}" is not a valid Facebook CTA option` };
    },
  };
}

function topicEchoedInPrimaryText(topic: string): InvariantCheck {
  const words = topic.split(/\s+/).map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')).filter((w) => w.length >= 3);
  return {
    id: 'topic_echoed_in_primary_text',
    description: `at least one topic word from "${topic}" should appear in primary text`,
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const ad = parsed.adCreative;
      if (!isObject(ad)) {return { passed: false, message: 'adCreative not an object' };}
      const primary = ad.primary;
      if (!isObject(primary)) {return { passed: false, message: 'primary not an object' };}
      const text = primary.primaryText;
      if (typeof text !== 'string') {return { passed: false, message: 'primaryText not a string' };}
      const lower = text.toLowerCase();
      const found = words.some((w) => lower.includes(w));
      return { passed: found, message: found ? undefined : `no topic word from "${topic}" found in primaryText` };
    },
  };
}

function invariantsForCase(caseDoc: RegressionCase): InvariantCheck[] {
  switch (caseDoc.caseId) {
    case 'facebook_ads_saas_lead_gen':
      return [
        headlinePresent(),
        variationsCountWithinRange(2, 4),
        contentStrategyPresent(),
        validCTAButton(),
        topicEchoedInPrimaryText('AI sales automation SaaS platform'),
      ];
    case 'facebook_ads_realestate_retargeting':
      return [
        headlinePresent(),
        variationsCountWithinRange(2, 4),
        contentStrategyPresent(),
        validCTAButton(),
        topicEchoedInPrimaryText('luxury home listing open house virtual tour'),
      ];
    case 'facebook_ads_ecommerce_carousel':
      return [
        headlinePresent(),
        variationsCountWithinRange(2, 4),
        contentStrategyPresent(),
        validCTAButton(),
        topicEchoedInPrimaryText('summer collection fashion sale discount'),
      ];
    default:
      return [];
  }
}

export async function facebookAdsExpertExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? facebookInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {throw new Error(`[facebook-ads-expert-executor] No active GM for ${SPECIALIST_ID} industryKey=${industryKey}`);}
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {throw new Error(`[facebook-ads-expert-executor] GM systemPrompt too short`);}

  // Brand DNA is baked into the GM at seed time; baseSystemPrompt IS the resolved prompt.
  const resolvedSystemPrompt = baseSystemPrompt;

  const req: Parameters<typeof facebookInternal.buildGenerateContentUserPrompt>[0] = {
    action: 'generate_content',
    topic: parsed.topic,
    contentType: parsed.contentType,
    targetAudience: parsed.targetAudience,
    tone: parsed.tone,
    campaignGoal: parsed.campaignGoal,
    brandContext: parsed.brandContext as Parameters<typeof facebookInternal.buildGenerateContentUserPrompt>[0]['brandContext'],
    seoKeywords: parsed.seoKeywords as Parameters<typeof facebookInternal.buildGenerateContentUserPrompt>[0]['seoKeywords'],
  };
  const userPrompt = facebookInternal.buildGenerateContentUserPrompt(req);
  const schema: ZodTypeAny = facebookInternal.FacebookAdContentResultSchema;

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
