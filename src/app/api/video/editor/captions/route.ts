/**
 * Editor Captions API
 *
 * POST — Generates burned-in-ready caption overlays for a single video span.
 *
 * This is a THIN wrapper that REUSES the existing Deepgram transcription
 * service (`transcribeAudioBuffer`) and the existing caption generator
 * (`generateCaptionOverlays`). It does NOT build a new transcription or caption
 * engine.
 *
 * Flow:
 *   1. Fetch the source video bytes from `url`.
 *   2. Transcribe to word-level timings via Deepgram Nova-3.
 *   3. Group words into timed caption lines via `generateCaptionOverlays`.
 *   4. Offset every timestamp by `startOffset` (seconds) so a short's captions
 *      line up with where the short actually starts on its own timeline.
 *   5. Return `{ success: true, overlays: TextOverlay[] }` — overlays carry the
 *      `TextOverlay` shape the /api/video/editor/render route's `textOverlays`
 *      array expects.
 *
 * Honesty (CLAUDE.md standing rules): if the Deepgram key is not configured the
 * transcription service returns null and we report that with a 503 + a
 * machine-readable `code: 'not_connected'` — we never fabricate captions.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { transcribeAudioBuffer } from '@/lib/video/transcription-service';
import { generateCaptionOverlays } from '@/lib/video/caption-service';
import type { CaptionStyle } from '@/types/video-pipeline';
import type { TextOverlay } from '@/app/(dashboard)/content/video/editor/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_CLIP_BYTES = 200 * 1024 * 1024; // 200 MB guard
const DOWNLOAD_TIMEOUT_MS = 60_000;

const CAPTION_STYLES: readonly CaptionStyle[] = ['bold-center', 'bottom-bar', 'karaoke'];

const CaptionsRequestSchema = z.object({
  url: z.string().url(),
  /**
   * Seconds to ADD to every caption timestamp. Deepgram returns timings
   * relative to the start of the fetched media; when the caller renders that
   * media as the start of a short, pass 0. When the caption track is being
   * merged into a longer timeline that starts later, pass that offset.
   */
  startOffset: z.number().min(0).default(0),
  style: z.enum(['bold-center', 'bottom-bar', 'karaoke']).default('bold-center'),
});

interface CaptionsSuccess {
  success: true;
  overlays: TextOverlay[];
}

interface CaptionsFailure {
  success: false;
  /** 'not_connected' when the Deepgram key is missing/transcription unavailable. */
  code: 'not_connected' | 'invalid_request' | 'error';
  error: string;
}

async function fetchVideoBytes(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_CLIP_BYTES) {
      throw new Error('Video is too large to caption (over 200 MB).');
    }
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  let parsed: z.infer<typeof CaptionsRequestSchema>;
  try {
    const body: unknown = await request.json();
    const parseResult = CaptionsRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const zodErrors = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      const failure: CaptionsFailure = {
        success: false,
        code: 'invalid_request',
        error: `Invalid request: ${zodErrors}`,
      };
      return NextResponse.json(failure, { status: 400 });
    }
    parsed = parseResult.data;
  } catch {
    const failure: CaptionsFailure = {
      success: false,
      code: 'invalid_request',
      error: 'Request body must be valid JSON.',
    };
    return NextResponse.json(failure, { status: 400 });
  }

  try {
    const bytes = await fetchVideoBytes(parsed.url);
    const transcription = await transcribeAudioBuffer(bytes);

    // null = Deepgram key missing OR transcription failed. Either way the caller
    // can't get captions right now — report it honestly, never fake a track.
    if (transcription === null) {
      const failure: CaptionsFailure = {
        success: false,
        code: 'not_connected',
        error:
          'Auto-captions need a transcription service. Add a Deepgram API key in Settings to turn captions on.',
      };
      return NextResponse.json(failure, { status: 503 });
    }

    const style: CaptionStyle = CAPTION_STYLES.includes(parsed.style) ? parsed.style : 'bold-center';
    const captionConfigs = generateCaptionOverlays(transcription.words, style);

    // Map the style-agnostic TextOverlayConfig output into the editor's
    // TextOverlay shape (which the render route's textOverlays expects), applying
    // the requested start offset so the short's captions line up.
    const overlays: TextOverlay[] = captionConfigs.map((config) => ({
      id: randomUUID(),
      text: config.text,
      startTime: config.startTime + parsed.startOffset,
      endTime: config.endTime + parsed.startOffset,
      position: config.position,
      fontSize: config.fontSize,
      fontColor: config.fontColor,
      backgroundColor: config.backgroundColor ?? 'transparent',
    }));

    logger.info('Editor captions generated', {
      overlayCount: overlays.length,
      style,
      startOffset: parsed.startOffset,
      file: 'video/editor/captions/route.ts',
    });

    const payload: CaptionsSuccess = { success: true, overlays };
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      'Editor caption generation failed',
      error instanceof Error ? error : new Error(message),
      { file: 'video/editor/captions/route.ts' },
    );
    const failure: CaptionsFailure = { success: false, code: 'error', error: message };
    return NextResponse.json(failure, { status: 500 });
  }
}
