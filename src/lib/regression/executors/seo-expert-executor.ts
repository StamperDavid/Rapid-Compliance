/**
 * SEO Expert Regression Executor
 *
 * Knows how to turn a RegressionCase into a live single-shot capture against
 * a specified model. Mirrors how the production SEO Expert builds its
 * resolved system prompt (GM + Brand DNA) and user prompt by reusing the
 * specialist's own `__internal` exports so the harness stays locked to
 * whatever the real specialist does.
 *
 * Two actions are supported:
 *   - keyword_research  (ranked keyword list + strategy for a seed term)
 *   - domain_analysis   (technical health + content gaps + recommendations)
 *
 * This executor uses per-invariant severity overrides: soft-signal invariants
 * like `keywordsOrderedByPriority`, `seedEchoedInKeywords`, and
 * `domainEchoedInSummary` are marked severityOnFail='WARN' so David can
 * review drift without hard-blocking upgrades the way a structural invariant
 * violation would.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import {
  __internal as seoInternal,
} from '@/lib/agents/marketing/seo/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import {
  captureSingleShot,
  type InvariantCheck,
} from '../capture/single-shot-capture';

const SPECIALIST_ID = 'SEO_EXPERT';
const MAX_TOKENS = 6000;

// Outer wrapper validated at the harness boundary. The inner fields are then
// run through the specialist's own request schemas so we match its exact
// contract without duplicating field declarations.
const KeywordResearchPayloadSchema = z.object({
  action: z.literal('keyword_research'),
  industryKey: z.string().optional(),
  seed: z.string().min(1),
  industry: z.string().min(1),
  targetCount: z.number().int().positive().optional(),
});

const DomainAnalysisPayloadSchema = z.object({
  action: z.literal('domain_analysis'),
  industryKey: z.string().optional(),
  domain: z.string().min(1),
  keywordLimit: z.number().int().positive().optional(),
});

const CasePayloadSchema = z.discriminatedUnion('action', [
  KeywordResearchPayloadSchema,
  DomainAnalysisPayloadSchema,
]);

type ParsedKeywordResearch = {
  action: 'keyword_research';
  industryKey: string | undefined;
  seed: string;
  industry: string;
  targetCount: number | undefined;
};

type ParsedDomainAnalysis = {
  action: 'domain_analysis';
  industryKey: string | undefined;
  domain: string;
  keywordLimit: number | undefined;
};

type ParsedCase = ParsedKeywordResearch | ParsedDomainAnalysis;

function parsePayload(raw: Record<string, unknown>): ParsedCase {
  const result = CasePayloadSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `[seo-expert-executor] invalid case.inputPayload: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  const data = result.data;

  if (data.action === 'keyword_research') {
    // Validate through the specialist's own schema
    const innerResult = seoInternal.KeywordResearchRequestSchema.safeParse({
      action: data.action,
      seed: data.seed,
      industry: data.industry,
      targetCount: data.targetCount,
    });
    if (!innerResult.success) {
      throw new Error(
        `[seo-expert-executor] invalid keyword_research input: ${innerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      );
    }
    return {
      action: 'keyword_research',
      industryKey: data.industryKey,
      seed: innerResult.data.seed,
      industry: innerResult.data.industry,
      targetCount: innerResult.data.targetCount,
    };
  }

  // domain_analysis
  const innerResult = seoInternal.DomainAnalysisRequestSchema.safeParse({
    action: data.action,
    domain: data.domain,
    keywordLimit: data.keywordLimit,
  });
  if (!innerResult.success) {
    throw new Error(
      `[seo-expert-executor] invalid domain_analysis input: ${innerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  return {
    action: 'domain_analysis',
    industryKey: data.industryKey,
    domain: innerResult.data.domain,
    keywordLimit: innerResult.data.keywordLimit,
  };
}

// ============================================================================
// HELPER
// ============================================================================

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ============================================================================
// INVARIANT FACTORIES — keyword_research
// ============================================================================

/**
 * keywords array length must be within [min, max]. Default severity (FAIL) —
 * returning too few or too many keywords is structurally broken.
 */
function keywordsCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `keywords_count_between_${min}_and_${max}`,
    description: `keywords array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const keywords = parsed.keywords;
      if (!Array.isArray(keywords)) {
        return { passed: false, message: 'keywords is not an array' };
      }
      const ok = keywords.length >= min && keywords.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `keywords.length=${keywords.length} outside [${min}, ${max}]`,
      };
    },
  };
}

/**
 * First 3 keywords should have difficulty 'low' or 'medium' (primary keywords
 * should be achievable). Marked severityOnFail='WARN' — this is a soft signal
 * about strategic ordering, not a structural contract violation.
 */
function keywordsOrderedByPriority(): InvariantCheck {
  return {
    id: 'keywords_ordered_by_priority',
    description: 'first 3 keywords should have difficulty low or medium (primary keywords should be achievable)',
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const keywords = parsed.keywords;
      if (!Array.isArray(keywords)) {
        return { passed: false, message: 'keywords is not an array' };
      }
      if (keywords.length < 3) {
        return { passed: false, message: `only ${keywords.length} keywords — need at least 3 to check ordering` };
      }
      const first3 = keywords.slice(0, 3);
      const achievable = first3.every(
        (kw) => isObject(kw) && (kw.difficulty === 'low' || kw.difficulty === 'medium'),
      );
      if (achievable) {
        return { passed: true };
      }
      const difficulties = first3.map(
        (kw) => (isObject(kw) ? String(kw.difficulty) : '(not an object)'),
      );
      return {
        passed: false,
        message: `first 3 keyword difficulties: [${difficulties.join(', ')}] — expected all low or medium`,
      };
    },
  };
}

/**
 * Every searchIntent must be one of the 4 valid values. Default severity (FAIL)
 * — invalid enum values are structurally broken.
 */
function allIntentsValid(): InvariantCheck {
  const VALID_INTENTS = new Set(['informational', 'navigational', 'transactional', 'commercial']);
  return {
    id: 'all_intents_valid',
    description: 'every keyword.searchIntent must be informational, navigational, transactional, or commercial',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const keywords = parsed.keywords;
      if (!Array.isArray(keywords)) {
        return { passed: false, message: 'keywords is not an array' };
      }
      const invalid: string[] = [];
      keywords.forEach((kw, idx) => {
        if (!isObject(kw)) {
          invalid.push(`keywords[${idx}]: not an object`);
          return;
        }
        if (typeof kw.searchIntent !== 'string' || !VALID_INTENTS.has(kw.searchIntent)) {
          invalid.push(`keywords[${idx}].searchIntent="${String(kw.searchIntent)}"`);
        }
      });
      return {
        passed: invalid.length === 0,
        message: invalid.length === 0 ? undefined : `invalid intents: ${invalid.join('; ')}`,
      };
    },
  };
}

/**
 * No two keywords identical (case-insensitive). Default severity (FAIL) —
 * duplicate keywords waste budget and indicate the LLM is padding output.
 */
function noDuplicateKeywords(): InvariantCheck {
  return {
    id: 'no_duplicate_keywords',
    description: 'no two keywords may be identical (case-insensitive)',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const keywords = parsed.keywords;
      if (!Array.isArray(keywords)) {
        return { passed: false, message: 'keywords is not an array' };
      }
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const kw of keywords) {
        if (!isObject(kw) || typeof kw.keyword !== 'string') { continue; }
        const lower = kw.keyword.toLowerCase();
        if (seen.has(lower)) {
          duplicates.push(kw.keyword);
        }
        seen.add(lower);
      }
      return {
        passed: duplicates.length === 0,
        message: duplicates.length === 0 ? undefined : `duplicate keywords: ${duplicates.join(', ')}`,
      };
    },
  };
}

/**
 * At least one keyword should contain or relate to the seed term. Marked
 * severityOnFail='WARN' — the LLM may legitimately derive semantically
 * related terms that do not literally contain the seed string.
 */
function seedEchoedInKeywords(seed: string): InvariantCheck {
  return {
    id: 'seed_echoed_in_keywords',
    description: `at least one keyword should contain the seed term "${seed}" (case-insensitive)`,
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const keywords = parsed.keywords;
      if (!Array.isArray(keywords)) {
        return { passed: false, message: 'keywords is not an array' };
      }
      const needle = seed.toLowerCase();
      const found = keywords.some(
        (kw) => isObject(kw) && typeof kw.keyword === 'string' && kw.keyword.toLowerCase().includes(needle),
      );
      return {
        passed: found,
        message: found ? undefined : `no keyword contains the seed term "${seed}"`,
      };
    },
  };
}

// ============================================================================
// INVARIANT FACTORIES — domain_analysis
// ============================================================================

/**
 * summary string must be non-empty and at least 50 chars. Default severity
 * (FAIL) — an empty or stub summary is structurally broken.
 */
function summaryPresent(): InvariantCheck {
  return {
    id: 'summary_present',
    description: 'summary must be a non-empty string of at least 50 characters',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const summary = parsed.summary;
      if (typeof summary !== 'string') {
        return { passed: false, message: 'summary is not a string' };
      }
      if (summary.length < 50) {
        return { passed: false, message: `summary.length=${summary.length} (minimum 50)` };
      }
      return { passed: true };
    },
  };
}

/**
 * recommendations array length must be within [min, max]. Default severity
 * (FAIL) — too few recommendations means the analysis is incomplete.
 */
function recommendationsCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `recommendations_count_between_${min}_and_${max}`,
    description: `recommendations array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const recommendations = parsed.recommendations;
      if (!Array.isArray(recommendations)) {
        return { passed: false, message: 'recommendations is not an array' };
      }
      const ok = recommendations.length >= min && recommendations.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `recommendations.length=${recommendations.length} outside [${min}, ${max}]`,
      };
    },
  };
}

/**
 * technicalHealth.score must be 0-100. Default severity (FAIL) — an
 * out-of-range score is structurally broken.
 */
function technicalHealthScoreValid(): InvariantCheck {
  return {
    id: 'technical_health_score_valid',
    description: 'technicalHealth.score must be a number between 0 and 100',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const technicalHealth = parsed.technicalHealth;
      if (!isObject(technicalHealth)) {
        return { passed: false, message: 'technicalHealth is not an object' };
      }
      const score = technicalHealth.score;
      if (typeof score !== 'number') {
        return { passed: false, message: `technicalHealth.score is ${typeof score}, not number` };
      }
      const ok = score >= 0 && score <= 100;
      return {
        passed: ok,
        message: ok ? undefined : `technicalHealth.score=${score} outside [0, 100]`,
      };
    },
  };
}

/**
 * At least 1 content gap must be present. Default severity (FAIL) — a domain
 * analysis without content gaps is incomplete.
 */
function contentGapsPresent(): InvariantCheck {
  return {
    id: 'content_gaps_present',
    description: 'contentGaps array must have at least 1 entry',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const contentGaps = parsed.contentGaps;
      if (!Array.isArray(contentGaps)) {
        return { passed: false, message: 'contentGaps is not an array' };
      }
      return {
        passed: contentGaps.length >= 1,
        message: contentGaps.length >= 1 ? undefined : 'contentGaps is empty',
      };
    },
  };
}

/**
 * The domain name should appear in the summary. Marked severityOnFail='WARN'
 * — the LLM may refer to the domain indirectly without using the exact string.
 */
function domainEchoedInSummary(domain: string): InvariantCheck {
  return {
    id: 'domain_echoed_in_summary',
    description: `domain "${domain}" should appear in the summary (case-insensitive)`,
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const summary = parsed.summary;
      if (typeof summary !== 'string') {
        return { passed: false, message: 'summary is not a string' };
      }
      const found = summary.toLowerCase().includes(domain.toLowerCase());
      return {
        passed: found,
        message: found ? undefined : `domain "${domain}" not found in summary`,
      };
    },
  };
}

// ============================================================================
// PER-CASE INVARIANT WIRING
// ============================================================================

function invariantsForCase(caseDoc: RegressionCase): InvariantCheck[] {
  switch (caseDoc.caseId) {
    case 'seo_expert_keyword_research_saas':
      return [
        keywordsCountWithinRange(10, 20),
        allIntentsValid(),
        noDuplicateKeywords(),
        seedEchoedInKeywords('sales automation'),
        keywordsOrderedByPriority(),
      ];
    case 'seo_expert_keyword_research_realestate':
      return [
        keywordsCountWithinRange(8, 18),
        allIntentsValid(),
        noDuplicateKeywords(),
        seedEchoedInKeywords('real estate'),
        keywordsOrderedByPriority(),
      ];
    case 'seo_expert_domain_analysis_rapidcompliance':
      return [
        summaryPresent(),
        recommendationsCountWithinRange(3, 10),
        technicalHealthScoreValid(),
        contentGapsPresent(),
        domainEchoedInSummary('rapidcompliance'),
      ];
    default:
      return [];
  }
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function seoExpertExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? seoInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(`[seo-expert-executor] No active GM found for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[seo-expert-executor] GM ${gmRecord.id} systemPrompt too short (${baseSystemPrompt.length} chars)`);
  }

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error('[seo-expert-executor] Brand DNA not configured');
  }

  const resolvedSystemPrompt = seoInternal.buildResolvedSystemPrompt(baseSystemPrompt, brandDNA);

  let userPrompt: string;
  let schema: ZodTypeAny;

  if (parsed.action === 'keyword_research') {
    const req = {
      action: 'keyword_research' as const,
      seed: parsed.seed,
      industry: parsed.industry,
      targetCount: parsed.targetCount,
    };
    const targetCount = req.targetCount ?? 15;
    userPrompt = seoInternal.buildKeywordResearchUserPrompt(req, targetCount);
    schema = seoInternal.KeywordResearchResultSchema;
  } else {
    const req = {
      action: 'domain_analysis' as const,
      domain: parsed.domain,
      keywordLimit: parsed.keywordLimit,
    };
    userPrompt = seoInternal.buildDomainAnalysisUserPrompt(req);
    schema = seoInternal.DomainAnalysisResultSchema;
  }

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
