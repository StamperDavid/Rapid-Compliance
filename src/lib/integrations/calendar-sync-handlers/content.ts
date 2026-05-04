/**
 * Calendar two-way sync — content calendar entry handler.
 *
 * For content entries (refId = `content-calendar-{entryId}`):
 *   - Cancel + reschedule are STUBBED. There is currently no producer
 *     service that writes content-calendar entries to Firestore — the
 *     refId convention is documented in `google-calendar-service.ts`
 *     (`upsertSalesVelocityCalendarEvent` JSDoc) but no consumer code
 *     uses it yet.
 *
 * Once a content scheduling service ships (likely a `contentCalendar`
 * collection alongside `scheduledCalls`), wire this up to flip the
 * entry's status / move its scheduled time. Until then we log + return
 * success so the calendar sync sweep doesn't crash on `content`-category
 * events that arrive from a future code path.
 */

import { logger } from '@/lib/logger/logger';

const FILE = 'calendar-sync-handlers/content.ts';

/**
 * Cancel a scheduled content-calendar entry. STUBBED.
 */
export function cancelContentEntry(
  entryId: string,
): Promise<{ success: boolean; error?: string }> {
  logger.warn('[calendar-sync-content] cancel not yet wired — content scheduling service is missing', {
    entryId,
    file: FILE,
  });
  return Promise.resolve({ success: true });
}

/**
 * Reschedule a content-calendar entry. STUBBED.
 */
export function rescheduleContentEntry(
  entryId: string,
  newStart: Date,
): Promise<{ success: boolean; error?: string }> {
  logger.warn(
    '[calendar-sync-content] reschedule not yet wired — content scheduling service is missing',
    {
      entryId,
      newStart: newStart.toISOString(),
      file: FILE,
    },
  );
  return Promise.resolve({ success: true });
}
