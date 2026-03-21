/**
 * Unit Tests: src/lib/video/transcription-service.ts
 *
 * Covers all branches of transcribeAudio():
 *   - Missing / empty API key  → null (no file read, no Deepgram call)
 *   - Successful transcription → populated TranscriptionResult
 *   - Accepted/callback response (no `results` key) → null
 *   - No alternatives returned → null
 *   - Empty words array → duration falls back to metadata.duration
 *   - Words with missing optional fields → nullish-coalescing defaults
 *   - File-read error → null (graceful catch)
 *   - Deepgram API error → null (graceful catch)
 *   - Average confidence calculation
 *   - Duration uses last word end time when words are present
 *
 * Mock strategy
 * ─────────────
 * jest.mock() factories are hoisted by babel-jest before any import.  To
 * share a reference to a mock function across the factory closure and the
 * test body we store it on the mock module's return value and re-import it
 * through a typed accessor.
 *
 * For @deepgram/sdk the factory creates `mockTranscribeFile` as a jest.fn()
 * inside the closure, makes it the `transcribeFile` implementation, and also
 * exposes it as `__mockTranscribeFile` on the returned object so tests can
 * import it.  A narrow interface (`DeepgramMockModule`) describes that shape
 * so no `as any` is needed.
 */

// ---------------------------------------------------------------------------
// Module mocks — must appear before any import so babel-jest hoisting works.
// ---------------------------------------------------------------------------

jest.mock('@deepgram/sdk', () => {
  const transcribeFile = jest.fn();
  return {
    DeepgramClient: jest.fn().mockImplementation(() => ({
      listen: { v1: { media: { transcribeFile } } },
    })),
    // Expose for retrieval after import — typed via DeepgramMockModule below.
    __mockTranscribeFile: transcribeFile,
  };
});

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

jest.mock('@/lib/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/constants/platform', () => ({
  PLATFORM_ID: 'rapid-compliance-root',
}));

// ---------------------------------------------------------------------------
// Imports — after mocks so the module registry gives mocked versions.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from '@jest/globals';
import * as DeepgramModule from '@deepgram/sdk';
import { readFile } from 'fs/promises';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { transcribeAudio } from '@/lib/video/transcription-service';
import type { TranscriptionResult } from '@/types/scene-grading';

// ---------------------------------------------------------------------------
// Typed shape for the @deepgram/sdk mock module.
// The factory above adds __mockTranscribeFile alongside DeepgramClient.
// ---------------------------------------------------------------------------

interface DeepgramMockModule {
  DeepgramClient: jest.Mock;
  __mockTranscribeFile: jest.Mock;
}

// ---------------------------------------------------------------------------
// Typed mock handles
// ---------------------------------------------------------------------------

// Cast to the narrow interface that includes the test-helper property.
const deepgramMock = DeepgramModule as unknown as DeepgramMockModule;
const mockTranscribeFile = deepgramMock.__mockTranscribeFile;

const mockReadFile = readFile as jest.Mock;
const mockGetServiceKey = apiKeyService.getServiceKey as jest.Mock;
const mockLoggerWarn = logger.warn as jest.Mock;
const mockLoggerError = logger.error as jest.Mock;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUDIO_PATH = '/tmp/test-scene.wav';
const FAKE_API_KEY = 'dg-test-key-abc123';
const FAKE_AUDIO_BUFFER = Buffer.from('fake-audio-data');

// ---------------------------------------------------------------------------
// Helper — build a minimal valid Deepgram synchronous response.
// ---------------------------------------------------------------------------

interface FakeWord {
  word?: string;
  start?: number;
  end?: number;
  confidence?: number;
}

function makeDgResponse(overrides: {
  transcript?: string;
  words?: FakeWord[];
  duration?: number;
} = {}) {
  const {
    transcript = 'Hello world',
    words = [
      { word: 'Hello', start: 0.0, end: 0.5, confidence: 0.99 },
      { word: 'world', start: 0.6, end: 1.2, confidence: 0.97 },
    ],
    duration = 5.0,
  } = overrides;

  return {
    results: {
      channels: [
        { alternatives: [{ transcript, words }] },
      ],
    },
    metadata: { duration },
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('transcribeAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: API key is configured.
    mockGetServiceKey.mockResolvedValue(FAKE_API_KEY);

    // Default: file read succeeds.
    mockReadFile.mockResolvedValue(FAKE_AUDIO_BUFFER);
  });

  // -------------------------------------------------------------------------
  // 1. Returns null when API key is an empty string
  // -------------------------------------------------------------------------
  it('returns null and logs a warning when the API key is an empty string', async () => {
    mockGetServiceKey.mockResolvedValue('');

    const result = await transcribeAudio(AUDIO_PATH);

    expect(result).toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Deepgram API key not configured — skipping transcription',
      { file: 'transcription-service.ts' },
    );
    // No file read or Deepgram call should have occurred.
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockTranscribeFile).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 2. Returns null when API key is null (not a string)
  // -------------------------------------------------------------------------
  it('returns null when the API key is null (not a string)', async () => {
    mockGetServiceKey.mockResolvedValue(null);

    const result = await transcribeAudio(AUDIO_PATH);

    expect(result).toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Deepgram API key not configured — skipping transcription',
      { file: 'transcription-service.ts' },
    );
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 3. Successful transcription with words, confidence, and duration
  // -------------------------------------------------------------------------
  it('returns a populated TranscriptionResult on a successful Deepgram response', async () => {
    const dgResponse = makeDgResponse({
      transcript: 'Hello world',
      words: [
        { word: 'Hello', start: 0.0, end: 0.5, confidence: 0.99 },
        { word: 'world', start: 0.6, end: 1.2, confidence: 0.97 },
      ],
    });
    mockTranscribeFile.mockResolvedValue(dgResponse);

    const result = await transcribeAudio(AUDIO_PATH);

    expect(result).not.toBeNull();
    const typed = result as TranscriptionResult;
    expect(typed.transcript).toBe('Hello world');
    expect(typed.words).toHaveLength(2);
    expect(typed.words[0]).toEqual({ word: 'Hello', start: 0.0, end: 0.5, confidence: 0.99 });
    expect(typed.words[1]).toEqual({ word: 'world', start: 0.6, end: 1.2, confidence: 0.97 });
    // Duration = last word end time.
    expect(typed.durationSeconds).toBe(1.2);
    // Average confidence = (0.99 + 0.97) / 2.
    expect(typed.confidence).toBeCloseTo(0.98);

    // Deepgram was constructed with the correct API key.
    expect(deepgramMock.DeepgramClient).toHaveBeenCalledWith({ apiKey: FAKE_API_KEY });
    // transcribeFile was called with the audio buffer and correct options.
    expect(mockTranscribeFile).toHaveBeenCalledWith(
      FAKE_AUDIO_BUFFER,
      expect.objectContaining({ model: 'nova-3', smart_format: true, punctuate: true }),
    );
  });

  // -------------------------------------------------------------------------
  // 4. Returns null when Deepgram returns an accepted/callback response
  //    (object with no 'results' key)
  // -------------------------------------------------------------------------
  it('returns null and logs a warning when Deepgram returns an accepted response with no results', async () => {
    // Simulate ListenV1AcceptedResponse — has no `results` property.
    mockTranscribeFile.mockResolvedValue({ request_id: 'cb-123' });

    const result = await transcribeAudio(AUDIO_PATH);

    expect(result).toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Deepgram returned an accepted/callback response with no immediate results',
      { file: 'transcription-service.ts' },
    );
  });

  // -------------------------------------------------------------------------
  // 5. Returns null when transcribeFile resolves to a falsy value
  // -------------------------------------------------------------------------
  it('returns null when transcribeFile resolves to null', async () => {
    mockTranscribeFile.mockResolvedValue(null);

    const result = await transcribeAudio(AUDIO_PATH);

    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 6. Returns null when no alternatives are present in the channel
  // -------------------------------------------------------------------------
  it('returns null when Deepgram returns no alternatives', async () => {
    mockTranscribeFile.mockResolvedValue({
      results: {
        channels: [{ alternatives: [] }],
      },
      metadata: { duration: 3.0 },
    });

    const result = await transcribeAudio(AUDIO_PATH);

    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 7. Returns null when the channels array is empty
  // -------------------------------------------------------------------------
  it('returns null when Deepgram returns an empty channels array', async () => {
    mockTranscribeFile.mockResolvedValue({
      results: { channels: [] },
      metadata: { duration: 0 },
    });

    const result = await transcribeAudio(AUDIO_PATH);

    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 8. Empty words array — duration falls back to metadata.duration
  // -------------------------------------------------------------------------
  it('uses metadata.duration when the words array is empty', async () => {
    mockTranscribeFile.mockResolvedValue({
      results: {
        channels: [
          { alternatives: [{ transcript: 'silent', words: [] }] },
        ],
      },
      metadata: { duration: 7.5 },
    });

    const result = await transcribeAudio(AUDIO_PATH);

    expect(result).not.toBeNull();
    const typed = result as TranscriptionResult;
    expect(typed.words).toHaveLength(0);
    expect(typed.durationSeconds).toBe(7.5);
    expect(typed.confidence).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 9. Words with missing optional fields — nullish coalescing produces defaults
  // -------------------------------------------------------------------------
  it('defaults word fields to 0 / empty-string when Deepgram omits them', async () => {
    mockTranscribeFile.mockResolvedValue({
      results: {
        channels: [
          {
            alternatives: [
              {
                transcript: 'incomplete',
                // All optional word fields are absent.
                words: [{}],
              },
            ],
          },
        ],
      },
      metadata: { duration: 2.0 },
    });

    const result = await transcribeAudio(AUDIO_PATH);

    expect(result).not.toBeNull();
    const typed = result as TranscriptionResult;
    expect(typed.words[0]).toEqual({ word: '', start: 0, end: 0, confidence: 0 });
  });

  // -------------------------------------------------------------------------
  // 10. Returns null on file-read error (graceful failure)
  // -------------------------------------------------------------------------
  it('returns null and logs an error when readFile throws', async () => {
    const fileError = new Error('ENOENT: file not found');
    mockReadFile.mockRejectedValue(fileError);

    const result = await transcribeAudio(AUDIO_PATH);

    expect(result).toBeNull();
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Deepgram transcription failed',
      fileError,
      expect.objectContaining({ audioFilePath: AUDIO_PATH }),
    );
    // Deepgram was never invoked because readFile threw first.
    expect(mockTranscribeFile).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 11. Returns null on Deepgram API error (graceful failure)
  // -------------------------------------------------------------------------
  it('returns null and logs an error when the Deepgram API call rejects', async () => {
    const apiError = new Error('Deepgram rate limit exceeded');
    mockTranscribeFile.mockRejectedValue(apiError);

    const result = await transcribeAudio(AUDIO_PATH);

    expect(result).toBeNull();
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Deepgram transcription failed',
      apiError,
      expect.objectContaining({ audioFilePath: AUDIO_PATH }),
    );
  });

  // -------------------------------------------------------------------------
  // 12. Non-Error thrown value is wrapped in an Error before being logged
  // -------------------------------------------------------------------------
  it('wraps a non-Error thrown value in an Error before logging it', async () => {
    mockTranscribeFile.mockRejectedValue('string error value');

    const result = await transcribeAudio(AUDIO_PATH);

    expect(result).toBeNull();
    // logger.error second argument should be an Error instance, not the raw string.
    const errorArg = mockLoggerError.mock.calls[0]?.[1];
    expect(errorArg).toBeInstanceOf(Error);
  });

  // -------------------------------------------------------------------------
  // 13. Average confidence calculated correctly across multiple words
  // -------------------------------------------------------------------------
  it('calculates average confidence as the mean of all per-word confidence values', async () => {
    mockTranscribeFile.mockResolvedValue(
      makeDgResponse({
        words: [
          { word: 'one', start: 0.0, end: 0.3, confidence: 0.80 },
          { word: 'two', start: 0.4, end: 0.7, confidence: 0.90 },
          { word: 'three', start: 0.8, end: 1.1, confidence: 1.00 },
        ],
      }),
    );

    const result = await transcribeAudio(AUDIO_PATH);

    expect(result).not.toBeNull();
    // (0.80 + 0.90 + 1.00) / 3 = 0.9
    expect((result as TranscriptionResult).confidence).toBeCloseTo(0.9);
  });

  // -------------------------------------------------------------------------
  // 14. Duration uses the last word's end time, not metadata, when words exist
  // -------------------------------------------------------------------------
  it('uses the last word end time as durationSeconds when words are present', async () => {
    mockTranscribeFile.mockResolvedValue(
      makeDgResponse({
        words: [
          { word: 'a', start: 0.0, end: 1.0, confidence: 0.95 },
          { word: 'b', start: 1.1, end: 3.7, confidence: 0.95 },
        ],
        // metadata.duration intentionally differs to confirm last-word wins.
        duration: 99.0,
      }),
    );

    const result = await transcribeAudio(AUDIO_PATH);

    expect(result).not.toBeNull();
    expect((result as TranscriptionResult).durationSeconds).toBe(3.7);
  });
});
