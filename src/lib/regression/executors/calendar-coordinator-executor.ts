/**
 * Calendar Coordinator Regression Executor
 *
 * Knows how to turn a RegressionCase into a live single-shot capture against
 * a specified model. Mirrors how the production Calendar Coordinator builds
 * its resolved system prompt (GM + Brand DNA) and user prompt by reusing the
 * specialist's own `__internal` exports so the harness stays locked to
 * whatever the real specialist does.
 *
 * Only the `plan_calendar` action is supported — it is the only live action
 * the Calendar Coordinator exposes. Adding new actions means adding a new
 * executor branch, not hand-rolling prompt logic here.
 *
 * This executor also uses the per-invariant severity override: the
 * `platformBalanceCheck` invariant is marked severityOnFail='WARN' so David
 * can review drift when a new model piles all posts on one platform rather
 * than having a content-level balance issue hard-block the upgrade the way a
 * schema or content-fidelity violation would.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import {
  __internal as calendarInternal,
  type PlanCalendarRequest,
} from '@/lib/agents/content/calendar/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import {
  captureSingleShot,
  type InvariantCheck,
} from '../capture/single-shot-capture';

const SPECIALIST_ID = 'CALENDAR_COORDINATOR';
const MAX_TOKENS = 12000;

// Outer wrapper validated at the harness boundary. The inner `input` is then
// run through the specialist's own PlanCalendarRequestSchema so we match
// its exact contract without duplicating field declarations.
const CasePayloadSchema = z.object({
  action: z.literal('plan_calendar'),
  industryKey: z.string().optional(),
  input: z.record(z.string(), z.unknown()),
});

interface ParsedCase {
  industryKey: string | undefined;
  input: PlanCalendarRequest;
}

function parsePayload(raw: Record<string, unknown>): ParsedCase {
  const outerResult = CasePayloadSchema.safeParse(raw);
  if (!outerResult.success) {
    throw new Error(
      `[calendar-coordinator-executor] invalid case.inputPayload: ${outerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  const { action, industryKey, input } = outerResult.data;

  // Merge the action discriminator onto the inner input (same trick the
  // Video Specialist executor uses) so the specialist's schema parses cleanly.
  const innerResult = calendarInternal.PlanCalendarRequestSchema.safeParse({
    ...input,
    action,
  });
  if (!innerResult.success) {
    throw new Error(
      `[calendar-coordinator-executor] invalid plan_calendar input: ${innerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }

  return { industryKey, input: innerResult.data };
}

// ============================================================================
// INVARIANT FACTORIES
// ============================================================================

/**
 * Every input contentItem.id must appear in at least one schedule[].contentId.
 * Default severity (FAIL) — dropping content items is structurally broken.
 */
function everyContentIdEchoed(inputIds: string[]): InvariantCheck {
  return {
    id: 'every_content_id_echoed',
    description: 'every input contentItem.id must appear in schedule[].contentId at least once',
    check: (parsed) => {
      if (parsed === null || typeof parsed !== 'object') {
        return { passed: false, message: 'parsed output not an object' };
      }
      const schedule = (parsed as { schedule?: Array<{ contentId?: unknown }> }).schedule;
      if (!Array.isArray(schedule)) {
        return { passed: false, message: 'schedule is not an array' };
      }
      const scheduledIds = new Set(
        schedule.map((s) => s.contentId).filter((v): v is string => typeof v === 'string'),
      );
      const missing = inputIds.filter((id) => !scheduledIds.has(id));
      return {
        passed: missing.length === 0,
        message: missing.length === 0 ? undefined : `input contentIds missing from schedule: ${missing.join(', ')}`,
      };
    },
  };
}

/**
 * Every schedule[].contentId must match some id in inputIds. Default severity
 * (FAIL) — hallucinated content ids are structurally broken.
 */
function noHallucinatedContentIds(inputIds: string[]): InvariantCheck {
  return {
    id: 'no_hallucinated_content_ids',
    description: 'every schedule[].contentId must match an input contentItem.id',
    check: (parsed) => {
      if (parsed === null || typeof parsed !== 'object') {
        return { passed: false, message: 'parsed output not an object' };
      }
      const schedule = (parsed as { schedule?: Array<{ contentId?: unknown }> }).schedule;
      if (!Array.isArray(schedule)) {
        return { passed: false, message: 'schedule is not an array' };
      }
      const inputSet = new Set(inputIds);
      const hallucinated = schedule
        .map((s) => s.contentId)
        .filter((v): v is string => typeof v === 'string')
        .filter((id) => !inputSet.has(id));
      const unique = [...new Set(hallucinated)];
      return {
        passed: unique.length === 0,
        message: unique.length === 0 ? undefined : `hallucinated contentIds in schedule: ${unique.join(', ')}`,
      };
    },
  };
}

/**
 * Every schedule[].platform must be in the requestedPlatforms list. Default
 * severity (FAIL) — scheduling posts on platforms the caller did not request
 * is a contract violation.
 */
function platformsWithinRequestedSet(requestedPlatforms: string[]): InvariantCheck {
  return {
    id: 'platforms_within_requested_set',
    description: 'every schedule[].platform must be in the requested platforms list',
    check: (parsed) => {
      if (parsed === null || typeof parsed !== 'object') {
        return { passed: false, message: 'parsed output not an object' };
      }
      const schedule = (parsed as { schedule?: Array<{ platform?: unknown }> }).schedule;
      if (!Array.isArray(schedule)) {
        return { passed: false, message: 'schedule is not an array' };
      }
      const allowedSet = new Set(requestedPlatforms);
      const forbidden = schedule
        .map((s) => s.platform)
        .filter((v): v is string => typeof v === 'string')
        .filter((p) => !allowedSet.has(p));
      const unique = [...new Set(forbidden)];
      return {
        passed: unique.length === 0,
        message: unique.length === 0 ? undefined : `platforms not in requested set: ${unique.join(', ')}`,
      };
    },
  };
}

/**
 * No single platform should hold more than `maxRatio` fraction of the total
 * schedule. Marked severityOnFail='WARN' so David can review drift when a new
 * model piles all posts on one platform rather than hard-blocking the upgrade.
 */
function platformBalanceCheck(maxRatio: number = 0.8): InvariantCheck {
  return {
    id: 'platform_balance_check',
    description: `no single platform holds more than ${Math.round(maxRatio * 100)}% of the schedule`,
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (parsed === null || typeof parsed !== 'object') {
        return { passed: false, message: 'parsed output not an object' };
      }
      const schedule = (parsed as { schedule?: Array<{ platform?: unknown }> }).schedule;
      if (!Array.isArray(schedule) || schedule.length === 0) {
        return { passed: false, message: 'schedule is empty or not an array' };
      }
      const platformCounts = new Map<string, number>();
      for (const entry of schedule) {
        if (typeof entry.platform === 'string') {
          platformCounts.set(entry.platform, (platformCounts.get(entry.platform) ?? 0) + 1);
        }
      }
      let worstPlatform = '';
      let worstRatio = 0;
      for (const [platform, count] of platformCounts) {
        const ratio = count / schedule.length;
        if (ratio > worstRatio) {
          worstRatio = ratio;
          worstPlatform = platform;
        }
      }
      const passed = worstRatio <= maxRatio;
      return {
        passed,
        message: passed ? undefined : `platform "${worstPlatform}" holds ${Math.round(worstRatio * 100)}% of schedule (threshold: ${Math.round(maxRatio * 100)}%)`,
      };
    },
  };
}

// ============================================================================
// PER-CASE INVARIANT WIRING
// ============================================================================

function invariantsForCase(caseDoc: RegressionCase, input: PlanCalendarRequest): InvariantCheck[] {
  const inputIds = input.contentItems.map((c) => c.id);
  const requestedPlatforms = input.platforms;

  switch (caseDoc.caseId) {
    case 'calendar_coordinator_canonical_1month':
      return [
        everyContentIdEchoed(inputIds),
        noHallucinatedContentIds(inputIds),
        platformsWithinRequestedSet(requestedPlatforms),
        platformBalanceCheck(0.8),
      ];
    case 'calendar_coordinator_multiplatform_stress':
      return [
        everyContentIdEchoed(inputIds),
        noHallucinatedContentIds(inputIds),
        platformsWithinRequestedSet(requestedPlatforms),
        platformBalanceCheck(0.8),
      ];
    case 'calendar_coordinator_unusual_content_ids_fidelity':
      return [
        everyContentIdEchoed(inputIds),
        noHallucinatedContentIds(inputIds),
        platformsWithinRequestedSet(requestedPlatforms),
        platformBalanceCheck(0.8),
      ];
    default:
      return [everyContentIdEchoed(inputIds), noHallucinatedContentIds(inputIds)];
  }
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function calendarCoordinatorExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? calendarInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(`[calendar-coordinator-executor] No active GM found for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[calendar-coordinator-executor] GM ${gmRecord.id} systemPrompt too short (${baseSystemPrompt.length} chars)`);
  }

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error('[calendar-coordinator-executor] Brand DNA not configured');
  }

  const resolvedSystemPrompt = calendarInternal.buildResolvedSystemPrompt(baseSystemPrompt, brandDNA);
  const userPrompt = calendarInternal.buildPlanCalendarUserPrompt(parsed.input);
  const schema: ZodTypeAny = calendarInternal.PlanCalendarResultSchema;
  const invariants = invariantsForCase(args.caseDoc, parsed.input);

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
