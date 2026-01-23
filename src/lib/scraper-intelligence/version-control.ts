/**
 * Version Control for Training Data
 * 
 * Git-like versioning system for training data with:
 * - Diff generation (what changed between versions)
 * - Rollback to any version
 * - Branch/merge support for A/B testing
 * - Changelog generation
 * - Migration scripts for version upgrades
 * - Recovery from corrupted versions
 */

import { db } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger/logger';
import type { TrainingData, TrainingHistory } from '@/types/scraper-intelligence';

// ============================================================================
// CONSTANTS
// ============================================================================

const TRAINING_DATA_COLLECTION = 'training_data';
const TRAINING_HISTORY_COLLECTION = 'training_history';
const TRAINING_BRANCHES_COLLECTION = 'training_branches';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Firestore Timestamp interface
 */
interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
}

export interface DiffEntry {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'added' | 'removed' | 'modified';
}

export interface VersionDiff {
  trainingDataId: string;
  fromVersion: number;
  toVersion: number;
  changes: DiffEntry[];
  summary: string;
  timestamp: Date;
}

export interface Branch {
  id: string;
  name: string;
  organizationId: string;
  description: string;
  createdAt: Date;
  createdBy: string;
  parentBranch?: string;
  trainingDataSnapshot: Record<string, TrainingData>;
  active: boolean;
}

export interface MergeResult {
  success: boolean;
  conflicts: Array<{
    trainingDataId: string;
    conflictingFields: string[];
  }>;
  mergedCount: number;
  conflictCount: number;
}

export interface Changelog {
  entries: ChangelogEntry[];
  generatedAt: Date;
  organizationId: string;
}

export interface ChangelogEntry {
  version: number;
  date: Date;
  author: string;
  changes: string[];
  type: 'major' | 'minor' | 'patch';
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class VersionControlError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'VersionControlError';
  }
}

// ============================================================================
// DIFF GENERATION
// ============================================================================

/**
 * Generate diff between two training data versions
 * 
 * Compares all fields and identifies what changed.
 * 
 * @param before - Previous version
 * @param after - New version
 * @returns Diff with all changes
 */
export function generateDiff(
  before: TrainingData,
  after: TrainingData
): VersionDiff {
  if (before.id !== after.id) {
    throw new VersionControlError(
      'Cannot diff different training data',
      'MISMATCHED_IDS',
      400
    );
  }

  const changes: DiffEntry[] = [];

  // Compare all fields
  const fields: (keyof TrainingData)[] = [
    'pattern',
    'patternType',
    'confidence',
    'positiveCount',
    'negativeCount',
    'seenCount',
    'active',
    'embedding',
    'metadata',
  ];

  for (const field of fields) {
    const oldValue = before[field];
    const newValue = after[field];

    // Deep comparison for objects/arrays
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      let changeType: 'added' | 'removed' | 'modified';
      
      if (oldValue === undefined || oldValue === null) {
        changeType = 'added';
      } else if (newValue === undefined || newValue === null) {
        changeType = 'removed';
      } else {
        changeType = 'modified';
      }

      changes.push({
        field,
        oldValue,
        newValue,
        changeType,
      });
    }
  }

  // Generate summary
  const summary = generateDiffSummary(changes);

  return {
    trainingDataId: before.id,
    fromVersion: before.version,
    toVersion: after.version,
    changes,
    summary,
    timestamp: new Date(),
  };
}

/**
 * Generate human-readable summary of changes
 */
function generateDiffSummary(changes: DiffEntry[]): string {
  if (changes.length === 0) {
    return 'No changes';
  }

  const summaryParts: string[] = [];

  for (const change of changes) {
    switch (change.field) {
      case 'confidence':
        summaryParts.push(
          `Confidence: ${change.oldValue} → ${change.newValue}`
        );
        break;
      case 'active':
        summaryParts.push(
          change.newValue ? 'Activated' : 'Deactivated'
        );
        break;
      case 'pattern':
        summaryParts.push('Pattern modified');
        break;
      case 'positiveCount':
        summaryParts.push(
          `Positive feedback: ${change.oldValue} → ${change.newValue}`
        );
        break;
      case 'negativeCount':
        summaryParts.push(
          `Negative feedback: ${change.oldValue} → ${change.newValue}`
        );
        break;
      default:
        summaryParts.push(`${change.field} ${change.changeType}`);
    }
  }

  return summaryParts.join(', ');
}

/**
 * Compare two versions by their IDs
 * 
 * @param trainingDataId - Training data ID
 * @param fromVersion - Starting version
 * @param toVersion - Ending version
 * @param organizationId - Organization ID
 * @returns Diff between versions
 */
export async function compareVersions(
  trainingDataId: string,
  fromVersion: number,
  toVersion: number,
  organizationId: string
): Promise<VersionDiff> {
  try {
    // Get history for both versions
    const historyDocs = await db
      .collection(TRAINING_HISTORY_COLLECTION)
      .where('trainingDataId', '==', trainingDataId)
      .where('organizationId', '==', organizationId)
      .orderBy('version', 'asc')
      .get();

    const fromHistory = historyDocs.docs.find(
      (doc) => doc.data().version === fromVersion
    );
    const toHistory = historyDocs.docs.find(
      (doc) => doc.data().version === toVersion
    );

    if (!fromHistory || !toHistory) {
      throw new VersionControlError(
        'Version not found in history',
        'VERSION_NOT_FOUND',
        404
      );
    }

    const fromData = fromHistory.data().newValue as TrainingData;
    const toData = toHistory.data().newValue as TrainingData;

    if (!fromData || !toData) {
      throw new VersionControlError(
        'Version data not available',
        'DATA_NOT_AVAILABLE',
        404
      );
    }

    return generateDiff(fromData, toData);
  } catch (error) {
    if (error instanceof VersionControlError) {
      throw error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to compare versions', err, {
      trainingDataId,
      fromVersion,
      toVersion,
    });

    const errorMessage = err.message;
    throw new VersionControlError(
      `Failed to compare versions: ${errorMessage}`,
      'COMPARISON_FAILED',
      500
    );
  }
}

// ============================================================================
// BRANCH MANAGEMENT
// ============================================================================

/**
 * Create a new branch for A/B testing
 * 
 * Snapshots current training data state for experimentation.
 * 
 * @param params - Branch creation parameters
 * @returns Created branch
 */
export async function createBranch(params: {
  name: string;
  organizationId: string;
  userId: string;
  description: string;
  parentBranch?: string;
}): Promise<Branch> {
  try {
    const { name, organizationId, userId, description, parentBranch } = params;

    // Validate branch name
    if (!name || !/^[a-z0-9-_]+$/.test(name)) {
      throw new VersionControlError(
        'Branch name must contain only lowercase letters, numbers, hyphens, and underscores',
        'INVALID_BRANCH_NAME',
        400
      );
    }

    // Check if branch already exists
    const existing = await db
      .collection(TRAINING_BRANCHES_COLLECTION)
      .where('organizationId', '==', organizationId)
      .where('name', '==', name)
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new VersionControlError(
        `Branch '${name}' already exists`,
        'BRANCH_EXISTS',
        409
      );
    }

    // Snapshot current training data
    const trainingDocs = await db
      .collection(TRAINING_DATA_COLLECTION)
      .where('organizationId', '==', organizationId)
      .get();

    const snapshot: Record<string, TrainingData> = {};
    for (const doc of trainingDocs.docs) {
      const docData = doc.data() as TrainingData;
      snapshot[doc.id] = {
        ...docData,
        createdAt: toDate(docData.createdAt),
        lastUpdatedAt: toDate(docData.lastUpdatedAt),
        lastSeenAt: toDate(docData.lastSeenAt),
      };
    }

    // Create branch
    const branchId = db.collection(TRAINING_BRANCHES_COLLECTION).doc().id;
    const now = new Date();

    const branch: Branch = {
      id: branchId,
      name,
      organizationId,
      description,
      createdAt: now,
      createdBy: userId,
      parentBranch,
      trainingDataSnapshot: snapshot,
      active: true,
    };

    await db.collection(TRAINING_BRANCHES_COLLECTION).doc(branchId).set({
      ...branch,
      createdAt: now,
    });

    logger.info('Created training data branch', {
      branchId,
      name,
      organizationId,
      snapshotSize: Object.keys(snapshot).length,
    });

    return branch;
  } catch (error) {
    if (error instanceof VersionControlError) {
      throw error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to create branch', err, {
      name: params.name,
      organizationId: params.organizationId,
    });

    const errorMessage = err.message;
    throw new VersionControlError(
      `Failed to create branch: ${errorMessage}`,
      'BRANCH_CREATION_FAILED',
      500
    );
  }
}

/**
 * Merge a branch back to main
 * 
 * Applies changes from branch to main training data.
 * Detects and reports conflicts.
 * 
 * @param branchId - Branch to merge
 * @param organizationId - Organization ID
 * @param userId - User performing merge
 * @returns Merge result with conflicts
 */
export async function mergeBranch(
  branchId: string,
  organizationId: string,
  _userId: string
): Promise<MergeResult> {
  try {
    // Get branch
    const branchDoc = await db
      .collection(TRAINING_BRANCHES_COLLECTION)
      .doc(branchId)
      .get();

    if (!branchDoc.exists) {
      throw new VersionControlError(
        'Branch not found',
        'BRANCH_NOT_FOUND',
        404
      );
    }

    const branch = branchDoc.data() as Branch;

    if (branch.organizationId !== organizationId) {
      throw new VersionControlError(
        'Unauthorized: branch belongs to different organization',
        'UNAUTHORIZED',
        403
      );
    }

    // Get current training data
    const currentDocs = await db
      .collection(TRAINING_DATA_COLLECTION)
      .where('organizationId', '==', organizationId)
      .get();

    const currentData: Record<string, TrainingData> = {};
    for (const doc of currentDocs.docs) {
      const docData = doc.data() as TrainingData;
      currentData[doc.id] = {
        ...docData,
        createdAt: toDate(docData.createdAt),
        lastUpdatedAt: toDate(docData.lastUpdatedAt),
        lastSeenAt: toDate(docData.lastSeenAt),
      };
    }

    // Detect conflicts
    const conflicts: Array<{
      trainingDataId: string;
      conflictingFields: string[];
    }> = [];

    let mergedCount = 0;

    for (const [id, branchVersion] of Object.entries(
      branch.trainingDataSnapshot
    )) {
      const currentVersion = currentData[id];

      if (!currentVersion) {
        // New pattern in branch - safe to add
        mergedCount++;
        continue;
      }

      // Check if current version has been modified since branch creation
      if (currentVersion.version > branchVersion.version) {
        // Conflict: pattern modified in both branch and main
        const diff = generateDiff(branchVersion, currentVersion);

        if (diff.changes.length > 0) {
          conflicts.push({
            trainingDataId: id,
            conflictingFields: diff.changes.map((change) => change.field),
          });
        }
      } else {
        // No conflict - branch version is newer or same
        mergedCount++;
      }
    }

    // If no conflicts, apply merge
    if (conflicts.length === 0) {
      const batch = db.batch();

      for (const [id, trainingData] of Object.entries(branch.trainingDataSnapshot)) {
        const ref = db.collection(TRAINING_DATA_COLLECTION).doc(id);
        batch.set(ref, {
          ...trainingData,
          lastUpdatedAt: new Date(),
        });
      }

      await batch.commit();

      // Deactivate branch
      await db
        .collection(TRAINING_BRANCHES_COLLECTION)
        .doc(branchId)
        .update({ active: false });

      logger.info('Merged branch successfully', {
        branchId,
        branchName: branch.name,
        mergedCount,
        organizationId,
      });
    } else {
      logger.warn('Branch merge has conflicts', {
        branchId,
        branchName: branch.name,
        conflictCount: conflicts.length,
        organizationId,
      });
    }

    return {
      success: conflicts.length === 0,
      conflicts,
      mergedCount,
      conflictCount: conflicts.length,
    };
  } catch (error) {
    if (error instanceof VersionControlError) {
      throw error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to merge branch', err, {
      branchId,
      organizationId,
    });

    const errorMessage = err.message;
    throw new VersionControlError(
      `Failed to merge branch: ${errorMessage}`,
      'MERGE_FAILED',
      500
    );
  }
}

/**
 * List all branches for an organization
 * 
 * @param organizationId - Organization ID
 * @param activeOnly - Only return active branches
 * @returns Array of branches
 */
export async function listBranches(
  organizationId: string,
  activeOnly: boolean = true
): Promise<Branch[]> {
  try {
    let query = db
      .collection(TRAINING_BRANCHES_COLLECTION)
      .where('organizationId', '==', organizationId);

    if (activeOnly) {
      query = query.where('active', '==', true);
    }

    const docs = await query.orderBy('createdAt', 'desc').get();

    return docs.docs.map((doc) => {
      const docData = doc.data();
      return {
        ...docData,
        createdAt: toDate(docData.createdAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
      } as Branch;
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to list branches', err, {
      organizationId,
    });

    throw new VersionControlError(
      'Failed to list branches',
      'LIST_FAILED',
      500
    );
  }
}

// ============================================================================
// CHANGELOG GENERATION
// ============================================================================

/**
 * Generate changelog from version history
 * 
 * Creates human-readable changelog of all changes.
 * 
 * @param organizationId - Organization ID
 * @param sinceDate - Only include changes after this date
 * @returns Generated changelog
 */
export async function generateChangelog(
  organizationId: string,
  sinceDate?: Date
): Promise<Changelog> {
  try {
    let query = db
      .collection(TRAINING_HISTORY_COLLECTION)
      .where('organizationId', '==', organizationId);

    if (sinceDate) {
      query = query.where('changedAt', '>=', sinceDate);
    }

    const docs = await query.orderBy('changedAt', 'desc').limit(100).get();

    const entriesByVersion = new Map<number, ChangelogEntry>();

    for (const doc of docs.docs) {
      const history = doc.data() as TrainingHistory;

      const version = history.version;
      let entry = entriesByVersion.get(version);

      if (!entry) {
        entry = {
          version,
          date: toDate(history.changedAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
          author: history.userId,
          changes: [],
          type: determineChangeType(history.changeType),
        };
        entriesByVersion.set(version, entry);
      }

      // Add change description
      const changeDesc = formatChangeDescription(history);
      if (changeDesc) {
        entry.changes.push(changeDesc);
      }
    }

    // Convert to array and sort by version descending
    const sortedEntries = Array.from(entriesByVersion.values()).sort(
      (a, b) => b.version - a.version
    );

    return {
      entries: sortedEntries,
      generatedAt: new Date(),
      organizationId,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to generate changelog', err, {
      organizationId,
    });

    throw new VersionControlError(
      'Failed to generate changelog',
      'CHANGELOG_FAILED',
      500
    );
  }
}

/**
 * Determine change type (major/minor/patch)
 */
function determineChangeType(
  changeType: string
): 'major' | 'minor' | 'patch' {
  switch (changeType) {
    case 'created':
      return 'minor';
    case 'deleted':
      return 'major';
    case 'activated':
    case 'deactivated':
      return 'minor';
    default:
      return 'patch';
  }
}

/**
 * Format change description for changelog
 */
function formatChangeDescription(history: TrainingHistory): string {
  switch (history.changeType) {
    case 'created':
      return `Created new training pattern`;
    case 'updated':
      return (history.reason !== '' && history.reason != null) ? history.reason : 'Updated training pattern';
    case 'deleted':
      return 'Deleted training pattern';
    case 'activated':
      return 'Activated training pattern';
    case 'deactivated':
      return 'Deactivated training pattern';
    default:
      return `${history.changeType} training pattern`;
  }
}

// ============================================================================
// MIGRATION & RECOVERY
// ============================================================================

/**
 * Validate training data integrity
 * 
 * Checks for corruption or inconsistencies.
 * 
 * @param trainingData - Training data to validate
 * @returns Validation result with errors
 */
export function validateIntegrity(trainingData: TrainingData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (!trainingData.id) {
    errors.push('Missing id');
  }
  if (!trainingData.organizationId) {
    errors.push('Missing organizationId');
  }
  if (!trainingData.signalId) {
    errors.push('Missing signalId');
  }
  if (!trainingData.pattern) {
    errors.push('Missing pattern');
  }

  // Check numeric constraints
  if (trainingData.confidence < 0 || trainingData.confidence > 100) {
    errors.push('Invalid confidence (must be 0-100)');
  }
  if (trainingData.positiveCount < 0) {
    errors.push('Invalid positiveCount (must be >= 0)');
  }
  if (trainingData.negativeCount < 0) {
    errors.push('Invalid negativeCount (must be >= 0)');
  }
  if (trainingData.seenCount < 0) {
    errors.push('Invalid seenCount (must be >= 0)');
  }
  if (trainingData.version <= 0) {
    errors.push('Invalid version (must be > 0)');
  }

  // Check logical consistency
  const total = trainingData.positiveCount + trainingData.negativeCount;
  if (trainingData.seenCount < total) {
    errors.push('seenCount less than total feedback count');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Recover corrupted training data from history
 * 
 * Attempts to restore from last known good version.
 * 
 * @param trainingDataId - Training data ID
 * @param organizationId - Organization ID
 * @returns Recovered data or null
 */
export async function recoverFromHistory(
  trainingDataId: string,
  organizationId: string
): Promise<TrainingData | null> {
  try {
    // Get all history entries for this training data
    const historyDocs = await db
      .collection(TRAINING_HISTORY_COLLECTION)
      .where('trainingDataId', '==', trainingDataId)
      .where('organizationId', '==', organizationId)
      .orderBy('version', 'desc')
      .get();

    // Find last valid version
    for (const doc of historyDocs.docs) {
      const history = doc.data() as TrainingHistory;
      const historyData = history.newValue;

      if (historyData) {
        const validation = validateIntegrity(historyData);

        if (validation.valid) {
          logger.info('Recovered training data from history', {
            trainingDataId,
            version: historyData.version,
            organizationId,
          });

          return historyData;
        }
      }
    }

    return null;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to recover from history', err, {
      trainingDataId,
      organizationId,
    });

    return null;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Convert Firestore Timestamp to Date
 */
function toDate(timestamp: Date | FirestoreTimestamp | { seconds: number } | string | number): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (timestamp && typeof (timestamp as FirestoreTimestamp).toDate === 'function') {
    return (timestamp as FirestoreTimestamp).toDate();
  }
  if (typeof timestamp === 'object' && 'seconds' in timestamp) {
    return new Date(timestamp.seconds * 1000);
  }
  return new Date(timestamp);
}

/**
 * Export changelog to markdown
 */
export function exportChangelogToMarkdown(changelog: Changelog): string {
  let markdown = `# Training Data Changelog\n\n`;
  markdown += `Generated: ${changelog.generatedAt.toISOString()}\n\n`;

  for (const entry of changelog.entries) {
    const badge =
      entry.type === 'major' ? '🔴' : entry.type === 'minor' ? '🟡' : '🟢';
    
    markdown += `## ${badge} Version ${entry.version} (${entry.type})\n\n`;
    markdown += `**Date:** ${entry.date.toISOString().split('T')[0]}\n`;
    markdown += `**Author:** ${entry.author}\n\n`;
    markdown += `**Changes:**\n`;
    
    for (const change of entry.changes) {
      markdown += `- ${change}\n`;
    }
    
    markdown += `\n`;
  }

  return markdown;
}
