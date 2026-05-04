/**
 * Google Calendar → Platform Sync Engine
 * ─────────────────────────────────────────────────────────────────────
 * Owns the diff/dispatch loop that translates operator-side calendar
 * mutations (cancel from phone, drag-to-reschedule in Google Calendar
 * web UI, etc.) into platform mutations (cancel the social post,
 * reschedule the workflow, etc.).
 *
 * Architecture:
 *   - Webhook receiver (`/api/webhooks/google-calendar`) calls
 *     `runSyncSweep(calendarSyncHandlers)` for every Google push.
 *   - This file PROVIDES the diff loop and the strict TypeScript
 *     contract `CalendarSyncHandlers`.
 *   - Per-category handlers (cancel-the-social-post, reschedule-the-
 *     workflow, etc.) ship from a parallel agent at
 *     `src/lib/integrations/calendar-sync-handlers/index.ts` exporting
 *     `calendarSyncHandlers: CalendarSyncHandlers`.
 *
 * Why a contract: the sync engine handles every category uniformly —
 * "an event changed, look up the refId, dispatch to the handler for its
 * category". Per-category logic (which Firestore doc to flip, which
 * status to write, whether to notify the operator) lives entirely
 * outside this file. The engine never knows what a "social post" is.
 *
 * Sync token semantics:
 *   - First run with no stored token: bootstrap by listing all events
 *     with `singleEvents=true&showDeleted=true` and storing the
 *     `nextSyncToken`.
 *   - Subsequent runs: `events.list({ syncToken: stored })` returns
 *     only events that changed since the last sync.
 *   - Google returns 410 Gone if the syncToken expired (it does so
 *     after several days of inactivity, or on full-resync events) —
 *     wipe the state and bootstrap on the next sweep.
 *
 * Per the calendar architecture rule, every platform-scheduled action
 * tags itself via `extendedProperties.private`:
 *   - `salesvelocityRefId`     → e.g., "social-post-abc123"
 *   - `salesvelocityCategory`  → 'social' | 'email' | ... | 'voice'
 *
 * Events without these properties are events the operator created
 * themselves outside the platform — we leave them alone (no-op).
 */

import { google, type calendar_v3 } from 'googleapis';
import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { getConnectedGoogleTokens } from '@/lib/integrations/google-tokens';
import { CALENDAR_EVENT_MAPPINGS_COLLECTION } from '@/lib/integrations/google-calendar-service';

const FILE = 'integrations/calendar-sync-engine.ts';
const CONNECTED_ACCOUNTS_COLLECTION = 'connectedAccounts';
const SYNC_STATE_DOC_ID = 'google-calendar-sync-state';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const googleRedirectUriEnv = process.env.GOOGLE_REDIRECT_URI;
const GOOGLE_REDIRECT_URI =
  googleRedirectUriEnv !== '' && googleRedirectUriEnv != null
    ? googleRedirectUriEnv
    : 'http://localhost:3000/api/integrations/google/callback';

// ───────────────────────────────────────────────────────────────────
// Public contract — the second agent ships handlers conforming to this
// ───────────────────────────────────────────────────────────────────

/**
 * Every scheduled platform action is tagged with one of these
 * categories on its Google Calendar event. The sync engine dispatches
 * mutations to per-category handlers via the `CalendarSyncHandlers`
 * registry.
 */
export type SyncCategory =
  | 'social'
  | 'email'
  | 'mission'
  | 'workflow'
  | 'content'
  | 'meeting'
  | 'voice';

/**
 * Enumerated list of every supported category. Used by tests, UI
 * dropdowns, and the handler registry to assert exhaustiveness.
 */
export const SYNC_CATEGORIES: SyncCategory[] = [
  'social',
  'email',
  'mission',
  'workflow',
  'content',
  'meeting',
  'voice',
];

/**
 * Per-category mutation handlers. The parallel agent ships an
 * implementation at `calendar-sync-handlers/index.ts` exporting an
 * object that satisfies this contract.
 *
 * Both methods MUST be idempotent — Google may deliver the same push
 * notification more than once (network retries, cron renewal overlap).
 * Handlers should treat "already cancelled" / "already rescheduled to
 * this time" as success, not error.
 */
export interface CalendarSyncHandlers {
  /**
   * Operator deleted the event from Google Calendar — cancel the
   * underlying platform record (soft-delete or status='cancelled', per
   * each category's conventions).
   */
  onCancel(
    refId: string,
    category: SyncCategory,
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Operator changed the event's start time — push the new schedule
   * back to the platform record. End time is included for completeness
   * (some categories may care, others use a default duration).
   */
  onReschedule(
    refId: string,
    category: SyncCategory,
    newStart: Date,
    newEnd: Date,
  ): Promise<{ success: boolean; error?: string }>;
}

// ───────────────────────────────────────────────────────────────────
// Internal types & helpers
// ───────────────────────────────────────────────────────────────────

interface SyncStateDoc {
  syncToken: string;
  updatedAt: string;
}

interface MappingDoc {
  refId: string;
  googleEventId: string;
  calendarId: string;
  /** Stored on insert/patch by `upsertSalesVelocityCalendarEvent`. */
  startIso?: string;
  endIso?: string;
  updatedAt: string;
}

function isSyncCategory(value: unknown): value is SyncCategory {
  return (
    typeof value === 'string' &&
    (SYNC_CATEGORIES as string[]).includes(value)
  );
}

function getSyncStateRef(): FirebaseFirestore.DocumentReference | null {
  if (!adminDb) {
    return null;
  }
  return adminDb
    .collection(getSubCollection(CONNECTED_ACCOUNTS_COLLECTION))
    .doc(SYNC_STATE_DOC_ID);
}

async function readSyncToken(): Promise<string | null> {
  const ref = getSyncStateRef();
  if (!ref) {
    return null;
  }
  const snap = await ref.get();
  if (!snap.exists) {
    return null;
  }
  const data = snap.data() as Partial<SyncStateDoc> | undefined;
  if (!data || typeof data.syncToken !== 'string' || data.syncToken.length === 0) {
    return null;
  }
  return data.syncToken;
}

async function writeSyncToken(syncToken: string): Promise<void> {
  const ref = getSyncStateRef();
  if (!ref) {
    return;
  }
  const doc: SyncStateDoc = {
    syncToken,
    updatedAt: new Date().toISOString(),
  };
  await ref.set(doc);
}

async function clearSyncToken(): Promise<void> {
  const ref = getSyncStateRef();
  if (!ref) {
    return;
  }
  await ref.delete().catch(() => undefined);
}

async function readMapping(refId: string): Promise<MappingDoc | null> {
  if (!adminDb) {
    return null;
  }
  const snap = await adminDb
    .collection(getSubCollection(CALENDAR_EVENT_MAPPINGS_COLLECTION))
    .doc(refId)
    .get();
  if (!snap.exists) {
    return null;
  }
  const data = snap.data() as Partial<MappingDoc> | undefined;
  if (
    !data ||
    typeof data.refId !== 'string' ||
    typeof data.googleEventId !== 'string' ||
    typeof data.calendarId !== 'string'
  ) {
    return null;
  }
  return {
    refId: data.refId,
    googleEventId: data.googleEventId,
    calendarId: data.calendarId,
    startIso: data.startIso,
    endIso: data.endIso,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

function buildAuthClient(accessToken: string, refreshToken: string | null): import('google-auth-library').OAuth2Client {
  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });
  return auth;
}

// Detection helpers for googleapis errors. The API throws GaxiosError
// with .code === 410 when the syncToken expires.
function isSyncTokenExpired(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const e = err as { code?: unknown; status?: unknown };
  return e.code === 410 || e.status === 410;
}

interface ListEventsResult {
  events: calendar_v3.Schema$Event[];
  nextSyncToken: string | null;
}

async function listChangedEvents(
  auth: import('google-auth-library').OAuth2Client,
  syncToken: string | null,
): Promise<ListEventsResult> {
  const calendar = google.calendar({ version: 'v3', auth });
  const events: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  // Loop pagination: events.list returns nextPageToken until the final
  // page, where it returns nextSyncToken instead. We only persist the
  // token once we've drained every page.
  let safetyCap = 50; // hard cap on pages — the bootstrap path can be long

  do {
    safetyCap -= 1;
    if (safetyCap < 0) {
      logger.warn('[calendar-sync] page-cap hit during listChangedEvents — possible runaway loop', {
        file: FILE,
      });
      break;
    }
    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId: 'primary',
      pageToken,
      maxResults: 250,
    };
    if (syncToken !== null) {
      params.syncToken = syncToken;
    } else {
      // Bootstrap path — get the current state of every recurring event
      // expanded into singletons + show deleted occurrences.
      params.singleEvents = true;
      params.showDeleted = true;
      // Limit the bootstrap to the past 7 days through the future so
      // we don't rip through years of historical events on first run.
      params.timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    const res = await calendar.events.list(params);
    if (Array.isArray(res.data.items)) {
      events.push(...res.data.items);
    }
    pageToken = res.data.nextPageToken ?? undefined;
    if (typeof res.data.nextSyncToken === 'string') {
      nextSyncToken = res.data.nextSyncToken;
    }
  } while (pageToken);

  return { events, nextSyncToken };
}

interface DispatchOutcome {
  refId: string;
  category: SyncCategory;
  action: 'cancel' | 'reschedule' | 'noop';
  success: boolean;
  error?: string;
}

/**
 * Apply a single changed event to the platform via the handler
 * registry. Returns a structured outcome for logging/metrics.
 */
async function dispatchEvent(
  event: calendar_v3.Schema$Event,
  handlers: CalendarSyncHandlers,
): Promise<DispatchOutcome | null> {
  const refIdRaw = event.extendedProperties?.private?.salesvelocityRefId;
  const categoryRaw = event.extendedProperties?.private?.salesvelocityCategory;
  if (typeof refIdRaw !== 'string' || refIdRaw.length === 0) {
    return null; // not a platform event — operator's own
  }
  if (!isSyncCategory(categoryRaw)) {
    logger.warn('[calendar-sync] platform-tagged event has unknown category — skipping', {
      file: FILE,
      refId: refIdRaw,
      category: categoryRaw,
    });
    return null;
  }

  const refId = refIdRaw;
  const category = categoryRaw;

  // Cancel path — Google sets status='cancelled' for deleted events.
  if (event.status === 'cancelled') {
    logger.info('[calendar-sync] dispatching cancel', { file: FILE, refId, category });
    const result = await handlers.onCancel(refId, category);
    return {
      refId,
      category,
      action: 'cancel',
      success: result.success,
      error: result.error,
    };
  }

  // Reschedule path — compare the event's start to the stored mapping.
  // Field-only edits (summary, description) are ignored — we don't sync
  // operator content edits back to the platform record.
  const newStartIso = event.start?.dateTime;
  const newEndIso = event.end?.dateTime;
  if (typeof newStartIso !== 'string' || typeof newEndIso !== 'string') {
    return { refId, category, action: 'noop', success: true };
  }

  const mapping = await readMapping(refId);
  if (!mapping) {
    // We don't have a mapping — likely the platform never recorded this
    // event (e.g., scheduled before mapping write was enabled, or a
    // race where the calendar event landed before the mapping doc).
    // Treat as no-op rather than blasting onReschedule against a refId
    // the platform might not recognize.
    logger.warn('[calendar-sync] event change with no local mapping — skipping reschedule', {
      file: FILE,
      refId,
    });
    return { refId, category, action: 'noop', success: true };
  }

  // Only fire reschedule when start actually moved. Compare as Date so
  // tz-suffix differences don't cause spurious reschedules.
  if (typeof mapping.startIso === 'string' && mapping.startIso.length > 0) {
    if (new Date(mapping.startIso).getTime() === new Date(newStartIso).getTime()) {
      return { refId, category, action: 'noop', success: true };
    }
  }

  logger.info('[calendar-sync] dispatching reschedule', {
    file: FILE,
    refId,
    category,
    oldStart: mapping.startIso,
    newStart: newStartIso,
  });
  const newStart = new Date(newStartIso);
  const newEnd = new Date(newEndIso);
  const result = await handlers.onReschedule(refId, category, newStart, newEnd);
  return {
    refId,
    category,
    action: 'reschedule',
    success: result.success,
    error: result.error,
  };
}

/**
 * Run one diff sweep against the operator's primary calendar.
 *
 * Webhook-driven: called by `/api/webhooks/google-calendar` for every
 * push notification with `resource-state: exists` or `not_exists`.
 * Google does NOT tell us which event changed — we discover changes by
 * paging `events.list({ syncToken })`.
 *
 * Returns the number of platform-tagged events processed (cancel +
 * reschedule + noops). Operator-created events with no
 * salesvelocityRefId are not counted.
 *
 * On 410 Gone (sync token expired), this method clears the stored
 * token and bootstraps fresh on the SAME call so the webhook hit
 * still produces a meaningful response.
 */
export async function runSyncSweep(handlers: CalendarSyncHandlers): Promise<{ processed: number }> {
  if (!adminDb) {
    logger.warn('[calendar-sync] adminDb not available; skipping sweep', { file: FILE });
    return { processed: 0 };
  }

  const tokens = await getConnectedGoogleTokens();
  if (!tokens) {
    logger.warn('[calendar-sync] no connected Google account; skipping sweep', { file: FILE });
    return { processed: 0 };
  }

  const auth = buildAuthClient(tokens.accessToken, tokens.refreshToken);

  let storedToken = await readSyncToken();
  let listResult: ListEventsResult;

  try {
    listResult = await listChangedEvents(auth, storedToken);
  } catch (err) {
    if (isSyncTokenExpired(err)) {
      logger.warn('[calendar-sync] syncToken expired (410 Gone) — bootstrapping fresh', { file: FILE });
      await clearSyncToken();
      storedToken = null;
      try {
        listResult = await listChangedEvents(auth, null);
      } catch (bootErr) {
        logger.error(
          '[calendar-sync] bootstrap after 410 failed',
          bootErr instanceof Error ? bootErr : new Error(String(bootErr)),
          { file: FILE },
        );
        return { processed: 0 };
      }
    } else {
      logger.error(
        '[calendar-sync] events.list failed',
        err instanceof Error ? err : new Error(String(err)),
        { file: FILE },
      );
      return { processed: 0 };
    }
  }

  // Bootstrap path: don't dispatch handlers; just establish a baseline
  // and persist the token. Any subsequent change becomes the FIRST diff.
  const isBootstrap = storedToken === null;
  let processed = 0;
  const outcomes: DispatchOutcome[] = [];

  if (!isBootstrap) {
    for (const event of listResult.events) {
      try {
        const outcome = await dispatchEvent(event, handlers);
        if (outcome) {
          outcomes.push(outcome);
          if (outcome.action !== 'noop') {
            processed += 1;
          }
        }
      } catch (dispatchErr) {
        logger.error(
          '[calendar-sync] dispatchEvent threw',
          dispatchErr instanceof Error ? dispatchErr : new Error(String(dispatchErr)),
          { file: FILE, eventId: event.id ?? 'unknown' },
        );
      }
    }
  } else {
    logger.info('[calendar-sync] bootstrap sweep — skipping dispatch', {
      file: FILE,
      eventCount: listResult.events.length,
    });
  }

  // Persist the new token. If `nextSyncToken` is null (rare — only
  // happens when the page loop short-circuited via the safety cap),
  // we leave the existing one in place so we don't lose progress.
  if (typeof listResult.nextSyncToken === 'string' && listResult.nextSyncToken.length > 0) {
    await writeSyncToken(listResult.nextSyncToken);
  }

  logger.info('[calendar-sync] sweep complete', {
    file: FILE,
    bootstrap: isBootstrap,
    eventsExamined: listResult.events.length,
    processed,
    outcomes: outcomes.map((o) => `${o.action}:${o.refId}:${o.success ? 'ok' : 'err'}`),
  });

  return { processed };
}
