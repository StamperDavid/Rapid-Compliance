/**
 * Calendar two-way sync — handler registry barrel.
 *
 * The plumbing agent's `calendar-sync-engine.ts` calls
 * `runSyncSweep(calendarSyncHandlers)` after diffing operator-side
 * calendar mutations via syncToken. This barrel exposes the
 * per-category cancel + reschedule functions packaged as a single
 * `CalendarSyncHandlers` object.
 *
 * Per refId convention (see `google-calendar-service.ts`):
 *   social-post-{postId}        → social
 *   email-send-{sendId}         → email
 *   mission-{missionId|scheduleId} → mission
 *   workflow-action-{waitId}    → workflow
 *   content-calendar-{entryId}  → content (stubbed — no producer yet)
 *   meeting-{bookingId}         → meeting
 *   voice-call-{callId}         → voice
 */

import type {
  CalendarSyncHandlers,
  SyncCategory,
} from '@/lib/integrations/calendar-sync-engine';
import { logger } from '@/lib/logger/logger';
import { cancelMeeting, rescheduleMeeting } from './meeting';
import { cancelSocialPost, rescheduleSocialPost } from './social';
import { cancelEmail, rescheduleEmail } from './email';
import { cancelMission, rescheduleMission } from './mission';
import { cancelWorkflowAction, rescheduleWorkflowAction } from './workflow';
import { cancelVoiceCall, rescheduleVoiceCall } from './voice';
import { cancelContentEntry, rescheduleContentEntry } from './content';

const FILE = 'integrations/calendar-sync-handlers/index.ts';

const PREFIX_BY_CATEGORY: Record<SyncCategory, string> = {
  social: 'social-post-',
  email: 'email-send-',
  mission: 'mission-',
  workflow: 'workflow-action-',
  content: 'content-calendar-',
  meeting: 'meeting-',
  voice: 'voice-call-',
};

/**
 * Strip the category prefix from a refId. Tolerates a refId that already
 * lacks the prefix (returns it as-is) so the registry doesn't crash if
 * the engine pre-stripped or used a non-conforming id.
 */
function stripRefIdPrefix(refId: string, category: SyncCategory): string {
  const prefix = PREFIX_BY_CATEGORY[category];
  if (refId.startsWith(prefix)) {
    return refId.slice(prefix.length);
  }
  return refId;
}

export const calendarSyncHandlers: CalendarSyncHandlers = {
  async onCancel(refId: string, category: SyncCategory) {
    const id = stripRefIdPrefix(refId, category);
    try {
      switch (category) {
        case 'meeting':
          return await cancelMeeting(id);
        case 'social':
          return await cancelSocialPost(id);
        case 'email':
          return await cancelEmail(id);
        case 'mission':
          return await cancelMission(id);
        case 'workflow':
          return await cancelWorkflowAction(id);
        case 'voice':
          return await cancelVoiceCall(id);
        case 'content':
          return await cancelContentEntry(id);
        default: {
          const exhaustive: never = category;
          return {
            success: false,
            error: `Unknown sync category: ${String(exhaustive)}`,
          };
        }
      }
    } catch (err) {
      // Defensive — every handler already wraps its own errors, but if
      // anything escapes we still satisfy the never-throw contract.
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        '[calendar-sync] onCancel uncaught',
        err instanceof Error ? err : new Error(message),
        { refId, category, file: FILE },
      );
      return { success: false, error: message };
    }
  },

  async onReschedule(
    refId: string,
    category: SyncCategory,
    newStart: Date,
    newEnd: Date,
  ) {
    const id = stripRefIdPrefix(refId, category);
    try {
      switch (category) {
        case 'meeting':
          return await rescheduleMeeting(id, newStart, newEnd);
        case 'social':
          return await rescheduleSocialPost(id, newStart);
        case 'email':
          return await rescheduleEmail(id, newStart);
        case 'mission':
          return await rescheduleMission(id, newStart);
        case 'workflow':
          return await rescheduleWorkflowAction(id, newStart);
        case 'voice':
          return await rescheduleVoiceCall(id, newStart);
        case 'content':
          return await rescheduleContentEntry(id, newStart);
        default: {
          const exhaustive: never = category;
          return {
            success: false,
            error: `Unknown sync category: ${String(exhaustive)}`,
          };
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        '[calendar-sync] onReschedule uncaught',
        err instanceof Error ? err : new Error(message),
        { refId, category, file: FILE },
      );
      return { success: false, error: message };
    }
  },
};
