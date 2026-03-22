/**
 * Caption Service — Generates timed text overlays from Deepgram transcription data.
 *
 * Supports three caption styles:
 *   - bold-center: Large centered text, TikTok-style (one line at a time)
 *   - bottom-bar: Smaller text at the bottom with a semi-transparent background
 *   - karaoke: Word-by-word highlight, each word appears as spoken
 *
 * The output is an array of TextOverlayConfig objects ready for the
 * /api/video/text-overlay route's FFmpeg drawtext filter.
 */

import type { TranscriptionWord } from '@/types/scene-grading';
import type { TextOverlayConfig, CaptionStyle } from '@/types/video-pipeline';

// ---------------------------------------------------------------------------
// Configuration per style
// ---------------------------------------------------------------------------

interface CaptionStyleConfig {
  position: 'top' | 'bottom' | 'center';
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  maxWordsPerLine: number;
}

const STYLE_CONFIGS: Record<CaptionStyle, CaptionStyleConfig> = {
  'bold-center': {
    position: 'center',
    fontSize: 48,
    fontColor: '#FFFFFF',
    backgroundColor: '#00000080',
    maxWordsPerLine: 6,
  },
  'bottom-bar': {
    position: 'bottom',
    fontSize: 28,
    fontColor: '#FFFFFF',
    backgroundColor: '#000000B3',
    maxWordsPerLine: 10,
  },
  'karaoke': {
    position: 'center',
    fontSize: 44,
    fontColor: '#FFD700',
    backgroundColor: '#00000080',
    maxWordsPerLine: 1,
  },
};

// ---------------------------------------------------------------------------
// Word grouping — splits transcription into caption lines
// ---------------------------------------------------------------------------

interface CaptionLine {
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
 * For `karaoke` style, each word gets its own overlay.
 * For `bold-center` and `bottom-bar`, words are grouped into multi-word lines.
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

  if (style === 'karaoke') {
    // Each word gets its own overlay — appears and disappears individually
    return words.map((word) => ({
      text: word.word,
      position: config.position,
      fontSize,
      fontColor,
      backgroundColor,
      startTime: word.start,
      endTime: word.end,
    }));
  }

  // For bold-center and bottom-bar: group words into multi-word lines
  const lines = groupWordsIntoLines(words, config.maxWordsPerLine);

  return lines.map((line) => ({
    text: line.text,
    position: config.position,
    fontSize,
    fontColor,
    backgroundColor,
    startTime: line.startTime,
    endTime: line.endTime,
  }));
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
