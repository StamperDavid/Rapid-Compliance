/**
 * Location Library — Location Profile Service
 * Firestore CRUD for reusable digital SETS (places): a locked set description
 * plus multi-angle reference images and optional video walkthroughs.
 *
 * Locations are user-created ('custom') in the Location Library with full
 * environment-identity control. The locked `description` + reference media are
 * what keep a room IDENTICAL across every render.
 *
 * Collection path: organizations/{PLATFORM_ID}/location_profiles/{locationId}
 *
 * Uses Admin SDK for server-side operations (API routes, Jasper tools).
 */

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import crypto from 'crypto';
import type {
  LocationProfile,
  LocationSource,
  CreateLocationProfileData,
  UpdateLocationProfileData,
} from '@/types/location';

// ============================================================================
// Firestore Document Shape
// ============================================================================

interface FirestoreLocationProfileDoc {
  userId: string;
  name: string;
  description: string;
  referenceImageUrls: string[];
  referenceVideoUrls: string[];
  source: LocationSource;
  createdAt: FirebaseFirestore.Timestamp | null;
  updatedAt: FirebaseFirestore.Timestamp | null;
}

// ============================================================================
// Constants
// ============================================================================

const COLLECTION_PATH = getSubCollection('location_profiles');

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
 * Map a Firestore doc snapshot to a LocationProfile
 */
function docToProfile(id: string, raw: FirebaseFirestore.DocumentData): LocationProfile {
  const data = raw as FirestoreLocationProfileDoc;
  return {
    id,
    userId: data.userId ?? '',
    name: data.name ?? '',
    description: data.description ?? '',
    referenceImageUrls: data.referenceImageUrls ?? [],
    referenceVideoUrls: data.referenceVideoUrls ?? [],
    source: 'custom',
    createdAt: timestampToISO(data.createdAt),
    updatedAt: timestampToISO(data.updatedAt),
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new location profile for a user.
 * Generates a UUID for the profile ID and stores it in Firestore.
 */
export async function createLocationProfile(
  userId: string,
  data: CreateLocationProfileData
): Promise<{ success: boolean; profile?: LocationProfile; error?: string }> {
  try {
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    const locationId = crypto.randomUUID();

    const profileData = {
      userId,
      name: data.name,
      description: data.description ?? '',
      referenceImageUrls: data.referenceImageUrls ?? [],
      referenceVideoUrls: data.referenceVideoUrls ?? [],
      source: data.source ?? 'custom',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection(COLLECTION_PATH).doc(locationId).set(profileData);

    logger.info('Location profile created', {
      locationId,
      userId,
      name: data.name,
      file: 'location-profile-service.ts',
    });

    const profile: LocationProfile = {
      id: locationId,
      userId,
      name: profileData.name,
      description: profileData.description,
      referenceImageUrls: profileData.referenceImageUrls,
      referenceVideoUrls: profileData.referenceVideoUrls,
      source: 'custom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { success: true, profile };
  } catch (error) {
    logger.error('Failed to create location profile', error as Error, {
      userId,
      file: 'location-profile-service.ts',
    });
    return { success: false, error: 'Failed to create location profile' };
  }
}

/**
 * Get a single location profile by its ID.
 */
export async function getLocationProfile(locationId: string): Promise<LocationProfile | null> {
  try {
    if (!adminDb) {
      logger.warn('Database not available for getting location profile', {
        file: 'location-profile-service.ts',
      });
      return null;
    }

    const docSnap = await adminDb.collection(COLLECTION_PATH).doc(locationId).get();

    if (!docSnap.exists) {
      logger.warn('Location profile not found', {
        locationId,
        file: 'location-profile-service.ts',
      });
      return null;
    }

    const data = docSnap.data();
    if (!data) {
      return null;
    }

    return docToProfile(docSnap.id, data);
  } catch (error) {
    logger.error('Failed to get location profile', error as Error, {
      locationId,
      file: 'location-profile-service.ts',
    });
    return null;
  }
}

/**
 * List location profiles for a user, ordered by createdAt desc.
 *
 * By default also includes stock/system locations (userId === 'system') so
 * generic set-pickers can offer them. Pass `{ ownOnly: true }` for the Location
 * Library tab, which must show ONLY the operator's own CREATED sets — never
 * stock locations (it's a generator + library of the tenant's reusable sets).
 */
export async function listLocationProfiles(
  userId: string,
  opts: { ownOnly?: boolean } = {},
): Promise<LocationProfile[]> {
  if (!adminDb) {
    logger.warn('Database not available for listing location profiles', {
      file: 'location-profile-service.ts',
    });
    return [];
  }

  const sortDesc = (a: LocationProfile, b: LocationProfile) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  // Fetch user's personal locations and stock locations independently.
  // Each query is wrapped in its own try/catch so a failure in one
  // does not prevent the other from returning results.
  let userProfiles: LocationProfile[] = [];
  let stockProfiles: LocationProfile[] = [];

  try {
    const userSnapshot = await adminDb
      .collection(COLLECTION_PATH)
      .where('userId', '==', userId)
      .get();
    userProfiles = userSnapshot.docs
      .map((docSnap) => docToProfile(docSnap.id, docSnap.data()))
      .sort(sortDesc);
  } catch (error) {
    logger.error('Failed to fetch user location profiles', error as Error, {
      userId,
      collectionPath: COLLECTION_PATH,
      file: 'location-profile-service.ts',
    });
  }

  // Location Library tab: only the operator's OWN created sets — exclude
  // stock/system locations (source 'custom' = built here).
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

    logger.info('Stock location profiles loaded', {
      count: stockProfiles.length,
      ids: stockProfiles.map((p) => p.id).join(', '),
      collectionPath: COLLECTION_PATH,
      file: 'location-profile-service.ts',
    });
  } catch (error) {
    logger.error('Failed to fetch stock location profiles', error as Error, {
      collectionPath: COLLECTION_PATH,
      file: 'location-profile-service.ts',
    });
  }

  // User locations first, then stock locations
  return [...userProfiles, ...stockProfiles];
}

/**
 * Partially update a location profile. Sets updatedAt automatically.
 */
export async function updateLocationProfile(
  locationId: string,
  updates: UpdateLocationProfileData
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
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }
    if (updates.referenceImageUrls !== undefined) {
      updateData.referenceImageUrls = updates.referenceImageUrls;
    }
    if (updates.referenceVideoUrls !== undefined) {
      updateData.referenceVideoUrls = updates.referenceVideoUrls;
    }
    if (updates.source !== undefined) {
      updateData.source = updates.source;
    }

    await adminDb.collection(COLLECTION_PATH).doc(locationId).update(updateData);

    logger.info('Location profile updated', {
      locationId,
      file: 'location-profile-service.ts',
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to update location profile', error as Error, {
      locationId,
      file: 'location-profile-service.ts',
    });
    return { success: false, error: 'Failed to update location profile' };
  }
}

/**
 * Delete a location profile by its ID.
 */
export async function deleteLocationProfile(locationId: string): Promise<boolean> {
  try {
    if (!adminDb) {
      return false;
    }

    await adminDb.collection(COLLECTION_PATH).doc(locationId).delete();

    logger.info('Location profile deleted', {
      locationId,
      file: 'location-profile-service.ts',
    });

    return true;
  } catch (error) {
    logger.error('Failed to delete location profile', error as Error, {
      locationId,
      file: 'location-profile-service.ts',
    });
    return false;
  }
}
