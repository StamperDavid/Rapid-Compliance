/**
 * Copy Specialist Regression Executor
 *
 * One action: generate_copy (strategic messaging direction — framework choice,
 * CTA strategy, voice direction, messaging pillars, key objections, page
 * messaging notes, headline direction, rationale).
 *
 * Invariant severity:
 *   - frameworkInValidEnum, ctaStrategyInValidEnum,
 *     pillarsCountWithinRange, keyObjectionsCountWithinRange,
 *     rationaleNonempty, pageMessagingNotesNonempty are FAIL.
 *   - briefEchoedInRationale is WARN.
 *
 * NOTE: This is the Architect-layer Copy Specialist (strategic messaging
 * picker), NOT the Content-layer Copywriter. Different files, different jobs.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import { __internal as copyInternal } from '@/lib/agents/architect/copy/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import { captureSingleShot, type InvariantCheck } from '../capture/single-shot-capture';

const SPECIALIST_ID = 'COPY_SPECIALIST';
const MAX_TOKENS = 8000;

const VALID_FRAMEWORKS = ['PAS', 'AIDA', 'BAB', 'FAB', 'FOUR_PS', 'STORYBRAND'] as const;
const VALID_CTA_STRATEGIES = ['urgency', 'value', 'risk_reversal', 'action', 'social_proof'] as const;

const GenerateCopyPayloadSchema = z.object({
  action: z.literal('generate_copy'),
  industryKey: z.string().optional(),
  pageType: z.string().min(1),
  funnelType: z.string().min(1),
  targetAudience: z.string().min(1),
  toneOfVoice: z.string().min(1),
  industry: z.string().min(1),
  brief: z.string().min(1),
});

const CasePayloadSchema = z.object({}).passthrough().pipe(GenerateCopyPayloadSchema);

interface ParsedGenerateCopy {
  action: 'generate_copy';
  industryKey: string | undefined;
  pageType: string;
  funnelType: string;
  targetAudience: string;
  toneOfVoice: string;
  industry: string;
  brief: string;
}

function parsePayload(raw: Record<string, unknown>): ParsedGenerateCopy {
  const result = CasePayloadSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `[copy-specialist-executor] invalid case.inputPayload: ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  const data = result.data;

  const innerResult = copyInternal.GenerateCopyRequestSchema.safeParse({
    action: data.action,
    pageType: data.pageType,
    funnelType: data.funnelType,
    targetAudience: data.targetAudience,
    toneOfVoice: data.toneOfVoice,
    industry: data.industry,
    brief: data.brief,
  });
  if (!innerResult.success) {
    throw new Error(
      `[copy-specialist-executor] invalid generate_copy input: ${innerResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  return {
    action: 'generate_copy',
    industryKey: data.industryKey,
    pageType: innerResult.data.pageType,
    funnelType: innerResult.data.funnelType,
    targetAudience: innerResult.data.targetAudience,
    toneOfVoice: innerResult.data.toneOfVoice,
    industry: innerResult.data.industry,
    brief: innerResult.data.brief,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function frameworkInValidEnum(): InvariantCheck {
  return {
    id: 'framework_in_valid_enum',
    description: `framework must be one of [${VALID_FRAMEWORKS.join(', ')}]`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const fw = parsed.framework;
      if (typeof fw !== 'string') { return { passed: false, message: 'framework not a string' }; }
      const ok = (VALID_FRAMEWORKS as readonly string[]).includes(fw);
      return {
        passed: ok,
        message: ok ? undefined : `framework=${fw} not in valid enum`,
      };
    },
  };
}

function ctaStrategyInValidEnum(): InvariantCheck {
  return {
    id: 'cta_strategy_in_valid_enum',
    description: `ctaStrategy must be one of [${VALID_CTA_STRATEGIES.join(', ')}]`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const cs = parsed.ctaStrategy;
      if (typeof cs !== 'string') { return { passed: false, message: 'ctaStrategy not a string' }; }
      const ok = (VALID_CTA_STRATEGIES as readonly string[]).includes(cs);
      return {
        passed: ok,
        message: ok ? undefined : `ctaStrategy=${cs} not in valid enum`,
      };
    },
  };
}

function pillarsCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `pillars_count_between_${min}_and_${max}`,
    description: `siteWideMessagingPillars array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const pillars = parsed.siteWideMessagingPillars;
      if (!Array.isArray(pillars)) { return { passed: false, message: 'siteWideMessagingPillars not an array' }; }
      const ok = pillars.length >= min && pillars.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `siteWideMessagingPillars.length=${pillars.length} outside [${min}, ${max}]`,
      };
    },
  };
}

function keyObjectionsCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `key_objections_count_between_${min}_and_${max}`,
    description: `keyObjections array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const objections = parsed.keyObjections;
      if (!Array.isArray(objections)) { return { passed: false, message: 'keyObjections not an array' }; }
      const ok = objections.length >= min && objections.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `keyObjections.length=${objections.length} outside [${min}, ${max}]`,
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
      return {
        passed: ok,
        message: ok ? undefined : `rationale.length=${r.length} below 150`,
      };
    },
  };
}

function pageMessagingNotesNonempty(): InvariantCheck {
  return {
    id: 'page_messaging_notes_nonempty',
    description: 'pageMessagingNotes must be non-empty prose of at least 80 chars',
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const n = parsed.pageMessagingNotes;
      if (typeof n !== 'string') { return { passed: false, message: 'pageMessagingNotes not a string' }; }
      const ok = n.length >= 80;
      return {
        passed: ok,
        message: ok ? undefined : `pageMessagingNotes.length=${n.length} below 80`,
      };
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
    case 'copy_specialist_saas_sales_ops_landing':
      return [
        frameworkInValidEnum(),
        ctaStrategyInValidEnum(),
        pillarsCountWithinRange(3, 6),
        keyObjectionsCountWithinRange(2, 5),
        rationaleNonempty(),
        pageMessagingNotesNonempty(),
        briefEchoedInRationale(['SaaS', 'sales', 'velocity', 'founder', 'team', 'tools']),
      ];
    case 'copy_specialist_realestate_luxury_homepage':
      return [
        frameworkInValidEnum(),
        ctaStrategyInValidEnum(),
        pillarsCountWithinRange(3, 6),
        keyObjectionsCountWithinRange(2, 5),
        rationaleNonempty(),
        pageMessagingNotesNonempty(),
        briefEchoedInRationale(['luxury', 'real estate', 'editorial', 'brokerage', 'wealth']),
      ];
    case 'copy_specialist_ecommerce_dtc_launch_landing':
      return [
        frameworkInValidEnum(),
        ctaStrategyInValidEnum(),
        pillarsCountWithinRange(3, 6),
        keyObjectionsCountWithinRange(2, 5),
        rationaleNonempty(),
        pageMessagingNotesNonempty(),
        briefEchoedInRationale(['DTC', 'lifestyle', 'sleep', 'magnesium', 'launch', 'mobile']),
      ];
    default:
      return [];
  }
}

export async function copySpecialistExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? copyInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(`[copy-specialist-executor] No active GM for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[copy-specialist-executor] GM systemPrompt too short`);
  }

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error('[copy-specialist-executor] Brand DNA not configured');
  }

  const resolvedSystemPrompt = copyInternal.buildResolvedSystemPrompt(baseSystemPrompt, brandDNA);

  const req: Parameters<typeof copyInternal.buildGenerateCopyUserPrompt>[0] = {
    action: 'generate_copy',
    pageType: parsed.pageType,
    funnelType: parsed.funnelType,
    targetAudience: parsed.targetAudience,
    toneOfVoice: parsed.toneOfVoice,
    industry: parsed.industry,
    brief: parsed.brief,
  };
  const userPrompt = copyInternal.buildGenerateCopyUserPrompt(req);
  const schema: ZodTypeAny = copyInternal.GenerateCopyResultSchema;
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
