/**
 * Growth Analyst Regression Executor
 *
 * One action: generate_content (growth analysis with experiments + KPIs)
 *
 * Invariant severity:
 *   - experimentsCountWithinRange, prioritizedActionsPresent,
 *     kpiTargetsPresent, contentStrategyPresent are FAIL.
 *   - topicEchoedInAnalysis is WARN.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import {
  __internal as growthInternal,
} from '@/lib/agents/marketing/growth-analyst/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import {
  captureSingleShot,
  type InvariantCheck,
} from '../capture/single-shot-capture';

const SPECIALIST_ID = 'GROWTH_ANALYST';
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
      `[growth-analyst-executor] invalid case.inputPayload: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  const data = result.data;

  const innerResult = growthInternal.GenerateContentRequestSchema.safeParse({
    action: data.action, topic: data.topic, contentType: data.contentType,
    targetAudience: data.targetAudience, tone: data.tone, campaignGoal: data.campaignGoal,
    brandContext: data.brandContext, seoKeywords: data.seoKeywords,
  });
  if (!innerResult.success) {
    throw new Error(
      `[growth-analyst-executor] invalid generate_content input: ${innerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }

  return {
    action: 'generate_content', industryKey: data.industryKey,
    topic: innerResult.data.topic, contentType: innerResult.data.contentType,
    targetAudience: innerResult.data.targetAudience, tone: innerResult.data.tone,
    campaignGoal: innerResult.data.campaignGoal, brandContext: innerResult.data.brandContext,
    seoKeywords: innerResult.data.seoKeywords,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function experimentsCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `experiments_count_between_${min}_and_${max}`,
    description: `experiments array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const experiments = parsed.experiments;
      if (!Array.isArray(experiments)) {return { passed: false, message: 'experiments not an array' };}
      const ok = experiments.length >= min && experiments.length <= max;
      return { passed: ok, message: ok ? undefined : `experiments.length=${experiments.length} outside [${min}, ${max}]` };
    },
  };
}

function prioritizedActionsPresent(): InvariantCheck {
  return {
    id: 'prioritized_actions_present',
    description: 'prioritizedActions must have at least 3 entries',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const actions = parsed.prioritizedActions;
      if (!Array.isArray(actions)) {return { passed: false, message: 'prioritizedActions not an array' };}
      return { passed: actions.length >= 3, message: actions.length >= 3 ? undefined : `prioritizedActions.length=${actions.length} (minimum 3)` };
    },
  };
}

function kpiTargetsPresent(): InvariantCheck {
  return {
    id: 'kpi_targets_present',
    description: 'kpiTargets must have at least 3 entries',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const kpis = parsed.kpiTargets;
      if (!Array.isArray(kpis)) {return { passed: false, message: 'kpiTargets not an array' };}
      return { passed: kpis.length >= 3, message: kpis.length >= 3 ? undefined : `kpiTargets.length=${kpis.length} (minimum 3)` };
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
        return { passed: false, message: `contentStrategy missing or too short` };
      }
      return { passed: true };
    },
  };
}

function topicEchoedInAnalysis(topic: string): InvariantCheck {
  const words = topic.split(/\s+/).map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')).filter((w) => w.length >= 3);
  return {
    id: 'topic_echoed_in_analysis',
    description: `at least one topic word from "${topic}" should appear in analysis.currentState`,
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const analysis = parsed.analysis;
      if (!isObject(analysis)) {return { passed: false, message: 'analysis not an object' };}
      const state = analysis.currentState;
      if (typeof state !== 'string') {return { passed: false, message: 'currentState not a string' };}
      const lower = state.toLowerCase();
      const found = words.some((w) => lower.includes(w));
      return { passed: found, message: found ? undefined : `no topic word from "${topic}" found in currentState` };
    },
  };
}

function invariantsForCase(caseDoc: RegressionCase): InvariantCheck[] {
  switch (caseDoc.caseId) {
    case 'growth_analyst_saas_acquisition':
      return [
        experimentsCountWithinRange(3, 7),
        prioritizedActionsPresent(),
        kpiTargetsPresent(),
        contentStrategyPresent(),
        topicEchoedInAnalysis('customer acquisition SaaS trial conversion'),
      ];
    case 'growth_analyst_realestate_leads':
      return [
        experimentsCountWithinRange(3, 7),
        prioritizedActionsPresent(),
        kpiTargetsPresent(),
        contentStrategyPresent(),
        topicEchoedInAnalysis('real estate lead generation luxury market'),
      ];
    case 'growth_analyst_ecommerce_retention':
      return [
        experimentsCountWithinRange(3, 7),
        prioritizedActionsPresent(),
        kpiTargetsPresent(),
        contentStrategyPresent(),
        topicEchoedInAnalysis('ecommerce customer retention repeat purchase'),
      ];
    default:
      return [];
  }
}

export async function growthAnalystExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? growthInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {throw new Error(`[growth-analyst-executor] No active GM for ${SPECIALIST_ID} industryKey=${industryKey}`);}
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {throw new Error(`[growth-analyst-executor] GM systemPrompt too short`);}

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {throw new Error('[growth-analyst-executor] Brand DNA not configured');}

  const resolvedSystemPrompt = growthInternal.buildResolvedSystemPrompt(baseSystemPrompt, brandDNA);

  const req: Parameters<typeof growthInternal.buildGenerateContentUserPrompt>[0] = {
    action: 'generate_content', topic: parsed.topic, contentType: parsed.contentType,
    targetAudience: parsed.targetAudience, tone: parsed.tone, campaignGoal: parsed.campaignGoal,
    brandContext: parsed.brandContext as Parameters<typeof growthInternal.buildGenerateContentUserPrompt>[0]['brandContext'],
    seoKeywords: parsed.seoKeywords as Parameters<typeof growthInternal.buildGenerateContentUserPrompt>[0]['seoKeywords'],
  };
  const userPrompt = growthInternal.buildGenerateContentUserPrompt(req);
  const schema: ZodTypeAny = growthInternal.GrowthAnalysisResultSchema;
  const invariants = invariantsForCase(args.caseDoc);

  const capture = await captureSingleShot({
    modelId: args.modelId, systemPrompt: resolvedSystemPrompt, userMessage: userPrompt,
    temperature: REGRESSION_TEMPERATURE, maxTokens: MAX_TOKENS, schema, invariants, stripJsonFences: true,
  });

  return { signature: capture.signature, rawRequestBody: capture.rawRequestBody, rawResponseBody: capture.rawResponseBody };
}
