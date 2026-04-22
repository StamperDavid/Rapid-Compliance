/**
 * Jasper Golden Master Service
 *
 * Version management for Jasper's orchestrator Golden Master. This service is
 * the direct parallel of `specialist-golden-master-service.ts`, but WITHOUT an
 * `industryKey` dimension — Jasper is the tenant-wide orchestrator and is not
 * scoped by industry.
 *
 * Differences from the specialist service that are load-bearing for readers:
 *
 *   - Collection is `goldenMasters` (the shared orchestrator/managers
 *     collection), filtered by `agentType === 'orchestrator'`, NOT
 *     `specialistGoldenMasters`.
 *   - `systemPrompt` is a TOP-LEVEL field on the Firestore doc, not nested in
 *     `config.systemPrompt` like specialists.
 *   - The legacy seed doc uses `version: 'v1'` as a string. Because we cannot
 *     safely redefine that existing field without migrating every downstream
 *     reader, we introduce a NEW numeric field `versionNumber` for ordering,
 *     comparison, and rollback. When we write a new version we ALSO mirror
 *     `version: 'v${versionNumber}'` so the legacy display field stays in sync.
 *   - Doc ID pattern for new versions: `jasper_orchestrator_v{N}`.
 *
 * Standing rule #2 ("no grades = no GM changes") is enforced at the call site
 * — `createJasperGMVersionFromEdit` requires a `sourceFeedbackId`, which
 * can only be produced by a human grade or operator plan-edit event.
 *
 * @module training/jasper-golden-master-service
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import {
  getActiveJasperGoldenMaster,
  invalidateJasperGMCache as invalidateJasperGMCacheFromLoader,
} from '@/lib/orchestrator/jasper-golden-master';

// ============================================================================
// CONSTANTS + INTERNAL HELPERS
// ============================================================================

const JASPER_GM_COLLECTION = 'goldenMasters';
const JASPER_AGENT_TYPE = 'orchestrator' as const;
const JASPER_DOC_ID_PREFIX = 'jasper_orchestrator_v';

function getGMCollectionPath(): string {
  return getSubCollection(JASPER_GM_COLLECTION);
}

function buildJasperGMDocId(versionNumber: number): string {
  return `${JASPER_DOC_ID_PREFIX}${versionNumber}`;
}

function buildVersionLabel(versionNumber: number): string {
  return `v${versionNumber}`;
}

/**
 * Parse the legacy `version` string (e.g. `'v3'`) or any numeric-ish value
 * into a numeric version. We only use this to interpret the legacy seed doc
 * that predates the introduction of `versionNumber`. If both fields are
 * present, `versionNumber` always wins.
 */
function parseLegacyVersionString(raw: unknown, fallback: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === 'string') {
    const match = raw.match(/(\d+)/);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed)) { return parsed; }
    }
  }
  return fallback;
}

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/**
 * One Jasper Golden Master version record. Returned to API routes, the
 * rollback UI, and the plan-feedback approve pipeline.
 *
 * `versionNumber` is the primary numeric identifier and what every comparison
 * / sort / rollback references. `version` is kept as a legacy display alias
 * (`'v3'`, etc.) for backward compatibility with the seeded doc and any UI
 * that still reads the old field.
 */
export interface JasperGoldenMasterVersion {
  id: string;
  agentType: 'orchestrator';
  versionNumber: number;
  /** Legacy display field — mirrors `v${versionNumber}`. Kept for back-compat. */
  version?: string;
  systemPrompt: string;
  agentPersona?: unknown;
  behaviorConfig?: unknown;
  knowledgeBase?: unknown;
  isActive: boolean;
  previousVersion?: number;
  sourceFeedbackId?: string | null;
  changesApplied?: Array<{ field: string; currentValue: string; proposedValue: string; reason: string }>;
  systemPromptSnapshot?: string;
  createdAt: string;
  createdBy: string;
  deployedAt?: string;
  deactivatedAt?: string;
  deactivatedReason?: string;
  notes?: string;
}

/**
 * Internal shape of the raw Firestore doc. Every field is optional because
 * legacy docs predate this service and may not include every current field.
 */
interface JasperGMFirestoreDoc {
  agentType?: string;
  versionNumber?: unknown;
  version?: unknown;
  systemPrompt?: string;
  agentPersona?: unknown;
  behaviorConfig?: unknown;
  knowledgeBase?: unknown;
  isActive?: boolean;
  previousVersion?: number;
  sourceFeedbackId?: string | null;
  /** Legacy name retained for old docs written before the spec converged. */
  sourceTrainingFeedbackId?: string | null;
  changesApplied?: Array<{ field: string; currentValue: string; proposedValue: string; reason: string }>;
  systemPromptSnapshot?: string;
  createdAt?: string;
  createdBy?: string;
  deployedAt?: string;
  deactivatedAt?: string;
  deactivatedReason?: string;
  notes?: string;
}

/**
 * Normalize a raw Firestore doc into a typed `JasperGoldenMasterVersion`.
 * `versionNumber` is resolved as: numeric `versionNumber` field → legacy
 * string `version` field → fallback 1 (the implicit seed version).
 */
function toJasperGMVersion(id: string, raw: JasperGMFirestoreDoc): JasperGoldenMasterVersion {
  const numericFromVersionNumber = typeof raw.versionNumber === 'number' && Number.isFinite(raw.versionNumber)
    ? Math.trunc(raw.versionNumber)
    : null;
  const versionNumber = numericFromVersionNumber ?? parseLegacyVersionString(raw.version, 1);
  const legacyVersionString = typeof raw.version === 'string'
    ? raw.version
    : buildVersionLabel(versionNumber);

  const sourceFeedbackId = raw.sourceFeedbackId ?? raw.sourceTrainingFeedbackId ?? null;

  return {
    id,
    agentType: JASPER_AGENT_TYPE,
    versionNumber,
    version: legacyVersionString,
    systemPrompt: raw.systemPrompt ?? '',
    agentPersona: raw.agentPersona,
    behaviorConfig: raw.behaviorConfig,
    knowledgeBase: raw.knowledgeBase,
    isActive: Boolean(raw.isActive),
    previousVersion: raw.previousVersion,
    sourceFeedbackId,
    changesApplied: raw.changesApplied,
    systemPromptSnapshot: raw.systemPromptSnapshot,
    createdAt: raw.createdAt ?? '',
    createdBy: raw.createdBy ?? '',
    deployedAt: raw.deployedAt,
    deactivatedAt: raw.deactivatedAt,
    deactivatedReason: raw.deactivatedReason,
    notes: raw.notes,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Invalidate the Jasper GM in-memory cache. Re-exported from
 * `jasper-golden-master.ts` so callers that deploy or roll back a version
 * have a single import site. The actual cache state lives in the loader
 * module and is NOT duplicated here.
 */
export function invalidateJasperGMCache(): void {
  invalidateJasperGMCacheFromLoader();
}

/**
 * Return every Jasper Golden Master ever written (active + deactivated),
 * sorted newest-first by `versionNumber`. Backs the rollback UI and version
 * history panel.
 *
 * The `goldenMasters` collection holds other agent types (managers, etc.), so
 * we always filter by `agentType === 'orchestrator'`. We do NOT use a
 * Firestore `orderBy` clause — that would require a composite index for every
 * new filter combination. Jasper has at most a handful of versions, so we sort
 * client-side. Keeps deploys friction-free.
 */
export async function listJasperGMVersions(): Promise<JasperGoldenMasterVersion[]> {
  if (!adminDb) { return []; }

  const snapshot = await adminDb
    .collection(getGMCollectionPath())
    .where('agentType', '==', JASPER_AGENT_TYPE)
    .get();

  const versions = snapshot.docs.map((doc) =>
    toJasperGMVersion(doc.id, doc.data() as JasperGMFirestoreDoc),
  );

  versions.sort((a, b) => b.versionNumber - a.versionNumber);
  return versions;
}

/**
 * Create a new versioned Jasper GM by applying a surgical Prompt Engineer
 * edit to the currently active Jasper GM's `systemPrompt`. The edit replaces
 * one exact verbatim substring (`currentText`) with `proposedText` — no other
 * fields of the GM are modified.
 *
 * Invariant: `currentText` must appear verbatim in the active systemPrompt.
 * If it doesn't, we refuse to write — the Prompt Engineer has hallucinated
 * the target section and silently applying the edit would corrupt Jasper's
 * prompt.
 *
 * The new doc lands with `isActive: false`. The caller must call
 * `deployJasperGMVersion` after human approval to activate it (this is the
 * gate required by standing rule #2).
 *
 * Returns the new record, or null if no active Jasper GM exists or Firestore
 * is unavailable. Throws if the verbatim invariant is violated.
 */
export async function createJasperGMVersionFromEdit(
  edit: {
    currentText: string;
    proposedText: string;
    rationale: string;
    sourceFeedbackId: string;
  },
  createdBy: string,
): Promise<JasperGoldenMasterVersion | null> {
  if (!adminDb) { return null; }

  const activeGM = await getActiveJasperGoldenMaster();
  if (!activeGM) {
    logger.error(
      '[JasperGMService] No active Jasper GM found — cannot create new version',
      undefined,
      { sourceFeedbackId: edit.sourceFeedbackId },
    );
    return null;
  }

  const currentPrompt = activeGM.systemPrompt;
  if (!currentPrompt) {
    logger.error(
      '[JasperGMService] Active Jasper GM has no systemPrompt — cannot apply edit',
      undefined,
      { gmId: activeGM.id },
    );
    return null;
  }

  // Hard invariant — refuse to write if the target section doesn't exist.
  if (!currentPrompt.includes(edit.currentText)) {
    throw new Error(
      `createJasperGMVersionFromEdit: currentText does not appear verbatim in active Jasper GM ${activeGM.id}. ` +
      `The Prompt Engineer must have hallucinated the section. Refusing to write.`,
    );
  }

  const newSystemPrompt = currentPrompt.replace(edit.currentText, edit.proposedText);

  // Scan all existing versions and pick max + 1. Resilient to someone having
  // written an out-of-band v2 by hand.
  const existingVersions = await listJasperGMVersions();
  const activeVersionNumber = existingVersions.find((v) => v.isActive)?.versionNumber
    ?? parseLegacyVersionString(activeGM.version, 1);
  const highestVersionNumber = existingVersions.length > 0
    ? Math.max(...existingVersions.map((v) => v.versionNumber))
    : activeVersionNumber;
  const newVersionNumber = highestVersionNumber + 1;
  const newDocId = buildJasperGMDocId(newVersionNumber);
  const now = new Date().toISOString();

  const newRecord: JasperGoldenMasterVersion = {
    id: newDocId,
    agentType: JASPER_AGENT_TYPE,
    versionNumber: newVersionNumber,
    version: buildVersionLabel(newVersionNumber),
    systemPrompt: newSystemPrompt,
    systemPromptSnapshot: newSystemPrompt,
    agentPersona: activeGM.agentPersona,
    behaviorConfig: activeGM.behaviorConfig,
    knowledgeBase: activeGM.knowledgeBase,
    isActive: false,
    previousVersion: activeVersionNumber,
    sourceFeedbackId: edit.sourceFeedbackId,
    changesApplied: [
      {
        field: 'systemPrompt',
        currentValue: edit.currentText,
        proposedValue: edit.proposedText,
        reason: edit.rationale,
      },
    ],
    createdAt: now,
    createdBy,
    notes: `Created from Prompt Engineer edit (feedback ${edit.sourceFeedbackId}). Not yet deployed. Rationale: ${edit.rationale}`,
  };

  // Build the Firestore payload. We explicitly list every field so Firestore
  // doesn't serialize any undefined properties (it rejects undefined at write).
  const firestorePayload: Record<string, unknown> = {
    agentType: newRecord.agentType,
    versionNumber: newRecord.versionNumber,
    version: newRecord.version,
    systemPrompt: newRecord.systemPrompt,
    systemPromptSnapshot: newRecord.systemPromptSnapshot,
    isActive: newRecord.isActive,
    previousVersion: newRecord.previousVersion,
    sourceFeedbackId: newRecord.sourceFeedbackId,
    changesApplied: newRecord.changesApplied,
    createdAt: newRecord.createdAt,
    createdBy: newRecord.createdBy,
    notes: newRecord.notes,
  };
  if (newRecord.agentPersona !== undefined) { firestorePayload.agentPersona = newRecord.agentPersona; }
  if (newRecord.behaviorConfig !== undefined) { firestorePayload.behaviorConfig = newRecord.behaviorConfig; }
  if (newRecord.knowledgeBase !== undefined) { firestorePayload.knowledgeBase = newRecord.knowledgeBase; }

  await adminDb.collection(getGMCollectionPath()).doc(newDocId).set(firestorePayload);

  logger.info(
    `[JasperGMService] Created Jasper GM v${newVersionNumber} from Prompt Engineer edit`,
    {
      newDocId,
      versionNumber: newVersionNumber,
      previousVersion: activeVersionNumber,
      sourceFeedbackId: edit.sourceFeedbackId,
      promptLength: newSystemPrompt.length,
    },
  );

  return newRecord;
}

/**
 * Deploy a specific Jasper GM version. Runs as a single Firestore batch:
 *   - Loads the target doc by ID `jasper_orchestrator_v{N}`.
 *   - Queries every currently-active orchestrator GM.
 *   - Deactivates all of them except the target.
 *   - Activates the target with `deployedAt = now`.
 *
 * After commit, invalidates the in-memory cache in `jasper-golden-master.ts`
 * so the next Jasper request reloads the new active version. Without the
 * cache invalidation the new GM would be invisible for up to 60 seconds.
 */
export async function deployJasperGMVersion(
  targetVersionNumber: number,
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'adminDb not initialized' };
  }

  const collection = adminDb.collection(getGMCollectionPath());
  const targetDocId = buildJasperGMDocId(targetVersionNumber);
  const targetDoc = await collection.doc(targetDocId).get();
  if (!targetDoc.exists) {
    return {
      success: false,
      error: `Jasper GM v${targetVersionNumber} not found (doc id ${targetDocId})`,
    };
  }

  const activeSnap = await collection
    .where('agentType', '==', JASPER_AGENT_TYPE)
    .where('isActive', '==', true)
    .get();

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  let deactivatedCount = 0;
  for (const doc of activeSnap.docs) {
    if (doc.id === targetDocId) { continue; }
    batch.update(doc.ref, {
      isActive: false,
      deactivatedAt: now,
      deactivatedReason: `superseded by ${targetDocId}`,
    });
    deactivatedCount += 1;
  }

  batch.update(collection.doc(targetDocId), {
    isActive: true,
    deployedAt: now,
  });

  await batch.commit();
  invalidateJasperGMCache();

  logger.info(
    `[JasperGMService] Deployed Jasper GM v${targetVersionNumber}`,
    { targetDocId, versionNumber: targetVersionNumber, deactivatedCount },
  );

  return { success: true };
}

/**
 * Roll back the active Jasper GM to a named older version. Functionally
 * identical to `deployJasperGMVersion` — rollback IS deploy — but logs with
 * a distinctive marker so the audit trail distinguishes "operator shipped a
 * new edit" from "operator panicked and reverted an edit". Used by the
 * Mission Control rollback UI.
 */
export async function rollbackJasperGMToVersion(
  targetVersionNumber: number,
): Promise<{ success: boolean; error?: string }> {
  logger.info(
    `[JasperGMService] ROLLBACK requested — reverting Jasper GM to v${targetVersionNumber}`,
    { targetVersionNumber, docId: buildJasperGMDocId(targetVersionNumber) },
  );

  const result = await deployJasperGMVersion(targetVersionNumber);
  if (result.success) {
    logger.info(
      `[JasperGMService] ROLLBACK COMPLETE — Jasper GM is now v${targetVersionNumber}`,
      { targetVersionNumber, docId: buildJasperGMDocId(targetVersionNumber) },
    );
  } else {
    logger.error(
      `[JasperGMService] ROLLBACK FAILED — cannot revert Jasper GM to v${targetVersionNumber}`,
      undefined,
      { targetVersionNumber, error: result.error },
    );
  }
  return result;
}
