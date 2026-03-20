/**
 * Transcription Service
 *
 * Wraps Deepgram's speech-to-text API (SDK v5) for scene audio transcription.
 * Returns structured results with per-word timestamps and confidence scores.
 * Returns null gracefully if the key is not configured or transcription fails.
 */

import { DeepgramClient } from '@deepgram/sdk';
import { readFile } from 'fs/promises';
import { logger } from '@/lib/logger/logger';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { TranscriptionResult, TranscriptionWord } from '@/types/scene-grading';

/**
 * Mirrors the per-word shape returned by Deepgram's prerecorded API (v5 SDK).
 * All fields are optional in the SDK response — we guard with nullish coalescing.
 */
interface DeepgramWord {
  word?: string;
  start?: number;
  end?: number;
  confidence?: number;
}

/**
 * Transcribe an audio file using Deepgram Nova-3.
 *
 * @param audioFilePath - Path to a WAV/MP3 file on disk
 * @returns TranscriptionResult with per-word timestamps, or null if unavailable
 */
export async function transcribeAudio(
  audioFilePath: string,
): Promise<TranscriptionResult | null> {
  // Get Deepgram API key from Firestore
  const apiKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'deepgram');
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    logger.warn('Deepgram API key not configured — skipping transcription', {
      file: 'transcription-service.ts',
    });
    return null;
  }

  try {
    const audioBuffer = await readFile(audioFilePath);

    // SDK v5: constructor takes { apiKey } options object
    const deepgram = new DeepgramClient({ apiKey });

    // SDK v5: client.listen.v1.media.transcribeFile(buffer, options)
    // HttpResponsePromise<T> extends Promise<T>, so await resolves directly to MediaTranscribeResponse
    // (ListenV1Response | ListenV1AcceptedResponse)
    const transcribeResponse = await deepgram.listen.v1.media.transcribeFile(audioBuffer, {
      model: 'nova-3',
      smart_format: true,
      punctuate: true,
      diarize: false,
      language: 'en',
    });

    // Guard: ListenV1AcceptedResponse has no `results` (async callback mode) — treat as failure
    if (!transcribeResponse || !('results' in transcribeResponse)) {
      logger.warn('Deepgram returned an accepted/callback response with no immediate results', {
        file: 'transcription-service.ts',
      });
      return null;
    }

    const channel = transcribeResponse.results.channels[0];
    const alternative = channel?.alternatives?.[0];

    if (!alternative) {
      logger.warn('Deepgram returned no transcription alternatives', {
        file: 'transcription-service.ts',
      });
      return null;
    }

    const transcript = alternative.transcript ?? '';
    const rawWords: DeepgramWord[] = alternative.words ?? [];

    const words: TranscriptionWord[] = rawWords.map((w) => ({
      word: String(w.word ?? ''),
      start: Number(w.start ?? 0),
      end: Number(w.end ?? 0),
      confidence: Number(w.confidence ?? 0),
    }));

    // Calculate average confidence
    const avgConfidence =
      words.length > 0
        ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length
        : 0;

    // Duration from the last word's end time, or from Deepgram metadata
    const durationSeconds =
      words.length > 0
        ? words[words.length - 1].end
        : (transcribeResponse.metadata?.duration ?? 0);

    logger.info('Transcription complete', {
      wordCount: words.length,
      confidence: Math.round(avgConfidence * 100),
      durationSeconds: Math.round(durationSeconds),
      file: 'transcription-service.ts',
    });

    return {
      transcript,
      words,
      durationSeconds,
      confidence: avgConfidence,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      'Deepgram transcription failed',
      error instanceof Error ? error : new Error(message),
      {
        audioFilePath,
        file: 'transcription-service.ts',
      },
    );
    return null;
  }
}
