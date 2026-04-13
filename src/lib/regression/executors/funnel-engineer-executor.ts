/**
 * Funnel Engineer Regression Executor
 *
 * One action: design_funnel (full funnel design with stages, KPIs,
 * conversion targets, bottleneck risks, A/B test roadmap, recommendations,
 * and rationale).
 *
 * Invariant severity:
 *   - stagesCountWithinRange, abTestCountWithinRange,
 *     keyBottleneckRisksCountWithinRange, overallConversionWithinRange,
 *     tacticsAndKpiPresent, rationaleMentionsPricePoint are FAIL.
 *   - contextEchoedInRationale is WARN.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import { __internal as funnelInternal } from '@/lib/agents/builder/funnel/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import { captureSingleShot, type InvariantCheck } from '../capture/single-shot-capture';

const SPECIALIST_ID = 'FUNNEL_ENGINEER';
const MAX_TOKENS = 10000;

const RequirementsSchema = z
  .object({
    funnelType: z.string().optional(),
    businessModel: z.string().optional(),
    targetAudience: z.string().optional(),
    pricePoint: z.enum(['low', 'mid', 'high']).optional(),
    productName: z.string().optional(),
    trafficSource: z.string().optional(),
    currentConversionRate: z.number().min(0).max(1).optional(),
  })
  .optional();

const DesignFunnelPayloadSchema = z.object({
  action: z.literal('design_funnel'),
  industryKey: z.string().optional(),
  context: z.string().min(1),
  requirements: RequirementsSchema,
});

const CasePayloadSchema = z.object({}).passthrough().pipe(DesignFunnelPayloadSchema);

interface ParsedDesignFunnel {
  action: 'design_funnel';
  industryKey: string | undefined;
  context: string;
  requirements: z.infer<typeof RequirementsSchema>;
}

function parsePayload(raw: Record<string, unknown>): ParsedDesignFunnel {
  const result = CasePayloadSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `[funnel-engineer-executor] invalid case.inputPayload: ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  const data = result.data;

  const innerResult = funnelInternal.DesignFunnelRequestSchema.safeParse({
    action: data.action,
    context: data.context,
    requirements: data.requirements,
  });
  if (!innerResult.success) {
    throw new Error(
      `[funnel-engineer-executor] invalid design_funnel input: ${innerResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  return {
    action: 'design_funnel',
    industryKey: data.industryKey,
    context: innerResult.data.context,
    requirements: innerResult.data.requirements,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stagesCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `stages_count_between_${min}_and_${max}`,
    description: `stages array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const stages = parsed.stages;
      if (!Array.isArray(stages)) {return { passed: false, message: 'stages not an array' };}
      const ok = stages.length >= min && stages.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `stages.length=${stages.length} outside [${min}, ${max}]`,
      };
    },
  };
}

function abTestCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `ab_tests_count_between_${min}_and_${max}`,
    description: `abTestRoadmap array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const tests = parsed.abTestRoadmap;
      if (!Array.isArray(tests)) {return { passed: false, message: 'abTestRoadmap not an array' };}
      const ok = tests.length >= min && tests.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `abTestRoadmap.length=${tests.length} outside [${min}, ${max}]`,
      };
    },
  };
}

function keyBottleneckRisksCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `bottleneck_risks_count_between_${min}_and_${max}`,
    description: `keyBottleneckRisks array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const risks = parsed.keyBottleneckRisks;
      if (!Array.isArray(risks)) {return { passed: false, message: 'keyBottleneckRisks not an array' };}
      const ok = risks.length >= min && risks.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `keyBottleneckRisks.length=${risks.length} outside [${min}, ${max}]`,
      };
    },
  };
}

function overallConversionWithinRange(): InvariantCheck {
  return {
    id: 'overall_conversion_realistic',
    description: 'expectedOverallConversionPct must be 0.1-60 (a percentage, not a decimal)',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const pct = parsed.expectedOverallConversionPct;
      if (typeof pct !== 'number') {
        return { passed: false, message: 'expectedOverallConversionPct not a number' };
      }
      if (pct < 0.1 || pct > 60) {
        return {
          passed: false,
          message: `expectedOverallConversionPct=${pct} outside [0.1, 60] — looks like a decimal fraction or fantasy number`,
        };
      }
      return { passed: true };
    },
  };
}

function tacticsAndKpiPresent(): InvariantCheck {
  return {
    id: 'every_stage_has_tactics_and_kpis',
    description: 'every stage must have non-empty tacticsDescription and kpiDescription',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const stagesRaw: unknown = parsed.stages;
      if (!Array.isArray(stagesRaw)) {return { passed: false, message: 'stages not an array' };}
      const stages = stagesRaw as unknown[];
      for (let i = 0; i < stages.length; i += 1) {
        const stage: unknown = stages[i];
        if (!isObject(stage)) {
          return { passed: false, message: `stages[${i}] not an object` };
        }
        const tactics = stage.tacticsDescription;
        const kpis = stage.kpiDescription;
        if (typeof tactics !== 'string' || tactics.length < 30) {
          return { passed: false, message: `stages[${i}].tacticsDescription missing or under 30 chars` };
        }
        if (typeof kpis !== 'string' || kpis.length < 20) {
          return { passed: false, message: `stages[${i}].kpiDescription missing or under 20 chars` };
        }
      }
      return { passed: true };
    },
  };
}

function rationaleMentionsPricePoint(expected: string): InvariantCheck {
  return {
    id: `rationale_mentions_price_point_${expected}`,
    description: `rationale should reference the price point "${expected}"`,
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const rationale = parsed.rationale;
      if (typeof rationale !== 'string') {return { passed: false, message: 'rationale not a string' };}
      const lower = rationale.toLowerCase();
      // Accept either the price-point keyword itself or price/pricing/ticket/cost as proof of pricing reasoning
      const keywords = [expected.toLowerCase(), 'price', 'pricing', 'ticket', 'cost'];
      const found = keywords.some((w) => lower.includes(w));
      return {
        passed: found,
        message: found ? undefined : `no price-reasoning keyword from [${keywords.join(', ')}] found in rationale`,
      };
    },
  };
}

function contextEchoedInRationale(phrases: string[]): InvariantCheck {
  const cleaned = phrases
    .flatMap((p) => p.split(/\s+/))
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 4);
  return {
    id: 'context_echoed_in_rationale',
    description: `at least one distinctive word from the brief should appear in rationale`,
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const rationale = parsed.rationale;
      if (typeof rationale !== 'string') {return { passed: false, message: 'rationale not a string' };}
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
    case 'funnel_engineer_saas_b2b':
      return [
        stagesCountWithinRange(3, 7),
        abTestCountWithinRange(3, 6),
        keyBottleneckRisksCountWithinRange(2, 5),
        overallConversionWithinRange(),
        tacticsAndKpiPresent(),
        rationaleMentionsPricePoint('mid'),
        contextEchoedInRationale(['SaaS', 'trial', 'founder', 'operator', 'ARR']),
      ];
    case 'funnel_engineer_realestate_luxury':
      return [
        stagesCountWithinRange(3, 7),
        abTestCountWithinRange(3, 6),
        keyBottleneckRisksCountWithinRange(2, 5),
        overallConversionWithinRange(),
        tacticsAndKpiPresent(),
        rationaleMentionsPricePoint('high'),
        contextEchoedInRationale(['luxury', 'real estate', 'property', 'buyer', 'affluent']),
      ];
    case 'funnel_engineer_ecommerce_dtc':
      return [
        stagesCountWithinRange(3, 7),
        abTestCountWithinRange(3, 6),
        keyBottleneckRisksCountWithinRange(2, 5),
        overallConversionWithinRange(),
        tacticsAndKpiPresent(),
        rationaleMentionsPricePoint('low'),
        contextEchoedInRationale(['ecommerce', 'DTC', 'repeat', 'mobile', 'shopper']),
      ];
    default:
      return [];
  }
}

export async function funnelEngineerExecutor(args: {
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
    throw new Error(`[funnel-engineer-executor] No active GM for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[funnel-engineer-executor] GM systemPrompt too short`);
  }

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error('[funnel-engineer-executor] Brand DNA not configured');
  }

  const resolvedSystemPrompt = funnelInternal.buildResolvedSystemPrompt(baseSystemPrompt, brandDNA);

  const req: Parameters<typeof funnelInternal.buildDesignFunnelUserPrompt>[0] = {
    action: 'design_funnel',
    context: parsed.context,
    requirements: parsed.requirements,
  };
  const userPrompt = funnelInternal.buildDesignFunnelUserPrompt(req);
  const schema: ZodTypeAny = funnelInternal.FunnelDesignResultSchema;
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
