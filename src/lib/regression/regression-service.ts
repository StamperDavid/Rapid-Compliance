/**
 * Regression Service — Firestore CRUD for the Model Regression Harness
 *
 * Stores:
 *   - regressionCases     — curated test cases keyed by agentId + caseId
 *   - regressionRuns      — full run artifacts for forensic review
 *
 * Both collections are platform-sub-collections (multi-tenant ready via
 * getSubCollection — no hardcoded PLATFORM_ID).
 *
 * All writes use the Admin SDK only. The client SDK has no auth context in
 * server runtime and would silently fail under Firestore rules.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type {
  RegressionCase,
  RegressionBaseline,
  RegressionRun,
  CaptureSignature,
} from '@/types/regression';

const FILE = 'regression/regression-service.ts';

const CASES_COLLECTION = 'regressionCases';
const RUNS_COLLECTION = 'regressionRuns';

function getCasesPath(): string {
  return getSubCollection(CASES_COLLECTION);
}

function getRunsPath(): string {
  return getSubCollection(RUNS_COLLECTION);
}

function requireDb() {
  if (!adminDb) {
    throw new Error('[RegressionService] adminDb is not initialized');
  }
  return adminDb;
}

// ============================================================================
// CASE CRUD
// ============================================================================

/**
 * Create a new regression case. Fails if caseId already exists — overwrites
 * are explicit and must go through updateCase.
 */
export async function createCase(
  input: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'> & {
    baselines?: Record<string, RegressionBaseline>;
  },
): Promise<RegressionCase> {
  const db = requireDb();
  const ref = db.collection(getCasesPath()).doc(input.caseId);
  const existing = await ref.get();
  if (existing.exists) {
    throw new Error(
      `[RegressionService] Case "${input.caseId}" already exists. Use updateCase to modify.`,
    );
  }

  const now = new Date().toISOString();
  const doc: RegressionCase = {
    ...input,
    baselines: input.baselines ?? {},
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(doc);
  logger.info(`[RegressionService] Created case ${input.caseId} for agent ${input.agentId}`, { file: FILE });
  return doc;
}

/**
 * Overwrite every field of a case EXCEPT `baselines`, preserving the baseline
 * snapshots recorded against the prior definition. Used by seed --force so
 * updating tolerances, notes, or inputs never wipes accumulated baselines.
 */
export async function upsertCasePreservingBaselines(
  input: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>,
): Promise<RegressionCase> {
  const db = requireDb();
  const ref = db.collection(getCasesPath()).doc(input.caseId);
  const snap = await ref.get();
  const now = new Date().toISOString();

  if (!snap.exists) {
    const created: RegressionCase = {
      ...input,
      baselines: {},
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(created);
    logger.info(`[RegressionService] Upserted new case ${input.caseId}`, { file: FILE });
    return created;
  }

  const existing = snap.data() as RegressionCase;
  const merged: RegressionCase = {
    ...input,
    baselines: existing.baselines ?? {},
    createdAt: existing.createdAt,
    updatedAt: now,
  };
  await ref.set(merged);
  logger.info(
    `[RegressionService] Upserted case ${input.caseId} (preserved ${Object.keys(merged.baselines).length} baselines)`,
    { file: FILE },
  );
  return merged;
}

export async function getCase(caseId: string): Promise<RegressionCase | null> {
  const db = requireDb();
  const snap = await db.collection(getCasesPath()).doc(caseId).get();
  if (!snap.exists) {return null;}
  return snap.data() as RegressionCase;
}

/**
 * Load all active cases for an agent, ordered by caseId for stable runs.
 */
export async function listActiveCasesForAgent(agentId: string): Promise<RegressionCase[]> {
  const db = requireDb();
  const snap = await db
    .collection(getCasesPath())
    .where('agentId', '==', agentId)
    .where('active', '==', true)
    .get();
  const cases: RegressionCase[] = snap.docs.map((d) => d.data() as RegressionCase);
  cases.sort((a, b) => a.caseId.localeCompare(b.caseId));
  return cases;
}

/**
 * Store a baseline for a (case × model) pair. By default refuses to
 * overwrite an existing baseline — pass overwrite=true to replace.
 */
export async function recordBaseline(
  caseId: string,
  baseline: RegressionBaseline,
  overwrite: boolean,
): Promise<void> {
  const db = requireDb();
  const ref = db.collection(getCasesPath()).doc(caseId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`[RegressionService] Cannot record baseline — case "${caseId}" not found`);
  }
  const existing = snap.data() as RegressionCase;
  const priorBaseline = existing.baselines?.[baseline.modelId];
  if (priorBaseline && !overwrite) {
    throw new Error(
      `[RegressionService] Baseline for case "${caseId}" on model "${baseline.modelId}" already exists ` +
      `(recorded ${priorBaseline.recordedAt} by ${priorBaseline.recordedBy}). ` +
      `Pass --overwrite-baseline to replace it.`,
    );
  }
  // Read-modify-write the whole baselines map. Firestore update-paths cannot
  // contain '/', and OpenRouter model ids contain slashes (e.g.
  // 'anthropic/claude-sonnet-4'), so we can't use dotted field paths here.
  const nextBaselines = {
    ...(existing.baselines ?? {}),
    [baseline.modelId]: baseline,
  };
  await ref.update({
    baselines: nextBaselines,
    updatedAt: new Date().toISOString(),
  });
  logger.info(
    `[RegressionService] Recorded baseline for case ${caseId} on ${baseline.modelId}`,
    { file: FILE, overwrote: Boolean(priorBaseline) },
  );
}

export async function getBaseline(
  caseId: string,
  modelId: string,
): Promise<RegressionBaseline | null> {
  const doc = await getCase(caseId);
  if (!doc) {return null;}
  return doc.baselines?.[modelId] ?? null;
}

// ============================================================================
// RUN CRUD
// ============================================================================

export async function createRun(run: RegressionRun): Promise<void> {
  const db = requireDb();
  await db.collection(getRunsPath()).doc(run.runId).set(run);
  logger.info(
    `[RegressionService] Created run ${run.runId} (${run.agentId}: ${run.baselineModelId} -> ${run.candidateModelId})`,
    { file: FILE },
  );
}

export async function getRun(runId: string): Promise<RegressionRun | null> {
  const db = requireDb();
  const snap = await db.collection(getRunsPath()).doc(runId).get();
  if (!snap.exists) {return null;}
  return snap.data() as RegressionRun;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a stable baseline object. The signature is the single most important
 * field — it is the ground truth future runs diff against.
 */
export function buildBaseline(
  modelId: string,
  recordedBy: string,
  signature: CaptureSignature,
  runIds: string[],
  notes?: string,
): RegressionBaseline {
  return {
    modelId,
    recordedAt: new Date().toISOString(),
    recordedBy,
    signature,
    runIds,
    notes,
  };
}
