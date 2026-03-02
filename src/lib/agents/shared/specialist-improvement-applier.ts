/**
 * Specialist Improvement Applier
 *
 * Handles the review and application of specialist improvement requests.
 * Enforces the human review gate and manages the lifecycle:
 * pending_review → approved/rejected → applied
 *
 * When applying:
 * - Creates a new versioned Golden Master snapshot
 * - Deploys the new version (which patches specialistConfigs)
 * - Updates the request status to 'applied'
 *
 * Rollback:
 * - Deploys the previous Golden Master version
 * - Reverts the request status to 'approved'
 *
 * @module agents/shared/specialist-improvement-applier
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';
import type { SpecialistImprovementRequest } from '@/types/training';
import {
  getOrCreateSpecialistGM,
  createSpecialistGMVersion,
  deploySpecialistGM,
  rollbackSpecialistGM,
} from '@/lib/training/specialist-golden-master-service';

// ============================================================================
// CONSTANTS
// ============================================================================

const IMPROVEMENT_REQUESTS_COLLECTION = 'specialistImprovementRequests';

function getImprovementRequestsPath(): string {
  return getSubCollection(IMPROVEMENT_REQUESTS_COLLECTION);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Review an improvement request — approve or reject.
 * This is the human review gate.
 */
export async function reviewImprovementRequest(
  requestId: string,
  approved: boolean,
  reviewedBy: string,
  reviewNotes?: string
): Promise<SpecialistImprovementRequest | null> {
  if (!adminDb) { return null; }

  const docRef = adminDb.collection(getImprovementRequestsPath()).doc(requestId);
  const doc = await docRef.get();

  if (!doc.exists) {
    logger.warn(`[ImprovementApplier] Request not found: ${requestId}`);
    return null;
  }

  const request = doc.data() as SpecialistImprovementRequest;

  if (request.status !== 'pending_review') {
    logger.warn(`[ImprovementApplier] Request ${requestId} is not pending review (status: ${request.status})`);
    return null;
  }

  const newStatus = approved ? 'approved' : 'rejected';

  await docRef.update({
    status: newStatus,
    reviewedBy,
    reviewNotes: reviewNotes ?? '',
  });

  logger.info(`[ImprovementApplier] Request ${requestId} ${newStatus} by ${reviewedBy}`);

  return {
    ...request,
    status: newStatus,
    reviewedBy,
    reviewNotes,
  };
}

/**
 * Apply an approved improvement request to the specialist's config.
 *
 * 1. Ensures the specialist has a Golden Master (seeds v1 if missing)
 * 2. Creates a new GM version (vN+1) with the proposed changes
 * 3. Deploys the new version (which patches specialistConfigs)
 * 4. Updates the request status to 'applied'
 */
export async function applyImprovementRequest(
  requestId: string
): Promise<{ success: boolean; goldenMasterVersion?: number; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'Database not available' };
  }

  const requestRef = adminDb.collection(getImprovementRequestsPath()).doc(requestId);
  const requestDoc = await requestRef.get();

  if (!requestDoc.exists) {
    return { success: false, error: `Request not found: ${requestId}` };
  }

  const request = requestDoc.data() as SpecialistImprovementRequest;

  if (request.status !== 'approved') {
    return { success: false, error: `Request must be approved before applying (current: ${request.status})` };
  }

  try {
    // 1. Ensure specialist has a GM (seed v1 if missing)
    const seedResult = await getOrCreateSpecialistGM(
      request.specialistId,
      request.specialistName,
      'system'
    );
    if (!seedResult) {
      return { success: false, error: 'Failed to seed initial Golden Master' };
    }

    // 2. Create vN+1 with the proposed changes
    const newGM = await createSpecialistGMVersion(
      request.specialistId,
      request,
      'system'
    );
    if (!newGM) {
      return { success: false, error: 'Failed to create new Golden Master version' };
    }

    // 3. Deploy the new version (patches specialistConfigs)
    const deployResult = await deploySpecialistGM(request.specialistId, newGM.version);
    if (!deployResult.success) {
      return { success: false, error: deployResult.error ?? 'Deploy failed' };
    }

    // 4. Update request status
    await requestRef.update({
      status: 'applied',
      appliedAt: new Date().toISOString(),
    });

    logger.info(`[ImprovementApplier] Applied ${request.proposedChanges.length} changes to ${request.specialistId} → GM v${newGM.version}`);

    return { success: true, goldenMasterVersion: newGM.version };
  } catch (error) {
    logger.error(
      '[ImprovementApplier] Failed to apply changes',
      error instanceof Error ? error : new Error(String(error)),
      { requestId, specialistId: request.specialistId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Rollback changes from a previously applied improvement request.
 * Deploys the previous Golden Master version instead of manually restoring state.
 */
export async function rollbackImprovementRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'Database not available' };
  }

  const requestRef = adminDb.collection(getImprovementRequestsPath()).doc(requestId);
  const requestDoc = await requestRef.get();

  if (!requestDoc.exists) {
    return { success: false, error: `Request not found: ${requestId}` };
  }

  const request = requestDoc.data() as SpecialistImprovementRequest;

  if (request.status !== 'applied') {
    return { success: false, error: `Only applied requests can be rolled back (current: ${request.status})` };
  }

  try {
    // Rollback via Golden Master versioning
    const rollbackResult = await rollbackSpecialistGM(request.specialistId);

    if (!rollbackResult.success) {
      return { success: false, error: rollbackResult.error ?? 'Rollback failed' };
    }

    // Revert request status to approved, remove appliedAt field entirely
    await requestRef.update({
      status: 'approved',
      appliedAt: FieldValue.delete(),
    });

    logger.info(`[ImprovementApplier] Rolled back ${requestId} on ${request.specialistId} → GM v${rollbackResult.rolledBackToVersion}`);

    return { success: true };
  } catch (error) {
    logger.error(
      '[ImprovementApplier] Rollback failed',
      error instanceof Error ? error : new Error(String(error)),
      { requestId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

