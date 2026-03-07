/**
 * Video Defaults Service
 * Manages default avatar and voice settings stored in Firestore.
 * Used by the video pipeline and Jasper to auto-select avatar/voice.
 */

import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

export interface VideoDefaults {
  avatarId: string | null;
  avatarName: string | null;
  voiceId: string | null;
  voiceName: string | null;
  voiceProvider: 'elevenlabs' | 'unrealspeech' | 'custom' | null;
  updatedAt: Date | null;
  updatedBy: string | null;
}

const DEFAULTS_DOC_PATH = `organizations/${PLATFORM_ID}/settings/video-defaults`;

const EMPTY_DEFAULTS: VideoDefaults = {
  avatarId: null,
  avatarName: null,
  voiceId: null,
  voiceName: null,
  voiceProvider: null,
  updatedAt: null,
  updatedBy: null,
};

/**
 * Get the current default avatar and voice settings.
 */
export async function getVideoDefaults(): Promise<VideoDefaults> {
  if (!adminDb) {
    return EMPTY_DEFAULTS;
  }

  try {
    const doc = await adminDb.doc(DEFAULTS_DOC_PATH).get();
    if (!doc.exists) {
      return EMPTY_DEFAULTS;
    }

    const data = doc.data();
    return {
      avatarId: (data?.avatarId as string) ?? null,
      avatarName: (data?.avatarName as string) ?? null,
      voiceId: (data?.voiceId as string) ?? null,
      voiceName: (data?.voiceName as string) ?? null,
      voiceProvider: (data?.voiceProvider as VideoDefaults['voiceProvider']) ?? null,
      updatedAt: data?.updatedAt ? new Date(data.updatedAt as string) : null,
      updatedBy: (data?.updatedBy as string) ?? null,
    };
  } catch (error) {
    logger.error('Failed to read video defaults', error instanceof Error ? error : new Error(String(error)), {
      file: 'video-defaults-service.ts',
    });
    return EMPTY_DEFAULTS;
  }
}

/**
 * Save default avatar and voice settings.
 */
export async function setVideoDefaults(
  defaults: Partial<Omit<VideoDefaults, 'updatedAt'>>,
  userId: string,
): Promise<void> {
  if (!adminDb) {
    throw new Error('Database not available');
  }

  const update: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: userId,
  };

  if (defaults.avatarId !== undefined) { update.avatarId = defaults.avatarId; }
  if (defaults.avatarName !== undefined) { update.avatarName = defaults.avatarName; }
  if (defaults.voiceId !== undefined) { update.voiceId = defaults.voiceId; }
  if (defaults.voiceName !== undefined) { update.voiceName = defaults.voiceName; }
  if (defaults.voiceProvider !== undefined) { update.voiceProvider = defaults.voiceProvider; }

  await adminDb.doc(DEFAULTS_DOC_PATH).set(update, { merge: true });

  logger.info('Video defaults updated', {
    ...update,
    file: 'video-defaults-service.ts',
  });
}
