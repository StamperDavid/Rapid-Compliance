/**
 * Scheduled Voice Call API — POST (schedule) + GET (list)
 *
 * POST  /api/voice/calls/schedule  — operator (or Jasper via internal fetch)
 *   schedules a future-time outbound call. Body validated by
 *   `scheduleCallRequestSchema`. Auth: `requireRole(['owner','admin'])`.
 *
 * GET   /api/voice/calls/schedule  — list scheduled calls. Optional
 *   `?status=scheduled|firing|fired|failed|cancelled` filter.
 *
 * Cancel + reschedule live in `[id]/route.ts`.
 *
 * Calendar sync: every successful POST upserts a Google Calendar event
 * on the dedicated SalesVelocity.ai calendar with refId
 * `voice-call-{id}` and category `voice`. Failure to sync the calendar
 * is non-fatal — the schedule doc is still created and the cron will
 * still fire the call. Per
 * `feedback_one_google_account_per_tenant_runs_calendars_and_email`,
 * every scheduled platform action surfaces in the connected Google
 * Calendar.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getScheduledCallsCollection } from '@/lib/firebase/collections';
import { upsertSalesVelocityCalendarEvent } from '@/lib/integrations/google-calendar-service';
import {
  scheduleCallRequestSchema,
  type ScheduledCall,
  type ScheduledCallStatus,
  SCHEDULED_CALL_STATUSES,
} from '@/types/scheduled-call';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/voice/calls/schedule';

function buildCalendarSummary(recipientName: string | undefined, to: string): string {
  return `Call: ${recipientName && recipientName.length > 0 ? recipientName : to}`;
}

function buildCalendarDescription(args: {
  to: string;
  recipientName?: string;
  goal: string;
  contactId?: string;
  leadId?: string;
}): string {
  const lines: string[] = [];
  lines.push(`Recipient: ${args.recipientName ?? args.to}`);
  lines.push(`Phone: ${args.to}`);
  lines.push(`Goal: ${args.goal}`);
  if (args.contactId) {
    lines.push(`Contact id: ${args.contactId}`);
  }
  if (args.leadId) {
    lines.push(`Lead id: ${args.leadId}`);
  }
  lines.push('');
  lines.push('Auto-managed by SalesVelocity.ai — this call will fire automatically at the scheduled time.');
  return lines.join('\n');
}

/**
 * POST /api/voice/calls/schedule — schedule a future-time outbound call.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, ROUTE);
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) { return authResult; }

    const rawBody: unknown = await request.json();
    const parsed = scheduleCallRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return errors.badRequest(
        parsed.error.errors[0]?.message ?? 'Invalid request body',
        { issues: parsed.error.errors },
      );
    }

    const { to, recipientName, contactId, leadId, goal, scheduledFor } = parsed.data;

    // Reject "schedule for the past" up-front. The cron would still fire
    // immediately on the next tick, but we want a clear UX error rather
    // than implicit "fire now".
    const scheduledForMs = new Date(scheduledFor).getTime();
    if (Number.isNaN(scheduledForMs)) {
      return errors.badRequest('scheduledFor is not a valid datetime');
    }
    if (scheduledForMs <= Date.now()) {
      return errors.badRequest('scheduledFor must be in the future. Use /api/voice/call to dial right now.');
    }

    const id = `sched-call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();

    const doc: ScheduledCall = {
      id,
      to,
      recipientName,
      contactId,
      leadId,
      goal,
      scheduledFor,
      status: 'scheduled',
      createdAt: nowIso,
      createdBy: authResult.user.uid,
    };

    await AdminFirestoreService.set(
      getScheduledCallsCollection(),
      id,
      doc,
      false,
    );

    // Calendar sync — non-fatal on failure. We log + continue so a
    // disconnected Google account never blocks call scheduling.
    let calendarLink: string | null = null;
    try {
      const result = await upsertSalesVelocityCalendarEvent({
        refId: `voice-call-${id}`,
        summary: buildCalendarSummary(recipientName, to),
        description: buildCalendarDescription({ to, recipientName, goal, contactId, leadId }),
        startIso: scheduledFor,
        timeZone: 'America/New_York',
        category: 'voice',
      });
      calendarLink = result?.htmlLink ?? null;
    } catch (calErr) {
      logger.warn('[schedule-call] calendar sync failed (non-fatal)', {
        route: ROUTE,
        scheduleId: id,
        error: calErr instanceof Error ? calErr.message : String(calErr),
      });
    }

    logger.info('[schedule-call] scheduled', {
      route: ROUTE,
      scheduleId: id,
      to,
      scheduledFor,
      calendarSynced: calendarLink !== null,
    });

    return NextResponse.json({
      success: true,
      scheduledCall: doc,
      calendarLink,
    });
  } catch (error: unknown) {
    logger.error(
      '[schedule-call] POST failed',
      error instanceof Error ? error : new Error(String(error)),
      { route: ROUTE },
    );
    return errors.internal('Failed to schedule call', error instanceof Error ? error : undefined);
  }
}

/**
 * GET /api/voice/calls/schedule — list scheduled calls.
 *
 * Query params:
 *   status — optional filter (scheduled | firing | fired | failed | cancelled)
 *
 * Returns the most recent 200 docs ordered by `scheduledFor` desc.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, ROUTE);
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const status: ScheduledCallStatus | null =
      statusParam !== null && (SCHEDULED_CALL_STATUSES as readonly string[]).includes(statusParam)
        ? (statusParam as ScheduledCallStatus)
        : null;

    if (!adminDb) {
      return errors.internal('Firestore admin not initialized');
    }

    let query: FirebaseFirestore.Query = adminDb.collection(getScheduledCallsCollection());
    if (status) {
      query = query.where('status', '==', status);
    }
    query = query.orderBy('scheduledFor', 'desc').limit(200);

    const snap = await query.get();
    const items: ScheduledCall[] = snap.docs.map((d) => {
      const data = d.data() as Partial<ScheduledCall>;
      return { ...(data as ScheduledCall), id: d.id };
    });

    return NextResponse.json({
      success: true,
      total: items.length,
      scheduledCalls: items,
    });
  } catch (error: unknown) {
    logger.error(
      '[schedule-call] GET failed',
      error instanceof Error ? error : new Error(String(error)),
      { route: ROUTE },
    );
    return errors.internal('Failed to list scheduled calls', error instanceof Error ? error : undefined);
  }
}
