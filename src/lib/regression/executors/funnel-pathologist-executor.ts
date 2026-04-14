/**
 * Funnel Pathologist Regression Executor
 *
 * One action: analyze_funnel (strategic funnel diagnosis — framework enum,
 * primary conversion leak enum, leak diagnosis, stage risk profile, critical
 * leak points, trust signal strategy, pricing psychology direction, urgency
 * and scarcity direction, recovery plays, key metrics to watch, rationale).
 *
 * Invariant severity:
 *   - funnelFrameworkValid, primaryConversionLeakValid,
 *     criticalLeakPointsCountWithinRange, recoveryPlaysCountWithinRange,
 *     keyMetricsCountWithinRange, rationaleNonempty are FAIL.
 *   - briefEchoedInRationale is WARN.
 *
 * NOTE: This is the Architect-layer Funnel Strategist (strategic funnel
 * diagnosis), NOT the Builder-layer Funnel Engineer (Task #36). Different
 * files, different jobs. Different EXECUTOR_REGISTRY key (FUNNEL_STRATEGIST
 * vs FUNNEL_ENGINEER) and different regression case ID prefix
 * (funnel_strategist_* vs funnel_engineer_*).
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { __internal as funnelInternal } from '@/lib/agents/architect/funnel/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import { captureSingleShot, type InvariantCheck } from '../capture/single-shot-capture';

const SPECIALIST_ID = 'FUNNEL_STRATEGIST';
const MAX_TOKENS = 12000;

const ALLOWED_FRAMEWORKS = [
  'LEAD_MAGNET_TRIPWIRE',
  'FREE_TRIAL',
  'BOOK_A_DEMO',
  'WEBINAR',
  'VSL_DIRECT',
  'PRODUCT_LED',
  'HIGH_TICKET_APPLICATION',
  'DIRECT_CHECKOUT',
] as const;

const ALLOWED_LEAKS = [
  'TOP_OF_FUNNEL_TRAFFIC',
  'LANDING_RELEVANCE',
  'OFFER_CLARITY',
  'TRUST_SIGNALS',
  'PRICING_FRICTION',
  'CHECKOUT_DROPOFF',
  'ACTIVATION_DROPOFF',
  'POST_PURCHASE_RETENTION',
] as const;

const AnalyzeFunnelPayloadSchema = z.object({
  action: z.literal('analyze_funnel'),
  industryKey: z.string().optional(),
  funnelType: z.string().min(1),
  businessType: z.string().min(1),
  stages: z.array(z.record(z.unknown())).optional().default([]),
  conversionPoints: z.array(z.record(z.unknown())).optional().default([]),
  brief: z.string().min(1),
});

const CasePayloadSchema = z.object({}).passthrough().pipe(AnalyzeFunnelPayloadSchema);

interface ParsedAnalyzeFunnel {
  action: 'analyze_funnel';
  industryKey: string | undefined;
  funnelType: string;
  businessType: string;
  stages: Array<Record<string, unknown>>;
  conversionPoints: Array<Record<string, unknown>>;
  brief: string;
}

function parsePayload(raw: Record<string, unknown>): ParsedAnalyzeFunnel {
  const result = CasePayloadSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `[funnel-pathologist-executor] invalid case.inputPayload: ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  const data = result.data;

  const innerResult = funnelInternal.AnalyzeFunnelRequestSchema.safeParse({
    action: data.action,
    funnelType: data.funnelType,
    businessType: data.businessType,
    stages: data.stages,
    conversionPoints: data.conversionPoints,
    brief: data.brief,
  });
  if (!innerResult.success) {
    throw new Error(
      `[funnel-pathologist-executor] invalid analyze_funnel input: ${innerResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  return {
    action: 'analyze_funnel',
    industryKey: data.industryKey,
    funnelType: innerResult.data.funnelType,
    businessType: innerResult.data.businessType,
    stages: innerResult.data.stages,
    conversionPoints: innerResult.data.conversionPoints,
    brief: innerResult.data.brief,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function funnelFrameworkValid(): InvariantCheck {
  return {
    id: 'funnel_framework_valid',
    description: `funnelFramework must be one of ${ALLOWED_FRAMEWORKS.join('|')}`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const v = parsed.funnelFramework;
      if (typeof v !== 'string') { return { passed: false, message: 'funnelFramework not a string' }; }
      const ok = (ALLOWED_FRAMEWORKS as readonly string[]).includes(v);
      return { passed: ok, message: ok ? undefined : `funnelFramework='${v}' not in enum` };
    },
  };
}

function primaryConversionLeakValid(): InvariantCheck {
  return {
    id: 'primary_conversion_leak_valid',
    description: `primaryConversionLeak must be one of ${ALLOWED_LEAKS.join('|')}`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const v = parsed.primaryConversionLeak;
      if (typeof v !== 'string') { return { passed: false, message: 'primaryConversionLeak not a string' }; }
      const ok = (ALLOWED_LEAKS as readonly string[]).includes(v);
      return { passed: ok, message: ok ? undefined : `primaryConversionLeak='${v}' not in enum` };
    },
  };
}

function criticalLeakPointsCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `critical_leak_points_count_between_${min}_and_${max}`,
    description: `criticalLeakPoints array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const arr = parsed.criticalLeakPoints;
      if (!Array.isArray(arr)) { return { passed: false, message: 'criticalLeakPoints not an array' }; }
      const ok = arr.length >= min && arr.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `criticalLeakPoints.length=${arr.length} outside [${min}, ${max}]`,
      };
    },
  };
}

function recoveryPlaysCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `recovery_plays_count_between_${min}_and_${max}`,
    description: `recoveryPlays array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const arr = parsed.recoveryPlays;
      if (!Array.isArray(arr)) { return { passed: false, message: 'recoveryPlays not an array' }; }
      const ok = arr.length >= min && arr.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `recoveryPlays.length=${arr.length} outside [${min}, ${max}]`,
      };
    },
  };
}

function keyMetricsCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `key_metrics_count_between_${min}_and_${max}`,
    description: `keyMetricsToWatch array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const arr = parsed.keyMetricsToWatch;
      if (!Array.isArray(arr)) { return { passed: false, message: 'keyMetricsToWatch not an array' }; }
      const ok = arr.length >= min && arr.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `keyMetricsToWatch.length=${arr.length} outside [${min}, ${max}]`,
      };
    },
  };
}

function rationaleNonempty(): InvariantCheck {
  return {
    id: 'rationale_nonempty',
    description: 'rationale must be a non-empty string of at least 150 chars',
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const r = parsed.rationale;
      if (typeof r !== 'string') { return { passed: false, message: 'rationale not a string' }; }
      const ok = r.length >= 150;
      return { passed: ok, message: ok ? undefined : `rationale.length=${r.length} below 150` };
    },
  };
}

function briefEchoedInRationale(phrases: string[]): InvariantCheck {
  const cleaned = phrases
    .flatMap((p) => p.split(/\s+/))
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 4);
  return {
    id: 'brief_echoed_in_rationale',
    description: `at least one distinctive word from the brief should appear in rationale`,
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const rationale = parsed.rationale;
      if (typeof rationale !== 'string') { return { passed: false, message: 'rationale not a string' }; }
      const lower = rationale.toLowerCase();
      const found = cleaned.some((w) => lower.includes(w));
      return {
        passed: found,
        message: found ? undefined : `no distinctive brief word found in rationale`,
      };
    },
  };
}

function invariantsForCase(caseDoc: RegressionCase): InvariantCheck[] {
  switch (caseDoc.caseId) {
    case 'funnel_pathologist_saas_sales_ops_free_trial':
      return [
        funnelFrameworkValid(),
        primaryConversionLeakValid(),
        criticalLeakPointsCountWithinRange(2, 6),
        recoveryPlaysCountWithinRange(3, 7),
        keyMetricsCountWithinRange(3, 7),
        rationaleNonempty(),
        briefEchoedInRationale(['SaaS', 'sales', 'velocity', 'founder', 'trial', 'outbound']),
      ];
    case 'funnel_pathologist_realestate_luxury_lead_capture':
      return [
        funnelFrameworkValid(),
        primaryConversionLeakValid(),
        criticalLeakPointsCountWithinRange(2, 6),
        recoveryPlaysCountWithinRange(3, 7),
        keyMetricsCountWithinRange(3, 7),
        rationaleNonempty(),
        briefEchoedInRationale(['luxury', 'editorial', 'real estate', 'wealth', 'restraint', 'nurture']),
      ];
    case 'funnel_pathologist_ecommerce_dtc_launch_direct_checkout':
      return [
        funnelFrameworkValid(),
        primaryConversionLeakValid(),
        criticalLeakPointsCountWithinRange(2, 6),
        recoveryPlaysCountWithinRange(3, 7),
        keyMetricsCountWithinRange(3, 7),
        rationaleNonempty(),
        briefEchoedInRationale(['DTC', 'sleep', 'mobile', 'founder', 'launch', 'magnesium', 'shipping']),
      ];
    default:
      return [];
  }
}

export async function funnelPathologistExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? funnelInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(`[funnel-pathologist-executor] No active GM for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[funnel-pathologist-executor] GM systemPrompt too short`);
  }
  // Brand DNA is baked into the GM at seed time; baseSystemPrompt IS the resolved prompt.
  const resolvedSystemPrompt = baseSystemPrompt;

  const req: Parameters<typeof funnelInternal.buildAnalyzeFunnelUserPrompt>[0] = {
    action: 'analyze_funnel',
    funnelType: parsed.funnelType,
    businessType: parsed.businessType,
    stages: parsed.stages,
    conversionPoints: parsed.conversionPoints,
    brief: parsed.brief,
  };
  const userPrompt = funnelInternal.buildAnalyzeFunnelUserPrompt(req);
  const schema: ZodTypeAny = funnelInternal.AnalyzeFunnelResultSchema;
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
