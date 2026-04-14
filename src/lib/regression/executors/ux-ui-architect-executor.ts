/**
 * UX/UI Architect Regression Executor
 *
 * One action: generate_design_system (full design system with tokens,
 * component guidelines, design principles, accessibility strategy, rationale).
 *
 * Invariant severity:
 *   - semanticColorsComplete, componentCountWithinRange, typographyScaleWithinRange,
 *     designPrinciplesCountWithinRange, coreComponentsPresent, accessibilityStrategyHasWcag
 *     are FAIL.
 *   - contextEchoedInRationale is WARN.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { __internal as uxUiInternal } from '@/lib/agents/builder/ux-ui/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import { captureSingleShot, type InvariantCheck } from '../capture/single-shot-capture';

const SPECIALIST_ID = 'UX_UI_ARCHITECT';
const MAX_TOKENS = 10000;

const RequirementsSchema = z
  .object({
    targetAudience: z.string().optional(),
    accessibilityLevel: z.enum(['A', 'AA', 'AAA']).optional(),
    brandColors: z.array(z.string()).optional(),
    industryHint: z.string().optional(),
    styleDirection: z.string().optional(),
    priorityComponents: z.array(z.string()).optional(),
  })
  .optional();

const GenerateDesignSystemPayloadSchema = z.object({
  action: z.literal('generate_design_system'),
  industryKey: z.string().optional(),
  context: z.string().min(1),
  requirements: RequirementsSchema,
});

const CasePayloadSchema = z.object({}).passthrough().pipe(GenerateDesignSystemPayloadSchema);

interface ParsedGenerateDesignSystem {
  action: 'generate_design_system';
  industryKey: string | undefined;
  context: string;
  requirements: z.infer<typeof RequirementsSchema>;
}

function parsePayload(raw: Record<string, unknown>): ParsedGenerateDesignSystem {
  const result = CasePayloadSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `[ux-ui-architect-executor] invalid case.inputPayload: ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  const data = result.data;

  const innerResult = uxUiInternal.GenerateDesignSystemRequestSchema.safeParse({
    action: data.action,
    context: data.context,
    requirements: data.requirements,
  });
  if (!innerResult.success) {
    throw new Error(
      `[ux-ui-architect-executor] invalid generate_design_system input: ${innerResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  return {
    action: 'generate_design_system',
    industryKey: data.industryKey,
    context: innerResult.data.context,
    requirements: innerResult.data.requirements,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function semanticColorsComplete(): InvariantCheck {
  return {
    id: 'semantic_colors_complete',
    description: 'tokens.colors.semantic must include success, warning, error, and info',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const tokens = parsed.tokens;
      if (!isObject(tokens)) {return { passed: false, message: 'tokens missing' };}
      const colors = tokens.colors;
      if (!isObject(colors)) {return { passed: false, message: 'tokens.colors missing' };}
      const semantic = colors.semantic;
      if (!isObject(semantic)) {return { passed: false, message: 'tokens.colors.semantic missing' };}
      const missing: string[] = [];
      for (const role of ['success', 'warning', 'error', 'info']) {
        if (!isObject(semantic[role])) {missing.push(role);}
      }
      if (missing.length > 0) {
        return { passed: false, message: `missing semantic roles: ${missing.join(', ')}` };
      }
      return { passed: true };
    },
  };
}

function componentCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `component_guidelines_count_between_${min}_and_${max}`,
    description: `componentGuidelines array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const guidelines = parsed.componentGuidelines;
      if (!Array.isArray(guidelines)) {return { passed: false, message: 'componentGuidelines not an array' };}
      const ok = guidelines.length >= min && guidelines.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `componentGuidelines.length=${guidelines.length} outside [${min}, ${max}]`,
      };
    },
  };
}

function typographyScaleWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `typography_scale_between_${min}_and_${max}`,
    description: `tokens.typography.scale length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const tokens = parsed.tokens;
      if (!isObject(tokens)) {return { passed: false, message: 'tokens missing' };}
      const typography = tokens.typography;
      if (!isObject(typography)) {return { passed: false, message: 'tokens.typography missing' };}
      const scale = typography.scale;
      if (!Array.isArray(scale)) {return { passed: false, message: 'typography.scale not an array' };}
      const ok = scale.length >= min && scale.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `typography.scale.length=${scale.length} outside [${min}, ${max}]`,
      };
    },
  };
}

function designPrinciplesCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `design_principles_count_between_${min}_and_${max}`,
    description: `designPrinciples array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const principles = parsed.designPrinciples;
      if (!Array.isArray(principles)) {return { passed: false, message: 'designPrinciples not an array' };}
      const ok = principles.length >= min && principles.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `designPrinciples.length=${principles.length} outside [${min}, ${max}]`,
      };
    },
  };
}

function coreComponentsPresent(): InvariantCheck {
  return {
    id: 'core_components_button_input_card',
    description: 'componentGuidelines must include Button, Input, and Card (case-insensitive)',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const guidelines = parsed.componentGuidelines;
      if (!Array.isArray(guidelines)) {return { passed: false, message: 'componentGuidelines not an array' };}
      const names = guidelines
        .map((g) => (isObject(g) && typeof g.name === 'string' ? g.name.toLowerCase() : ''))
        .filter((n) => n.length > 0);
      const missing: string[] = [];
      for (const required of ['button', 'input', 'card']) {
        const found = names.some((n) => n === required || n.includes(required));
        if (!found) {missing.push(required);}
      }
      if (missing.length > 0) {
        return { passed: false, message: `missing core components: ${missing.join(', ')}` };
      }
      return { passed: true };
    },
  };
}

function accessibilityStrategyHasWcag(): InvariantCheck {
  return {
    id: 'accessibility_strategy_cites_wcag',
    description: 'accessibilityStrategy must reference WCAG 2.1 and specify a level (A/AA/AAA)',
    check: (parsed) => {
      if (!isObject(parsed)) {return { passed: false, message: 'not an object' };}
      const strategy = parsed.accessibilityStrategy;
      if (typeof strategy !== 'string' || strategy.length < 100) {
        return { passed: false, message: 'accessibilityStrategy missing or too short' };
      }
      const lower = strategy.toLowerCase();
      const hasWcag = lower.includes('wcag');
      const hasLevel = /\b(aa|aaa|level a)\b/i.test(strategy);
      if (!hasWcag || !hasLevel) {
        return {
          passed: false,
          message: `accessibilityStrategy missing ${hasWcag ? '' : 'WCAG reference'}${!hasWcag && !hasLevel ? ' and ' : ''}${hasLevel ? '' : 'explicit level'}`,
        };
      }
      return { passed: true };
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
    case 'ux_ui_architect_saas_b2b':
      return [
        semanticColorsComplete(),
        componentCountWithinRange(4, 8),
        typographyScaleWithinRange(6, 9),
        designPrinciplesCountWithinRange(3, 6),
        coreComponentsPresent(),
        accessibilityStrategyHasWcag(),
        contextEchoedInRationale(['SaaS', 'dashboard', 'enterprise', 'revenue', 'sales']),
      ];
    case 'ux_ui_architect_realestate_luxury':
      return [
        semanticColorsComplete(),
        componentCountWithinRange(4, 8),
        typographyScaleWithinRange(6, 9),
        designPrinciplesCountWithinRange(3, 6),
        coreComponentsPresent(),
        accessibilityStrategyHasWcag(),
        contextEchoedInRationale(['luxury', 'editorial', 'real estate', 'property', 'buyer']),
      ];
    case 'ux_ui_architect_ecommerce_dtc':
      return [
        semanticColorsComplete(),
        componentCountWithinRange(4, 8),
        typographyScaleWithinRange(6, 9),
        designPrinciplesCountWithinRange(3, 6),
        coreComponentsPresent(),
        accessibilityStrategyHasWcag(),
        contextEchoedInRationale(['ecommerce', 'product', 'checkout', 'mobile', 'shopper']),
      ];
    default:
      return [];
  }
}

export async function uxUiArchitectExecutor(args: {
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
    throw new Error(`[ux-ui-architect-executor] No active GM for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[ux-ui-architect-executor] GM systemPrompt too short`);
  }
  // Brand DNA is baked into the GM at seed time; baseSystemPrompt IS the resolved prompt.
  const resolvedSystemPrompt = baseSystemPrompt;

  const req: Parameters<typeof uxUiInternal.buildGenerateDesignSystemUserPrompt>[0] = {
    action: 'generate_design_system',
    context: parsed.context,
    requirements: parsed.requirements,
  };
  const userPrompt = uxUiInternal.buildGenerateDesignSystemUserPrompt(req);
  const schema: ZodTypeAny = uxUiInternal.DesignSystemResultSchema;
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
