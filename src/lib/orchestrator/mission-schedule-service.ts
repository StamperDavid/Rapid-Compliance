/**
 * Mission Schedule Service — Firestore-backed scheduling for repeating missions.
 *
 * Stores schedule documents under:
 *   organizations/{PLATFORM_ID}/missionSchedules/{scheduleId}
 *
 * Responsibilities:
 * - CRUD operations on MissionSchedule documents
 * - nextRunAt calculation for each ScheduleFrequency
 * - Querying schedules that are due to run
 * - Recording the result of a completed run
 *
 * @module orchestrator/mission-schedule-service
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type { MissionSchedule, ScheduleFrequency, ScheduleStatus } from '@/types/mission-schedule';

// ============================================================================
// HELPERS
// ============================================================================

function schedulesCollectionPath(): string {
  return getSubCollection('missionSchedules');
}

/**
 * Returns an ISO string for the next run time based on the given frequency.
 *
 * Intervals:
 * - daily:    +24 hours
 * - weekly:   +7 days
 * - biweekly: +14 days
 * - monthly:  +30 days
 * - custom:   +customIntervalHours hours (falls back to 24 h if not provided)
 */
export function calculateNextRun(
  frequency: ScheduleFrequency,
  customIntervalHours?: number
): string {
  const now = Date.now();
  const HOUR_MS = 60 * 60 * 1000;

  const offsetHours: Record<Exclude<ScheduleFrequency, 'custom'>, number> = {
    daily: 24,
    weekly: 7 * 24,
    biweekly: 14 * 24,
    monthly: 30 * 24,
  };

  if (frequency === 'custom') {
    const hours = customIntervalHours && customIntervalHours > 0 ? customIntervalHours : 24;
    return new Date(now + hours * HOUR_MS).toISOString();
  }

  return new Date(now + offsetHours[frequency] * HOUR_MS).toISOString();
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Create a new MissionSchedule document.
 *
 * @returns The newly created MissionSchedule, or null when Firestore is unavailable.
 */
export async function createSchedule(
  sourceMissionId: string,
  name: string,
  prompt: string,
  frequency: ScheduleFrequency,
  createdBy: string,
  customIntervalHours?: number,
  expiresAt?: string
): Promise<MissionSchedule | null> {
  if (!adminDb) {
    logger.warn('[MissionSchedule] Firestore not available — createSchedule skipped', {
      sourceMissionId,
    });
    return null;
  }

  try {
    const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const schedule: MissionSchedule = {
      id,
      sourceMissionId,
      name,
      prompt,
      frequency,
      status: 'active',
      nextRunAt: calculateNextRun(frequency, customIntervalHours),
      runCount: 0,
      runHistory: [],
      createdBy,
      createdAt: now,
      updatedAt: now,
      ...(customIntervalHours !== undefined ? { customIntervalHours } : {}),
      ...(expiresAt ? { expiresAt } : {}),
    };

    await adminDb.collection(schedulesCollectionPath()).doc(id).set(schedule);

    logger.info('[MissionSchedule] Schedule created', {
      id,
      sourceMissionId,
      frequency,
      nextRunAt: schedule.nextRunAt,
    });

    return schedule;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[MissionSchedule] Failed to create schedule',
      error instanceof Error ? error : undefined,
      { sourceMissionId, error: errorMsg }
    );
    return null;
  }
}

/**
 * Return all schedules, ordered ascending by nextRunAt.
 */
export async function getSchedules(): Promise<MissionSchedule[]> {
  if (!adminDb) {
    logger.warn('[MissionSchedule] Firestore not available — getSchedules skipped');
    return [];
  }

  try {
    const snap = await adminDb
      .collection(schedulesCollectionPath())
      .orderBy('nextRunAt', 'asc')
      .get();

    return snap.docs.map((doc) => doc.data() as MissionSchedule);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[MissionSchedule] Failed to get schedules',
      error instanceof Error ? error : undefined,
      { error: errorMsg }
    );
    return [];
  }
}

/**
 * Return a single schedule by ID, or null if not found.
 */
export async function getSchedule(scheduleId: string): Promise<MissionSchedule | null> {
  if (!adminDb) {
    logger.warn('[MissionSchedule] Firestore not available — getSchedule skipped');
    return null;
  }

  try {
    const doc = await adminDb
      .collection(schedulesCollectionPath())
      .doc(scheduleId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as MissionSchedule;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[MissionSchedule] Failed to get schedule',
      error instanceof Error ? error : undefined,
      { scheduleId, error: errorMsg }
    );
    return null;
  }
}

/**
 * Update the status of a schedule (pause, resume, or expire).
 *
 * @returns true on success, false otherwise.
 */
export async function updateScheduleStatus(
  scheduleId: string,
  status: ScheduleStatus
): Promise<boolean> {
  if (!adminDb) {
    logger.warn('[MissionSchedule] Firestore not available — updateScheduleStatus skipped');
    return false;
  }

  try {
    await adminDb
      .collection(schedulesCollectionPath())
      .doc(scheduleId)
      .update({
        status,
        updatedAt: new Date().toISOString(),
      });

    logger.info('[MissionSchedule] Status updated', { scheduleId, status });
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[MissionSchedule] Failed to update status',
      error instanceof Error ? error : undefined,
      { scheduleId, status, error: errorMsg }
    );
    return false;
  }
}

/**
 * Record the completion of a scheduled run.
 *
 * Increments runCount, appends the missionId to runHistory, sets lastRunAt,
 * advances nextRunAt, and marks the schedule as expired if expiresAt has passed.
 */
export async function recordRun(
  scheduleId: string,
  missionId: string
): Promise<boolean> {
  if (!adminDb) {
    logger.warn('[MissionSchedule] Firestore not available — recordRun skipped');
    return false;
  }

  try {
    const { FieldValue } = await import('firebase-admin/firestore');
    const docRef = adminDb.collection(schedulesCollectionPath()).doc(scheduleId);
    const doc = await docRef.get();

    if (!doc.exists) {
      logger.warn('[MissionSchedule] Schedule not found for recordRun', { scheduleId });
      return false;
    }

    const schedule = doc.data() as MissionSchedule;
    const now = new Date().toISOString();
    const nextRunAt = calculateNextRun(schedule.frequency, schedule.customIntervalHours);

    // Determine whether this run causes expiry
    const nowMs = Date.now();
    const isExpired =
      schedule.expiresAt !== undefined && new Date(nextRunAt).getTime() > new Date(schedule.expiresAt).getTime()
        ? true
        : schedule.expiresAt !== undefined && nowMs >= new Date(schedule.expiresAt).getTime();

    await docRef.update({
      runCount: FieldValue.increment(1),
      runHistory: FieldValue.arrayUnion(missionId),
      lastRunAt: now,
      nextRunAt,
      updatedAt: now,
      ...(isExpired ? { status: 'expired' as ScheduleStatus } : {}),
    });

    logger.info('[MissionSchedule] Run recorded', {
      scheduleId,
      missionId,
      nextRunAt,
      isExpired,
    });

    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[MissionSchedule] Failed to record run',
      error instanceof Error ? error : undefined,
      { scheduleId, missionId, error: errorMsg }
    );
    return false;
  }
}

/**
 * Return all active schedules whose nextRunAt is at or before now.
 * These are candidates to be dispatched by a cron/background job.
 */
export async function getSchedulesDue(): Promise<MissionSchedule[]> {
  if (!adminDb) {
    logger.warn('[MissionSchedule] Firestore not available — getSchedulesDue skipped');
    return [];
  }

  try {
    const now = new Date().toISOString();

    const snap = await adminDb
      .collection(schedulesCollectionPath())
      .where('status', '==', 'active')
      .where('nextRunAt', '<=', now)
      .orderBy('nextRunAt', 'asc')
      .get();

    return snap.docs.map((doc) => doc.data() as MissionSchedule);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[MissionSchedule] Failed to get due schedules',
      error instanceof Error ? error : undefined,
      { error: errorMsg }
    );
    return [];
  }
}

/**
 * Permanently delete a schedule document.
 *
 * @returns true on success, false if not found or on error.
 */
export async function deleteSchedule(scheduleId: string): Promise<boolean> {
  if (!adminDb) {
    logger.warn('[MissionSchedule] Firestore not available — deleteSchedule skipped');
    return false;
  }

  try {
    const docRef = adminDb.collection(schedulesCollectionPath()).doc(scheduleId);
    const doc = await docRef.get();

    if (!doc.exists) {
      logger.warn('[MissionSchedule] Schedule not found for delete', { scheduleId });
      return false;
    }

    await docRef.delete();
    logger.info('[MissionSchedule] Schedule deleted', { scheduleId });
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[MissionSchedule] Failed to delete schedule',
      error instanceof Error ? error : undefined,
      { scheduleId, error: errorMsg }
    );
    return false;
  }
}
