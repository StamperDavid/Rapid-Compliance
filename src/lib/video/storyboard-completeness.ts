/**
 * Shared "fill every field + continuity" guarantee for storyboard scenes.
 *
 * THE RULE (product requirement): when the AI drafts a video storyboard, EVERY
 * field is filled. A human may leave fields blank; the AI never may. Every path
 * that drafts storyboards runs its scenes through these helpers so the rule is
 * identical everywhere and can never drift between paths.
 *
 * Two jobs, applied scene-by-scene in order:
 *  1. CONTINUITY — most scenes share one world, so a field the AI left blank
 *     INHERITS from the previous scene (same location, lighting, film stock, look…).
 *     This is what makes the clips stitch into one cohesive film.
 *  2. NON-BLANK GUARANTEE — anything still empty after inheritance falls back to a
 *     brief-derived default (Setting/Cast/Sound) or the first curated preset
 *     (Camera & Look). Camera & Look names are resolved to real preset ids so the
 *     pickers render the selection instead of raw text.
 *
 * Used by:
 *  - lib/video/script-generation-service.ts  ("Draft with AI" / decompose path)
 *  - app/api/content/assistant/route.ts       (Content Assistant → Video Specialist path)
 */

import type { CinematicConfig } from '@/types/creative-studio';
import { getPresetsByCategory, resolvePresetId } from '@/lib/ai/cinematic-presets';

/**
 * The 10 Camera & Look fields filled per scene. Every one is both a key of
 * CinematicConfig (string-valued) and a valid PresetCategory, so each can be fed
 * straight to resolvePresetId / getPresetsByCategory.
 */
export type CinematicField =
  | 'shotType' | 'camera' | 'focalLength' | 'lensType' | 'lighting'
  | 'filmStock' | 'videographerStyle' | 'movieLook' | 'composition' | 'artStyle';

export const CINEMATIC_FIELDS: readonly CinematicField[] = [
  'shotType', 'camera', 'focalLength', 'lensType', 'lighting',
  'filmStock', 'videographerStyle', 'movieLook', 'composition', 'artStyle',
];

/**
 * Default Filters selection. `filters` is the one Camera & Look field that's a LIST
 * (string[]) rather than a single value, so it's filled separately from the loop
 * above. A single subtle, universally cinematic grain so the Filters field is never
 * left blank (id from FILTER_PRESETS in cinematic-presets.ts).
 */
const DEFAULT_FILTERS: readonly string[] = ['filter-grain'];

/** First value that is a non-empty string (after trim); '' if none qualify. */
export function firstFilled(...values: Array<string | undefined>): string {
  for (const v of values) {
    if (v !== undefined && v.trim() !== '') { return v; }
  }
  return '';
}

/** First curated preset id for a category — the deterministic last-resort default. */
export function defaultPresetId(category: CinematicField): string {
  return getPresetsByCategory(category)[0]?.id ?? '';
}

/** The six plain-language Setting / Cast / Sound fields. */
export interface StructuredSceneFields {
  location?: string;
  timeOfDay?: string;
  weather?: string;
  wardrobe?: string;
  ambience?: string;
  musicCue?: string;
}

export type StructuredDefaults = Required<StructuredSceneFields>;

/** Brief-derived defaults for the Setting / Cast / Sound fields. */
export function defaultStructuredFields(opts: { vibe?: string; energetic?: boolean }): StructuredDefaults {
  const vibe = opts.vibe?.trim();
  return {
    location: vibe
      ? `${vibe} — one consistent location across the video`
      : 'Modern open-plan tech office with floor-to-ceiling windows',
    timeOfDay: 'Late afternoon',
    weather: 'Clear, soft natural daylight',
    wardrobe: 'Smart-casual — a tailored blazer over a plain tee',
    ambience: 'Soft office ambience — distant keyboards, low chatter',
    musicCue: opts.energetic
      ? 'Driving electronic beat, building energy into the CTA'
      : 'Warm corporate underscore, building to the CTA',
  };
}

/**
 * Fill one scene's Camera & Look: resolve each AI-chosen name to a real preset id,
 * inherit the previous scene's value when blank (continuity), else a curated default.
 * `raw` values may be preset names or ids (shotType included — the caller maps it in).
 */
export function completeCinematicConfig(
  raw: Partial<Record<CinematicField, string | undefined>>,
  prev: CinematicConfig | undefined,
): CinematicConfig {
  const out: CinematicConfig = {};
  for (const field of CINEMATIC_FIELDS) {
    const aiValue = raw[field]?.trim();
    const resolved = aiValue ? resolvePresetId(field, aiValue) : undefined;
    out[field] = firstFilled(resolved, prev?.[field], defaultPresetId(field));
  }
  // filters is a string[] (the only multi-value Camera & Look field): inherit the
  // previous scene's filters for continuity, else a tasteful default — never blank.
  const inheritedFilters = prev?.filters;
  out.filters = inheritedFilters && inheritedFilters.length > 0 ? inheritedFilters : [...DEFAULT_FILTERS];
  return out;
}

/** Fill the six Setting / Cast / Sound fields: AI value → inherit previous → default. */
export function completeStructuredFields(
  scene: StructuredSceneFields,
  prev: StructuredSceneFields | undefined,
  defaults: StructuredDefaults,
): StructuredDefaults {
  const pick = (value: string | undefined, key: keyof StructuredDefaults): string =>
    firstFilled(value, prev?.[key], defaults[key]);
  return {
    location: pick(scene.location, 'location'),
    timeOfDay: pick(scene.timeOfDay, 'timeOfDay'),
    weather: pick(scene.weather, 'weather'),
    wardrobe: pick(scene.wardrobe, 'wardrobe'),
    ambience: pick(scene.ambience, 'ambience'),
    musicCue: pick(scene.musicCue, 'musicCue'),
  };
}
