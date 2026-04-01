/**
 * Mission Grade Service
 *
 * Handles creation, retrieval, and deletion of mission grades.
 * Low scores automatically trigger the training auto-flag pipeline.
 *
 * Firestore Collection:
 * - organizations/{PLATFORM_ID}/missionGrades/{gradeId}
 *
 * @module orchestrator/mission-grade-service
 */

import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { autoFlagForTraining } from '@/lib/training/auto-flag-service';
import { starToScore, type MissionGrade } from '@/types/mission-grades';

// ============================================================================
// CONSTANTS
// ============================================================================

const GRADES_COLLECTION = 'missionGrades';
/** Scores below this threshold (exclusive) trigger auto-flag for training */
const TRAINING_FLAG_THRESHOLD = 60;

// ============================================================================
// HELPERS
// ============================================================================

function gradesCollectionPath(): string {
  return getSubCollection(GRADES_COLLECTION);
}

function missionsCollectionPath(): string {
  return getSubCollection('missions');
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Submit a grade for a mission (or a specific step within it).
 *
 * - Creates a MissionGrade document in Firestore.
 * - Sets `graded: true` on the mission document.
 * - If the normalized score is below the training threshold, flags the
 *   mission for training review via the auto-flag pipeline.
 *
 * @returns The generated gradeId.
 */
export async function submitGrade(
  missionId: string,
  gradedBy: string,
  score: number,
  stepId?: string,
  explanation?: string
): Promise<string> {
  if (!adminDb) {
    logger.warn('[MissionGradeService] Firestore not available — submitGrade skipped', {
      missionId,
    });
    return '';
  }

  const now = new Date().toISOString();
  const gradeId = `grade_${missionId}_${stepId ?? 'overall'}_${Date.now()}`;

  const grade: MissionGrade = {
    id: gradeId,
    missionId,
    gradedAt: now,
    gradedBy,
    score,
    processedForTraining: false,
    ...(stepId !== undefined ? { stepId } : {}),
    ...(explanation !== undefined ? { explanation } : {}),
  };

  await adminDb
    .collection(gradesCollectionPath())
    .doc(gradeId)
    .set(grade);

  logger.info('[MissionGradeService] Grade submitted', {
    gradeId,
    missionId,
    score,
    stepId,
  });

  // Mark the mission document as graded
  try {
    await adminDb
      .collection(missionsCollectionPath())
      .doc(missionId)
      .update({ graded: true });
  } catch (error) {
    // Mission may not exist — log and continue; the grade doc is the source of truth
    logger.warn('[MissionGradeService] Failed to set graded flag on mission', {
      missionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Auto-flag for training if score is below threshold
  const normalizedScore = starToScore(score);
  if (normalizedScore < TRAINING_FLAG_THRESHOLD) {
    const issues: string[] = [];
    if (explanation) {
      issues.push(explanation);
    } else {
      issues.push(`Low mission quality rating: ${score}/5 stars`);
    }

    try {
      await autoFlagForTraining(missionId, 'orchestrator', normalizedScore, issues);
      logger.info('[MissionGradeService] Mission flagged for training', {
        missionId,
        normalizedScore,
      });
    } catch (error) {
      // Auto-flag failure must not block the grade submission response
      logger.warn('[MissionGradeService] Auto-flag failed — grade still saved', {
        missionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return gradeId;
}

/**
 * Retrieve all grades associated with a given mission.
 * Returns overall mission grades and any step-level grades, ordered
 * newest-first.
 */
export async function getGradesForMission(missionId: string): Promise<MissionGrade[]> {
  if (!adminDb) {
    logger.warn('[MissionGradeService] Firestore not available — getGradesForMission skipped');
    return [];
  }

  try {
    const snap = await adminDb
      .collection(gradesCollectionPath())
      .where('missionId', '==', missionId)
      .orderBy('gradedAt', 'desc')
      .get();

    return snap.docs.map((doc) => doc.data() as MissionGrade);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[MissionGradeService] Failed to fetch grades',
      error instanceof Error ? error : undefined,
      { missionId, error: errorMsg }
    );
    return [];
  }
}

/**
 * Permanently delete a grade document.
 */
export async function deleteGrade(gradeId: string): Promise<boolean> {
  if (!adminDb) {
    logger.warn('[MissionGradeService] Firestore not available — deleteGrade skipped');
    return false;
  }

  try {
    await adminDb.collection(gradesCollectionPath()).doc(gradeId).delete();
    logger.info('[MissionGradeService] Grade deleted', { gradeId });
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[MissionGradeService] Failed to delete grade',
      error instanceof Error ? error : undefined,
      { gradeId, error: errorMsg }
    );
    return false;
  }
}
