/**
 * Availability Config Service
 *
 * Owner-controlled per-day-of-week working hours that drive:
 *   - The public Calendly-style slot picker on /early-access
 *   - The operator-Jasper "available slots" reply when a scheduling command
 *     is missing a concrete time
 *
 * Doc path: `organizations/{PLATFORM_ID}/settings/booking`
 *
 * The same doc historically held a flat `businessHoursStart` / `businessHoursEnd`
 * / `timezone` triple, which `/api/booking` GET still reads as a fallback. New
 * writes use the richer per-day `workingHours` map; reads prefer it but fall
 * back to the flat triple when the new field is absent.
 */

import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

const SETTINGS_COLLECTION = (): string => `organizations/${PLATFORM_ID}/settings`;
const DOC_ID = 'booking';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DayHours {
  enabled: boolean;
  start: string; // 'HH:MM' 24-hour
  end: string;   // 'HH:MM' 24-hour, must be > start
}

export interface AvailabilityConfig {
  timezone: string;             // IANA, e.g. 'America/Denver'
  defaultMeetingDuration: number; // minutes (15-120)
  workingHours: Record<DayOfWeek, DayHours>;
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_CONFIG: AvailabilityConfig = {
  timezone: 'America/Denver',
  defaultMeetingDuration: 30,
  workingHours: {
    monday:    { enabled: true,  start: '09:00', end: '17:00' },
    tuesday:   { enabled: true,  start: '09:00', end: '17:00' },
    wednesday: { enabled: true,  start: '09:00', end: '17:00' },
    thursday:  { enabled: true,  start: '09:00', end: '17:00' },
    friday:    { enabled: true,  start: '09:00', end: '17:00' },
    saturday:  { enabled: false, start: '09:00', end: '17:00' },
    sunday:    { enabled: false, start: '09:00', end: '17:00' },
  },
};

const DAY_KEYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

function compareTimes(a: string, b: string): number {
  // 'HH:MM' is lexicographically comparable
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalizeDayHours(raw: unknown, fallback: DayHours): DayHours {
  if (!raw || typeof raw !== 'object') { return fallback; }
  const r = raw as Record<string, unknown>;
  const enabled = r.enabled === true;
  const start = isValidTime(r.start) ? r.start : fallback.start;
  const end = isValidTime(r.end) ? r.end : fallback.end;
  if (compareTimes(start, end) >= 0) {
    return { enabled, start: fallback.start, end: fallback.end };
  }
  return { enabled, start, end };
}

function normalizeWorkingHours(
  raw: unknown,
  legacyStart: number | undefined,
  legacyEnd: number | undefined,
): Record<DayOfWeek, DayHours> {
  // If the new map is present and an object, use it.
  if (raw && typeof raw === 'object') {
    const map = raw as Record<string, unknown>;
    const out = {} as Record<DayOfWeek, DayHours>;
    for (const day of DAY_KEYS) {
      out[day] = normalizeDayHours(map[day], DEFAULT_CONFIG.workingHours[day]);
    }
    return out;
  }
  // Fall back to flat businessHoursStart/businessHoursEnd applied Mon-Fri.
  const startHour = typeof legacyStart === 'number' ? legacyStart : 9;
  const endHour = typeof legacyEnd === 'number' ? legacyEnd : 17;
  const start = `${String(startHour).padStart(2, '0')}:00`;
  const end = `${String(endHour).padStart(2, '0')}:00`;
  return {
    monday:    { enabled: true,  start, end },
    tuesday:   { enabled: true,  start, end },
    wednesday: { enabled: true,  start, end },
    thursday:  { enabled: true,  start, end },
    friday:    { enabled: true,  start, end },
    saturday:  { enabled: false, start, end },
    sunday:    { enabled: false, start, end },
  };
}

export async function getAvailabilityConfig(): Promise<AvailabilityConfig> {
  if (!adminDb) {
    logger.warn('[availability-config-service] adminDb not available — returning defaults');
    return DEFAULT_CONFIG;
  }
  try {
    const snap = await adminDb.collection(SETTINGS_COLLECTION()).doc(DOC_ID).get();
    if (!snap.exists) { return DEFAULT_CONFIG; }
    const data = snap.data() as Record<string, unknown>;

    const timezone = typeof data.timezone === 'string' ? data.timezone : DEFAULT_CONFIG.timezone;
    const rawDuration = data.defaultMeetingDuration;
    const defaultMeetingDuration =
      typeof rawDuration === 'number' && rawDuration >= 15 && rawDuration <= 120
        ? rawDuration
        : DEFAULT_CONFIG.defaultMeetingDuration;

    const workingHours = normalizeWorkingHours(
      data.workingHours,
      typeof data.businessHoursStart === 'number' ? data.businessHoursStart : undefined,
      typeof data.businessHoursEnd === 'number' ? data.businessHoursEnd : undefined,
    );

    return {
      timezone,
      defaultMeetingDuration,
      workingHours,
      ...(typeof data.updatedAt === 'string' ? { updatedAt: data.updatedAt } : {}),
      ...(typeof data.updatedBy === 'string' ? { updatedBy: data.updatedBy } : {}),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[availability-config-service] getAvailabilityConfig failed — returning defaults',
      err instanceof Error ? err : new Error(msg),
    );
    return DEFAULT_CONFIG;
  }
}

export interface SetAvailabilityInput {
  timezone: string;
  defaultMeetingDuration: number;
  workingHours: Record<DayOfWeek, DayHours>;
  actorUid: string;
}

/**
 * Validate a candidate config. Returns the first error message, or null if OK.
 */
export function validateAvailabilityInput(input: {
  timezone: string;
  defaultMeetingDuration: number;
  workingHours: Record<DayOfWeek, DayHours>;
}): string | null {
  if (typeof input.timezone !== 'string' || input.timezone.length === 0) {
    return 'timezone is required';
  }
  if (
    typeof input.defaultMeetingDuration !== 'number' ||
    input.defaultMeetingDuration < 15 ||
    input.defaultMeetingDuration > 120
  ) {
    return 'defaultMeetingDuration must be between 15 and 120 minutes';
  }
  for (const day of DAY_KEYS) {
    const hours = input.workingHours[day];
    if (!hours) { return `workingHours.${day} is required`; }
    if (typeof hours.enabled !== 'boolean') { return `workingHours.${day}.enabled must be boolean`; }
    if (!isValidTime(hours.start)) { return `workingHours.${day}.start must be HH:MM`; }
    if (!isValidTime(hours.end)) { return `workingHours.${day}.end must be HH:MM`; }
    if (compareTimes(hours.start, hours.end) >= 0) {
      return `workingHours.${day}: start must be earlier than end`;
    }
  }
  return null;
}

export async function setAvailabilityConfig(input: SetAvailabilityInput): Promise<boolean> {
  if (!adminDb) { return false; }
  const err = validateAvailabilityInput(input);
  if (err) {
    logger.warn('[availability-config-service] validation failed', { error: err });
    return false;
  }
  try {
    const ref = adminDb.collection(SETTINGS_COLLECTION()).doc(DOC_ID);
    const now = new Date().toISOString();
    await ref.set(
      {
        timezone: input.timezone,
        defaultMeetingDuration: input.defaultMeetingDuration,
        workingHours: input.workingHours,
        updatedAt: now,
        updatedBy: input.actorUid,
      },
      { merge: true },
    );
    logger.info('[availability-config-service] availability config updated', {
      actorUid: input.actorUid,
    });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[availability-config-service] setAvailabilityConfig failed',
      err instanceof Error ? err : new Error(msg),
    );
    return false;
  }
}

export const DAYS_OF_WEEK: readonly DayOfWeek[] = DAY_KEYS;
