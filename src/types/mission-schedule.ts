/**
 * Mission Schedule Types
 * Reusable mission templates with auto-run scheduling.
 *
 * @module types/mission-schedule
 */

/**
 * How often a scheduled mission replays itself.
 * 'custom' uses the customIntervalHours field.
 */
export type ScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

/**
 * Lifecycle state of a schedule.
 * - active: eligible to run when nextRunAt is reached
 * - paused: user has temporarily suspended it
 * - expired: expiresAt has passed and the schedule will not run again
 */
export type ScheduleStatus = 'active' | 'paused' | 'expired';

/**
 * A saved, reusable mission template that auto-runs on a configurable schedule.
 *
 * Stored at: organizations/{PLATFORM_ID}/missionSchedules/{id}
 */
export interface MissionSchedule {
  id: string;
  /** The original mission this was saved from */
  sourceMissionId: string;
  /** Display name for the schedule */
  name: string;
  /** The original user prompt to replay */
  prompt: string;
  /** How often to run */
  frequency: ScheduleFrequency;
  /** For 'custom' frequency: interval in hours */
  customIntervalHours?: number;
  /** Optional: ISO date string — stop running after this point */
  expiresAt?: string;
  /** Schedule lifecycle status */
  status: ScheduleStatus;
  /** ISO timestamp of the most recent run, if any */
  lastRunAt?: string;
  /** ISO timestamp of the next scheduled run */
  nextRunAt: string;
  /** Total number of completed runs */
  runCount: number;
  /** Mission IDs produced by each run, ordered oldest-first */
  runHistory: string[];
  /** UID of the user who created the schedule */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
