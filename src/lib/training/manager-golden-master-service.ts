/**
 * Manager Golden Master Service
 *
 * Manages versioned Golden Master snapshots for the 10 manager agents
 * (Content, Marketing, Outreach, Intelligence, Revenue, Reputation,
 * Commerce, Builder, Architect, Master Orchestrator).
 *
 * Parallel to `specialist-golden-master-service.ts` but for the manager
 * review layer. Each manager's GM doc holds the review criteria prompt
 * that the LLM uses to grade specialist output before it leaves the
 * department. Brand DNA is baked into the prompt at seed time per the
 * standing rule — no runtime merge.
 *
 * Collection: `managerGoldenMasters` (sub-collection of the platform org)
 * Doc IDs:    `mgm_{managerId}_{industryKey}_v{version}`
 *
 * @module training/manager-golden-master-service
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { buildBrandDNABlock, swapBrandDNABlock } from '@/lib/brand/rebake-brand-dna';
import type { BrandDNA } from '@/lib/brand/brand-dna-service';
import type { ManagerGoldenMaster } from '@/types/training';
import { applySectionEdit } from '@/lib/training/section-edit-match';

// ============================================================================
// CONSTANTS
// ============================================================================

const MANAGER_GM_COLLECTION = 'managerGoldenMasters';
const GM_CACHE_TTL_MS = 60_000;

function getGMCollectionPath(): string {
  return getSubCollection(MANAGER_GM_COLLECTION);
}

/**
 * Returns true if the input ID is a manager (ends in `_MANAGER`). Used by
 * the grade-submission service to branch between specialist and manager
 * GM lookup paths so a single Mission Control grade route can target both
 * agent kinds (the StepGradeWidget picker offers both as targets).
 */
export function isManagerId(id: string): boolean {
  return id.endsWith('_MANAGER');
}

function buildManagerGMDocId(managerId: string, industryKey: string, version: number): string {
  return `mgm_${managerId.toLowerCase()}_${industryKey}_v${version}`;
}

// ============================================================================
// IN-MEMORY CACHE (60-second TTL, matches specialist service)
// ============================================================================

interface GMCacheEntry {
  data: ManagerGoldenMaster;
  timestamp: number;
}

const industryGMCache = new Map<string, GMCacheEntry>();

function gmCacheKey(managerId: string, industryKey: string): string {
  return `${managerId}:${industryKey}`;
}

// ============================================================================
// PUBLIC API — GETTERS
// ============================================================================

/**
 * Get the currently active Golden Master for a manager scoped to a specific
 * industry template. Used by the Phase 3 training-loop pipeline (operator
 * grades a manager step in Mission Control → submitGrade loads this GM →
 * Prompt Engineer proposes a surgical edit). The autonomous LLM-review path
 * that previously called this at runtime was deleted on 2026-05-08.
 *
 * Returns `null` if no active GM exists for this manager yet — caller is
 * responsible for surfacing the missing-seed condition.
 *
 * 60-second in-memory cache keyed by `${managerId}:${industryKey}`.
 */
export async function getActiveManagerGMByIndustry(
  managerId: string,
  industryKey: string,
): Promise<ManagerGoldenMaster | null> {
  const cacheKey = gmCacheKey(managerId, industryKey);
  const cached = industryGMCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < GM_CACHE_TTL_MS) {
    return cached.data;
  }

  if (!adminDb) { return null; }

  const collection = adminDb.collection(getGMCollectionPath());
  const snapshot = await collection
    .where('managerId', '==', managerId)
    .where('industryKey', '==', industryKey)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snapshot.empty) {
    industryGMCache.delete(cacheKey);
    return null;
  }

  const data = snapshot.docs[0].data() as ManagerGoldenMaster;
  industryGMCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

/**
 * List all active Manager Golden Masters across all managers/industries.
 * Used by Training Lab UI and by the `verify-manager-gm-injection.ts` audit.
 */
export async function listActiveManagerGMs(): Promise<ManagerGoldenMaster[]> {
  if (!adminDb) { return []; }

  const snapshot = await adminDb
    .collection(getGMCollectionPath())
    .where('isActive', '==', true)
    .orderBy('managerId')
    .get();

  return snapshot.docs.map((doc) => doc.data() as ManagerGoldenMaster);
}

/**
 * Get a specific Manager Golden Master by its doc ID. Used by version
 * history and rollback flows in the Training Lab.
 */
export async function getManagerGMById(
  docId: string,
): Promise<ManagerGoldenMaster | null> {
  if (!adminDb) { return null; }

  const doc = await adminDb.collection(getGMCollectionPath()).doc(docId).get();
  if (!doc.exists) { return null; }
  return doc.data() as ManagerGoldenMaster;
}

// ============================================================================
// PUBLIC API — CACHE INVALIDATION
// ============================================================================

/**
 * Invalidate the industry-scoped GM cache for a given manager+industry pair.
 * Called after a new GM version is deployed (Phase 3 grading pipeline) so
 * the next request reloads from Firestore.
 */
export function invalidateManagerGMCache(managerId: string, industryKey: string): void {
  industryGMCache.delete(gmCacheKey(managerId, industryKey));
}

/**
 * Clear the entire Manager GM cache. Used by tests and by operator-triggered
 * full reload from the Training Lab.
 */
export function clearManagerGMCache(): void {
  industryGMCache.clear();
}

// ============================================================================
// PUBLIC API — VERSION LISTING (Phase 3 grading pipeline)
// ============================================================================

/**
 * List all Golden Master versions for a manager scoped to an industry,
 * sorted newest-first. Includes both active and deactivated versions so
 * the rollback UI can show the full history. Mirrors the specialist
 * service's `listIndustryGMVersions`.
 */
export async function listManagerGMVersions(
  managerId: string,
  industryKey: string,
): Promise<ManagerGoldenMaster[]> {
  if (!adminDb) { return []; }

  const snapshot = await adminDb
    .collection(getGMCollectionPath())
    .where('managerId', '==', managerId)
    .where('industryKey', '==', industryKey)
    .get();

  const versions = snapshot.docs.map((doc) => doc.data() as ManagerGoldenMaster);
  versions.sort((a, b) => b.version - a.version);
  return versions;
}

// ============================================================================
// PUBLIC API — VERSIONING (Phase 3 grade-to-edit pipeline)
// ============================================================================

/**
 * Create a new versioned Manager GM by applying a surgical prompt edit from
 * the Prompt Engineer. The edit replaces an exact verbatim substring
 * (`currentText`) in the active GM's systemPrompt with `proposedText`.
 * No other fields change.
 *
 * The new version is created with isActive=false. The caller calls
 * `deployManagerGMVersion` after human approval to activate it.
 *
 * Returns the new GM record, or null if the active GM cannot be found.
 * Throws if the currentText doesn't appear verbatim in the active prompt
 * (matches specialist service behavior — the Prompt Engineer must have
 * hallucinated the section, refusing to write).
 *
 * Mirrors `createIndustryGMVersionFromEdit` in the specialist service.
 */
export async function createManagerGMVersionFromEdit(
  managerId: string,
  industryKey: string,
  edit: {
    currentText: string;
    proposedText: string;
    rationale: string;
    sourceTrainingFeedbackId: string;
  },
  createdBy: string,
): Promise<ManagerGoldenMaster | null> {
  if (!adminDb) { return null; }

  const activeGM = await getActiveManagerGMByIndustry(managerId, industryKey);
  if (!activeGM) {
    logger.error(
      '[ManagerGMService] No active manager GM found — cannot create new version',
      undefined,
      { managerId, industryKey },
    );
    return null;
  }

  const rawSystemPrompt = activeGM.config.systemPrompt;
  const currentPrompt = typeof rawSystemPrompt === 'string'
    ? rawSystemPrompt
    : activeGM.systemPromptSnapshot ?? '';
  if (!currentPrompt) {
    logger.error(
      '[ManagerGMService] Active manager GM has no systemPrompt — cannot apply edit',
      undefined,
      { managerId, industryKey, gmId: activeGM.id },
    );
    return null;
  }

  // Locate the edited section (exact, then whitespace-tolerant) and apply it — refuse
  // to write if it can't be found uniquely, but don't fail the approval on trivial
  // whitespace drift in the Prompt Engineer's quote.
  const newPrompt = applySectionEdit(currentPrompt, edit.currentText, edit.proposedText);
  if (newPrompt === null) {
    throw new Error(
      `createManagerGMVersionFromEdit: could not uniquely locate the edited section in active GM ${activeGM.id} ` +
      `(the Prompt Engineer's quoted text did not match, even allowing for whitespace). Refusing to write.`,
    );
  }
  const newVersion = activeGM.version + 1;
  const newDocId = buildManagerGMDocId(managerId, industryKey, newVersion);

  const now = new Date().toISOString();
  const newConfig = {
    ...activeGM.config,
    systemPrompt: newPrompt,
  };

  const newGM: ManagerGoldenMaster = {
    ...activeGM,
    id: newDocId,
    managerId,
    industryKey,
    version: newVersion,
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
    `[ManagerGMService] Created v${newVersion} for ${managerId}:${industryKey} from Prompt Engineer edit`,
    { managerId, industryKey, version: newVersion, newDocId },
  );

  return newGM;
}

/**
 * Create a new MANAGER GM version that changes ONLY the LLM model
 * (config.model), preserving the systemPrompt + baked-in Brand DNA. This is
 * operator-initiated config (exempt from the grade-gated prompt pipeline), but
 * versioned so a model swap that hurts behavior can be rolled back via
 * deployManagerGMVersion. Created inactive; deploy it to activate.
 */
export async function createManagerGMVersionFromModelChange(
  managerId: string,
  industryKey: string,
  newModel: string,
  createdBy: string,
): Promise<ManagerGoldenMaster | null> {
  if (!adminDb) { return null; }

  const activeGM = await getActiveManagerGMByIndustry(managerId, industryKey);
  if (!activeGM) {
    logger.error(
      '[ManagerGMService] No active manager GM found — cannot change model',
      undefined,
      { managerId, industryKey },
    );
    return null;
  }

  const previousModel = typeof activeGM.config.model === 'string'
    ? activeGM.config.model
    : 'claude-sonnet-4.6';
  if (previousModel === newModel) {
    return activeGM; // No-op
  }

  const newVersion = activeGM.version + 1;
  const newDocId = buildManagerGMDocId(managerId, industryKey, newVersion);
  const now = new Date().toISOString();
  const newConfig = {
    ...activeGM.config,
    model: newModel,
  };

  const newGM: ManagerGoldenMaster = {
    ...activeGM,
    id: newDocId,
    managerId,
    industryKey,
    version: newVersion,
    config: newConfig,
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
    `[ManagerGMService] Created v${newVersion} for ${managerId}:${industryKey} (model ${previousModel} -> ${newModel})`,
    { managerId, industryKey, version: newVersion, newDocId },
  );

  return newGM;
}

/**
 * Create a new MANAGER GM version that refreshes ONLY the baked Brand DNA block,
 * leaving the department charter base body AND any human training edits intact.
 *
 * Operator-initiated (Brand voice refresh from Brand settings) — exempt from the
 * grade-gated prompt pipeline (Standing Rule #2 guards prompt-body drift, not the
 * Brand DNA block Settings owns), but versioned + rollbackable via
 * deployManagerGMVersion. Created inactive; deploy it to activate.
 *
 * Swaps only the trailing Brand DNA block (Standing Rule #1) via
 * `swapBrandDNABlock`. If the active GM has no Brand DNA marker, this is a
 * seed-time anomaly — we log and return null rather than append a second block.
 * Keeps `brandDNASnapshot` in lock-step with the freshly baked block.
 */
export async function createManagerGMVersionFromBrandRebake(
  managerId: string,
  industryKey: string,
  newBrandDNA: BrandDNA,
  createdBy: string,
): Promise<ManagerGoldenMaster | null> {
  if (!adminDb) { return null; }

  const activeGM = await getActiveManagerGMByIndustry(managerId, industryKey);
  if (!activeGM) {
    logger.error(
      '[ManagerGMService] No active manager GM found — cannot re-bake Brand DNA',
      undefined,
      { managerId, industryKey },
    );
    return null;
  }

  const rawSystemPrompt = activeGM.config.systemPrompt;
  const currentPrompt = typeof rawSystemPrompt === 'string'
    ? rawSystemPrompt
    : activeGM.systemPromptSnapshot ?? '';
  if (!currentPrompt) {
    logger.error(
      '[ManagerGMService] Active manager GM has no systemPrompt — cannot re-bake Brand DNA',
      undefined,
      { managerId, industryKey, gmId: activeGM.id },
    );
    return null;
  }

  const { newPrompt, replaced } = swapBrandDNABlock(currentPrompt, buildBrandDNABlock(newBrandDNA));
  if (!replaced) {
    logger.error(
      '[ManagerGMService] Active manager GM has no Brand DNA marker — refusing to re-bake (would double-bake)',
      undefined,
      { managerId, industryKey, gmId: activeGM.id },
    );
    return null;
  }

  const newVersion = activeGM.version + 1;
  const newDocId = buildManagerGMDocId(managerId, industryKey, newVersion);
  const now = new Date().toISOString();
  const newConfig = {
    ...activeGM.config,
    systemPrompt: newPrompt,
  };

  const newGM: ManagerGoldenMaster = {
    ...activeGM,
    id: newDocId,
    managerId,
    industryKey,
    version: newVersion,
    config: newConfig,
    systemPromptSnapshot: newPrompt,
    brandDNASnapshot: newBrandDNA,
    sourceImprovementRequestId: `brand-rebake-${now}`,
    changesApplied: [
      {
        field: 'brandDNA',
        currentValue: activeGM.brandDNASnapshot ?? null,
        proposedValue: newBrandDNA,
        reason: 'Brand voice refresh from Brand settings',
        confidence: 1,
      },
    ],
    isActive: false,
    createdAt: now,
    createdBy,
    notes: 'Brand DNA re-bake from Brand settings. Not yet deployed.',
    previousVersion: activeGM.version,
  };

  await adminDb.collection(getGMCollectionPath()).doc(newDocId).set(newGM);

  logger.info(
    `[ManagerGMService] Created v${newVersion} for ${managerId}:${industryKey} from Brand DNA re-bake`,
    { managerId, industryKey, version: newVersion, newDocId },
  );

  return newGM;
}

// ============================================================================
// PUBLIC API — DEPLOY (Phase 3 grading pipeline)
// ============================================================================

/**
 * Deploy a specific manager GM version. Deactivates any other active
 * versions for the same (managerId, industryKey) pair and activates the
 * target. Runs in a Firestore batch. Invalidates the cache.
 *
 * Signature mirrors `deployIndustryGMVersion` in the specialist service —
 * takes a version number, returns `{ success, error? }`.
 */
export async function deployManagerGMVersion(
  managerId: string,
  industryKey: string,
  targetVersion: number,
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'adminDb not initialized' };
  }

  const collection = adminDb.collection(getGMCollectionPath());
  const targetDocId = buildManagerGMDocId(managerId, industryKey, targetVersion);
  const targetDoc = await collection.doc(targetDocId).get();
  if (!targetDoc.exists) {
    return { success: false, error: `Manager GM v${targetVersion} not found for ${managerId}:${industryKey}` };
  }

  const activeSnap = await collection
    .where('managerId', '==', managerId)
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
  invalidateManagerGMCache(managerId, industryKey);

  logger.info(
    `[ManagerGMService] Deployed v${targetVersion} for ${managerId}:${industryKey}`,
    { managerId, industryKey, version: targetVersion },
  );
  return { success: true };
}
