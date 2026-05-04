/**
 * Google Calendar Watch Service
 * ─────────────────────────────────────────────────────────────────────
 * Manages the push-notification subscription on the operator's PRIMARY
 * Google Calendar so the platform can react to operator-initiated edits
 * (cancel from phone notification, reschedule via Google UI, etc).
 *
 * Two-way sync flow:
 *   1. Operator OAuths Google                  → callback subscribes
 *   2. Google calendar mutates                 → POST to our webhook
 *   3. Webhook runs the diff/dispatch engine   → calendar-sync-engine.ts
 *   4. Vercel cron renews subscription daily   → /api/cron/renew-calendar-watch
 *   5. Operator disconnects Google             → unsubscribe + delete doc
 *
 * The `id` field is a UUID we generate at subscribe time so the webhook
 * receiver can verify any incoming `x-goog-channel-id` actually belongs
 * to OUR active subscription. Tokens are read from the central
 * connected-Google store (`getConnectedGoogleTokens`).
 *
 * Local-dev fallback: Google rejects watch URLs that aren't HTTPS public
 * domains. When `NEXT_PUBLIC_APP_URL` is `http://localhost:3000`, this
 * service logs a warning and skips the subscribe — the OAuth flow
 * completes cleanly without a watch channel. Re-subscribe in prod.
 */

import { google } from 'googleapis';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { getConnectedGoogleTokens } from '@/lib/integrations/google-tokens';

const FILE = 'integrations/calendar-watch-service.ts';
const CONNECTED_ACCOUNTS_COLLECTION = 'connectedAccounts';
const WATCH_DOC_ID = 'google-calendar-watch';
const WEBHOOK_PATH = '/api/webhooks/google-calendar';

/**
 * Number of days remaining before expiration when we trigger a renewal.
 * Google maxes channel lifetime at 30 days for `events.watch`; we renew
 * at 7-days-left to give us a comfortable buffer.
 */
const RENEW_THRESHOLD_DAYS = 7;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const googleRedirectUriEnv = process.env.GOOGLE_REDIRECT_URI;
const GOOGLE_REDIRECT_URI =
  googleRedirectUriEnv !== '' && googleRedirectUriEnv != null
    ? googleRedirectUriEnv
    : 'http://localhost:3000/api/integrations/google/callback';

interface StoredWatchDoc {
  /** UUID we generated; used to verify incoming webhook headers. */
  id: string;
  /** Google's resource id for the watched calendar (used to stop the channel). */
  resourceId: string;
  /** Unix-epoch ms when Google will tear down the subscription. */
  expiration: number;
  /** Webhook URL we registered (for diagnostics). */
  webhookUrl: string;
  /** Calendar id watched ("primary" for now). */
  calendarId: string;
  /** ISO timestamp of the most recent subscribe/renew. */
  updatedAt: string;
}

export interface SubscribeResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  id?: string;
  resourceId?: string;
  expiration?: number;
}

function getWebhookUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (typeof base !== 'string' || base.length === 0) {
    return `http://localhost:3000${WEBHOOK_PATH}`;
  }
  return `${base.replace(/\/$/, '')}${WEBHOOK_PATH}`;
}

function isLocalDev(url: string): boolean {
  return url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1');
}

function buildAuthClient(accessToken: string, refreshToken: string | null): import('google-auth-library').OAuth2Client {
  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });
  return auth;
}

function getWatchDocRef(): FirebaseFirestore.DocumentReference | null {
  if (!adminDb) {
    return null;
  }
  return adminDb.collection(getSubCollection(CONNECTED_ACCOUNTS_COLLECTION)).doc(WATCH_DOC_ID);
}

async function readWatchDoc(): Promise<StoredWatchDoc | null> {
  const ref = getWatchDocRef();
  if (!ref) {
    return null;
  }
  const snap = await ref.get();
  if (!snap.exists) {
    return null;
  }
  const data = snap.data() as Partial<StoredWatchDoc> | undefined;
  if (
    !data ||
    typeof data.id !== 'string' ||
    typeof data.resourceId !== 'string' ||
    typeof data.expiration !== 'number' ||
    typeof data.calendarId !== 'string'
  ) {
    return null;
  }
  return {
    id: data.id,
    resourceId: data.resourceId,
    expiration: data.expiration,
    webhookUrl: typeof data.webhookUrl === 'string' ? data.webhookUrl : '',
    calendarId: data.calendarId,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

async function writeWatchDoc(doc: StoredWatchDoc): Promise<void> {
  const ref = getWatchDocRef();
  if (!ref) {
    return;
  }
  await ref.set(doc);
}

async function deleteWatchDoc(): Promise<void> {
  const ref = getWatchDocRef();
  if (!ref) {
    return;
  }
  await ref.delete();
}

/**
 * Read the stored watch doc — used by the webhook handler to verify
 * an incoming `x-goog-channel-id` matches our active subscription.
 * Exported as a thin read-only accessor so the webhook route doesn't
 * have to know our Firestore layout.
 */
export async function getStoredWatchChannel(): Promise<{
  id: string;
  resourceId: string;
  expiration: number;
  calendarId: string;
} | null> {
  const doc = await readWatchDoc();
  if (!doc) {
    return null;
  }
  return {
    id: doc.id,
    resourceId: doc.resourceId,
    expiration: doc.expiration,
    calendarId: doc.calendarId,
  };
}

/**
 * Stop a Google Calendar push channel. Used by both `unsubscribe` (on
 * disconnect) and `renew` (replace-old-with-new). Google returns 200 on
 * success, 404 if already stopped — both are fine.
 */
async function stopChannel(
  auth: import('google-auth-library').OAuth2Client,
  channelId: string,
  resourceId: string,
): Promise<void> {
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.channels.stop({
    requestBody: {
      id: channelId,
      resourceId,
    },
  });
}

/**
 * Subscribe to push notifications on the operator's primary Google
 * Calendar. Generates a UUID for the channel id, registers our HTTPS
 * webhook with Google, persists the resulting watch metadata to
 * Firestore.
 *
 * Local-dev guard: if `NEXT_PUBLIC_APP_URL` resolves to localhost,
 * Google's watch endpoint will reject the call (HTTPS-only). We skip
 * subscribing and return `{ success: true, skipped: true }` so the
 * caller (the OAuth callback) doesn't surface an error — the operator
 * gets a clean OAuth completion in dev, and watch subscription is the
 * production-only feature.
 */
export async function subscribeToConnectedGoogleCalendar(): Promise<SubscribeResult> {
  if (!adminDb) {
    return { success: false, reason: 'Firebase admin not initialized' };
  }

  const webhookUrl = getWebhookUrl();
  if (isLocalDev(webhookUrl)) {
    logger.warn(
      '[calendar-watch] skipping watch subscription — NEXT_PUBLIC_APP_URL is localhost (Google requires HTTPS public URL)',
      { file: FILE, webhookUrl },
    );
    return {
      success: true,
      skipped: true,
      reason: 'localhost dev — Google calendar push requires a public HTTPS URL',
    };
  }

  const tokens = await getConnectedGoogleTokens();
  if (!tokens) {
    logger.warn('[calendar-watch] no connected Google account; cannot subscribe', { file: FILE });
    return { success: false, reason: 'no connected Google account' };
  }

  try {
    const auth = buildAuthClient(tokens.accessToken, tokens.refreshToken);
    const calendar = google.calendar({ version: 'v3', auth });

    const channelId = randomUUID();
    const watchRes = await calendar.events.watch({
      calendarId: 'primary',
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
      },
    });

    const resourceId = watchRes.data.resourceId;
    const expirationStr = watchRes.data.expiration;
    if (typeof resourceId !== 'string' || resourceId.length === 0) {
      logger.error('[calendar-watch] watch response missing resourceId', new Error('missing resourceId'), {
        file: FILE,
      });
      return { success: false, reason: 'missing resourceId in watch response' };
    }
    const expiration = typeof expirationStr === 'string' ? Number(expirationStr) : 0;

    const doc: StoredWatchDoc = {
      id: channelId,
      resourceId,
      expiration,
      webhookUrl,
      calendarId: 'primary',
      updatedAt: new Date().toISOString(),
    };
    await writeWatchDoc(doc);

    logger.info('[calendar-watch] subscribed to primary calendar push notifications', {
      file: FILE,
      channelId,
      resourceId,
      expiration,
      webhookUrl,
    });

    return { success: true, id: channelId, resourceId, expiration };
  } catch (err) {
    logger.error(
      '[calendar-watch] subscribe failed',
      err instanceof Error ? err : new Error(String(err)),
      { file: FILE, webhookUrl },
    );
    return {
      success: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface RenewResult {
  renewed: boolean;
  reason?: string;
  expiration?: number;
}

/**
 * If the stored watch channel has fewer than RENEW_THRESHOLD_DAYS left
 * before expiration, register a fresh channel with a new UUID and stop
 * the old one. Idempotent — calling this when the channel is still
 * fresh is a no-op.
 *
 * Replacement order matters:
 *   1. Watch with NEW id   → Google returns new resourceId + expiration
 *   2. Stop OLD channel    → at this point the new channel is already live,
 *                            so we don't lose any events to a gap
 *   3. Persist NEW doc     → overwrites the old one
 *
 * Stop failures on the OLD channel are logged but don't fail the
 * renewal — Google may have already torn down the old channel
 * server-side near expiration, returning 404.
 */
export async function renewConnectedGoogleCalendarWatch(): Promise<RenewResult> {
  if (!adminDb) {
    return { renewed: false, reason: 'Firebase admin not initialized' };
  }

  const webhookUrl = getWebhookUrl();
  if (isLocalDev(webhookUrl)) {
    logger.warn('[calendar-watch] renew skipped — local dev', { file: FILE });
    return { renewed: false, reason: 'localhost dev' };
  }

  const stored = await readWatchDoc();
  if (!stored) {
    // No active subscription — try to subscribe fresh. This handles
    // the case where prod went live AFTER the operator OAuthed in dev.
    logger.info('[calendar-watch] no stored watch doc — attempting fresh subscribe', { file: FILE });
    const sub = await subscribeToConnectedGoogleCalendar();
    return {
      renewed: sub.success && !sub.skipped,
      reason: sub.reason,
      expiration: sub.expiration,
    };
  }

  const msUntilExpiry = stored.expiration - Date.now();
  const daysUntilExpiry = msUntilExpiry / (24 * 60 * 60 * 1000);
  if (daysUntilExpiry > RENEW_THRESHOLD_DAYS) {
    logger.info('[calendar-watch] renew skipped — channel still fresh', {
      file: FILE,
      daysRemaining: Math.round(daysUntilExpiry),
    });
    return { renewed: false, reason: 'still fresh', expiration: stored.expiration };
  }

  const tokens = await getConnectedGoogleTokens();
  if (!tokens) {
    return { renewed: false, reason: 'no connected Google account' };
  }

  try {
    const auth = buildAuthClient(tokens.accessToken, tokens.refreshToken);
    const calendar = google.calendar({ version: 'v3', auth });

    // Step 1 — register a fresh channel
    const newChannelId = randomUUID();
    const newWatch = await calendar.events.watch({
      calendarId: stored.calendarId,
      requestBody: {
        id: newChannelId,
        type: 'web_hook',
        address: webhookUrl,
      },
    });
    const newResourceId = newWatch.data.resourceId;
    const newExpirationStr = newWatch.data.expiration;
    if (typeof newResourceId !== 'string' || newResourceId.length === 0) {
      return { renewed: false, reason: 'missing resourceId in renew response' };
    }
    const newExpiration = typeof newExpirationStr === 'string' ? Number(newExpirationStr) : 0;

    // Step 2 — stop the old channel (best-effort)
    try {
      await stopChannel(auth, stored.id, stored.resourceId);
    } catch (stopErr) {
      logger.warn('[calendar-watch] old channel stop failed (non-fatal)', {
        file: FILE,
        oldChannelId: stored.id,
        error: stopErr instanceof Error ? stopErr.message : String(stopErr),
      });
    }

    // Step 3 — persist the new doc
    const doc: StoredWatchDoc = {
      id: newChannelId,
      resourceId: newResourceId,
      expiration: newExpiration,
      webhookUrl,
      calendarId: stored.calendarId,
      updatedAt: new Date().toISOString(),
    };
    await writeWatchDoc(doc);

    logger.info('[calendar-watch] renewed primary calendar watch channel', {
      file: FILE,
      newChannelId,
      newExpiration,
    });

    return { renewed: true, expiration: newExpiration };
  } catch (err) {
    logger.error(
      '[calendar-watch] renew failed',
      err instanceof Error ? err : new Error(String(err)),
      { file: FILE },
    );
    return { renewed: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Stop the watch channel and delete the stored doc. Called by the
 * Google disconnect endpoint BEFORE the central token doc is deleted
 * (we still need the OAuth tokens to call channels.stop).
 *
 * Always attempts to delete the Firestore doc even if Google's stop
 * call fails — a stale channel is harmless because:
 *   - the operator just disconnected, so future webhook hits will fail
 *     the channel-id verification check anyway
 *   - the channel will expire on its own within 30 days
 */
export async function unsubscribeConnectedGoogleCalendarWatch(): Promise<{
  success: boolean;
  reason?: string;
}> {
  if (!adminDb) {
    return { success: false, reason: 'Firebase admin not initialized' };
  }

  const stored = await readWatchDoc();
  if (!stored) {
    logger.info('[calendar-watch] unsubscribe — no stored watch doc, nothing to do', { file: FILE });
    return { success: true };
  }

  const tokens = await getConnectedGoogleTokens();
  if (tokens) {
    try {
      const auth = buildAuthClient(tokens.accessToken, tokens.refreshToken);
      await stopChannel(auth, stored.id, stored.resourceId);
      logger.info('[calendar-watch] stopped Google push channel', {
        file: FILE,
        channelId: stored.id,
      });
    } catch (err) {
      // Logged + ignored — see function docstring.
      logger.warn('[calendar-watch] channels.stop failed; deleting local doc anyway', {
        file: FILE,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    logger.warn('[calendar-watch] no tokens available to stop channel; deleting local doc only', {
      file: FILE,
    });
  }

  try {
    await deleteWatchDoc();
  } catch (delErr) {
    logger.error(
      '[calendar-watch] delete watch doc failed',
      delErr instanceof Error ? delErr : new Error(String(delErr)),
      { file: FILE },
    );
    return { success: false, reason: delErr instanceof Error ? delErr.message : String(delErr) };
  }

  return { success: true };
}
