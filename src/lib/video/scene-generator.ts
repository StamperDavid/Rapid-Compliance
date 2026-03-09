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
// TTS Audio Synthesis
// ============================================================================

/**
 * Synthesize TTS audio for a script and store it in Firestore so it can be
 * served via a public URL.  ElevenLabs is the universal TTS engine; UnrealSpeech
 * is supported as an alternative when voiceProvider is 'unrealspeech'.
 *
 * Returns a public URL (`/api/video/tts-audio/<id>`) or throws on failure.
 */
async function synthesizeTTSAudio(
  script: string,
  voiceId: string,
  voiceProvider: 'elevenlabs' | 'unrealspeech' | 'custom' | 'hedra' | undefined,
  sceneId: string
): Promise<string> {
  const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
  const { PLATFORM_ID } = await import('@/lib/constants/platform');
  const { adminDb } = await import('@/lib/firebase/admin');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rapidcompliance.us';

  // UnrealSpeech path — returns a public OutputUri directly, no Firestore storage needed
  if (voiceProvider === 'unrealspeech') {
    const { UnrealProvider } = await import('@/lib/voice/tts/providers/unreal-provider');
    const rawKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'unrealSpeech');
    const apiKey = typeof rawKey === 'string' ? rawKey : undefined;
    const provider = new UnrealProvider(apiKey);
    const ttsResult = await provider.synthesize(script, voiceId);

    // UnrealSpeech returns an OutputUri — store it in Firestore so we have a
    // consistent /api/video/tts-audio/<id> URL shape for all providers.
    if (!adminDb) {
      throw new Error('Firestore adminDb not available');
    }
    const audioId = `tts-unrealspeech-${sceneId}-${Date.now()}`;
    await adminDb
      .collection(`organizations/${PLATFORM_ID}/tts_audio`)
      .doc(audioId)
      .set({
        outputUri: ttsResult.audio, // public URL returned by Unreal
        contentType: 'audio/mpeg',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

    return `${appUrl}/api/video/tts-audio/${audioId}`;
  }

  // ElevenLabs path (also used for 'hedra', 'custom', and undefined — ElevenLabs is universal)
  const { ElevenLabsProvider } = await import('@/lib/voice/tts/providers/elevenlabs-provider');
  const rawKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'elevenlabs');
  const apiKey = typeof rawKey === 'string' ? rawKey : null;

  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured. Hedra requires TTS audio.');
  }

  const provider = new ElevenLabsProvider(apiKey);
  const ttsResult = await provider.synthesize(script, voiceId);

  // ElevenLabs returns data URI — strip the header to get raw base64
  const audioBase64 = ttsResult.audio.includes(',')
    ? ttsResult.audio.split(',')[1]
    : ttsResult.audio;

  if (!adminDb) {
    throw new Error('Firestore adminDb not available');
  }

  const audioId = `tts-hedra-${sceneId}-${Date.now()}`;
  await adminDb
    .collection(`organizations/${PLATFORM_ID}/tts_audio`)
    .doc(audioId)
    .set({
      base64: audioBase64,
      contentType: 'audio/mpeg',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

  return `${appUrl}/api/video/tts-audio/${audioId}`;
}

// ============================================================================
// Hedra Avatar Generator
// ============================================================================

/**
 * Generate a talking-head avatar scene using Hedra Character-3.
 *
 * Two audio paths:
 *   - **Hedra voice** (voiceProvider === 'hedra') → Hedra native TTS via `audio_generation`
 *   - **ElevenLabs/UnrealSpeech** → synthesize audio ourselves, upload via `audio_id`
 */
async function generateWithHedra(
  scene: PipelineScene,
  avatarId: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio,
  voiceProvider?: 'elevenlabs' | 'unrealspeech' | 'custom' | 'hedra'
): Promise<SceneGenerationResult> {
  const script = scene.scriptText.trim() || ' ';
  const useHedraTTS = voiceProvider === 'hedra' && Boolean(voiceId);

  // Load avatar profile for the frontal photo
  const { getDefaultProfile, getAvatarProfile } = await import('@/lib/video/avatar-profile-service');

  let photoUrl: string | null = null;
  try {
    const profile = await getAvatarProfile(avatarId) ?? await getDefaultProfile(avatarId);
    if (profile?.frontalImageUrl) {
      photoUrl = profile.frontalImageUrl;
      logger.info('Loaded avatar profile photo for Hedra', {
        sceneId: scene.id,
        profileId: profile.id,
        source: profile.source,
        file: 'scene-generator.ts',
      });
    }
  } catch {
    // Profile not found — will fail below with clear error
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
      error: 'No avatar photo found. Create a character with a frontal photo to use Hedra.',
    };
  }

  // Map aspect ratio — Hedra does not support 4:3
  const hedraAspectRatio = aspectRatio === '4:3' ? '16:9' : aspectRatio;

  // Path A: Hedra native TTS — pass voice_id + text directly, no audio upload needed
  if (useHedraTTS && script.length > 1) {
    logger.info('Using Hedra native TTS for scene', {
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

    logger.info('Hedra generation started (native TTS)', {
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

  // Path B: External TTS (ElevenLabs/UnrealSpeech) — synthesize audio, upload to Hedra
  let audioUrl: string | null = null;
  if (script.length > 1) {
    try {
      audioUrl = await synthesizeTTSAudio(script, voiceId, voiceProvider, scene.id);
    } catch (ttsError) {
      const errorMsg = ttsError instanceof Error ? ttsError.message : String(ttsError);
      logger.error('TTS synthesis failed for Hedra scene', ttsError instanceof Error ? ttsError : new Error(errorMsg), {
        sceneId: scene.id,
        voiceProvider: voiceProvider ?? 'elevenlabs',
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
        error: `Voice synthesis failed: ${errorMsg}`,
      };
    }
  }

  if (!audioUrl) {
    return {
      sceneId: scene.id,
      providerVideoId: '',
      provider: 'hedra',
      status: 'failed',
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      error: 'Audio synthesis required for Hedra but no audio was generated.',
    };
  }

  // Submit to Hedra Character-3 with uploaded audio
  const response = await generateHedraAvatarVideo(photoUrl, audioUrl, {
    textPrompt: scene.visualDescription?.trim() ?? '',
    aspectRatio: hedraAspectRatio,
    durationMs: scene.duration * 1000,
  });

  logger.info('Hedra generation started (uploaded audio)', {
    sceneId: scene.id,
    generationId: response.generationId,
    modelId: response.modelId,
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
 * If the scene has no avatar, returns a failed result with a clear message.
 * Loads the avatar profile to resolve a bundled voice when none was passed.
 */
export async function generateScene(
  scene: PipelineScene,
  avatarId: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio,
  voiceProvider?: 'elevenlabs' | 'unrealspeech' | 'custom' | 'hedra'
): Promise<SceneGenerationResult> {
  try {
    const hasAvatar = Boolean(avatarId);

    if (!hasAvatar) {
      return {
        sceneId: scene.id,
        providerVideoId: '',
        provider: 'hedra',
        status: 'failed',
        videoUrl: null,
        thumbnailUrl: null,
        progress: 0,
        error: 'Hedra requires an avatar profile. Please select a character.',
      };
    }

    // Load avatar profile to get bundled voice + preferred engine
    let resolvedVoiceId = voiceId;
    let resolvedVoiceProvider = voiceProvider;

    try {
      const { getAvatarProfile, getDefaultProfile } = await import('@/lib/video/avatar-profile-service');
      const profile = await getAvatarProfile(avatarId) ?? await getDefaultProfile(avatarId);
      if (profile) {
        if (!resolvedVoiceId && profile.voiceId) {
          resolvedVoiceId = profile.voiceId;
          resolvedVoiceProvider = profile.voiceProvider ?? resolvedVoiceProvider;
          logger.info('Using avatar profile bundled voice', {
            sceneId: scene.id,
            profileId: profile.id,
            voiceId: profile.voiceId,
            voiceProvider: profile.voiceProvider,
            file: 'scene-generator.ts',
          });
        }
      }
    } catch {
      // Profile load failed — continue with passed-in params
    }

    logger.info('Generating scene with Hedra', {
      sceneId: scene.id,
      avatarId,
      voiceProvider: resolvedVoiceProvider ?? 'elevenlabs',
      scriptLength: scene.scriptText?.length ?? 0,
      file: 'scene-generator.ts',
    });

    return await generateWithHedra(scene, avatarId, resolvedVoiceId, aspectRatio, resolvedVoiceProvider);
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
 * All scenes are staggered by 1.5 s to avoid ElevenLabs rate limits.
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
