/**
 * Scene Generator — Unit Tests
 *
 * Tests generateScene routing (avatar vs prompt-only), voice resolution,
 * aspect ratio conversion, prompt building, pollSceneStatus, and
 * generateAllScenes batch generation.
 *
 * Mock strategy
 * -------------
 * scene-generator.ts statically imports from hedra-service. In this project's
 * jest configuration the module registry caches modules across test files, so
 * a top-level jest.mock() factory alone does not intercept the static import
 * binding. The reliable pattern is:
 *
 *   1. Call jest.resetModules() in beforeEach to clear the module cache.
 *   2. Register mock factories via jest.mock() inside beforeEach (after reset).
 *   3. Use jest.isolateModules() + require() to load scene-generator fresh
 *      within a scope where the mock factories have already been registered.
 *
 * This ensures every test gets a fresh scene-generator instance whose static
 * imports resolve to the current mock objects.
 *
 * The apiKeyService is already mocked globally in jest.setup.js.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { PipelineScene, SceneGenerationResult } from '@/types/video-pipeline';
import type {
  generateHedraPromptVideo,
  generateHedraAvatarVideo,
  getHedraVideoStatus,
} from '@/lib/video/hedra-service';
import type {
  getAvatarProfile,
  getDefaultProfile,
} from '@/lib/video/avatar-profile-service';
import type { getVideoDefaults } from '@/lib/video/video-defaults-service';
import type { translateStoryboardToHedraPrompts } from '@/lib/video/hedra-prompt-agent';

// ---------------------------------------------------------------------------
// Type for the module under test loaded via require() in isolateModules
// ---------------------------------------------------------------------------

interface SceneGeneratorModule {
  generateScene: (
    scene: PipelineScene,
    projectAvatarId: string,
    projectVoiceId: string,
    aspectRatio: string,
    voiceProvider?: string
  ) => Promise<SceneGenerationResult>;
  pollSceneStatus: (
    providerVideoId: string,
    provider?: string | null
  ) => Promise<{
    status: 'generating' | 'completed' | 'failed';
    videoUrl: string | null;
    thumbnailUrl: string | null;
    error: string | null;
    progress: number;
  }>;
  generateAllScenes: (
    scenes: PipelineScene[],
    avatarId: string,
    voiceId: string,
    aspectRatio: string,
    onSceneUpdate?: (result: SceneGenerationResult) => void,
    voiceProvider?: string
  ) => Promise<SceneGenerationResult[]>;
}

// ============================================================================
// Shared fixtures
// ============================================================================

function makeScene(overrides: Partial<PipelineScene> = {}): PipelineScene {
  return {
    id: 'scene-001',
    sceneNumber: 1,
    title: 'The Hook',
    scriptText: 'Discover how SalesVelocity transforms your pipeline.',
    screenshotUrl: null,
    avatarId: null,
    voiceId: null,
    voiceProvider: null,
    duration: 8,
    engine: null,
    backgroundPrompt: null,
    status: 'draft',
    ...overrides,
  };
}

const GENERATION_RESULT = {
  generationId: 'gen-test-001',
  status: 'pending' as const,
  modelId: 'model-001',
  createdAt: '2026-03-20T12:00:00Z',
};

const MOCK_PROFILE = {
  id: 'avatar-001',
  userId: 'user-001',
  name: 'Test Avatar',
  source: 'custom' as const,
  role: 'presenter' as const,
  styleTag: 'real' as const,
  tier: 'standard' as const,
  frontalImageUrl: 'https://example.com/photo.jpg',
  additionalImageUrls: [] as string[],
  fullBodyImageUrl: null,
  upperBodyImageUrl: null,
  greenScreenClips: [] as never[],
  voiceId: 'voice-en-jake',
  voiceName: 'Jake',
  voiceProvider: 'hedra' as const,
  hedraCharacterId: null,
  description: null,
  isDefault: false,
  isFavorite: false,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
};

const EMPTY_DEFAULTS = {
  avatarId: null,
  avatarName: null,
  voiceId: null,
  voiceName: null,
  voiceProvider: null,
  updatedAt: null,
  updatedBy: null,
};

// ============================================================================
// Test state — populated in beforeEach via isolateModules
// ============================================================================

let generateScene: SceneGeneratorModule['generateScene'];
let pollSceneStatus: SceneGeneratorModule['pollSceneStatus'];
let generateAllScenes: SceneGeneratorModule['generateAllScenes'];

// Mock variables typed via the real function signatures (type-only imports above)
let mockGenerateHedraPromptVideo: jest.MockedFunction<typeof generateHedraPromptVideo>;
let mockGenerateHedraAvatarVideo: jest.MockedFunction<typeof generateHedraAvatarVideo>;
let mockGetHedraVideoStatus: jest.MockedFunction<typeof getHedraVideoStatus>;
let mockGetAvatarProfile: jest.MockedFunction<typeof getAvatarProfile>;
let mockGetDefaultProfile: jest.MockedFunction<typeof getDefaultProfile>;
let mockGetVideoDefaults: jest.MockedFunction<typeof getVideoDefaults>;
let mockTranslateStoryboard: jest.MockedFunction<typeof translateStoryboardToHedraPrompts>;
// apiKeyService.getServiceKey is mocked globally in jest.setup.js. After
// jest.resetModules() in beforeEach, the module registry is cleared so we
// must re-register the api-key-service mock to cover dynamic import() calls
// inside scene-generator.ts. This local mock mirrors the global one.
let mockGetServiceKey: jest.MockedFunction<() => Promise<string>>;

// ============================================================================
// Setup — isolate modules so static imports in scene-generator.ts use mocks
// ============================================================================

beforeEach(() => {
  jest.useFakeTimers();

  // Create fresh mock functions for this test.
  // Use a counter-based implementation so each call returns a unique generationId,
  // preventing generateAllScenes' duplicate-ID detection from triggering.
  let promptCallCount = 0;
  let avatarCallCount = 0;

  mockGenerateHedraPromptVideo = jest.fn<typeof generateHedraPromptVideo>().mockImplementation(
    () => Promise.resolve({ ...GENERATION_RESULT, generationId: `gen-prompt-${++promptCallCount}` })
  );
  mockGenerateHedraAvatarVideo = jest.fn<typeof generateHedraAvatarVideo>().mockImplementation(
    () => Promise.resolve({ ...GENERATION_RESULT, generationId: `gen-avatar-${++avatarCallCount}` })
  );
  mockGetHedraVideoStatus = jest.fn<typeof getHedraVideoStatus>();
  mockGetAvatarProfile = jest.fn<typeof getAvatarProfile>().mockResolvedValue(null);
  mockGetDefaultProfile = jest.fn<typeof getDefaultProfile>().mockResolvedValue(null);
  mockGetVideoDefaults = jest.fn<typeof getVideoDefaults>().mockResolvedValue(EMPTY_DEFAULTS);
  mockTranslateStoryboard = jest.fn<typeof translateStoryboardToHedraPrompts>().mockResolvedValue([]);
  // Default: no API key configured (voice catalog fallback disabled by default)
  mockGetServiceKey = jest.fn<() => Promise<string>>().mockResolvedValue('');

  // Reset module registry so scene-generator.ts is loaded fresh with new mocks
  jest.resetModules();

  // Register mock factories (captured in closure over the fresh mock objects above)
  jest.mock('@/lib/video/hedra-service', () => ({
    generateHedraPromptVideo: mockGenerateHedraPromptVideo,
    generateHedraAvatarVideo: mockGenerateHedraAvatarVideo,
    getHedraVideoStatus: mockGetHedraVideoStatus,
  }));

  jest.mock('@/lib/video/avatar-profile-service', () => ({
    getAvatarProfile: mockGetAvatarProfile,
    getDefaultProfile: mockGetDefaultProfile,
  }));

  jest.mock('@/lib/video/video-defaults-service', () => ({
    getVideoDefaults: mockGetVideoDefaults,
  }));

  jest.mock('@/lib/video/hedra-prompt-agent', () => ({
    translateStoryboardToHedraPrompts: mockTranslateStoryboard,
  }));

  jest.mock('@/lib/video/hedra-prompt-translator', () => ({
    translatePromptForHedra: jest.fn((desc: string) => desc),
  }));

  jest.mock('@/lib/ai/cinematic-presets', () => ({
    buildPromptFromPresets: jest.fn((base: string) => base),
  }));

  jest.mock('@/lib/logger/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }));

  jest.mock('@/lib/constants/platform', () => ({
    PLATFORM_ID: 'test-platform',
  }));

  // Re-register api-key-service mock after resetModules() clears the registry.
  // scene-generator.ts uses dynamic import('@/lib/api-keys/api-key-service') for
  // the voice catalog fallback; this factory ensures the dynamic import resolves
  // to our controlled mock, not the real Firestore-backed service.
  jest.mock('@/lib/api-keys/api-key-service', () => ({
    apiKeyService: {
      getServiceKey: mockGetServiceKey,
      getKeys: jest.fn(),
      saveKeys: jest.fn(),
    },
  }));

  // Load the module under test fresh within the isolated registry
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/lib/video/scene-generator') as SceneGeneratorModule;
    generateScene = mod.generateScene;
    pollSceneStatus = mod.pollSceneStatus;
    generateAllScenes = mod.generateAllScenes;
  });

  // Default fetch: no voices, returns empty array
  global.fetch = jest.fn<() => Promise<Response>>().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve([]),
  } as unknown as Response);
});

afterEach(() => {
  jest.useRealTimers();
});

// ============================================================================
// generateScene — routing
// ============================================================================

describe('generateScene — routing', () => {
  it('routes to prompt-only mode when scene and project have no avatar', async () => {
    const scene = makeScene();
    const result = await generateScene(scene, '', '', '16:9');

    expect(result.sceneId).toBe('scene-001');
    expect(result.provider).toBe('hedra');
    expect(result.status).toBe('generating');
    expect(mockGenerateHedraPromptVideo).toHaveBeenCalledTimes(1);
    expect(mockGenerateHedraAvatarVideo).not.toHaveBeenCalled();
  });

  it('routes to avatar mode when avatar profile has photo and voice', async () => {
    mockGetAvatarProfile.mockResolvedValue(MOCK_PROFILE);

    const scene = makeScene({ avatarId: 'avatar-001' });
    const result = await generateScene(scene, '', '', '16:9');

    expect(result.status).toBe('generating');
    expect(mockGenerateHedraAvatarVideo).toHaveBeenCalledTimes(1);
    expect(mockGenerateHedraPromptVideo).not.toHaveBeenCalled();
  });

  it('falls back to prompt-only when avatar profile is not found', async () => {
    mockGetAvatarProfile.mockResolvedValue(null);
    mockGetDefaultProfile.mockResolvedValue(null);

    const scene = makeScene({ avatarId: 'missing-avatar' });
    const result = await generateScene(scene, '', '', '16:9');

    expect(result.status).toBe('generating');
    expect(mockGenerateHedraPromptVideo).toHaveBeenCalledTimes(1);
    expect(mockGenerateHedraAvatarVideo).not.toHaveBeenCalled();
  });

  it('falls back to prompt-only when avatar profile has no frontalImageUrl', async () => {
    // AvatarProfile.frontalImageUrl is string, not null, so we override at runtime
    const profileNoPhoto = { ...MOCK_PROFILE, frontalImageUrl: null as unknown as string };
    mockGetAvatarProfile.mockResolvedValue(profileNoPhoto);

    const scene = makeScene({ avatarId: 'avatar-001' });
    const result = await generateScene(scene, '', '', '16:9');

    expect(result.status).toBe('generating');
    expect(mockGenerateHedraPromptVideo).toHaveBeenCalledTimes(1);
    expect(mockGenerateHedraAvatarVideo).not.toHaveBeenCalled();
  });

  it('falls back to prompt-only when avatar profile has photo but no voiceId', async () => {
    const profileNoVoice = { ...MOCK_PROFILE, voiceId: null };
    mockGetAvatarProfile.mockResolvedValue(profileNoVoice);

    const scene = makeScene({ avatarId: 'avatar-001' });
    await generateScene(scene, '', '', '16:9');

    expect(mockGenerateHedraPromptVideo).toHaveBeenCalledTimes(1);
    expect(mockGenerateHedraAvatarVideo).not.toHaveBeenCalled();
  });

  it('uses the project-level avatarId when scene.avatarId is null', async () => {
    mockGetAvatarProfile.mockResolvedValue(MOCK_PROFILE);

    const scene = makeScene({ avatarId: null });
    const result = await generateScene(scene, 'avatar-001', '', '16:9');

    expect(result.status).toBe('generating');
    expect(mockGenerateHedraAvatarVideo).toHaveBeenCalledTimes(1);
    expect(mockGetAvatarProfile).toHaveBeenCalledWith('avatar-001');
  });
});

// ============================================================================
// generateScene — voice resolution
// ============================================================================

describe('generateScene — voice resolution', () => {
  it('auto-resolves voice from avatar profile when no scene or project voice is set', async () => {
    mockGetAvatarProfile.mockResolvedValue(MOCK_PROFILE);

    const scene = makeScene({ avatarId: 'avatar-001', voiceId: null });
    await generateScene(scene, '', '', '16:9');

    expect(mockGenerateHedraAvatarVideo).toHaveBeenCalledWith(
      MOCK_PROFILE.frontalImageUrl,
      null,
      expect.objectContaining({ hedraVoiceId: 'voice-en-jake' }),
    );
  });

  it('treats a whitespace-only voiceId as null and does not pass it through', async () => {
    const scene = makeScene({ voiceId: '   ' });
    await generateScene(scene, '', '', '16:9');

    expect(mockGenerateHedraPromptVideo).toHaveBeenCalledWith(
      expect.objectContaining({ hedraVoiceId: undefined }),
    );
  });

  it('auto-resolves default Hedra voice from video defaults when no voice is set', async () => {
    mockGetVideoDefaults.mockResolvedValue({
      ...EMPTY_DEFAULTS,
      voiceId: 'voice-default-123',
      voiceProvider: 'hedra',
    });

    const scene = makeScene({ voiceId: null });
    await generateScene(scene, '', '', '16:9');

    expect(mockGenerateHedraPromptVideo).toHaveBeenCalledWith(
      expect.objectContaining({ hedraVoiceId: 'voice-default-123' }),
    );
  });

  it('uses scene voiceId over project voiceId', async () => {
    const scene = makeScene({ voiceId: 'scene-voice' });
    await generateScene(scene, '', 'project-voice', '16:9');

    expect(mockGenerateHedraPromptVideo).toHaveBeenCalledWith(
      expect.objectContaining({ hedraVoiceId: 'scene-voice' }),
    );
  });

  it('fetches first male English voice from Hedra catalog as last-resort fallback', async () => {
    mockGetVideoDefaults.mockResolvedValue(EMPTY_DEFAULTS);
    // Override the default (empty key) to trigger the catalog fetch path
    mockGetServiceKey.mockResolvedValue('hk-test-key');

    const catalogVoices = [
      {
        id: 'female-voice-01',
        name: 'Sarah',
        asset: { labels: [{ name: 'gender', value: 'female' }, { name: 'language', value: 'English' }] },
      },
      {
        id: 'male-voice-01',
        name: 'Marcus',
        asset: { labels: [{ name: 'gender', value: 'male' }, { name: 'language', value: 'English (US)' }] },
      },
    ];
    global.fetch = jest.fn<() => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(catalogVoices),
    } as unknown as Response);

    const scene = makeScene({ voiceId: null });
    await generateScene(scene, '', '', '16:9');

    expect(mockGenerateHedraPromptVideo).toHaveBeenCalledWith(
      expect.objectContaining({ hedraVoiceId: 'male-voice-01' }),
    );
  });
});

// ============================================================================
// generateScene — aspect ratio
// ============================================================================

describe('generateScene — aspect ratio', () => {
  it('converts 4:3 to 16:9 in prompt-only mode (Hedra does not support 4:3)', async () => {
    const scene = makeScene();
    await generateScene(scene, '', '', '4:3');

    expect(mockGenerateHedraPromptVideo).toHaveBeenCalledWith(
      expect.objectContaining({ aspectRatio: '16:9' }),
    );
  });

  it('converts 4:3 to 16:9 in avatar mode', async () => {
    mockGetAvatarProfile.mockResolvedValue(MOCK_PROFILE);
    const scene = makeScene({ avatarId: 'avatar-001' });

    await generateScene(scene, '', '', '4:3');

    expect(mockGenerateHedraAvatarVideo).toHaveBeenCalledWith(
      MOCK_PROFILE.frontalImageUrl,
      null,
      expect.objectContaining({ aspectRatio: '16:9' }),
    );
  });

  it('passes 9:16 through unchanged', async () => {
    const scene = makeScene();
    await generateScene(scene, '', '', '9:16');

    expect(mockGenerateHedraPromptVideo).toHaveBeenCalledWith(
      expect.objectContaining({ aspectRatio: '9:16' }),
    );
  });

  it('passes 16:9 through unchanged', async () => {
    const scene = makeScene();
    await generateScene(scene, '', '', '16:9');

    expect(mockGenerateHedraPromptVideo).toHaveBeenCalledWith(
      expect.objectContaining({ aspectRatio: '16:9' }),
    );
  });
});

// ============================================================================
// generateScene — text prompt construction
// ============================================================================

describe('generateScene — text prompt construction', () => {
  it('builds a structured prompt from backgroundPrompt and visualDescription when both are set', async () => {
    const scene = makeScene({
      backgroundPrompt: 'Modern glass office',
      visualDescription: 'Executive in a navy suit gestures confidently',
    });
    await generateScene(scene, '', '', '16:9');

    const callArg = mockGenerateHedraPromptVideo.mock.calls[0]?.[0] as { textPrompt: string };
    expect(callArg.textPrompt).toContain('Modern glass office');
    expect(callArg.textPrompt).toContain('Executive in a navy suit gestures confidently');
  });

  it('wraps script as presenter context when visualDescription is absent', async () => {
    const scene = makeScene({
      backgroundPrompt: null,
      scriptText: 'Close more deals with AI insights.',
    });
    await generateScene(scene, '', '', '16:9');

    const callArg = mockGenerateHedraPromptVideo.mock.calls[0]?.[0] as { textPrompt: string };
    expect(callArg.textPrompt).toContain('professional presenter');
    expect(callArg.textPrompt).toContain('Close more deals with AI insights.');
  });
});

// ============================================================================
// generateScene — error handling
// ============================================================================

describe('generateScene — error handling', () => {
  it('returns a failed SceneGenerationResult instead of throwing when hedra service throws', async () => {
    mockGenerateHedraPromptVideo.mockRejectedValue(new Error('Hedra API unreachable'));

    const scene = makeScene();
    const result = await generateScene(scene, '', '', '16:9');

    expect(result.status).toBe('failed');
    expect(result.sceneId).toBe('scene-001');
    expect(result.error).toBe('Hedra API unreachable');
    expect(result.videoUrl).toBeNull();
  });
});

// ============================================================================
// pollSceneStatus
// ============================================================================

describe('pollSceneStatus', () => {
  it('returns completed with videoUrl when Hedra reports completed', async () => {
    mockGetHedraVideoStatus.mockResolvedValue({
      status: 'completed',
      videoUrl: 'https://cdn.hedra.com/video.mp4',
      progress: 100,
      error: null,
    });

    const result = await pollSceneStatus('gen-001');

    expect(result.status).toBe('completed');
    expect(result.videoUrl).toBe('https://cdn.hedra.com/video.mp4');
    expect(result.progress).toBe(100);
    expect(result.error).toBeNull();
  });

  it('returns generating with progress forwarded when Hedra reports processing', async () => {
    mockGetHedraVideoStatus.mockResolvedValue({
      status: 'processing',
      videoUrl: null,
      progress: 65,
      error: null,
    });

    const result = await pollSceneStatus('gen-001');

    expect(result.status).toBe('generating');
    expect(result.progress).toBe(65);
    expect(result.videoUrl).toBeNull();
  });

  it('returns generating with 10% progress when Hedra status is pending with no progress value', async () => {
    mockGetHedraVideoStatus.mockResolvedValue({
      status: 'pending',
      videoUrl: null,
      progress: null,
      error: null,
    });

    const result = await pollSceneStatus('gen-001');

    expect(result.status).toBe('generating');
    expect(result.progress).toBe(10);
  });

  it('returns failed with the error message when Hedra reports failed', async () => {
    mockGetHedraVideoStatus.mockResolvedValue({
      status: 'failed',
      videoUrl: null,
      progress: 0,
      error: 'Content policy violation',
    });

    const result = await pollSceneStatus('gen-001');

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Content policy violation');
  });

  it('uses the fallback error message when Hedra reports failed with no error field', async () => {
    mockGetHedraVideoStatus.mockResolvedValue({
      status: 'failed',
      videoUrl: null,
      progress: 0,
      error: null,
    });

    const result = await pollSceneStatus('gen-001');

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Hedra video generation failed');
  });

  it('returns failed gracefully when getHedraVideoStatus throws a network error', async () => {
    mockGetHedraVideoStatus.mockRejectedValue(new Error('Network timeout'));

    const result = await pollSceneStatus('gen-001');

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Network timeout');
    expect(result.videoUrl).toBeNull();
  });

  it('accepts null as the provider argument for backward compatibility', async () => {
    mockGetHedraVideoStatus.mockResolvedValue({
      status: 'completed',
      videoUrl: 'https://cdn.hedra.com/v.mp4',
      progress: 100,
      error: null,
    });

    const result = await pollSceneStatus('gen-001', null);

    expect(result.status).toBe('completed');
  });
});

// ============================================================================
// generateAllScenes
// ============================================================================

describe('generateAllScenes', () => {
  it('generates multiple scenes and returns results in scene order', async () => {
    const scenes = [
      makeScene({ id: 'scene-1', sceneNumber: 1 }),
      makeScene({ id: 'scene-2', sceneNumber: 2 }),
      makeScene({ id: 'scene-3', sceneNumber: 3 }),
    ];

    const promise = generateAllScenes(scenes, '', '', '16:9');
    await jest.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(3);
    expect(results[0].sceneId).toBe('scene-1');
    expect(results[1].sceneId).toBe('scene-2');
    expect(results[2].sceneId).toBe('scene-3');
  });

  it('calls onSceneUpdate for each scene result as it completes', async () => {
    const scenes = [
      makeScene({ id: 'scene-A', sceneNumber: 1 }),
      makeScene({ id: 'scene-B', sceneNumber: 2 }),
    ];
    const onSceneUpdate = jest.fn();

    const promise = generateAllScenes(scenes, '', '', '16:9', onSceneUpdate);
    await jest.runAllTimersAsync();
    await promise;

    expect(onSceneUpdate).toHaveBeenCalledTimes(2);
    const calledSceneIds = onSceneUpdate.mock.calls.map(
      (call) => (call[0] as SceneGenerationResult).sceneId
    );
    expect(calledSceneIds).toContain('scene-A');
    expect(calledSceneIds).toContain('scene-B');
  });

  it('injects Hedra Prompt Agent optimized prompts when the agent succeeds', async () => {
    mockTranslateStoryboard.mockResolvedValue([
      { sceneId: 'scene-X', sceneNumber: 1, textPrompt: 'AGENT OPTIMIZED PROMPT for scene-X' },
    ]);

    const scene = makeScene({ id: 'scene-X', sceneNumber: 1 });

    const promise = generateAllScenes([scene], '', '', '16:9');
    await jest.runAllTimersAsync();
    await promise;

    const callArg = mockGenerateHedraPromptVideo.mock.calls[0]?.[0] as { textPrompt: string };
    expect(callArg.textPrompt).toBe('AGENT OPTIMIZED PROMPT for scene-X');
  });

  it('falls back to buildHedraTextPrompt when the Hedra Prompt Agent throws', async () => {
    mockTranslateStoryboard.mockRejectedValue(new Error('Agent unavailable'));

    const scene = makeScene({
      id: 'scene-Y',
      sceneNumber: 1,
      backgroundPrompt: 'Rooftop at sunset',
    });

    const promise = generateAllScenes([scene], '', '', '16:9');
    await jest.runAllTimersAsync();
    await promise;

    expect(mockGenerateHedraPromptVideo).toHaveBeenCalledTimes(1);
    const callArg = mockGenerateHedraPromptVideo.mock.calls[0]?.[0] as { textPrompt: string };
    expect(callArg.textPrompt).toContain('Rooftop at sunset');
  });

  it('injects CONTINUATION prefix on the second scene in a shot group', async () => {
    const scenes = [
      makeScene({ id: 'scene-G1', sceneNumber: 1, shotGroupId: 'group-A', backgroundPrompt: 'Office lobby' }),
      makeScene({ id: 'scene-G2', sceneNumber: 2, shotGroupId: 'group-A' }),
    ];

    const promise = generateAllScenes(scenes, '', '', '16:9');
    await jest.runAllTimersAsync();
    await promise;

    expect(mockGenerateHedraPromptVideo).toHaveBeenCalledTimes(2);
    const secondCallArg = mockGenerateHedraPromptVideo.mock.calls[1]?.[0] as { textPrompt: string };
    expect(secondCallArg.textPrompt).toMatch(/^CONTINUATION:/);
  });

  it('includes failed results inline without aborting the batch', async () => {
    mockGenerateHedraPromptVideo
      .mockResolvedValueOnce({ ...GENERATION_RESULT, generationId: 'gen-batch-1' })
      .mockRejectedValueOnce(new Error('Rate limit'))
      .mockResolvedValueOnce({ ...GENERATION_RESULT, generationId: 'gen-batch-3' });

    const scenes = [
      makeScene({ id: 'scene-1', sceneNumber: 1 }),
      makeScene({ id: 'scene-2', sceneNumber: 2 }),
      makeScene({ id: 'scene-3', sceneNumber: 3 }),
    ];

    const promise = generateAllScenes(scenes, '', '', '16:9');
    await jest.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe('generating');
    expect(results[1].status).toBe('failed');
    expect(results[1].error).toBe('Rate limit');
    expect(results[2].status).toBe('generating');
  });
});
