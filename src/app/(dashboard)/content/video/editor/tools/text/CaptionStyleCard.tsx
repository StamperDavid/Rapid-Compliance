'use client';

/**
 * One caption-style preview card for the visual style gallery.
 *
 * Renders a mini "video frame" (dark rounded box) with sample caption text
 * styled the way the real render will look — driven by CAPTION_STYLE_PREVIEWS,
 * which mirrors the server-side STYLE_CONFIGS. Clicking selects the style.
 *
 * The CARD CHROME uses design-system tokens. The sample text + its little box
 * inside the frame are CONTENT (a faithful preview of the rendered caption), so
 * literal colors there are intentional.
 */

import { Check } from 'lucide-react';
import { Caption } from '@/components/ui/typography';
import type { CaptionStyle } from '@/types/video-pipeline';
import {
  CAPTION_STYLE_PREVIEWS,
  WORD_POP_COLOR,
  type CaptionStylePreview,
} from './caption-style-previews';

interface CaptionStyleCardProps {
  style: CaptionStyle;
  label: string;
  hint: string;
  selected: boolean;
  disabled: boolean;
  onSelect: (style: CaptionStyle) => void;
}

/** Vertical alignment of the caption within the mini frame. */
function positionClass(position: CaptionStylePreview['position']): string {
  if (position === 'top') { return 'items-start'; }
  if (position === 'bottom') { return 'items-end'; }
  return 'items-center';
}

/** The styled sample caption that lives inside the mini frame. */
function SampleCaption({ preview }: { preview: CaptionStylePreview }) {
  const boxStyle =
    preview.background !== null
      ? { backgroundColor: preview.background }
      : undefined;

  const textBase = `inline-block leading-tight font-extrabold ${preview.textSizeClass} ${
    preview.allCaps ? 'uppercase tracking-wide' : ''
  } ${preview.background !== null ? 'px-1.5 py-0.5 rounded-sm' : ''}`;

  if (preview.layout === 'one-word') {
    return (
      <span className={textBase} style={{ ...boxStyle, color: preview.fontColor }}>
        {preview.sampleText}
      </span>
    );
  }

  if (preview.layout === 'word-pop') {
    const words = preview.sampleText.split(' ');
    return (
      <span className={textBase} style={{ ...boxStyle, color: preview.fontColor }}>
        {words.map((word, i) => {
          const isActive =
            preview.activeWord !== undefined && word === preview.activeWord;
          return (
            <span key={`${word}-${i}`} style={isActive ? { color: WORD_POP_COLOR } : undefined}>
              {word}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </span>
    );
  }

  // 'line'
  return (
    <span className={textBase} style={{ ...boxStyle, color: preview.fontColor }}>
      {preview.sampleText}
    </span>
  );
}

export default function CaptionStyleCard({
  style,
  label,
  hint,
  selected,
  disabled,
  onSelect,
}: CaptionStyleCardProps) {
  const preview = CAPTION_STYLE_PREVIEWS[style];

  return (
    <button
      type="button"
      aria-pressed={selected}
      title={hint}
      disabled={disabled}
      onClick={() => onSelect(style)}
      className={`group flex flex-col gap-1.5 rounded-lg border p-1.5 text-left transition-colors disabled:opacity-50 ${
        selected
          ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
          : 'border-border-strong bg-card hover:bg-accent'
      }`}
    >
      {/* Mini video frame — vertical 9:16 to match short-form video */}
      <div
        className={`relative flex aspect-[9/16] w-full justify-center overflow-hidden rounded-md bg-neutral-900 p-1.5 ${positionClass(
          preview.position,
        )}`}
      >
        {/* Faint gradient so the "frame" reads as a video still, not a flat box */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-neutral-800/40 to-neutral-950/60" />
        <span className="relative z-10 max-w-full text-center">
          <SampleCaption preview={preview} />
        </span>
        {selected ? (
          <span className="absolute right-1 top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </span>
        ) : null}
      </div>

      <div className="px-0.5">
        <span className="block text-xs font-medium text-foreground">{label}</span>
        <Caption className="mt-0.5 block leading-snug">{hint}</Caption>
      </div>
    </button>
  );
}
