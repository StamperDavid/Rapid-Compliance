/**
 * Google Calendar Push Notification Webhook
 * ─────────────────────────────────────────────────────────────────────
 * POST /api/webhooks/google-calendar
 *
 * Receives push notifications from Google when events on the operator's
 * primary calendar are created, updated, or deleted. Google does NOT
 * include the event payload — the body is empty and the relevant
 * metadata arrives in headers:
 *
 *   x-goog-channel-id      — UUID we generated at watch.subscribe time
 *   x-goog-resource-id     — Google's id for the watched calendar
 *   x-goog-resource-state  — 'sync' | 'exists' | 'not_exists'
 *
 * `sync`     = subscription confirmation, no work to do.
 * `exists` / `not_exists` = at least one event changed; run a sync
 *                          sweep to discover what.
 *
 * Security: validate `x-goog-channel-id` matches the stored watch
 * doc id. If a forged notification arrives with a stale or unknown
 * channel id, return 401.
 *
 * Always return 200 on internal failure: Google retries non-2xx
 * responses with backoff, and a flap in our handler would balloon
 * into a self-DoS as retries pile up. We log and move on.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { getStoredWatchChannel } from '@/lib/integrations/calendar-watch-service';
import { runSyncSweep } from '@/lib/integrations/calendar-sync-engine';
import { calendarSyncHandlers } from '@/lib/integrations/calendar-sync-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROUTE = '/api/webhooks/google-calendar';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const channelId = request.headers.get('x-goog-channel-id');
  const resourceId = request.headers.get('x-goog-resource-id');
  const resourceState = request.headers.get('x-goog-resource-state');
  const messageNumber = request.headers.get('x-goog-message-number');

  logger.info('[google-calendar-webhook] received push notification', {
    route: ROUTE,
    channelId,
    resourceId,
    resourceState,
    messageNumber,
  });

  // Channel id must match our stored watch doc — anyone can POST to
  // this URL, so this is the verification step.
  if (typeof channelId !== 'string' || channelId.length === 0) {
    logger.warn('[google-calendar-webhook] missing x-goog-channel-id header', { route: ROUTE });
    return NextResponse.json({ error: 'missing channel id' }, { status: 401 });
  }

  let stored;
  try {
    stored = await getStoredWatchChannel();
  } catch (err) {
    logger.error(
      '[google-calendar-webhook] failed to read stored watch doc',
      err instanceof Error ? err : new Error(String(err)),
      { route: ROUTE },
    );
    // Return 200 — Google would retry on non-2xx, and a Firestore blip
    // shouldn't cascade into a retry storm.
    return NextResponse.json({ ok: false, reason: 'firestore-read-failed' });
  }

  if (!stored) {
    logger.warn('[google-calendar-webhook] no stored watch channel — rejecting as unauthorized', {
      route: ROUTE,
      channelId,
    });
    return NextResponse.json({ error: 'no active subscription' }, { status: 401 });
  }

  if (stored.id !== channelId) {
    logger.warn('[google-calendar-webhook] channel id mismatch — rejecting forged notification', {
      route: ROUTE,
      receivedChannelId: channelId,
      storedChannelId: stored.id,
    });
    return NextResponse.json({ error: 'channel id mismatch' }, { status: 401 });
  }

  // `sync` is fired once at subscription time as Google's confirmation.
  // No events have changed yet — return 200 immediately.
  if (resourceState === 'sync') {
    logger.info('[google-calendar-webhook] subscription confirmation received', {
      route: ROUTE,
      channelId,
    });
    return NextResponse.json({ ok: true, kind: 'sync' });
  }

  // `exists` (event changed) and `not_exists` (event deleted) both
  // require a diff sweep — Google doesn't tell us which event.
  if (resourceState === 'exists' || resourceState === 'not_exists') {
    try {
      const result = await runSyncSweep(calendarSyncHandlers);
      logger.info('[google-calendar-webhook] sync sweep complete', {
        route: ROUTE,
        channelId,
        resourceState,
        processed: result.processed,
      });
      return NextResponse.json({ ok: true, processed: result.processed });
    } catch (err) {
      // Always return 200 even on internal failure — see file docstring.
      logger.error(
        '[google-calendar-webhook] sync sweep threw',
        err instanceof Error ? err : new Error(String(err)),
        { route: ROUTE, channelId, resourceState },
      );
      return NextResponse.json({ ok: false, reason: 'sweep-failed' });
    }
  }

  // Unknown resource state — log and accept so Google doesn't retry.
  logger.warn('[google-calendar-webhook] unexpected resource state', {
    route: ROUTE,
    resourceState,
  });
  return NextResponse.json({ ok: true, kind: 'unknown-state' });
}
