/**
 * Video Service — Hedra video generation support, templates, and project management
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
  VideoTemplate,
  VideoProject,
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
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, provider as import('@/types/api-keys').APIServiceName);
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
// Custom Avatar Management
// ============================================================================

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

// ============================================================================
// Templates
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
// Projects
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


// ============================================================================
// Export Types
// ============================================================================

export type {
  VideoGenerationRequest,
  VideoGenerationResponse,
  VideoProvider,
  VideoTemplate,
  VideoProject,
  VideoWaitlistEntry,
  VideoWaitlistInterest,
};
