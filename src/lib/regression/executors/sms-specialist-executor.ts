/**
 * SMS Specialist Regression Executor
 *
 * One action: compose_sms (send-ready SMS — smsPurpose slug from Firestore
 * taxonomy, segmentStrategy enum, primaryMessage, charCount, ctaText,
 * complianceFooter, linkPlacementNotes, personalizationNotes, tone
 * reasoning, follow-up suggestion, compliance risks, rationale).
 *
 * Invariant severity:
 *   - smsPurposeInActiveTaxonomy, segmentStrategyValid,
 *     primaryMessageWithinHardLimit, primaryMessagePlusFooterUnderCap,
 *     rationaleNonempty are FAIL.
 *   - briefEchoedInRationale and personalizationVariablePresent are WARN.
 *
 * Unlike prior executors, this one validates BOTH the smsPurpose slug
 * against the live Firestore taxonomy AND the combined length of
 * primaryMessage + complianceFooter against the runtime maxCharCap
 * pulled from sms-settings.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import { getActiveSmsPurposeTypes } from '@/lib/services/sms-purpose-types-service';
import { getSmsSettings } from '@/lib/services/sms-settings-service';
import { __internal as smsInternal } from '@/lib/agents/outreach/sms/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import { captureSingleShot, type InvariantCheck } from '../capture/single-shot-capture';

const SPECIALIST_ID = 'SMS_SPECIALIST';
const MAX_TOKENS = 8000;

const VALID_SEGMENT_STRATEGIES = [
  'single_segment',
  'concat_short',
  'concat_medium',
  'concat_long',
  'concat_max',
] as const;

const ComposeSmsPayloadSchema = z.object({
  action: z.literal('compose_sms'),
  industryKey: z.string().optional(),
  campaignName: z.string().min(1),
  targetAudience: z.string().min(1),
  goal: z.string().min(1),
  suggestedPurposeSlug: z.string().min(1).optional(),
  sequenceStep: z.object({
    stepNumber: z.number().int().min(1).max(20),
    totalSteps: z.number().int().min(1).max(20),
    priorInteractions: z.string().optional(),
  }).optional(),
  brief: z.string().min(1),
});

const CasePayloadSchema = z.object({}).passthrough().pipe(ComposeSmsPayloadSchema);

interface ParsedComposeSms {
  action: 'compose_sms';
  industryKey: string | undefined;
  campaignName: string;
  targetAudience: string;
  goal: string;
  suggestedPurposeSlug: string | undefined;
  sequenceStep?: {
    stepNumber: number;
    totalSteps: number;
    priorInteractions?: string;
  };
  brief: string;
}

function parsePayload(raw: Record<string, unknown>): ParsedComposeSms {
  const result = CasePayloadSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `[sms-specialist-executor] invalid case.inputPayload: ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  const data = result.data;

  const innerResult = smsInternal.ComposeSmsRequestSchema.safeParse({
    action: data.action,
    campaignName: data.campaignName,
    targetAudience: data.targetAudience,
    goal: data.goal,
    suggestedPurposeSlug: data.suggestedPurposeSlug,
    sequenceStep: data.sequenceStep,
    brief: data.brief,
  });
  if (!innerResult.success) {
    throw new Error(
      `[sms-specialist-executor] invalid compose_sms input: ${innerResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  return {
    action: 'compose_sms',
    industryKey: data.industryKey,
    campaignName: innerResult.data.campaignName,
    targetAudience: innerResult.data.targetAudience,
    goal: innerResult.data.goal,
    suggestedPurposeSlug: innerResult.data.suggestedPurposeSlug,
    sequenceStep: innerResult.data.sequenceStep,
    brief: innerResult.data.brief,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function smsPurposeInActiveTaxonomy(validSlugs: ReadonlySet<string>): InvariantCheck {
  return {
    id: 'sms_purpose_in_active_taxonomy',
    description: `smsPurpose must be one of: ${[...validSlugs].join(' | ')}`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const v = parsed.smsPurpose;
      if (typeof v !== 'string') { return { passed: false, message: 'smsPurpose not a string' }; }
      const ok = validSlugs.has(v);
      return { passed: ok, message: ok ? undefined : `smsPurpose='${v}' not in active taxonomy` };
    },
  };
}

function segmentStrategyValid(): InvariantCheck {
  return {
    id: 'segment_strategy_valid',
    description: `segmentStrategy must be one of ${VALID_SEGMENT_STRATEGIES.join(' | ')}`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const v = parsed.segmentStrategy;
      if (typeof v !== 'string') { return { passed: false, message: 'segmentStrategy not a string' }; }
      const ok = (VALID_SEGMENT_STRATEGIES as readonly string[]).includes(v);
      return { passed: ok, message: ok ? undefined : `segmentStrategy='${v}' not in enum` };
    },
  };
}

function primaryMessageWithinHardLimit(): InvariantCheck {
  return {
    id: 'primary_message_within_hard_limit',
    description: 'primaryMessage must be 20-1600 chars (carrier absolute ceiling)',
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const v = parsed.primaryMessage;
      if (typeof v !== 'string') { return { passed: false, message: 'primaryMessage not a string' }; }
      const ok = v.length >= 20 && v.length <= 1600;
      return { passed: ok, message: ok ? undefined : `primaryMessage.length=${v.length} outside [20, 1600]` };
    },
  };
}

function primaryMessagePlusFooterUnderCap(maxCharCap: number): InvariantCheck {
  return {
    id: `primary_plus_footer_under_${maxCharCap}`,
    description: `primaryMessage + complianceFooter combined must be <= ${maxCharCap} chars (runtime soft cap from sms-settings)`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const body = typeof parsed.primaryMessage === 'string' ? parsed.primaryMessage : '';
      const footer = typeof parsed.complianceFooter === 'string' ? parsed.complianceFooter : '';
      const total = body.length + footer.length;
      const ok = total <= maxCharCap;
      return {
        passed: ok,
        message: ok ? undefined : `primaryMessage(${body.length}) + complianceFooter(${footer.length}) = ${total} > cap ${maxCharCap}`,
      };
    },
  };
}

function rationaleNonempty(): InvariantCheck {
  return {
    id: 'rationale_nonempty',
    description: 'rationale must be at least 100 chars',
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const r = parsed.rationale;
      if (typeof r !== 'string') { return { passed: false, message: 'rationale not a string' }; }
      const ok = r.length >= 100;
      return { passed: ok, message: ok ? undefined : `rationale.length=${r.length} below 100` };
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
    description: 'at least one distinctive word from the brief should appear in rationale',
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const rationale = parsed.rationale;
      if (typeof rationale !== 'string') { return { passed: false, message: 'rationale not a string' }; }
      const lower = rationale.toLowerCase();
      const found = cleaned.some((w) => lower.includes(w));
      return { passed: found, message: found ? undefined : 'no distinctive brief word found in rationale' };
    },
  };
}

function personalizationVariablePresent(): InvariantCheck {
  return {
    id: 'personalization_variable_present',
    description: 'primaryMessage or personalizationNotes should contain at least one {{variable}} merge tag',
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const body = typeof parsed.primaryMessage === 'string' ? parsed.primaryMessage : '';
      const notes = typeof parsed.personalizationNotes === 'string' ? parsed.personalizationNotes : '';
      const pattern = /\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/;
      const found = pattern.test(body) || pattern.test(notes);
      return { passed: found, message: found ? undefined : 'no {{variable}} merge tag found in body or notes' };
    },
  };
}

function buildInvariantsForCase(
  caseDoc: RegressionCase,
  validSlugs: ReadonlySet<string>,
  maxCharCap: number,
): InvariantCheck[] {
  switch (caseDoc.caseId) {
    case 'sms_specialist_saas_flash_offer':
      return [
        smsPurposeInActiveTaxonomy(validSlugs),
        segmentStrategyValid(),
        primaryMessageWithinHardLimit(),
        primaryMessagePlusFooterUnderCap(maxCharCap),
        rationaleNonempty(),
        briefEchoedInRationale(['SalesVelocity', 'annual', 'monthly', 'upgrade', 'contracts']),
        personalizationVariablePresent(),
      ];
    case 'sms_specialist_realestate_appointment_reminder':
      return [
        smsPurposeInActiveTaxonomy(validSlugs),
        segmentStrategyValid(),
        primaryMessageWithinHardLimit(),
        primaryMessagePlusFooterUnderCap(maxCharCap),
        rationaleNonempty(),
        briefEchoedInRationale(['luxury', 'real estate', 'Aspen', 'private', 'viewing', 'broker']),
        personalizationVariablePresent(),
      ];
    case 'sms_specialist_ecommerce_shipping_update':
      return [
        smsPurposeInActiveTaxonomy(validSlugs),
        segmentStrategyValid(),
        primaryMessageWithinHardLimit(),
        primaryMessagePlusFooterUnderCap(maxCharCap),
        rationaleNonempty(),
        briefEchoedInRationale(['DTC', 'sleep', 'magnesium', 'tracking', 'shipped', 'founder']),
        personalizationVariablePresent(),
      ];
    default:
      return [];
  }
}

export async function smsSpecialistExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? smsInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(`[sms-specialist-executor] No active GM for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[sms-specialist-executor] GM systemPrompt too short`);
  }

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error('[sms-specialist-executor] Brand DNA not configured');
  }

  const purposeTypes = await getActiveSmsPurposeTypes();
  if (purposeTypes.length === 0) {
    throw new Error('[sms-specialist-executor] No active SMS purpose types — run scripts/seed-sms-purpose-types.js');
  }
  const validSlugs = new Set(purposeTypes.map((t) => t.slug));

  const smsSettings = await getSmsSettings();

  const resolvedSystemPrompt = smsInternal.buildResolvedSystemPrompt(
    baseSystemPrompt,
    brandDNA,
    purposeTypes,
    smsSettings,
  );

  const req: Parameters<typeof smsInternal.buildComposeSmsUserPrompt>[0] = {
    action: 'compose_sms',
    campaignName: parsed.campaignName,
    targetAudience: parsed.targetAudience,
    goal: parsed.goal,
    suggestedPurposeSlug: parsed.suggestedPurposeSlug,
    sequenceStep: parsed.sequenceStep,
    brief: parsed.brief,
  };
  const userPrompt = smsInternal.buildComposeSmsUserPrompt(req, purposeTypes, smsSettings);
  const schema: ZodTypeAny = smsInternal.ComposeSmsResultSchema;
  const invariants = buildInvariantsForCase(args.caseDoc, validSlugs, smsSettings.maxCharCap);

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
