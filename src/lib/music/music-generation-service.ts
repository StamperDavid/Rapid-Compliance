/**
 * AI Music Generation Service
 *
 * Provider: MiniMax Music (music-2.5+)
 * ───────────────────────────────────────────────
 * Why MiniMax:
 *   1. Official, documented REST API (`api.minimax.io/v1/music_generation`) —
 *      no unofficial bridges / TLS-fingerprint games (the "cheap workaround
 *      that risks bans" pattern we explicitly avoid).
 *   2. Higher-fidelity output than Meta MusicGen, with real song structure and
 *      optional vocals + lyrics — while still doing clean instrumental beds.
 *   3. Long-form: music-2.5+ produces tracks well beyond MusicGen's ~30s sweet
 *      spot (up to ~240s), which suits full-length video scoring.
 *   4. One provider for ALL music in the app — this same `generateMusic`
 *      surface backs both the video music bed (shot-plan stitch) and the
 *      Content/Voice-Lab music studio route. No parallel music paths.
 *
 * Consolidation note (replaces Replicate/MusicGen):
 *   The prior implementation called Replicate MusicGen. Every caller reads only
 *   { url, duration, provider, metadata } off the result, so the provider swap
 *   is transparent — the return shape is intentionally provider-agnostic.
 *
 * Service contract:
 *   generateMusic({ prompt, genre?, mood?, durationSeconds?, instrumental?, lyrics?, brandDna? })
 *     → { url, duration, provider, metadata }
 *
 * Failure modes are surfaced explicitly:
 *   - Missing API key → "MiniMax API key not configured. Add it in
 *     /settings/api-keys under audio → minimax."
 *   - HTTP 401/403 or status_code 1004 → invalid key (same operator hint).
 *   - status_code 1008 → insufficient balance on the MiniMax account.
 *   - HTTP 5xx / empty audio → upstream provider failure (prompt-adjustable).
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import type { BrandDNA } from '@/lib/brand/brand-dna-service';

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ────────────────────────────────────────────────────────────────────────────

/**
 * Optional Brand DNA context. Re-exported as a structural alias so callers
 * (API routes, agents) can import `BrandDNAContext` from this module without
 * pulling in the full brand-dna-service.
 */
export type BrandDNAContext = Pick<
  BrandDNA,
  'companyDescription' | 'toneOfVoice' | 'communicationStyle' | 'industry'
>;

export interface MusicGenerationInput {
  /** Free-form description of the desired track */
  prompt: string;
  /** Optional genre tag (e.g. "corporate", "lo-fi", "cinematic") */
  genre?: string;
  /** Optional mood tag (e.g. "uplifting", "calm", "dramatic") */
  mood?: string;
  /**
   * Desired duration in seconds. Folded into the prompt as guidance; the model
   * decides final length (returned as `duration`). Clamped to [1, 240].
   */
  durationSeconds?: number;
  /**
   * Instrumental (no vocals). Defaults to TRUE — background beds, video
   * scoring, and the current music-studio behaviour are all instrumental.
   * Set false (with optional `lyrics`) to generate a song with vocals.
   */
  instrumental?: boolean;
  /**
   * Optional lyrics (only used when instrumental === false). Structural tags
   * like [Verse]/[Chorus] are respected; plain text is wrapped in [Verse].
   * When vocals are requested with no lyrics, MiniMax auto-writes them.
   */
  lyrics?: string;
  /** Brand DNA snapshot — when present, biases the prompt toward brand tone */
  brandDna?: BrandDNAContext;
}

export interface MusicGenerationResult {
  /** Provider-hosted URL to the generated audio (mp3). Caller is expected to
   *  persist this to Firebase Storage if longevity is required. */
  url: string;
  /** Duration of the generated track in seconds (from the provider's
   *  extra_info, falling back to the requested duration). */
  duration: number;
  /** Provider identifier. */
  provider: 'minimax';
  /** Provider-specific structured data (model, trace id, raw timings). */
  metadata: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// MINIMAX API SHAPES
// ────────────────────────────────────────────────────────────────────────────

interface MiniMaxMusicResponse {
  data?: {
    status?: number;
    /** With output_format:'url', this is a hosted audio URL. */
    audio?: string;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
  trace_id?: string;
  extra_info?: {
    music_duration?: number;
    music_sample_rate?: number;
    music_channel?: number;
    bitrate?: number;
    music_size?: number;
  };
}

const MINIMAX_URL = 'https://api.minimax.io/v1/music_generation';
const MINIMAX_MODEL = 'music-2.5+';

// music-2.5+ produces long-form tracks; 240s matches the studio route's cap.
const MAX_DURATION_SECONDS = 240;
const DEFAULT_DURATION_SECONDS = 30;

const FILE = 'music-generation-service.ts';

// ────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compose the natural-language prompt. MiniMax reads a single prose
 * description — we fold genre, mood, brand tone, and a duration hint into one
 * string rather than passing structured fields.
 */
function buildPrompt(input: MusicGenerationInput, durationSeconds: number): string {
  const parts: string[] = [input.prompt.trim()];

  if (input.genre && input.genre.trim().length > 0) {
    parts.push(`Genre: ${input.genre.trim()}.`);
  }

  if (input.mood && input.mood.trim().length > 0) {
    parts.push(`Mood: ${input.mood.trim()}.`);
  }

  if (input.brandDna) {
    const tone = input.brandDna.toneOfVoice?.trim();
    const style = input.brandDna.communicationStyle?.trim();
    if (tone && tone.length > 0) {
      parts.push(`Brand tone: ${tone}.`);
    }
    if (style && style.length > 0) {
      parts.push(`Communication style: ${style}.`);
    }
  }

  parts.push(`Duration: approximately ${durationSeconds} seconds.`);

  return parts.join(' ');
}

/** Format lyrics with structural tags when vocals are requested. */
function formatLyrics(lyrics: string): string {
  const hasStructuralTags = /\[(Verse|Chorus|Bridge|Intro|Outro|Hook|Pre-Chorus)\]/i.test(lyrics);
  return hasStructuralTags ? lyrics.trim() : `[Verse]\n${lyrics.trim()}`;
}

async function getMiniMaxKey(): Promise<string> {
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'minimax');
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error(
      'MiniMax API key not configured. Add it in /settings/api-keys under audio → minimax.',
    );
  }
  return key;
}

/**
 * Map a MiniMax logical status_code (returned with HTTP 200) to a stable,
 * operator-friendly error. status_code 0 is success and never reaches here.
 */
function throwForStatusCode(code: number, msg: string): never {
  logger.error('MiniMax music generation error', new Error(msg || `status_code=${code}`), {
    statusCode: code,
    file: FILE,
  });
  if (code === 1004) {
    throw new Error('MiniMax API key is invalid. Update it in /settings/api-keys.');
  }
  if (code === 1008) {
    throw new Error('MiniMax account has insufficient balance. Top up the MiniMax account.');
  }
  throw new Error(`MiniMax music generation failed: ${msg || `status_code=${code}`}`);
}

/**
 * Generate a music track via MiniMax. See module header for provider rationale.
 */
export async function generateMusic(
  input: MusicGenerationInput,
): Promise<MusicGenerationResult> {
  if (!input.prompt || input.prompt.trim().length === 0) {
    throw new Error('Music generation prompt is required.');
  }

  const requestedDuration = input.durationSeconds ?? DEFAULT_DURATION_SECONDS;
  const duration = Math.min(Math.max(Math.round(requestedDuration), 1), MAX_DURATION_SECONDS);

  if (duration !== requestedDuration) {
    logger.warn('Music generation duration clamped', {
      requested: requestedDuration,
      clamped: duration,
      max: MAX_DURATION_SECONDS,
      file: FILE,
    });
  }

  const instrumental = input.instrumental ?? true;
  const apiKey = await getMiniMaxKey();
  const prompt = buildPrompt(input, duration);

  const payload: Record<string, unknown> = {
    model: MINIMAX_MODEL,
    prompt,
    is_instrumental: instrumental,
    output_format: 'url',
    audio_setting: {
      sample_rate: 44100,
      bitrate: 256000,
      format: 'mp3',
    },
  };
  if (!instrumental) {
    const lyrics = input.lyrics?.trim();
    if (lyrics && lyrics.length > 0) {
      payload.lyrics = formatLyrics(lyrics);
    } else {
      // Vocals requested with no lyrics — let MiniMax write them.
      payload.lyrics_optimizer = true;
    }
  }

  logger.info('Music generation starting', {
    promptLength: prompt.length,
    duration,
    genre: input.genre,
    mood: input.mood,
    instrumental,
    brandDnaApplied: input.brandDna != null,
    provider: 'minimax',
    file: FILE,
  });

  const response = await fetch(MINIMAX_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    logger.error('MiniMax request failed', new Error(bodyText), {
      status: response.status,
      file: FILE,
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error('MiniMax API key is invalid. Update it in /settings/api-keys.');
    }
    if (response.status === 429) {
      throw new Error('MiniMax is rate-limiting us — try again in a minute.');
    }
    throw new Error(`MiniMax music generation failed (HTTP ${response.status}). See server logs for details.`);
  }

  const data = (await response.json()) as MiniMaxMusicResponse;

  const statusCode = data.base_resp?.status_code ?? -1;
  if (statusCode !== 0) {
    throwForStatusCode(statusCode, data.base_resp?.status_msg ?? '');
  }

  const url = data.data?.audio;
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('MiniMax returned no audio URL — model produced empty output.');
  }

  // MiniMax reports music_duration in MILLISECONDS — convert to seconds.
  const durationMs = data.extra_info?.music_duration;
  const resultDuration =
    typeof durationMs === 'number' && durationMs > 0 ? Math.round(durationMs / 1000) : duration;

  logger.info('Music generation completed', {
    traceId: data.trace_id,
    durationSec: resultDuration,
    provider: 'minimax',
    file: FILE,
  });

  return {
    url,
    duration: resultDuration,
    provider: 'minimax',
    metadata: {
      traceId: data.trace_id ?? null,
      minimaxModel: MINIMAX_MODEL,
      instrumental,
      sampleRate: data.extra_info?.music_sample_rate ?? null,
      bitrate: data.extra_info?.bitrate ?? null,
      promptUsed: prompt,
    },
  };
}
