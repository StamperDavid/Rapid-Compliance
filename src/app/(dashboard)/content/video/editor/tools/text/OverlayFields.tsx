'use client';

/**
 * The editable property set for ONE text overlay — text, position, font size,
 * text colour, background colour. Shared by the "add" form and the "edit
 * selected" form so both surfaces stay identical. Fully controlled: the parent
 * owns the values and receives a partial update on every change.
 */

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Caption } from '@/components/ui/typography';
import type { TextOverlay } from '../../types';
import {
  BACKGROUND_SWATCHES,
  COLOR_SWATCHES,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  POSITIONS,
} from './overlay-helpers';

/** The subset of an overlay the operator edits directly in this panel. */
export type OverlayDraft = Pick<
  TextOverlay,
  'text' | 'position' | 'fontSize' | 'fontColor' | 'backgroundColor'
>;

interface OverlayFieldsProps {
  draft: OverlayDraft;
  /** Stable id prefix so labels/inputs pair up when two field sets render. */
  idPrefix: string;
  onChange: (updates: Partial<OverlayDraft>) => void;
}

function SwatchRow({
  options,
  selected,
  onPick,
  ariaLabel,
}: {
  options: { value: string; label: string }[];
  selected: string;
  onPick: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const isSelected = selected.toLowerCase() === opt.value.toLowerCase();
        const isTransparent = opt.value === 'transparent';
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            title={opt.label}
            onClick={() => onPick(opt.value)}
            className={`h-7 w-7 rounded-md border transition-colors ${
              isSelected ? 'border-primary ring-2 ring-primary' : 'border-border-strong'
            } ${isTransparent ? 'bg-transparent' : ''}`}
            style={isTransparent ? undefined : { backgroundColor: opt.value }}
          >
            {isTransparent ? <span className="text-[10px] text-muted-foreground">0</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export default function OverlayFields({ draft, idPrefix, onChange }: OverlayFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-text`}>Text</Label>
        <Textarea
          id={`${idPrefix}-text`}
          value={draft.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={2}
          className="min-h-[60px] resize-y"
          placeholder="What should this caption say?"
        />
      </div>

      <div className="space-y-1">
        <Label>Position</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {POSITIONS.map((pos) => {
            const isSelected = draft.position === pos.value;
            return (
              <button
                key={pos.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onChange({ position: pos.value })}
                className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border-strong bg-background text-foreground hover:bg-accent'
                }`}
              >
                {pos.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor={`${idPrefix}-size`}>Font size</Label>
          <Caption>{draft.fontSize}px</Caption>
        </div>
        <input
          id={`${idPrefix}-size`}
          type="range"
          min={MIN_FONT_SIZE}
          max={MAX_FONT_SIZE}
          step={2}
          value={draft.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          className="w-full accent-primary"
        />
      </div>

      <div className="space-y-1">
        <Label>Text colour</Label>
        <SwatchRow
          options={COLOR_SWATCHES}
          selected={draft.fontColor}
          onPick={(value) => onChange({ fontColor: value })}
          ariaLabel="Text colour"
        />
      </div>

      <div className="space-y-1">
        <Label>Background</Label>
        <SwatchRow
          options={BACKGROUND_SWATCHES}
          selected={draft.backgroundColor}
          onPick={(value) => onChange({ backgroundColor: value })}
          ariaLabel="Background colour"
        />
      </div>
    </div>
  );
}
