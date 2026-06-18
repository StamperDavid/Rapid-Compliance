/**
 * Quick-edit "look" presets — one-tap filters.
 *
 * Each preset is a complete ClipEffect that the Quick Edits workspace applies to
 * a clip via UPDATE_CLIP. The values map to the same brightness/contrast/
 * saturation/hue chain the Preview renders (CSS filter) and the server render
 * (FFmpeg eq+hue) use — so what the operator taps is what they get on export.
 *
 * Ranges (from types.ts ClipEffect):
 *   brightness: -1.0 .. 1.0 (0 = none)
 *   contrast:    0.0 .. 2.0 (1 = none)
 *   saturation:  0.0 .. 2.0 (1 = none)
 *   hue:        -180 .. 180 (0 = none)
 */

import { NEUTRAL_EFFECT, type ClipEffect } from '../../types';

export interface LookPreset {
  id: string;
  label: string;
  /** One-line plain-English description of what the look does. */
  hint: string;
  effect: ClipEffect;
}

export const LOOK_PRESETS: readonly LookPreset[] = [
  {
    id: 'none',
    label: 'Original',
    hint: 'No filter — the clip as it was generated.',
    effect: { ...NEUTRAL_EFFECT },
  },
  {
    id: 'vivid',
    label: 'Vivid',
    hint: 'Punchy, saturated colors with extra contrast.',
    effect: { brightness: 0.05, contrast: 1.2, saturation: 1.4, hue: 0 },
  },
  {
    id: 'warm',
    label: 'Warm',
    hint: 'Cozy golden tone, gently lifted.',
    effect: { brightness: 0.08, contrast: 1.05, saturation: 1.15, hue: -12 },
  },
  {
    id: 'cool',
    label: 'Cool',
    hint: 'Crisp, blue-leaning cinematic tone.',
    effect: { brightness: 0.02, contrast: 1.1, saturation: 1.05, hue: 14 },
  },
  {
    id: 'bw',
    label: 'B&W',
    hint: 'Classic black and white.',
    effect: { brightness: 0.05, contrast: 1.15, saturation: 0, hue: 0 },
  },
];

const EFFECT_EPSILON = 0.001;

function effectsMatch(a: ClipEffect | undefined, b: ClipEffect): boolean {
  const e = a ?? NEUTRAL_EFFECT;
  return (
    Math.abs(e.brightness - b.brightness) < EFFECT_EPSILON &&
    Math.abs(e.contrast - b.contrast) < EFFECT_EPSILON &&
    Math.abs(e.saturation - b.saturation) < EFFECT_EPSILON &&
    Math.abs(e.hue - b.hue) < EFFECT_EPSILON
  );
}

/** Which preset (if any) a clip's current effect matches. Falls back to 'none'
 *  for an unset/neutral effect, or null when the effect was hand-tuned in Pro. */
export function activePresetId(effect: ClipEffect | undefined): string | null {
  for (const preset of LOOK_PRESETS) {
    if (effectsMatch(effect, preset.effect)) {
      return preset.id;
    }
  }
  return null;
}
