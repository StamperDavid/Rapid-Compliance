/**
 * Meeting Scheduler Settings API
 *
 * GET /api/settings/meeting-scheduler — read availability config (defaults if not yet set)
 * PUT /api/settings/meeting-scheduler — replace the full config
 *
 * Owner/admin gated. The config drives the public slot picker on /early-access
 * and the operator-Jasper "available slots" reply.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getAvailabilityConfig,
  setAvailabilityConfig,
  validateAvailabilityInput,
  DAYS_OF_WEEK,
  type DayOfWeek,
  type DayHours,
} from '@/lib/meetings/availability-config-service';

export const dynamic = 'force-dynamic';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const dayHoursSchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(TIME_RE, 'start must be HH:MM'),
  end: z.string().regex(TIME_RE, 'end must be HH:MM'),
});

const putBodySchema = z.object({
  timezone: z.string().min(1, 'timezone is required'),
  defaultMeetingDuration: z.number().int().min(15).max(120),
  workingHours: z.object({
    monday:    dayHoursSchema,
    tuesday:   dayHoursSchema,
    wednesday: dayHoursSchema,
    thursday:  dayHoursSchema,
    friday:    dayHoursSchema,
    saturday:  dayHoursSchema,
    sunday:    dayHoursSchema,
  }),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }
  const config = await getAvailabilityConfig();
  return NextResponse.json({ success: true, config });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }
  const { user } = authResult;

  let parsed;
  try {
    const raw: unknown = await request.json();
    parsed = putBodySchema.safeParse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: `Invalid JSON: ${msg}` }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid body' },
      { status: 400 },
    );
  }

  // Cross-field validation (start < end per day)
  const workingHours = parsed.data.workingHours as Record<DayOfWeek, DayHours>;
  const validationError = validateAvailabilityInput({
    timezone: parsed.data.timezone,
    defaultMeetingDuration: parsed.data.defaultMeetingDuration,
    workingHours,
  });
  if (validationError) {
    return NextResponse.json({ success: false, error: validationError }, { status: 400 });
  }

  const ok = await setAvailabilityConfig({
    timezone: parsed.data.timezone,
    defaultMeetingDuration: parsed.data.defaultMeetingDuration,
    workingHours,
    actorUid: user.uid,
  });
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Failed to save availability config' }, { status: 500 });
  }

  logger.info('[settings/meeting-scheduler] availability config saved', {
    actorUid: user.uid,
    timezone: parsed.data.timezone,
    enabledDays: DAYS_OF_WEEK.filter((d) => workingHours[d].enabled),
  });

  const config = await getAvailabilityConfig();
  return NextResponse.json({ success: true, config });
}
