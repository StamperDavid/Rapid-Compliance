/**
 * Hedra Scene Generator — Generates avatar video scenes via Hedra Character-3 API
 */

import { logger } from '@/lib/logger/logger';
import {
  generateHedraAvatarVideo,
  getHedraVideoStatus,
} from '@/lib/video/hedra-service';
import type { PipelineScene, SceneGenerationResult, VideoEngineId } from '@/types/video-pipeline';
import type { VideoAspectRatio } from '@/types/video';

// ============================================================================
// Hedra API Key Helper
// ============================================================================

async function getHedraApiKey(): Promise<string | null> {
  try {
    const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
    const { PLATFORM_ID } = await import('@/lib/constants/platform');
    const rawKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'hedra');
    return (rawKey && typeof rawKey === 'string') ? rawKey : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Default Hedra Voice Fallback
// ============================================================================

interface HedraVoiceFallback { id: string; name: string }

let defaultHedraVoicePromise: Promise<HedraVoiceFallback | null> | null = null;

function getDefaultHedraVoice(): Promise<HedraVoiceFallback | null> {
  defaultHedraVoicePromise ??= fetchDefaultHedraVoice();
  return defaultHedraVoicePromise;
}

async function fetchDefaultHedraVoice(): Promise<HedraVoiceFallback | null> {
  try {
    const apiKey = await getHedraApiKey();
    if (!apiKey) { return null; }

    const response = await fetch('https://api.hedra.com/web-app/public/voices', {
      headers: { 'x-api-key': apiKey, 'Accept': 'application/json' },
    });

    if (!response.ok) { return null; }

    const voices = (await response.json()) as { id: string; name: string }[];
    if (!Array.isArray(voices) || voices.length === 0) { return null; }

    const defaultVoice = { id: voices[0].id, name: voices[0].name };
    logger.info('Cached default Hedra voice for fallback', {
      voiceId: defaultVoice.id,
      voiceName: defaultVoice.name,
      file: 'scene-generator.ts',
    });
    return defaultVoice;
  } catch {
    defaultHedraVoicePromise = null;
    return null;
  }
}

// ============================================================================
// Default Hedra Stock Character Fallback
// ============================================================================

interface HedraCharacterFallback { name: string; imageUrl: string }

let defaultHedraCharacterPromise: Promise<HedraCharacterFallback | null> | null = null;

function getDefaultHedraCharacter(): Promise<HedraCharacterFallback | null> {
  defaultHedraCharacterPromise ??= fetchDefaultHedraCharacter();
  return defaultHedraCharacterPromise;
}

/**
 * Fetch a solo stock character from Hedra's public character library.
 * Filters out duo/group characters (names starting with "duo-") and
 * picks a professional-looking single presenter.
 * Cached as a singleton so concurrent scenes reuse the same character.
 */
async function fetchDefaultHedraCharacter(): Promise<HedraCharacterFallback | null> {
  try {
    const apiKey = await getHedraApiKey();
    if (!apiKey) { return null; }

    const response = await fetch(
      'https://api.hedra.com/web-app/elements?type=CHARACTER&limit=50',
      { headers: { 'x-api-key': apiKey, 'Accept': 'application/json' } },
    );

    if (!response.ok) { return null; }

    interface HedraCharacterElement {
      id: string;
      name: string;
      description: string;
      assets: { asset_type: string; media_url: string }[];
    }

    const data = (await response.json()) as { data?: HedraCharacterElement[] };
    const characters = data.data;
    if (!Array.isArray(characters) || characters.length === 0) { return null; }

    // Pick first solo character (skip duo/group names)
    const soloCharacter = characters.find(c =>
      !c.name.startsWith('duo-') &&
      c.assets?.length > 0 &&
      c.assets[0]?.media_url
    );

    if (!soloCharacter) { return null; }

    const imageUrl = soloCharacter.assets[0].media_url;
    const result = { name: soloCharacter.name, imageUrl };

    logger.info('Cached default Hedra stock character for fallback', {
      characterName: result.name,
      file: 'scene-generator.ts',
    });

    return result;
  } catch {
    defaultHedraCharacterPromise = null;
    return null;
  }
}

// ============================================================================
// Hedra Avatar Generator
// ============================================================================

/**
 * Generate a talking-head avatar scene using Hedra Character-3.
 *
 * Hedra is the sole video engine. TTS is generated as a separate step,
 * then the audio asset is used in the video generation.
 *
 * @param photoUrl  Direct image URL — either from a Firestore avatar profile
 *                  or from a Hedra stock character. Caller resolves this.
 */
async function generateWithHedra(
  scene: PipelineScene,
  photoUrl: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio,
): Promise<SceneGenerationResult> {
  const script = scene.scriptText.trim() || ' ';

  if (!voiceId) {
    return {
      sceneId: scene.id,
      providerVideoId: '',
      provider: 'hedra',
      status: 'failed',
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      error: 'No Hedra voice resolved. The character may be missing a voice — re-sync or choose a voice.',
    };
  }

  // Map aspect ratio — Hedra does not support 4:3
  const hedraAspectRatio = aspectRatio === '4:3' ? '16:9' : aspectRatio;

  logger.info('Submitting Hedra generation for scene', {
    sceneId: scene.id,
    voiceId,
    scriptLength: script.length,
    file: 'scene-generator.ts',
  });

  const response = await generateHedraAvatarVideo(photoUrl, null, {
    textPrompt: scene.visualDescription?.trim() ?? '',
    aspectRatio: hedraAspectRatio,
    durationMs: scene.duration * 1000,
    hedraVoiceId: voiceId,
    speechText: script,
  });

  logger.info('Hedra generation started', {
    sceneId: scene.id,
    generationId: response.generationId,
    file: 'scene-generator.ts',
  });

  return {
    sceneId: scene.id,
    providerVideoId: response.generationId,
    provider: 'hedra',
    status: 'generating',
    videoUrl: null,
    thumbnailUrl: null,
    progress: 0,
    error: null,
  };
}

// ============================================================================
// Scene Generation
// ============================================================================

/**
 * Generate a single scene via Hedra.
 *
 * Resolution chain for the character image:
 *   1. Per-scene avatarId → load Firestore profile → get frontalImageUrl
 *   2. Project-level avatarId → load Firestore profile → get frontalImageUrl
 *   3. **Auto-fallback** → pick a Hedra stock character from their public library
 *
 * Resolution chain for voice:
 *   1. Per-scene voiceId
 *   2. Project-level voiceId
 *   3. Avatar profile's bundled voice
 *   4. **Auto-fallback** → first voice from Hedra's public catalog
 */
export async function generateScene(
  scene: PipelineScene,
  projectAvatarId: string,
  projectVoiceId: string,
  aspectRatio: VideoAspectRatio,
  projectVoiceProvider?: 'elevenlabs' | 'unrealspeech' | 'custom' | 'hedra'
): Promise<SceneGenerationResult> {
  try {
    // Per-scene overrides take priority over project-level defaults
    const effectiveAvatarId = scene.avatarId ?? projectAvatarId;
    let resolvedVoiceId = scene.voiceId ?? projectVoiceId;
    let resolvedVoiceProvider = scene.voiceProvider ?? projectVoiceProvider;

    // ── Resolve character photo URL ──────────────────────────────────────
    let photoUrl: string | null = null;

    // Try loading from Firestore avatar profile first
    if (effectiveAvatarId) {
      try {
        const { getAvatarProfile, getDefaultProfile } = await import('@/lib/video/avatar-profile-service');
        const profile = await getAvatarProfile(effectiveAvatarId) ?? await getDefaultProfile(effectiveAvatarId);
        if (profile) {
          photoUrl = profile.frontalImageUrl ?? null;

          // Resolve voice from profile if not explicitly set
          if (!resolvedVoiceId && profile.voiceId) {
            resolvedVoiceId = profile.voiceId;
            if (profile.voiceProvider) {
              resolvedVoiceProvider = profile.voiceProvider;
            } else if (profile.source === 'hedra') {
              resolvedVoiceProvider = 'hedra';
            }
            logger.info('Using avatar profile bundled voice', {
              sceneId: scene.id,
              profileId: profile.id,
              voiceId: profile.voiceId,
              file: 'scene-generator.ts',
            });
          }

          // Enhance visual description with character metadata via prompt translator
          try {
            const { translatePromptForHedra } = await import('@/lib/video/hedra-prompt-translator');
            const enhancedDescription = translatePromptForHedra(
              scene.visualDescription ?? '',
              {
                characterName: profile.name,
                role: profile.role,
                styleTag: profile.styleTag,
                source: profile.source,
              }
            );
            scene = { ...scene, visualDescription: enhancedDescription };
          } catch {
            // Prompt translator is non-critical
          }

          logger.info('Loaded avatar profile for scene', {
            sceneId: scene.id,
            profileId: profile.id,
            hasPhoto: Boolean(photoUrl),
            file: 'scene-generator.ts',
          });
        }
      } catch {
        // Profile load failed — continue to fallback
      }
    }

    // Fallback: auto-select a Hedra stock character if no avatar photo resolved
    if (!photoUrl) {
      const stockCharacter = await getDefaultHedraCharacter();
      if (stockCharacter) {
        photoUrl = stockCharacter.imageUrl;
        logger.info('Auto-selected Hedra stock character (no avatar configured)', {
          sceneId: scene.id,
          characterName: stockCharacter.name,
          file: 'scene-generator.ts',
        });
      }
    }

    if (!photoUrl) {
      return {
        sceneId: scene.id,
        providerVideoId: '',
        provider: 'hedra',
        status: 'failed',
        videoUrl: null,
        thumbnailUrl: null,
        progress: 0,
        error: 'No character image available. Check your Hedra API key in Settings > API Keys.',
      };
    }

    // ── Resolve voice ────────────────────────────────────────────────────
    if (!resolvedVoiceId) {
      const fallback = await getDefaultHedraVoice();
      if (fallback) {
        resolvedVoiceId = fallback.id;
        resolvedVoiceProvider = 'hedra';
        logger.info('Auto-selected Hedra voice (none configured)', {
          sceneId: scene.id,
          voiceId: fallback.id,
          voiceName: fallback.name,
          file: 'scene-generator.ts',
        });
      }
    }

    if (resolvedVoiceId && !resolvedVoiceProvider) {
      resolvedVoiceProvider = 'hedra';
    }

    logger.info('Generating scene with Hedra', {
      sceneId: scene.id,
      hasAvatarProfile: Boolean(effectiveAvatarId),
      usingStockCharacter: !effectiveAvatarId,
      voiceProvider: resolvedVoiceProvider ?? 'hedra',
      scriptLength: scene.scriptText?.length ?? 0,
      file: 'scene-generator.ts',
    });

    return await generateWithHedra(scene, photoUrl, resolvedVoiceId, aspectRatio);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Scene generation failed', error as Error, {
      sceneId: scene.id,
      file: 'scene-generator.ts',
    });
    return {
      sceneId: scene.id,
      providerVideoId: '',
      provider: 'hedra',
      status: 'failed',
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Scene Status Polling
// ============================================================================

/**
 * Poll Hedra for scene status.
 * The provider parameter is retained for backward compatibility but is
 * ignored — Hedra is the sole engine.
 */
export async function pollSceneStatus(
  providerVideoId: string,
  _provider: VideoEngineId | null = 'hedra'
): Promise<{
  status: 'generating' | 'completed' | 'failed';
  videoUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  progress: number;
}> {
  try {
    const hedraStatus = await getHedraVideoStatus(providerVideoId);

    if (hedraStatus.status === 'completed') {
      return {
        status: 'completed',
        videoUrl: hedraStatus.videoUrl,
        thumbnailUrl: null,
        error: null,
        progress: 100,
      };
    }

    if (hedraStatus.status === 'failed') {
      return {
        status: 'failed',
        videoUrl: null,
        thumbnailUrl: null,
        error: hedraStatus.error ?? 'Hedra video generation failed',
        progress: 0,
      };
    }

    return {
      status: 'generating',
      videoUrl: null,
      thumbnailUrl: null,
      error: null,
      progress: hedraStatus.progress ?? (hedraStatus.status === 'processing' ? 40 : 10),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to poll Hedra scene status', error as Error, {
      generationId: providerVideoId,
      file: 'scene-generator.ts',
    });
    return { status: 'failed', videoUrl: null, thumbnailUrl: null, error: errorMessage, progress: 0 };
  }
}

// ============================================================================
// Batch Scene Generation
// ============================================================================

/**
 * Generate all scenes with a concurrency limit of 3.
 * All scenes are staggered by 1.5 s to avoid Hedra rate limits.
 */
export async function generateAllScenes(
  scenes: PipelineScene[],
  avatarId: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio,
  onSceneUpdate?: (result: SceneGenerationResult) => void,
  voiceProvider?: 'elevenlabs' | 'unrealspeech' | 'custom' | 'hedra'
): Promise<SceneGenerationResult[]> {
  try {
    const CONCURRENCY = 3;
    const results: SceneGenerationResult[] = [];

    logger.info('Starting batch scene generation', {
      totalScenes: scenes.length,
      concurrency: CONCURRENCY,
      engines: scenes.map(() => 'hedra'),
      file: 'scene-generator.ts',
    });

    for (let i = 0; i < scenes.length; i += CONCURRENCY) {
      const batch = scenes.slice(i, i + CONCURRENCY);

      logger.info('Processing scene batch', {
        batchNumber: Math.floor(i / CONCURRENCY) + 1,
        batchSize: batch.length,
        file: 'scene-generator.ts',
      });

      // Stagger all starts by 1.5 s each to avoid TTS rate limits
      const batchResults = await Promise.all(
        batch.map(async (scene, batchIndex) => {
          if (batchIndex > 0) {
            await new Promise<void>((resolve) => { setTimeout(resolve, batchIndex * 1500); });
          }
          return generateScene(scene, avatarId, voiceId, aspectRatio, voiceProvider);
        })
      );

      for (const result of batchResults) {
        results.push(result);
        if (onSceneUpdate) {
          onSceneUpdate(result);
        }
      }
    }

    logger.info('Batch scene generation completed', {
      totalScenes: scenes.length,
      successfulScenes: results.filter((r) => r.status !== 'failed').length,
      failedScenes: results.filter((r) => r.status === 'failed').length,
      file: 'scene-generator.ts',
    });

    return results;
  } catch (error) {
    logger.error('Batch scene generation failed', error as Error, {
      file: 'scene-generator.ts',
    });
    throw error;
  }
}
