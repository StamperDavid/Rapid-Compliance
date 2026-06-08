/**
 * Brand re-bake job tracking service.
 *
 * The "re-bake all Golden Masters" feature runs as a detached background job:
 * an API route kicks it off, returns a job id immediately, and the UI polls for
 * progress. This service is the persistence layer for those jobs — one Firestore
 * doc per job in `organizations/{org}/brandRebakeJobs`, carrying live counters
 * (done / total / rebaked / skipped / failed) plus the per-target failure list.
 *
 * All timestamps are ISO strings. We never use Firestore `orderBy` (no composite
 * index needed) — `getLatestRebakeJob` sorts client-side.
 *
 * @module brand/rebake-job-service
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';

const REBAKE_JOBS_COLLECTION = 'brandRebakeJobs';

function getRebakeJobsPath(): string {
  return getSubCollection(REBAKE_JOBS_COLLECTION);
}

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export type RebakeJobStatus = 'running' | 'completed' | 'failed';

export type RebakeTrigger = 'manual-publish' | 'voice-save';

export interface RebakeJobFailure {
  id: string;
  error: string;
}

export interface RebakeJob {
  id: string;
  status: RebakeJobStatus;
  trigger: RebakeTrigger;
  triggeredBy: string;
  total: number;
  done: number;
  rebaked: number;
  skipped: number;
  failed: number;
  failures: RebakeJobFailure[];
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Create a new re-bake job doc in `running` state with all counters zeroed and
 * an empty failure list. Returns the full object (including the generated id).
 *
 * Throws if Firestore Admin is not initialized — a job that can't be persisted
 * must fail loudly rather than silently no-op, because the API route returns the
 * id to the UI for polling.
 */
export async function createRebakeJob(input: {
  triggeredBy: string;
  trigger: RebakeTrigger;
}): Promise<RebakeJob> {
  if (!adminDb) {
    throw new Error('Firebase Admin not initialized');
  }

  const collection = adminDb.collection(getRebakeJobsPath());
  const ref = collection.doc();
  const now = new Date().toISOString();

  const job: RebakeJob = {
    id: ref.id,
    status: 'running',
    trigger: input.trigger,
    triggeredBy: input.triggeredBy,
    total: 0,
    done: 0,
    rebaked: 0,
    skipped: 0,
    failed: 0,
    failures: [],
    startedAt: now,
  };

  // Write the full object minus the doc-id (the id IS the doc key).
  const payload: Record<string, unknown> = {
    status: job.status,
    trigger: job.trigger,
    triggeredBy: job.triggeredBy,
    total: job.total,
    done: job.done,
    rebaked: job.rebaked,
    skipped: job.skipped,
    failed: job.failed,
    failures: job.failures,
    startedAt: job.startedAt,
  };

  await ref.set(payload);

  logger.info('[RebakeJobService] Created re-bake job', {
    jobId: job.id,
    trigger: job.trigger,
    triggeredBy: job.triggeredBy,
  });

  return job;
}

/**
 * Read a re-bake job by id. Returns null if the doc is missing or Firestore is
 * unavailable.
 */
export async function getRebakeJob(jobId: string): Promise<RebakeJob | null> {
  if (!adminDb) { return null; }

  const doc = await adminDb.collection(getRebakeJobsPath()).doc(jobId).get();
  if (!doc.exists) { return null; }

  return { id: doc.id, ...(doc.data() as Omit<RebakeJob, 'id'>) };
}

/**
 * Patch a re-bake job doc (merge). Any `undefined` values in the patch are
 * stripped before writing — Firestore rejects undefined. No-ops if Firestore is
 * unavailable.
 */
export async function updateRebakeJob(
  jobId: string,
  patch: Partial<Omit<RebakeJob, 'id'>>,
): Promise<void> {
  if (!adminDb) { return; }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }

  await adminDb.collection(getRebakeJobsPath()).doc(jobId).set(cleaned, { merge: true });
}

/**
 * Return the most recently started re-bake job, or null if none exist. Sorts by
 * `startedAt` DESC client-side (no Firestore `orderBy`, so no composite index).
 */
export async function getLatestRebakeJob(): Promise<RebakeJob | null> {
  if (!adminDb) { return null; }

  const snapshot = await adminDb.collection(getRebakeJobsPath()).get();
  if (snapshot.empty) { return null; }

  const jobs = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<RebakeJob, 'id'>),
  }));

  jobs.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
  return jobs[0];
}
