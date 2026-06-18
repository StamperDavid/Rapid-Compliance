/**
 * Editor Clippable Moments API
 *
 * POST — Reviews the operator's video and returns its CLIPPABLE MOMENTS (the
 * OpusClip-style auto-highlight). This is the route behind the Make Clips panel's
 * "Find clippable moments" button.
 *
 * Flow:
 *   1. Fetch the source video bytes for each clip on the timeline.
 *   2. Transcribe to word-level timings via Deepgram (`transcribeAudioBuffer`),
 *      stitching multiple clips into one timeline transcript (each clip's words
 *      are offset by where that clip starts on the concatenated timeline).
 *   3. Hand the timeline transcript + total duration to the Video Editor
 *      Specialist (a REAL LLM agent loaded from its Golden Master) which returns
 *      the highlight spans: { startSec, endSec, reason, suggestedCaption, score }.
 *   4. Return { success: true, moments }.
 *
 * Honesty (CLAUDE.md standing rules): if the Deepgram key is not configured the
 * transcription service returns null and we report that with a 503 + a
 * machine-readable `code: 'not_connected'`. We NEVER fabricate moments — if the
 * agent can't run or the analysis fails, we return an honest error.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { transcribeAudioBuffer } from '@/lib/video/transcription-service';
import {
  findClippableMoments,
  type ClippableMoment,
} from '@/lib/agents/content/video-editor/specialist';
import type { TranscriptionResult, TranscriptionWord } from '@/types/scene-grading';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_CLIP_BYTES = 200 * 1024 * 1024; // 200 MB guard per clip
const DOWNLOAD_TIMEOUT_MS = 60_000;
const DEFAULT_CLIP_DURATION = 5; // fallback when a clip's duration is unknown (0)

const ClippableMomentsRequestSchema = z.object({
  clips: z
    .array(
      z.object({
        url: z.string().url(),
        /** The clip's effective duration on the timeline, in seconds. */
        durationSeconds: z.number().min(0),
      }),
    )
    .min(1, 'At least one clip is required.'),
  /** Optional desired number of moments (the agent still decides if omitted). */
  maxMoments: z.number().int().min(1).max(20).optional(),
});

interface ClippableMomentsSuccess {
  success: true;
  moments: ClippableMoment[];
}

interface ClippableMomentsFailure {
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
      throw new Error('A clip is too large to analyze (over 200 MB).');
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

  let parsed: z.infer<typeof ClippableMomentsRequestSchema>;
  try {
    const body: unknown = await request.json();
    const parseResult = ClippableMomentsRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const zodErrors = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      const failure: ClippableMomentsFailure = {
        success: false,
        code: 'invalid_request',
        error: `Invalid request: ${zodErrors}`,
      };
      return NextResponse.json(failure, { status: 400 });
    }
    parsed = parseResult.data;
  } catch {
    const failure: ClippableMomentsFailure = {
      success: false,
      code: 'invalid_request',
      error: 'Request body must be valid JSON.',
    };
    return NextResponse.json(failure, { status: 400 });
  }

  try {
    // Build ONE timeline transcript by concatenating each clip's transcription,
    // offsetting every word by where that clip starts on the project timeline.
    const allWords: TranscriptionWord[] = [];
    const transcriptParts: string[] = [];
    let timelineOffset = 0;
    let totalConfidenceWeight = 0;
    let weightedConfidence = 0;

    for (const clip of parsed.clips) {
      const bytes = await fetchVideoBytes(clip.url);
      const transcription = await transcribeAudioBuffer(bytes);

      // null = Deepgram key missing OR transcription failed. Either way we can't
      // analyze the video right now — report it honestly, never fake moments.
      if (transcription === null) {
        const failure: ClippableMomentsFailure = {
          success: false,
          code: 'not_connected',
          error:
            'Finding clippable moments needs a transcription service. Add a Deepgram API key in Settings to turn this on.',
        };
        return NextResponse.json(failure, { status: 503 });
      }

      for (const w of transcription.words) {
        allWords.push({
          word: w.word,
          start: w.start + timelineOffset,
          end: w.end + timelineOffset,
          confidence: w.confidence,
        });
      }
      if (transcription.transcript.trim().length > 0) {
        transcriptParts.push(transcription.transcript.trim());
      }
      weightedConfidence += transcription.confidence * transcription.words.length;
      totalConfidenceWeight += transcription.words.length;

      // Advance the timeline cursor by this clip's effective duration (fall back
      // to the transcription's own duration, then a constant, never 0).
      const clipDuration =
        clip.durationSeconds > 0
          ? clip.durationSeconds
          : transcription.durationSeconds > 0
            ? transcription.durationSeconds
            : DEFAULT_CLIP_DURATION;
      timelineOffset += clipDuration;
    }

    // No speech anywhere on the timeline — there is nothing to analyze. Honest,
    // not an error: the agent needs words to find spoken moments.
    if (allWords.length === 0) {
      const payload: ClippableMomentsSuccess = { success: true, moments: [] };
      logger.info('Clippable moments: no speech detected on timeline', {
        clipCount: parsed.clips.length,
        file: 'video/editor/clippable-moments/route.ts',
      });
      return NextResponse.json(payload);
    }

    const transcription: TranscriptionResult = {
      transcript: transcriptParts.join(' '),
      words: allWords,
      durationSeconds: timelineOffset,
      confidence: totalConfidenceWeight > 0 ? weightedConfidence / totalConfidenceWeight : 0,
    };

    // REAL LLM agent — loads its Golden Master and decides every moment. Nothing
    // here scores or detects spans; the intelligence is the specialist's LLM call.
    const moments = await findClippableMoments({
      transcription,
      durationSeconds: timelineOffset,
      ...(parsed.maxMoments ? { maxMoments: parsed.maxMoments } : {}),
    });

    logger.info('Clippable moments found', {
      momentCount: moments.length,
      clipCount: parsed.clips.length,
      durationSeconds: Math.round(timelineOffset),
      file: 'video/editor/clippable-moments/route.ts',
    });

    const payload: ClippableMomentsSuccess = { success: true, moments };
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      'Clippable moments analysis failed',
      error instanceof Error ? error : new Error(message),
      { file: 'video/editor/clippable-moments/route.ts' },
    );
    const failure: ClippableMomentsFailure = { success: false, code: 'error', error: message };
    return NextResponse.json(failure, { status: 500 });
  }
}
