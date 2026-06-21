/**
 * Caption Service — Generates timed text overlays from Deepgram transcription data.
 *
 * Supports an OpusClip-class set of visually distinct caption styles:
 *   - bold-center:    Large centered text, TikTok-style (a few words per line)
 *   - bottom-bar:     Smaller text at the bottom with a dark semi-transparent bar
 *   - karaoke:        One golden word at a time, centered, as spoken
 *   - word-highlight: A few words centered at once, each word popped individually
 *                     (the active word fills its own short overlay) — busier than
 *                     karaoke, smaller groupings than bold-center
 *   - big-impact:     Huge bold centered hook text, 1–2 words per beat
 *   - boxed:          Short lines on a solid black box near the bottom
 *   - minimal:        Small clean captions at the bottom, no background at all
 *
 * The output is an array of TextOverlayConfig objects ready for the
 * /api/video/text-overlay route's FFmpeg drawtext filter.
 */

import type { TranscriptionWord } from '@/types/scene-grading';
import type { TextOverlayConfig, CaptionStyle } from '@/types/video-pipeline';

// ---------------------------------------------------------------------------
// Configuration per style
// ---------------------------------------------------------------------------

/** How a style turns words into overlays. */
type GroupingMode =
  /** Each word is its own overlay (karaoke). */
  | 'per-word'
  /** Group N words into a line; the whole line shows for the line's span. */
  | 'lines'
  /** Group N words into a line, but emit ONE overlay per word holding the whole
   *  line so the active word can be emphasized beat-by-beat (word-highlight). */
  | 'per-word-in-line';

interface CaptionStyleConfig {
  position: 'top' | 'bottom' | 'center';
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  maxWordsPerLine: number;
  grouping: GroupingMode;
}

const STYLE_CONFIGS: Record<CaptionStyle, CaptionStyleConfig> = {
  'bold-center': {
    position: 'center',
    fontSize: 48,
    fontColor: '#FFFFFF',
    backgroundColor: '#00000080',
    maxWordsPerLine: 6,
    grouping: 'lines',
  },
  'bottom-bar': {
    position: 'bottom',
    fontSize: 28,
    fontColor: '#FFFFFF',
    backgroundColor: '#000000B3',
    maxWordsPerLine: 10,
    grouping: 'lines',
  },
  'karaoke': {
    position: 'center',
    fontSize: 44,
    fontColor: '#FFD700',
    backgroundColor: '#00000080',
    maxWordsPerLine: 1,
    grouping: 'per-word',
  },
  'word-highlight': {
    position: 'center',
    fontSize: 56,
    fontColor: '#FACC15',
    backgroundColor: 'transparent',
    maxWordsPerLine: 3,
    grouping: 'per-word-in-line',
  },
  'big-impact': {
    position: 'center',
    fontSize: 96,
    fontColor: '#FFFFFF',
    backgroundColor: '#00000099',
    maxWordsPerLine: 2,
    grouping: 'lines',
  },
  'boxed': {
    position: 'bottom',
    fontSize: 36,
    fontColor: '#FFFFFF',
    backgroundColor: '#000000',
    maxWordsPerLine: 5,
    grouping: 'lines',
  },
  'minimal': {
    position: 'bottom',
    fontSize: 24,
    fontColor: '#FFFFFF',
    backgroundColor: 'transparent',
    maxWordsPerLine: 7,
    grouping: 'lines',
  },
};

// ---------------------------------------------------------------------------
// Word grouping — splits transcription into caption lines
// ---------------------------------------------------------------------------

interface CaptionLine {
  /** Words that make up the line, kept so we can emphasize one at a time. */
  words: TranscriptionWord[];
  text: string;
  startTime: number;
  endTime: number;
}

/**
 * Groups transcription words into caption lines based on word count limits.
 * Respects natural sentence boundaries where possible (periods, commas).
 */
function groupWordsIntoLines(
  words: TranscriptionWord[],
  maxWordsPerLine: number,
): CaptionLine[] {
  if (words.length === 0) { return []; }

  const lines: CaptionLine[] = [];
  let currentWords: TranscriptionWord[] = [];

  for (const word of words) {
    currentWords.push(word);

    const isAtLimit = currentWords.length >= maxWordsPerLine;
    const isNaturalBreak = /[.!?;]$/.test(word.word);
    const isCommaBreak = currentWords.length >= 3 && /,$/.test(word.word);

    if (isAtLimit || isNaturalBreak || isCommaBreak) {
      lines.push({
        words: currentWords,
        text: currentWords.map((w) => w.word).join(' '),
        startTime: currentWords[0].start,
        endTime: currentWords[currentWords.length - 1].end,
      });
      currentWords = [];
    }
  }

  // Flush remaining words
  if (currentWords.length > 0) {
    lines.push({
      words: currentWords,
      text: currentWords.map((w) => w.word).join(' '),
      startTime: currentWords[0].start,
      endTime: currentWords[currentWords.length - 1].end,
    });
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates TextOverlayConfig objects from transcription words.
 *
 * The shape of the output depends on the style's grouping mode:
 *   - 'per-word'         one overlay per word (karaoke).
 *   - 'lines'            words grouped into multi-word lines, one overlay each
 *                        (bold-center, bottom-bar, big-impact, boxed, minimal).
 *   - 'per-word-in-line' words grouped into short lines, but ONE overlay per
 *                        word holding the whole line with the active word
 *                        emphasized (word-highlight).
 *
 * @param words - Word-level transcription from Deepgram (via SceneAutoGrade.transcription.words)
 * @param style - Caption style preset
 * @param overrides - Optional font/color overrides (e.g., from Brand Kit)
 * @returns Array of TextOverlayConfig ready for the text-overlay API route
 */
export function generateCaptionOverlays(
  words: TranscriptionWord[],
  style: CaptionStyle,
  overrides?: {
    fontSize?: number;
    fontColor?: string;
    backgroundColor?: string;
  },
): TextOverlayConfig[] {
  if (words.length === 0) { return []; }

  const config = STYLE_CONFIGS[style];
  const fontSize = overrides?.fontSize ?? config.fontSize;
  const fontColor = overrides?.fontColor ?? config.fontColor;
  const backgroundColor = overrides?.backgroundColor ?? config.backgroundColor;

  const base = {
    position: config.position,
    fontSize,
    fontColor,
    backgroundColor,
  };

  switch (config.grouping) {
    case 'per-word':
      // Each word gets its own overlay — appears and disappears individually.
      return words.map((word) => ({
        ...base,
        text: word.word,
        startTime: word.start,
        endTime: word.end,
      }));

    case 'per-word-in-line': {
      // Show a short line, but emit one overlay per word so the spoken word can
      // be emphasized beat-by-beat. Each overlay holds the full line with the
      // active word wrapped in « » so the render layer can pop it.
      const lines = groupWordsIntoLines(words, config.maxWordsPerLine);
      const overlays: TextOverlayConfig[] = [];
      for (const line of lines) {
        for (let i = 0; i < line.words.length; i += 1) {
          const active = line.words[i];
          const text = line.words
            .map((w, idx) => (idx === i ? `«${w.word}»` : w.word))
            .join(' ');
          overlays.push({
            ...base,
            text,
            startTime: active.start,
            endTime: active.end,
          });
        }
      }
      return overlays;
    }

    case 'lines':
    default: {
      // Group words into multi-word lines, one overlay per line.
      const lines = groupWordsIntoLines(words, config.maxWordsPerLine);
      return lines.map((line) => ({
        ...base,
        text: line.text,
        startTime: line.startTime,
        endTime: line.endTime,
      }));
    }
  }
}

/**
 * Generates captions for multiple scenes, offsetting timestamps by each
 * scene's position in the assembled video timeline.
 *
 * @param sceneCaptions - Array of { words, sceneDuration } per scene
 * @param style - Caption style
 * @param overrides - Optional styling overrides
 * @returns Combined TextOverlayConfig[] with correct absolute timestamps
 */
export function generateMultiSceneCaptions(
  sceneCaptions: Array<{
    words: TranscriptionWord[];
    sceneDuration: number;
  }>,
  style: CaptionStyle,
  overrides?: {
    fontSize?: number;
    fontColor?: string;
    backgroundColor?: string;
  },
): TextOverlayConfig[] {
  const allOverlays: TextOverlayConfig[] = [];
  let timeOffset = 0;

  for (const scene of sceneCaptions) {
    const overlays = generateCaptionOverlays(scene.words, style, overrides);

    // Offset all timestamps by the cumulative scene start time
    for (const overlay of overlays) {
      allOverlays.push({
        ...overlay,
        startTime: overlay.startTime + timeOffset,
        endTime: overlay.endTime + timeOffset,
      });
    }

    timeOffset += scene.sceneDuration;
  }

  return allOverlays;
}
