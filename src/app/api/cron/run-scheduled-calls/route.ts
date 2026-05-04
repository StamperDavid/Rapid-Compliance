/**
 * Run Scheduled Calls Cron
 *
 * GET /api/cron/run-scheduled-calls
 * Schedule: every 1 minute (vercel.json)
 *
 * Polls `scheduledCalls` for docs with:
 *   - status === 'scheduled'
 *   - scheduledFor  <= now
 *
 * For each match (max 5 per run):
 *   1. Flip status → 'firing' (so a re-entrant cron run never double-fires).
 *   2. Run TCPA + call-time-window compliance gates.
 *   3. Place the Twilio call directly (mirrors the place_call handler in
 *      jasper-tools.ts and /api/voice/call). Same TwiML callback, same
 *      status-callback webhook → so downstream Mission Control,
 *      analytics, and the AI Voice Agent see this call exactly like a
 *      live "Call now" from the operator UI or Jasper.
 *   4. On success: status='fired' + record callSid + firedAt, write a
 *      `calls/{callId}` doc (same shape as /api/voice/call) so the call
 *      shows in the existing call log.
 *   5. On failure: status='failed' + lastError. Operator must
 *      explicitly reschedule — we do NOT auto-retry, because the most
 *      common failure modes (TCPA opt-out, time window, no Twilio
 *      creds) won't fix themselves on a retry.
 *   6. Either way the calendar event is removed via
 *      `deleteSalesVelocityCalendarEvent('voice-call-{id}')` since the
 *      event has either fired or won't fire.
 *
 * Idempotency: the status='firing' transition is the lock — the next
 * cron tick will skip docs in 'firing' status. If the process crashes
 * between firing and fired/failed, the doc is left in 'firing' — an
 * operator can manually flip it back to 'scheduled' or 'failed'. (A
 * timeout-based recovery sweep can be added later if this becomes a
 * common pattern.)
 */

import { type NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { adminDb } from '@/lib/firebase/admin';
import {
  getScheduledCallsCollection,
  getCallsCollection,
} from '@/lib/firebase/collections';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { checkTCPAConsent, checkCallTimeRestrictions } from '@/lib/compliance/tcpa-service';
import { getTwilioCredentials } from '@/lib/security/twilio-verification';
import { deleteSalesVelocityCalendarEvent } from '@/lib/integrations/google-calendar-service';
import type { ScheduledCall } from '@/types/scheduled-call';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROUTE = '/api/cron/run-scheduled-calls';
const MAX_CALLS_PER_RUN = 5;

interface RunOutcome {
  scheduleId: string;
  status: 'fired' | 'failed' | 'skipped';
  reason?: string;
  callSid?: string;
  callId?: string;
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.length > 0
    ? process.env.NEXT_PUBLIC_APP_URL
    : 'http://localhost:3000';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request, ROUTE);
  if (authError) { return authError; }

  if (!adminDb) {
    return NextResponse.json({ error: 'Firestore admin not initialized' }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const collectionPath = getScheduledCallsCollection();

  // Pull a few extra so we can skip ones that fail mid-run without
  // running out of work — but cap firings at MAX_CALLS_PER_RUN.
  let snap;
  try {
    snap = await adminDb
      .collection(collectionPath)
      .where('status', '==', 'scheduled')
      .where('scheduledFor', '<=', nowIso)
      .orderBy('scheduledFor', 'asc')
      .limit(MAX_CALLS_PER_RUN * 2)
      .get();
  } catch (queryErr) {
    // Likely a missing composite index on first deploy. Surface clearly
    // so the operator can create the index from the Firestore console.
    logger.error(
      '[run-scheduled-calls] Firestore query failed (probably needs composite index on status+scheduledFor)',
      queryErr instanceof Error ? queryErr : new Error(String(queryErr)),
      { route: ROUTE },
    );
    return NextResponse.json(
      {
        error: 'Firestore query failed',
        hint: 'May need composite index on (status ASC, scheduledFor ASC). The error message above usually contains a "create index" link.',
      },
      { status: 500 },
    );
  }

  if (snap.empty) {
    return NextResponse.json({ checked: 0, fired: 0, outcomes: [] });
  }

  const outcomes: RunOutcome[] = [];
  let firedCount = 0;

  // Pre-load Twilio creds once per run.
  const twilioKeys = await getTwilioCredentials();
  const twilioConfigured = !!(twilioKeys?.accountSid && twilioKeys?.authToken && twilioKeys?.phoneNumber);

  for (const doc of snap.docs) {
    if (firedCount >= MAX_CALLS_PER_RUN) { break; }

    const sched = doc.data() as ScheduledCall;
    const scheduleId = doc.id;

    // Defensive guard — Firestore where-clause should already filter,
    // but enforce here too in case of doc-level race.
    if (sched.status !== 'scheduled') {
      outcomes.push({
        scheduleId,
        status: 'skipped',
        reason: `unexpected status ${sched.status}`,
      });
      continue;
    }

    // Step 1 — flip to 'firing' as the lock.
    try {
      await doc.ref.update({
        status: 'firing',
        firingStartedAt: new Date().toISOString(),
      });
    } catch (lockErr) {
      logger.error(
        '[run-scheduled-calls] failed to flip status to firing',
        lockErr instanceof Error ? lockErr : new Error(String(lockErr)),
        { route: ROUTE, scheduleId },
      );
      outcomes.push({
        scheduleId,
        status: 'skipped',
        reason: `lock-flip failed: ${lockErr instanceof Error ? lockErr.message : String(lockErr)}`,
      });
      continue;
    }

    // Step 2 — TCPA + time-window gates (mirrors place_call / /api/voice/call).
    try {
      const tcpa = await checkTCPAConsent(sched.to, 'call');
      if (!tcpa.allowed) {
        await markFailed(doc.ref, scheduleId, `TCPA: ${tcpa.reason ?? 'consent denied'}`);
        outcomes.push({ scheduleId, status: 'failed', reason: `TCPA: ${tcpa.reason ?? 'consent denied'}` });
        continue;
      }

      const timeCheck = checkCallTimeRestrictions(sched.to);
      if (!timeCheck.allowed) {
        await markFailed(doc.ref, scheduleId, `Time window: ${timeCheck.reason ?? 'outside allowed window'}`);
        outcomes.push({ scheduleId, status: 'failed', reason: `Time window: ${timeCheck.reason ?? 'outside allowed window'}` });
        continue;
      }
    } catch (gateErr) {
      const msg = gateErr instanceof Error ? gateErr.message : String(gateErr);
      await markFailed(doc.ref, scheduleId, `Compliance gate failed: ${msg}`);
      outcomes.push({ scheduleId, status: 'failed', reason: `compliance-gate-error: ${msg}` });
      continue;
    }

    // Step 3 — Twilio creds check.
    if (!twilioConfigured || !twilioKeys) {
      await markFailed(doc.ref, scheduleId, 'Twilio is not configured. Add credentials under Settings > API Keys.');
      outcomes.push({
        scheduleId,
        status: 'failed',
        reason: 'twilio not configured',
      });
      continue;
    }

    // Step 4 — place the call.
    try {
      // Local re-narrow — `twilioConfigured` already guarantees these are
      // defined non-empty strings, but TS can't follow the boolean
      // through the loop.
      const accountSid = twilioKeys.accountSid;
      const authToken = twilioKeys.authToken;
      const fromNumber = twilioKeys.phoneNumber;
      if (!accountSid || !authToken || !fromNumber) {
        await markFailed(doc.ref, scheduleId, 'Twilio credentials missing at fire time');
        outcomes.push({ scheduleId, status: 'failed', reason: 'twilio creds missing at fire time' });
        continue;
      }
      const client = twilio(accountSid, authToken);
      const appUrl = getAppUrl();
      const call = await client.calls.create({
        to: sched.to,
        from: fromNumber,
        url: `${appUrl}/api/voice/twiml`,
        statusCallback: `${appUrl}/api/webhooks/voice`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      });

      // Write a callLogs entry mirroring /api/voice/call so this call
      // shows up in the existing call log alongside live calls.
      const callId = `call-${Date.now()}`;
      await adminDb.collection(getCallsCollection()).doc(callId).set({
        id: callId,
        twilioCallSid: call.sid,
        contactId: sched.contactId ?? null,
        leadId: sched.leadId ?? null,
        phoneNumber: sched.to,
        status: 'initiated',
        direction: 'outbound',
        recordingConsentDisclosed: true,
        createdAt: new Date().toISOString(),
        createdBy: sched.createdBy,
        initiatedBy: 'cron:run-scheduled-calls',
        firedFromScheduleId: scheduleId,
        goal: sched.goal,
      });

      await doc.ref.update({
        status: 'fired',
        firedAt: new Date().toISOString(),
        callSid: call.sid,
        firedFromScheduleId: callId,
      });

      // Calendar event has fired — remove it (idempotent).
      try {
        await deleteSalesVelocityCalendarEvent(`voice-call-${scheduleId}`);
      } catch (calErr) {
        logger.warn('[run-scheduled-calls] calendar event delete failed (non-fatal)', {
          route: ROUTE,
          scheduleId,
          error: calErr instanceof Error ? calErr.message : String(calErr),
        });
      }

      outcomes.push({
        scheduleId,
        status: 'fired',
        callSid: call.sid,
        callId,
      });
      firedCount++;
    } catch (twErr) {
      const msg = twErr instanceof Error ? twErr.message : String(twErr);
      await markFailed(doc.ref, scheduleId, `Twilio error: ${msg}`);
      outcomes.push({ scheduleId, status: 'failed', reason: `twilio: ${msg}` });
    }
  }

  logger.info('[run-scheduled-calls] run complete', {
    route: ROUTE,
    checked: snap.size,
    fired: firedCount,
    outcomes: outcomes.map((o) => `${o.scheduleId}:${o.status}`),
  });

  return NextResponse.json({
    success: true,
    checked: snap.size,
    fired: firedCount,
    outcomes,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Mark a scheduled call as failed and remove its calendar event.
 * Centralized so every failure path writes the same shape.
 */
async function markFailed(
  ref: FirebaseFirestore.DocumentReference,
  scheduleId: string,
  errorMessage: string,
): Promise<void> {
  try {
    await ref.update({
      status: 'failed',
      lastError: errorMessage,
      failedAt: new Date().toISOString(),
    });
  } catch (updateErr) {
    logger.error(
      '[run-scheduled-calls] failed to write failure state',
      updateErr instanceof Error ? updateErr : new Error(String(updateErr)),
      { route: ROUTE, scheduleId },
    );
  }

  try {
    await deleteSalesVelocityCalendarEvent(`voice-call-${scheduleId}`);
  } catch (calErr) {
    logger.warn('[run-scheduled-calls] calendar delete after failure failed (non-fatal)', {
      route: ROUTE,
      scheduleId,
      error: calErr instanceof Error ? calErr.message : String(calErr),
    });
  }
}
