/**
 * Mission Grading Types
 *
 * Optional grading system for Jasper's orchestration performance.
 * Ungraded missions are assumed satisfactory (100%).
 */

export interface MissionGrade {
  id: string;
  missionId: string;
  /** null/undefined = overall mission grade; string = specific step grade */
  stepId?: string;
  /** 1-5 star rating */
  score: number;
  /** Optional explanation of the grade */
  explanation?: string;
  gradedAt: string;
  gradedBy: string;
  /** Has this grade been processed by the training pipeline? */
  processedForTraining: boolean;
}

/** Convert star rating (1-5) to normalized 0-100 score */
export function starToScore(stars: number): number {
  return Math.round(Math.min(5, Math.max(1, stars)) * 20);
}
