/**
 * Clone Voice Studio — the approved default capture script.
 *
 * The operator reads this aloud (twice: a steady pass and an expressive pass)
 * while the teleprompter auto-scrolls. Every line is short (16–26 words, 1–2
 * rows tall) so a single karaoke highlight reads cleanly at the approved
 * ~115 words-per-minute pace.
 *
 * The script deliberately sweeps phonemes, visemes, sentence types, dynamics,
 * and emotional range so the resulting ElevenLabs clone sounds natural across
 * marketing videos, phone calls, and presentations.
 *
 * Sections are labeled and ordered; §0 is a warm-up that is NOT recorded.
 * The operator can freely edit any line before recording.
 */

/** A teleprompter line — one short, self-contained unit that gets highlighted. */
export interface ScriptLine {
  /** The text shown (and read aloud). */
  text: string;
  /** Optional delivery hint shown in muted text above the line (e.g. "soft, slow"). */
  cue?: string;
}

/** One labeled section of the capture script. */
export interface ScriptSection {
  /** Stable id used for keys + section navigation. */
  id: string;
  /** Section label (e.g. "Neutral backbone"). */
  label: string;
  /** Short purpose blurb shown under the label. */
  purpose: string;
  /** Approximate spoken duration in seconds (for the section timeline). */
  approxSeconds: number;
  /** If true, this section is a warm-up and is NOT part of the recorded take. */
  warmUp?: boolean;
  /** The lines, in reading order. */
  lines: ScriptLine[];
}

/**
 * The approved 6-section default capture script (~4 minutes including warm-up).
 * Section ids are stable so the teleprompter and the section timeline agree.
 */
export const DEFAULT_CAPTURE_SCRIPT: ScriptSection[] = [
  {
    id: 'warmup',
    label: '§0 · Warm-up',
    purpose: 'Settle your voice. This is NOT recorded.',
    approxSeconds: 10,
    warmUp: true,
    lines: [
      {
        text: "I'm about to record my digital clone. I'll keep my energy steady and natural, and let each section guide my expression.",
      },
    ],
  },
  {
    id: 'neutral-backbone',
    label: '§1 · Neutral backbone',
    purpose: 'Steady, even pace. Phonetically balanced Harvard sentences.',
    approxSeconds: 70,
    lines: [
      { text: 'The birch canoe slid on the smooth planks.' },
      { text: 'Glue the sheet to the dark blue background.' },
      { text: "It's easy to tell the depth of a well." },
      { text: 'These days a chicken leg is a rare dish.' },
      { text: 'The juice of lemons makes fine punch.' },
      { text: 'A large size in stockings is hard to sell.' },
      { text: 'The boy was there when the sun rose.' },
      { text: 'A rod is used to catch pink salmon.' },
      {
        cue: 'viseme sweep — articulate every shape',
        text: 'We watch the wide ocean wave while five fishermen show off shiny zinc spoons; Papa, Mama, and Bobby buzz, hush, and chew.',
      },
    ],
  },
  {
    id: 'sentence-types',
    label: '§2 · Statements, questions, exclamations',
    purpose: 'Move between flat statements, rising questions, and bright exclamations.',
    approxSeconds: 40,
    lines: [
      { text: 'Our team ships new features every single week.' },
      { text: 'Have you ever wondered how quickly an idea can become a product?' },
      { text: 'What would you build if nothing could stop you?' },
      { text: "That is absolutely incredible — I can't wait to show you!" },
      { text: 'This. Changes. Everything.' },
    ],
  },
  {
    id: 'dynamics',
    label: '§3 · Soft & slow vs. loud & fast',
    purpose: 'Lean into the dynamic shifts and hold the pauses on the ellipses.',
    approxSeconds: 40,
    lines: [
      {
        cue: 'soft, slow',
        text: 'Take a breath… and let me walk you through this gently, one step at a time.',
      },
      {
        cue: 'bright, faster',
        text: "Okay — here's the fun part, and it moves fast, so stay with me!",
      },
    ],
  },
  {
    id: 'emotional-range',
    label: '§4 · Emotional range',
    purpose: 'Hold each emotion for the whole line — really feel it.',
    approxSeconds: 45,
    lines: [
      {
        cue: 'happy',
        text: "Honestly, this is the best news I've had all month, and I'm thrilled to share it with you.",
      },
      {
        cue: 'excited',
        text: 'We did it — we actually did it!',
      },
      {
        cue: 'serious',
        text: "I know this past year has been hard, and I won't pretend otherwise.",
      },
      {
        cue: 'calm, confident',
        text: "You have everything you need to succeed, and I'll be right here with you.",
      },
    ],
  },
  {
    id: 'close',
    label: '§5 · Close',
    purpose: 'Back to neutral. Warm, unhurried sign-off.',
    approxSeconds: 20,
    lines: [
      {
        text: "Thanks for watching. I'm looking forward to working with you, and I'll talk to you again very soon.",
      },
    ],
  },
];

/** The approved teleprompter pace, in words per minute (research-backed). */
export const DEFAULT_WORDS_PER_MINUTE = 115;

/** Speed bounds for the operator's speed slider. */
export const MIN_WORDS_PER_MINUTE = 80;
export const MAX_WORDS_PER_MINUTE = 160;

/** Count the words in a line (used to time the karaoke highlight). */
export function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * Flatten the script sections into a single ordered list of lines, each tagged
 * with its section so the teleprompter can render section dividers inline and
 * compute per-line dwell times.
 */
export interface FlatScriptLine extends ScriptLine {
  /** Global index across the whole script (highlight cursor position). */
  index: number;
  /** The section this line belongs to. */
  sectionId: string;
  sectionLabel: string;
  /** True for the first line of its section (renders the section header). */
  isSectionStart: boolean;
  /** True when this line is part of a warm-up (not recorded). */
  warmUp: boolean;
  /** Word count, cached for dwell-time math. */
  words: number;
}

/** Build the flattened, indexed line list from a script. */
export function flattenScript(sections: ScriptSection[]): FlatScriptLine[] {
  const flat: FlatScriptLine[] = [];
  let index = 0;
  for (const section of sections) {
    section.lines.forEach((line, lineIdx) => {
      flat.push({
        ...line,
        index,
        sectionId: section.id,
        sectionLabel: section.label,
        isSectionStart: lineIdx === 0,
        warmUp: section.warmUp ?? false,
        words: countWords(line.text),
      });
      index += 1;
    });
  }
  return flat;
}

/**
 * Dwell time (ms) for a line at a given pace. We add a small fixed floor so a
 * very short line (e.g. "This. Changes. Everything.") still gets a readable
 * beat, and a little extra breathing room when the line carries a delivery cue.
 */
export function lineDwellMs(line: FlatScriptLine, wordsPerMinute: number): number {
  const msPerWord = 60_000 / wordsPerMinute;
  const base = Math.max(line.words, 1) * msPerWord;
  const floor = 1_400; // every line is on screen long enough to read
  const cuePad = line.cue ? 700 : 0; // a beat to register the delivery hint
  return Math.max(base, floor) + cuePad;
}
