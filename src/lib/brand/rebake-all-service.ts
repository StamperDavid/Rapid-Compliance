/**
 * Re-bake ALL Golden Masters — reusable server function.
 *
 * This is the server-side port of `scripts/rebake-all-gms-brand-dna.ts`. It bakes
 * the CURRENT org Brand DNA into EVERY active Golden Master — all specialists, all
 * managers, AND Jasper (the orchestrator) — using the proven surgical re-bake path
 * (`swapBrandDNABlock`), which swaps ONLY the trailing Brand DNA block of each GM's
 * systemPrompt (Standing Rule #1) and leaves the industry base body AND any human
 * training edits BYTE-IDENTICAL (Standing Rule #2).
 *
 * Unlike the CLI script, there is NO dry-run path here — this always applies. The
 * script's admin-init, CLI-flag parsing, console output, and `process.exit` logic
 * are intentionally dropped; that is script-only plumbing.
 *
 * Two exports:
 *   - `rebakeAllGoldenMasters` — the pure work function, with an optional
 *     per-target progress callback.
 *   - `runRebakeJob` — the detached runner used by API routes. Wraps
 *     `rebakeAllGoldenMasters` in try/catch and streams running counts into the
 *     job doc via `updateRebakeJob`. Never rethrows (it runs detached).
 *
 * @module brand/rebake-all-service
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getBrandDNA, type BrandDNA } from '@/lib/brand/brand-dna-service';
import { buildBrandDNABlock, swapBrandDNABlock } from '@/lib/brand/rebake-brand-dna';
import {
  createIndustryGMVersionFromBrandRebake,
  deployIndustryGMVersion,
  invalidateIndustryGMCache,
} from '@/lib/training/specialist-golden-master-service';
import {
  createManagerGMVersionFromBrandRebake,
  deployManagerGMVersion,
  invalidateManagerGMCache,
} from '@/lib/training/manager-golden-master-service';
import {
  createJasperGMVersionFromBrandRebake,
  deployJasperGMVersion,
  invalidateJasperGMCache,
} from '@/lib/training/jasper-golden-master-service';
import { getActiveJasperGoldenMaster } from '@/lib/orchestrator/jasper-golden-master';
import { updateRebakeJob, type RebakeJobFailure } from './rebake-job-service';

// ============================================================================
// CONSTANTS
// ============================================================================

const PLATFORM_ID = 'rapid-compliance-root';
const SPECIALIST_GM_COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const MANAGER_GM_COLLECTION = `organizations/${PLATFORM_ID}/managerGoldenMasters`;
const JASPER_TARGET_ID = 'orchestrator:JASPER:default';
const MAX_CONCURRENCY = 5;

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export type RebakeKind = 'specialist' | 'manager' | 'orchestrator';

export type RebakeStatus = 'rebaked' | 'skipped' | 'failed';

export interface RebakeTargetResult {
  id: string;
  kind: RebakeKind;
  status: RebakeStatus;
  fromVersion: number;
  toVersion?: number;
  error?: string;
}

export interface RebakeAllResult {
  total: number;
  rebaked: number;
  skipped: number;
  failed: number;
  results: RebakeTargetResult[];
}

export interface RebakeAllOptions {
  createdBy: string;
  onProgress?: (progress: {
    done: number;
    total: number;
    last: RebakeTargetResult;
  }) => void | Promise<void>;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

type GMAgentKind = 'specialist' | 'manager';

interface GMTarget {
  kind: GMAgentKind;
  /** specialistId or managerId */
  agentId: string;
  industryKey: string;
  currentVersion: number;
  currentSnapshot: BrandDNA | null;
}

// ============================================================================
// IDEMPOTENT-SKIP HELPERS (ported verbatim from the CLI script)
// ============================================================================

/**
 * Normalize a Brand DNA object to a stable string for deep-equality. Mutable
 * metadata (`updatedAt`, `updatedBy`) is dropped — only the semantic voice
 * fields matter for "is the bake already current?". Arrays are kept in order;
 * keys are sorted so JSON layout differences never cause a false diff.
 */
function normalizeBrandDNA(dna: BrandDNA | null): string {
  if (!dna) { return 'null'; }
  const semantic: Record<string, unknown> = {
    companyDescription: dna.companyDescription ?? '',
    uniqueValue: dna.uniqueValue ?? '',
    targetAudience: dna.targetAudience ?? '',
    toneOfVoice: dna.toneOfVoice ?? '',
    communicationStyle: dna.communicationStyle ?? '',
    keyPhrases: Array.isArray(dna.keyPhrases) ? dna.keyPhrases : [],
    avoidPhrases: Array.isArray(dna.avoidPhrases) ? dna.avoidPhrases : [],
    industry: dna.industry ?? '',
    competitors: Array.isArray(dna.competitors) ? dna.competitors : [],
  };
  const sortedKeys = Object.keys(semantic).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of sortedKeys) { ordered[k] = semantic[k]; }
  return JSON.stringify(ordered);
}

function brandDNAEquals(a: BrandDNA | null, b: BrandDNA | null): boolean {
  return normalizeBrandDNA(a) === normalizeBrandDNA(b);
}

function gmTargetId(t: GMTarget): string {
  return `${t.kind}:${t.agentId}:${t.industryKey}`;
}

/** Process items in chunks of at most `size`, awaiting each chunk fully. */
async function inChunks<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    const results = await Promise.all(chunk.map(fn));
    out.push(...results);
  }
  return out;
}

// ============================================================================
// ENUMERATION (ported from the CLI script)
// ============================================================================

async function enumerateSpecialists(): Promise<GMTarget[]> {
  if (!adminDb) { return []; }
  const snap = await adminDb
    .collection(SPECIALIST_GM_COLLECTION)
    .where('isActive', '==', true)
    .get();
  const targets: GMTarget[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as {
      specialistId?: string;
      industryKey?: string;
      version?: number;
      brandDNASnapshot?: BrandDNA;
    };
    if (!data.specialistId || !data.industryKey) {
      logger.warn('[RebakeAllService] Skipping malformed specialist GM (missing specialistId/industryKey)', {
        docId: doc.id,
      });
      continue;
    }
    targets.push({
      kind: 'specialist',
      agentId: data.specialistId,
      industryKey: data.industryKey,
      currentVersion: typeof data.version === 'number' ? data.version : 0,
      currentSnapshot: data.brandDNASnapshot ?? null,
    });
  }
  return targets;
}

async function enumerateManagers(): Promise<GMTarget[]> {
  if (!adminDb) { return []; }
  const snap = await adminDb
    .collection(MANAGER_GM_COLLECTION)
    .where('isActive', '==', true)
    .get();
  const targets: GMTarget[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as {
      managerId?: string;
      industryKey?: string;
      version?: number;
      brandDNASnapshot?: BrandDNA;
    };
    if (!data.managerId || !data.industryKey) {
      logger.warn('[RebakeAllService] Skipping malformed manager GM (missing managerId/industryKey)', {
        docId: doc.id,
      });
      continue;
    }
    targets.push({
      kind: 'manager',
      agentId: data.managerId,
      industryKey: data.industryKey,
      currentVersion: typeof data.version === 'number' ? data.version : 0,
      currentSnapshot: data.brandDNASnapshot ?? null,
    });
  }
  return targets;
}

// ============================================================================
// PER-TARGET PROCESSING
// ============================================================================

/**
 * Specialist/manager target: same APPLY-branch logic as the CLI script's
 * `processTarget` — idempotent skip, then create*FromBrandRebake → deploy →
 * invalidate → 'rebaked'; any throw → 'failed'.
 */
async function processGMTarget(
  target: GMTarget,
  brandDNA: BrandDNA,
  createdBy: string,
): Promise<RebakeTargetResult> {
  const label = gmTargetId(target);
  const base: RebakeTargetResult = {
    id: label,
    kind: target.kind,
    status: 'skipped',
    fromVersion: target.currentVersion,
  };

  // Idempotent skip — already baked with the current Brand DNA.
  if (brandDNAEquals(target.currentSnapshot, brandDNA)) {
    return base;
  }

  try {
    if (target.kind === 'specialist') {
      const created = await createIndustryGMVersionFromBrandRebake(
        target.agentId, target.industryKey, brandDNA, createdBy,
      );
      if (!created) {
        return {
          ...base,
          status: 'failed',
          error: 'createIndustryGMVersionFromBrandRebake returned null (no active GM or missing Brand DNA marker)',
        };
      }
      const deploy = await deployIndustryGMVersion(target.agentId, target.industryKey, created.version);
      if (!deploy.success) {
        return { ...base, status: 'failed', error: `deploy failed: ${deploy.error ?? 'unknown'}` };
      }
      invalidateIndustryGMCache(target.agentId, target.industryKey);
      return { ...base, status: 'rebaked', toVersion: created.version };
    }

    // manager
    const created = await createManagerGMVersionFromBrandRebake(
      target.agentId, target.industryKey, brandDNA, createdBy,
    );
    if (!created) {
      return {
        ...base,
        status: 'failed',
        error: 'createManagerGMVersionFromBrandRebake returned null (no active GM or missing Brand DNA marker)',
      };
    }
    const deploy = await deployManagerGMVersion(target.agentId, target.industryKey, created.version);
    if (!deploy.success) {
      return { ...base, status: 'failed', error: `deploy failed: ${deploy.error ?? 'unknown'}` };
    }
    invalidateManagerGMCache(target.agentId, target.industryKey);
    return { ...base, status: 'rebaked', toVersion: created.version };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ...base, status: 'failed', error: message };
  }
}

/**
 * Parse Jasper's legacy `version` string (e.g. `'v3'`) into a numeric version for
 * the result's `fromVersion`. Falls back to 1 (the implicit seed version).
 */
function parseJasperVersion(raw: string | undefined): number {
  if (typeof raw === 'string') {
    const match = raw.match(/(\d+)/);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed)) { return parsed; }
    }
  }
  return 1;
}

/**
 * Process the single Jasper (orchestrator) target. Unlike specialists/managers,
 * Jasper has no `brandDNASnapshot`, so we decide skip/rebake by comparing the
 * swapped prompt against the active prompt. Returns null if there is no active
 * Jasper GM at all (the target is dropped entirely).
 */
async function processJasperTarget(
  brandDNA: BrandDNA,
  createdBy: string,
): Promise<RebakeTargetResult | null> {
  const activeGM = await getActiveJasperGoldenMaster();
  if (!activeGM) {
    logger.info('[RebakeAllService] No active Jasper GM — skipping Jasper target entirely');
    return null;
  }

  const fromVersion = parseJasperVersion(activeGM.version);
  const base: RebakeTargetResult = {
    id: JASPER_TARGET_ID,
    kind: 'orchestrator',
    status: 'skipped',
    fromVersion,
  };

  try {
    const { newPrompt, replaced } = swapBrandDNABlock(
      activeGM.systemPrompt,
      buildBrandDNABlock(brandDNA),
    );
    if (!replaced) {
      return { ...base, status: 'failed', error: 'Jasper GM has no Brand DNA marker' };
    }
    if (newPrompt === activeGM.systemPrompt) {
      return base; // already current — skip
    }

    const created = await createJasperGMVersionFromBrandRebake(brandDNA, createdBy);
    if (!created) {
      return {
        ...base,
        status: 'failed',
        error: 'createJasperGMVersionFromBrandRebake returned null (no active GM or missing Brand DNA marker)',
      };
    }
    const deploy = await deployJasperGMVersion(created.versionNumber);
    if (!deploy.success) {
      return { ...base, status: 'failed', error: `deploy failed: ${deploy.error ?? 'unknown'}` };
    }
    invalidateJasperGMCache();
    return { ...base, status: 'rebaked', toVersion: created.versionNumber };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ...base, status: 'failed', error: message };
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Re-bake the current org Brand DNA into every active Golden Master (all
 * specialists, all managers, and Jasper). Always applies — there is no dry-run
 * path. Specialist/manager targets idempotently skip when their
 * `brandDNASnapshot` already deep-equals the current Brand DNA. Jasper decides
 * skip/rebake by comparing the swapped prompt to the active prompt.
 *
 * Targets are processed with bounded concurrency (at most 5 at a time). After
 * each target finishes, `onProgress` is awaited with the running done/total and
 * the just-completed target.
 *
 * Throws only if no Brand DNA is configured on the org — every per-target failure
 * is captured in the result instead of aborting the run.
 */
export async function rebakeAllGoldenMasters(opts: RebakeAllOptions): Promise<RebakeAllResult> {
  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error('No Brand DNA configured on the org — cannot re-bake.');
  }

  const [specialists, managers] = await Promise.all([
    enumerateSpecialists(),
    enumerateManagers(),
  ]);
  const gmTargets = [...specialists, ...managers];

  // Decide whether Jasper is a target up-front (no active GM → drop it entirely).
  const jasperActive = await getActiveJasperGoldenMaster();
  const hasJasper = jasperActive !== null;

  const total = gmTargets.length + (hasJasper ? 1 : 0);
  const results: RebakeTargetResult[] = [];
  let done = 0;

  const reportProgress = async (last: RebakeTargetResult): Promise<void> => {
    done += 1;
    results.push(last);
    await opts.onProgress?.({ done, total, last });
  };

  // Process specialist/manager targets, bounded to MAX_CONCURRENCY at a time.
  await inChunks(gmTargets, MAX_CONCURRENCY, async (t) => {
    const result = await processGMTarget(t, brandDNA, opts.createdBy);
    await reportProgress(result);
    return result;
  });

  // Process the single Jasper target last (if it exists).
  if (hasJasper) {
    const jasperResult = await processJasperTarget(brandDNA, opts.createdBy);
    if (jasperResult) {
      await reportProgress(jasperResult);
    }
  }

  const rebaked = results.filter((r) => r.status === 'rebaked').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  return { total: results.length, rebaked, skipped, failed, results };
}

/**
 * Detached runner used by API routes. Kicks off a full re-bake and streams
 * running counts into the job doc as each target completes. Never rethrows —
 * any error is captured into the job doc with status `failed`.
 */
export async function runRebakeJob(jobId: string, createdBy: string): Promise<void> {
  let rebaked = 0;
  let skipped = 0;
  let failed = 0;
  const failures: RebakeJobFailure[] = [];

  try {
    const result = await rebakeAllGoldenMasters({
      createdBy,
      onProgress: async ({ done, total, last }) => {
        if (last.status === 'rebaked') { rebaked += 1; }
        else if (last.status === 'skipped') { skipped += 1; }
        else if (last.status === 'failed') {
          failed += 1;
          failures.push({ id: last.id, error: last.error ?? 'unknown error' });
        }
        await updateRebakeJob(jobId, { done, total, rebaked, skipped, failed, failures });
      },
    });

    await updateRebakeJob(jobId, {
      status: 'completed',
      finishedAt: new Date().toISOString(),
      done: result.results.length,
      total: result.total,
      rebaked: result.rebaked,
      skipped: result.skipped,
      failed: result.failed,
      failures,
    });

    logger.info('[RebakeAllService] Re-bake job completed', {
      jobId,
      total: result.total,
      rebaked: result.rebaked,
      skipped: result.skipped,
      failed: result.failed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateRebakeJob(jobId, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error: message,
    });
    logger.error(
      '[RebakeAllService] Re-bake job failed',
      err instanceof Error ? err : new Error(message),
      { jobId },
    );
  }
}
