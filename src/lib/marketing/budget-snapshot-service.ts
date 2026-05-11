/**
 * Budget snapshot service
 *
 * Persists BUDGET_STRATEGIST analyze results so the dashboard widget can
 * render the latest allocation without re-running the LLM on every page
 * load, and so the operator can browse history.
 *
 * Schema:
 *   marketingBudgetSnapshots/{snapshotId}
 *     createdAt: Timestamp
 *     createdBy: 'operator' | 'cron'
 *     userId?: string       — when triggered manually
 *     inputs:
 *       totalBudgetUsd
 *       windowDays
 *       platforms: PlatformSpendSnapshot[]
 *     result:
 *       recommendations: BudgetRecommendation[]
 *       summaryRationale: string
 *       insufficientData: boolean
 *       insufficientDataMessage?: string
 *     modelUsed: string
 *
 * Read-side is sorted by `createdAt desc` — `getLatestSnapshot()` returns
 * the most recent. No "isLatest" flag needed; one query, one composite index.
 *
 * Server-only — Admin SDK per the server-routes feedback rule.
 */

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { getMarketingBudgetSnapshotsCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type {
  AnalyzeBudgetRequest,
  BudgetStrategistResult,
} from '@/types/budget-strategist';

const FILE = 'marketing/budget-snapshot-service.ts';

export interface BudgetSnapshot {
  id: string;
  createdAt: string; // ISO
  createdBy: 'operator' | 'cron';
  userId?: string;
  inputs: AnalyzeBudgetRequest;
  result: BudgetStrategistResult;
  modelUsed?: string;
}

interface PersistInput {
  inputs: AnalyzeBudgetRequest;
  result: BudgetStrategistResult;
  createdBy: 'operator' | 'cron';
  userId?: string;
  modelUsed?: string;
}

export async function persistBudgetSnapshot(payload: PersistInput): Promise<string> {
  if (!adminDb) {throw new Error('Firebase Admin SDK not initialized');}
  const collectionPath = getMarketingBudgetSnapshotsCollection();
  const ref = await adminDb.collection(collectionPath).add({
    createdAt: FieldValue.serverTimestamp(),
    createdBy: payload.createdBy,
    ...(payload.userId ? { userId: payload.userId } : {}),
    inputs: payload.inputs,
    result: payload.result,
    ...(payload.modelUsed ? { modelUsed: payload.modelUsed } : {}),
  });
  logger.info('[BudgetSnapshot] Persisted', {
    file: FILE,
    snapshotId: ref.id,
    createdBy: payload.createdBy,
    totalBudgetUsd: payload.inputs.totalBudgetUsd,
    platformCount: payload.inputs.platforms.length,
  });
  return ref.id;
}

interface RawSnapshotDoc {
  createdAt?: Timestamp;
  createdBy?: 'operator' | 'cron';
  userId?: string;
  inputs?: AnalyzeBudgetRequest;
  result?: BudgetStrategistResult;
  modelUsed?: string;
}

function toIso(ts: Timestamp | undefined): string {
  if (!ts) {return new Date(0).toISOString();}
  try { return ts.toDate().toISOString(); } catch { return new Date(0).toISOString(); }
}

export async function getLatestSnapshot(): Promise<BudgetSnapshot | null> {
  if (!adminDb) {throw new Error('Firebase Admin SDK not initialized');}
  const collectionPath = getMarketingBudgetSnapshotsCollection();
  const snap = await adminDb
    .collection(collectionPath)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snap.empty) {return null;}

  const doc = snap.docs[0];
  if (!doc) {return null;}
  const data = doc.data() as RawSnapshotDoc;
  if (!data.inputs || !data.result) {
    logger.warn('[BudgetSnapshot] Latest snapshot is malformed (missing inputs or result)', {
      file: FILE,
      snapshotId: doc.id,
    });
    return null;
  }

  return {
    id: doc.id,
    createdAt: toIso(data.createdAt),
    createdBy: data.createdBy ?? 'operator',
    userId: data.userId,
    inputs: data.inputs,
    result: data.result,
    modelUsed: data.modelUsed,
  };
}

export async function listSnapshots(maxItems = 20): Promise<BudgetSnapshot[]> {
  if (!adminDb) {throw new Error('Firebase Admin SDK not initialized');}
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(maxItems)));
  const collectionPath = getMarketingBudgetSnapshotsCollection();
  const snap = await adminDb
    .collection(collectionPath)
    .orderBy('createdAt', 'desc')
    .limit(safeLimit)
    .get();

  const out: BudgetSnapshot[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as RawSnapshotDoc;
    if (!data.inputs || !data.result) {continue;}
    out.push({
      id: doc.id,
      createdAt: toIso(data.createdAt),
      createdBy: data.createdBy ?? 'operator',
      userId: data.userId,
      inputs: data.inputs,
      result: data.result,
      modelUsed: data.modelUsed,
    });
  }
  return out;
}
