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
import {
  upsertSalesVelocityCalendarEvent,
  deleteSalesVelocityCalendarEvent,
} from '@/lib/integrations/google-calendar-service';
import { getMission } from '@/lib/orchestrator/mission-persistence';
import type { MissionSchedule, ScheduleFrequency, ScheduleStatus } from '@/types/mission-schedule';

// ============================================================================
// CALENDAR INTEGRATION (mission scheduling → SalesVelocity calendar)
// ============================================================================
//
// Architectural rule: every scheduled platform action surfaces in the
// connected Google Calendar. When the operator "schedules a mission" via
// Mission Control, we mirror the next-run time onto the dedicated
// SalesVelocity.ai calendar so the operator can see it alongside their
// other planned work.
//
// One calendar event per MissionSchedule, keyed by `mission-{scheduleId}`.
// Idempotent upsert — re-keying the next-run time after each fired run
// patches the same event in place. Status transitions (pause / expire /
// delete) call deleteSalesVelocityCalendarEvent so a paused or scrapped
// schedule disappears from the calendar.
//
// Failures are non-fatal: the helper logs + returns null. We never block
// the user-facing scheduling action on calendar sync.

function calendarRefIdForSchedule(scheduleId: string): string {
  return `mission-${scheduleId}`;
}

/**
 * Build the calendar event payload for a given schedule. Loads the source
 * mission (best-effort) so we can include the mission title, prompt, and
 * step count in the description. Source-mission lookup failures fall back
 * to schedule-only fields — this is informational, not load-bearing.
 */
async function buildScheduleCalendarPayload(
  schedule: MissionSchedule,
  startIso: string,
): Promise<{
  refId: string;
  summary: string;
  description: string;
  startIso: string;
  timeZone: string;
  category: 'mission';
}> {
  const mission = await getMission(schedule.sourceMissionId).catch(() => null);

  const promptForTitle = ((schedule.prompt !== '' ? schedule.prompt : null) ?? mission?.userPrompt ?? '').slice(0, 80);
  const titleCandidate =
    (schedule.name !== '' ? schedule.name : null) ??
    (mission?.title !== undefined && mission.title !== '' ? mission.title : null) ??
    (promptForTitle !== '' ? promptForTitle : null) ??
    schedule.sourceMissionId;
  const titleBase = titleCandidate.slice(0, 120);
  const summary = `Mission: ${titleBase}`;

  const stepCount = mission?.steps.length ?? 0;
  const firstStepName = mission?.steps[0]?.toolName ?? '';
  const promptSnippet = ((schedule.prompt !== '' ? schedule.prompt : null) ?? mission?.userPrompt ?? '').slice(0, 500);

  const description = [
    `Mission ID: ${schedule.sourceMissionId}`,
    `Schedule ID: ${schedule.id}`,
    `Frequency: ${schedule.frequency}${schedule.customIntervalHours !== undefined ? ` (${schedule.customIntervalHours}h)` : ''}`,
    `Steps: ${stepCount}`,
    `First step: ${firstStepName}`,
    '',
    'Prompt:',
    promptSnippet,
  ].join('\n');

  return {
    refId: calendarRefIdForSchedule(schedule.id),
    summary,
    description,
    startIso,
    timeZone: 'America/New_York',
    category: 'mission',
  };
}

/**
 * Best-effort upsert of the calendar event for an active schedule.
 * Wraps the helper in try/catch so calendar failures never derail the
 * primary schedule write.
 */
async function syncScheduleToCalendar(schedule: MissionSchedule): Promise<void> {
  if (schedule.status !== 'active') {
    return;
  }
  try {
    const payload = await buildScheduleCalendarPayload(schedule, schedule.nextRunAt);
    await upsertSalesVelocityCalendarEvent(payload);
  } catch (err) {
    logger.warn('[MissionSchedule] Calendar sync (upsert) failed — continuing', {
      scheduleId: schedule.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Best-effort delete of the calendar event for a schedule that is being
 * paused, expired, or removed. Idempotent — the helper itself no-ops if
 * no mapping exists.
 */
async function removeScheduleCalendarEvent(scheduleId: string): Promise<void> {
  try {
    await deleteSalesVelocityCalendarEvent(calendarRefIdForSchedule(scheduleId));
  } catch (err) {
    logger.warn('[MissionSchedule] Calendar sync (delete) failed — continuing', {
      scheduleId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

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

    // Mirror to the connected Google Calendar (best-effort, non-fatal).
    // The "Schedule this mission" UX in Mission Control lands here; one
    // event per schedule, keyed by `mission-{scheduleId}`. Subsequent
    // run records or pause/resume calls patch or delete the same event.
    await syncScheduleToCalendar(schedule);

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

    // Calendar sync: paused / expired schedules disappear from the
    // operator's calendar; resumed (active) schedules get re-upserted
    // with their current nextRunAt.
    if (status === 'active') {
      const refreshed = await getSchedule(scheduleId);
      if (refreshed) {
        await syncScheduleToCalendar(refreshed);
      }
    } else {
      await removeScheduleCalendarEvent(scheduleId);
    }

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

    // Calendar sync: if this run pushed the schedule past its expiry,
    // remove the calendar event entirely. Otherwise patch the existing
    // event to point at the new nextRunAt so the operator sees the
    // upcoming firing on their calendar.
    if (isExpired) {
      await removeScheduleCalendarEvent(scheduleId);
    } else {
      const refreshed: MissionSchedule = {
        ...schedule,
        nextRunAt,
        lastRunAt: now,
        runCount: schedule.runCount + 1,
        updatedAt: now,
      };
      await syncScheduleToCalendar(refreshed);
    }

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
 * Cascade-cancel every active schedule that was built from a given source
 * mission. Called from `mission-persistence.ts`'s cancel/delete/reject
 * paths so a deleted source mission doesn't leave orphan schedules
 * silently re-firing on cron and re-upserting calendar events.
 *
 * Each affected schedule is flipped to `cancelled` status and its
 * mirrored calendar event (keyed by `mission-{scheduleId}`) is removed.
 * `cancelled` is distinct from `expired`/`paused` so the audit trail
 * makes the cause clear: the source mission went away, not the clock.
 *
 * Failures on individual schedules are logged but never thrown — a
 * missing calendar mapping or a Firestore hiccup on one schedule must
 * not block the others or the upstream cancel/delete operation.
 *
 * @returns The number of schedules successfully cancelled.
 */
export async function cancelSchedulesForMission(
  sourceMissionId: string,
): Promise<number> {
  if (!adminDb) {
    logger.warn('[MissionSchedule] Firestore not available — cancelSchedulesForMission skipped', {
      sourceMissionId,
    });
    return 0;
  }

  try {
    const snap = await adminDb
      .collection(schedulesCollectionPath())
      .where('sourceMissionId', '==', sourceMissionId)
      .where('status', '==', 'active')
      .get();

    if (snap.empty) {
      return 0;
    }

    let cancelled = 0;
    const now = new Date().toISOString();

    for (const doc of snap.docs) {
      const schedule = doc.data() as MissionSchedule;
      try {
        await doc.ref.update({
          status: 'cancelled' as ScheduleStatus,
          updatedAt: now,
        });
        await removeScheduleCalendarEvent(schedule.id);
        cancelled += 1;
      } catch (innerErr) {
        logger.warn('[MissionSchedule] Failed to cancel one schedule — continuing', {
          scheduleId: schedule.id,
          sourceMissionId,
          error: innerErr instanceof Error ? innerErr.message : String(innerErr),
        });
      }
    }

    if (cancelled > 0) {
      logger.info('[MissionSchedule] Cascade-cancelled schedules for source mission', {
        sourceMissionId,
        cancelled,
        totalMatching: snap.docs.length,
      });
    }

    return cancelled;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn('[MissionSchedule] cancelSchedulesForMission query failed — continuing', {
      sourceMissionId,
      error: errorMsg,
    });
    return 0;
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

    // Calendar sync: remove the mirrored event. Idempotent — no-ops
    // when the schedule never had a calendar mapping (e.g., calendar
    // sync was disconnected at create time).
    await removeScheduleCalendarEvent(scheduleId);

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
