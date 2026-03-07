/**
 * Video Generation Service
 * AI Video Factory - HeyGen, Sora, Runway integrations
 *
 * API keys are read from Firestore via the API Key Service
 * (Settings > API Keys), NOT from process.env.
 */

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type {
  VideoGenerationRequest,
  VideoGenerationResponse,
  VideoProvider,
  VideoStatus,
  VideoTemplate,
  VideoProject,
  HeyGenAvatar,
  HeyGenVoice,
  VideoWaitlistEntry,
  VideoWaitlistInterest,
} from '@/types/video';

// ============================================================================
// API Key Retrieval (from Firestore, not process.env)
// ============================================================================

/**
 * Get API key for a video provider from the API Keys settings.
 * Keys are configured at Settings > API Keys in the dashboard.
 */
export async function getVideoProviderKey(provider: VideoProvider): Promise<string | null> {
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, provider);
  if (typeof key === 'string' && key.length > 0) { return key; }
  return null;
}

// ============================================================================
// Service Status
// ============================================================================

export const VIDEO_SERVICE_STATUS = {
  isAvailable: true,
  message: 'AI Video Generation is available. Configure provider API keys in Settings > API Keys.',
} as const;

// ============================================================================
// Interest Logging (for analytics)
// ============================================================================

/**
 * Log feature interest for analytics tracking
 */
export async function logVideoInterest(
  feature: string,
  userId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    if (!adminDb) {
      logger.warn('Database not available for logging video interest', { file: 'video-service.ts' });
      return;
    }

    await adminDb.collection(`organizations/${PLATFORM_ID}/analytics_events`).add({
      event: 'video_feature_interest',
      feature,
      userId: userId ?? null,
      metadata: metadata ?? {},
      timestamp: FieldValue.serverTimestamp(),
    });

    logger.info(`Video interest logged: ${feature}`, {
      feature,
      file: 'video-service.ts'
    });
  } catch (error) {
    logger.error('Failed to log video interest', error as Error, {
      file: 'video-service.ts'
    });
  }
}

// ============================================================================
// Waitlist Management
// ============================================================================

/**
 * Add user to video feature waitlist
 */
export async function joinVideoWaitlist(
  email: string,
  options?: {
    name?: string;
    userId?: string;
    company?: string;
    interests?: VideoWaitlistInterest[];
    useCase?: string;
    expectedVolume?: 'low' | 'medium' | 'high';
  }
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  try {
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    const entry: Omit<VideoWaitlistEntry, 'id'> = {
      email: email.trim().toLowerCase(),
      name: options?.name ?? undefined,
      userId: options?.userId ?? undefined,
      company: options?.company ?? undefined,
      interests: options?.interests ?? ['ai-avatars', 'text-to-video'],
      useCase: options?.useCase ?? undefined,
      expectedVolume: options?.expectedVolume ?? undefined,
      status: 'pending',
      createdAt: new Date(),
    };

    const docRef = await adminDb.collection(`organizations/${PLATFORM_ID}/video_waitlist`).add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Log for analytics
    await logVideoInterest('waitlist_signup', options?.userId, {
      interests: options?.interests,
    });

    logger.info('User joined video waitlist', {
      email: entry.email,
      file: 'video-service.ts'
    });

    return { success: true, entryId: docRef.id };
  } catch (error) {
    logger.error('Failed to join video waitlist', error as Error, {
      file: 'video-service.ts'
    });
    return { success: false, error: 'Failed to join waitlist' };
  }
}

// ============================================================================
// Video Generation (Stubs)
// ============================================================================

/**
 * Generate video with AI
 */
export async function generateVideo(
  request: VideoGenerationRequest
): Promise<VideoGenerationResponse> {
  // Log interest for analytics
  await logVideoInterest(
    `generate_video_${request.provider}`,
    request.userId,
    { type: request.type }
  );

  // Verify provider is configured
  const configured = await isProviderConfigured(request.provider);
  if (!configured) {
    throw new Error(`${request.provider} API key is not configured. Add it in Settings → API Keys.`);
  }

  switch (request.provider) {
    case 'heygen':
      if (request.type === 'avatar' && request.script && request.avatarConfig?.avatarId) {
        return generateHeyGenVideoInternal(
          request.script,
          request.avatarConfig.avatarId,
          {
            voiceId: request.avatarConfig.voiceId,
            backgroundColor: request.avatarConfig.backgroundColor,
            aspectRatio: request.aspectRatio === '16:9' || request.aspectRatio === '9:16' || request.aspectRatio === '1:1'
              ? request.aspectRatio
              : '16:9',
          }
        );
      }
      throw new Error('HeyGen requires avatar type with script and avatarId');
    case 'sora':
      if (request.prompt) {
        return generateSoraVideoInternal(request.prompt, {
          duration: request.duration,
          aspectRatio: request.aspectRatio === '16:9' || request.aspectRatio === '9:16' || request.aspectRatio === '1:1'
            ? request.aspectRatio
            : '16:9',
        });
      }
      throw new Error('Sora requires a prompt');
    case 'runway':
      if (request.type === 'text-to-video' && request.prompt) {
        return generateRunwayVideoInternal('text', request.prompt, {
          duration: request.duration,
        });
      } else if (request.type === 'image-to-video' && request.inputImageUrl) {
        return generateRunwayVideoInternal('image', request.inputImageUrl, {
          duration: request.duration,
        });
      }
      throw new Error('Runway requires a prompt (text-to-video) or inputImageUrl (image-to-video)');
    default:
      throw new Error(`Unsupported video provider: ${request.provider}`);
  }
}

/**
 * Get video generation status
 */
export async function getVideoStatus(
  videoId: string,
  provider?: VideoProvider
): Promise<VideoGenerationResponse> {
  // NOTE: logVideoInterest removed — polling calls this every 5s per scene,
  // writing to Firestore on each poll was wasteful and slowed down status checks.

  // Determine provider from videoId or use provided provider
  let detectedProvider = provider;

  // Try each provider if not specified
  if (!detectedProvider) {
    // Try HeyGen first
    if (await getVideoProviderKey('heygen')) {
      detectedProvider = 'heygen';
    } else if (await getVideoProviderKey('sora')) {
      detectedProvider = 'sora';
    } else if (await getVideoProviderKey('runway')) {
      detectedProvider = 'runway';
    }
  }

  if (!detectedProvider || !(await isProviderConfigured(detectedProvider))) {
    throw new Error(`No video provider configured for status check. Add API keys in Settings > API Keys.`);
  }

  try {
    switch (detectedProvider) {
      case 'heygen': {
        const apiKey = await getVideoProviderKey('heygen');
        if (!apiKey) {
          throw new Error('HeyGen API key not configured. Add it in Settings > API Keys.');
        }

        const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
          method: 'GET',
          headers: {
            'X-Api-Key': apiKey,
          },
        });

        if (!response.ok) {
          throw new Error(`HeyGen API error: ${response.status}`);
        }

        // HeyGen v1 status wraps response: { data: { status, video_url, error: { detail, message }, ... } }
        const raw = await response.json() as {
          data?: {
            status?: string;
            video_url?: string;
            thumbnail_url?: string;
            duration?: number;
            error_message?: string;
            error?: { detail?: string; message?: string; code?: string } | null;
          };
          status?: string;
          video_url?: string;
          thumbnail_url?: string;
          duration?: number;
          error_message?: string;
          error?: { detail?: string; message?: string; code?: string } | null;
        };
        const statusData = raw.data ?? raw;

        // Extract error message — HeyGen uses nested error object OR flat error_message
        const heygenError = statusData.error?.detail
          ?? statusData.error?.message
          ?? statusData.error_message
          ?? undefined;

        const statusMap: Record<string, VideoStatus> = {
          'pending': 'pending',
          'processing': 'processing',
          'completed': 'completed',
          'failed': 'failed',
        };

        return {
          id: videoId,
          requestId: videoId,
          status: statusMap[statusData.status ?? ''] ?? 'processing',
          provider: 'heygen',
          videoUrl: statusData.video_url,
          thumbnailUrl: statusData.thumbnail_url,
          duration: statusData.duration,
          errorMessage: heygenError,
          createdAt: new Date(),
        };
      }

      case 'sora': {
        const apiKey = await getVideoProviderKey('sora');
        if (!apiKey) {
          throw new Error('OpenAI API key not configured. Add it in Settings > API Keys.');
        }

        const response = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Sora API error: ${response.status}`);
        }

        const data = await response.json() as {
          id: string;
          status: string; // queued | in_progress | completed | failed
          progress: number;
          expires_at?: number;
          error?: { message: string } | null;
        };

        // Sora statuses: queued, in_progress, completed, failed
        const statusMap: Record<string, VideoStatus> = {
          'queued': 'pending',
          'in_progress': 'processing',
          'completed': 'completed',
          'failed': 'failed',
        };

        // When completed, the video is available at /content sub-endpoint (not a URL in the response)
        let soraVideoUrl: string | undefined;
        if (data.status === 'completed') {
          // The download URL is the /content endpoint itself — the client or storage service
          // fetches the binary from this URL with the auth header
          soraVideoUrl = `https://api.openai.com/v1/videos/${videoId}/content`;
        }

        return {
          id: videoId,
          requestId: videoId,
          status: statusMap[data.status] ?? 'processing',
          provider: 'sora',
          progress: data.progress,
          videoUrl: soraVideoUrl,
          errorMessage: data.error?.message,
          createdAt: new Date(),
        };
      }

      case 'runway': {
        const apiKey = await getVideoProviderKey('runway');
        if (!apiKey) {
          throw new Error('Runway API key not configured. Add it in Settings > API Keys.');
        }

        const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${videoId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'X-Runway-Version': '2024-11-06',
          },
        });

        if (!response.ok) {
          throw new Error(`Runway API error: ${response.status}`);
        }

        const data = await response.json() as {
          id: string;
          status: string;
          output?: string[];
          failure?: string;
        };

        // Map Runway task status values to our VideoStatus
        const statusMap: Record<string, VideoStatus> = {
          'PENDING': 'pending',
          'THROTTLED': 'pending',
          'RUNNING': 'processing',
          'SUCCEEDED': 'completed',
          'FAILED': 'failed',
        };

        return {
          id: videoId,
          requestId: videoId,
          status: statusMap[data.status] ?? 'processing',
          provider: 'runway',
          videoUrl: data.output?.[0],
          errorMessage: data.failure,
          createdAt: new Date(),
        };
      }

      default:
        throw new Error(`Unsupported video provider: ${detectedProvider}`);
    }
  } catch (error) {
    logger.error('Failed to get video status', error as Error, {
      videoId,
      provider: detectedProvider,
      file: 'video-service.ts',
    });
    throw error;
  }
}

/**
 * Cancel video generation
 * Currently not supported by any provider — throws an error.
 */
export function cancelVideoGeneration(
  _videoId: string
): never {
  throw new Error('Video cancellation is not currently supported by the configured providers.');
}

// ============================================================================
// HeyGen Integration (Stubs)
// ============================================================================

/**
 * List available HeyGen avatars
 */
export async function listHeyGenAvatars(): Promise<{ avatars: HeyGenAvatar[] }> {
  await logVideoInterest('list_heygen_avatars');

  const apiKey = await getVideoProviderKey('heygen');
  if (!apiKey) {
    throw new Error('HeyGen API key is not configured. Add it in Settings → API Keys.');
  }

  const response = await fetch('https://api.heygen.com/v2/avatars', {
    method: 'GET',
    headers: {
      'X-Api-Key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`HeyGen API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    data?: {
      avatars?: Array<{
        avatar_id: string;
        avatar_name: string;
        preview_image_url?: string;
        preview_video_url?: string;
        gender?: string;
        is_premium?: boolean;
      }>;
    };
  };

  const avatars: HeyGenAvatar[] = (data.data?.avatars ?? []).map((avatar) => ({
    id: avatar.avatar_id,
    name: avatar.avatar_name,
    thumbnailUrl: avatar.preview_image_url ?? '',
    previewVideoUrl: avatar.preview_video_url,
    gender: avatar.gender as 'male' | 'female' | 'neutral' | undefined,
    isPremium: avatar.is_premium,
  }));

  return { avatars };
}

/**
 * List custom talking photo avatars from HeyGen.
 * These are the avatars created via the upload flow (photo → avatar).
 */
export async function listHeyGenTalkingPhotos(): Promise<HeyGenAvatar[]> {
  const apiKey = await getVideoProviderKey('heygen');
  if (!apiKey) { return []; }

  try {
    const response = await fetch('https://api.heygen.com/v1/talking_photo.list', {
      method: 'GET',
      headers: { 'X-Api-Key': apiKey },
    });

    if (!response.ok) { return []; }

    const data = await response.json() as {
      data?: {
        talking_photos?: Array<{
          talking_photo_id: string;
          talking_photo_name?: string;
          preview_image_url?: string;
          preview_video_url?: string;
        }>;
      };
    };

    return (data.data?.talking_photos ?? []).map((tp) => ({
      id: tp.talking_photo_id,
      name: tp.talking_photo_name ?? 'Custom Avatar',
      thumbnailUrl: tp.preview_image_url ?? '',
      previewVideoUrl: tp.preview_video_url,
      isCustom: true,
    }));
  } catch {
    return [];
  }
}

/**
 * Load custom avatars from Firestore `custom_avatars` collection.
 * These are avatars created via the upload flow — always available
 * regardless of HeyGen plan or API status.
 */
async function listFirestoreCustomAvatars(): Promise<HeyGenAvatar[]> {
  if (!adminDb) { return []; }

  try {
    const snap = await adminDb
      .collection(`organizations/${PLATFORM_ID}/custom_avatars`)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.id as string,
        name: (data.name as string) ?? 'Custom Avatar',
        thumbnailUrl: (data.thumbnailUrl as string) ?? '',
        isCustom: true,
        assignedVoiceId: (data.assignedVoiceId as string) ?? undefined,
        assignedVoiceName: (data.assignedVoiceName as string) ?? undefined,
      };
    });
  } catch (err) {
    logger.warn('Failed to load Firestore custom avatars', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Delete a custom avatar from Firestore.
 * Also removes the associated avatar_photos doc if one exists.
 */
export async function deleteCustomAvatar(avatarId: string): Promise<void> {
  if (!adminDb) {
    throw new Error('Database not available');
  }

  const docRef = adminDb
    .collection(`organizations/${PLATFORM_ID}/custom_avatars`)
    .doc(avatarId);

  const doc = await docRef.get();
  if (!doc.exists) {
    throw new Error('Avatar not found');
  }

  await docRef.delete();

  logger.info('Custom avatar deleted from Firestore', { avatarId });
}

/**
 * List ALL avatars — custom avatars (Firestore + HeyGen talking photos) + stock.
 * Custom avatars appear first, deduped by ID.
 */
export async function listAllAvatars(): Promise<{ avatars: HeyGenAvatar[] }> {
  const [stockResult, heygenCustom, firestoreCustom] = await Promise.all([
    listHeyGenAvatars(),
    listHeyGenTalkingPhotos(),
    listFirestoreCustomAvatars(),
  ]);

  // Merge custom avatars (Firestore takes priority, then HeyGen talking photos)
  const seenIds = new Set<string>();
  const customAvatars: HeyGenAvatar[] = [];

  for (const avatar of [...firestoreCustom, ...heygenCustom]) {
    if (!seenIds.has(avatar.id)) {
      seenIds.add(avatar.id);
      customAvatars.push(avatar);
    }
  }

  // Custom first, then stock
  return { avatars: [...customAvatars, ...stockResult.avatars] };
}

/**
 * List available HeyGen voices
 */
export async function listHeyGenVoices(
  language?: string
): Promise<{ voices: HeyGenVoice[] }> {
  await logVideoInterest('list_heygen_voices');

  const apiKey = await getVideoProviderKey('heygen');
  if (!apiKey) {
    throw new Error('HeyGen API key is not configured. Add it in Settings → API Keys.');
  }

  const url = language
    ? `https://api.heygen.com/v2/voices?language=${encodeURIComponent(language)}`
    : 'https://api.heygen.com/v2/voices';

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Api-Key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`HeyGen API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    data?: {
      voices?: Array<{
        voice_id: string;
        name?: string;
        voice_name?: string;
        language: string;
        accent?: string;
        gender?: string;
        preview_audio_url?: string;
        preview_audio?: string;
        preview_url?: string;
        audio_sample_url?: string;
        is_premium?: boolean;
      }>;
    };
  };

  const voices: HeyGenVoice[] = (data.data?.voices ?? []).map((voice) => ({
    id: voice.voice_id,
    name: voice.name ?? voice.voice_name ?? voice.voice_id,
    language: voice.language,
    accent: voice.accent,
    gender: voice.gender as 'male' | 'female' | 'neutral' | undefined,
    previewUrl: voice.preview_audio_url ?? voice.preview_audio ?? voice.preview_url ?? voice.audio_sample_url,
    isPremium: voice.is_premium,
  }));

  return { voices };
}

/**
 * Internal HeyGen video generation
 */
export async function generateHeyGenVideoInternal(
  script: string,
  avatarId: string,
  options?: {
    voiceId?: string;
    backgroundColor?: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
  }
): Promise<VideoGenerationResponse> {
  const apiKey = await getVideoProviderKey('heygen');
  if (!apiKey) {
    throw new Error('HeyGen API key not configured. Add it in Settings > API Keys.');
  }

  try {
    const response = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_inputs: [{
          character: {
            type: 'avatar',
            avatar_id: avatarId,
          },
          voice: {
            type: 'text',
            input_text: script,
            voice_id: options?.voiceId,
          },
          background: options?.backgroundColor ? {
            type: 'color',
            value: options.backgroundColor,
          } : undefined,
        }],
        dimension: options?.aspectRatio === '9:16'
          ? { width: 1080, height: 1920 }
          : options?.aspectRatio === '1:1'
            ? { width: 1080, height: 1080 }
            : { width: 1920, height: 1080 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
    }

    // HeyGen v2 wraps response: { data: { video_id: "..." } }
    const raw = await response.json() as {
      data?: { video_id?: string };
      video_id?: string;
    };
    const videoId = raw.data?.video_id ?? raw.video_id;

    if (!videoId) {
      throw new Error(`HeyGen API returned no video_id. Response: ${JSON.stringify(raw).slice(0, 500)}`);
    }

    logger.info('HeyGen video generation started', {
      videoId,
      file: 'video-service.ts',
    });

    return {
      id: videoId,
      requestId: videoId,
      status: 'processing',
      provider: 'heygen',
      createdAt: new Date(),
    };
  } catch (error) {
    logger.error('Failed to generate HeyGen video', error as Error, {
      file: 'video-service.ts',
    });
    throw error;
  }
}

/**
 * Generate a HeyGen scene video with screenshot background
 * Specialized for pipeline scene-based generation
 */
export async function generateHeyGenSceneVideo(
  script: string,
  avatarId: string,
  voiceId: string,
  backgroundImageUrl: string | null,
  aspectRatio: '16:9' | '9:16' | '1:1',
  audioUrl?: string | null,
): Promise<VideoGenerationResponse> {
  const apiKey = await getVideoProviderKey('heygen');
  if (!apiKey) {
    throw new Error('HeyGen API key not configured. Add it in Settings > API Keys.');
  }

  try {
    const background = backgroundImageUrl
      ? { type: 'image' as const, url: backgroundImageUrl }
      : { type: 'color' as const, value: '#1a1a2e' };

    // Use external audio if provided (ElevenLabs), otherwise HeyGen's built-in TTS
    const voice = audioUrl
      ? { type: 'audio' as const, audio_url: audioUrl }
      : { type: 'text' as const, input_text: script, voice_id: voiceId };

    const response = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_inputs: [{
          character: {
            type: 'avatar',
            avatar_id: avatarId,
          },
          voice,
          background,
        }],
        dimension: aspectRatio === '9:16'
          ? { width: 1080, height: 1920 }
          : aspectRatio === '1:1'
            ? { width: 1080, height: 1080 }
            : { width: 1920, height: 1080 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
    }

    // HeyGen v2 wraps response: { data: { video_id: "..." } }
    const raw = await response.json() as {
      data?: { video_id?: string };
      video_id?: string;
    };
    const videoId = raw.data?.video_id ?? raw.video_id;

    if (!videoId) {
      throw new Error(`HeyGen API returned no video_id. Response: ${JSON.stringify(raw).slice(0, 500)}`);
    }

    logger.info('HeyGen scene video generation started', {
      videoId,
      file: 'video-service.ts',
    });

    return {
      id: videoId,
      requestId: videoId,
      status: 'processing',
      provider: 'heygen',
      createdAt: new Date(),
    };
  } catch (error) {
    logger.error('Failed to generate HeyGen scene video', error as Error, {
      file: 'video-service.ts',
    });
    throw error;
  }
}

/**
 * Generate HeyGen avatar video with green screen (#00FF00) background.
 * Used for compositing: the green background is chroma-keyed out
 * and the avatar is overlaid on an AI-generated background (Sora/Runway).
 */
export async function generateHeyGenGreenScreenVideo(
  script: string,
  avatarId: string,
  voiceId: string,
  aspectRatio: '16:9' | '9:16' | '1:1',
  audioUrl?: string | null,
): Promise<VideoGenerationResponse> {
  const apiKey = await getVideoProviderKey('heygen');
  if (!apiKey) {
    throw new Error('HeyGen API key not configured. Add it in Settings > API Keys.');
  }

  try {
    // Always use green color background for chroma keying
    const background = { type: 'color' as const, value: '#00FF00' };

    // Use external audio if provided (ElevenLabs), otherwise HeyGen's built-in TTS
    const voice = audioUrl
      ? { type: 'audio' as const, audio_url: audioUrl }
      : { type: 'text' as const, input_text: script, voice_id: voiceId };

    const response = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_inputs: [{
          character: {
            type: 'avatar',
            avatar_id: avatarId,
          },
          voice,
          background,
        }],
        dimension: aspectRatio === '9:16'
          ? { width: 1080, height: 1920 }
          : aspectRatio === '1:1'
            ? { width: 1080, height: 1080 }
            : { width: 1920, height: 1080 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
    }

    const raw = await response.json() as {
      data?: { video_id?: string };
      video_id?: string;
    };
    const videoId = raw.data?.video_id ?? raw.video_id;

    if (!videoId) {
      throw new Error(`HeyGen API returned no video_id. Response: ${JSON.stringify(raw).slice(0, 500)}`);
    }

    logger.info('HeyGen green screen video generation started', {
      videoId,
      file: 'video-service.ts',
    });

    return {
      id: videoId,
      requestId: videoId,
      status: 'processing',
      provider: 'heygen',
      createdAt: new Date(),
    };
  } catch (error) {
    logger.error('Failed to generate HeyGen green screen video', error as Error, {
      file: 'video-service.ts',
    });
    throw error;
  }
}

/**
 * Generate video with HeyGen avatar
 */
export async function generateHeyGenVideo(
  script: string,
  avatarId: string,
  options?: {
    voiceId?: string;
    backgroundColor?: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
  }
): Promise<VideoGenerationResponse> {
  await logVideoInterest('generate_heygen_video');

  const apiKey = await getVideoProviderKey('heygen');
  if (!apiKey) {
    throw new Error('HeyGen API key is not configured. Add it in Settings → API Keys.');
  }

  return generateHeyGenVideoInternal(script, avatarId, options);
}

// ============================================================================
// Sora Integration (Stubs)
// ============================================================================

/**
 * Map aspect ratio to Sora size format (WIDTHxHEIGHT)
 */
function soraSize(aspectRatio: '16:9' | '9:16' | '1:1'): string {
  const sizeMap: Record<string, string> = {
    '16:9': '1280x720',
    '9:16': '720x1280',
    '1:1': '480x480',
  };
  return sizeMap[aspectRatio] ?? '1280x720';
}

/**
 * Clamp duration to Sora-supported values: 4, 8, 12, or 16 seconds
 */
function soraDuration(seconds: number): string {
  const valid = [4, 8, 12, 16];
  const closest = valid.reduce((prev, curr) =>
    Math.abs(curr - seconds) < Math.abs(prev - seconds) ? curr : prev
  );
  return String(closest);
}

/**
 * Internal Sora video generation via OpenAI Videos API
 * Endpoint: POST https://api.openai.com/v1/videos (multipart/form-data)
 */
export async function generateSoraVideoInternal(
  prompt: string,
  options?: {
    duration?: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    style?: string;
  }
): Promise<VideoGenerationResponse> {
  const apiKey = await getVideoProviderKey('sora');
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Add it in Settings > API Keys.');
  }

  try {
    const size = soraSize(options?.aspectRatio ?? '16:9');
    const seconds = soraDuration(options?.duration ?? 8);

    // Sora API uses multipart/form-data
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('model', 'sora-2');
    formData.append('size', size);
    formData.append('seconds', seconds);

    const response = await fetch('https://api.openai.com/v1/videos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sora API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      id: string;
      status: string;
      model: string;
      seconds: string;
      size: string;
    };

    logger.info('Sora video generation started', {
      videoId: data.id,
      model: data.model,
      seconds: data.seconds,
      size: data.size,
      file: 'video-service.ts',
    });

    return {
      id: data.id,
      requestId: data.id,
      status: 'processing',
      provider: 'sora',
      createdAt: new Date(),
    };
  } catch (error) {
    logger.error('Failed to generate Sora video', error as Error, {
      prompt: prompt.substring(0, 100),
      file: 'video-service.ts',
    });
    throw error;
  }
}

/**
 * Generate video with OpenAI Sora.
 * Throws on missing API key or API error — no "coming soon" canned responses.
 */
export async function generateSoraVideo(
  prompt: string,
  options?: {
    duration?: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    style?: string;
  }
): Promise<VideoGenerationResponse> {
  await logVideoInterest('generate_sora_video');
  return generateSoraVideoInternal(prompt, options);
}

// ============================================================================
// Runway Integration
// ============================================================================

/**
 * Map aspect ratio to Runway's WIDTHxHEIGHT ratio format
 */
function runwayRatio(aspectRatio: '16:9' | '9:16' | '1:1'): string {
  // Runway only supports 1280:720 and 720:1280 — fall back to landscape for 1:1
  const ratioMap: Record<string, string> = {
    '16:9': '1280:720',
    '9:16': '720:1280',
    '1:1': '1280:720',
  };
  return ratioMap[aspectRatio] ?? '1280:720';
}

/**
 * Clamp duration to Runway-supported values (2-10 seconds)
 */
function runwayDuration(seconds: number): number {
  return Math.max(2, Math.min(10, Math.round(seconds)));
}

/**
 * Internal Runway video generation via Gen-4.5 API
 * Endpoint: POST https://api.dev.runwayml.com/v1/text_to_video or /v1/image_to_video
 */
export async function generateRunwayVideoInternal(
  inputType: 'text' | 'image',
  input: string,
  options?: {
    duration?: number;
    motion?: 'auto' | 'slow' | 'fast';
    ratio?: '16:9' | '9:16' | '1:1';
  }
): Promise<VideoGenerationResponse> {
  const apiKey = await getVideoProviderKey('runway');
  if (!apiKey) {
    throw new Error('Runway API key not configured. Add it in Settings > API Keys.');
  }

  try {
    const endpoint = inputType === 'text'
      ? 'https://api.dev.runwayml.com/v1/text_to_video'
      : 'https://api.dev.runwayml.com/v1/image_to_video';

    const ratio = runwayRatio(options?.ratio ?? '16:9');
    const duration = runwayDuration(options?.duration ?? 5);

    const requestBody = inputType === 'text'
      ? {
          model: 'gen4.5',
          promptText: input,
          duration,
          ratio,
        }
      : {
          model: 'gen4.5',
          promptImage: input,
          promptText: '', // Required even for image-to-video
          duration,
          ratio,
        };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Runway API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      id: string;
    };

    logger.info('Runway video generation started', {
      videoId: data.id,
      model: 'gen4.5',
      inputType,
      duration,
      ratio,
      file: 'video-service.ts',
    });

    return {
      id: data.id,
      requestId: data.id,
      status: 'processing',
      provider: 'runway',
      createdAt: new Date(),
    };
  } catch (error) {
    logger.error('Failed to generate Runway video', error as Error, {
      inputType,
      file: 'video-service.ts',
    });
    throw error;
  }
}

/**
 * Generate video with Runway.
 * Throws on missing API key or API error — no "coming soon" canned responses.
 */
export async function generateRunwayVideo(
  inputType: 'text' | 'image',
  input: string,
  options?: {
    duration?: number;
    motion?: 'auto' | 'slow' | 'fast';
    ratio?: '16:9' | '9:16' | '1:1';
  }
): Promise<VideoGenerationResponse> {
  await logVideoInterest('generate_runway_video');
  return generateRunwayVideoInternal(inputType, input, options);
}

// ============================================================================
// Templates (Stubs)
// ============================================================================

/**
 * List video templates
 */
export async function listVideoTemplates(
  category?: string
): Promise<{ templates: VideoTemplate[] }> {
  await logVideoInterest('list_templates');

  try {
    if (!adminDb) {
      logger.warn('Database not available for listing templates', { file: 'video-service.ts' });
      return { templates: [] };
    }

    let q: FirebaseFirestore.Query = adminDb.collection(`organizations/${PLATFORM_ID}/video_templates`);
    if (category) {
      q = q.where('category', '==', category);
    }

    const snapshot = await q.get();
    const templates: VideoTemplate[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const createdAtField = data.createdAt as { toDate?: () => Date } | undefined;
      const updatedAtField = data.updatedAt as { toDate?: () => Date } | undefined;
      const createdAt = createdAtField?.toDate?.() ?? new Date();
      const updatedAt = updatedAtField?.toDate?.() ?? new Date();

      return {
        ...(data as Omit<VideoTemplate, 'id' | 'createdAt' | 'updatedAt'>),
        id: docSnap.id,
        createdAt,
        updatedAt,
      } as VideoTemplate;
    });

    return { templates };
  } catch (error) {
    logger.error('Failed to list video templates', error as Error, {
      file: 'video-service.ts',
    });
    return { templates: [] };
  }
}

/**
 * Create video template
 */
export async function createVideoTemplate(
  template: Omit<VideoTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; templateId?: string; error?: string }> {
  await logVideoInterest('create_template');

  try {
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    const docRef = await adminDb.collection(`organizations/${PLATFORM_ID}/video_templates`).add({
      ...template,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Video template created', {
      templateId: docRef.id,
      file: 'video-service.ts',
    });

    return { success: true, templateId: docRef.id };
  } catch (error) {
    logger.error('Failed to create video template', error as Error, {
      file: 'video-service.ts',
    });
    return { success: false, error: 'Failed to create template' };
  }
}

// ============================================================================
// Projects (Stubs)
// ============================================================================

/**
 * List video projects
 */
export async function listVideoProjects(
  userId?: string
): Promise<{ projects: VideoProject[] }> {
  await logVideoInterest('list_projects');

  try {
    if (!adminDb) {
      logger.warn('Database not available for listing projects', { file: 'video-service.ts' });
      return { projects: [] };
    }

    let q: FirebaseFirestore.Query = adminDb.collection(`organizations/${PLATFORM_ID}/video_projects`);
    if (userId) {
      q = q.where('userId', '==', userId);
    }

    const snapshot = await q.get();
    const projects: VideoProject[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const createdAtField = data.createdAt as { toDate?: () => Date } | undefined;
      const updatedAtField = data.updatedAt as { toDate?: () => Date } | undefined;
      const createdAt = createdAtField?.toDate?.() ?? new Date();
      const updatedAt = updatedAtField?.toDate?.() ?? new Date();

      return {
        ...(data as Omit<VideoProject, 'id' | 'createdAt' | 'updatedAt'>),
        id: docSnap.id,
        createdAt,
        updatedAt,
      } as VideoProject;
    });

    return { projects };
  } catch (error) {
    logger.error('Failed to list video projects', error as Error, {
      file: 'video-service.ts',
    });
    return { projects: [] };
  }
}

/**
 * Create video project
 */
export async function createVideoProject(
  project: Omit<VideoProject, 'id' | 'createdAt' | 'updatedAt' | 'videos'>
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  await logVideoInterest('create_project');

  try {
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    const docRef = await adminDb.collection(`organizations/${PLATFORM_ID}/video_projects`).add({
      ...project,
      videos: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Video project created', {
      projectId: docRef.id,
      file: 'video-service.ts',
    });

    return { success: true, projectId: docRef.id };
  } catch (error) {
    logger.error('Failed to create video project', error as Error, {
      file: 'video-service.ts',
    });
    return { success: false, error: 'Failed to create project' };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if video service is available
 */
export function isVideoServiceAvailable(): boolean {
  return VIDEO_SERVICE_STATUS.isAvailable;
}

/**
 * Get video service status message
 */
export function getVideoServiceStatus(): typeof VIDEO_SERVICE_STATUS {
  return VIDEO_SERVICE_STATUS;
}

/**
 * Validate video provider API key is configured
 */
export async function isProviderConfigured(
  provider: VideoProvider
): Promise<boolean> {
  const key = await getVideoProviderKey(provider);
  return key !== null;
}

/**
 * Estimate video generation cost
 */
export function estimateVideoCost(
  provider: VideoProvider,
  durationSeconds: number,
  options?: { resolution?: string; features?: string[] }
): { credits: number; estimatedUSD: number } {
  let costPerSecond = 0;
  let creditsPerSecond = 0;

  switch (provider) {
    case 'heygen':
      // HeyGen: ~$0.01/second for avatars, ~30 credits per minute
      costPerSecond = 0.01;
      creditsPerSecond = 0.5; // 30 credits/60 seconds
      break;
    case 'sora':
      // Sora: ~$0.015/second
      costPerSecond = 0.015;
      creditsPerSecond = 0.015 * 100; // Convert to credits (1 credit = $0.01)
      break;
    case 'runway':
      // Runway: ~$0.05/second for Gen-3
      costPerSecond = 0.05;
      creditsPerSecond = 0.05 * 100; // Convert to credits
      break;
  }

  // Apply resolution multiplier if specified
  if (options?.resolution === '4k') {
    costPerSecond *= 2;
    creditsPerSecond *= 2;
  }

  const estimatedUSD = costPerSecond * durationSeconds;
  const credits = creditsPerSecond * durationSeconds;

  return {
    credits: Math.ceil(credits),
    estimatedUSD: Number(estimatedUSD.toFixed(2)),
  };
}

// ============================================================================
// Custom Avatar Creation (HeyGen Instant Avatar)
// ============================================================================

interface InstantAvatarResponse {
  avatarId: string;
  status: 'pending' | 'training' | 'processing' | 'completed' | 'failed';
}

/**
 * Create a HeyGen Photo Avatar using the correct 3-step flow:
 *   1. Upload image binary to upload.heygen.com/v1/asset → get image_key
 *   2. Create avatar group at /v2/photo_avatar/avatar_group/create → get group_id
 *   3. The group_id is the avatar ID (appears in talking_photo.list immediately)
 */
export async function createInstantAvatar(
  imageInput: { base64: string; contentType: string } | { url: string },
  avatarName: string,
): Promise<InstantAvatarResponse> {
  const apiKey = await getVideoProviderKey('heygen');
  if (!apiKey) {
    throw new Error('HeyGen API key not configured. Add it in Settings > API Keys.');
  }

  // Resolve image to a Buffer + contentType
  let imageBuffer: Buffer;
  let contentType: string;

  if ('base64' in imageInput) {
    imageBuffer = Buffer.from(imageInput.base64, 'base64');
    contentType = imageInput.contentType;
  } else {
    const imageResponse = await fetch(imageInput.url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download avatar image from URL: ${imageResponse.status}`);
    }
    const arrayBuf = await imageResponse.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuf);
    contentType = imageResponse.headers.get('content-type') ?? 'image/png';
  }

  // Step 1: Upload image to HeyGen's asset endpoint
  logger.info('HeyGen avatar Step 1: Uploading image asset', {
    size: imageBuffer.length,
    contentType,
    file: 'video-service.ts',
  });

  const uploadRes = await fetch('https://upload.heygen.com/v1/asset', {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': contentType,
    },
    body: new Uint8Array(imageBuffer),
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`HeyGen asset upload failed: ${uploadRes.status} - ${errorText}`);
  }

  const uploadData = await uploadRes.json() as {
    data?: { image_key?: string; asset_id?: string; id?: string };
  };
  const imageKey = uploadData.data?.image_key ?? uploadData.data?.asset_id ?? uploadData.data?.id;

  if (!imageKey) {
    throw new Error(`HeyGen asset upload returned no image_key. Response: ${JSON.stringify(uploadData).slice(0, 300)}`);
  }

  logger.info('HeyGen avatar Step 1 complete: got image_key', {
    imageKey,
    file: 'video-service.ts',
  });

  // Step 2: Create avatar group
  const groupRes = await fetch('https://api.heygen.com/v2/photo_avatar/avatar_group/create', {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ name: avatarName, image_key: imageKey }),
  });

  if (!groupRes.ok) {
    const errorText = await groupRes.text();
    throw new Error(`HeyGen avatar group creation failed: ${groupRes.status} - ${errorText}`);
  }

  const groupData = await groupRes.json() as {
    data?: { group_id?: string; id?: string };
  };
  const groupId = groupData.data?.group_id ?? groupData.data?.id;

  if (!groupId) {
    throw new Error(`HeyGen avatar group returned no group_id. Response: ${JSON.stringify(groupData).slice(0, 300)}`);
  }

  logger.info('HeyGen avatar Step 2 complete: got group_id', {
    groupId,
    file: 'video-service.ts',
  });

  // Step 3: Train the avatar (required before it can be used in video generation)
  logger.info('HeyGen avatar Step 3: Training avatar...', {
    groupId,
    file: 'video-service.ts',
  });

  const trainRes = await fetch('https://api.heygen.com/v2/photo_avatar/train', {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ group_id: groupId }),
  });

  if (!trainRes.ok) {
    const errorText = await trainRes.text();
    logger.warn('HeyGen avatar training request failed — avatar may not be usable', {
      status: trainRes.status,
      error: errorText.slice(0, 300),
      file: 'video-service.ts',
    });
  } else {
    logger.info('HeyGen avatar training started', {
      groupId,
      file: 'video-service.ts',
    });
  }

  return {
    avatarId: groupId,
    status: trainRes.ok ? 'training' : 'pending',
  };
}

// ============================================================================
// Export Types
// ============================================================================

export type {
  VideoGenerationRequest,
  VideoGenerationResponse,
  VideoProvider,
  VideoTemplate,
  VideoProject,
  HeyGenAvatar,
  HeyGenVoice,
  VideoWaitlistEntry,
  VideoWaitlistInterest,
};
