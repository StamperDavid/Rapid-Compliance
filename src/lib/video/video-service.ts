/**
 * Video Generation Service
 * Stub service for AI Video Factory - HeyGen, Sora, Runway integrations
 *
 * Status: Coming Soon
 * This service provides placeholder functions that will be implemented
 * when the Video Factory module launches.
 */

import { collection, addDoc, serverTimestamp, getDocs, query, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { logger } from '@/lib/logger/logger';
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
// Service Status
// ============================================================================

export const VIDEO_SERVICE_STATUS = {
  isAvailable: false,
  message: 'AI Video Generation is coming soon. Join the waitlist to be notified when it launches.',
  expectedLaunch: 'Q2 2026',
} as const;

// ============================================================================
// Coming Soon Response Helper
// ============================================================================

interface ComingSoonResponse {
  success: false;
  status: 'coming_soon';
  message: string;
  expectedLaunch: string;
}

function createComingSoonResponse(feature: string): ComingSoonResponse {
  return {
    success: false,
    status: 'coming_soon',
    message: `${feature} is coming soon. Join the waitlist to be notified when it launches.`,
    expectedLaunch: VIDEO_SERVICE_STATUS.expectedLaunch,
  };
}

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
    if (!db) {
      logger.warn('Database not available for logging video interest', { file: 'video-service.ts' });
      return;
    }

    const { PLATFORM_ID } = await import('@/lib/constants/platform');
    await addDoc(collection(db, 'organizations', PLATFORM_ID, 'analytics_events'), {
      event: 'video_feature_interest',
      feature,
      userId: userId ?? null,
      metadata: metadata ?? {},
      timestamp: serverTimestamp(),
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
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    const { PLATFORM_ID } = await import('@/lib/constants/platform');
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

    const docRef = await addDoc(
      collection(db, 'organizations', PLATFORM_ID, 'video_waitlist'),
      {
        ...entry,
        createdAt: serverTimestamp(),
      }
    );

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
): Promise<VideoGenerationResponse | (ComingSoonResponse & { request?: VideoGenerationRequest })> {
  // Log interest for analytics
  await logVideoInterest(
    `generate_video_${request.provider}`,
    request.userId,
    { type: request.type }
  );

  // Check if provider is configured
  if (isProviderConfigured(request.provider)) {
    try {
      switch (request.provider) {
        case 'heygen':
          if (request.type === 'avatar' && request.script && request.avatarConfig?.avatarId) {
            return await generateHeyGenVideoInternal(
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
          break;
        case 'sora':
          if (request.prompt) {
            return await generateSoraVideoInternal(request.prompt, {
              duration: request.duration,
              aspectRatio: request.aspectRatio === '16:9' || request.aspectRatio === '9:16' || request.aspectRatio === '1:1'
                ? request.aspectRatio
                : '16:9',
            });
          }
          break;
        case 'runway':
          if (request.type === 'text-to-video' && request.prompt) {
            return await generateRunwayVideoInternal('text', request.prompt, {
              duration: request.duration,
            });
          } else if (request.type === 'image-to-video' && request.inputImageUrl) {
            return await generateRunwayVideoInternal('image', request.inputImageUrl, {
              duration: request.duration,
            });
          }
          break;
      }
    } catch (error) {
      logger.error('Error generating video with provider', error as Error, {
        provider: request.provider,
        file: 'video-service.ts',
      });
      // Fall through to coming soon response on error
    }
  }

  // Return coming soon if provider not configured or request invalid
  return {
    ...createComingSoonResponse('Video generation'),
    request,
  };
}

/**
 * Get video generation status
 */
export async function getVideoStatus(
  videoId: string,
  provider?: VideoProvider
): Promise<VideoGenerationResponse | ComingSoonResponse> {
  await logVideoInterest('get_video_status');

  // Determine provider from videoId or use provided provider
  let detectedProvider = provider;

  // Try each provider if not specified
  if (!detectedProvider) {
    // Try HeyGen first
    if (process.env.HEYGEN_API_KEY) {
      detectedProvider = 'heygen';
    } else if (process.env.OPENAI_API_KEY) {
      detectedProvider = 'sora';
    } else if (process.env.RUNWAY_API_KEY) {
      detectedProvider = 'runway';
    }
  }

  if (!detectedProvider || !isProviderConfigured(detectedProvider)) {
    return createComingSoonResponse('Video status tracking');
  }

  try {
    switch (detectedProvider) {
      case 'heygen': {
        const apiKey = process.env.HEYGEN_API_KEY;
        if (!apiKey) {
          throw new Error('HeyGen API key not configured');
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

        const data = await response.json() as {
          status: string;
          video_url?: string;
          thumbnail_url?: string;
          duration?: number;
          error_message?: string;
        };

        const statusMap: Record<string, VideoStatus> = {
          'pending': 'pending',
          'processing': 'processing',
          'completed': 'completed',
          'failed': 'failed',
        };

        return {
          id: videoId,
          requestId: videoId,
          status: statusMap[data.status] ?? 'processing',
          provider: 'heygen',
          videoUrl: data.video_url,
          thumbnailUrl: data.thumbnail_url,
          duration: data.duration,
          errorMessage: data.error_message,
          createdAt: new Date(),
        };
      }

      case 'sora': {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error('OpenAI API key not configured');
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
          status: string;
          video_url?: string;
          error?: { message: string };
        };

        const statusMap: Record<string, VideoStatus> = {
          'pending': 'pending',
          'processing': 'processing',
          'completed': 'completed',
          'failed': 'failed',
        };

        return {
          id: videoId,
          requestId: videoId,
          status: statusMap[data.status] ?? 'processing',
          provider: 'sora',
          videoUrl: data.video_url,
          errorMessage: data.error?.message,
          createdAt: new Date(),
        };
      }

      case 'runway': {
        const apiKey = process.env.RUNWAY_API_KEY;
        if (!apiKey) {
          throw new Error('Runway API key not configured');
        }

        const response = await fetch(`https://api.runwayml.com/v1/generations/${videoId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Runway API error: ${response.status}`);
        }

        const data = await response.json() as {
          id: string;
          status: string;
          output_url?: string;
          error?: string;
        };

        const statusMap: Record<string, VideoStatus> = {
          'pending': 'pending',
          'processing': 'processing',
          'completed': 'completed',
          'failed': 'failed',
        };

        return {
          id: videoId,
          requestId: videoId,
          status: statusMap[data.status] ?? 'processing',
          provider: 'runway',
          videoUrl: data.output_url,
          errorMessage: data.error,
          createdAt: new Date(),
        };
      }

      default:
        return createComingSoonResponse('Video status tracking');
    }
  } catch (error) {
    logger.error('Failed to get video status', error as Error, {
      videoId,
      provider: detectedProvider,
      file: 'video-service.ts',
    });
    return createComingSoonResponse('Video status tracking');
  }
}

/**
 * Cancel video generation
 * @stub Returns coming soon response
 */
export async function cancelVideoGeneration(
  _videoId: string
): Promise<ComingSoonResponse> {
  await logVideoInterest('cancel_video');
  return createComingSoonResponse('Video cancellation');
}

// ============================================================================
// HeyGen Integration (Stubs)
// ============================================================================

/**
 * List available HeyGen avatars
 */
export async function listHeyGenAvatars(): Promise<(ComingSoonResponse & { avatars?: HeyGenAvatar[] }) | { avatars: HeyGenAvatar[] }> {
  await logVideoInterest('list_heygen_avatars');

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return {
      ...createComingSoonResponse('HeyGen avatar library'),
      avatars: [],
    };
  }

  try {
    const response = await fetch('https://api.heygen.com/v2/avatars', {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`HeyGen API error: ${response.status}`);
    }

    const data = await response.json() as {
      avatars?: Array<{
        avatar_id: string;
        avatar_name: string;
        preview_image_url?: string;
        preview_video_url?: string;
        gender?: string;
        is_premium?: boolean;
      }>;
    };

    const avatars: HeyGenAvatar[] = (data.avatars ?? []).map((avatar) => ({
      id: avatar.avatar_id,
      name: avatar.avatar_name,
      thumbnailUrl: avatar.preview_image_url ?? '',
      previewVideoUrl: avatar.preview_video_url,
      gender: avatar.gender as 'male' | 'female' | 'neutral' | undefined,
      isPremium: avatar.is_premium,
    }));

    return { avatars };
  } catch (error) {
    logger.error('Failed to list HeyGen avatars', error as Error, {
      file: 'video-service.ts',
    });
    return {
      ...createComingSoonResponse('HeyGen avatar library'),
      avatars: [],
    };
  }
}

/**
 * List available HeyGen voices
 */
export async function listHeyGenVoices(
  language?: string
): Promise<(ComingSoonResponse & { voices?: HeyGenVoice[] }) | { voices: HeyGenVoice[] }> {
  await logVideoInterest('list_heygen_voices');

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return {
      ...createComingSoonResponse('HeyGen voice library'),
      voices: [],
    };
  }

  try {
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
      throw new Error(`HeyGen API error: ${response.status}`);
    }

    const data = await response.json() as {
      voices?: Array<{
        voice_id: string;
        voice_name: string;
        language: string;
        accent?: string;
        gender?: string;
        preview_audio_url?: string;
        is_premium?: boolean;
      }>;
    };

    const voices: HeyGenVoice[] = (data.voices ?? []).map((voice) => ({
      id: voice.voice_id,
      name: voice.voice_name,
      language: voice.language,
      accent: voice.accent,
      gender: voice.gender as 'male' | 'female' | 'neutral' | undefined,
      previewUrl: voice.preview_audio_url,
      isPremium: voice.is_premium,
    }));

    return { voices };
  } catch (error) {
    logger.error('Failed to list HeyGen voices', error as Error, {
      file: 'video-service.ts',
    });
    return {
      ...createComingSoonResponse('HeyGen voice library'),
      voices: [],
    };
  }
}

/**
 * Internal HeyGen video generation
 */
async function generateHeyGenVideoInternal(
  script: string,
  avatarId: string,
  options?: {
    voiceId?: string;
    backgroundColor?: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
  }
): Promise<VideoGenerationResponse> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    throw new Error('HeyGen API key not configured');
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

    const data = await response.json() as {
      video_id: string;
      status?: string;
    };

    logger.info('HeyGen video generation started', {
      videoId: data.video_id,
      file: 'video-service.ts',
    });

    return {
      id: data.video_id,
      requestId: data.video_id,
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
): Promise<VideoGenerationResponse | ComingSoonResponse> {
  await logVideoInterest('generate_heygen_video');

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return createComingSoonResponse('HeyGen video generation');
  }

  try {
    return await generateHeyGenVideoInternal(script, avatarId, options);
  } catch (error) {
    logger.error('Error in generateHeyGenVideo', error as Error, {
      file: 'video-service.ts',
    });
    return createComingSoonResponse('HeyGen video generation');
  }
}

// ============================================================================
// Sora Integration (Stubs)
// ============================================================================

/**
 * Internal Sora video generation
 */
async function generateSoraVideoInternal(
  prompt: string,
  options?: {
    duration?: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    style?: string;
  }
): Promise<VideoGenerationResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/videos/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sora',
        prompt,
        duration: options?.duration ?? 5,
        aspect_ratio: options?.aspectRatio ?? '16:9',
        style: options?.style,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sora API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      id: string;
      status?: string;
    };

    logger.info('Sora video generation started', {
      videoId: data.id,
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
      file: 'video-service.ts',
    });
    throw error;
  }
}

/**
 * Generate video with OpenAI Sora
 */
export async function generateSoraVideo(
  prompt: string,
  options?: {
    duration?: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    style?: string;
  }
): Promise<VideoGenerationResponse | ComingSoonResponse> {
  await logVideoInterest('generate_sora_video');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return createComingSoonResponse('Sora text-to-video generation');
  }

  try {
    return await generateSoraVideoInternal(prompt, options);
  } catch (error) {
    logger.error('Error in generateSoraVideo', error as Error, {
      file: 'video-service.ts',
    });
    return createComingSoonResponse('Sora text-to-video generation');
  }
}

// ============================================================================
// Runway Integration (Stubs)
// ============================================================================

/**
 * Internal Runway video generation
 */
async function generateRunwayVideoInternal(
  inputType: 'text' | 'image',
  input: string,
  options?: {
    duration?: number;
    motion?: 'auto' | 'slow' | 'fast';
  }
): Promise<VideoGenerationResponse> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) {
    throw new Error('Runway API key not configured');
  }

  try {
    const requestBody = inputType === 'text'
      ? {
          model: 'gen3',
          prompt: input,
          duration: options?.duration ?? 5,
        }
      : {
          model: 'gen3',
          image_url: input,
          duration: options?.duration ?? 5,
          motion: options?.motion ?? 'auto',
        };

    const response = await fetch('https://api.runwayml.com/v1/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Runway API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      id: string;
      status?: string;
    };

    logger.info('Runway video generation started', {
      videoId: data.id,
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
      file: 'video-service.ts',
    });
    throw error;
  }
}

/**
 * Generate video with Runway
 */
export async function generateRunwayVideo(
  inputType: 'text' | 'image',
  input: string,
  options?: {
    duration?: number;
    motion?: 'auto' | 'slow' | 'fast';
  }
): Promise<VideoGenerationResponse | ComingSoonResponse> {
  await logVideoInterest('generate_runway_video');

  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) {
    return createComingSoonResponse('Runway video generation');
  }

  try {
    return await generateRunwayVideoInternal(inputType, input, options);
  } catch (error) {
    logger.error('Error in generateRunwayVideo', error as Error, {
      file: 'video-service.ts',
    });
    return createComingSoonResponse('Runway video generation');
  }
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
    if (!db) {
      logger.warn('Database not available for listing templates', { file: 'video-service.ts' });
      return { templates: [] };
    }

    const { PLATFORM_ID } = await import('@/lib/constants/platform');
    const templatesRef = collection(db, 'organizations', PLATFORM_ID, 'video_templates');

    let q = query(templatesRef);
    if (category) {
      const { where } = await import('firebase/firestore');
      q = query(templatesRef, where('category', '==', category));
    }

    const snapshot = await getDocs(q);
    const templates: VideoTemplate[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date();
      const updatedAt = data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : new Date();

      return {
        id: doc.id,
        ...data,
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
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    const { PLATFORM_ID } = await import('@/lib/constants/platform');
    const templatesRef = collection(db, 'organizations', PLATFORM_ID, 'video_templates');

    const docRef = await addDoc(templatesRef, {
      ...template,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
    if (!db) {
      logger.warn('Database not available for listing projects', { file: 'video-service.ts' });
      return { projects: [] };
    }

    const { PLATFORM_ID } = await import('@/lib/constants/platform');
    const projectsRef = collection(db, 'organizations', PLATFORM_ID, 'video_projects');

    let q = query(projectsRef);
    if (userId) {
      const { where } = await import('firebase/firestore');
      q = query(projectsRef, where('userId', '==', userId));
    }

    const snapshot = await getDocs(q);
    const projects: VideoProject[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date();
      const updatedAt = data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : new Date();

      return {
        id: doc.id,
        ...data,
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
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    const { PLATFORM_ID } = await import('@/lib/constants/platform');
    const projectsRef = collection(db, 'organizations', PLATFORM_ID, 'video_projects');

    const docRef = await addDoc(projectsRef, {
      ...project,
      videos: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
export function isProviderConfigured(
  provider: VideoProvider
): boolean {
  switch (provider) {
    case 'heygen':
      return !!process.env.HEYGEN_API_KEY;
    case 'sora':
      return !!process.env.OPENAI_API_KEY;
    case 'runway':
      return !!process.env.RUNWAY_API_KEY;
    default:
      return false;
  }
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
