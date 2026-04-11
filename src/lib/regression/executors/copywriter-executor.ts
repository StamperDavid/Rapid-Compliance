/**
 * Copywriter Regression Executor
 *
 * Knows how to turn a RegressionCase into a live single-shot capture
 * against a specified model. Mirrors how the production Copywriter builds
 * its resolved system prompt (GM + Brand DNA) and user prompt (per-action).
 *
 * Uses the Copywriter's own `__internal` exports rather than duplicating the
 * prompt-build logic, so the harness stays locked to whatever the real
 * specialist does.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import {
  __internal as copywriterInternal,
  type PageCopyRequest,
  type ProposalRequest,
} from '@/lib/agents/content/copywriter/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import {
  captureSingleShot,
  type InvariantCheck,
} from '../capture/single-shot-capture';

const SPECIALIST_ID = 'COPYWRITER';
const MAX_TOKENS = 4096;

// Zod schemas that mirror the Copywriter's public request interfaces so we
// can validate at the harness boundary instead of casting with `as`.
const PageCopyInputSchema = z.object({
  action: z.literal('generate_page_copy'),
  pageId: z.string(),
  pageName: z.string(),
  pagePurpose: z.string().optional(),
  sections: z.array(z.object({
    id: z.string(),
    name: z.string(),
    purpose: z.string().optional(),
  })).optional(),
  seoKeywords: z.array(z.string()).optional(),
  titleTemplate: z.string().optional(),
  descriptionTemplate: z.string().optional(),
  toneOfVoice: z.string().optional(),
  keyPhrases: z.array(z.string()).optional(),
  avoidPhrases: z.array(z.string()).optional(),
});

const ProposalInputSchema = z.object({
  action: z.literal('generate_proposal'),
  leadId: z.string(),
  companyName: z.string(),
  contactName: z.string(),
  industry: z.string().optional(),
  painPoints: z.array(z.string()).optional(),
  techStack: z.array(z.string()).optional(),
  companySize: z.string().optional(),
  requestedInfo: z.array(z.string()).optional(),
});

const CasePayloadSchema = z.object({
  action: z.enum(['generate_page_copy', 'generate_proposal']),
  industryKey: z.string().optional(),
  input: z.record(z.string(), z.unknown()),
});

type ParsedPageCopyCase = { kind: 'page_copy'; industryKey: string | undefined; input: PageCopyRequest };
type ParsedProposalCase = { kind: 'proposal'; industryKey: string | undefined; input: ProposalRequest };
type ParsedCase = ParsedPageCopyCase | ParsedProposalCase;

function parsePayload(raw: Record<string, unknown>): ParsedCase {
  const outerResult = CasePayloadSchema.safeParse(raw);
  if (!outerResult.success) {
    throw new Error(
      `[copywriter-executor] invalid case.inputPayload: ${outerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  const { action, industryKey, input } = outerResult.data;

  if (action === 'generate_page_copy') {
    const innerResult = PageCopyInputSchema.safeParse({ ...input, action });
    if (!innerResult.success) {
      throw new Error(
        `[copywriter-executor] invalid generate_page_copy input: ${innerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      );
    }
    return { kind: 'page_copy', industryKey, input: innerResult.data };
  }

  const innerResult = ProposalInputSchema.safeParse({ ...input, action });
  if (!innerResult.success) {
    throw new Error(
      `[copywriter-executor] invalid generate_proposal input: ${innerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  return { kind: 'proposal', industryKey, input: innerResult.data };
}

function pageCopyInvariants(requestSectionIds: string[]): InvariantCheck[] {
  return [
    {
      id: 'headlines_h2_matches_sections_length',
      description: 'headlines.h2.length must equal sections.length',
      check: (parsed) => {
        if (parsed === null || typeof parsed !== 'object') {return { passed: false, message: 'parsed output is not an object' };}
        const obj = parsed as Record<string, unknown>;
        const headlines = obj.headlines as { h2?: unknown[] } | undefined;
        const sections = obj.sections as unknown[] | undefined;
        if (!Array.isArray(headlines?.h2) || !Array.isArray(sections)) {
          return { passed: false, message: 'missing headlines.h2 or sections arrays' };
        }
        const h2Len = headlines.h2.length;
        const secLen = sections.length;
        return {
          passed: h2Len === secLen,
          message: h2Len === secLen ? undefined : `h2.length=${h2Len} vs sections.length=${secLen}`,
        };
      },
    },
    {
      id: 'section_ids_match_requested',
      description: 'returned sections must contain every requested sectionId',
      check: (parsed) => {
        if (requestSectionIds.length === 0) {return { passed: true };}
        if (parsed === null || typeof parsed !== 'object') {return { passed: false, message: 'parsed output not an object' };}
        const sections = (parsed as { sections?: Array<{ sectionId?: unknown }> }).sections;
        if (!Array.isArray(sections)) {return { passed: false, message: 'sections not array' };}
        const returned = new Set(sections.map((s) => s.sectionId).filter((v): v is string => typeof v === 'string'));
        const missing = requestSectionIds.filter((id) => !returned.has(id));
        return {
          passed: missing.length === 0,
          message: missing.length === 0 ? undefined : `missing sectionIds: ${missing.join(', ')}`,
        };
      },
    },
  ];
}

function proposalInvariants(): InvariantCheck[] {
  return [
    {
      id: 'sections_between_3_and_5',
      description: 'proposal must have between 3 and 5 sections',
      check: (parsed) => {
        if (parsed === null || typeof parsed !== 'object') {return { passed: false, message: 'parsed output not an object' };}
        const sections = (parsed as { sections?: unknown[] }).sections;
        if (!Array.isArray(sections)) {return { passed: false, message: 'sections not array' };}
        const ok = sections.length >= 3 && sections.length <= 5;
        return {
          passed: ok,
          message: ok ? undefined : `section count=${sections.length}`,
        };
      },
    },
  ];
}

export async function copywriterExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? copywriterInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(`[copywriter-executor] No active GM found for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[copywriter-executor] GM ${gmRecord.id} systemPrompt too short (${baseSystemPrompt.length} chars)`);
  }

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error('[copywriter-executor] Brand DNA not configured');
  }

  const resolvedSystemPrompt = copywriterInternal.buildResolvedSystemPrompt(baseSystemPrompt, brandDNA);

  let userPrompt: string;
  let schema: ZodTypeAny;
  let invariants: InvariantCheck[];

  if (parsed.kind === 'page_copy') {
    userPrompt = copywriterInternal.buildPageCopyUserPrompt(parsed.input);
    schema = copywriterInternal.PageCopyResultSchema;
    const sectionIds = parsed.input.sections?.map((s) => s.id) ?? [];
    invariants = pageCopyInvariants(sectionIds);
  } else {
    userPrompt = copywriterInternal.buildProposalUserPrompt(parsed.input);
    schema = copywriterInternal.ProposalResultSchema;
    invariants = proposalInvariants();
  }

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
