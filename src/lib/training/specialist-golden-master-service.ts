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

/**
 * Back-compat specialist ID aliases (legacy → canonical).
 *
 * As of May 8, 2026 the codebase was canonicalized so each agent has ONE
 * true name across admin UI, runtime delegation, seed scripts, and Firestore.
 * This map is the deliberate back-compat layer for cases that still use
 * the old names: existing Firestore step records that recorded the old name
 * in `specialistsUsed`, old TrainingFeedback records, external scripts not
 * yet updated, and humans who refer to agents by familiar/historical names.
 *
 * Adding a new entry here is a deliberate compatibility decision, not a fix
 * for a naming bug — the CI guard `scripts/audit-canonical-specialist-ids.ts`
 * fails the build if a new misalignment between admin / seed / runtime ever
 * sneaks back in. The map grows only when LEGACY data exists in Firestore
 * that we want to keep grading-compatible.
 *
 * Every read/write in this service resolves the input ID through this map
 * before computing doc IDs, hitting the cache, or querying Firestore.
 */
const SPECIALIST_ID_ALIASES: Record<string, string> = {
  // Pre-canonicalization (May 8, 2026) names. Right-hand side is the new
  // canonical that the seed scripts, runtime delegation maps, admin UI,
  // and Firestore docs all use. Old names live on only in historical
  // mission step records and TrainingFeedback documents.
  TWITTER_X_EXPERT: 'X_EXPERT',
  WEB_SCRAPER: 'SCRAPER_SPECIALIST',
  ARCHITECT_COPY_STRATEGIST: 'COPY_STRATEGIST',
  ARCHITECT_FUNNEL_STRATEGIST: 'FUNNEL_STRATEGIST',
  ARCHITECT_UX_UI_STRATEGIST: 'UX_UI_STRATEGIST',
};

/**
 * Returns the canonical specialist ID for an input that may be a back-compat
 * alias. Pass-through if the ID is already canonical.
 */
export function resolveSpecialistIdAlias(specialistId: string): string {
  return SPECIALIST_ID_ALIASES[specialistId] ?? specialistId;
}

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
  rawSpecialistId: string,
  specialistName: string,
  createdBy: string
): Promise<SpecialistGoldenMaster | null> {
  if (!adminDb) { return null; }

  const specialistId = resolveSpecialistIdAlias(rawSpecialistId);
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
  rawSpecialistId: string,
  improvementRequest: SpecialistImprovementRequest,
  createdBy: string
): Promise<SpecialistGoldenMaster | null> {
  if (!adminDb) { return null; }

  const specialistId = resolveSpecialistIdAlias(rawSpecialistId);
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
  rawSpecialistId: string,
  version: number
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'Database not available' };
  }

  const specialistId = resolveSpecialistIdAlias(rawSpecialistId);
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
  rawSpecialistId: string
): Promise<{ success: boolean; rolledBackToVersion?: number; error?: string }> {
  const specialistId = resolveSpecialistIdAlias(rawSpecialistId);
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
  rawSpecialistId: string
): Promise<SpecialistGoldenMaster[]> {
  if (!adminDb) { return []; }

  const specialistId = resolveSpecialistIdAlias(rawSpecialistId);
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
  rawSpecialistId: string
): Promise<SpecialistGoldenMaster | null> {
  if (!adminDb) { return null; }

  const specialistId = resolveSpecialistIdAlias(rawSpecialistId);
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
// INDUSTRY-SCOPED GM LOADER (rebuild specialists)
// ============================================================================

const GM_CACHE_TTL_MS = 60_000;

interface GMCacheEntry {
  data: SpecialistGoldenMaster;
  timestamp: number;
}

const industryGMCache = new Map<string, GMCacheEntry>();

function gmCacheKey(specialistId: string, industryKey: string): string {
  return `${specialistId}:${industryKey}`;
}

/**
 * Get the currently active Golden Master for a specialist scoped to a specific
 * industry template. Used by rebuilt specialists that load their prompt from
 * Firestore at runtime. 60-second in-memory cache keyed by `${specialistId}:${industryKey}`.
 */
export async function getActiveSpecialistGMByIndustry(
  rawSpecialistId: string,
  industryKey: string
): Promise<SpecialistGoldenMaster | null> {
  const specialistId = resolveSpecialistIdAlias(rawSpecialistId);
  const cacheKey = gmCacheKey(specialistId, industryKey);
  const cached = industryGMCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < GM_CACHE_TTL_MS) {
    return cached.data;
  }

  if (!adminDb) { return null; }

  const collection = adminDb.collection(getGMCollectionPath());
  const snapshot = await collection
    .where('specialistId', '==', specialistId)
    .where('industryKey', '==', industryKey)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snapshot.empty) {
    industryGMCache.delete(cacheKey);
    return null;
  }

  const data = snapshot.docs[0].data() as SpecialistGoldenMaster;
  industryGMCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

/**
 * Invalidate the industry-scoped GM cache for a given specialist+industry pair.
 * Called after a new GM version is deployed so the next request reloads.
 */
export function invalidateIndustryGMCache(rawSpecialistId: string, industryKey: string): void {
  const specialistId = resolveSpecialistIdAlias(rawSpecialistId);
  industryGMCache.delete(gmCacheKey(specialistId, industryKey));
}

/**
 * List all Golden Master versions for an industry-scoped specialist,
 * sorted newest-first by version number. Includes both active and
 * deactivated versions so the rollback UI can show the full history.
 *
 * M2c (April 15, 2026) — backs the version history panel and the
 * rollback API (`/api/training/grade-specialist/[specialistId]/versions`).
 * Operators use this to undo a Prompt Engineer edit if the new version
 * hurts specialist performance.
 *
 * Note on the query shape: we do NOT add a Firestore `orderBy('version')`
 * clause because it would require a composite index (specialistId +
 * industryKey + version) that has to be created manually in the Firebase
 * console. Specialists typically have a single-digit number of versions,
 * so sorting client-side is trivial cost and avoids the deploy friction.
 */
export async function listIndustryGMVersions(
  rawSpecialistId: string,
  industryKey: string,
): Promise<SpecialistGoldenMaster[]> {
  if (!adminDb) { return []; }

  const specialistId = resolveSpecialistIdAlias(rawSpecialistId);
  const snapshot = await adminDb
    .collection(getGMCollectionPath())
    .where('specialistId', '==', specialistId)
    .where('industryKey', '==', industryKey)
    .get();

  const versions = snapshot.docs.map((doc) => doc.data() as SpecialistGoldenMaster);
  versions.sort((a, b) => b.version - a.version);
  return versions;
}

// ============================================================================
// INDUSTRY-SCOPED VERSIONING (Phase 3 grade-to-edit pipeline)
// ============================================================================

function buildIndustryGMDocId(specialistId: string, industryKey: string, version: number): string {
  return `sgm_${specialistId.toLowerCase()}_${industryKey}_v${version}`;
}

/**
 * Create a new versioned GM for an industry-scoped specialist by applying a
 * surgical prompt edit from the Prompt Engineer. The edit replaces an exact
 * verbatim substring (`currentText`) in the active GM's systemPrompt with
 * `proposedText`. No other fields change.
 *
 * The new version is created with isActive=false. The caller is expected to
 * call `deployIndustryGMVersion` after human approval to activate it.
 *
 * Returns the new GM record, or null if the active GM cannot be found or the
 * currentText doesn't appear in the active systemPrompt.
 */
export async function createIndustryGMVersionFromEdit(
  rawSpecialistId: string,
  industryKey: string,
  edit: {
    currentText: string;
    proposedText: string;
    rationale: string;
    sourceTrainingFeedbackId: string;
  },
  createdBy: string,
): Promise<SpecialistGoldenMaster | null> {
  if (!adminDb) { return null; }

  const specialistId = resolveSpecialistIdAlias(rawSpecialistId);
  const activeGM = await getActiveSpecialistGMByIndustry(specialistId, industryKey);
  if (!activeGM) {
    logger.error(
      '[SpecialistGMService] No active industry GM found — cannot create new version',
      undefined,
      { specialistId, industryKey },
    );
    return null;
  }

  const rawSystemPrompt = activeGM.config.systemPrompt;
  const currentPrompt = typeof rawSystemPrompt === 'string'
    ? rawSystemPrompt
    : activeGM.systemPromptSnapshot ?? '';
  if (!currentPrompt) {
    logger.error(
      '[SpecialistGMService] Active GM has no systemPrompt — cannot apply edit',
      undefined,
      { specialistId, industryKey, gmId: activeGM.id },
    );
    return null;
  }

  // Hard invariant: currentText must appear verbatim in the current prompt.
  // The Prompt Engineer is supposed to guarantee this, but we double-check
  // before writing to Firestore.
  if (!currentPrompt.includes(edit.currentText)) {
    throw new Error(
      `createIndustryGMVersionFromEdit: currentText does not appear verbatim in active GM ${activeGM.id}. ` +
      `The Prompt Engineer must have hallucinated the section. Refusing to write.`,
    );
  }

  const newPrompt = currentPrompt.replace(edit.currentText, edit.proposedText);
  const newVersion = activeGM.version + 1;
  const newDocId = buildIndustryGMDocId(specialistId, industryKey, newVersion);

  const now = new Date().toISOString();
  const newConfig: Record<string, unknown> = {
    ...activeGM.config,
    systemPrompt: newPrompt,
  };

  const newGM: SpecialistGoldenMaster = {
    id: newDocId,
    specialistId: activeGM.specialistId,
    specialistName: activeGM.specialistName,
    version: newVersion,
    industryKey,
    config: newConfig,
    systemPromptSnapshot: newPrompt,
    sourceImprovementRequestId: edit.sourceTrainingFeedbackId,
    changesApplied: [
      {
        field: 'systemPrompt',
        currentValue: edit.currentText,
        proposedValue: edit.proposedText,
        reason: edit.rationale,
        confidence: 0.8,
      },
    ],
    isActive: false,
    createdAt: now,
    createdBy,
    notes: `Created from Prompt Engineer edit (feedback ${edit.sourceTrainingFeedbackId}). Not yet deployed.`,
    previousVersion: activeGM.version,
  };

  await adminDb.collection(getGMCollectionPath()).doc(newDocId).set(newGM);

  logger.info(
    `[SpecialistGMService] Created industry-scoped v${newVersion} for ${specialistId}:${industryKey} from Prompt Engineer edit`,
    { specialistId, industryKey, version: newVersion, newDocId },
  );

  return newGM;
}

/**
 * Create a new GM version that changes ONLY the LLM model (config.model),
 * preserving the systemPrompt and baked-in Brand DNA verbatim.
 *
 * This is operator-initiated infrastructure config — NOT an agent editing its
 * own prompt — so it is exempt from the grade-gated prompt pipeline (Standing
 * Rule #2 guards prompt drift, not model selection). It IS versioned, so a
 * model swap that hurts behavior can be rolled back to the previous version
 * via deployIndustryGMVersion. Created inactive; deploy it to activate.
 */
export async function createIndustryGMVersionFromModelChange(
  rawSpecialistId: string,
  industryKey: string,
  newModel: string,
  createdBy: string,
): Promise<SpecialistGoldenMaster | null> {
  if (!adminDb) { return null; }

  const specialistId = resolveSpecialistIdAlias(rawSpecialistId);
  const activeGM = await getActiveSpecialistGMByIndustry(specialistId, industryKey);
  if (!activeGM) {
    logger.error(
      '[SpecialistGMService] No active industry GM found — cannot change model',
      undefined,
      { specialistId, industryKey },
    );
    return null;
  }

  const previousModel = typeof activeGM.config.model === 'string'
    ? activeGM.config.model
    : 'claude-sonnet-4.6';
  if (previousModel === newModel) {
    return activeGM; // No-op: already on that model
  }

  const newVersion = activeGM.version + 1;
  const newDocId = buildIndustryGMDocId(specialistId, industryKey, newVersion);
  const now = new Date().toISOString();
  const newConfig: Record<string, unknown> = {
    ...activeGM.config,
    model: newModel,
  };

  const newGM: SpecialistGoldenMaster = {
    id: newDocId,
    specialistId: activeGM.specialistId,
    specialistName: activeGM.specialistName,
    version: newVersion,
    industryKey,
    config: newConfig,
    systemPromptSnapshot: activeGM.systemPromptSnapshot,
    sourceImprovementRequestId: `model-change-${now}`,
    changesApplied: [
      {
        field: 'model',
        currentValue: previousModel,
        proposedValue: newModel,
        reason: `Operator changed model from ${previousModel} to ${newModel}`,
        confidence: 1,
      },
    ],
    isActive: false,
    createdAt: now,
    createdBy,
    notes: `Model change ${previousModel} -> ${newModel}. Not yet deployed.`,
    previousVersion: activeGM.version,
  };

  await adminDb.collection(getGMCollectionPath()).doc(newDocId).set(newGM);

  logger.info(
    `[SpecialistGMService] Created industry-scoped v${newVersion} for ${specialistId}:${industryKey} (model ${previousModel} -> ${newModel})`,
    { specialistId, industryKey, version: newVersion, newDocId },
  );

  return newGM;
}

/**
 * Deploy a specific industry-scoped GM version. Deactivates any other active
 * versions for the same (specialistId, industryKey) pair and activates the
 * target. Runs in a single Firestore batch. Invalidates the cache so the
 * next specialist call picks up the new version.
 */
export async function deployIndustryGMVersion(
  rawSpecialistId: string,
  industryKey: string,
  targetVersion: number,
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'adminDb not initialized' };
  }

  const specialistId = resolveSpecialistIdAlias(rawSpecialistId);
  const collection = adminDb.collection(getGMCollectionPath());
  const targetDocId = buildIndustryGMDocId(specialistId, industryKey, targetVersion);
  const targetDoc = await collection.doc(targetDocId).get();
  if (!targetDoc.exists) {
    return { success: false, error: `GM v${targetVersion} not found for ${specialistId}:${industryKey}` };
  }

  const activeSnap = await collection
    .where('specialistId', '==', specialistId)
    .where('industryKey', '==', industryKey)
    .where('isActive', '==', true)
    .get();

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  for (const doc of activeSnap.docs) {
    if (doc.id === targetDocId) { continue; }
    batch.update(doc.ref, {
      isActive: false,
      deactivatedAt: now,
      deactivatedReason: `superseded by ${targetDocId}`,
    });
  }

  batch.update(collection.doc(targetDocId), {
    isActive: true,
    deployedAt: now,
  });

  await batch.commit();
  invalidateIndustryGMCache(specialistId, industryKey);

  logger.info(
    `[SpecialistGMService] Deployed industry v${targetVersion} for ${specialistId}:${industryKey}`,
    { specialistId, industryKey, version: targetVersion },
  );
  return { success: true };
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
