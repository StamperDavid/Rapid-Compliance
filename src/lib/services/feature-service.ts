/**
 * Feature Service
 *
 * Firestore CRUD for feature configuration and business profile.
 * Stores data under organizations/{PLATFORM_ID}/settings/feature_config
 * and organizations/{PLATFORM_ID}/settings/business_profile.
 */

import { PLATFORM_ID } from '@/lib/constants/platform';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { FeatureConfig, BusinessProfile } from '@/types/feature-modules';
import { logger } from '@/lib/logger/logger';

const SETTINGS_COLLECTION = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/settings`;
const FEATURE_CONFIG_DOC = 'feature_config';
const BUSINESS_PROFILE_DOC = 'business_profile';

/**
 * Get the current feature configuration from Firestore.
 * Returns null if no config exists (existing users who haven't set up features).
 */
export async function getFeatureConfig(): Promise<FeatureConfig | null> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    const data = await FirestoreService.get<FeatureConfig>(
      SETTINGS_COLLECTION,
      FEATURE_CONFIG_DOC,
    );
    return data ?? null;
  } catch (error) {
    logger.error(
      'Error loading feature config',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'feature-service.ts' },
    );
    return null;
  }
}

/**
 * Save feature configuration to Firestore.
 */
export async function saveFeatureConfig(config: FeatureConfig): Promise<void> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    await FirestoreService.set(SETTINGS_COLLECTION, FEATURE_CONFIG_DOC, config, false);
    logger.info('Feature config saved', { file: 'feature-service.ts' });
  } catch (error) {
    logger.error(
      'Error saving feature config',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'feature-service.ts' },
    );
    throw error;
  }
}

/**
 * Get the business profile from Firestore.
 */
export async function getBusinessProfile(): Promise<BusinessProfile | null> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    const data = await FirestoreService.get<BusinessProfile>(
      SETTINGS_COLLECTION,
      BUSINESS_PROFILE_DOC,
    );
    return data ?? null;
  } catch (error) {
    logger.error(
      'Error loading business profile',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'feature-service.ts' },
    );
    return null;
  }
}

/**
 * Save business profile to Firestore.
 */
export async function saveBusinessProfile(profile: BusinessProfile): Promise<void> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    await FirestoreService.set(SETTINGS_COLLECTION, BUSINESS_PROFILE_DOC, profile, false);
    logger.info('Business profile saved', { file: 'feature-service.ts' });
  } catch (error) {
    logger.error(
      'Error saving business profile',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'feature-service.ts' },
    );
    throw error;
  }
}

/**
 * Get the Firestore path for the feature config document.
 * Useful for batch writes during onboarding.
 */
export function getFeatureConfigPath(): { collection: string; docId: string } {
  return {
    collection: SETTINGS_COLLECTION,
    docId: FEATURE_CONFIG_DOC,
  };
}
