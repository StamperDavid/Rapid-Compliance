/**
 * fal / Seedance 2.0 video engine provider (Stage 1)
 *
 * Implements the engine-agnostic `VideoEngineProvider` against ByteDance
 * Seedance 2.0 on fal's queue API. Two generation modes:
 *
 *   - generateVideo:          reference-to-video  (bytedance/seedance-2.0/reference-to-video)
 *   - generateFromStartFrame: image-to-video      (bytedance/seedance-2.0/image-to-video)
 *
 * The wire pattern is the proven one from scripts/test-seedance-velocity.ts:
 *   POST https://queue.fal.run/{MODEL}  with header `Authorization: Key {falKey}`
 *   → { request_id, status_url, response_url }
 *   poll status_url until status === 'COMPLETED'
 *   GET response_url → { video: { url } }
 *
 * ADDITIVE: nothing else in the app imports this yet. Call sites are migrated
 * off Hedra onto this provider (via the router) in a later, separate stage.
 */

import { z } from 'zod';
import type { VideoEngineId } from '@/types/video-pipeline';
import { logger } from '@/lib/logger/logger';
import { resolveEngineCredentials, recordUsage } from './credentials';
import type {
  TenantContext,
  VideoEngineProvider,
  VideoGenerateRequest,
  VideoGenerationResult,
  VideoGenerationStatus,
} from './types';

const FAL_QUEUE_BASE = 'https://queue.fal.run';

/** Seedance reference-to-video model — multiple image/video/audio references. */
const MODEL_REFERENCE_TO_VIDEO = 'bytedance/seedance-2.0/reference-to-video';

/**
 * Seedance image-to-video model — animates from a single start frame.
 * CONFIRMED via fal docs (June 2026):
 *   https://fal.ai/models/bytedance/seedance-2.0/image-to-video/llms.txt
 * The start-frame parameter is `image_url` (singular). Optional `end_image_url`
 * (not used here). Output schema is identical: { video: { url } }.
 */
const MODEL_IMAGE_TO_VIDEO = 'bytedance/seedance-2.0/image-to-video';

/**
 * Seedance text-to-video model — synthesizes a full scene (with audio) from a
 * prompt alone. Used for spoken / dialogue clips, so `generate_audio` defaults
 * to true on this path. Output schema is identical: { video: { url } }.
 */
const MODEL_TEXT_TO_VIDEO = 'bytedance/seedance-2.0/text-to-video';

/**
 * Separator that joins the model id and fal request_id into a single, opaque,
 * self-describing generationId. The model id itself contains slashes but never
 * this token, so a single split on the FIRST occurrence cleanly recovers both
 * halves (request_ids are UUIDs and never contain it either).
 */
const GENERATION_ID_SEP = '::';

// ── Zod schemas for every fal JSON shape (no `any`) ────────────────────────────

const submitRespSchema = z.object({
  request_id: z.string().min(1),
  status_url: z.string().url(),
  response_url: z.string().url(),
});

const statusRespSchema = z.object({
  status: z.string().optional(),
  // fal sometimes reports queue position / logs; we only need status.
});

const resultRespSchema = z.object({
  video: z
    .object({
      url: z.string().url().optional(),
    })
    .optional(),
});

// ── In-memory request handle cache (OPTIONAL) ─────────────────────────────────
//
// getStatus no longer DEPENDS on this Map: the generationId encodes the model
// (`${model}${GENERATION_ID_SEP}${request_id}`), so status/response URLs are
// reconstructed deterministically from the id alone and survive restarts /
// different instances. The Map is kept only as a best-effort cache that lets
// getStatus reuse fal's exact submit-time URLs when they happen to be in memory;
// when absent we fall back to reconstruction. Correctness never relies on it.
interface FalHandle {
  statusUrl: string;
  responseUrl: string;
  model: string;
}
const handleStore = new Map<string, FalHandle>();

/** Compose the opaque, self-describing generationId from model + request_id. */
function encodeGenerationId(model: string, requestId: string): string {
  return `${model}${GENERATION_ID_SEP}${requestId}`;
}

/**
 * Reduce a full model id to the queue PATH that fal uses for status/response.
 *
 * VERIFIED LIVE (June 2026) against bytedance/seedance-2.0/text-to-video: fal's
 * submit response returned status/response URLs under `bytedance/seedance-2.0`,
 * i.e. it DROPS the trailing endpoint segment and keys the queue path on
 * `owner/app` only. So for a 3-segment model `owner/app/endpoint` the queue path
 * is `owner/app`; for a 2-segment model `owner/app` it is unchanged.
 *
 * (The fal docs example `fal-ai/flux/schnell` is itself an `owner/app/endpoint`
 *  triple whose queue path is `fal-ai/flux` — the doc's full-path example was
 *  misleading; the live wire shape is owner/app.)
 */
function modelToQueuePath(model: string): string {
  const segments = model.split('/').filter((s) => s.length > 0);
  if (segments.length <= 2) {
    return segments.join('/');
  }
  return `${segments[0]}/${segments[1]}`;
}

/**
 * Parse a composite generationId back into model + request_id, then reconstruct
 * fal's queue status/response URLs from them — statelessly. Splits on the FIRST
 * separator so model ids containing slashes are preserved intact.
 *
 * Verified fal pattern (June 2026, confirmed against the live submit response):
 *   status:   GET ${FAL_QUEUE_BASE}/${queuePath}/requests/${requestId}/status
 *   response: GET ${FAL_QUEUE_BASE}/${queuePath}/requests/${requestId}
 * where queuePath = owner/app (the trailing endpoint segment is dropped).
 */
function decodeGenerationId(
  generationId: string,
): { model: string; requestId: string; statusUrl: string; responseUrl: string } | null {
  const sepIndex = generationId.indexOf(GENERATION_ID_SEP);
  if (sepIndex <= 0) {
    return null;
  }
  const model = generationId.slice(0, sepIndex);
  const requestId = generationId.slice(sepIndex + GENERATION_ID_SEP.length);
  if (!model || !requestId) {
    return null;
  }
  const queuePath = modelToQueuePath(model);
  return {
    model,
    requestId,
    statusUrl: `${FAL_QUEUE_BASE}/${queuePath}/requests/${requestId}/status`,
    responseUrl: `${FAL_QUEUE_BASE}/${queuePath}/requests/${requestId}`,
  };
}

/** Map a normalized status string onto our union. */
function normalizeStatus(raw: string | undefined): VideoGenerationStatus['status'] {
  if (!raw) {
    return 'processing';
  }
  const upper = raw.toUpperCase();
  if (upper === 'COMPLETED') {
    return 'completed';
  }
  if (/FAILED|ERROR/.test(upper)) {
    return 'failed';
  }
  if (upper === 'IN_QUEUE') {
    return 'pending';
  }
  // IN_PROGRESS and anything else still running.
  return 'processing';
}

/** Build the shared Seedance request body fields from a normalized request. */
function buildCommonBody(req: VideoGenerateRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    prompt: req.prompt,
    resolution: req.resolution ?? '720p',
    aspect_ratio: req.aspectRatio ?? '16:9',
    // Seedance accepts a number (4–15) or the string 'auto' to let it decide.
    duration: typeof req.durationSeconds === 'number' ? req.durationSeconds : 'auto',
    generate_audio: req.generateAudio ?? false,
  };
  if (typeof req.seed === 'number') {
    body.seed = req.seed;
  }
  return body;
}

export class FalSeedanceProvider implements VideoEngineProvider {
  readonly id: VideoEngineId = 'fal';

  /**
   * Reference-to-video: place reference images / videos / audio into a new scene
   * described by the prompt. Maps imageUrls→image_urls, videoUrls→video_urls,
   * audioUrls→audio_urls.
   */
  async generateVideo(
    req: VideoGenerateRequest,
    ctx: TenantContext,
  ): Promise<VideoGenerationResult> {
    const body = buildCommonBody(req);
    if (req.imageUrls && req.imageUrls.length > 0) {
      body.image_urls = req.imageUrls;
    }
    if (req.videoUrls && req.videoUrls.length > 0) {
      body.video_urls = req.videoUrls;
    }
    if (req.audioUrls && req.audioUrls.length > 0) {
      body.audio_urls = req.audioUrls;
    }
    return this.submit(MODEL_REFERENCE_TO_VIDEO, body, ctx);
  }

  /**
   * Image-to-video: animate forward from a given start frame. The fal model
   * takes the start frame as `image_url` (singular).
   */
  async generateFromStartFrame(
    startFrameUrl: string,
    req: VideoGenerateRequest,
    ctx: TenantContext,
  ): Promise<VideoGenerationResult> {
    if (!startFrameUrl) {
      throw new Error('FalSeedanceProvider.generateFromStartFrame requires a startFrameUrl');
    }
    const body = buildCommonBody(req);
    body.image_url = startFrameUrl;
    return this.submit(MODEL_IMAGE_TO_VIDEO, body, ctx);
  }

  /**
   * Text-to-video: synthesize a full scene from the prompt alone. Audio is ON
   * by default on this path (spoken / dialogue clips). Resolution defaults to
   * 720p and aspect ratio to 16:9 unless the request overrides them.
   */
  async generateTextToVideo(
    req: VideoGenerateRequest,
    ctx: TenantContext,
  ): Promise<VideoGenerationResult> {
    const body: Record<string, unknown> = {
      prompt: req.prompt,
      resolution: req.resolution ?? '720p',
      aspect_ratio: req.aspectRatio ?? '16:9',
      // Seedance accepts a number (4–15) or the string 'auto'.
      duration: typeof req.durationSeconds === 'number' ? req.durationSeconds : 'auto',
      // Text-to-video is the spoken/dialogue path → audio ON unless disabled.
      generate_audio: req.generateAudio ?? true,
    };
    if (typeof req.seed === 'number') {
      body.seed = req.seed;
    }
    return this.submit(MODEL_TEXT_TO_VIDEO, body, ctx);
  }

  /**
   * Poll a generation STATELESSLY: the generationId encodes the model, so we
   * reconstruct fal's status/response URLs from the id alone — no dependency on
   * the in-memory Map (survives restarts / other instances). The Map is used
   * only as a best-effort cache when present.
   */
  async getStatus(
    generationId: string,
    ctx: TenantContext,
  ): Promise<VideoGenerationStatus> {
    const decoded = decodeGenerationId(generationId);
    const cached = handleStore.get(generationId);
    // Prefer reconstruction; fall back to cache only if the id can't be parsed.
    const statusUrl = decoded?.statusUrl ?? cached?.statusUrl;
    const responseUrl = decoded?.responseUrl ?? cached?.responseUrl;
    if (!statusUrl || !responseUrl) {
      return {
        status: 'failed',
        videoUrl: null,
        progress: null,
        error:
          `Unknown fal generation "${generationId}" — id is not a "model${GENERATION_ID_SEP}requestId" ` +
          'composite and no cached handle is available.',
      };
    }

    const { apiKey } = await resolveEngineCredentials(this.id, ctx);
    const auth = { Authorization: `Key ${apiKey}` };

    const statusRes = await fetch(statusUrl, { headers: auth });
    if (!statusRes.ok) {
      const text = await statusRes.text();
      return {
        status: 'failed',
        videoUrl: null,
        progress: null,
        error: `fal status poll failed (${statusRes.status}): ${text.slice(0, 300)}`,
      };
    }

    const statusJson = statusRespSchema.parse(await statusRes.json());
    const normalized = normalizeStatus(statusJson.status);

    if (normalized === 'failed') {
      return {
        status: 'failed',
        videoUrl: null,
        progress: null,
        error: `fal generation ${statusJson.status ?? 'FAILED'}`,
      };
    }

    if (normalized !== 'completed') {
      // fal's queue does not give a numeric percent here; report null progress.
      return { status: normalized, videoUrl: null, progress: null, error: null };
    }

    // COMPLETED → fetch the result payload.
    const resultRes = await fetch(responseUrl, { headers: auth });
    if (!resultRes.ok) {
      const text = await resultRes.text();
      return {
        status: 'failed',
        videoUrl: null,
        progress: null,
        error: `fal result fetch failed (${resultRes.status}): ${text.slice(0, 300)}`,
      };
    }

    const result = resultRespSchema.parse(await resultRes.json());
    const videoUrl = result.video?.url ?? null;
    if (!videoUrl) {
      return {
        status: 'failed',
        videoUrl: null,
        progress: null,
        error: 'fal reported COMPLETED but returned no video url',
      };
    }

    return { status: 'completed', videoUrl, progress: 100, error: null };
  }

  /** Shared submit: POST the body, validate, store the handle, record usage. */
  private async submit(
    model: string,
    body: Record<string, unknown>,
    ctx: TenantContext,
  ): Promise<VideoGenerationResult> {
    const { apiKey } = await resolveEngineCredentials(this.id, ctx);
    const auth = { Authorization: `Key ${apiKey}` };

    const submitRes = await fetch(`${FAL_QUEUE_BASE}/${model}`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!submitRes.ok) {
      const text = await submitRes.text();
      throw new Error(`fal submit failed (${submitRes.status}): ${text.slice(0, 500)}`);
    }

    const sub = submitRespSchema.parse(await submitRes.json());
    const generationId = encodeGenerationId(model, sub.request_id);
    // Optional cache only (getStatus reconstructs URLs from the id regardless).
    handleStore.set(generationId, {
      statusUrl: sub.status_url,
      responseUrl: sub.response_url,
      model,
    });

    // Metering seam — logs only for now (see recordUsage). One generation = 1 unit.
    await recordUsage(ctx, this.id, model, 1);

    logger.info('[fal-seedance] generation submitted', {
      tenantId: ctx.tenantId,
      model,
      requestId: sub.request_id,
      generationId,
      file: 'providers/fal-seedance-provider.ts',
    });

    return { generationId, status: 'IN_QUEUE' };
  }
}

/**
 * TEST-ONLY accessor for the optional in-memory cache. Lets verification scripts
 * clear the cache and prove getStatus resolves a generation from the composite
 * generationId ALONE (statelessly). Not used by application code.
 */
export function __getHandleStoreForTests(): Map<string, FalHandle> {
  return handleStore;
}
