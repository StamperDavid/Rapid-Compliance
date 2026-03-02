/**
 * Specialist Golden Master Service
 *
 * Manages versioned Golden Master snapshots for swarm specialists.
 * Each time an improvement request is applied, a new version is created
 * instead of just patching the config doc. This provides:
 *   - Full version history per specialist
 *   - One-click deploy/rollback to any version
 *   - Audit trail of every change
 *
 * Collection: `specialistGoldenMasters` (sub-collection of the platform org)
 * Doc IDs:   `sgm_{specialistId}_v{version}`
 *
 * @module training/specialist-golden-master-service
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import type { SpecialistGoldenMaster, SpecialistImprovementRequest } from '@/types/training';

// ============================================================================
// CONSTANTS
// ============================================================================

const SPECIALIST_GM_COLLECTION = 'specialistGoldenMasters';
const SPECIALIST_CONFIGS_COLLECTION = 'specialistConfigs';

function getGMCollectionPath(): string {
  return getSubCollection(SPECIALIST_GM_COLLECTION);
}

function getSpecialistConfigsPath(): string {
  return getSubCollection(SPECIALIST_CONFIGS_COLLECTION);
}

function buildGMDocId(specialistId: string, version: number): string {
  return `sgm_${specialistId}_v${version}`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get or create the initial (v1) Golden Master for a specialist.
 * Seeds from the current `specialistConfigs/{specialistId}` doc.
 * Idempotent — returns the existing v1 if already created.
 */
export async function getOrCreateSpecialistGM(
  specialistId: string,
  specialistName: string,
  createdBy: string
): Promise<SpecialistGoldenMaster | null> {
  if (!adminDb) { return null; }

  const collection = adminDb.collection(getGMCollectionPath());
  const v1DocId = buildGMDocId(specialistId, 1);
  const existing = await collection.doc(v1DocId).get();

  if (existing.exists) {
    return existing.data() as SpecialistGoldenMaster;
  }

  // Seed v1 from current specialist config
  const configRef = adminDb.collection(getSpecialistConfigsPath()).doc(specialistId);
  const configDoc = await configRef.get();
  const currentConfig = configDoc.exists
    ? (configDoc.data() as Record<string, unknown>)
    : {};

  // Strip internal metadata from the snapshot
  const cleanConfig = { ...currentConfig };
  delete cleanConfig._lastImprovementRequestId;
  delete cleanConfig._lastImprovedAt;
  delete cleanConfig._beforeState;

  const now = new Date().toISOString();
  const v1: SpecialistGoldenMaster = {
    id: v1DocId,
    specialistId,
    specialistName,
    version: 1,
    config: cleanConfig,
    systemPromptSnapshot: typeof cleanConfig.systemPrompt === 'string' ? cleanConfig.systemPrompt : undefined,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy,
    notes: 'Initial seed from current specialist config',
  };

  await collection.doc(v1DocId).set(v1);

  logger.info(`[SpecialistGMService] Seeded v1 for ${specialistId}`, { specialistId });

  return v1;
}

/**
 * Create a new Golden Master version from an applied improvement request.
 * Merges the proposed changes onto the active version's config snapshot.
 */
export async function createSpecialistGMVersion(
  specialistId: string,
  improvementRequest: SpecialistImprovementRequest,
  createdBy: string
): Promise<SpecialistGoldenMaster | null> {
  if (!adminDb) { return null; }

  const collection = adminDb.collection(getGMCollectionPath());

  // Find the current active version
  const activeGM = await getActiveSpecialistGM(specialistId);
  if (!activeGM) {
    logger.error('[SpecialistGMService] No active GM found — cannot create new version', undefined, { specialistId });
    return null;
  }

  const newVersion = activeGM.version + 1;
  const newDocId = buildGMDocId(specialistId, newVersion);

  // Apply changes to produce the new config snapshot
  const newConfig = { ...activeGM.config };
  for (const change of improvementRequest.proposedChanges) {
    setNestedValue(newConfig, change.field, change.proposedValue);
  }

  const now = new Date().toISOString();
  const newGM: SpecialistGoldenMaster = {
    id: newDocId,
    specialistId,
    specialistName: improvementRequest.specialistName,
    version: newVersion,
    config: newConfig,
    systemPromptSnapshot: typeof newConfig.systemPrompt === 'string' ? newConfig.systemPrompt : activeGM.systemPromptSnapshot,
    sourceImprovementRequestId: improvementRequest.id,
    changesApplied: improvementRequest.proposedChanges,
    isActive: false, // Not yet deployed — deploy step activates it
    createdAt: now,
    createdBy,
    previousVersion: activeGM.version,
  };

  await collection.doc(newDocId).set(newGM);

  logger.info(`[SpecialistGMService] Created v${newVersion} for ${specialistId}`, {
    specialistId,
    version: newVersion,
    changesCount: improvementRequest.proposedChanges.length,
  });

  return newGM;
}

/**
 * Deploy a specific Golden Master version.
 * Sets the target version active, deactivates all others,
 * and patches `specialistConfigs/{specialistId}` with the version's config.
 */
export async function deploySpecialistGM(
  specialistId: string,
  version: number
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'Database not available' };
  }

  const collection = adminDb.collection(getGMCollectionPath());
  const targetDocId = buildGMDocId(specialistId, version);
  const targetDoc = await collection.doc(targetDocId).get();

  if (!targetDoc.exists) {
    return { success: false, error: `Golden Master v${version} not found for ${specialistId}` };
  }

  const targetGM = targetDoc.data() as SpecialistGoldenMaster;

  try {
    // Deactivate all versions for this specialist
    const allVersions = await collection
      .where('specialistId', '==', specialistId)
      .where('isActive', '==', true)
      .get();

    const batch = adminDb.batch();

    for (const doc of allVersions.docs) {
      batch.update(doc.ref, { isActive: false, deployedAt: undefined });
    }

    // Activate the target version
    const now = new Date().toISOString();
    batch.update(collection.doc(targetDocId), {
      isActive: true,
      deployedAt: now,
    });

    // Patch specialistConfigs doc with this version's config
    const configRef = adminDb.collection(getSpecialistConfigsPath()).doc(specialistId);
    batch.set(configRef, {
      ...targetGM.config,
      _activeGMVersion: version,
      _lastDeployedAt: now,
    }, { merge: true });

    await batch.commit();

    logger.info(`[SpecialistGMService] Deployed v${version} for ${specialistId}`, {
      specialistId,
      version,
    });

    return { success: true };
  } catch (error) {
    logger.error(
      '[SpecialistGMService] Deploy failed',
      error instanceof Error ? error : new Error(String(error)),
      { specialistId, version }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Rollback to the previous Golden Master version.
 * Finds the current active version's `previousVersion` and deploys that.
 */
export async function rollbackSpecialistGM(
  specialistId: string
): Promise<{ success: boolean; rolledBackToVersion?: number; error?: string }> {
  const activeGM = await getActiveSpecialistGM(specialistId);
  if (!activeGM) {
    return { success: false, error: 'No active Golden Master to rollback from' };
  }

  if (!activeGM.previousVersion) {
    return { success: false, error: 'No previous version available — this is v1' };
  }

  const result = await deploySpecialistGM(specialistId, activeGM.previousVersion);
  if (result.success) {
    return { success: true, rolledBackToVersion: activeGM.previousVersion };
  }
  return result;
}

/**
 * List all Golden Master versions for a specialist, descending by version.
 */
export async function listSpecialistGMVersions(
  specialistId: string
): Promise<SpecialistGoldenMaster[]> {
  if (!adminDb) { return []; }

  const collection = adminDb.collection(getGMCollectionPath());
  const snapshot = await collection
    .where('specialistId', '==', specialistId)
    .orderBy('version', 'desc')
    .get();

  return snapshot.docs.map(doc => doc.data() as SpecialistGoldenMaster);
}

/**
 * Get the currently active Golden Master for a specialist.
 */
export async function getActiveSpecialistGM(
  specialistId: string
): Promise<SpecialistGoldenMaster | null> {
  if (!adminDb) { return null; }

  const collection = adminDb.collection(getGMCollectionPath());
  const snapshot = await collection
    .where('specialistId', '==', specialistId)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snapshot.empty) { return null; }
  return snapshot.docs[0].data() as SpecialistGoldenMaster;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Set a nested value on an object using dot-notation path.
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}
