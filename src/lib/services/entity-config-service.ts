/**
 * Entity Config Service
 *
 * Firestore CRUD for entity configuration.
 * Stores data under organizations/{PLATFORM_ID}/settings/entity_config
 */

import { PLATFORM_ID } from '@/lib/constants/platform';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { EntityConfig } from '@/types/entity-config';
import { logger } from '@/lib/logger/logger';

const SETTINGS_COLLECTION = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/settings`;
const ENTITY_CONFIG_DOC = 'entity_config';

/**
 * Get the current entity configuration from Firestore.
 * Returns null if no config exists (existing users who haven't configured entities).
 */
export async function getEntityConfig(): Promise<EntityConfig | null> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    const data = await FirestoreService.get<EntityConfig>(
      SETTINGS_COLLECTION,
      ENTITY_CONFIG_DOC,
    );
    return data ?? null;
  } catch (error) {
    logger.error(
      'Error loading entity config',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'entity-config-service.ts' },
    );
    return null;
  }
}

/**
 * Save entity configuration to Firestore.
 */
export async function saveEntityConfig(config: EntityConfig): Promise<void> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    await FirestoreService.set(SETTINGS_COLLECTION, ENTITY_CONFIG_DOC, config, false);
    logger.info('Entity config saved', { file: 'entity-config-service.ts' });
  } catch (error) {
    logger.error(
      'Error saving entity config',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'entity-config-service.ts' },
    );
    throw error;
  }
}

/**
 * Get the Firestore path for the entity config document.
 * Useful for batch writes during onboarding.
 */
export function getEntityConfigPath(): { collection: string; docId: string } {
  return {
    collection: SETTINGS_COLLECTION,
    docId: ENTITY_CONFIG_DOC,
  };
}
