/**
 * Multi-Engine Scene Generator
 * Routes scene generation to the selected video engine (Runway, Sora, Kling Avatar)
 * and handles polling and batch processing for the video pipeline
 */

import { logger } from '@/lib/logger/logger';
import {
  generateRunwayVideo,
  generateSoraVideo,
  getVideoStatus,
  getVideoProviderKey,
} from '@/lib/video/video-service';
import {
  generateKlingTextToVideo,
  generateKlingAvatarVideo,
  getKlingVideoStatus,
} from '@/lib/video/fal-kling-service';
import type { PipelineScene, SceneGenerationResult, VideoEngineId } from '@/types/video-pipeline';
import type { VideoAspectRatio, VideoProvider } from '@/types/video';

// ============================================================================
// Engine-Specific Generators
// ============================================================================

async function generateWithRunway(
  scene: PipelineScene,
  aspectRatio: VideoAspectRatio
): Promise<SceneGenerationResult> {
  const runwayAspectRatio: '16:9' | '9:16' | '1:1' =
    aspectRatio === '4:3' ? '16:9' : aspectRatio;

  // For B-roll scenes, use backgroundPrompt or visualDescription as the generation prompt
  // Runway requires promptText to be at least 1 character
  const prompt = ((): string => {
    const script = scene.scriptText.trim();
    if (script) { return script; }
    const bg = scene.backgroundPrompt?.trim();
    if (bg) { return bg; }
    const vis = scene.visualDescription?.trim();
    if (vis) { return vis; }
    return 'Cinematic B-roll footage';
  })();

  const response = await generateRunwayVideo('text', prompt, {
    duration: Math.min(scene.duration, 10), // Runway max 10s
    ratio: runwayAspectRatio,
  });

  logger.info('Runway scene generation started', {
    sceneId: scene.id,
    providerVideoId: response.id,
    file: 'scene-generator.ts',
  });

  return {
    sceneId: scene.id,
    providerVideoId: response.id,
    provider: 'runway',
    status: 'generating',
    videoUrl: null,
    thumbnailUrl: null,
    progress: 0,
    error: null,
  };
}

async function generateWithSora(
  scene: PipelineScene,
  aspectRatio: VideoAspectRatio
): Promise<SceneGenerationResult> {
  const soraAspectRatio: '16:9' | '9:16' | '1:1' =
    aspectRatio === '4:3' ? '16:9' : aspectRatio;

  // For B-roll scenes, use backgroundPrompt or visualDescription as the generation prompt
  const prompt = ((): string => {
    const script = scene.scriptText.trim();
    if (script) { return script; }
    const bg = scene.backgroundPrompt?.trim();
    if (bg) { return bg; }
    const vis = scene.visualDescription?.trim();
    if (vis) { return vis; }
    return 'Cinematic B-roll footage';
  })();

  try {
    const response = await generateSoraVideo(prompt, {
      duration: Math.min(scene.duration, 16), // Sora max 16s (valid: 4, 8, 12, 16)
      aspectRatio: soraAspectRatio,
    });

    logger.info('Sora scene generation started', {
      sceneId: scene.id,
      providerVideoId: response.id,
      file: 'scene-generator.ts',
    });

    return {
      sceneId: scene.id,
      providerVideoId: response.id,
      provider: 'sora',
      status: 'generating',
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      error: null,
    };
  } catch (soraError) {
    // Sora failed — auto-fallback to Runway
    logger.warn('Sora generation failed, falling back to Runway', {
      sceneId: scene.id,
      error: soraError instanceof Error ? soraError.message : String(soraError),
      file: 'scene-generator.ts',
    });

    const providers = await getAvailableProviders();
    if (providers.runway) {
      return generateWithRunway(scene, aspectRatio);
    }

    // If Runway also unavailable, throw the original Sora error
    throw soraError;
  }
}

async function generateWithKling(
  scene: PipelineScene,
  aspectRatio: VideoAspectRatio
): Promise<SceneGenerationResult> {
  const klingAspectRatio: '16:9' | '9:16' | '1:1' =
    aspectRatio === '4:3' ? '16:9' : aspectRatio;

  // Determine prompt from scene data
  const prompt = ((): string => {
    const script = scene.scriptText.trim();
    if (script) { return script; }
    const bg = scene.backgroundPrompt?.trim();
    if (bg) { return bg; }
    const vis = scene.visualDescription?.trim();
    if (vis) { return vis; }
    return 'Cinematic footage';
  })();

  // Kling supports 5s or 10s durations
  const duration: '5' | '10' = scene.duration > 7 ? '10' : '5';

  const response = await generateKlingTextToVideo(prompt, {
    duration,
    aspectRatio: klingAspectRatio,
  });

  logger.info('Kling scene generation started', {
    sceneId: scene.id,
    requestId: response.requestId,
    model: response.model,
    file: 'scene-generator.ts',
  });

  // Store the model in providerVideoId as "requestId|model" so polling knows which endpoint
  return {
    sceneId: scene.id,
    providerVideoId: `${response.requestId}|${response.model}`,
    provider: 'kling',
    status: 'generating',
    videoUrl: null,
    thumbnailUrl: null,
    progress: 0,
    error: null,
  };
}

/**
 * Generate a talking avatar scene using Kling Avatar v2 (via fal.ai).
 * Primary avatar engine — replaces HeyGen entirely.
 * Takes: photo + TTS audio → talking head video.
 *
 * Also generates a video background from Runway/Kling and composites them if available.
 */
async function generateWithKlingAvatar(
  scene: PipelineScene,
  avatarId: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio,
  voiceProvider?: 'elevenlabs' | 'unrealspeech' | 'custom'
): Promise<SceneGenerationResult> {
  const script = scene.scriptText.trim() || ' ';

  // Load the avatar profile to get the frontal photo URL
  const { getDefaultProfile, getAvatarProfile } = await import('@/lib/video/avatar-profile-service');
  const { requireAuth: _skipAuth, ...rest } = { requireAuth: null }; void rest;

  // Try to load profile — avatarId might be a profile ID or a legacy avatar ID
  let photoUrl: string | null = null;

  // First check if there's a default avatar profile with a photo
  try {
    const profile = await getAvatarProfile(avatarId) ?? await getDefaultProfile(avatarId);
    if (profile?.frontalImageUrl) {
      photoUrl = profile.frontalImageUrl;
      logger.info('Loaded avatar profile photo for Kling Avatar', {
        sceneId: scene.id,
        profileId: profile.id,
        file: 'scene-generator.ts',
      });
    }
  } catch {
    // Profile not found — that's OK, we'll check other sources
  }

  if (!photoUrl) {
    return {
      sceneId: scene.id,
      providerVideoId: '',
      provider: 'kling',
      status: 'failed',
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      error: 'No avatar photo found. Create an Avatar Profile with a frontal photo to use Kling Avatar.',
    };
  }

  // Synthesize TTS audio
  let audioUrl: string | null = null;
  if (script.length > 1) {
    const ttsProvider = voiceProvider ?? 'elevenlabs';

    if (ttsProvider === 'elevenlabs') {
      try {
        const { ElevenLabsProvider } = await import('@/lib/voice/tts/providers/elevenlabs-provider');
        const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
        const { PLATFORM_ID } = await import('@/lib/constants/platform');
        const rawKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'elevenlabs');
        const apiKey = typeof rawKey === 'string' ? rawKey : null;

        if (!apiKey) {
          return {
            sceneId: scene.id,
            providerVideoId: '',
            provider: 'kling',
            status: 'failed',
            videoUrl: null,
            thumbnailUrl: null,
            progress: 0,
            error: 'ElevenLabs API key not configured. Kling Avatar requires TTS audio.',
          };
        }

        const provider = new ElevenLabsProvider(apiKey);
        const ttsResult = await provider.synthesize(script, voiceId);

        // Store audio in Firestore, serve via public endpoint
        const { adminDb } = await import('@/lib/firebase/admin');
        if (adminDb) {
          const audioBase64 = ttsResult.audio.includes(',')
            ? ttsResult.audio.split(',')[1]
            : ttsResult.audio;
          const audioId = `tts-kling-${scene.id}-${Date.now()}`;

          await adminDb
            .collection(`organizations/${PLATFORM_ID}/tts_audio`)
            .doc(audioId)
            .set({
              base64: audioBase64,
              contentType: 'audio/mpeg',
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            });

          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rapidcompliance.us';
          audioUrl = `${appUrl}/api/video/tts-audio/${audioId}`;
        }
      } catch (ttsError) {
        const errorMsg = ttsError instanceof Error ? ttsError.message : String(ttsError);
        return {
          sceneId: scene.id,
          providerVideoId: '',
          provider: 'kling',
          status: 'failed',
          videoUrl: null,
          thumbnailUrl: null,
          progress: 0,
          error: `Voice synthesis failed: ${errorMsg}`,
        };
      }
    }
  }

  if (!audioUrl) {
    return {
      sceneId: scene.id,
      providerVideoId: '',
      provider: 'kling',
      status: 'failed',
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      error: 'Audio synthesis required for Kling Avatar but no audio was generated.',
    };
  }

  // Submit to Kling Avatar v2
  const response = await generateKlingAvatarVideo(photoUrl, audioUrl);

  logger.info('Kling Avatar generation started', {
    sceneId: scene.id,
    requestId: response.requestId,
    model: response.model,
    photoUrl: photoUrl.slice(0, 60),
    file: 'scene-generator.ts',
  });

  // Also generate a video background if available (same compositing approach)
  const backgroundDescription = scene.backgroundPrompt?.trim() ?? scene.visualDescription?.trim();
  const providers = await getAvailableProviders();
  let backgroundVideoId: string | null = null;
  let backgroundProvider: VideoEngineId | null = null;
  const normalizedAspectRatio: '16:9' | '9:16' | '1:1' =
    aspectRatio === '4:3' ? '16:9' : aspectRatio;

  if (backgroundDescription && (providers.runway || providers.kling)) {
    const bgEngine = selectBackgroundEngine(providers, scene);
    try {
      if (bgEngine === 'kling') {
        const klingDuration: '5' | '10' = scene.duration > 7 ? '10' : '5';
        const bgResponse = await generateKlingTextToVideo(backgroundDescription, {
          duration: klingDuration,
          aspectRatio: normalizedAspectRatio,
        });
        backgroundVideoId = `${bgResponse.requestId}|${bgResponse.model}`;
        backgroundProvider = 'kling';
      } else {
        const bgResponse = await generateRunwayVideo('text', backgroundDescription, {
          duration: Math.min(scene.duration, 10),
          ratio: normalizedAspectRatio,
        });
        backgroundVideoId = bgResponse.id;
        backgroundProvider = 'runway';
      }
    } catch (bgError) {
      logger.warn('Background video generation failed for Kling Avatar scene', {
        sceneId: scene.id,
        bgEngine,
        error: bgError instanceof Error ? bgError.message : String(bgError),
        file: 'scene-generator.ts',
      });
    }
  }

  return {
    sceneId: scene.id,
    providerVideoId: `${response.requestId}|${response.model}`,
    provider: 'kling',
    status: 'generating',
    videoUrl: null,
    thumbnailUrl: null,
    progress: 0,
    error: null,
    backgroundVideoId,
    backgroundVideoUrl: null,
    backgroundProvider,
    compositedVideoUrl: null,
    compositeStatus: backgroundVideoId ? 'pending' : null,
  };
}

// ============================================================================
// Intelligent Engine Selection
// ============================================================================

/** Cached provider availability so we don't re-check on every scene */
const providerCache: { data: Record<string, boolean> | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};
const PROVIDER_CACHE_TTL = 60_000; // 1 minute

async function getAvailableProviders(): Promise<Record<string, boolean>> {
  const now = Date.now();
  if (providerCache.data && (now - providerCache.timestamp) < PROVIDER_CACHE_TTL) {
    return providerCache.data;
  }

  const [sora, runway, kling] = await Promise.all([
    getVideoProviderKey('sora').then((k) => k !== null),
    getVideoProviderKey('runway').then((k) => k !== null),
    getVideoProviderKey('fal').then((k) => k !== null), // fal.ai key powers Kling
  ]);

  const result = { sora, runway, kling };
  Object.assign(providerCache, { data: result, timestamp: Date.now() });

  logger.info('Video provider availability check', {
    sora, runway, kling,
    file: 'scene-generator.ts',
  });

  return result;
}

// ── Scene Classification ──

/**
 * Classify what TYPE of content a scene represents by analyzing its
 * script, title, visual description, and background prompt.
 *
 * Returns a classification that drives intelligent engine selection.
 */
type SceneClassification =
  | 'talking-head'          // Avatar speaking to camera (photo + audio → Kling Avatar)
  | 'character-in-action'   // Avatar's likeness in a described scenario (reference images → Kling Reference)
  | 'cinematic-environment' // Photorealistic environment/location footage (→ Runway)
  | 'product-screenshot'    // Screen recording or UI screenshot overlay (→ static image, no video engine)
  | 'stylized-creative'     // Sci-fi, fantasy, abstract, artistic scenes (→ Kling)
  | 'dynamic-action'        // Fast motion, stunts, physical action (→ Kling)
  | 'b-roll-atmospheric'    // Slow, moody, atmospheric footage (→ Runway)
  | 'text-overlay-only';    // Title card, lower third — no video generation needed

function classifyScene(scene: PipelineScene, hasAvatar: boolean): SceneClassification {
  const searchText = [
    scene.title ?? '',
    scene.visualDescription ?? '',
    scene.backgroundPrompt ?? '',
    scene.scriptText ?? '',
  ].join(' ').toLowerCase();

  const scriptLength = scene.scriptText?.trim().length ?? 0;
  const hasScript = scriptLength > 30;
  const hasScreenshot = Boolean(scene.screenshotUrl);

  // ── Title cards and text overlays ──
  const titleKeywords = ['title card', 'lower third', 'text overlay', 'intro card', 'end card', 'credits'];
  if (titleKeywords.some((kw) => searchText.includes(kw)) && !hasScript) {
    return 'text-overlay-only';
  }

  // ── Product screenshots / screen recordings ──
  const screenshotKeywords = ['screenshot', 'screen recording', 'ui demo', 'interface', 'dashboard view', 'page walkthrough', 'software demo'];
  if (hasScreenshot || screenshotKeywords.some((kw) => searchText.includes(kw))) {
    if (hasScript && hasAvatar) { return 'talking-head'; } // Avatar talks over screenshot
    return 'product-screenshot';
  }

  // ── Character-in-action (avatar doing things, not just talking) ──
  const actionAvatarKeywords = [
    'superhero', 'flying', 'running', 'walking through', 'exploring', 'fighting',
    'dancing', 'standing in', 'sitting at', 'archeologist', 'explorer', 'detective',
    'costume', 'disguise', 'transforms', 'appears as', 'dressed as', 'full body',
    'character walks', 'character runs', 'person enters', 'avatar in',
  ];
  if (hasAvatar && actionAvatarKeywords.some((kw) => searchText.includes(kw))) {
    return 'character-in-action';
  }

  // ── Stylized / creative / fantasy ──
  const stylizedKeywords = [
    'sci-fi', 'scifi', 'fantasy', 'alien', 'space', 'futuristic', 'neon',
    'cyberpunk', 'cartoon', 'animated', 'abstract', 'surreal', 'magical',
    'underwater', 'outer space', 'galaxy', 'dystopian', 'retro-futur',
    'holographic', 'matrix', 'virtual reality', 'glitch',
  ];
  if (stylizedKeywords.some((kw) => searchText.includes(kw))) {
    if (hasScript && hasAvatar) { return 'talking-head'; } // Avatar talks with stylized BG
    return 'stylized-creative';
  }

  // ── Dynamic action / fast motion ──
  const dynamicKeywords = [
    'explosion', 'crash', 'chase', 'montage', 'fast cut', 'action sequence',
    'rapid', 'intense', 'dramatic reveal', 'transformation', 'morph',
  ];
  if (dynamicKeywords.some((kw) => searchText.includes(kw))) {
    return 'dynamic-action';
  }

  // ── Talking head (avatar speaking to camera) ──
  if (hasScript && hasAvatar) {
    return 'talking-head';
  }

  // ── B-roll / atmospheric (explicit visual-only keywords) ──
  const brollKeywords = [
    'b-roll', 'broll', 'establishing shot', 'aerial', 'drone shot', 'landscape',
    'transition', 'time-lapse', 'slow motion', 'atmospheric', 'ambient',
    'panning shot', 'dolly', 'tracking shot',
  ];
  if (brollKeywords.some((kw) => searchText.includes(kw))) {
    return 'b-roll-atmospheric';
  }

  // ── Cinematic environment (default for visual scenes without avatar) ──
  if (!hasScript) {
    return 'cinematic-environment';
  }

  // ── Fallback: if there's a script but no avatar, treat as cinematic ──
  return 'cinematic-environment';
}

// ── Intelligent Engine Selection ──

/**
 * Select the best engine for a scene based on content analysis.
 *
 * This is NOT a priority list — it analyzes what the scene actually needs
 * and picks the engine whose strengths match.
 *
 * Engine strengths:
 * - Kling Avatar:     Talking head from photo + audio (primary avatar engine)
 * - Kling Reference:  Character consistency — your face in any described scene
 * - Kling Text2Video: Stylized, fantasy, action, character motion
 * - Runway:           Photorealistic environments, cinematic quality, slow camera movements
 * - Sora:             Experimental only — used if explicitly configured, never auto-selected
 */
export async function selectEngineForScene(
  scene: PipelineScene,
  hasAvatar: boolean
): Promise<VideoEngineId> {
  // If the scene already has an engine explicitly set by the AI or user, respect it
  if (scene.engine) {
    return scene.engine;
  }

  const providers = await getAvailableProviders();
  const classification = classifyScene(scene, hasAvatar);

  logger.info('Scene classified for engine selection', {
    sceneId: scene.id,
    classification,
    hasAvatar,
    scriptLength: scene.scriptText?.trim().length ?? 0,
    file: 'scene-generator.ts',
  });

  switch (classification) {
    case 'talking-head':
      // Avatar speaks to camera. Kling Avatar (photo+audio) is the primary engine.
      if (providers.kling) { return 'kling'; }
      return 'kling'; // Will fail with clear error if not configured

    case 'character-in-action':
      // Avatar's likeness in an action scene. Only Kling Reference can do this.
      if (providers.kling) { return 'kling'; }
      return 'kling';

    case 'cinematic-environment':
      // Photorealistic environment footage. Runway excels here.
      if (providers.runway) { return 'runway'; }
      if (providers.kling) { return 'kling'; }
      return 'runway';

    case 'product-screenshot':
      // Screenshot/UI demo — no video engine needed for the visual,
      // just overlay the screenshot. Kling or Runway can add subtle motion.
      if (providers.runway) { return 'runway'; }
      if (providers.kling) { return 'kling'; }
      return 'runway';

    case 'stylized-creative':
      // Sci-fi, fantasy, abstract. Kling handles stylized content better.
      if (providers.kling) { return 'kling'; }
      if (providers.runway) { return 'runway'; }
      return 'kling';

    case 'dynamic-action':
      // Fast motion, action sequences. Kling's motion handling is superior.
      if (providers.kling) { return 'kling'; }
      if (providers.runway) { return 'runway'; }
      return 'kling';

    case 'b-roll-atmospheric':
      // Slow, moody, atmospheric. Runway's cinematic quality shines here.
      if (providers.runway) { return 'runway'; }
      if (providers.kling) { return 'kling'; }
      return 'runway';

    case 'text-overlay-only':
      // No video generation needed — just a text card.
      // Use cheapest available engine for a simple background.
      if (providers.kling) { return 'kling'; }
      if (providers.runway) { return 'runway'; }
      return 'kling';
  }
}

/**
 * Select the best video engine for generating the BACKGROUND video
 * in two-track compositing mode (avatar over AI video background).
 * Uses the same scene analysis as the main engine selector.
 */
function selectBackgroundEngine(
  providers: Record<string, boolean>,
  scene: PipelineScene,
): VideoEngineId {
  // If scene explicitly specifies a background engine, respect it
  if (scene.backgroundEngine) {
    return scene.backgroundEngine;
  }

  // Analyze the background description to pick the best engine
  const bgText = [
    scene.backgroundPrompt ?? '',
    scene.visualDescription ?? '',
  ].join(' ').toLowerCase();

  // Stylized / fantasy backgrounds → Kling
  const stylizedKeywords = ['sci-fi', 'fantasy', 'neon', 'cyberpunk', 'futuristic', 'abstract', 'alien', 'space', 'holographic'];
  if (stylizedKeywords.some((kw) => bgText.includes(kw)) && providers.kling) {
    return 'kling';
  }

  // Backgrounds with people or action → Kling (character consistency)
  const peopleKeywords = ['person', 'people', 'crowd', 'walking', 'team', 'group'];
  if (peopleKeywords.some((kw) => bgText.includes(kw)) && providers.kling) {
    return 'kling';
  }

  // Cinematic / environment / atmospheric → Runway
  if (providers.runway) { return 'runway'; }
  if (providers.kling) { return 'kling'; }

  return 'runway';
}

/**
 * Determine whether a scene needs a talking avatar or is purely visual.
 * Used by generateScene() to decide whether to route to avatar generation.
 */
function isAvatarScene(scene: PipelineScene, hasAvatar: boolean): boolean {
  const classification = classifyScene(scene, hasAvatar);
  return classification === 'talking-head' || classification === 'character-in-action';
}

/**
 * Select engines for all scenes in a batch. Returns a map of sceneId → engine.
 */
export async function selectEnginesForScenes(
  scenes: PipelineScene[],
  hasAvatar: boolean
): Promise<Map<string, VideoEngineId>> {
  const result = new Map<string, VideoEngineId>();
  for (const scene of scenes) {
    const engine = await selectEngineForScene(scene, hasAvatar);
    result.set(scene.id, engine);
  }
  return result;
}

// ============================================================================
// Scene Generation (Multi-Engine Router)
// ============================================================================

/**
 * Generate a single scene, dispatching to the best available engine.
 * Uses intelligent engine selection when scene.engine is null.
 */
export async function generateScene(
  scene: PipelineScene,
  avatarId: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio,
  voiceProvider?: 'elevenlabs' | 'unrealspeech' | 'custom'
): Promise<SceneGenerationResult> {
  // Entire function wrapped in try/catch so nothing can crash the batch
  try {
    const hasAvatar = Boolean(avatarId);
    const engine: VideoEngineId = await selectEngineForScene(scene, hasAvatar);

    logger.info('Engine selected for scene', {
      sceneId: scene.id,
      explicitEngine: scene.engine,
      selectedEngine: engine,
      hasAvatar,
      scriptLength: scene.scriptText?.length ?? 0,
      file: 'scene-generator.ts',
    });

    switch (engine) {
      case 'runway':
        return await generateWithRunway(scene, aspectRatio);

      case 'sora':
        // generateWithSora has auto-fallback to Runway on failure
        return await generateWithSora(scene, aspectRatio);

      case 'kling': {
        // If scene needs an avatar (has speaking script + avatar configured),
        // use Kling Avatar (photo + audio = talking head) instead of text-to-video
        const needsKlingAvatar = hasAvatar && isAvatarScene(scene, hasAvatar);
        if (needsKlingAvatar) {
          return await generateWithKlingAvatar(scene, avatarId, voiceId, aspectRatio, voiceProvider);
        }
        return await generateWithKling(scene, aspectRatio);
      }

      case 'luma':
        return {
          sceneId: scene.id,
          providerVideoId: '',
          provider: engine,
          status: 'failed',
          videoUrl: null,
          thumbnailUrl: null,
          progress: 0,
          error: 'Luma is not yet available. Please select another engine.',
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Scene generation failed', error as Error, {
      sceneId: scene.id,
      engine: scene.engine ?? 'unknown',
      file: 'scene-generator.ts',
    });

    return {
      sceneId: scene.id,
      providerVideoId: '',
      provider: scene.engine ?? 'kling',
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
 * Poll provider for scene status
 * Maps provider response to our scene status format
 */
export async function pollSceneStatus(
  providerVideoId: string,
  provider: VideoEngineId | null = 'kling'
): Promise<{
  status: 'generating' | 'completed' | 'failed';
  videoUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
}> {
  const resolvedProvider = provider ?? 'kling';

  // Kling uses fal.ai queue API — providerVideoId format: "requestId|model"
  if (resolvedProvider === 'kling') {
    const [requestId, model] = providerVideoId.split('|');
    if (!requestId || !model) {
      return {
        status: 'failed',
        videoUrl: null,
        thumbnailUrl: null,
        error: 'Invalid Kling provider video ID format',
      };
    }

    try {
      const klingStatus = await getKlingVideoStatus(requestId, model);

      if (klingStatus.status === 'completed') {
        return {
          status: 'completed',
          videoUrl: klingStatus.videoUrl,
          thumbnailUrl: null,
          error: null,
        };
      } else if (klingStatus.status === 'failed') {
        return {
          status: 'failed',
          videoUrl: null,
          thumbnailUrl: null,
          error: klingStatus.error ?? 'Kling video generation failed',
        };
      } else {
        return {
          status: 'generating',
          videoUrl: null,
          thumbnailUrl: null,
          error: null,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to poll Kling scene status', error as Error, {
        requestId,
        model,
        file: 'scene-generator.ts',
      });
      return { status: 'failed', videoUrl: null, thumbnailUrl: null, error: errorMessage };
    }
  }

  // Sora and Runway use the standard video-service polling
  const validProviders: VideoProvider[] = ['sora', 'runway'];
  if (!validProviders.includes(resolvedProvider as VideoProvider)) {
    return {
      status: 'failed',
      videoUrl: null,
      thumbnailUrl: null,
      error: `Status polling not supported for ${resolvedProvider}`,
    };
  }

  try {
    const response = await getVideoStatus(providerVideoId, resolvedProvider as VideoProvider);

    if (response.status === 'completed') {
      return {
        status: 'completed',
        videoUrl: response.videoUrl ?? null,
        thumbnailUrl: response.thumbnailUrl ?? null,
        error: null,
      };
    } else if (response.status === 'failed') {
      return {
        status: 'failed',
        videoUrl: null,
        thumbnailUrl: null,
        error: response.errorMessage ?? 'Video generation failed',
      };
    } else {
      return {
        status: 'generating',
        videoUrl: null,
        thumbnailUrl: null,
        error: null,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to poll scene status', error as Error, {
      providerVideoId,
      provider: resolvedProvider,
      file: 'scene-generator.ts',
    });

    return {
      status: 'failed',
      videoUrl: null,
      thumbnailUrl: null,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Batch Scene Generation
// ============================================================================

/**
 * Generate all scenes with concurrency limit
 * Processes scenes in batches of 3 to avoid overwhelming the API
 */
export async function generateAllScenes(
  scenes: PipelineScene[],
  avatarId: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio,
  onSceneUpdate?: (result: SceneGenerationResult) => void,
  voiceProvider?: 'elevenlabs' | 'unrealspeech' | 'custom'
): Promise<SceneGenerationResult[]> {
  try {
    const CONCURRENCY = 3;
    const results: SceneGenerationResult[] = [];

    logger.info('Starting batch scene generation', {
      totalScenes: scenes.length,
      concurrency: CONCURRENCY,
      engines: scenes.map((s) => s.engine ?? 'kling'),
      file: 'scene-generator.ts',
    });

    // Process scenes in batches
    for (let i = 0; i < scenes.length; i += CONCURRENCY) {
      const batch = scenes.slice(i, i + CONCURRENCY);

      logger.info('Processing scene batch', {
        batchNumber: Math.floor(i / CONCURRENCY) + 1,
        batchSize: batch.length,
        file: 'scene-generator.ts',
      });

      // Stagger scene starts by 1.5s each to avoid ElevenLabs rate limits
      // when multiple scenes need TTS simultaneously
      const batchResults = await Promise.all(
        batch.map(async (scene, batchIndex) => {
          if (batchIndex > 0 && voiceProvider === 'elevenlabs') {
            await new Promise<void>(resolve => { setTimeout(resolve, batchIndex * 1500); });
          }
          return generateScene(scene, avatarId, voiceId, aspectRatio, voiceProvider);
        })
      );

      for (const result of batchResults) {
        results.push(result);

        // Call the update callback if provided
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

// ── Internal helper used only by generateWithKlingAvatar background compositing ──
// Kept here so it is co-located with the logic that uses it.
void selectBackgroundEngine; // referenced internally — suppress unused-export lint
