/**
 * Unified Calendar Event Aggregator
 *
 * Reads five Firestore collections that each represent calendar-shaped events,
 * normalizes them to a single shape (`UnifiedCalendarEvent`), dedupes overlaps
 * (e.g. a `meeting` doc and a `gcal` doc that point at the same Zoom link),
 * and returns one ascending-by-start timeline.
 *
 * Server-side only — uses `AdminFirestoreService` so security rules are bypassed.
 *
 * Source collections (all under `organizations/{PLATFORM_ID}/...`):
 *   - meetings        → operator-driven scheduled meetings
 *   - bookings        → public early-access bookings
 *   - calendarEvents  → synced from Google Calendar
 *   - socialPosts     → scheduled outbound posts
 *   - activities      → CRM activities (calls, emails, completed meetings, etc.)
 */

import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

// ---------- Public types ----------

export type CalendarEventSource =
  | 'meeting'
  | 'booking'
  | 'gcal'
  | 'social_post'
  | 'activity';

export interface UnifiedCalendarEvent {
  /** Composite id `${source}:${sourceId}` so React keys stay stable across renders. */
  id: string;
  source: CalendarEventSource;
  sourceId: string;
  title: string;
  /** ISO-8601 start. */
  start: string;
  /** ISO-8601 end. Equal to `start` for point-in-time events (posts, activities). */
  end: string;
  isAllDay: boolean;
  attendees?: string[];
  meetingLink?: string;
  meetingProvider?: 'zoom' | 'google_meet' | 'teams' | 'none';
  /** Click-through route (e.g. `/entities/leads/{id}`). */
  detailHref?: string;
  /** 1-2 word badge: 'Meeting', 'Demo', 'Calendar', 'Post', 'Activity'. */
  badge?: string;
  metadata?: Record<string, unknown>;
}

export interface FetchEventsInput {
  /** Inclusive lower bound. */
  from: Date;
  /** Inclusive upper bound. */
  to: Date;
  /** Defaults to all 5 sources. */
  sources?: CalendarEventSource[];
}

const ALL_SOURCES: readonly CalendarEventSource[] = [
  'meeting',
  'booking',
  'gcal',
  'social_post',
  'activity',
] as const;

// ---------- Helpers ----------

/** Loose shape of a Firestore Admin Timestamp (avoids depending on the SDK). */
interface FirestoreLikeTimestamp {
  toDate?: () => Date;
  seconds?: number;
  _seconds?: number;
  nanoseconds?: number;
  _nanoseconds?: number;
}

function isFirestoreTimestamp(value: unknown): value is FirestoreLikeTimestamp {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as FirestoreLikeTimestamp;
  return (
    typeof v.toDate === 'function' ||
    typeof v.seconds === 'number' ||
    typeof v._seconds === 'number'
  );
}

/**
 * Normalize a Firestore Timestamp / JS Date / ISO string / epoch ms / null
 * to a stable ISO-8601 string. Returns null when the value can't be parsed —
 * callers must drop records that fail to produce a valid start.
 */
function toIso(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (isFirestoreTimestamp(value)) {
    try {
      if (typeof value.toDate === 'function') {
        const d = value.toDate();
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
      }
      const seconds = value.seconds ?? value._seconds;
      const nanos = value.nanoseconds ?? value._nanoseconds ?? 0;
      if (typeof seconds === 'number') {
        const ms = seconds * 1000 + Math.floor(nanos / 1e6);
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
      }
    } catch {
      return null;
    }
  }

  return null;
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const v = record[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function getRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const v = record[key];
  return isStringRecord(v) ? v : undefined;
}

function getArray(record: Record<string, unknown>, key: string): unknown[] | undefined {
  const v = record[key];
  return Array.isArray(v) ? v : undefined;
}

function withinWindow(iso: string, from: Date, to: Date): boolean {
  const ms = new Date(iso).getTime();
  return ms >= from.getTime() && ms <= to.getTime();
}

function safeProvider(value: unknown): UnifiedCalendarEvent['meetingProvider'] {
  if (value === 'zoom' || value === 'google_meet' || value === 'teams' || value === 'none') {
    return value;
  }
  return undefined;
}

// ---------- Per-source readers ----------

async function readAllRaw(collectionPath: string): Promise<Record<string, unknown>[]> {
  // We deliberately do NOT push a Firestore where() constraint here —
  // each source uses a different time field name and shape (Date vs string
  // vs nested object vs Timestamp), so an in-memory window check after
  // normalization is simpler and avoids per-collection composite indexes.
  const docs = await AdminFirestoreService.getAll(collectionPath, []);
  return docs as Record<string, unknown>[];
}

function normalizeMeeting(
  doc: Record<string, unknown>,
  from: Date,
  to: Date,
): UnifiedCalendarEvent | null {
  const id = getString(doc, 'id');
  if (!id) {
    return null;
  }
  const startIso = toIso(doc.startTime);
  if (!startIso || !withinWindow(startIso, from, to)) {
    return null;
  }
  const endIso = toIso(doc.endTime) ?? startIso;

  const attendeesRaw = getArray(doc, 'attendees');
  const attendees = attendeesRaw
    ?.map((a): string | null => {
      if (!isStringRecord(a)) {
        return null;
      }
      return getString(a, 'email') ?? null;
    })
    .filter((e): e is string => typeof e === 'string');

  const relatedType = getString(doc, 'relatedEntityType');
  const relatedId = getString(doc, 'relatedEntityId');
  const detailHref = relatedType && relatedId
    ? `/entities/${relatedType}s/${relatedId}`
    : undefined;

  return {
    id: `meeting:${id}`,
    source: 'meeting',
    sourceId: id,
    title: getString(doc, 'title') ?? 'Meeting',
    start: startIso,
    end: endIso,
    isAllDay: false,
    attendees: attendees && attendees.length > 0 ? attendees : undefined,
    meetingLink: getString(doc, 'zoomJoinUrl'),
    meetingProvider: safeProvider(doc.meetingProvider),
    detailHref,
    badge: 'Meeting',
    metadata: {
      status: getString(doc, 'status'),
      duration: typeof doc.duration === 'number' ? doc.duration : undefined,
      assignedTo: getString(doc, 'assignedTo'),
    },
  };
}

function normalizeBooking(
  doc: Record<string, unknown>,
  from: Date,
  to: Date,
): UnifiedCalendarEvent | null {
  const id = getString(doc, 'id');
  if (!id) {
    return null;
  }
  const startIso = toIso(doc.startTime);
  if (!startIso || !withinWindow(startIso, from, to)) {
    return null;
  }
  const endIso = toIso(doc.endTime) ?? startIso;

  const name = getString(doc, 'name') ?? 'guest';
  const email = getString(doc, 'email');

  return {
    id: `booking:${id}`,
    source: 'booking',
    sourceId: id,
    title: `Demo with ${name}`,
    start: startIso,
    end: endIso,
    isAllDay: false,
    attendees: email ? [email] : undefined,
    meetingLink: getString(doc, 'zoomJoinUrl'),
    meetingProvider: safeProvider(doc.meetingProvider),
    badge: 'Demo',
    metadata: {
      status: getString(doc, 'status'),
      phone: getString(doc, 'phone'),
      duration: typeof doc.duration === 'number' ? doc.duration : undefined,
    },
  };
}

function normalizeGcal(
  doc: Record<string, unknown>,
  from: Date,
  to: Date,
): UnifiedCalendarEvent | null {
  const id = getString(doc, 'id');
  if (!id) {
    return null;
  }
  const start = getRecord(doc, 'start');
  const end = getRecord(doc, 'end');
  if (!start) {
    return null;
  }

  const startIso = toIso(start.dateTime) ?? toIso(start.date);
  if (!startIso || !withinWindow(startIso, from, to)) {
    return null;
  }
  const endIso = end
    ? (toIso(end.dateTime) ?? toIso(end.date) ?? startIso)
    : startIso;

  const isAllDay = !start.dateTime && !!start.date;

  const attendeesRaw = getArray(doc, 'attendees');
  const attendees = attendeesRaw
    ?.map((a): string | null => {
      if (!isStringRecord(a)) {
        return null;
      }
      return getString(a, 'email') ?? null;
    })
    .filter((e): e is string => typeof e === 'string');

  return {
    id: `gcal:${id}`,
    source: 'gcal',
    sourceId: id,
    title: getString(doc, 'summary') ?? '(no title)',
    start: startIso,
    end: endIso,
    isAllDay,
    attendees: attendees && attendees.length > 0 ? attendees : undefined,
    meetingLink: getString(doc, 'meetLink'),
    meetingProvider: getString(doc, 'meetLink') ? 'google_meet' : undefined,
    badge: 'Calendar',
    metadata: {
      status: getString(doc, 'status'),
      location: getString(doc, 'location'),
      calendarId: getString(doc, 'calendarId'),
      recurringEventId: getString(doc, 'recurringEventId'),
    },
  };
}

function normalizeSocialPost(
  doc: Record<string, unknown>,
  from: Date,
  to: Date,
): UnifiedCalendarEvent | null {
  const id = getString(doc, 'id');
  if (!id) {
    return null;
  }
  const startIso = toIso(doc.scheduledAt);
  if (!startIso || !withinWindow(startIso, from, to)) {
    return null;
  }

  const platform = getString(doc, 'platform') ?? 'social';
  const content = getString(doc, 'content') ?? '';
  const trimmed = content.length > 40 ? `${content.slice(0, 40)}…` : content;

  return {
    id: `social_post:${id}`,
    source: 'social_post',
    sourceId: id,
    title: `${platform}: ${trimmed}`.trim(),
    start: startIso,
    end: startIso,
    isAllDay: false,
    badge: 'Post',
    metadata: {
      platform,
      status: getString(doc, 'status'),
      content,
    },
  };
}

function normalizeActivity(
  doc: Record<string, unknown>,
  from: Date,
  to: Date,
): UnifiedCalendarEvent | null {
  const id = getString(doc, 'id');
  if (!id) {
    return null;
  }
  // Prefer occurredAt; fall back to createdAt so freshly-logged activities
  // without an explicit occurredAt still appear on today's slice.
  const startIso = toIso(doc.occurredAt) ?? toIso(doc.createdAt);
  if (!startIso || !withinWindow(startIso, from, to)) {
    return null;
  }

  const title =
    getString(doc, 'subject') ??
    getString(doc, 'summary') ??
    getString(doc, 'type') ??
    'Activity';

  let detailHref: string | undefined;
  const relatedTo = getArray(doc, 'relatedTo');
  if (relatedTo && relatedTo.length > 0 && isStringRecord(relatedTo[0])) {
    const first = relatedTo[0];
    const entityType = getString(first, 'entityType');
    const entityId = getString(first, 'entityId');
    if (entityType && entityId) {
      detailHref = `/entities/${entityType}s/${entityId}`;
    }
  }

  const meta = getRecord(doc, 'metadata');
  const meetingLink = meta ? getString(meta, 'meetingUrl') : undefined;

  return {
    id: `activity:${id}`,
    source: 'activity',
    sourceId: id,
    title,
    start: startIso,
    end: startIso,
    isAllDay: false,
    meetingLink,
    detailHref,
    badge: 'Activity',
    metadata: {
      type: getString(doc, 'type'),
      direction: getString(doc, 'direction'),
    },
  };
}

// ---------- Dedupe ----------

const SOURCE_PRIORITY: Record<CalendarEventSource, number> = {
  meeting: 4,
  booking: 3,
  gcal: 2,
  social_post: 1,
  activity: 0,
};

/**
 * Collapse rows that point at the same underlying event.
 *
 * Two events are considered the same if EITHER:
 *   - they share a non-empty `meetingLink` (e.g. the same Zoom join URL), OR
 *   - they share an exact `start` AND have at least one attendee email in common.
 *
 * Preference order: meeting > booking > gcal > social_post > activity.
 * The winner keeps its source label; collapsed sources are listed in
 * `metadata.dedupedFrom: string[]`.
 */
function dedupe(events: UnifiedCalendarEvent[]): UnifiedCalendarEvent[] {
  const winners: UnifiedCalendarEvent[] = [];

  for (const incoming of events) {
    const incomingAttendees = new Set(incoming.attendees ?? []);
    let mergedIntoIndex = -1;

    for (let i = 0; i < winners.length; i++) {
      const existing = winners[i];

      // Rule 1: shared meeting link
      const linkMatch =
        !!incoming.meetingLink &&
        !!existing.meetingLink &&
        incoming.meetingLink === existing.meetingLink;

      // Rule 2: same start AND at least one shared attendee email
      let attendeeMatch = false;
      if (incoming.start === existing.start) {
        const existingAttendees = existing.attendees ?? [];
        for (const a of existingAttendees) {
          if (incomingAttendees.has(a)) {
            attendeeMatch = true;
            break;
          }
        }
      }

      if (linkMatch || attendeeMatch) {
        mergedIntoIndex = i;
        break;
      }
    }

    if (mergedIntoIndex === -1) {
      winners.push(incoming);
      continue;
    }

    const existing = winners[mergedIntoIndex];
    const incomingPriority = SOURCE_PRIORITY[incoming.source];
    const existingPriority = SOURCE_PRIORITY[existing.source];

    if (incomingPriority > existingPriority) {
      // Incoming wins: replace existing, attribute existing source to dedupedFrom.
      const previousDeduped = readDedupedFrom(existing.metadata);
      const merged: UnifiedCalendarEvent = {
        ...incoming,
        attendees: mergeAttendees(incoming.attendees, existing.attendees),
        metadata: {
          ...(incoming.metadata ?? {}),
          dedupedFrom: [...previousDeduped, existing.source],
        },
      };
      winners[mergedIntoIndex] = merged;
    } else {
      // Existing wins (or tie — first seen wins): attribute incoming source.
      const previousDeduped = readDedupedFrom(existing.metadata);
      const merged: UnifiedCalendarEvent = {
        ...existing,
        attendees: mergeAttendees(existing.attendees, incoming.attendees),
        metadata: {
          ...(existing.metadata ?? {}),
          dedupedFrom: [...previousDeduped, incoming.source],
        },
      };
      winners[mergedIntoIndex] = merged;
    }
  }

  return winners;
}

function readDedupedFrom(metadata: Record<string, unknown> | undefined): string[] {
  if (!metadata) {
    return [];
  }
  const v = metadata.dedupedFrom;
  if (!Array.isArray(v)) {
    return [];
  }
  return v.filter((x): x is string => typeof x === 'string');
}

function mergeAttendees(
  a: string[] | undefined,
  b: string[] | undefined,
): string[] | undefined {
  if (!a && !b) {
    return undefined;
  }
  const set = new Set<string>();
  for (const x of a ?? []) {
    set.add(x);
  }
  for (const x of b ?? []) {
    set.add(x);
  }
  return set.size > 0 ? Array.from(set) : undefined;
}

// ---------- Public API ----------

/**
 * Aggregate every calendar-shaped record in the requested window and return a
 * single ascending-by-start timeline. Per-source failures are logged and
 * swallowed — one bad collection should not blank the dashboard.
 */
export async function getUnifiedCalendarEvents(
  input: FetchEventsInput,
): Promise<UnifiedCalendarEvent[]> {
  const { from, to } = input;
  if (!(from instanceof Date) || !(to instanceof Date)) {
    throw new Error('getUnifiedCalendarEvents: from/to must be Date instances');
  }
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('getUnifiedCalendarEvents: from/to must be valid dates');
  }
  if (from.getTime() > to.getTime()) {
    throw new Error('getUnifiedCalendarEvents: `from` must be <= `to`');
  }

  const sources = input.sources && input.sources.length > 0
    ? input.sources
    : [...ALL_SOURCES];

  const wantsMeeting = sources.includes('meeting');
  const wantsBooking = sources.includes('booking');
  const wantsGcal = sources.includes('gcal');
  const wantsSocialPost = sources.includes('social_post');
  const wantsActivity = sources.includes('activity');

  type SourceResult = UnifiedCalendarEvent[];

  const safeRead = async (
    label: CalendarEventSource,
    collectionPath: string,
    normalize: (
      doc: Record<string, unknown>,
      from: Date,
      to: Date,
    ) => UnifiedCalendarEvent | null,
  ): Promise<SourceResult> => {
    try {
      const raw = await readAllRaw(collectionPath);
      const out: UnifiedCalendarEvent[] = [];
      for (const doc of raw) {
        const event = normalize(doc, from, to);
        if (event) {
          out.push(event);
        }
      }
      return out;
    } catch (error: unknown) {
      logger.warn(`[CalendarAggregator] Failed to read ${label} collection — skipping`, {
        file: 'event-aggregator.ts',
        source: label,
        collectionPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  };

  const tasks: Array<Promise<SourceResult>> = [];

  if (wantsMeeting) {
    tasks.push(safeRead('meeting', getSubCollection('meetings'), normalizeMeeting));
  }
  if (wantsBooking) {
    tasks.push(safeRead('booking', getSubCollection('bookings'), normalizeBooking));
  }
  if (wantsGcal) {
    tasks.push(safeRead('gcal', getSubCollection('calendarEvents'), normalizeGcal));
  }
  if (wantsSocialPost) {
    tasks.push(safeRead('social_post', getSubCollection('socialPosts'), normalizeSocialPost));
  }
  if (wantsActivity) {
    tasks.push(safeRead('activity', getSubCollection('activities'), normalizeActivity));
  }

  const buckets = await Promise.all(tasks);
  const flat = buckets.flat();

  // Dedupe pass on the priority order so a meeting+booking pair always
  // resolves to the meeting regardless of input ordering.
  const ordered = [...flat].sort(
    (a, b) => SOURCE_PRIORITY[b.source] - SOURCE_PRIORITY[a.source],
  );
  const deduped = dedupe(ordered);

  deduped.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return deduped;
}
