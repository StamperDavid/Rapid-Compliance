/**
 * Avatar Profile Service
 * Firestore CRUD for multi-angle reference images and metadata
 * used by Kling's character consistency feature and other avatar providers.
 *
 * Collection path: organizations/{PLATFORM_ID}/avatar_profiles/{profileId}
 *
 * Uses Admin SDK for server-side operations (API routes, Jasper tools).
 */

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface AvatarProfile {
  id: string;
  userId: string;
  name: string; // e.g., "David - Professional"

  // Reference images for character consistency
  frontalImageUrl: string; // Primary face photo (required)
  additionalImageUrls: string[]; // Side angles, full body, etc. (up to 4)
  fullBodyImageUrl: string | null; // Full body reference
  upperBodyImageUrl: string | null; // Upper body reference

  // Voice identity
  voiceId: string | null; // ElevenLabs voice clone ID
  voiceProvider: 'elevenlabs' | 'heygen' | 'unrealspeech' | 'custom' | null;

  // Avatar provider IDs (linked external avatars)
  heygenAvatarId: string | null; // HeyGen Digital Twin ID (if created)

  // Metadata
  description: string | null; // "Professional look, navy suit"
  isDefault: boolean; // Auto-select this profile
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

type VoiceProvider = 'elevenlabs' | 'heygen' | 'unrealspeech' | 'custom';

export interface CreateAvatarProfileData {
  name: string;
  frontalImageUrl: string;
  additionalImageUrls?: string[];
  fullBodyImageUrl?: string | null;
  upperBodyImageUrl?: string | null;
  voiceId?: string | null;
  voiceProvider?: VoiceProvider | null;
  heygenAvatarId?: string | null;
  description?: string | null;
  isDefault?: boolean;
}

export interface UpdateAvatarProfileData {
  name?: string;
  frontalImageUrl?: string;
  additionalImageUrls?: string[];
  fullBodyImageUrl?: string | null;
  upperBodyImageUrl?: string | null;
  voiceId?: string | null;
  voiceProvider?: VoiceProvider | null;
  heygenAvatarId?: string | null;
  description?: string | null;
  isDefault?: boolean;
}

// ============================================================================
// Firestore Document Shape
// ============================================================================

interface FirestoreAvatarProfileDoc {
  userId: string;
  name: string;
  frontalImageUrl: string;
  additionalImageUrls: string[];
  fullBodyImageUrl: string | null;
  upperBodyImageUrl: string | null;
  voiceId: string | null;
  voiceProvider: VoiceProvider | null;
  heygenAvatarId: string | null;
  description: string | null;
  isDefault: boolean;
  createdAt: FirebaseFirestore.Timestamp | null;
  updatedAt: FirebaseFirestore.Timestamp | null;
}

// ============================================================================
// Constants
// ============================================================================

const COLLECTION_PATH = `organizations/${PLATFORM_ID}/avatar_profiles`;
const MAX_ADDITIONAL_IMAGES = 4;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Firestore Timestamp to ISO string
 */
function timestampToISO(timestamp: unknown): string {
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

/**
 * Map a Firestore doc snapshot to an AvatarProfile
 */
function docToProfile(id: string, raw: FirebaseFirestore.DocumentData): AvatarProfile {
  const data = raw as FirestoreAvatarProfileDoc;
  return {
    id,
    userId: data.userId ?? '',
    name: data.name ?? '',
    frontalImageUrl: data.frontalImageUrl ?? '',
    additionalImageUrls: data.additionalImageUrls ?? [],
    fullBodyImageUrl: data.fullBodyImageUrl ?? null,
    upperBodyImageUrl: data.upperBodyImageUrl ?? null,
    voiceId: data.voiceId ?? null,
    voiceProvider: data.voiceProvider ?? null,
    heygenAvatarId: data.heygenAvatarId ?? null,
    description: data.description ?? null,
    isDefault: data.isDefault ?? false,
    createdAt: timestampToISO(data.createdAt),
    updatedAt: timestampToISO(data.updatedAt),
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new avatar profile for a user.
 * Generates a UUID for the profile ID and stores it in Firestore.
 */
export async function createAvatarProfile(
  userId: string,
  data: CreateAvatarProfileData
): Promise<{ success: boolean; profile?: AvatarProfile; error?: string }> {
  try {
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    const profileId = crypto.randomUUID();

    const profileData = {
      userId,
      name: data.name,
      frontalImageUrl: data.frontalImageUrl,
      additionalImageUrls: (data.additionalImageUrls ?? []).slice(0, MAX_ADDITIONAL_IMAGES),
      fullBodyImageUrl: data.fullBodyImageUrl ?? null,
      upperBodyImageUrl: data.upperBodyImageUrl ?? null,
      voiceId: data.voiceId ?? null,
      voiceProvider: data.voiceProvider ?? null,
      heygenAvatarId: data.heygenAvatarId ?? null,
      description: data.description ?? null,
      isDefault: data.isDefault ?? false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection(COLLECTION_PATH).doc(profileId).set(profileData);

    // If this profile is set as default, unset all others for this user
    if (profileData.isDefault) {
      await unsetOtherDefaults(userId, profileId);
    }

    logger.info('Avatar profile created', {
      profileId,
      userId,
      name: data.name,
      file: 'avatar-profile-service.ts',
    });

    const profile: AvatarProfile = {
      id: profileId,
      userId,
      name: data.name,
      frontalImageUrl: data.frontalImageUrl,
      additionalImageUrls: profileData.additionalImageUrls,
      fullBodyImageUrl: profileData.fullBodyImageUrl,
      upperBodyImageUrl: profileData.upperBodyImageUrl,
      voiceId: profileData.voiceId,
      voiceProvider: profileData.voiceProvider,
      heygenAvatarId: profileData.heygenAvatarId,
      description: profileData.description,
      isDefault: profileData.isDefault,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { success: true, profile };
  } catch (error) {
    logger.error('Failed to create avatar profile', error as Error, {
      userId,
      file: 'avatar-profile-service.ts',
    });
    return { success: false, error: 'Failed to create avatar profile' };
  }
}

/**
 * Get a single avatar profile by its ID.
 */
export async function getAvatarProfile(profileId: string): Promise<AvatarProfile | null> {
  try {
    if (!adminDb) {
      logger.warn('Database not available for getting avatar profile', {
        file: 'avatar-profile-service.ts',
      });
      return null;
    }

    const docSnap = await adminDb.collection(COLLECTION_PATH).doc(profileId).get();

    if (!docSnap.exists) {
      logger.warn('Avatar profile not found', {
        profileId,
        file: 'avatar-profile-service.ts',
      });
      return null;
    }

    const data = docSnap.data();
    if (!data) {
      return null;
    }

    return docToProfile(docSnap.id, data);
  } catch (error) {
    logger.error('Failed to get avatar profile', error as Error, {
      profileId,
      file: 'avatar-profile-service.ts',
    });
    return null;
  }
}

/**
 * List all avatar profiles for a user, ordered by createdAt desc.
 */
export async function listAvatarProfiles(userId: string): Promise<AvatarProfile[]> {
  try {
    if (!adminDb) {
      logger.warn('Database not available for listing avatar profiles', {
        file: 'avatar-profile-service.ts',
      });
      return [];
    }

    const snapshot = await adminDb
      .collection(COLLECTION_PATH)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((docSnap) => docToProfile(docSnap.id, docSnap.data()));
  } catch (error) {
    logger.error('Failed to list avatar profiles', error as Error, {
      userId,
      file: 'avatar-profile-service.ts',
    });
    return [];
  }
}

/**
 * Partially update an avatar profile. Sets updatedAt automatically.
 */
export async function updateAvatarProfile(
  profileId: string,
  updates: UpdateAvatarProfileData
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    // Build the update object, only including defined fields
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.frontalImageUrl !== undefined) {
      updateData.frontalImageUrl = updates.frontalImageUrl;
    }
    if (updates.additionalImageUrls !== undefined) {
      updateData.additionalImageUrls = updates.additionalImageUrls.slice(0, MAX_ADDITIONAL_IMAGES);
    }
    if (updates.fullBodyImageUrl !== undefined) {
      updateData.fullBodyImageUrl = updates.fullBodyImageUrl;
    }
    if (updates.upperBodyImageUrl !== undefined) {
      updateData.upperBodyImageUrl = updates.upperBodyImageUrl;
    }
    if (updates.voiceId !== undefined) {
      updateData.voiceId = updates.voiceId;
    }
    if (updates.voiceProvider !== undefined) {
      updateData.voiceProvider = updates.voiceProvider;
    }
    if (updates.heygenAvatarId !== undefined) {
      updateData.heygenAvatarId = updates.heygenAvatarId;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }
    if (updates.isDefault !== undefined) {
      updateData.isDefault = updates.isDefault;
    }

    await adminDb.collection(COLLECTION_PATH).doc(profileId).update(updateData);

    // If isDefault was set to true, unset all other defaults for this user
    if (updates.isDefault === true) {
      const docSnap = await adminDb.collection(COLLECTION_PATH).doc(profileId).get();
      const data = docSnap.data();
      if (data) {
        const userId = (data as FirestoreAvatarProfileDoc).userId;
        await unsetOtherDefaults(userId, profileId);
      }
    }

    logger.info('Avatar profile updated', {
      profileId,
      file: 'avatar-profile-service.ts',
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to update avatar profile', error as Error, {
      profileId,
      file: 'avatar-profile-service.ts',
    });
    return { success: false, error: 'Failed to update avatar profile' };
  }
}

/**
 * Delete an avatar profile by its ID.
 */
export async function deleteAvatarProfile(profileId: string): Promise<boolean> {
  try {
    if (!adminDb) {
      return false;
    }

    await adminDb.collection(COLLECTION_PATH).doc(profileId).delete();

    logger.info('Avatar profile deleted', {
      profileId,
      file: 'avatar-profile-service.ts',
    });

    return true;
  } catch (error) {
    logger.error('Failed to delete avatar profile', error as Error, {
      profileId,
      file: 'avatar-profile-service.ts',
    });
    return false;
  }
}

/**
 * Set one profile as default for a user, unsetting all others.
 */
export async function setDefaultProfile(
  userId: string,
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    // Verify the target profile exists and belongs to this user
    const targetDoc = await adminDb.collection(COLLECTION_PATH).doc(profileId).get();
    if (!targetDoc.exists) {
      return { success: false, error: 'Profile not found' };
    }

    const targetData = targetDoc.data() as FirestoreAvatarProfileDoc | undefined;
    if (targetData?.userId !== userId) {
      return { success: false, error: 'Profile does not belong to this user' };
    }

    // Set the target profile as default
    await adminDb.collection(COLLECTION_PATH).doc(profileId).update({
      isDefault: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Unset all other defaults for this user
    await unsetOtherDefaults(userId, profileId);

    logger.info('Default avatar profile set', {
      userId,
      profileId,
      file: 'avatar-profile-service.ts',
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to set default avatar profile', error as Error, {
      userId,
      profileId,
      file: 'avatar-profile-service.ts',
    });
    return { success: false, error: 'Failed to set default profile' };
  }
}

/**
 * Get the user's default profile. Falls back to the most recently created profile.
 */
export async function getDefaultProfile(userId: string): Promise<AvatarProfile | null> {
  try {
    if (!adminDb) {
      logger.warn('Database not available for getting default profile', {
        file: 'avatar-profile-service.ts',
      });
      return null;
    }

    // First, try to find a profile explicitly marked as default
    const defaultSnapshot = await adminDb
      .collection(COLLECTION_PATH)
      .where('userId', '==', userId)
      .where('isDefault', '==', true)
      .limit(1)
      .get();

    if (!defaultSnapshot.empty) {
      const docSnap = defaultSnapshot.docs[0];
      return docToProfile(docSnap.id, docSnap.data());
    }

    // Fallback: return the most recently created profile
    const recentSnapshot = await adminDb
      .collection(COLLECTION_PATH)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!recentSnapshot.empty) {
      const docSnap = recentSnapshot.docs[0];
      return docToProfile(docSnap.id, docSnap.data());
    }

    return null;
  } catch (error) {
    logger.error('Failed to get default avatar profile', error as Error, {
      userId,
      file: 'avatar-profile-service.ts',
    });
    return null;
  }
}

/**
 * Add or update a reference image on an avatar profile.
 *
 * - 'frontal': replaces frontalImageUrl
 * - 'additional': appends to additionalImageUrls (up to 4)
 * - 'fullBody': replaces fullBodyImageUrl
 * - 'upperBody': replaces upperBodyImageUrl
 */
export async function addReferenceImage(
  profileId: string,
  imageUrl: string,
  type: 'frontal' | 'additional' | 'fullBody' | 'upperBody'
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    // Verify profile exists
    const docSnap = await adminDb.collection(COLLECTION_PATH).doc(profileId).get();
    if (!docSnap.exists) {
      return { success: false, error: 'Profile not found' };
    }

    const data = docSnap.data() as FirestoreAvatarProfileDoc | undefined;
    if (!data) {
      return { success: false, error: 'Profile data is empty' };
    }

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    switch (type) {
      case 'frontal':
        updateData.frontalImageUrl = imageUrl;
        break;

      case 'additional': {
        const currentAdditional = data.additionalImageUrls ?? [];
        if (currentAdditional.length >= MAX_ADDITIONAL_IMAGES) {
          return {
            success: false,
            error: `Maximum of ${MAX_ADDITIONAL_IMAGES} additional images allowed`,
          };
        }
        updateData.additionalImageUrls = [...currentAdditional, imageUrl];
        break;
      }

      case 'fullBody':
        updateData.fullBodyImageUrl = imageUrl;
        break;

      case 'upperBody':
        updateData.upperBodyImageUrl = imageUrl;
        break;
    }

    await adminDb.collection(COLLECTION_PATH).doc(profileId).update(updateData);

    logger.info('Reference image added to avatar profile', {
      profileId,
      type,
      file: 'avatar-profile-service.ts',
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to add reference image', error as Error, {
      profileId,
      type,
      file: 'avatar-profile-service.ts',
    });
    return { success: false, error: 'Failed to add reference image' };
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Unset isDefault on all profiles for a user EXCEPT the specified profileId.
 */
async function unsetOtherDefaults(userId: string, exceptProfileId: string): Promise<void> {
  if (!adminDb) {
    return;
  }

  const snapshot = await adminDb
    .collection(COLLECTION_PATH)
    .where('userId', '==', userId)
    .where('isDefault', '==', true)
    .get();

  const batch = adminDb.batch();
  let batchCount = 0;

  for (const docSnap of snapshot.docs) {
    if (docSnap.id !== exceptProfileId) {
      batch.update(docSnap.ref, {
        isDefault: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batchCount++;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    logger.info('Unset default on other profiles', {
      userId,
      count: batchCount,
      file: 'avatar-profile-service.ts',
    });
  }
}
