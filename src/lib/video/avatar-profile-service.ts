/**
 * Character Studio — Avatar Profile Service
 * Firestore CRUD for character profiles with multi-angle reference images,
 * green screen clips, voice assignment, and Character Studio metadata.
 *
 * Characters are user-created ('custom') in Character Studio with full identity
 * control. Voice assignment is decoupled from the character image and uses
 * ElevenLabs / UnrealSpeech / custom clones for TTS.
 *
 * Collection path: organizations/{PLATFORM_ID}/avatar_profiles/{profileId}
 *
 * Uses Admin SDK for server-side operations (API routes, Jasper tools).
 */

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { getAsset, deleteAsset, removeLibraryRecordsByUrls } from '@/lib/media/media-library-service';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

/**
 * A green screen video clip used as AI training data for the digital avatar.
 * Multiple clips with different scripts teach the AI how the person speaks,
 * moves, and expresses different intonations — producing a much more realistic
 * synthetic avatar than a single photo.
 */
export interface GreenScreenClip {
  id: string;
  videoUrl: string; // URL to the green screen video file
  thumbnailUrl: string | null; // Auto-generated or uploaded thumbnail
  script: string; // The text spoken in this clip (training reference)
  duration: number; // seconds
  createdAt: string; // ISO string
}

/**
 * A "Look" (alter ego) for a character. SAME face/identity as the parent
 * AvatarProfile, but a distinct outfit/state with its own reference set.
 * Examples: "David (civilian)" vs "Velocity (hero)" — one face, two looks.
 */
export interface CharacterLook {
  id: string; // crypto.randomUUID()
  name: string; // e.g. "David (civilian)", "Velocity (hero)"
  outfitDescription: string; // e.g. "jeans and a grey t-shirt" / "dark armor, glowing purple energy"
  imageUrls: string[]; // reference images for THIS look
  videoUrls: string[]; // reference video clips for this look (e.g. chroma-key walk)
  audioUrls: string[]; // optional audio references for this look
  isPrimary: boolean; // the default look for the character
}

export type AvatarTier = 'premium' | 'standard';

/** Character source — 'custom' = user-created in Character Studio */
export type CharacterSource = 'custom';

/** Character role in productions */
export type CharacterRole = 'hero' | 'villain' | 'extra' | 'narrator' | 'presenter' | 'custom';

/** Visual style tag for prompt optimization */
export type CharacterStyleTag = 'real' | 'anime' | 'stylized';

export interface AvatarProfile {
  id: string;
  userId: string;
  name: string; // e.g., "David - Professional"

  // Character Studio fields
  source: CharacterSource; // 'custom' = user-created
  role: CharacterRole; // Character's role in productions
  styleTag: CharacterStyleTag; // Visual style for prompt optimization

  // Avatar tier
  tier: AvatarTier; // 'premium' = green screen video clips, 'standard' = photo-based

  // Reference images for character consistency
  frontalImageUrl: string; // Primary face photo (required)
  additionalImageUrls: string[]; // Side angles, full body, etc. (unlimited)
  fullBodyImageUrl: string | null; // Full body reference
  upperBodyImageUrl: string | null; // Upper body reference

  // Green screen video clips — AI training data for digital clone (premium tier)
  greenScreenClips: GreenScreenClip[]; // Multiple clips = richer AI avatar generation

  // Looks — alter egos sharing the SAME face/identity, each with its own
  // outfit/state and its own reference set (images, video, audio).
  looks: CharacterLook[];

  // Voice identity — decoupled from character image, always changeable
  voiceId: string | null;
  voiceName: string | null; // Display name (e.g., "Rachel", "Custom Clone - David")
  voiceProvider: VoiceProvider | null;

  // Metadata
  description: string | null; // "Professional look, navy suit"
  isDefault: boolean; // Auto-select this profile
  isFavorite: boolean; // Quick-access favorite
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

type VoiceProvider = 'elevenlabs' | 'unrealspeech' | 'custom';

export interface CreateAvatarProfileData {
  name: string;
  frontalImageUrl: string;
  source?: CharacterSource;
  role?: CharacterRole;
  styleTag?: CharacterStyleTag;
  tier?: AvatarTier;
  additionalImageUrls?: string[];
  fullBodyImageUrl?: string | null;
  upperBodyImageUrl?: string | null;
  greenScreenClips?: GreenScreenClip[];
  looks?: CharacterLook[];
  voiceId?: string | null;
  voiceName?: string | null;
  voiceProvider?: VoiceProvider | null;
  description?: string | null;
  isDefault?: boolean;
}

export interface UpdateAvatarProfileData {
  name?: string;
  frontalImageUrl?: string;
  source?: CharacterSource;
  role?: CharacterRole;
  styleTag?: CharacterStyleTag;
  tier?: AvatarTier;
  additionalImageUrls?: string[];
  fullBodyImageUrl?: string | null;
  upperBodyImageUrl?: string | null;
  greenScreenClips?: GreenScreenClip[];
  looks?: CharacterLook[];
  voiceId?: string | null;
  voiceName?: string | null;
  voiceProvider?: VoiceProvider | null;
  description?: string | null;
  isDefault?: boolean;
  isFavorite?: boolean;
}

// ============================================================================
// Firestore Document Shape
// ============================================================================

interface FirestoreAvatarProfileDoc {
  userId: string;
  name: string;
  source: CharacterSource;
  role: CharacterRole;
  styleTag: CharacterStyleTag;
  tier: AvatarTier;
  frontalImageUrl: string;
  additionalImageUrls: string[];
  fullBodyImageUrl: string | null;
  upperBodyImageUrl: string | null;
  greenScreenClips: GreenScreenClip[];
  looks: CharacterLook[];
  voiceId: string | null;
  voiceName: string | null;
  voiceProvider: VoiceProvider | null;
  description: string | null;
  isDefault: boolean;
  isFavorite: boolean;
  createdAt: FirebaseFirestore.Timestamp | null;
  updatedAt: FirebaseFirestore.Timestamp | null;
}

// ============================================================================
// Constants
// ============================================================================

const COLLECTION_PATH = getSubCollection('avatar_profiles');
// Reference angles are UNLIMITED: the more references the operator gives a
// character, the better the video specialist holds its identity. (Per-model
// input caps are applied downstream at generation time, not stored here.)

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
  const clips = data.greenScreenClips ?? [];
  return {
    id,
    userId: data.userId ?? '',
    name: data.name ?? '',
    source: 'custom',
    role: data.role ?? 'presenter',
    styleTag: data.styleTag ?? 'real',
    tier: data.tier ?? (clips.length > 0 ? 'premium' : 'standard'),
    frontalImageUrl: data.frontalImageUrl ?? '',
    additionalImageUrls: data.additionalImageUrls ?? [],
    fullBodyImageUrl: data.fullBodyImageUrl ?? null,
    upperBodyImageUrl: data.upperBodyImageUrl ?? null,
    greenScreenClips: clips,
    looks: data.looks ?? [],
    voiceId: data.voiceId ?? null,
    voiceName: data.voiceName ?? null,
    voiceProvider: data.voiceProvider ?? null,
    description: data.description ?? null,
    isDefault: data.isDefault ?? false,
    isFavorite: data.isFavorite ?? false,
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

    const greenScreenClips = data.greenScreenClips ?? [];
    const tier = data.tier ?? (greenScreenClips.length > 0 ? 'premium' : 'standard');

    const profileData = {
      userId,
      name: data.name,
      source: data.source ?? 'custom',
      role: data.role ?? 'presenter',
      styleTag: data.styleTag ?? 'real',
      tier,
      frontalImageUrl: data.frontalImageUrl,
      additionalImageUrls: data.additionalImageUrls ?? [],
      fullBodyImageUrl: data.fullBodyImageUrl ?? null,
      upperBodyImageUrl: data.upperBodyImageUrl ?? null,
      greenScreenClips,
      looks: data.looks ?? [],
      voiceId: data.voiceId ?? null,
      voiceName: data.voiceName ?? null,
      voiceProvider: data.voiceProvider ?? null,
      description: data.description ?? null,
      isDefault: data.isDefault ?? false,
      isFavorite: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection(COLLECTION_PATH).doc(profileId).set(profileData);

    // If this profile is set as default, unset all others for this user
    if (profileData.isDefault) {
      await unsetOtherDefaults(userId, profileId);
    }

    // Move any regular-library images used for this character OUT of the general
    // library — they now live with the character (prevents library pollution).
    // Best-effort: a cleanup failure must not fail character creation.
    await removeLibraryRecordsByUrls(
      [
        data.frontalImageUrl,
        data.fullBodyImageUrl,
        data.upperBodyImageUrl,
        ...(data.additionalImageUrls ?? []),
        ...(data.looks ?? []).flatMap((look) => look.imageUrls ?? []),
      ].filter((u): u is string => typeof u === 'string' && u.length > 0),
    ).catch((err: unknown) => {
      logger.warn('Could not move some library images onto the character (continuing)', {
        file: 'avatar-profile-service.ts',
        profileId,
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    });

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
      source: profileData.source,
      role: profileData.role,
      styleTag: profileData.styleTag,
      tier,
      frontalImageUrl: data.frontalImageUrl,
      additionalImageUrls: profileData.additionalImageUrls,
      fullBodyImageUrl: profileData.fullBodyImageUrl,
      upperBodyImageUrl: profileData.upperBodyImageUrl,
      greenScreenClips,
      looks: profileData.looks,
      voiceId: profileData.voiceId,
      voiceName: profileData.voiceName,
      voiceProvider: profileData.voiceProvider,
      description: profileData.description,
      isDefault: profileData.isDefault,
      isFavorite: false,
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
 * List avatar profiles for a user, ordered by createdAt desc.
 *
 * By default also includes stock/system avatars (userId === 'system') so generic
 * cast-pickers can offer them. Pass `{ ownOnly: true }` for the Character Library
 * tab, which must show ONLY the operator's own CREATED characters — never stock
 * avatars (it's a generator + library of the tenant's digital cast).
 */
export async function listAvatarProfiles(
  userId: string,
  opts: { ownOnly?: boolean } = {},
): Promise<AvatarProfile[]> {
  if (!adminDb) {
    logger.warn('Database not available for listing avatar profiles', {
      file: 'avatar-profile-service.ts',
    });
    return [];
  }

  const sortDesc = (a: AvatarProfile, b: AvatarProfile) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  // Fetch user's personal avatars and stock avatars independently.
  // Each query is wrapped in its own try/catch so a failure in one
  // does not prevent the other from returning results.
  let userProfiles: AvatarProfile[] = [];
  let stockProfiles: AvatarProfile[] = [];

  try {
    const userSnapshot = await adminDb
      .collection(COLLECTION_PATH)
      .where('userId', '==', userId)
      .get();
    userProfiles = userSnapshot.docs
      .map((docSnap) => docToProfile(docSnap.id, docSnap.data()))
      .sort(sortDesc);
  } catch (error) {
    logger.error('Failed to fetch user avatar profiles', error as Error, {
      userId,
      collectionPath: COLLECTION_PATH,
      file: 'avatar-profile-service.ts',
    });
  }

  // Character Library tab: only the operator's OWN created characters — exclude
  // stock/system avatars (source 'custom' = built here).
  if (opts.ownOnly) {
    return userProfiles.filter((p) => p.source === 'custom');
  }

  try {
    const stockSnapshot = await adminDb
      .collection(COLLECTION_PATH)
      .where('userId', '==', 'system')
      .get();
    stockProfiles = stockSnapshot.docs
      .map((docSnap) => docToProfile(docSnap.id, docSnap.data()))
      .sort(sortDesc);

    logger.info('Stock avatar profiles loaded', {
      count: stockProfiles.length,
      ids: stockProfiles.map((p) => p.id).join(', '),
      collectionPath: COLLECTION_PATH,
      file: 'avatar-profile-service.ts',
    });
  } catch (error) {
    logger.error('Failed to fetch stock avatar profiles', error as Error, {
      collectionPath: COLLECTION_PATH,
      file: 'avatar-profile-service.ts',
    });
  }

  // User avatars first, then stock avatars
  return [...userProfiles, ...stockProfiles];
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
    if (updates.source !== undefined) {
      updateData.source = updates.source;
    }
    if (updates.role !== undefined) {
      updateData.role = updates.role;
    }
    if (updates.styleTag !== undefined) {
      updateData.styleTag = updates.styleTag;
    }
    if (updates.tier !== undefined) {
      updateData.tier = updates.tier;
    }
    if (updates.frontalImageUrl !== undefined) {
      updateData.frontalImageUrl = updates.frontalImageUrl;
    }
    if (updates.additionalImageUrls !== undefined) {
      updateData.additionalImageUrls = updates.additionalImageUrls;
    }
    if (updates.fullBodyImageUrl !== undefined) {
      updateData.fullBodyImageUrl = updates.fullBodyImageUrl;
    }
    if (updates.upperBodyImageUrl !== undefined) {
      updateData.upperBodyImageUrl = updates.upperBodyImageUrl;
    }
    if (updates.greenScreenClips !== undefined) {
      updateData.greenScreenClips = updates.greenScreenClips;
    }
    if (updates.looks !== undefined) {
      updateData.looks = updates.looks;
    }
    if (updates.voiceId !== undefined) {
      updateData.voiceId = updates.voiceId;
    }
    if (updates.voiceName !== undefined) {
      updateData.voiceName = updates.voiceName;
    }
    if (updates.voiceProvider !== undefined) {
      updateData.voiceProvider = updates.voiceProvider;
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

    // Fallback: return the most recently created profile (no orderBy to avoid composite index)
    const recentSnapshot = await adminDb
      .collection(COLLECTION_PATH)
      .where('userId', '==', userId)
      .get();

    if (!recentSnapshot.empty) {
      const allProfiles = recentSnapshot.docs.map((d) => docToProfile(d.id, d.data()));
      allProfiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return allProfiles[0];
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
 * - 'additional': appends to additionalImageUrls (unlimited)
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
        // Unlimited reference angles — every added reference sharpens identity.
        const currentAdditional = data.additionalImageUrls ?? [];
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

/**
 * MOVE a media-library image onto a character as a reference image.
 *
 * This is a RELOCATION, not a copy. The owner's rule: "I don't need it saved in
 * two places; its location changes to the character." So we:
 *   1. Load the media asset to read its image URL (and confirm it's an image).
 *   2. Confirm the target character belongs to the requesting user.
 *   3. Append the URL to the character's reference set (de-duped). The first
 *      image a character has lands as its frontal/primary reference; any
 *      further images fill `additionalImageUrls` (unlimited).
 *   4. Delete the media-library record so the image no longer shows in the
 *      general browse. The underlying Storage file / URL is NOT deleted — the
 *      character now references that same URL, so it stays alive there.
 *
 * Returns the refreshed character on success.
 */
export async function moveImageToCharacter(
  userId: string,
  assetId: string,
  characterId: string,
  // Which reference slot the moved image fills. Defaults to 'additional' (the
  // media-library "Add to character" path, which has no slot concept); the
  // character edit form passes the exact slot the operator picked.
  slot: 'frontal' | 'additional' | 'fullBody' | 'upperBody' = 'additional',
): Promise<{ success: boolean; profile?: AvatarProfile; error?: string }> {
  try {
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    // 1. Load the media asset and read its URL.
    const asset = await getAsset(assetId);
    if (!asset) {
      return { success: false, error: 'Media asset not found' };
    }
    if (asset.type !== 'image') {
      return {
        success: false,
        error: 'Only image assets can be added to a character',
      };
    }
    if (!asset.url) {
      return { success: false, error: 'Media asset has no image URL' };
    }

    // 2. Confirm the target character exists and belongs to this user.
    const docSnap = await adminDb
      .collection(COLLECTION_PATH)
      .doc(characterId)
      .get();
    if (!docSnap.exists) {
      return { success: false, error: 'Character not found' };
    }
    const data = docSnap.data() as FirestoreAvatarProfileDoc | undefined;
    if (!data) {
      return { success: false, error: 'Character data is empty' };
    }
    if (data.userId !== userId) {
      return { success: false, error: 'Character does not belong to this user' };
    }

    const imageUrl = asset.url;
    const currentFrontal = data.frontalImageUrl ?? '';
    const currentAdditional = data.additionalImageUrls ?? [];

    // De-dupe: if the character already references this exact URL, skip the
    // append but still remove the duplicate library record so the move's
    // visible outcome (gone from the browse) still holds.
    const alreadyReferenced =
      currentFrontal === imageUrl || currentAdditional.includes(imageUrl);

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!alreadyReferenced) {
      switch (slot) {
        case 'frontal':
          updateData.frontalImageUrl = imageUrl;
          break;
        case 'fullBody':
          updateData.fullBodyImageUrl = imageUrl;
          break;
        case 'upperBody':
          updateData.upperBodyImageUrl = imageUrl;
          break;
        case 'additional':
        default:
          if (!currentFrontal) {
            // No primary face yet → the first reference becomes the face.
            updateData.frontalImageUrl = imageUrl;
          } else {
            // Unlimited additional references — append every moved image.
            updateData.additionalImageUrls = [...currentAdditional, imageUrl];
          }
          break;
      }
      await adminDb
        .collection(COLLECTION_PATH)
        .doc(characterId)
        .update(updateData);
    }

    // 3. Remove the media-library record so the image leaves the general browse.
    // The Storage file / URL stays alive (the character now references it).
    await deleteAsset(assetId);

    logger.info('Image moved from media library onto character', {
      userId,
      characterId,
      assetId,
      alreadyReferenced,
      file: 'avatar-profile-service.ts',
    });

    const profile = await getAvatarProfile(characterId);
    if (!profile) {
      return { success: false, error: 'Failed to reload character after move' };
    }

    return { success: true, profile };
  } catch (error) {
    logger.error('Failed to move image to character', error as Error, {
      userId,
      characterId,
      assetId,
      file: 'avatar-profile-service.ts',
    });
    return { success: false, error: 'Failed to add image to character' };
  }
}

// ============================================================================
// Green Screen Clip Management
// ============================================================================

const MAX_GREEN_SCREEN_CLIPS = 20;

/**
 * Add a green screen video clip to an avatar profile.
 * Automatically upgrades the profile tier to 'premium'.
 */
export async function addGreenScreenClip(
  profileId: string,
  clip: Omit<GreenScreenClip, 'id' | 'createdAt'>
): Promise<{ success: boolean; clipId?: string; error?: string }> {
  try {
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    const docSnap = await adminDb.collection(COLLECTION_PATH).doc(profileId).get();
    if (!docSnap.exists) {
      return { success: false, error: 'Profile not found' };
    }

    const data = docSnap.data() as FirestoreAvatarProfileDoc | undefined;
    if (!data) {
      return { success: false, error: 'Profile data is empty' };
    }

    const currentClips = data.greenScreenClips ?? [];
    if (currentClips.length >= MAX_GREEN_SCREEN_CLIPS) {
      return { success: false, error: `Maximum of ${MAX_GREEN_SCREEN_CLIPS} green screen clips allowed` };
    }

    const clipId = crypto.randomUUID();
    const newClip: GreenScreenClip = {
      id: clipId,
      videoUrl: clip.videoUrl,
      thumbnailUrl: clip.thumbnailUrl ?? null,
      script: clip.script,
      duration: clip.duration,
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection(COLLECTION_PATH).doc(profileId).update({
      greenScreenClips: [...currentClips, newClip],
      tier: 'premium', // Auto-upgrade to premium when clips are added
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Green screen clip added to avatar profile', {
      profileId,
      clipId,
      duration: clip.duration,
      file: 'avatar-profile-service.ts',
    });

    return { success: true, clipId };
  } catch (error) {
    logger.error('Failed to add green screen clip', error as Error, {
      profileId,
      file: 'avatar-profile-service.ts',
    });
    return { success: false, error: 'Failed to add green screen clip' };
  }
}

/**
 * Remove a green screen video clip from an avatar profile.
 * Downgrades tier to 'standard' if no clips remain.
 */
export async function removeGreenScreenClip(
  profileId: string,
  clipId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    const docSnap = await adminDb.collection(COLLECTION_PATH).doc(profileId).get();
    if (!docSnap.exists) {
      return { success: false, error: 'Profile not found' };
    }

    const data = docSnap.data() as FirestoreAvatarProfileDoc | undefined;
    if (!data) {
      return { success: false, error: 'Profile data is empty' };
    }

    const currentClips = data.greenScreenClips ?? [];
    const updatedClips = currentClips.filter((c) => c.id !== clipId);

    if (updatedClips.length === currentClips.length) {
      return { success: false, error: 'Clip not found' };
    }

    await adminDb.collection(COLLECTION_PATH).doc(profileId).update({
      greenScreenClips: updatedClips,
      tier: updatedClips.length > 0 ? 'premium' : 'standard',
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Green screen clip removed from avatar profile', {
      profileId,
      clipId,
      remainingClips: updatedClips.length,
      file: 'avatar-profile-service.ts',
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to remove green screen clip', error as Error, {
      profileId,
      file: 'avatar-profile-service.ts',
    });
    return { success: false, error: 'Failed to remove green screen clip' };
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
