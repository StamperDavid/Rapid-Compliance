/**
 * Specialist Improvement Applier
 *
 * Handles the review and application of specialist improvement requests.
 * Enforces the human review gate and manages the lifecycle:
 * pending_review → approved/rejected → applied
 *
 * When applying:
 * - Patches the specialist's config in Firestore
 * - Records before/after state for rollback
 * - Emits signal for cross-module notification
 *
 * @module agents/shared/specialist-improvement-applier
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';
import type { SpecialistImprovementRequest } from '@/types/training';

// ============================================================================
// CONSTANTS
// ============================================================================

const IMPROVEMENT_REQUESTS_COLLECTION = 'specialistImprovementRequests';
const SPECIALIST_CONFIGS_COLLECTION = 'specialistConfigs';

function getImprovementRequestsPath(): string {
  return getSubCollection(IMPROVEMENT_REQUESTS_COLLECTION);
}

function getSpecialistConfigsPath(): string {
  return getSubCollection(SPECIALIST_CONFIGS_COLLECTION);
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
 * 1. Loads current specialist config from Firestore
 * 2. Records the before state
 * 3. Applies each proposed change
 * 4. Saves the updated config
 * 5. Updates the request status to 'applied'
 */
export async function applyImprovementRequest(
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

  if (request.status !== 'approved') {
    return { success: false, error: `Request must be approved before applying (current: ${request.status})` };
  }

  try {
    // 1. Load current specialist config
    const configRef = adminDb.collection(getSpecialistConfigsPath()).doc(request.specialistId);
    const configDoc = await configRef.get();

    const currentConfig = configDoc.exists
      ? configDoc.data() as Record<string, unknown>
      : {};

    // 2. Record before state for rollback
    const beforeState: Record<string, unknown> = {};
    for (const change of request.proposedChanges) {
      beforeState[change.field] = getNestedValue(currentConfig, change.field);
    }

    // 3. Apply each proposed change
    const updatedConfig = { ...currentConfig };
    for (const change of request.proposedChanges) {
      setNestedValue(updatedConfig, change.field, change.proposedValue);
    }

    // 4. Save the updated config with before/after metadata
    await configRef.set({
      ...updatedConfig,
      _lastImprovementRequestId: requestId,
      _lastImprovedAt: new Date().toISOString(),
      _beforeState: beforeState,
    }, { merge: true });

    // 5. Update request status
    await requestRef.update({
      status: 'applied',
      appliedAt: new Date().toISOString(),
    });

    logger.info(`[ImprovementApplier] Applied ${request.proposedChanges.length} changes to ${request.specialistId}`);

    return { success: true };
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
 * Restores the before-state recorded during application.
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
    const configRef = adminDb.collection(getSpecialistConfigsPath()).doc(request.specialistId);
    const configDoc = await configRef.get();

    if (!configDoc.exists) {
      return { success: false, error: 'Specialist config not found' };
    }

    const config = configDoc.data() as Record<string, unknown>;
    const beforeState = config._beforeState as Record<string, unknown> | undefined;

    if (!beforeState) {
      return { success: false, error: 'No before-state recorded — cannot rollback' };
    }

    // Restore before state
    const restoredConfig = { ...config };
    for (const [field, value] of Object.entries(beforeState)) {
      setNestedValue(restoredConfig, field, value);
    }

    // Clear improvement metadata
    delete restoredConfig._lastImprovementRequestId;
    delete restoredConfig._lastImprovedAt;
    delete restoredConfig._beforeState;

    await configRef.set(restoredConfig);

    // Revert request status to approved, remove appliedAt field entirely
    await requestRef.update({
      status: 'approved',
      appliedAt: FieldValue.delete(),
    });

    logger.info(`[ImprovementApplier] Rolled back changes from ${requestId} on ${request.specialistId}`);

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

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Get a nested value from an object using dot-notation path.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

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
