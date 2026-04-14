/**
 * Asset Generator Regression Executor
 *
 * Knows how to turn a RegressionCase into a live single-shot capture against
 * a specified model. Mirrors how the production Asset Generator builds its
 * resolved system prompt (GM + Brand DNA) and user prompt by reusing the
 * specialist's own `__internal` exports so the harness stays locked to
 * whatever the real specialist does.
 *
 * Only the `generate_asset_package` action is supported — it is the only live
 * action the Asset Generator exposes (Task #26 rebuild).
 *
 * IMPORTANT: The harness validates the LLM's PLAN output (the schema used is
 * AssetPackagePlanSchema), not the final enriched AssetPackageResult. DALL-E
 * image generation is NOT called by the regression executor — we only exercise
 * Claude's ability to produce a valid asset PLAN. That matches how the other
 * specialist executors work (prompt → JSON → structural capture, no side
 * effects on paid infrastructure).
 *
 * This executor also uses the per-invariant severity override: the
 * `industry_appropriate_language` invariant is marked severityOnFail='WARN'
 * because industry-tuned vocabulary is a soft signal — an upgrade that
 * loosens vocabulary fit should be flagged for owner review, not hard-block
 * the way a missing-variation or brand-name-drop would.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import {
  __internal as assetInternal,
  type GenerateAssetPackageRequest,
} from '@/lib/agents/builder/assets/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import {
  captureSingleShot,
  type InvariantCheck,
} from '../capture/single-shot-capture';

const SPECIALIST_ID = 'ASSET_GENERATOR';
const MAX_TOKENS = 6000;

// Outer wrapper validated at the harness boundary. The inner `input` is then
// run through the specialist's own GenerateAssetPackageRequestSchema so we
// match its exact contract without duplicating field declarations.
const CasePayloadSchema = z.object({
  action: z.literal('generate_asset_package'),
  industryKey: z.string().optional(),
  input: z.record(z.string(), z.unknown()),
});

interface ParsedCase {
  industryKey: string | undefined;
  input: GenerateAssetPackageRequest;
}

function parsePayload(raw: Record<string, unknown>): ParsedCase {
  const outerResult = CasePayloadSchema.safeParse(raw);
  if (!outerResult.success) {
    throw new Error(
      `[asset-generator-executor] invalid case.inputPayload: ${outerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  const { action, industryKey, input } = outerResult.data;

  // Merge the action discriminator onto the inner input (same trick the other
  // executors use) so the specialist's schema parses cleanly.
  const innerResult = assetInternal.GenerateAssetPackageRequestSchema.safeParse({
    ...input,
    action,
  });
  if (!innerResult.success) {
    throw new Error(
      `[asset-generator-executor] invalid generate_asset_package input: ${innerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }

  return { industryKey, input: innerResult.data };
}

// ============================================================================
// INVARIANT FACTORIES
// ============================================================================

const REQUIRED_LOGO_NAMES = ['primary', 'icon', 'monochrome'] as const;
type StrategyBearing = { strategy?: unknown; rationale?: unknown };

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * logo.variations must contain all 3 required names: primary, icon, monochrome.
 * Default severity (FAIL) — missing logo variations is structurally broken.
 */
function everyLogoVariationRequired(): InvariantCheck {
  return {
    id: 'every_logo_variation_required',
    description: 'logo.variations must contain primary, icon, and monochrome',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const logo = parsed.logo;
      if (!isObject(logo)) {
        return { passed: false, message: 'logo is not an object' };
      }
      const variations = logo.variations;
      if (!Array.isArray(variations)) {
        return { passed: false, message: 'logo.variations is not an array' };
      }
      const names = new Set(
        variations
          .map((v) => (isObject(v) && typeof v.name === 'string' ? v.name : null))
          .filter((v): v is string => v !== null),
      );
      const missing = REQUIRED_LOGO_NAMES.filter((n) => !names.has(n));
      return {
        passed: missing.length === 0,
        message: missing.length === 0 ? undefined : `Missing logo variations: ${missing.join(', ')}`,
      };
    },
  };
}

/**
 * Every prompt field across every section must be 80-1200 chars. Default
 * severity (FAIL) — out-of-range prompts will fail downstream DALL-E calls.
 */
function allPromptsMeetLength(): InvariantCheck {
  const MIN = 80;
  const MAX = 1200;
  return {
    id: 'all_prompts_meet_length',
    description: `every prompt field across logo, favicons, heroes, socialGraphics, banners must be ${MIN}-${MAX} chars`,
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const offenders: string[] = [];

      const checkPrompt = (path: string, value: unknown): void => {
        if (typeof value !== 'string') {
          offenders.push(`${path}: prompt missing or not a string`);
          return;
        }
        if (value.length < MIN || value.length > MAX) {
          offenders.push(`${path}: length=${value.length}`);
        }
      };

      const checkSectionVariations = (sectionName: string, section: unknown): void => {
        if (!isObject(section)) {
          offenders.push(`${sectionName}: section missing or not an object`);
          return;
        }
        const variations = section.variations;
        if (!Array.isArray(variations)) {
          offenders.push(`${sectionName}.variations: not an array`);
          return;
        }
        variations.forEach((v: unknown, idx: number) => {
          if (!isObject(v)) {
            offenders.push(`${sectionName}.variations[${idx}]: entry not an object`);
            return;
          }
          const name = typeof v.name === 'string' ? v.name : `idx${idx}`;
          checkPrompt(`${sectionName}.variations[${name}].prompt`, v.prompt);
        });
      };

      checkSectionVariations('logo', parsed.logo);
      checkSectionVariations('heroes', parsed.heroes);
      checkSectionVariations('socialGraphics', parsed.socialGraphics);
      checkSectionVariations('banners', parsed.banners);

      // favicons has a single top-level prompt (not variations)
      if (isObject(parsed.favicons)) {
        checkPrompt('favicons.prompt', parsed.favicons.prompt);
      } else {
        offenders.push('favicons: section missing or not an object');
      }

      return {
        passed: offenders.length === 0,
        message: offenders.length === 0 ? undefined : `prompts out of range: ${offenders.join('; ')}`,
      };
    },
  };
}

/**
 * heroes.variations.length must be within [min, max]. Default severity (FAIL)
 * — mismatched hero count means the LLM ignored the page list.
 */
function heroesCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `heroes_count_between_${min}_and_${max}`,
    description: `heroes.variations length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const heroes = parsed.heroes;
      if (!isObject(heroes)) {
        return { passed: false, message: 'heroes is not an object' };
      }
      const variations = heroes.variations;
      if (!Array.isArray(variations)) {
        return { passed: false, message: 'heroes.variations is not an array' };
      }
      const ok = variations.length >= min && variations.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `heroes.variations.length=${variations.length} outside [${min}, ${max}]`,
      };
    },
  };
}

/**
 * Every platform in requiredPlatforms must appear in at least one
 * socialGraphics.variations entry. Default severity (FAIL) — missing platform
 * coverage is a contract violation with the user prompt.
 */
function socialGraphicsCoverPlatforms(requiredPlatforms: string[]): InvariantCheck {
  return {
    id: 'social_graphics_cover_platforms',
    description: `socialGraphics.variations must cover every platform: ${requiredPlatforms.join(', ')}`,
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const socialGraphics = parsed.socialGraphics;
      if (!isObject(socialGraphics)) {
        return { passed: false, message: 'socialGraphics is not an object' };
      }
      const variations = socialGraphics.variations;
      if (!Array.isArray(variations)) {
        return { passed: false, message: 'socialGraphics.variations is not an array' };
      }
      const covered = new Set<string>();
      for (const v of variations) {
        if (isObject(v) && typeof v.platform === 'string') {
          covered.add(v.platform);
        }
      }
      const missing = requiredPlatforms.filter((p) => !covered.has(p));
      return {
        passed: missing.length === 0,
        message: missing.length === 0 ? undefined : `platforms not covered in socialGraphics: ${missing.join(', ')}`,
      };
    },
  };
}

/**
 * At least `thresholdRatio` of the expected industry keywords must appear
 * somewhere across strategy and rationale fields (case-insensitive).
 * Marked severityOnFail='WARN' — industry-tuning is a soft signal; drift
 * here should be reviewed, not hard-block an upgrade.
 */
function industryAppropriateLanguage(
  expectedKeywords: string[],
  thresholdRatio: number = 0.5,
): InvariantCheck {
  return {
    id: 'industry_appropriate_language',
    description: `at least ${Math.round(thresholdRatio * 100)}% of industry keywords must appear across strategy/rationale fields: ${expectedKeywords.join(', ')}`,
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const haystackParts: string[] = [];

      const pushStrategy = (section: unknown): void => {
        if (!isObject(section)) {
          return;
        }
        const bearing = section as StrategyBearing;
        if (typeof bearing.strategy === 'string') {
          haystackParts.push(bearing.strategy);
        }
        if (isObject(section) && Array.isArray(section.variations)) {
          for (const v of section.variations) {
            if (isObject(v) && typeof v.rationale === 'string') {
              haystackParts.push(v.rationale);
            }
          }
        }
      };

      pushStrategy(parsed.logo);
      pushStrategy(parsed.favicons);
      pushStrategy(parsed.heroes);
      pushStrategy(parsed.socialGraphics);
      pushStrategy(parsed.banners);

      const haystack = haystackParts.join(' \n ').toLowerCase();
      const matched = expectedKeywords.filter((kw) => haystack.includes(kw.toLowerCase()));
      const ratio = expectedKeywords.length === 0 ? 1 : matched.length / expectedKeywords.length;
      const ok = ratio >= thresholdRatio;
      return {
        passed: ok,
        message: ok
          ? undefined
          : `only ${matched.length}/${expectedKeywords.length} industry keywords present (${Math.round(ratio * 100)}% < ${Math.round(thresholdRatio * 100)}% threshold); matched: [${matched.join(', ')}]`,
      };
    },
  };
}

/**
 * The brand name must appear at least once across the strategy fields of
 * all five sections. Default severity (FAIL) — if the brand name is not
 * echoed anywhere in the strategy, the LLM did not actually read the brief.
 */
function brandNameEchoedInStrategies(brandName: string): InvariantCheck {
  return {
    id: 'brand_name_echoed_in_strategies',
    description: `brand name "${brandName}" must appear in at least one strategy field across logo, favicons, heroes, socialGraphics, banners`,
    check: (parsed) => {
      if (!isObject(parsed)) {
        return { passed: false, message: 'parsed output not an object' };
      }
      const sections = ['logo', 'favicons', 'heroes', 'socialGraphics', 'banners'] as const;
      const needle = brandName.toLowerCase();
      for (const sectionName of sections) {
        const section = parsed[sectionName];
        if (isObject(section)) {
          const bearing = section as StrategyBearing;
          if (typeof bearing.strategy === 'string' && bearing.strategy.toLowerCase().includes(needle)) {
            return { passed: true };
          }
        }
      }
      return {
        passed: false,
        message: `brand name "${brandName}" not found in any section strategy`,
      };
    },
  };
}

// ============================================================================
// PER-CASE INVARIANT WIRING
// ============================================================================

const DEFAULT_SOCIAL_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'facebook'];

function invariantsForCase(caseDoc: RegressionCase): InvariantCheck[] {
  switch (caseDoc.caseId) {
    case 'asset_generator_canonical_saas_package':
      return [
        everyLogoVariationRequired(),
        allPromptsMeetLength(),
        heroesCountWithinRange(2, 5),
        socialGraphicsCoverPlatforms(DEFAULT_SOCIAL_PLATFORMS),
        brandNameEchoedInStrategies('SalesVelocity.ai'),
      ];
    case 'asset_generator_minimalist_finance_package':
      return [
        everyLogoVariationRequired(),
        allPromptsMeetLength(),
        heroesCountWithinRange(2, 4),
        socialGraphicsCoverPlatforms(DEFAULT_SOCIAL_PLATFORMS),
        brandNameEchoedInStrategies('Meridian Capital'),
        industryAppropriateLanguage(['trust', 'stability', 'confidence', 'wealth', 'private', 'advisory']),
      ];
    case 'asset_generator_playful_consumer_no_pages':
      return [
        everyLogoVariationRequired(),
        allPromptsMeetLength(),
        heroesCountWithinRange(1, 1),
        socialGraphicsCoverPlatforms(DEFAULT_SOCIAL_PLATFORMS),
        brandNameEchoedInStrategies('Bloomberry'),
      ];
    default:
      return [everyLogoVariationRequired(), allPromptsMeetLength()];
  }
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function assetGeneratorExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? assetInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(`[asset-generator-executor] No active GM found for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[asset-generator-executor] GM ${gmRecord.id} systemPrompt too short (${baseSystemPrompt.length} chars)`);
  }
  // Brand DNA is baked into the GM at seed time; baseSystemPrompt IS the resolved prompt.
  const resolvedSystemPrompt = baseSystemPrompt;
  const userPrompt = assetInternal.buildGenerateAssetPackageUserPrompt(parsed.input);
  const schema: ZodTypeAny = assetInternal.AssetPackagePlanSchema;
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
