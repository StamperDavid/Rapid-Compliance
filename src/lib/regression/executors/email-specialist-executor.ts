/**
 * Email Specialist Regression Executor
 *
 * One action: compose_email (send-ready marketing email — emailPurpose slug
 * from Firestore taxonomy, subject line, preview text, plain-text body,
 * CTA line, PS line, tone reasoning, personalization notes, follow-up
 * suggestion, spam risk notes, rationale).
 *
 * Invariant severity:
 *   - emailPurposeInActiveTaxonomy, subjectLineWithinRange,
 *     bodyPlainTextNonempty, ctaLineNonempty, rationaleNonempty are FAIL.
 *   - briefEchoedInRationale and personalizationVariablePresent are WARN.
 *
 * Unlike prior specialist executors, this one validates `emailPurpose`
 * against the LIVE Firestore taxonomy (getActiveEmailPurposeTypes), not
 * against a hardcoded enum. This is the regression-harness counterpart to
 * the runtime validation in executeComposeEmail.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getActiveEmailPurposeTypes } from '@/lib/services/email-purpose-types-service';
import { __internal as emailInternal } from '@/lib/agents/outreach/email/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import { captureSingleShot, type InvariantCheck } from '../capture/single-shot-capture';

const SPECIALIST_ID = 'EMAIL_SPECIALIST';
const MAX_TOKENS = 12000;

const ComposeEmailPayloadSchema = z.object({
  action: z.literal('compose_email'),
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

const CasePayloadSchema = z.object({}).passthrough().pipe(ComposeEmailPayloadSchema);

interface ParsedComposeEmail {
  action: 'compose_email';
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

function parsePayload(raw: Record<string, unknown>): ParsedComposeEmail {
  const result = CasePayloadSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `[email-specialist-executor] invalid case.inputPayload: ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  const data = result.data;

  const innerResult = emailInternal.ComposeEmailRequestSchema.safeParse({
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
      `[email-specialist-executor] invalid compose_email input: ${innerResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  return {
    action: 'compose_email',
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

function emailPurposeInActiveTaxonomy(validSlugs: ReadonlySet<string>): InvariantCheck {
  return {
    id: 'email_purpose_in_active_taxonomy',
    description: `emailPurpose must be one of: ${[...validSlugs].join(' | ')}`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const v = parsed.emailPurpose;
      if (typeof v !== 'string') { return { passed: false, message: 'emailPurpose not a string' }; }
      const ok = validSlugs.has(v);
      return { passed: ok, message: ok ? undefined : `emailPurpose='${v}' not in active taxonomy` };
    },
  };
}

function subjectLineWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `subject_line_length_between_${min}_and_${max}`,
    description: `subjectLine must be ${min}-${max} chars`,
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const v = parsed.subjectLine;
      if (typeof v !== 'string') { return { passed: false, message: 'subjectLine not a string' }; }
      const ok = v.length >= min && v.length <= max;
      return { passed: ok, message: ok ? undefined : `subjectLine.length=${v.length} outside [${min}, ${max}]` };
    },
  };
}

function bodyPlainTextNonempty(): InvariantCheck {
  return {
    id: 'body_plain_text_nonempty',
    description: 'bodyPlainText must be at least 100 chars',
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const v = parsed.bodyPlainText;
      if (typeof v !== 'string') { return { passed: false, message: 'bodyPlainText not a string' }; }
      const ok = v.length >= 100;
      return { passed: ok, message: ok ? undefined : `bodyPlainText.length=${v.length} below 100` };
    },
  };
}

function ctaLineNonempty(): InvariantCheck {
  return {
    id: 'cta_line_nonempty',
    description: 'ctaLine must be at least 10 chars',
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const v = parsed.ctaLine;
      if (typeof v !== 'string') { return { passed: false, message: 'ctaLine not a string' }; }
      const ok = v.length >= 10;
      return { passed: ok, message: ok ? undefined : `ctaLine.length=${v.length} below 10` };
    },
  };
}

function rationaleNonempty(): InvariantCheck {
  return {
    id: 'rationale_nonempty',
    description: 'rationale must be at least 150 chars',
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
    description: 'bodyPlainText or personalizationNotes should contain at least one {{variable}} merge tag',
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) { return { passed: false, message: 'not an object' }; }
      const body = typeof parsed.bodyPlainText === 'string' ? parsed.bodyPlainText : '';
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
): InvariantCheck[] {
  switch (caseDoc.caseId) {
    case 'email_specialist_saas_cold_intro':
      return [
        emailPurposeInActiveTaxonomy(validSlugs),
        subjectLineWithinRange(5, 120),
        bodyPlainTextNonempty(),
        ctaLineNonempty(),
        rationaleNonempty(),
        briefEchoedInRationale(['SaaS', 'founder', 'outbound', 'agency', 'specialists']),
        personalizationVariablePresent(),
      ];
    case 'email_specialist_realestate_luxury_nurture':
      return [
        emailPurposeInActiveTaxonomy(validSlugs),
        subjectLineWithinRange(5, 120),
        bodyPlainTextNonempty(),
        ctaLineNonempty(),
        rationaleNonempty(),
        briefEchoedInRationale(['luxury', 'real estate', 'editorial', 'Aspen', 'quarterly', 'nurture']),
        personalizationVariablePresent(),
      ];
    case 'email_specialist_ecommerce_dtc_reengagement':
      return [
        emailPurposeInActiveTaxonomy(validSlugs),
        subjectLineWithinRange(5, 120),
        bodyPlainTextNonempty(),
        ctaLineNonempty(),
        rationaleNonempty(),
        briefEchoedInRationale(['DTC', 'sleep', 'magnesium', 'founder', 'batch', 'dormant']),
        personalizationVariablePresent(),
      ];
    default:
      return [];
  }
}

export async function emailSpecialistExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? emailInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(`[email-specialist-executor] No active GM for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[email-specialist-executor] GM systemPrompt too short`);
  }

  // Brand DNA is baked into the GM at seed time; baseSystemPrompt already has it.
  // Only purposeTypes need runtime injection because they can change via UI between seeds.
  const purposeTypes = await getActiveEmailPurposeTypes();
  if (purposeTypes.length === 0) {
    throw new Error('[email-specialist-executor] No active email purpose types — run scripts/seed-email-purpose-types.js');
  }
  const validSlugs = new Set(purposeTypes.map((t) => t.slug));

  const resolvedSystemPrompt = emailInternal.appendPurposeTaxonomy(baseSystemPrompt, purposeTypes);

  const req: Parameters<typeof emailInternal.buildComposeEmailUserPrompt>[0] = {
    action: 'compose_email',
    campaignName: parsed.campaignName,
    targetAudience: parsed.targetAudience,
    goal: parsed.goal,
    suggestedPurposeSlug: parsed.suggestedPurposeSlug,
    sequenceStep: parsed.sequenceStep,
    brief: parsed.brief,
  };
  const userPrompt = emailInternal.buildComposeEmailUserPrompt(req, purposeTypes);
  const schema: ZodTypeAny = emailInternal.ComposeEmailResultSchema;
  const invariants = buildInvariantsForCase(args.caseDoc, validSlugs);

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
