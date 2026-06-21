/**
 * Editor Transcribe API
 *
 * POST — Transcribes one or more clip URLs into word-level timings for the
 *        Script & Podcast (edit-by-transcript) workspace.
 *
 * This is a THIN wrapper over the existing Deepgram transcription service
 * (`transcribeAudioBuffer`). Deepgram's prerecorded API accepts common video
 * containers directly and extracts the audio server-side, so no local ffmpeg
 * step is needed here — we fetch the clip bytes and hand them straight over.
 *
 * Returns per-clip word timings. If the Deepgram key is not configured the
 * service returns null and we report that honestly so the UI can show a
 * "transcription isn't connected" state rather than faking a transcript.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { transcribeAudioBuffer } from '@/lib/video/transcription-service';
import type { TranscriptionWord } from '@/types/scene-grading';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_CLIP_BYTES = 200 * 1024 * 1024; // 200 MB guard per clip
const DOWNLOAD_TIMEOUT_MS = 60_000;

const TranscribeSchema = z.object({
  clips: z
    .array(
      z.object({
        clipId: z.string().min(1),
        url: z.string().url(),
      }),
    )
    .min(1)
    .max(50),
});

/** Per-clip transcription result returned to the editor. */
export interface ClipTranscript {
  clipId: string;
  /** Plain-text transcript for the clip. */
  transcript: string;
  /** Word-level timings, in seconds, relative to the START of this clip's source. */
  words: TranscriptionWord[];
  /** Total spoken duration detected, in seconds. */
  durationSeconds: number;
  /** Average Deepgram confidence (0-1) across words. */
  confidence: number;
}

interface TranscribeSuccess {
  success: true;
  results: ClipTranscript[];
}

interface TranscribeFailure {
  success: false;
  /** Machine-readable reason: 'not_connected' when the Deepgram key is missing. */
  code: 'not_connected' | 'invalid_request' | 'error';
  error: string;
}

async function fetchClipBytes(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to download clip: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_CLIP_BYTES) {
      throw new Error('Clip is too large to transcribe (over 200 MB).');
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

  let parsed: z.infer<typeof TranscribeSchema>;
  try {
    const body: unknown = await request.json();
    const parseResult = TranscribeSchema.safeParse(body);
    if (!parseResult.success) {
      const zodErrors = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      const failure: TranscribeFailure = {
        success: false,
        code: 'invalid_request',
        error: `Invalid request: ${zodErrors}`,
      };
      return NextResponse.json(failure, { status: 400 });
    }
    parsed = parseResult.data;
  } catch {
    const failure: TranscribeFailure = {
      success: false,
      code: 'invalid_request',
      error: 'Request body must be valid JSON.',
    };
    return NextResponse.json(failure, { status: 400 });
  }

  try {
    const results: ClipTranscript[] = [];
    let anyConnected = false;

    for (const clip of parsed.clips) {
      const bytes = await fetchClipBytes(clip.url);
      const transcription = await transcribeAudioBuffer(bytes);

      // null = Deepgram key missing OR transcription failed. The service logs
      // the distinction; for the first clip we treat a null as "not connected"
      // only if NONE of the clips could be transcribed (handled below).
      if (transcription === null) {
        results.push({
          clipId: clip.clipId,
          transcript: '',
          words: [],
          durationSeconds: 0,
          confidence: 0,
        });
        continue;
      }

      anyConnected = true;
      results.push({
        clipId: clip.clipId,
        transcript: transcription.transcript,
        words: transcription.words,
        durationSeconds: transcription.durationSeconds,
        confidence: transcription.confidence,
      });
    }

    // If not a single clip produced a transcript, the most likely cause is the
    // Deepgram key being unconfigured. Report it honestly rather than returning
    // a wall of empty transcripts that the UI can't distinguish from silence.
    if (!anyConnected) {
      const failure: TranscribeFailure = {
        success: false,
        code: 'not_connected',
        error:
          'Transcription service is not connected. Add a Deepgram API key in Settings to enable script editing.',
      };
      return NextResponse.json(failure, { status: 503 });
    }

    const payload: TranscribeSuccess = { success: true, results };
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      'Editor transcription failed',
      error instanceof Error ? error : new Error(message),
      { file: 'video/editor/transcribe/route.ts' },
    );
    const failure: TranscribeFailure = { success: false, code: 'error', error: message };
    return NextResponse.json(failure, { status: 500 });
  }
}
