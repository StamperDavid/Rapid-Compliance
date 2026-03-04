/**
 * Execution Policy Service
 *
 * Server-side (adminDb) and client-side (FirestoreService) access
 * for the global execution policy that controls whether Jasper
 * stops at draft/review or auto-executes tasks.
 *
 * Firestore path: organizations/{PLATFORM_ID}/settings/execution_policy
 */

import { PLATFORM_ID } from '@/lib/constants/platform';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { DEFAULT_EXECUTION_MODE, type ExecutionPolicy, type ExecutionMode } from '@/types/execution-policy';

const SETTINGS_COLLECTION = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/settings`;
const DOC_ID = 'execution_policy';

// ============================================================================
// SERVER-SIDE (API routes — uses admin SDK)
// ============================================================================

/**
 * Get execution policy from Firestore (server-side).
 * Returns default (require_approval) if no document exists.
 */
export async function getExecutionPolicy(): Promise<ExecutionPolicy> {
  const { adminDb } = await import('@/lib/firebase/admin');
  if (!adminDb) {
    return {
      mode: DEFAULT_EXECUTION_MODE,
      updatedBy: 'system',
      updatedAt: new Date(),
    };
  }
  const snap = await adminDb.collection(SETTINGS_COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) {
    return {
      mode: DEFAULT_EXECUTION_MODE,
      updatedBy: 'system',
      updatedAt: new Date(),
    };
  }
  const data = snap.data() as Record<string, unknown>;
  return {
    mode: (data.mode === 'fully_automate' ? 'fully_automate' : 'require_approval') as ExecutionMode,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    updatedAt: data.updatedAt instanceof Date
      ? data.updatedAt
      : (data.updatedAt && typeof (data.updatedAt as { toDate?: () => Date }).toDate === 'function'
        ? (data.updatedAt as { toDate: () => Date }).toDate()
        : new Date()),
  };
}

/**
 * Save execution policy to Firestore (server-side).
 */
export async function saveExecutionPolicy(
  mode: ExecutionMode,
  userId: string
): Promise<void> {
  const { adminDb } = await import('@/lib/firebase/admin');
  if (!adminDb) {
    throw new Error('Admin DB not initialized');
  }
  await adminDb.collection(SETTINGS_COLLECTION).doc(DOC_ID).set(
    {
      mode,
      updatedBy: userId,
      updatedAt: new Date(),
    },
    { merge: true }
  );
}

// ============================================================================
// CLIENT-SIDE (settings page — uses FirestoreService)
// ============================================================================

/**
 * Get execution policy from Firestore (client-side).
 */
export async function getExecutionPolicyClient(): Promise<ExecutionPolicy> {
  const { FirestoreService } = await import('@/lib/db/firestore-service');
  const data = await FirestoreService.get<ExecutionPolicy>(SETTINGS_COLLECTION, DOC_ID);
  if (!data) {
    return {
      mode: DEFAULT_EXECUTION_MODE,
      updatedBy: 'system',
      updatedAt: new Date(),
    };
  }
  return {
    ...data,
    mode: data.mode === 'fully_automate' ? 'fully_automate' : 'require_approval',
  };
}

/**
 * Save execution policy from client-side.
 */
export async function saveExecutionPolicyClient(
  mode: ExecutionMode,
  userId: string
): Promise<void> {
  const { FirestoreService } = await import('@/lib/db/firestore-service');
  await FirestoreService.set(SETTINGS_COLLECTION, DOC_ID, {
    mode,
    updatedBy: userId,
    updatedAt: new Date(),
  }, true);
}
