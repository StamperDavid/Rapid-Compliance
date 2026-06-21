/**
 * Effects editor — LOOK presets and adjustable control definitions.
 *
 * Every value here maps to a field on `ClipEffect`, and every field is honoured
 * in BOTH the live CSS preview (components/video-editor/Preview.tsx) and the
 * FFmpeg render (api/video/editor/render/route.ts). Nothing in this file is
 * decorative — a preset only sets fields the render pipeline actually applies.
 */

import { NEUTRAL_EFFECT, type ClipEffect } from '../../types';

/** A one-tap look: a full ClipEffect the operator can apply to the selected clip. */
export interface LookPreset {
  id: string;
  label: string;
  /** Plain-English description of what the look does. */
  description: string;
  effect: ClipEffect;
}

/**
 * One-tap looks. Each is a complete ClipEffect (built off NEUTRAL_EFFECT so any
 * unspecified field stays at its no-change default).
 */
export const LOOK_PRESETS: readonly LookPreset[] = [
  {
    id: 'none',
    label: 'None',
    description: 'Original clip, no effects.',
    effect: { ...NEUTRAL_EFFECT },
  },
  {
    id: 'vivid',
    label: 'Vivid',
    description: 'Punchier colour and contrast.',
    effect: { ...NEUTRAL_EFFECT, contrast: 1.18, saturation: 1.35, brightness: 0.03 },
  },
  {
    id: 'warm',
    label: 'Warm',
    description: 'Golden, sunlit tone.',
    effect: { ...NEUTRAL_EFFECT, saturation: 1.1, brightness: 0.04, hue: -8 },
  },
  {
    id: 'cool',
    label: 'Cool',
    description: 'Crisp, blue-leaning tone.',
    effect: { ...NEUTRAL_EFFECT, saturation: 0.95, brightness: 0.01, hue: 12 },
  },
  {
    id: 'bw',
    label: 'B&W',
    description: 'Classic black and white.',
    effect: { ...NEUTRAL_EFFECT, grayscale: 1, contrast: 1.1 },
  },
  {
    id: 'sepia',
    label: 'Sepia',
    description: 'Warm vintage photo tone.',
    effect: { ...NEUTRAL_EFFECT, sepia: 1, contrast: 1.05 },
  },
  {
    id: 'vintage',
    label: 'Vintage',
    description: 'Faded film with soft grain and vignette.',
    effect: {
      ...NEUTRAL_EFFECT,
      sepia: 0.45,
      contrast: 0.95,
      saturation: 0.85,
      vignette: 0.4,
      grain: 0.3,
    },
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'High-contrast film look with vignette.',
    effect: {
      ...NEUTRAL_EFFECT,
      contrast: 1.22,
      saturation: 0.92,
      brightness: -0.03,
      vignette: 0.35,
    },
  },
  {
    id: 'dream',
    label: 'Dreamy',
    description: 'Soft, glowing blur.',
    effect: { ...NEUTRAL_EFFECT, blur: 2.5, brightness: 0.06, saturation: 1.1 },
  },
  {
    id: 'crisp',
    label: 'Crisp',
    description: 'Sharper detail and clean contrast.',
    effect: { ...NEUTRAL_EFFECT, sharpen: 1.2, contrast: 1.08 },
  },
];

/** A single adjustable slider bound to one numeric ClipEffect field. */
export interface EffectControl {
  /** The ClipEffect field this slider drives. */
  field: keyof ClipEffect;
  label: string;
  min: number;
  max: number;
  step: number;
  /** The no-change value (slider "off" / neutral position). */
  neutral: number;
  /** Optional unit shown next to the value (e.g. '°', '×', 'px'). */
  unit?: string;
}

/** Colour-grade sliders (always relevant). */
export const COLOR_CONTROLS: readonly EffectControl[] = [
  { field: 'brightness', label: 'Brightness', min: -1, max: 1, step: 0.01, neutral: 0 },
  { field: 'contrast', label: 'Contrast', min: 0, max: 2, step: 0.01, neutral: 1, unit: '×' },
  { field: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.01, neutral: 1, unit: '×' },
  { field: 'hue', label: 'Hue', min: -180, max: 180, step: 1, neutral: 0, unit: '°' },
];

/** Stylising-filter sliders. */
export const FILTER_CONTROLS: readonly EffectControl[] = [
  { field: 'grayscale', label: 'Black & white', min: 0, max: 1, step: 0.01, neutral: 0 },
  { field: 'sepia', label: 'Sepia', min: 0, max: 1, step: 0.01, neutral: 0 },
  { field: 'blur', label: 'Blur', min: 0, max: 20, step: 0.1, neutral: 0, unit: 'px' },
  { field: 'sharpen', label: 'Sharpen', min: 0, max: 2, step: 0.01, neutral: 0 },
  { field: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.01, neutral: 0 },
  { field: 'grain', label: 'Film grain', min: 0, max: 1, step: 0.01, neutral: 0 },
];

/** Playback-speed control (own group; changes the clip's timeline length). */
export const SPEED_CONTROL: EffectControl = {
  field: 'speed',
  label: 'Speed',
  min: 0.5,
  max: 2,
  step: 0.05,
  neutral: 1,
  unit: '×',
};

/**
 * Set a single numeric effect field and return a complete ClipEffect. Always
 * starts from a fully-populated NEUTRAL_EFFECT base so the reducer's shallow
 * merge of `effect` (UPDATE_CLIP replaces the whole object) never loses sibling
 * fields. Every controllable field on ClipEffect is a `number`, so this stays
 * fully typed without `any` or index-signature widening.
 */
export function setEffectField(
  current: ClipEffect | undefined,
  field: EffectControl['field'],
  value: number,
): ClipEffect {
  return { ...NEUTRAL_EFFECT, ...current, [field]: value };
}

/** Read a numeric field from an effect, falling back to the neutral value. */
export function readEffectValue(
  effect: ClipEffect | undefined,
  control: EffectControl,
): number {
  const raw = effect?.[control.field];
  return typeof raw === 'number' ? raw : control.neutral;
}
