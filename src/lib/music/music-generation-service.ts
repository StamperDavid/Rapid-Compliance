/**
 * AI Music Generation Service
 *
 * Provider choice: Replicate (MusicGen by Meta)
 * ───────────────────────────────────────────────
 * Why Replicate / MusicGen:
 *   1. Cheapest of the three candidates the task surfaced (~$0.01/gen on
 *      meta/musicgen-small or musicgen-melody, vs $0.05–0.10 for Suno).
 *   2. Dedicated music model — ElevenLabs Sound Effects caps at 22 seconds
 *      and is engineered for foley/sfx, not composition.
 *   3. Stable, public REST API with a documented synchronous "wait" header
 *      that returns the finished audio inline (no webhook plumbing required
 *      for the YC demo path).
 *   4. No fingerprint / TLS games (vs Suno's unofficial third-party bridges,
 *      which are explicitly the "cheap workaround that risks bans" pattern
 *      called out in feedback_check_platform_api_posture_first.md).
 *   5. Open-source provenance (Meta's MusicGen) — predictable terms of use
 *      for SaaS resale.
 *
 * If/when the operator wants higher-fidelity output for hero demo tracks,
 * Suno can be added as a second provider behind the same `generateMusic`
 * surface — the return shape is provider-agnostic on purpose.
 *
 * Service contract:
 *   generateMusic({ prompt, genre?, mood?, durationSeconds?, brandDna? })
 *     → { url, duration, provider, metadata }
 *
 * Failure modes are surfaced explicitly:
 *   - Missing API key → "Replicate API key not configured. Add it in
 *     /settings/api-keys under audio → replicate."
 *   - HTTP 401/403   → invalid key (same operator hint).
 *   - HTTP 402       → out of credit on Replicate.
 *   - HTTP 5xx       → upstream provider failure.
 *   - Prediction status === 'failed' → the model's own error string is
 *     bubbled up so the operator can adjust the prompt.
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
   * Desired duration in seconds. MusicGen accepts up to 30s reliably; values
   * larger than 30 are clamped to 30 with a warning logged.
   */
  durationSeconds?: number;
  /** Brand DNA snapshot — when present, biases the prompt toward brand tone */
  brandDna?: BrandDNAContext;
}

export interface MusicGenerationResult {
  /** Provider-hosted URL to the generated audio (mp3 / wav). Caller is
   *  expected to persist this to Firebase Storage if longevity is required. */
  url: string;
  /** Duration of the generated track in seconds (best effort — MusicGen
   *  returns exactly the requested length minus any trailing silence trim). */
  duration: number;
  /** Provider identifier — fixed to 'musicgen' for this service today. */
  provider: 'musicgen';
  /** Provider-specific structured data (model, prediction id, raw timings). */
  metadata: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// REPLICATE API SHAPES
// ────────────────────────────────────────────────────────────────────────────

interface ReplicatePredictionResponse {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  /** When status === 'succeeded', `output` is a string URL for MusicGen */
  output: string | string[] | null;
  error: string | null;
  metrics?: {
    predict_time?: number;
  };
  model?: string;
  version?: string;
}

// MusicGen-large is the highest-quality public version of the model. The
// "version" field is a content-addressed hash documented at:
//   https://replicate.com/meta/musicgen
// Pinning the hash keeps generations reproducible across model updates.
const MUSICGEN_VERSION =
  '7be0f12c54a8d033a0fbd14418c9af98962da9a86f5ff7811f9b3423a1f0b7d7';

const REPLICATE_BASE_URL = 'https://api.replicate.com/v1';

// MusicGen practical maximum. The model accepts up to 60s but quality
// degrades sharply beyond 30s; clamping here matches the documented
// "best results under 30 seconds" guidance.
const MAX_DURATION_SECONDS = 30;
const DEFAULT_DURATION_SECONDS = 15;

const FILE = 'music-generation-service.ts';

// ────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compose the natural-language prompt sent to MusicGen.
 * MusicGen reads a single prose description — we fold genre, mood, and
 * brand tone into one string rather than passing structured fields.
 */
function buildPrompt(input: MusicGenerationInput): string {
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

  return parts.join(' ');
}

async function getReplicateKey(): Promise<string> {
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'replicate');
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error(
      'Replicate API key not configured. Add it in /settings/api-keys under audio → replicate.',
    );
  }
  return key;
}

/**
 * Throw with a stable, operator-friendly message based on the Replicate
 * HTTP status. Preserves the upstream body for log forensics.
 */
async function throwForResponse(
  response: Response,
  context: 'create' | 'poll',
): Promise<never> {
  const bodyText = await response.text();
  logger.error(
    `Replicate ${context} request failed`,
    new Error(bodyText),
    { status: response.status, file: FILE },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      'Replicate API key is invalid. Update it in /settings/api-keys.',
    );
  }
  if (response.status === 402) {
    throw new Error(
      'Replicate account is out of credit. Top up at replicate.com/account/billing.',
    );
  }
  if (response.status === 429) {
    throw new Error('Replicate is rate-limiting us — try again in a minute.');
  }
  throw new Error(
    `Replicate ${context} failed (HTTP ${response.status}). See server logs for details.`,
  );
}

/**
 * Create a prediction with the synchronous "Prefer: wait" header so the
 * call returns the finished output (or times out at 60s) without us
 * having to poll. Falls back to polling when the response is still in
 * `starting` / `processing` (happens when generation exceeds the 60s wait).
 */
async function createPrediction(
  apiKey: string,
  prompt: string,
  durationSeconds: number,
): Promise<ReplicatePredictionResponse> {
  const response = await fetch(`${REPLICATE_BASE_URL}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=60',
    },
    body: JSON.stringify({
      version: MUSICGEN_VERSION,
      input: {
        prompt,
        duration: durationSeconds,
        // MusicGen tunables — defaults match the model card recommendations.
        model_version: 'stereo-melody-large',
        output_format: 'mp3',
        normalization_strategy: 'peak',
      },
    }),
  });

  if (!response.ok) {
    await throwForResponse(response, 'create');
  }

  return (await response.json()) as ReplicatePredictionResponse;
}

async function pollPrediction(
  apiKey: string,
  predictionId: string,
): Promise<ReplicatePredictionResponse> {
  // Replicate-recommended polling: 1s interval, 5min ceiling. MusicGen
  // typically completes in <30s for ≤30s tracks but cold starts can push
  // total latency to ~90s.
  const maxAttempts = 300;
  const intervalMs = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `${REPLICATE_BASE_URL}/predictions/${predictionId}`,
      {
        headers: {
          'Authorization': `Token ${apiKey}`,
        },
      },
    );

    if (!response.ok) {
      await throwForResponse(response, 'poll');
    }

    const prediction = (await response.json()) as ReplicatePredictionResponse;

    if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
      return prediction;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }

  throw new Error('Music generation timed out after 5 minutes.');
}

function extractAudioUrl(prediction: ReplicatePredictionResponse): string {
  const output = prediction.output;
  if (typeof output === 'string' && output.length > 0) {
    return output;
  }
  if (Array.isArray(output) && typeof output[0] === 'string' && output[0].length > 0) {
    return output[0];
  }
  throw new Error('Replicate returned no audio URL — model produced empty output.');
}

/**
 * Generate a music track. See module header for provider rationale.
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

  const apiKey = await getReplicateKey();
  const prompt = buildPrompt(input);

  logger.info('Music generation starting', {
    promptLength: prompt.length,
    duration,
    genre: input.genre,
    mood: input.mood,
    brandDnaApplied: input.brandDna != null,
    file: FILE,
  });

  let prediction = await createPrediction(apiKey, prompt, duration);

  // If the synchronous wait timed out, fall through to polling.
  if (prediction.status === 'starting' || prediction.status === 'processing') {
    prediction = await pollPrediction(apiKey, prediction.id);
  }

  if (prediction.status !== 'succeeded') {
    const reason = prediction.error ?? `status=${prediction.status}`;
    logger.error(
      'MusicGen prediction did not succeed',
      new Error(reason),
      { predictionId: prediction.id, status: prediction.status, file: FILE },
    );
    throw new Error(`MusicGen generation failed: ${reason}`);
  }

  const url = extractAudioUrl(prediction);

  logger.info('Music generation completed', {
    predictionId: prediction.id,
    predictTimeSec: prediction.metrics?.predict_time,
    file: FILE,
  });

  return {
    url,
    duration,
    provider: 'musicgen',
    metadata: {
      predictionId: prediction.id,
      replicateModel: prediction.model ?? 'meta/musicgen',
      replicateVersion: prediction.version ?? MUSICGEN_VERSION,
      predictTimeSec: prediction.metrics?.predict_time ?? null,
      promptUsed: prompt,
    },
  };
}
