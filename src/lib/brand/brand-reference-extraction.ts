/**
 * Brand Reference Extraction
 *
 * Makes agents actually UNDERSTAND the brand reference materials a business
 * uploads — not just the operator's one-line description. For each asset we
 * produce a short, concrete, text-representable summary that downstream Brand
 * DNA baking (`assembleBrandReferenceText`) folds into every agent's prompt:
 *
 *   - image    → a vision read (what's shown, style/mood/palette, text/logo)
 *   - video    → Deepgram transcript → summarized message/tone
 *   - document → PDF text → summarized message/tone/claims
 *   - other    → '' (nothing meaningful to extract)
 *
 * BEST-EFFORT BY DESIGN: every branch is wrapped so this function NEVER throws.
 * A failed fetch, a missing API key, a hung model call, or a parse error all
 * resolve to '' — the operator's own description still carries the brand signal,
 * so a failed extraction degrades gracefully instead of blocking the save.
 *
 * Models (current generation, both vision-capable per MODEL_CAPABILITIES):
 *   - VISION_MODEL    = 'claude-sonnet-4.6'  (the leaf-specialist model)
 *   - SUMMARIZE_MODEL = 'claude-haiku-4.5'   (cheaper; text-only summarization)
 */

import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { transcribeAudioBuffer } from '@/lib/video/transcription-service';
import { parsePDF } from '@/lib/agent/parsers/pdf-parser';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { ModelName } from '@/types/ai-models';

const FILE = 'brand-reference-extraction.ts';

/** Vision-capable model used to read brand reference images. */
const VISION_MODEL: ModelName = 'claude-sonnet-4.6';
/** Cheaper text-only model used to summarize transcripts / document text. */
const SUMMARIZE_MODEL: ModelName = 'claude-haiku-4.5';

/** Per-call timeout (ms) so a hung external call can't wedge the request. */
const CALL_TIMEOUT_MS = 60_000;
/** Max chars of raw text fed to the summarizer. */
const MAX_RAW_CHARS = 8_000;
/** Max chars of the summary we return / bake. */
const MAX_SUMMARY_CHARS = 600;

/**
 * Race a promise against a timeout. If the promise rejects OR the timer wins,
 * resolve to `fallback` — never throw. Used to bound every external call.
 */
async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    });
    return await Promise.race([
      p.catch((err: unknown) => {
        logger.warn('Brand reference extraction: external call failed', {
          file: FILE,
          error: err instanceof Error ? err.message : String(err),
        });
        return fallback;
      }),
      timeout,
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/** Trim a string and cap it to `n` chars (no ellipsis — callers want raw text). */
function cap(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? t.slice(0, n).trimEnd() : t;
}

/**
 * Summarize raw extracted text (a transcript or document body) into 2-4
 * sentences another AI can absorb. Short text is returned as-is (no need to
 * spend a model call on <600 chars). Never throws — returns '' on any failure.
 */
async function summarize(rawText: string, kind: 'video' | 'document'): Promise<string> {
  const text = rawText.trim();
  if (text.length === 0) {
    return '';
  }
  if (text.length < MAX_SUMMARY_CHARS) {
    return text;
  }

  const provider = new OpenRouterProvider(PLATFORM_ID);
  const prompt =
    `Summarize this brand ${kind} in 2-4 sentences so another AI can understand ` +
    `what it communicates and its significance to the brand — capture the message, ` +
    `tone, and any rules or claims. No preamble:\n\n${cap(text, MAX_RAW_CHARS)}`;

  const summary = await withTimeout(
    (async (): Promise<string> => {
      const res = await provider.chat({
        model: SUMMARIZE_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 400,
      });
      return res.content;
    })(),
    CALL_TIMEOUT_MS,
    '',
  );

  return cap(summary, MAX_SUMMARY_CHARS);
}

/** Fetch the raw bytes at `url`, or null on any failure. Never throws. */
async function fetchBytes(url: string): Promise<Buffer | null> {
  return withTimeout(
    (async (): Promise<Buffer | null> => {
      const res = await fetch(url);
      if (!res.ok) {
        logger.warn('Brand reference extraction: asset fetch returned non-OK', {
          file: FILE,
          status: res.status,
        });
        return null;
      }
      return Buffer.from(await res.arrayBuffer());
    })(),
    CALL_TIMEOUT_MS,
    null,
  );
}

/** Vision read of a brand reference image. Never throws — returns '' on failure. */
async function summarizeImage(url: string): Promise<string> {
  const provider = new OpenRouterProvider(PLATFORM_ID);
  const prompt =
    'You are analyzing a brand reference image a business uploaded so other AI ' +
    'agents can match this brand. In 2-4 sentences describe concretely: what is ' +
    'shown, the visual style / mood / color palette, any text, tagline, or logo ' +
    'treatment, and the kind of marketing it represents. Be specific and factual; ' +
    'no preamble.';

  const summary = await withTimeout(
    (async (): Promise<string> => {
      const res = await provider.chat({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url, detail: 'auto' } },
            ],
          },
        ],
        temperature: 0.3,
        maxTokens: 400,
      });
      return res.content;
    })(),
    CALL_TIMEOUT_MS,
    '',
  );

  return cap(summary, MAX_SUMMARY_CHARS);
}

/** Transcribe a brand reference video and summarize it. Never throws. */
async function summarizeVideo(url: string): Promise<string> {
  const buf = await fetchBytes(url);
  if (buf === null) {
    return '';
  }
  const result = await withTimeout(transcribeAudioBuffer(buf), CALL_TIMEOUT_MS, null);
  const transcript = result?.transcript?.trim();
  if (transcript === undefined || transcript.length === 0) {
    return '';
  }
  return summarize(transcript, 'video');
}

/** Extract the text from a brand reference document (PDF) and summarize it. Never throws. */
async function summarizeDocument(url: string): Promise<string> {
  const buf = await fetchBytes(url);
  if (buf === null) {
    return '';
  }
  const text = await withTimeout(
    (async (): Promise<string> => {
      const parsed = await parsePDF(buf);
      return parsed.text;
    })(),
    CALL_TIMEOUT_MS,
    '',
  );
  if (text.trim().length === 0) {
    return '';
  }
  return summarize(text, 'document');
}

/**
 * Produce a short, concrete summary of one uploaded brand reference asset so
 * agents can actually understand it. BEST-EFFORT: never throws — returns '' on
 * any failure, missing key, timeout, or unsupported kind.
 */
export async function extractAssetSummary(input: {
  url: string;
  contentType: string;
  kind: 'image' | 'video' | 'document' | 'other';
}): Promise<string> {
  const url = input.url?.trim();
  if (url === undefined || url.length === 0) {
    return '';
  }

  try {
    switch (input.kind) {
      case 'image':
        return await summarizeImage(url);
      case 'video':
        return await summarizeVideo(url);
      case 'document':
        return await summarizeDocument(url);
      case 'other':
      default:
        return '';
    }
  } catch (error) {
    // Belt-and-suspenders: the branch helpers already swallow their own
    // failures, but this guarantees the public contract (never throws).
    logger.warn('Brand reference extraction: unexpected failure', {
      file: FILE,
      kind: input.kind,
      error: error instanceof Error ? error.message : String(error),
    });
    return '';
  }
}
