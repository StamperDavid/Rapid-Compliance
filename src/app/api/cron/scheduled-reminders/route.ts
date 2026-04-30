/**
 * Scheduled Reminders Cron Endpoint
 *
 * Processes the `scheduledReminders` collection populated by
 * `scheduleReminders()` in `src/lib/meetings/scheduler-engine.ts`. For each
 * pending reminder whose `sendAt` is in the past, fires `sendMeetingReminder`
 * (which loads the meeting record, picks the 24h vs 1h template based on
 * `hoursBeforeMeeting`, and emails the attendees).
 *
 * Schedule: every 5 minutes via vercel.json. The 5-minute granularity is
 * acceptable because the templates already say "tomorrow at <time>" / "in
 * about an hour" rather than exact-minute-precision; a few minutes of slack
 * reads naturally.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { sendMeetingReminder } from '@/lib/meetings/scheduler-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ScheduledReminderDoc {
  meetingId: string;
  sendAt: Date | { toDate: () => Date } | string;
  type: string;
  hoursBeforeMeeting: number;
  status: 'pending' | 'sent' | 'failed';
  attendees?: Array<{ name?: string; email: string; phone?: string }>;
}

function toDate(value: ScheduledReminderDoc['sendAt']): Date | null {
  if (value instanceof Date) { return value; }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authError = verifyCronAuth(request, '/api/cron/scheduled-reminders');
    if (authError) { return authError; }

    if (!adminDb) {
      logger.error('[scheduled-reminders cron] adminDb not available', new Error('Firebase Admin not initialized'));
      return NextResponse.json({ success: false, error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const collectionPath = `organizations/${PLATFORM_ID}/scheduledReminders`;
    const now = new Date();

    // Pull pending reminders. We don't use a where('sendAt', '<=', now)
    // because sendAt may be stored as Date | Timestamp | ISO string across
    // historical records; in-memory filter avoids index requirements.
    const snap = await adminDb.collection(collectionPath).where('status', '==', 'pending').get();

    const dueReminders: Array<{ id: string; data: ScheduledReminderDoc }> = [];
    snap.forEach((doc) => {
      const data = doc.data() as ScheduledReminderDoc;
      const sendAt = toDate(data.sendAt);
      if (sendAt && sendAt.getTime() <= now.getTime()) {
        dueReminders.push({ id: doc.id, data });
      }
    });

    let sent = 0;
    let failed = 0;
    const errors: Array<{ reminderId: string; error: string }> = [];

    for (const reminder of dueReminders) {
      try {
        await sendMeetingReminder(reminder.data.meetingId, reminder.data.hoursBeforeMeeting);
        await adminDb.collection(collectionPath).doc(reminder.id).update({
          status: 'sent',
          sentAt: new Date(),
        });
        sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed++;
        errors.push({ reminderId: reminder.id, error: msg });
        await adminDb.collection(collectionPath).doc(reminder.id).update({
          status: 'failed',
          lastError: msg,
          lastAttemptAt: new Date(),
        });
        logger.warn('[scheduled-reminders cron] failed to send reminder', {
          reminderId: reminder.id,
          meetingId: reminder.data.meetingId,
          error: msg,
        });
      }
    }

    logger.info('[scheduled-reminders cron] complete', {
      due: dueReminders.length,
      sent,
      failed,
    });

    return NextResponse.json({
      success: true,
      due: dueReminders.length,
      sent,
      failed,
      errors,
      timestamp: now.toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[scheduled-reminders cron] error', error instanceof Error ? error : new Error(errorMessage), {
      route: '/api/cron/scheduled-reminders',
    });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
