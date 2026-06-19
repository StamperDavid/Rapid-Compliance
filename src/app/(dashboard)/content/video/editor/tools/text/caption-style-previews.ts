/**
 * Client-safe visual spec for the caption-style gallery.
 *
 * This MIRRORS the server-only STYLE_CONFIGS in
 * `src/lib/video/caption-service.ts` (position, fontSize, fontColor,
 * backgroundColor, grouping) so the operator sees a faithful mini-preview of
 * what each style will actually render — without importing the server lib into
 * a client component.
 *
 * If a style's real look changes in caption-service.ts, update the matching
 * entry here so the preview stays honest.
 */

import type { CaptionStyle } from '@/types/video-pipeline';

/** How the preview frame renders the caption sample. */
export type PreviewLayout =
  /** A single highlighted word (karaoke: one golden word at a time). */
  | 'one-word'
  /** A short line with the active word popped (word-highlight). */
  | 'word-pop'
  /** A full short line (bold-center, bottom-bar, big-impact, boxed, minimal). */
  | 'line';

export interface CaptionStylePreview {
  /** Where the caption sits in the frame — mirrors STYLE_CONFIGS.position. */
  position: 'top' | 'bottom' | 'center';
  /**
   * Tailwind text-size class for the sample text inside the mini frame.
   * Scaled DOWN from the real px fontSize so the relative hierarchy is faithful
   * (big-impact biggest, minimal smallest) at preview scale.
   */
  textSizeClass: string;
  /** Literal sample-text color — mirrors STYLE_CONFIGS.fontColor (content, not chrome). */
  fontColor: string;
  /**
   * Literal background behind the text, or null for no box (transparent).
   * Mirrors STYLE_CONFIGS.backgroundColor, simplified to an opaque/translucent
   * swatch the preview can paint.
   */
  background: string | null;
  /** SHOUTING CAPS like the punchy social styles, or sentence case. */
  allCaps: boolean;
  /** How the sample text is laid out in the frame. */
  layout: PreviewLayout;
  /** The sample caption text shown in the preview (kept short and on-brand). */
  sampleText: string;
  /** For 'one-word' / 'word-pop': which word is the popped/active one. */
  activeWord?: string;
}

/**
 * Per-style preview spec. Values trace back to STYLE_CONFIGS:
 *   bold-center   center, 48px, #FFFFFF on #00000080, lines (≤6 words)
 *   bottom-bar    bottom, 28px, #FFFFFF on #000000B3, lines (≤10 words)
 *   karaoke       center, 44px, #FFD700 on #00000080, per-word
 *   word-highlight center, 56px, #FACC15 on transparent, per-word-in-line (≤3)
 *   big-impact    center, 96px, #FFFFFF on #00000099, lines (≤2 words)
 *   boxed         bottom, 36px, #FFFFFF on solid #000000, lines (≤5 words)
 *   minimal       bottom, 24px, #FFFFFF on transparent, lines (≤7 words)
 */
export const CAPTION_STYLE_PREVIEWS: Record<CaptionStyle, CaptionStylePreview> = {
  'bold-center': {
    position: 'center',
    textSizeClass: 'text-base',
    fontColor: '#FFFFFF',
    background: 'rgba(0,0,0,0.5)',
    allCaps: true,
    layout: 'line',
    sampleText: 'This changes everything',
  },
  'bottom-bar': {
    position: 'bottom',
    textSizeClass: 'text-[10px]',
    fontColor: '#FFFFFF',
    background: 'rgba(0,0,0,0.7)',
    allCaps: false,
    layout: 'line',
    sampleText: 'Smaller captions along the bottom edge',
  },
  'karaoke': {
    position: 'center',
    textSizeClass: 'text-lg',
    fontColor: '#FFD700',
    background: 'rgba(0,0,0,0.5)',
    allCaps: true,
    layout: 'one-word',
    sampleText: 'word',
    activeWord: 'word',
  },
  'word-highlight': {
    position: 'center',
    textSizeClass: 'text-lg',
    fontColor: '#FFFFFF',
    background: null,
    allCaps: true,
    layout: 'word-pop',
    sampleText: 'pop the word',
    activeWord: 'the',
  },
  'big-impact': {
    position: 'center',
    textSizeClass: 'text-2xl',
    fontColor: '#FFFFFF',
    background: 'rgba(0,0,0,0.6)',
    allCaps: true,
    layout: 'line',
    sampleText: 'HUGE',
  },
  'boxed': {
    position: 'bottom',
    textSizeClass: 'text-xs',
    fontColor: '#FFFFFF',
    background: '#000000',
    allCaps: false,
    layout: 'line',
    sampleText: 'On a solid bar',
  },
  'minimal': {
    position: 'bottom',
    textSizeClass: 'text-[10px]',
    fontColor: '#FFFFFF',
    background: null,
    allCaps: false,
    layout: 'line',
    sampleText: 'Small and clean, no box',
  },
};

/** The accent used for the popped word in word-highlight (mirrors #FACC15). */
export const WORD_POP_COLOR = '#FACC15';
