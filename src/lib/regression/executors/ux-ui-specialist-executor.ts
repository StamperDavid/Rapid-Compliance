/**
 * UX/UI Specialist Regression Executor
 *
 * One action: design_page (strategic design direction — color psychology,
 * typography style, component selection direction, layout direction,
 * responsive direction, accessibility direction, design principles, key
 * design decisions, rationale).
 *
 * Invariant severity:
 *   - colorPsychologyNonempty, typographyStyleNonempty,
 *     designPrinciplesCountWithinRange, keyDesignDecisionsCountWithinRange,
 *     rationaleNonempty are FAIL.
 *   - briefEchoedInRationale is WARN.
 *
 * NOTE: This is the Architect-layer UX/UI Specialist (strategic design
 * picker), NOT the Builder-layer UX/UI Architect (Task #35). Different files,
 * different jobs. Different EXECUTOR_REGISTRY key (UX_UI_SPECIALIST vs
 * UX_UI_ARCHITECT) and different regression case ID prefix (ux_ui_specialist_*
 * vs ux_ui_architect_*).
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import { __internal as uxUiInternal } from '@/lib/agents/architect/ux-ui/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import { captureSingleShot, type InvariantCheck } from '../capture/single-shot-capture';

const SPECIALIST_ID = 'UX_UI_SPECIALIST';
const MAX_TOKENS = 8000;

const DesignPagePayloadSchema = z.object({
  action: z.literal('design_page'),
  industryKey: z.string().optional(),
  pageType: z.string().min(1),
  industry: z.string().min(1),
  toneOfVoice: z.string().min(1),
  funnelType: z.string().min(1),
  sections: z.array(z.string()).optional().default([]),
  brief: z.string().min(1),
});

const CasePayloadSchema = z.object({}).passthrough().pipe(DesignPagePayloadSchema);

interface ParsedDesignPage {
  action: 'design_page';
  industryKey: string | undefined;
  pageType: string;
  industry: string;
  toneOfVoice: string;
  funnelType: string;
  sections: string[];
  brief: string;
}

function parsePayload(raw: Record<string, unknown>): ParsedDesignPage {
  const result = CasePayloadSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `[ux-ui-specialist-executor] invalid case.inputPayload: ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  const data = result.data;

  const innerResult = uxUiInternal.DesignPageRequestSchema.safeParse({
    action: data.action,
    pageType: data.pageType,
    industry: data.industry,
    toneOfVoice: data.toneOfVoice,
    funnelType: data.funnelType,
    sections: data.sections,
    brief: data.brief,
  });
  if (!innerResult.success) {
    throw new Error(
      `[ux-ui-specialist-executor] invalid design_page input: ${innerResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  return {
    action: 'design_page',
    industryKey: data.industryKey,
    pageType: innerResult.data.pageType,
    industry: innerResult.data.industry,
    toneOfVoice: innerResult.data.toneOfVoice,
    funnelType: innerResult.data.funnelType,
    sections: innerResult.data.sections,
    brief: innerResult.data.brief,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function colorPsychologyNonempty(): InvariantCheck {
  return {
    id: 'color_psychology_nonempty',
    description: 'colorPsychology must be a non-empty string of at least 20 chars',
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const v = parsed.colorPsychology;
      if (typeof v !== 'string') { return { passed: false, message: 'colorPsychology not a string' }; }
      const ok = v.length >= 20;
      return { passed: ok, message: ok ? undefined : `colorPsychology.length=${v.length} below 20` };
    },
  };
}

function typographyStyleNonempty(): InvariantCheck {
  return {
    id: 'typography_style_nonempty',
    description: 'typographyStyle must be a non-empty string of at least 10 chars',
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const v = parsed.typographyStyle;
      if (typeof v !== 'string') { return { passed: false, message: 'typographyStyle not a string' }; }
      const ok = v.length >= 10;
      return { passed: ok, message: ok ? undefined : `typographyStyle.length=${v.length} below 10` };
    },
  };
}

function designPrinciplesCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `design_principles_count_between_${min}_and_${max}`,
    description: `designPrinciples array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const principles = parsed.designPrinciples;
      if (!Array.isArray(principles)) { return { passed: false, message: 'designPrinciples not an array' }; }
      const ok = principles.length >= min && principles.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `designPrinciples.length=${principles.length} outside [${min}, ${max}]`,
      };
    },
  };
}

function keyDesignDecisionsCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `key_design_decisions_count_between_${min}_and_${max}`,
    description: `keyDesignDecisions array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const decisions = parsed.keyDesignDecisions;
      if (!Array.isArray(decisions)) { return { passed: false, message: 'keyDesignDecisions not an array' }; }
      const ok = decisions.length >= min && decisions.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `keyDesignDecisions.length=${decisions.length} outside [${min}, ${max}]`,
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
    case 'ux_ui_specialist_saas_sales_ops_landing':
      return [
        colorPsychologyNonempty(),
        typographyStyleNonempty(),
        designPrinciplesCountWithinRange(3, 6),
        keyDesignDecisionsCountWithinRange(2, 5),
        rationaleNonempty(),
        briefEchoedInRationale(['SaaS', 'sales', 'velocity', 'founder', 'enterprise', 'restraint']),
      ];
    case 'ux_ui_specialist_realestate_luxury_homepage':
      return [
        colorPsychologyNonempty(),
        typographyStyleNonempty(),
        designPrinciplesCountWithinRange(3, 6),
        keyDesignDecisionsCountWithinRange(2, 5),
        rationaleNonempty(),
        briefEchoedInRationale(['luxury', 'editorial', 'real estate', 'wealth', 'restraint']),
      ];
    case 'ux_ui_specialist_ecommerce_dtc_launch_landing':
      return [
        colorPsychologyNonempty(),
        typographyStyleNonempty(),
        designPrinciplesCountWithinRange(3, 6),
        keyDesignDecisionsCountWithinRange(2, 5),
        rationaleNonempty(),
        briefEchoedInRationale(['DTC', 'sleep', 'mobile', 'founder', 'launch', 'magnesium']),
      ];
    default:
      return [];
  }
}

export async function uxUiSpecialistExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? uxUiInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(`[ux-ui-specialist-executor] No active GM for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[ux-ui-specialist-executor] GM systemPrompt too short`);
  }

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error('[ux-ui-specialist-executor] Brand DNA not configured');
  }

  const resolvedSystemPrompt = uxUiInternal.buildResolvedSystemPrompt(baseSystemPrompt, brandDNA);

  const req: Parameters<typeof uxUiInternal.buildDesignPageUserPrompt>[0] = {
    action: 'design_page',
    pageType: parsed.pageType,
    industry: parsed.industry,
    toneOfVoice: parsed.toneOfVoice,
    funnelType: parsed.funnelType,
    sections: parsed.sections,
    brief: parsed.brief,
  };
  const userPrompt = uxUiInternal.buildDesignPageUserPrompt(req);
  const schema: ZodTypeAny = uxUiInternal.DesignPageResultSchema;
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
