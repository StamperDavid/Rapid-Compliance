/**
 * Calendar two-way sync — mission handler.
 *
 * For missions (refId = `mission-{id}`):
 *   - Cancel = call the existing `cancelMission` service. It flips the
 *     mission status to FAILED with 'Cancelled by user', marks RUNNING
 *     steps as FAILED, cascade-cancels every MissionSchedule that
 *     references this mission, and clears the mirrored calendar event.
 *     If the id matches a MissionSchedule instead of a Mission (the
 *     `mission-{scheduleId}` refId pattern used by recurring schedules),
 *     we fall back to cancelling the schedule directly.
 *   - Reschedule = update the matching MissionSchedule's `nextRunAt` so
 *     the next firing happens at the new operator-chosen time. One-shot
 *     missions don't carry a re-arm field; we surface a clear error in
 *     that case rather than silently drifting their start.
 *
 * Note: there is NO `SCRAPPED` mission status (the spec mentioned it,
 * but the actual enum is PENDING / PLAN_PENDING_APPROVAL / IN_PROGRESS
 * / AWAITING_APPROVAL / COMPLETED / FAILED). The closest legitimate
 * "throw it away" path is `cancelMission`, which sets status=FAILED
 * with 'Cancelled by user' — that's the standing-rule-correct service
 * to delegate to.
 */

import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import {
  cancelMission as cancelMissionService,
  getMission,
} from '@/lib/orchestrator/mission-persistence';
import {
  getSchedule,
  updateScheduleStatus,
} from '@/lib/orchestrator/mission-schedule-service';
import { getSubCollection } from '@/lib/firebase/collections';

const FILE = 'calendar-sync-handlers/mission.ts';

/**
 * Cancel a mission (or the schedule that maps to this calendar event).
 */
export async function cancelMission(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Prefer Mission match — it's the more common refId source.
    const mission = await getMission(id);
    if (mission) {
      const ok = await cancelMissionService(id);
      if (!ok) {
        return { success: false, error: `cancelMission service returned false for ${id}` };
      }
      logger.info('[calendar-sync-mission] Mission cancelled', { missionId: id, file: FILE });
      return { success: true };
    }

    // Fall back: maybe this id is actually a MissionSchedule id (recurring
    // schedules use `mission-{scheduleId}` for their calendar refId).
    const schedule = await getSchedule(id);
    if (schedule) {
      const ok = await updateScheduleStatus(id, 'cancelled');
      if (!ok) {
        return { success: false, error: `updateScheduleStatus returned false for schedule ${id}` };
      }
      logger.info('[calendar-sync-mission] Schedule cancelled', { scheduleId: id, file: FILE });
      return { success: true };
    }

    return { success: false, error: `No mission or schedule found for id ${id}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[calendar-sync-mission] cancelMission failed',
      err instanceof Error ? err : new Error(message),
      { id, file: FILE },
    );
    return { success: false, error: message };
  }
}

/**
 * Reschedule a mission by moving its associated MissionSchedule's nextRunAt.
 *
 * One-shot missions (no MissionSchedule) cannot be rescheduled via this
 * path — there's no per-mission `scheduledFor` field on the Mission doc.
 * In that case we return an honest error so the operator knows the
 * calendar move did NOT propagate.
 */
export async function rescheduleMission(
  id: string,
  newStart: Date,
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'Firestore admin not initialized' };
  }
  try {
    // Direct match: id is a schedule id.
    const schedule = await getSchedule(id);
    if (schedule) {
      if (schedule.status !== 'active') {
        return {
          success: false,
          error: `Cannot reschedule a schedule in status "${schedule.status}"`,
        };
      }
      await adminDb
        .collection(getSubCollection('missionSchedules'))
        .doc(id)
        .update({
          nextRunAt: newStart.toISOString(),
          updatedAt: new Date().toISOString(),
          rescheduledVia: 'google-calendar-sync',
        });
      logger.info('[calendar-sync-mission] Schedule rescheduled', {
        scheduleId: id,
        nextRunAt: newStart.toISOString(),
        file: FILE,
      });
      return { success: true };
    }

    // Fallback: id is a mission id — find the first active schedule that
    // points at this mission and move its nextRunAt instead.
    const mission = await getMission(id);
    if (!mission) {
      return { success: false, error: `No mission or schedule found for id ${id}` };
    }

    const activeSchedules = await adminDb
      .collection(getSubCollection('missionSchedules'))
      .where('sourceMissionId', '==', id)
      .where('status', '==', 'active')
      .get();

    if (activeSchedules.empty) {
      return {
        success: false,
        error:
          'Mission has no active schedule — one-shot missions cannot be rescheduled via calendar sync',
      };
    }

    const nowIso = new Date().toISOString();
    for (const doc of activeSchedules.docs) {
      await doc.ref.update({
        nextRunAt: newStart.toISOString(),
        updatedAt: nowIso,
        rescheduledVia: 'google-calendar-sync',
      });
    }

    logger.info('[calendar-sync-mission] Mission schedule(s) rescheduled', {
      missionId: id,
      scheduleCount: activeSchedules.size,
      nextRunAt: newStart.toISOString(),
      file: FILE,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[calendar-sync-mission] rescheduleMission failed',
      err instanceof Error ? err : new Error(message),
      { id, file: FILE },
    );
    return { success: false, error: message };
  }
}
