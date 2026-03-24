/**
 * Approval Service — Auto-approve logic and approval analytics for Discovery findings
 *
 * Provides confidence-threshold auto-approval, bulk approval orchestration,
 * and approval statistics for operations.
 *
 * @module lib/intelligence/approval-service
 */

import { adminDb } from '@/lib/firebase/admin';
import {
  getDiscoveryFindingsCollection,
} from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import {
  updateFindingApproval,
  bulkUpdateFindingApproval,
} from './discovery-service';
import type { DiscoveryFinding } from '@/types/intelligence-discovery';

const LOG_PREFIX = '[ApprovalService]';

// ============================================================================
// TYPES
// ============================================================================

export interface ApprovalConfig {
  /** Auto-approve findings with confidence >= this threshold (0-100). 0 = disabled */
  autoApproveThreshold: number;
  /** Auto-reject findings with confidence <= this threshold. 0 = disabled */
  autoRejectThreshold: number;
}

export interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  converted: number;
  avgConfidence: number;
  highConfidenceCount: number;
}

export interface AutoApproveResult {
  autoApproved: number;
  autoRejected: number;
  skipped: number;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: ApprovalConfig = {
  autoApproveThreshold: 80,
  autoRejectThreshold: 0,
};

// ============================================================================
// GUARD
// ============================================================================

function ensureDb() {
  if (!adminDb) {
    throw new Error(`${LOG_PREFIX} Admin Firestore not available`);
  }
  return adminDb;
}

// ============================================================================
// AUTO-APPROVE
// ============================================================================

/**
 * Auto-approve/reject findings in an operation based on confidence thresholds.
 * Only processes findings with approvalStatus === 'pending'.
 */
export async function autoApproveFindings(
  operationId: string,
  userId: string,
  config: ApprovalConfig = DEFAULT_CONFIG
): Promise<AutoApproveResult> {
  const db = ensureDb();

  const snap = await db
    .collection(getDiscoveryFindingsCollection())
    .where('operationId', '==', operationId)
    .where('approvalStatus', '==', 'pending')
    .get();

  const toApprove: string[] = [];
  const toReject: string[] = [];
  let skipped = 0;

  for (const doc of snap.docs) {
    const finding = doc.data() as DiscoveryFinding;
    const confidence = finding.overallConfidence;

    if (config.autoApproveThreshold > 0 && confidence >= config.autoApproveThreshold) {
      toApprove.push(finding.id);
    } else if (config.autoRejectThreshold > 0 && confidence <= config.autoRejectThreshold) {
      toReject.push(finding.id);
    } else {
      skipped++;
    }
  }

  if (toApprove.length > 0) {
    await bulkUpdateFindingApproval(toApprove, 'approved', userId);
  }

  if (toReject.length > 0) {
    await bulkUpdateFindingApproval(
      toReject,
      'rejected',
      userId,
      'Auto-rejected: below confidence threshold'
    );
  }

  logger.info(`${LOG_PREFIX} Auto-approval complete`, {
    operationId,
    approved: toApprove.length,
    rejected: toReject.length,
    skipped,
    threshold: config.autoApproveThreshold,
  });

  return {
    autoApproved: toApprove.length,
    autoRejected: toReject.length,
    skipped,
  };
}

// ============================================================================
// APPROVAL STATS
// ============================================================================

/**
 * Calculate approval statistics for an operation.
 */
export async function getApprovalStats(operationId: string): Promise<ApprovalStats> {
  const db = ensureDb();

  const snap = await db
    .collection(getDiscoveryFindingsCollection())
    .where('operationId', '==', operationId)
    .get();

  const stats: ApprovalStats = {
    total: snap.docs.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    converted: 0,
    avgConfidence: 0,
    highConfidenceCount: 0,
  };

  let totalConfidence = 0;

  for (const doc of snap.docs) {
    const finding = doc.data() as DiscoveryFinding;

    switch (finding.approvalStatus) {
      case 'pending': stats.pending++; break;
      case 'approved': stats.approved++; break;
      case 'rejected': stats.rejected++; break;
      case 'converted': stats.converted++; break;
    }

    totalConfidence += finding.overallConfidence;
    if (finding.overallConfidence >= 70) {
      stats.highConfidenceCount++;
    }
  }

  stats.avgConfidence = stats.total > 0 ? Math.round(totalConfidence / stats.total) : 0;

  return stats;
}

// ============================================================================
// BULK APPROVAL WITH FILTER
// ============================================================================

/**
 * Approve all pending findings in an operation that match a minimum confidence.
 */
export async function approveAboveConfidence(
  operationId: string,
  minConfidence: number,
  userId: string
): Promise<number> {
  const db = ensureDb();

  const snap = await db
    .collection(getDiscoveryFindingsCollection())
    .where('operationId', '==', operationId)
    .where('approvalStatus', '==', 'pending')
    .get();

  const eligible = snap.docs
    .map((d) => d.data() as DiscoveryFinding)
    .filter((f) => f.overallConfidence >= minConfidence)
    .map((f) => f.id);

  if (eligible.length === 0) {
    return 0;
  }

  const updated = await bulkUpdateFindingApproval(eligible, 'approved', userId);

  logger.info(`${LOG_PREFIX} Approved findings above confidence`, {
    operationId,
    minConfidence,
    count: updated,
  });

  return updated;
}

// ============================================================================
// GET APPROVED FINDINGS
// ============================================================================

/**
 * Retrieve all approved findings for an operation (ready for conversion).
 */
export async function getApprovedFindings(operationId: string): Promise<DiscoveryFinding[]> {
  const db = ensureDb();

  const snap = await db
    .collection(getDiscoveryFindingsCollection())
    .where('operationId', '==', operationId)
    .where('approvalStatus', '==', 'approved')
    .get();

  return snap.docs.map((d) => d.data() as DiscoveryFinding);
}

/**
 * Retrieve specific findings by IDs, filtered to approved status only.
 */
export async function getApprovedFindingsByIds(
  findingIds: string[]
): Promise<DiscoveryFinding[]> {
  const db = ensureDb();
  const findings: DiscoveryFinding[] = [];

  // Firestore "in" queries limited to 30 items per call
  const CHUNK_SIZE = 30;
  for (let i = 0; i < findingIds.length; i += CHUNK_SIZE) {
    const chunk = findingIds.slice(i, i + CHUNK_SIZE);
    const snap = await db
      .collection(getDiscoveryFindingsCollection())
      .where('__name__', 'in', chunk)
      .get();

    for (const doc of snap.docs) {
      const finding = doc.data() as DiscoveryFinding;
      if (finding.approvalStatus === 'approved') {
        findings.push(finding);
      }
    }
  }

  return findings;
}

// ============================================================================
// SINGLE APPROVE/REJECT WITH VALIDATION
// ============================================================================

/**
 * Approve a finding with validation (must be pending or rejected).
 */
export async function approveFindingValidated(
  findingId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const db = ensureDb();
  const doc = await db.collection(getDiscoveryFindingsCollection()).doc(findingId).get();

  if (!doc.exists) {
    return { success: false, error: 'Finding not found' };
  }

  const finding = doc.data() as DiscoveryFinding;
  if (finding.approvalStatus === 'converted') {
    return { success: false, error: 'Finding already converted to a lead' };
  }

  await updateFindingApproval(findingId, 'approved', userId);
  return { success: true };
}

/**
 * Reject a finding with validation.
 */
export async function rejectFindingValidated(
  findingId: string,
  userId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const db = ensureDb();
  const doc = await db.collection(getDiscoveryFindingsCollection()).doc(findingId).get();

  if (!doc.exists) {
    return { success: false, error: 'Finding not found' };
  }

  const finding = doc.data() as DiscoveryFinding;
  if (finding.approvalStatus === 'converted') {
    return { success: false, error: 'Finding already converted to a lead' };
  }

  await updateFindingApproval(findingId, 'rejected', userId, notes);
  return { success: true };
}
