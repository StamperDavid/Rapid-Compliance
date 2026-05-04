/**
 * Scheduled Voice Call API — single-doc operations
 *
 * GET     /api/voice/calls/schedule/[id]  — fetch one schedule doc
 * DELETE  /api/voice/calls/schedule/[id]  — cancel a scheduled call
 * PATCH   /api/voice/calls/schedule/[id]  — reschedule (update scheduledFor / goal / recipient)
 *
 * All three flip the matching SalesVelocity.ai calendar event:
 *   - DELETE → removes the event
 *   - PATCH  → re-upserts with the new time/title/description
 *
 * Auth: `requireRole(['owner','admin'])`.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getScheduledCallsCollection } from '@/lib/firebase/collections';
import {
  upsertSalesVelocityCalendarEvent,
  deleteSalesVelocityCalendarEvent,
} from '@/lib/integrations/google-calendar-service';
import {
  updateScheduledCallSchema,
  type ScheduledCall,
} from '@/types/scheduled-call';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/voice/calls/schedule/[id]';

type RouteContext = { params: Promise<{ id: string }> };

const cancelBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

function calendarRefId(scheduleId: string): string {
  return `voice-call-${scheduleId}`;
}

function buildSummary(call: ScheduledCall): string {
  const display = call.recipientName && call.recipientName.length > 0 ? call.recipientName : call.to;
  return `Call: ${display}`;
}

function buildDescription(call: ScheduledCall): string {
  const lines: string[] = [
    `Recipient: ${call.recipientName ?? call.to}`,
    `Phone: ${call.to}`,
    `Goal: ${call.goal}`,
  ];
  if (call.contactId) { lines.push(`Contact id: ${call.contactId}`); }
  if (call.leadId) { lines.push(`Lead id: ${call.leadId}`); }
  lines.push('');
  lines.push('Auto-managed by SalesVelocity.ai — this call will fire automatically at the scheduled time.');
  return lines.join('\n');
}

/**
 * GET /api/voice/calls/schedule/[id]
 */
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, ROUTE);
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) { return authResult; }

    const { id } = await context.params;
    const doc = await AdminFirestoreService.get<ScheduledCall>(getScheduledCallsCollection(), id);
    if (!doc) {
      return errors.notFound('Scheduled call not found');
    }
    return NextResponse.json({ success: true, scheduledCall: doc });
  } catch (error: unknown) {
    logger.error(
      '[schedule-call] GET[id] failed',
      error instanceof Error ? error : new Error(String(error)),
      { route: ROUTE },
    );
    return errors.internal('Failed to load scheduled call', error instanceof Error ? error : undefined);
  }
}

/**
 * DELETE /api/voice/calls/schedule/[id] — cancel a scheduled call.
 *
 * Only `scheduled` calls can be cancelled. `firing` / `fired` / `failed`
 * / `cancelled` are terminal. The corresponding Google Calendar event is
 * removed (idempotent — no-ops if the event was never synced).
 */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, ROUTE);
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) { return authResult; }

    const { id } = await context.params;

    // Optional reason in body — operators may want to record why.
    let reason: string | undefined;
    const contentLength = request.headers.get('content-length');
    if (contentLength !== null && contentLength !== '0') {
      try {
        const rawBody: unknown = await request.json();
        const parsed = cancelBodySchema.safeParse(rawBody);
        if (parsed.success) {
          reason = parsed.data.reason;
        }
      } catch {
        // No body / invalid JSON — that's fine, reason stays undefined.
      }
    }

    const existing = await AdminFirestoreService.get<ScheduledCall>(getScheduledCallsCollection(), id);
    if (!existing) {
      return errors.notFound('Scheduled call not found');
    }

    if (existing.status !== 'scheduled') {
      return errors.badRequest(
        `Cannot cancel a call in status "${existing.status}". Only scheduled calls can be cancelled.`,
      );
    }

    const nowIso = new Date().toISOString();
    await AdminFirestoreService.update(getScheduledCallsCollection(), id, {
      status: 'cancelled',
      cancelReason: reason ?? null,
      cancelledAt: nowIso,
      cancelledBy: authResult.user.uid,
    });

    // Calendar event removal — idempotent + non-fatal.
    try {
      await deleteSalesVelocityCalendarEvent(calendarRefId(id));
    } catch (calErr) {
      logger.warn('[schedule-call] calendar delete failed (non-fatal)', {
        route: ROUTE,
        scheduleId: id,
        error: calErr instanceof Error ? calErr.message : String(calErr),
      });
    }

    logger.info('[schedule-call] cancelled', {
      route: ROUTE,
      scheduleId: id,
      reason,
    });

    return NextResponse.json({ success: true, scheduleId: id, status: 'cancelled' });
  } catch (error: unknown) {
    logger.error(
      '[schedule-call] DELETE failed',
      error instanceof Error ? error : new Error(String(error)),
      { route: ROUTE },
    );
    return errors.internal('Failed to cancel scheduled call', error instanceof Error ? error : undefined);
  }
}

/**
 * PATCH /api/voice/calls/schedule/[id] — reschedule.
 *
 * Body fields are all optional (must supply at least one). The Google
 * Calendar event is re-upserted in place using the same refId, so the
 * single calendar entry stays in sync rather than orphaning + creating
 * a new event.
 */
export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, ROUTE);
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireRole(request, ['owner', 'admin']);
    if (authResult instanceof NextResponse) { return authResult; }

    const { id } = await context.params;
    const rawBody: unknown = await request.json();
    const parsed = updateScheduledCallSchema.safeParse(rawBody);
    if (!parsed.success) {
      return errors.badRequest(
        parsed.error.errors[0]?.message ?? 'Invalid update body',
        { issues: parsed.error.errors },
      );
    }
    const updates = parsed.data;
    if (Object.keys(updates).length === 0) {
      return errors.badRequest('No fields to update');
    }

    const existing = await AdminFirestoreService.get<ScheduledCall>(getScheduledCallsCollection(), id);
    if (!existing) {
      return errors.notFound('Scheduled call not found');
    }
    if (existing.status !== 'scheduled') {
      return errors.badRequest(
        `Cannot reschedule a call in status "${existing.status}". Only scheduled calls can be rescheduled.`,
      );
    }

    if (typeof updates.scheduledFor === 'string') {
      const ms = new Date(updates.scheduledFor).getTime();
      if (Number.isNaN(ms)) {
        return errors.badRequest('scheduledFor is not a valid datetime');
      }
      if (ms <= Date.now()) {
        return errors.badRequest('scheduledFor must be in the future');
      }
    }

    const nowIso = new Date().toISOString();
    const writeUpdates: Record<string, unknown> = {
      ...updates,
      updatedAt: nowIso,
      updatedBy: authResult.user.uid,
    };
    await AdminFirestoreService.update(getScheduledCallsCollection(), id, writeUpdates);

    // Build the merged view for calendar re-upsert + response.
    const merged: ScheduledCall = {
      ...existing,
      ...updates,
      id: existing.id,
    };

    let calendarLink: string | null = null;
    try {
      const result = await upsertSalesVelocityCalendarEvent({
        refId: calendarRefId(id),
        summary: buildSummary(merged),
        description: buildDescription(merged),
        startIso: merged.scheduledFor,
        timeZone: 'America/New_York',
        category: 'voice',
      });
      calendarLink = result?.htmlLink ?? null;
    } catch (calErr) {
      logger.warn('[schedule-call] calendar re-upsert failed (non-fatal)', {
        route: ROUTE,
        scheduleId: id,
        error: calErr instanceof Error ? calErr.message : String(calErr),
      });
    }

    logger.info('[schedule-call] rescheduled', {
      route: ROUTE,
      scheduleId: id,
      updatedFields: Object.keys(updates),
      calendarSynced: calendarLink !== null,
    });

    return NextResponse.json({
      success: true,
      scheduledCall: merged,
      calendarLink,
    });
  } catch (error: unknown) {
    logger.error(
      '[schedule-call] PATCH failed',
      error instanceof Error ? error : new Error(String(error)),
      { route: ROUTE },
    );
    return errors.internal('Failed to reschedule call', error instanceof Error ? error : undefined);
  }
}
