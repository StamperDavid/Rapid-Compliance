/**
 * Hedra Service Unit Tests
 *
 * Tests for all public functions in src/lib/video/hedra-service.ts:
 *   - generateHedraPromptVideo
 *   - generateHedraAvatarVideo
 *   - generateHedraImage
 *   - getHedraVideoStatus
 *
 * Fetch is mocked globally. All Hedra API interactions are simulated.
 * The module-level imageModelCache is reset between tests by manipulating
 * Date.now so the cache always appears expired at the start of each test.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ============================================================================
// Module mocks — must appear before the tested module is imported
// ============================================================================

jest.mock('@/lib/api-keys/api-key-service', () => ({
  apiKeyService: {
    getServiceKey: jest.fn(),
  },
}));

jest.mock('@/lib/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/constants/platform', () => ({
  PLATFORM_ID: 'test-platform',
}));

// ============================================================================
// Imports — after mocks are registered
// ============================================================================

import {
  generateHedraPromptVideo,
  generateHedraAvatarVideo,
  generateHedraImage,
  getHedraVideoStatus,
  type HedraGenerationResult,
  type HedraVideoStatus,
  type HedraImageResult,
} from '@/lib/video/hedra-service';
import { apiKeyService } from '@/lib/api-keys/api-key-service';

// ============================================================================
// Typed helpers
// ============================================================================

/** Create a minimal successful fetch Response. */
function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: {
      get: (_name: string) => null,
    },
  } as unknown as Response;
}

/** Create a failed fetch Response with a JSON error body. */
function makeErrorResponse(status: number, detail: string): Response {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve({ detail }),
    text: () => Promise.resolve(JSON.stringify({ detail })),
    headers: {
      get: (_name: string) => null,
    },
  } as unknown as Response;
}

/** Standard successful generation response from POST /generations. */
const GENERATION_RESPONSE = {
  id: 'gen-abc-123',
  status: 'pending',
  created_at: '2026-03-20T12:00:00Z',
};

/** Standard successful asset creation response from POST /assets. */
const ASSET_RESPONSE = {
  id: 'asset-xyz-456',
  name: 'avatar-portrait',
  type: 'image',
};

/** Standard file download response (portrait/audio). */
function makeFileDownloadResponse(): Response {
  const buffer = new ArrayBuffer(8);
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: (name: string) => (name === 'content-type' ? 'image/png' : null),
    },
    arrayBuffer: () => Promise.resolve(buffer),
    text: () => Promise.resolve(''),
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

/** Standard successful asset upload response. */
const UPLOAD_RESPONSE: Response = {
  ok: true,
  status: 200,
  statusText: 'OK',
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
  headers: { get: (_: string) => null },
} as unknown as Response;

// ============================================================================
// Test setup
// ============================================================================

const HEDRA_BASE = 'https://api.hedra.com/web-app/public';
const TEST_API_KEY = 'test-hedra-api-key-xyz';

/** Monotonically increasing clock — ensures each test sees an expired imageModelCache. */
let testClock = Date.now();

/** Typed reference to the mocked apiKeyService.getServiceKey function. */
const mockGetServiceKey = apiKeyService.getServiceKey as jest.MockedFunction<
  typeof apiKeyService.getServiceKey
>;

beforeEach(() => {
  jest.clearAllMocks();

  // Ensure API key resolves by default
  mockGetServiceKey.mockResolvedValue(TEST_API_KEY);

  // Reset global fetch to a clean mock
  global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

  // Advance Date.now past any previously cached expiry. Each test gets a clock
  // value 100M ms (~27h) ahead of the last, guaranteeing the 10-min cache TTL
  // has expired regardless of what a prior test wrote.
  testClock += 100_000_000;
  jest.spyOn(Date, 'now').mockReturnValue(testClock);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================================
// generateHedraPromptVideo
// ============================================================================

describe('generateHedraPromptVideo', () => {
  it('submits a generation and returns a result with default options', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeJsonResponse(GENERATION_RESPONSE),
    );

    const result: HedraGenerationResult = await generateHedraPromptVideo({
      textPrompt: 'A person presenting sales data',
    });

    expect(result.generationId).toBe('gen-abc-123');
    expect(result.status).toBe('pending');
    expect(result.createdAt).toBe('2026-03-20T12:00:00Z');
    // The Kling O3 model ID is hard-coded in the service
    expect(result.modelId).toBe('b0e156da-da25-40b2-8386-937da7f47cc3');

    // Verify the correct endpoint and API key header were used
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${HEDRA_BASE}/generations`);
    expect((init.headers as Record<string, string>)['x-api-key']).toBe(TEST_API_KEY);
    expect(init.method).toBe('POST');
  });

  it('appends speech text to the prompt when speechText is provided', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeJsonResponse(GENERATION_RESPONSE),
    );

    await generateHedraPromptVideo({
      textPrompt: 'A person presenting',
      speechText: 'Hello, welcome to SalesVelocity.',
    });

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      generated_video_inputs: { text_prompt: string };
    };

    expect(body.generated_video_inputs.text_prompt).toContain('A person presenting');
    expect(body.generated_video_inputs.text_prompt).toContain('Hello, welcome to SalesVelocity.');
    expect(body.generated_video_inputs.text_prompt).toContain('Dialogue:');
  });

  it('applies custom resolution, aspect ratio, and duration from options', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeJsonResponse(GENERATION_RESPONSE),
    );

    await generateHedraPromptVideo({
      textPrompt: 'Demo',
      resolution: '1080p',
      aspectRatio: '9:16',
      durationMs: 15000,
    });

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      generated_video_inputs: { resolution: string; aspect_ratio: string; duration_ms: number };
    };

    expect(body.generated_video_inputs.resolution).toBe('1080p');
    expect(body.generated_video_inputs.aspect_ratio).toBe('9:16');
    expect(body.generated_video_inputs.duration_ms).toBe(15000);
  });

  it('throws when API key is not configured', async () => {
    mockGetServiceKey.mockResolvedValue(null);

    await expect(
      generateHedraPromptVideo({ textPrompt: 'Test' }),
    ).rejects.toThrow('Hedra API key not configured');
  });

  it('throws when the generation API returns a non-2xx status', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeErrorResponse(422, 'Invalid prompt'),
    );

    await expect(
      generateHedraPromptVideo({ textPrompt: 'Bad prompt' }),
    ).rejects.toThrow('Hedra generation submit failed (422): Invalid prompt');
  });

  it('throws when the generation response is missing an ID', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeJsonResponse({ status: 'pending', created_at: '2026-03-20T00:00:00Z' }),
    );

    await expect(
      generateHedraPromptVideo({ textPrompt: 'Test' }),
    ).rejects.toThrow('Hedra generation returned invalid response: missing id');
  });
});

// ============================================================================
// generateHedraAvatarVideo
// ============================================================================

describe('generateHedraAvatarVideo', () => {
  const IMAGE_URL = 'https://example.com/portrait.png';
  const AUDIO_URL = 'https://example.com/audio.mp3';

  it('generates an avatar video using inline TTS (hedraVoiceId + speechText)', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    // 1. Download portrait image
    fetchMock.mockResolvedValueOnce(makeFileDownloadResponse());
    // 2. POST /assets (portrait placeholder)
    fetchMock.mockResolvedValueOnce(makeJsonResponse(ASSET_RESPONSE));
    // 3. POST /assets/{id}/upload (portrait)
    fetchMock.mockResolvedValueOnce(UPLOAD_RESPONSE);
    // 4. POST /generations
    fetchMock.mockResolvedValueOnce(makeJsonResponse(GENERATION_RESPONSE));

    const result: HedraGenerationResult = await generateHedraAvatarVideo(
      IMAGE_URL,
      null,
      {
        hedraVoiceId: 'voice-en-us-jake',
        speechText: 'Our revenue is up 30% this quarter.',
        textPrompt: 'Professional business presentation',
      },
    );

    expect(result.generationId).toBe('gen-abc-123');
    expect(result.modelId).toBe('d1dd37a3-e39a-4854-a298-6510289f9cf2'); // Character 3

    // Verify inline TTS was included in the generation payload
    const genCall = fetchMock.mock.calls.find(
      (call) => (call[0] as string) === `${HEDRA_BASE}/generations`,
    );
    expect(genCall).toBeDefined();
    const body = JSON.parse((genCall![1] as RequestInit).body as string) as {
      audio_generation?: { type: string; voice_id: string; text: string };
      audio_id?: string;
    };

    expect(body.audio_generation).toBeDefined();
    expect(body.audio_generation?.type).toBe('text_to_speech');
    expect(body.audio_generation?.voice_id).toBe('voice-en-us-jake');
    expect(body.audio_generation?.text).toBe('Our revenue is up 30% this quarter.');
    expect(body.audio_id).toBeUndefined();

    // Only portrait was uploaded — no audio upload
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('generates an avatar video using a pre-recorded audio URL, uploading both assets in parallel', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    // Promise.all uploads portrait + audio in parallel, so we need 6 fetch calls:
    // 1. Download portrait image
    // 2. POST /assets (portrait)
    // 3. POST /assets/{id}/upload (portrait)
    // 4. Download audio file
    // 5. POST /assets (audio)
    // 6. POST /assets/{id}/upload (audio)
    // 7. POST /generations

    const audioAssetResponse = { id: 'asset-audio-789', name: 'avatar-audio', type: 'audio' };

    // The parallel downloads resolve in the order Promise.all receives them.
    // Portrait and audio downloads happen concurrently; we provide both.
    fetchMock
      .mockResolvedValueOnce(makeFileDownloadResponse()) // portrait download
      .mockResolvedValueOnce(makeFileDownloadResponse()) // audio download
      .mockResolvedValueOnce(makeJsonResponse(ASSET_RESPONSE)) // POST /assets (portrait)
      .mockResolvedValueOnce(makeJsonResponse(audioAssetResponse)) // POST /assets (audio)
      .mockResolvedValueOnce(UPLOAD_RESPONSE) // upload portrait
      .mockResolvedValueOnce(UPLOAD_RESPONSE) // upload audio
      .mockResolvedValueOnce(makeJsonResponse(GENERATION_RESPONSE)); // POST /generations

    const result: HedraGenerationResult = await generateHedraAvatarVideo(
      IMAGE_URL,
      AUDIO_URL,
    );

    expect(result.generationId).toBe('gen-abc-123');

    // Verify the generation payload used audio_id, not audio_generation
    const genCall = fetchMock.mock.calls.find(
      (call) => (call[0] as string) === `${HEDRA_BASE}/generations`,
    );
    expect(genCall).toBeDefined();
    const body = JSON.parse((genCall![1] as RequestInit).body as string) as {
      audio_id?: string;
      audio_generation?: unknown;
    };

    expect(body.audio_id).toBe('asset-audio-789');
    expect(body.audio_generation).toBeUndefined();
  });

  it('throws when neither audioUrl nor TTS params are provided', async () => {
    await expect(
      generateHedraAvatarVideo(IMAGE_URL, null, { textPrompt: 'Test' }),
    ).rejects.toThrow('Either audioUrl or hedraVoiceId + speechText must be provided.');
  });

  it('throws when only hedraVoiceId is provided without speechText', async () => {
    await expect(
      generateHedraAvatarVideo(IMAGE_URL, null, { hedraVoiceId: 'voice-id-only' }),
    ).rejects.toThrow('Either audioUrl or hedraVoiceId + speechText must be provided.');
  });

  it('throws when portrait download fails', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: (_: string) => null },
      text: () => Promise.resolve('Not Found'),
      json: () => Promise.resolve({}),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as unknown as Response);

    await expect(
      generateHedraAvatarVideo(IMAGE_URL, null, {
        hedraVoiceId: 'voice-en-us-jake',
        speechText: 'Hello.',
      }),
    ).rejects.toThrow('Failed to download file from');
  });

  it('uses Character 3 model ID for avatar generation', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(makeFileDownloadResponse())
      .mockResolvedValueOnce(makeJsonResponse(ASSET_RESPONSE))
      .mockResolvedValueOnce(UPLOAD_RESPONSE)
      .mockResolvedValueOnce(makeJsonResponse(GENERATION_RESPONSE));

    const result = await generateHedraAvatarVideo(IMAGE_URL, null, {
      hedraVoiceId: 'voice-jake',
      speechText: 'Hello world.',
    });

    expect(result.modelId).toBe('d1dd37a3-e39a-4854-a298-6510289f9cf2');
  });
});

// ============================================================================
// generateHedraImage
// ============================================================================

describe('generateHedraImage', () => {
  const IMAGE_MODEL = {
    id: 'img-model-001',
    name: 'Hedra Image Gen v1',
    type: 'image',
    resolutions: ['720p', '1080p'],
  };

  const VIDEO_MODEL = {
    id: 'vid-model-001',
    name: 'Hedra T2V',
    type: 'video',
  };

  const IMAGE_GEN_RESPONSE = {
    id: 'img-gen-999',
    status: 'pending',
    created_at: '2026-03-20T12:05:00Z',
  };

  const COMPLETED_STATUS = {
    id: 'img-gen-999',
    status: 'completed',
    url: 'https://cdn.hedra.com/images/result.png',
    progress: 100,
  };

  it('discovers an image model, submits generation, polls to completion, and returns URL', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    // 1. GET /models
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse([VIDEO_MODEL, IMAGE_MODEL]),
    );
    // 2. POST /generations
    fetchMock.mockResolvedValueOnce(makeJsonResponse(IMAGE_GEN_RESPONSE));
    // 3. GET /generations/{id}/status — returns completed
    fetchMock.mockResolvedValueOnce(makeJsonResponse(COMPLETED_STATUS));

    const result: HedraImageResult = await generateHedraImage(
      'A futuristic office with holographic displays',
    );

    expect(result.url).toBe('https://cdn.hedra.com/images/result.png');
    expect(result.generationId).toBe('img-gen-999');
    expect(result.modelId).toBe('img-model-001');
    expect(result.modelName).toBe('Hedra Image Gen v1');
  });

  it('uses the cached image model on a second call within 10 minutes', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    // Use the current testClock as the base time for this test.
    // setImageModelCache will set expiresAt = testClock + 10min.
    const dateNowSpy = jest.spyOn(Date, 'now');
    dateNowSpy.mockReturnValue(testClock);

    // First call: GET /models + POST /generations + GET /status
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse([IMAGE_MODEL]))
      .mockResolvedValueOnce(makeJsonResponse(IMAGE_GEN_RESPONSE))
      .mockResolvedValueOnce(makeJsonResponse(COMPLETED_STATUS));

    await generateHedraImage('First prompt');

    // Advance time by 5 minutes (within 10-min cache TTL)
    dateNowSpy.mockReturnValue(testClock + 5 * 60 * 1000);

    // Second call: only POST /generations + GET /status (no GET /models — cached)
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ ...IMAGE_GEN_RESPONSE, id: 'img-gen-aaa' }))
      .mockResolvedValueOnce(makeJsonResponse({ ...COMPLETED_STATUS, id: 'img-gen-aaa' }));

    const result2 = await generateHedraImage('Second prompt');

    // GET /models was only called once total across both calls
    const modelCalls = fetchMock.mock.calls.filter(
      (call) => typeof call[0] === 'string' && (call[0]).includes('/models'),
    );
    expect(modelCalls).toHaveLength(1);
    expect(result2.modelId).toBe('img-model-001');
  });

  it('throws when no image models are available', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeJsonResponse([VIDEO_MODEL]), // only video models, no image models
    );

    await expect(
      generateHedraImage('A landscape'),
    ).rejects.toThrow('Hedra has no image generation models available');
  });

  it('throws when /models endpoint returns an error', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeErrorResponse(503, 'Service unavailable'),
    );

    await expect(
      generateHedraImage('A landscape'),
    ).rejects.toThrow('Hedra GET /models failed (503)');
  });

  it('throws when image generation submit returns no ID', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(makeJsonResponse([IMAGE_MODEL]))
      .mockResolvedValueOnce(makeJsonResponse({ status: 'pending' })); // missing id

    await expect(
      generateHedraImage('A portrait'),
    ).rejects.toThrow('Hedra image generation returned no generation ID');
  });

  it('throws when polling reports a failed status', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(makeJsonResponse([IMAGE_MODEL]))
      .mockResolvedValueOnce(makeJsonResponse(IMAGE_GEN_RESPONSE))
      .mockResolvedValueOnce(
        makeJsonResponse({
          id: 'img-gen-999',
          status: 'failed',
          error_message: 'Content policy violation',
        }),
      );

    await expect(
      generateHedraImage('An invalid prompt'),
    ).rejects.toThrow('Hedra image generation failed: Content policy violation');
  });

  it('fetches asset URL when generation completes with asset_id instead of direct url', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    const assetListResponse = [
      { id: 'image-asset-001', asset: { url: 'https://cdn.hedra.com/assets/photo.png' } },
    ];

    fetchMock
      .mockResolvedValueOnce(makeJsonResponse([IMAGE_MODEL])) // GET /models
      .mockResolvedValueOnce(makeJsonResponse(IMAGE_GEN_RESPONSE)) // POST /generations
      .mockResolvedValueOnce(
        makeJsonResponse({
          id: 'img-gen-999',
          status: 'completed',
          asset_id: 'image-asset-001', // no direct url
          url: null,
        }),
      ) // GET /status
      .mockResolvedValueOnce(makeJsonResponse(assetListResponse)); // GET /assets?type=image

    const result = await generateHedraImage('A portrait photo');

    expect(result.url).toBe('https://cdn.hedra.com/assets/photo.png');
  });
});

// ============================================================================
// getHedraVideoStatus
// ============================================================================

describe('getHedraVideoStatus', () => {
  const GENERATION_ID = 'gen-status-test-001';

  it('returns completed status with video URL when Hedra reports "complete"', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeJsonResponse({
        id: GENERATION_ID,
        status: 'complete',
        url: 'https://cdn.hedra.com/video/output.mp4',
        progress: 100,
      }),
    );

    const result: HedraVideoStatus = await getHedraVideoStatus(GENERATION_ID);

    expect(result.status).toBe('completed');
    expect(result.videoUrl).toBe('https://cdn.hedra.com/video/output.mp4');
    expect(result.progress).toBe(100);
    expect(result.error).toBeNull();
  });

  it('returns completed status when Hedra reports "completed" (variant spelling)', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeJsonResponse({
        id: GENERATION_ID,
        status: 'completed',
        video_url: 'https://cdn.hedra.com/video/output-v2.mp4',
        progress: 100,
      }),
    );

    const result: HedraVideoStatus = await getHedraVideoStatus(GENERATION_ID);

    expect(result.status).toBe('completed');
    expect(result.videoUrl).toBe('https://cdn.hedra.com/video/output-v2.mp4');
    expect(result.error).toBeNull();
  });

  it('returns failed status with error message when Hedra reports "failed"', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeJsonResponse({
        id: GENERATION_ID,
        status: 'failed',
        error_message: 'Content moderation triggered',
      }),
    );

    const result: HedraVideoStatus = await getHedraVideoStatus(GENERATION_ID);

    expect(result.status).toBe('failed');
    expect(result.videoUrl).toBeNull();
    expect(result.error).toBe('Content moderation triggered');
    expect(result.progress).toBeNull();
  });

  it('returns failed status using error field when error_message is absent', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeJsonResponse({
        id: GENERATION_ID,
        status: 'failed',
        error: 'Internal server error',
      }),
    );

    const result: HedraVideoStatus = await getHedraVideoStatus(GENERATION_ID);

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Internal server error');
  });

  it('returns processing status with progress when Hedra reports "processing"', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeJsonResponse({
        id: GENERATION_ID,
        status: 'processing',
        progress: 42,
      }),
    );

    const result: HedraVideoStatus = await getHedraVideoStatus(GENERATION_ID);

    expect(result.status).toBe('processing');
    expect(result.videoUrl).toBeNull();
    expect(result.progress).toBe(42);
    expect(result.error).toBeNull();
  });

  it('returns pending status for any unrecognised status string', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeJsonResponse({
        id: GENERATION_ID,
        status: 'queued',
      }),
    );

    const result: HedraVideoStatus = await getHedraVideoStatus(GENERATION_ID);

    expect(result.status).toBe('pending');
    expect(result.videoUrl).toBeNull();
    expect(result.error).toBeNull();
  });

  it('returns failed gracefully and logs the error when fetch throws a network error', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
      new Error('Network request failed'),
    );

    const result: HedraVideoStatus = await getHedraVideoStatus(GENERATION_ID);

    expect(result.status).toBe('failed');
    expect(result.videoUrl).toBeNull();
    expect(result.progress).toBeNull();
    expect(result.error).toBe('Network request failed');
  });

  it('returns failed gracefully when the status endpoint returns a non-2xx response', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeErrorResponse(500, 'Internal error'),
    );

    const result: HedraVideoStatus = await getHedraVideoStatus(GENERATION_ID);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Hedra status check failed (500)');
  });

  it('calls the correct Hedra status endpoint URL', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      makeJsonResponse({ id: GENERATION_ID, status: 'processing', progress: 10 }),
    );

    await getHedraVideoStatus(GENERATION_ID);

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${HEDRA_BASE}/generations/${GENERATION_ID}/status`);
  });
});
