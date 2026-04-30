/**
 * Unified Calendar Events API
 *
 * GET /api/calendar/events?from=ISO&to=ISO&sources=meeting,booking,gcal,social_post,activity
 *
 * Aggregates `meetings` + `bookings` + `calendarEvents` + `socialPosts` +
 * `activities` into one normalized, deduped, ordered timeline. Backs the
 * unified calendar dashboard.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getUnifiedCalendarEvents,
  type CalendarEventSource,
} from '@/lib/calendar/event-aggregator';

export const dynamic = 'force-dynamic';

const SOURCE_VALUES = ['meeting', 'booking', 'gcal', 'social_post', 'activity'] as const;

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  sources: z.string().optional(),
});

const DEFAULT_WINDOW_DAYS = 30;

/**
 * Parse the `sources` query string ("meeting,booking,...") into a typed enum
 * array. Returns `null` when any token is invalid so the route can 400.
 */
function parseSources(raw: string | undefined): CalendarEventSource[] | null {
  if (raw === undefined || raw.trim().length === 0) {
    return [...SOURCE_VALUES];
  }
  const tokens = raw.split(',').map(t => t.trim()).filter(t => t.length > 0);
  const out: CalendarEventSource[] = [];
  for (const t of tokens) {
    if ((SOURCE_VALUES as readonly string[]).includes(t)) {
      out.push(t as CalendarEventSource);
    } else {
      return null;
    }
  }
  // De-dup in case caller passed `meeting,meeting`.
  return Array.from(new Set(out));
}

function parseDateParam(raw: string | undefined): Date | null {
  if (raw === undefined || raw.trim().length === 0) {
    return null;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(request, ['owner', 'admin', 'manager', 'member']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);

    const parsed = querySchema.safeParse({
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      sources: searchParams.get('sources') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query params', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { from: fromRaw, to: toRaw, sources: sourcesRaw } = parsed.data;

    let from: Date;
    let to: Date;
    if (fromRaw === undefined && toRaw === undefined) {
      const now = new Date();
      from = now;
      to = new Date(now.getTime() + DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    } else {
      const f = parseDateParam(fromRaw);
      const t = parseDateParam(toRaw);
      if (!f || !t) {
        return NextResponse.json(
          { success: false, error: '`from` and `to` must both be valid ISO-8601 timestamps' },
          { status: 400 },
        );
      }
      if (f.getTime() > t.getTime()) {
        return NextResponse.json(
          { success: false, error: '`from` must be earlier than or equal to `to`' },
          { status: 400 },
        );
      }
      from = f;
      to = t;
    }

    const sources = parseSources(sourcesRaw);
    if (sources === null) {
      return NextResponse.json(
        {
          success: false,
          error: `\`sources\` must be a comma-separated list of: ${SOURCE_VALUES.join(', ')}`,
        },
        { status: 400 },
      );
    }

    const events = await getUnifiedCalendarEvents({ from, to, sources });

    return NextResponse.json({ success: true, events });
  } catch (error: unknown) {
    logger.error(
      'Unified calendar events GET failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'app/api/calendar/events/route.ts' },
    );
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
