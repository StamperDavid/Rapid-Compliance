'use client';

/**
 * Effects tool panel — applies special effects to the operator's EXISTING
 * selected clip. This is an EFFECTS editor, not a generator: it never creates
 * new footage. The operator picks a clip on the shared timeline, then taps a
 * one-tap LOOK or fine-tunes individual sliders. Every change drives the shared
 * reducer via UPDATE_CLIP with the complete `effect` object.
 *
 * Every control here maps to a field that is honoured in BOTH the live preview
 * (components/video-editor/Preview.tsx, via CSS filters + overlays) AND the
 * FFmpeg render (api/video/editor/render/route.ts). Nothing is faked: what the
 * operator sees on the timeline preview is what the final video renders.
 *
 * (B-roll generation used to live here. It now belongs to the Content Manager —
 * the generator endpoint and hook stay on disk but are no longer wired into the
 * editor.)
 */

import { useCallback, useMemo } from 'react';
import { Sparkles, RotateCcw, MousePointerClick } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SubsectionTitle, SectionDescription, Caption } from '@/components/ui/typography';
import { NEUTRAL_EFFECT, type ClipEffect, type EditorClip } from '../types';
import type { EditorToolProps } from '../editor-tools';
import {
  LOOK_PRESETS,
  COLOR_CONTROLS,
  FILTER_CONTROLS,
  SPEED_CONTROL,
  setEffectField,
  readEffectValue,
  type EffectControl,
  type LookPreset,
} from './effects/effect-presets';

/** True when a clip's effect differs from the neutral (no-effect) baseline. */
function hasAnyEffect(effect: ClipEffect | undefined): boolean {
  if (!effect) {
    return false;
  }
  return (
    effect.brightness !== 0 ||
    effect.contrast !== 1 ||
    effect.saturation !== 1 ||
    effect.hue !== 0 ||
    (effect.sepia ?? 0) > 0 ||
    (effect.grayscale ?? 0) > 0 ||
    (effect.blur ?? 0) > 0 ||
    (effect.sharpen ?? 0) > 0 ||
    (effect.vignette ?? 0) > 0 ||
    (effect.grain ?? 0) > 0 ||
    (effect.speed ?? 1) !== 1
  );
}

/** Display a control's current value with its unit. */
function formatValue(value: number, control: EffectControl): string {
  const rounded = control.step >= 1 ? Math.round(value) : Number(value.toFixed(2));
  return `${rounded}${control.unit ?? ''}`;
}

export default function VfxToolPanel({ state, dispatch }: EditorToolProps) {
  const selectedClip: EditorClip | undefined = useMemo(
    () => state.clips.find((c) => c.id === state.selectedClipId),
    [state.clips, state.selectedClipId],
  );

  const effect = selectedClip?.effect;

  const applyControl = useCallback(
    (control: EffectControl, value: number) => {
      if (!selectedClip) {
        return;
      }
      dispatch({
        type: 'UPDATE_CLIP',
        clipId: selectedClip.id,
        updates: { effect: setEffectField(effect, control.field, value) },
      });
    },
    [dispatch, selectedClip, effect],
  );

  const applyLook = useCallback(
    (preset: LookPreset) => {
      if (!selectedClip) {
        return;
      }
      dispatch({
        type: 'UPDATE_CLIP',
        clipId: selectedClip.id,
        updates: { effect: { ...preset.effect } },
      });
    },
    [dispatch, selectedClip],
  );

  const resetAll = useCallback(() => {
    if (!selectedClip) {
      return;
    }
    dispatch({
      type: 'UPDATE_CLIP',
      clipId: selectedClip.id,
      updates: { effect: { ...NEUTRAL_EFFECT } },
    });
  }, [dispatch, selectedClip]);

  // ── No clip selected ────────────────────────────────────────────────────
  if (!selectedClip) {
    return (
      <div className="flex h-full flex-col gap-4 overflow-y-auto pb-4">
        <Card className="border-dashed border-border-strong p-6 text-center">
          <MousePointerClick className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <SubsectionTitle as="h4">Pick a clip to add effects</SubsectionTitle>
          <SectionDescription className="mt-1">
            Click a clip on the timeline below, then choose a look or fine-tune the
            colour, filters, and speed here. Your changes show up in the preview right away.
          </SectionDescription>
          <Caption className="mt-3 block text-muted-foreground">
            {state.clips.length} clip(s) in this project
          </Caption>
        </Card>
      </div>
    );
  }

  const effectActive = hasAnyEffect(effect);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-4">
      {/* Selected clip + reset */}
      <Card className="border-border-strong p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <SubsectionTitle as="h4">Effects</SubsectionTitle>
            <SectionDescription className="mt-1 truncate">
              Editing <span className="font-medium text-foreground">{selectedClip.name}</span>
            </SectionDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={resetAll}
            disabled={!effectActive}
            className="shrink-0 gap-1.5"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </Card>

      {/* One-tap looks */}
      <Card className="border-border-strong p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <SubsectionTitle as="h4">Quick looks</SubsectionTitle>
        </div>
        <SectionDescription className="mb-3">
          One tap to style the whole clip. You can fine-tune afterwards.
        </SectionDescription>
        <div className="grid grid-cols-2 gap-2">
          {LOOK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyLook(preset)}
              title={preset.description}
              className="rounded-lg border border-border-light bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span className="block font-medium">{preset.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {preset.description}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Speed */}
      <Card className="border-border-strong p-4">
        <SliderRow
          control={SPEED_CONTROL}
          value={readEffectValue(effect, SPEED_CONTROL)}
          onChange={(v) => applyControl(SPEED_CONTROL, v)}
          helper="Slow down or speed up this clip. Its length on the timeline changes to match."
        />
      </Card>

      {/* Colour grade */}
      <Card className="border-border-strong p-4">
        <SubsectionTitle as="h4">Colour</SubsectionTitle>
        <div className="mt-3 flex flex-col gap-4">
          {COLOR_CONTROLS.map((control) => (
            <SliderRow
              key={control.field}
              control={control}
              value={readEffectValue(effect, control)}
              onChange={(v) => applyControl(control, v)}
            />
          ))}
        </div>
      </Card>

      {/* Filters */}
      <Card className="border-border-strong p-4">
        <SubsectionTitle as="h4">Filters</SubsectionTitle>
        <div className="mt-3 flex flex-col gap-4">
          {FILTER_CONTROLS.map((control) => (
            <SliderRow
              key={control.field}
              control={control}
              value={readEffectValue(effect, control)}
              onChange={(v) => applyControl(control, v)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Slider row
// ============================================================================

interface SliderRowProps {
  control: EffectControl;
  value: number;
  onChange: (value: number) => void;
  helper?: string;
}

function SliderRow({ control, value, onChange, helper }: SliderRowProps) {
  const atNeutral = Math.abs(value - control.neutral) < control.step / 2;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Caption className="text-foreground">{control.label}</Caption>
        <div className="flex items-center gap-2">
          <Caption className="tabular-nums text-muted-foreground">
            {formatValue(value, control)}
          </Caption>
          {!atNeutral && (
            <button
              type="button"
              onClick={() => onChange(control.neutral)}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              aria-label={`Reset ${control.label}`}
            >
              reset
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={control.label}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-elevated accent-primary"
      />
      {helper && <Caption className="mt-1 block text-muted-foreground">{helper}</Caption>}
    </div>
  );
}
