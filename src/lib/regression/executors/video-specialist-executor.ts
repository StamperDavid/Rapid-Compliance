/**
 * Video Specialist Regression Executor
 *
 * Knows how to turn a RegressionCase into a live single-shot capture against
 * a specified model. Mirrors how the production Video Specialist builds its
 * resolved system prompt (GM + Brand DNA) and user prompt (per-action) by
 * reusing the specialist's own `__internal` exports so the harness stays
 * locked to whatever the real specialist does.
 *
 * Only the `script_to_storyboard` action is supported — it is the only live
 * action the Video Specialist exposes (Task #24 rebuild). Adding new actions
 * means adding a new executor branch, not hand-rolling prompt logic here.
 *
 * This executor also demonstrates the per-invariant severity override: the
 * `personalizationEcho` invariant on personalized cases declares
 * severityOnFail='WARN' so David can review drift when a new model paraphrases
 * a prospect's name rather than having a content-level drift hard-block the
 * upgrade the way a schema or shape violation would.
 */

import { z, type ZodTypeAny } from 'zod';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import {
  __internal as videoInternal,
  type ScriptToStoryboardRequest,
} from '@/lib/agents/content/video/specialist';
import {
  REGRESSION_TEMPERATURE,
  type CaptureSignature,
  type RegressionCase,
} from '@/types/regression';
import {
  captureSingleShot,
  type InvariantCheck,
} from '../capture/single-shot-capture';

const SPECIALIST_ID = 'VIDEO_SPECIALIST';
const MAX_TOKENS = 6000;

// Outer wrapper validated at the harness boundary. The inner `input` is then
// run through the specialist's own ScriptToStoryboardRequestSchema so we match
// its exact contract without duplicating field declarations.
const CasePayloadSchema = z.object({
  action: z.literal('script_to_storyboard'),
  industryKey: z.string().optional(),
  input: z.record(z.string(), z.unknown()),
});

interface ParsedCase {
  industryKey: string | undefined;
  input: ScriptToStoryboardRequest;
}

function parsePayload(raw: Record<string, unknown>): ParsedCase {
  const outerResult = CasePayloadSchema.safeParse(raw);
  if (!outerResult.success) {
    throw new Error(
      `[video-specialist-executor] invalid case.inputPayload: ${outerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  const { action, industryKey, input } = outerResult.data;

  // Merge the action discriminator onto the inner input (same trick the
  // Copywriter executor uses) so the specialist's schema parses cleanly.
  const innerResult = videoInternal.ScriptToStoryboardRequestSchema.safeParse({
    ...input,
    action,
  });
  if (!innerResult.success) {
    throw new Error(
      `[video-specialist-executor] invalid script_to_storyboard input: ${innerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }

  return { industryKey, input: innerResult.data };
}

// ============================================================================
// INVARIANT FACTORIES
// ============================================================================

/**
 * Scene-count invariant. Redundant with shapeTolerances but explicit
 * invariants surface clearer diff output ("first scene hook empty" beats
 * "scenes[0].scriptText.length delta"). Default severity (FAIL).
 */
function sceneCountWithinRange(min: number, max: number): InvariantCheck {
  return {
    id: `scene_count_between_${min}_and_${max}`,
    description: `scenes array length must be within [${min}, ${max}]`,
    check: (parsed) => {
      if (parsed === null || typeof parsed !== 'object') {
        return { passed: false, message: 'parsed output is not an object' };
      }
      const scenes = (parsed as { scenes?: unknown[] }).scenes;
      if (!Array.isArray(scenes)) {
        return { passed: false, message: 'scenes is not an array' };
      }
      const ok = scenes.length >= min && scenes.length <= max;
      return {
        passed: ok,
        message: ok ? undefined : `scenes.length=${scenes.length} outside [${min}, ${max}]`,
      };
    },
  };
}

/**
 * First scene must have a substantive hook. Catches regressions where a new
 * model returns an empty or trivially short opening scene. Default severity
 * (FAIL) — a silent opener is structurally broken.
 */
function firstSceneHookNonempty(): InvariantCheck {
  return {
    id: 'first_scene_hook_nonempty',
    description: 'scenes[0].scriptText must be a non-empty string with length > 20',
    check: (parsed) => {
      if (parsed === null || typeof parsed !== 'object') {
        return { passed: false, message: 'parsed output is not an object' };
      }
      const scenes = (parsed as { scenes?: Array<{ scriptText?: unknown }> }).scenes;
      if (!Array.isArray(scenes) || scenes.length === 0) {
        return { passed: false, message: 'no scenes array or empty scenes' };
      }
      const firstScene = scenes[0];
      if (!firstScene || typeof firstScene !== 'object') {
        return { passed: false, message: 'scenes[0] is not an object' };
      }
      const scriptText = firstScene.scriptText;
      if (typeof scriptText !== 'string') {
        return { passed: false, message: 'scenes[0].scriptText is not a string' };
      }
      const ok = scriptText.length > 20;
      return {
        passed: ok,
        message: ok ? undefined : `scenes[0].scriptText too short (${scriptText.length} chars)`,
      };
    },
  };
}

/**
 * Personalization echo: the first scene must mention at least ONE of the
 * required tokens (case-insensitive). Marked severityOnFail='WARN' so David
 * can review drift when a new model paraphrases the prospect's name rather
 * than hard-blocking the upgrade on a content-level invariant.
 */
function personalizationEcho(requiredTokens: string[]): InvariantCheck {
  return {
    id: 'personalization_echo_first_scene',
    description: `scenes[0].scriptText must mention at least one of: ${requiredTokens.join(', ')}`,
    severityOnFail: 'WARN',
    check: (parsed) => {
      if (parsed === null || typeof parsed !== 'object') {
        return { passed: false, message: 'parsed output is not an object' };
      }
      const scenes = (parsed as { scenes?: Array<{ scriptText?: unknown }> }).scenes;
      if (!Array.isArray(scenes) || scenes.length === 0) {
        return { passed: false, message: 'no scenes array or empty scenes' };
      }
      const firstScene = scenes[0];
      if (!firstScene || typeof firstScene !== 'object') {
        return { passed: false, message: 'scenes[0] is not an object' };
      }
      const scriptText = firstScene.scriptText;
      if (typeof scriptText !== 'string') {
        return { passed: false, message: 'scenes[0].scriptText is not a string' };
      }
      const haystack = scriptText.toLowerCase();
      const found = requiredTokens.some((token) => haystack.includes(token.toLowerCase()));
      return {
        passed: found,
        message: found
          ? undefined
          : `scenes[0].scriptText did not mention any of: ${requiredTokens.join(', ')}`,
      };
    },
  };
}

// ============================================================================
// PER-CASE INVARIANT WIRING
// ============================================================================

function invariantsForCase(caseId: string): InvariantCheck[] {
  switch (caseId) {
    case 'video_specialist_youtube_documentary_75s':
      return [sceneCountWithinRange(4, 10), firstSceneHookNonempty()];
    case 'video_specialist_tiktok_energetic_30s':
      return [sceneCountWithinRange(4, 8), firstSceneHookNonempty()];
    case 'video_specialist_linkedin_talking_head_60s_personalized':
      return [
        sceneCountWithinRange(3, 8),
        firstSceneHookNonempty(),
        personalizationEcho(['acme', 'dana']),
      ];
    default:
      return [firstSceneHookNonempty()];
  }
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function videoSpecialistExecutor(args: {
  caseDoc: RegressionCase;
  modelId: string;
}): Promise<{
  signature: CaptureSignature;
  rawRequestBody: unknown;
  rawResponseBody: unknown;
}> {
  const parsed = parsePayload(args.caseDoc.inputPayload);
  const industryKey = parsed.industryKey ?? videoInternal.DEFAULT_INDUSTRY_KEY;

  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(`[video-specialist-executor] No active GM found for ${SPECIALIST_ID} industryKey=${industryKey}`);
  }
  const gmConfig = gmRecord.config;
  const baseSystemPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  if (baseSystemPrompt.length < 100) {
    throw new Error(`[video-specialist-executor] GM ${gmRecord.id} systemPrompt too short (${baseSystemPrompt.length} chars)`);
  }
  // Brand DNA is baked into the GM at seed time; baseSystemPrompt IS the resolved prompt.
  const resolvedSystemPrompt = baseSystemPrompt;
  const userPrompt = videoInternal.buildScriptToStoryboardUserPrompt(parsed.input);
  const schema: ZodTypeAny = videoInternal.StoryboardResultSchema;
  const invariants = invariantsForCase(args.caseDoc.caseId);

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
