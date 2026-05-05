/**
 * Sequence Scheduler
 *
 * Schedules and dispatches multi-step email cadences (nurture, drip, welcome
 * series, newsletters). Lives outside the in-process workflow-engine because
 * that engine's delay-action blocks the event loop via setTimeout and is
 * bounded by a 60s global timeout — unusable for day-scale cadences.
 *
 * Design:
 *   - One `workflowSequenceJobs` doc per scheduled email, with an absolute
 *     `fireAt` timestamp.
 *   - The /api/cron/workflow-scheduler route polls for jobs where
 *     fireAt <= now AND status = 'pending', and dispatches each via the
 *     existing sendEmail service.
 *   - Cadence is parsed from each email's `sendTimingHint` (preferred) and
 *     falls back to a top-level `cadence` string like "day 1, 3, 7, 14" or
 *     "over 14 days".
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { sendEmail } from '@/lib/email/email-service';
import { logger } from '@/lib/logger/logger';
// google-calendar-service is loaded dynamically inside each call site
// below. Static-importing it pulls the entire `googleapis` chain
// (which uses node:net / node:fs / etc.) into any client bundle that
// transitively reaches this file (workflow-service dynamically imports
// this module from a `'use client'` page chain).
import type { WorkflowSequenceJob } from '@/types/workflow';

const COLLECTION = 'workflowSequenceJobs';
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface SequenceEmail {
  order: number;
  subjectLine: string;
  previewText?: string;
  body: string;
  cta?: string;
  sendTimingHint?: string;
}

export interface ScheduleEmailSequenceParams {
  workflowId: string;
  missionId?: string;
  sequenceType: WorkflowSequenceJob['sequenceType'];
  triggerEvent?: string;
  emails: SequenceEmail[];
  cadence?: string;
  /** Literal email OR template like "{{entity.email}}". */
  recipient: string;
  /** When the cadence "clock" starts. Defaults to now. */
  startAt?: Date;
}

export interface ScheduleEmailSequenceResult {
  jobIds: string[];
  fireAts: string[];
  firstFireAt: string;
  lastFireAt: string;
}

/**
 * Parse a mixed human cadence description into N day-offsets. Tries in order:
 *   1. Per-email `sendTimingHint` (preferred — the Copywriter annotates each)
 *   2. Top-level `cadence` string like "day 1, day 3, day 7, day 14"
 *   3. Top-level `cadence` string like "over 14 days" (evenly divide)
 *   4. Even daily spacing starting at day 0
 *
 * All offsets are in fractional days (so "immediately" = 0, "3 hours" ≈ 0.125).
 */
export function parseCadenceToOffsetDays(
  emails: SequenceEmail[],
  cadence?: string,
): number[] {
  const count = emails.length;
  if (count === 0) { return []; }

  // (1) Per-email hint path — only use if every email has a parseable hint.
  const perEmailOffsets: number[] = [];
  for (const email of emails) {
    const offset = parseTimingHintToDays(email.sendTimingHint);
    if (offset === null) { break; }
    perEmailOffsets.push(offset);
  }
  if (perEmailOffsets.length === count) {
    return perEmailOffsets;
  }

  // (2) / (3) Top-level cadence parse.
  if (typeof cadence === 'string' && cadence.trim().length > 0) {
    const fromCadence = parseCadenceString(cadence, count);
    if (fromCadence) { return fromCadence; }
  }

  // (4) Fallback: even daily spacing (day 1, 2, 3, ...). Step 1 fires
  // immediately; subsequent steps fire each 24h apart.
  return Array.from({ length: count }, (_, i) => i);
}

/**
 * Translate one human timing hint to a day-offset. Returns null if the hint
 * cannot be confidently parsed — callers should fall back to other sources.
 */
function parseTimingHintToDays(hint?: string): number | null {
  if (typeof hint !== 'string') { return null; }
  const trimmed = hint.trim().toLowerCase();
  if (trimmed.length === 0) { return null; }

  if (
    trimmed === 'immediately' ||
    trimmed === 'immediately on trigger' ||
    trimmed === 'on trigger' ||
    trimmed === 'day 0' ||
    trimmed === 'now'
  ) {
    return 0;
  }

  // "day N" / "day N after trigger" / "on day N"
  const dayMatch = /(?:^|\b)day\s+(\d+(?:\.\d+)?)(?:\s|$)/.exec(trimmed);
  if (dayMatch) {
    return Math.max(0, parseFloat(dayMatch[1]) - 1); // day 1 = offset 0
  }

  // "N days after" / "wait N days" / "after N days"
  const waitDaysMatch = /(\d+(?:\.\d+)?)\s*days?/.exec(trimmed);
  if (waitDaysMatch) {
    return Math.max(0, parseFloat(waitDaysMatch[1]));
  }

  // "N hours after"
  const waitHoursMatch = /(\d+(?:\.\d+)?)\s*hours?/.exec(trimmed);
  if (waitHoursMatch) {
    return Math.max(0, parseFloat(waitHoursMatch[1]) / 24);
  }

  return null;
}

/**
 * Parse a cadence summary string into exactly `count` day-offsets.
 */
function parseCadenceString(cadence: string, count: number): number[] | null {
  const trimmed = cadence.trim().toLowerCase();

  // Pattern A: "day 1, day 3, day 7, day 14" (enumerated days)
  const dayMatches = trimmed.match(/day\s+(\d+(?:\.\d+)?)/g);
  if (dayMatches?.length === count) {
    return dayMatches
      .map((m) => {
        const n = /day\s+(\d+(?:\.\d+)?)/.exec(m);
        if (!n) { return 0; }
        return Math.max(0, parseFloat(n[1]) - 1);
      });
  }

  // Pattern B: "over N days" — evenly divide.
  const overMatch = /over\s+(\d+(?:\.\d+)?)\s*days?/.exec(trimmed);
  if (overMatch) {
    const totalDays = parseFloat(overMatch[1]);
    if (count === 1) { return [0]; }
    const step = totalDays / (count - 1);
    return Array.from({ length: count }, (_, i) => Math.max(0, i * step));
  }

  // Pattern C: "every N days" — uniform spacing.
  const everyMatch = /every\s+(\d+(?:\.\d+)?)\s*days?/.exec(trimmed);
  if (everyMatch) {
    const step = parseFloat(everyMatch[1]);
    return Array.from({ length: count }, (_, i) => i * step);
  }

  return null;
}

/**
 * Schedule a sequence by writing one `workflowSequenceJobs` doc per email.
 *
 * Each job carries the full email payload (subject + body + recipient) so the
 * cron dispatcher can fire it without needing to re-resolve upstream state.
 */
export async function scheduleEmailSequence(
  params: ScheduleEmailSequenceParams,
): Promise<ScheduleEmailSequenceResult> {
  if (!adminDb) {
    throw new Error('Firestore admin not initialized — cannot schedule sequence');
  }
  if (!params.emails || params.emails.length === 0) {
    throw new Error('scheduleEmailSequence called with no emails');
  }

  const startAt = params.startAt ?? new Date();
  const offsetsDays = parseCadenceToOffsetDays(params.emails, params.cadence);
  const nowIso = new Date().toISOString();
  const recipientResolved = !/\{\{/.test(params.recipient);

  const jobIds: string[] = [];
  const fireAts: string[] = [];
  const batch = adminDb.batch();
  const collectionPath = getSubCollection(COLLECTION);

  const sortedEmails = [...params.emails].sort((a, b) => a.order - b.order);
  for (let i = 0; i < sortedEmails.length; i++) {
    const email = sortedEmails[i];
    const offsetDays = offsetsDays[i] ?? i;
    const fireAtMs = startAt.getTime() + offsetDays * DAY_MS;
    const fireAt = new Date(fireAtMs).toISOString();
    const jobId = `seqjob_${params.workflowId}_${email.order}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const job: WorkflowSequenceJob = {
      id: jobId,
      workflowId: params.workflowId,
      missionId: params.missionId,
      stepIndex: email.order,
      totalSteps: sortedEmails.length,
      sequenceType: params.sequenceType,
      triggerEvent: params.triggerEvent,
      recipient: params.recipient,
      recipientResolved,
      emailSubject: email.subjectLine,
      emailPreview: email.previewText,
      emailBody: renderEmailBody(email),
      sendTimingHint: email.sendTimingHint,
      fireAt,
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const docRef = adminDb.collection(collectionPath).doc(jobId);
    batch.set(docRef, job);
    jobIds.push(jobId);
    fireAts.push(fireAt);
  }

  await batch.commit();

  logger.info('[SequenceScheduler] Scheduled email sequence', {
    workflowId: params.workflowId,
    missionId: params.missionId,
    sequenceType: params.sequenceType,
    jobCount: jobIds.length,
    firstFireAt: fireAts[0],
    lastFireAt: fireAts[fireAts.length - 1],
  });

  // Mirror each scheduled email onto the operator's connected Google
  // Calendar (via the dedicated SalesVelocity.ai calendar). Only mirror
  // jobs whose recipient is a real address — template rows ({{entity.email}})
  // would create useless events. Failure is non-fatal.
  if (recipientResolved) {
    for (let i = 0; i < sortedEmails.length; i++) {
      const email = sortedEmails[i];
      const jobId = jobIds[i];
      const fireAt = fireAts[i];
      await syncSequenceJobToCalendar({
        jobId,
        recipient: params.recipient,
        subjectLine: email.subjectLine,
        previewText: email.previewText,
        bodyPlain: email.body,
        sequenceName: params.sequenceType,
        campaignId: params.workflowId,
        runAtIso: fireAt,
      });
    }
  }

  return {
    jobIds,
    fireAts,
    firstFireAt: fireAts[0],
    lastFireAt: fireAts[fireAts.length - 1],
  };
}

/**
 * Mirror a single sequenceJob onto the operator's connected Google Calendar.
 * Idempotent (refId-based upsert). Failure is logged + swallowed so the
 * primary scheduling write is never blocked by calendar issues.
 */
async function syncSequenceJobToCalendar(params: {
  jobId: string;
  recipient: string;
  subjectLine: string;
  previewText?: string;
  bodyPlain: string;
  sequenceName?: string;
  campaignId?: string;
  runAtIso: string;
}): Promise<void> {
  try {
    const subjectForTitle = params.subjectLine !== '' ? params.subjectLine : 'Drip email';
    const previewSlice = (params.previewText !== undefined && params.previewText !== ''
      ? params.previewText
      : params.bodyPlain
    ).slice(0, 500);
    const { upsertSalesVelocityCalendarEvent } = await import('@/lib/integrations/google-calendar-service');
    await upsertSalesVelocityCalendarEvent({
      refId: `email-send-${params.jobId}`,
      summary: `Email: ${subjectForTitle}`,
      description: [
        `Recipient: ${params.recipient}`,
        `Sequence: ${params.sequenceName ?? 'unnamed'}`,
        `Campaign: ${params.campaignId ?? 'n/a'}`,
        '',
        'Preview:',
        previewSlice,
      ].join('\n'),
      startIso: params.runAtIso,
      timeZone: 'America/New_York',
      category: 'email',
    });
  } catch (err) {
    logger.warn('[SequenceScheduler] Calendar mirror failed (non-fatal)', {
      jobId: params.jobId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Wrap a sequence email's body + CTA in a minimal HTML envelope for sending.
 * We already guarantee a body via the Copywriter Zod schema, so no fallback
 * is needed for empty content.
 */
function renderEmailBody(email: SequenceEmail): string {
  const paragraphs = email.body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
  const cta = email.cta
    ? `<p style="margin-top:24px;"><strong>${escapeHtml(email.cta)}</strong></p>`
    : '';
  return `<div style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.5;">${paragraphs}${cta}</div>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface FireReadyJobsResult {
  checked: number;
  fired: number;
  failed: number;
  skipped: number;
}

/**
 * Dispatch all jobs whose fireAt is due. Invoked by the workflow-scheduler
 * cron route on every tick.
 *
 * Batching: caps each run at 50 jobs to stay under the cron's 60s maxDuration
 * even if the email provider is slow. Remaining due jobs roll over to the
 * next poll tick.
 */
export async function fireReadySequenceJobs(maxBatch: number = 50): Promise<FireReadyJobsResult> {
  if (!adminDb) {
    throw new Error('Firestore admin not initialized — cannot fire jobs');
  }

  const nowIso = new Date().toISOString();
  const collectionPath = getSubCollection(COLLECTION);
  const dueSnap = await adminDb
    .collection(collectionPath)
    .where('status', '==', 'pending')
    .where('fireAt', '<=', nowIso)
    .orderBy('fireAt', 'asc')
    .limit(maxBatch)
    .get();

  if (dueSnap.empty) {
    return { checked: 0, fired: 0, failed: 0, skipped: 0 };
  }

  let fired = 0;
  let failed = 0;
  let skipped = 0;

  for (const docSnap of dueSnap.docs) {
    const job = docSnap.data() as WorkflowSequenceJob;
    const updateIso = new Date().toISOString();

    if (!job.recipientResolved || /\{\{/.test(job.recipient)) {
      await docSnap.ref.update({
        status: 'skipped',
        error: 'Recipient template was never resolved to a real email address',
        updatedAt: updateIso,
      });
      // Remove the (probably non-existent) calendar event for tidiness.
      await removeSequenceJobCalendarEvent(job.id);
      skipped++;
      continue;
    }

    try {
      const result = await sendEmail({
        to: [job.recipient],
        subject: job.emailSubject,
        html: job.emailBody,
        tracking: { trackOpens: true, trackClicks: true },
        metadata: {
          workflowId: job.workflowId,
          sequenceJobId: job.id,
          stepIndex: job.stepIndex,
          totalSteps: job.totalSteps,
        },
      });

      if (result.success) {
        await docSnap.ref.update({
          status: 'fired',
          firedAt: updateIso,
          provider: result.provider,
          messageId: result.messageId,
          updatedAt: updateIso,
        });
        // Job has now fired — remove the "scheduled" calendar event so the
        // operator's calendar reflects only outstanding work.
        await removeSequenceJobCalendarEvent(job.id);
        fired++;
      } else {
        await docSnap.ref.update({
          status: 'failed',
          error: result.error ?? 'sendEmail returned success=false without error',
          updatedAt: updateIso,
        });
        await removeSequenceJobCalendarEvent(job.id);
        failed++;
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await docSnap.ref.update({
        status: 'failed',
        error: errMsg,
        updatedAt: updateIso,
      });
      await removeSequenceJobCalendarEvent(job.id);
      logger.error('[SequenceScheduler] Failed to fire job', error instanceof Error ? error : new Error(errMsg), {
        jobId: job.id,
        workflowId: job.workflowId,
      });
      failed++;
    }
  }

  logger.info('[SequenceScheduler] Dispatch tick complete', {
    checked: dueSnap.size,
    fired,
    failed,
    skipped,
  });

  return { checked: dueSnap.size, fired, failed, skipped };
}

/**
 * Instantiate a sequence for a real recipient from a Workflow's template jobs.
 *
 * Called when the upstream event (e.g. `lead_created`) fires for a specific
 * entity: we copy the workflow's template jobs (which carry recipient
 * `{{entity.email}}`) into fresh `workflowSequenceJobs` docs with the real
 * email address, `status=pending`, and fireAt recomputed as `now + offset`
 * (where offset is the per-template job's original day offset from the
 * workflow's createdAt). The template rows stay untouched so the same
 * workflow can instantiate for every future matching entity.
 *
 * Returns the created job IDs. No-op (empty array + warning log) if the
 * workflow has no template jobs or the recipient is still a template string.
 */
export async function instantiateSequenceForRecipient(params: {
  workflowId: string;
  recipient: string;
  triggerEntity?: Record<string, unknown>;
}): Promise<ScheduleEmailSequenceResult | { jobIds: []; fireAts: []; firstFireAt: ''; lastFireAt: '' }> {
  if (!adminDb) {
    throw new Error('Firestore admin not initialized — cannot instantiate sequence');
  }
  if (/\{\{/.test(params.recipient)) {
    logger.warn('[SequenceScheduler] instantiateSequenceForRecipient refused template recipient', {
      workflowId: params.workflowId,
      recipient: params.recipient,
    });
    return { jobIds: [], fireAts: [], firstFireAt: '', lastFireAt: '' };
  }

  const collectionPath = getSubCollection(COLLECTION);
  const templateSnap = await adminDb
    .collection(collectionPath)
    .where('workflowId', '==', params.workflowId)
    .get();

  if (templateSnap.empty) {
    logger.warn('[SequenceScheduler] No template jobs found for workflow', {
      workflowId: params.workflowId,
    });
    return { jobIds: [], fireAts: [], firstFireAt: '', lastFireAt: '' };
  }

  const templates = templateSnap.docs
    .map((d) => d.data() as WorkflowSequenceJob)
    .filter((t) => !t.recipientResolved)
    .sort((a, b) => a.stepIndex - b.stepIndex);

  if (templates.length === 0) {
    logger.warn('[SequenceScheduler] No template (unresolved) jobs for workflow', {
      workflowId: params.workflowId,
    });
    return { jobIds: [], fireAts: [], firstFireAt: '', lastFireAt: '' };
  }

  // Rebuild the emails array + offsets from the template jobs. Offsets are
  // the day-delta between a template's fireAt and the first template's fireAt.
  const firstTemplateFireMs = new Date(templates[0].fireAt).getTime();
  const sortedEmails: SequenceEmail[] = templates.map((t) => ({
    order: t.stepIndex,
    subjectLine: t.emailSubject,
    previewText: t.emailPreview,
    // We only store rendered body HTML on the template. Re-wrap-avoidance:
    // renderEmailBody would HTML-wrap again. Stripping the outer div recreates
    // the author's body as best we can; if this ever misbehaves we can add a
    // separate `emailBodyRaw` column.
    body: stripHtmlEnvelope(t.emailBody),
    cta: undefined,
    sendTimingHint: t.sendTimingHint,
  }));

  const offsetsDays = templates.map((t) =>
    (new Date(t.fireAt).getTime() - firstTemplateFireMs) / DAY_MS,
  );

  // Schedule a fresh sequence anchored at now, preserving the original
  // per-step day-offsets from the template.
  const startAt = new Date();
  const nowIso = startAt.toISOString();
  const jobIds: string[] = [];
  const fireAts: string[] = [];
  const batch = adminDb.batch();

  for (let i = 0; i < templates.length; i++) {
    const tmpl = templates[i];
    const fireAtMs = startAt.getTime() + offsetsDays[i] * DAY_MS;
    const fireAt = new Date(fireAtMs).toISOString();
    const jobId = `seqjob_${params.workflowId}_${tmpl.stepIndex}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const job: WorkflowSequenceJob = {
      id: jobId,
      workflowId: params.workflowId,
      missionId: tmpl.missionId,
      stepIndex: tmpl.stepIndex,
      totalSteps: tmpl.totalSteps,
      sequenceType: tmpl.sequenceType,
      triggerEvent: tmpl.triggerEvent,
      recipient: params.recipient,
      recipientResolved: true,
      emailSubject: tmpl.emailSubject,
      emailPreview: tmpl.emailPreview,
      emailBody: tmpl.emailBody,
      sendTimingHint: tmpl.sendTimingHint,
      fireAt,
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    batch.set(adminDb.collection(collectionPath).doc(jobId), job);
    jobIds.push(jobId);
    fireAts.push(fireAt);
  }

  await batch.commit();

  logger.info('[SequenceScheduler] Instantiated sequence for recipient', {
    workflowId: params.workflowId,
    recipient: params.recipient,
    jobCount: jobIds.length,
    firstFireAt: fireAts[0],
    lastFireAt: fireAts[fireAts.length - 1],
  });

  // Mirror each instantiated job onto the operator's Google Calendar.
  // These are real-recipient jobs, so always sync. Non-fatal on failure.
  for (let i = 0; i < templates.length; i++) {
    const tmpl = templates[i];
    await syncSequenceJobToCalendar({
      jobId: jobIds[i],
      recipient: params.recipient,
      subjectLine: tmpl.emailSubject,
      previewText: tmpl.emailPreview,
      bodyPlain: stripHtmlEnvelope(tmpl.emailBody),
      sequenceName: tmpl.sequenceType,
      campaignId: tmpl.workflowId,
      runAtIso: fireAts[i],
    });
  }

  const emailsForReturn: SequenceEmail[] = sortedEmails;
  void emailsForReturn; // Only used to keep the type tightened in reviews
  return {
    jobIds,
    fireAts,
    firstFireAt: fireAts[0],
    lastFireAt: fireAts[fireAts.length - 1],
  };
}

/**
 * Strip the HTML envelope added by renderEmailBody so a template's body
 * can be re-used without double-wrapping. Safe on plain strings too.
 */
function stripHtmlEnvelope(html: string): string {
  const match = /^<div[^>]*>([\s\S]*)<\/div>$/.exec(html.trim());
  return match ? match[1] : html;
}

/**
 * Idempotent best-effort delete of the calendar event mirroring a
 * sequenceJob. Used when a job is fired (no longer "scheduled"), or
 * when the sequence is cancelled / the recipient unsubscribes. Safe to
 * call when no calendar event exists — logs at debug and returns.
 */
async function removeSequenceJobCalendarEvent(jobId: string): Promise<void> {
  try {
    const { deleteSalesVelocityCalendarEvent } = await import('@/lib/integrations/google-calendar-service');
    await deleteSalesVelocityCalendarEvent(`email-send-${jobId}`);
  } catch (err) {
    logger.warn('[SequenceScheduler] Calendar delete failed (non-fatal)', {
      jobId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Cancel every still-pending sequenceJob for a recipient address (or for
 * a specific workflow + recipient pair) and tear down the corresponding
 * Google Calendar events.
 *
 * Used when:
 *   - The recipient unsubscribes (`/api/public/unsubscribe`).
 *   - An operator pauses or scraps a drip workflow.
 *   - A contact is hard-bounced or marked as "do not contact".
 *
 * Returns the number of jobs cancelled. Non-existent recipient = 0
 * cancellations + no error.
 */
export async function cancelSequenceJobsForRecipient(params: {
  recipient: string;
  workflowId?: string;
}): Promise<{ cancelled: number }> {
  if (!adminDb) {
    throw new Error('Firestore admin not initialized — cannot cancel sequence jobs');
  }

  const collectionPath = getSubCollection(COLLECTION);
  let query = adminDb
    .collection(collectionPath)
    .where('recipient', '==', params.recipient)
    .where('status', '==', 'pending');
  if (typeof params.workflowId === 'string' && params.workflowId.length > 0) {
    query = query.where('workflowId', '==', params.workflowId);
  }

  const snap = await query.get();
  if (snap.empty) {
    return { cancelled: 0 };
  }

  const nowIso = new Date().toISOString();
  const batch = adminDb.batch();
  for (const docSnap of snap.docs) {
    batch.update(docSnap.ref, {
      status: 'cancelled',
      updatedAt: nowIso,
    });
  }
  await batch.commit();

  // Delete each calendar event independently — calendar-side failures
  // must not block or partially-undo the Firestore cancellation.
  for (const docSnap of snap.docs) {
    await removeSequenceJobCalendarEvent(docSnap.id);
  }

  logger.info('[SequenceScheduler] Cancelled sequence jobs for recipient', {
    recipient: params.recipient,
    workflowId: params.workflowId,
    cancelled: snap.size,
  });

  return { cancelled: snap.size };
}

/**
 * Cancel every still-pending sequenceJob owned by a workflow and tear
 * down the corresponding Google Calendar events.
 *
 * Used when an operator pauses or deletes a workflow — its sequenceJobs
 * rows are independent of the workflow's `workflowWaits` rows, so they
 * have to be cancelled explicitly or the drip emails keep firing.
 *
 * Returns the number of jobs cancelled. Workflow with no pending jobs =
 * 0 cancellations + no error. Calendar deletion failures are logged
 * and swallowed individually so a single calendar hiccup never blocks
 * the Firestore cancellation of the remaining jobs.
 */
export async function cancelSequenceJobsForWorkflow(
  workflowId: string,
): Promise<{ cancelled: number }> {
  if (!adminDb) {
    throw new Error('Firestore admin not initialized — cannot cancel sequence jobs');
  }

  try {
    const collectionPath = getSubCollection(COLLECTION);
    const snap = await adminDb
      .collection(collectionPath)
      .where('workflowId', '==', workflowId)
      .where('status', '==', 'pending')
      .get();

    if (snap.empty) {
      return { cancelled: 0 };
    }

    const nowIso = new Date().toISOString();
    const batch = adminDb.batch();
    for (const docSnap of snap.docs) {
      batch.update(docSnap.ref, {
        status: 'cancelled',
        updatedAt: nowIso,
      });
    }
    await batch.commit();

    // Delete each calendar event independently — calendar-side failures
    // must not block or partially-undo the Firestore cancellation.
    const { deleteSalesVelocityCalendarEvent } = await import('@/lib/integrations/google-calendar-service');
    for (const docSnap of snap.docs) {
      try {
        await deleteSalesVelocityCalendarEvent(`email-send-${docSnap.id}`);
      } catch (err) {
        logger.warn('[SequenceScheduler] Calendar delete failed during workflow cancel (non-fatal)', {
          jobId: docSnap.id,
          workflowId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('[SequenceScheduler] Cancelled sequence jobs for workflow', {
      workflowId,
      cancelled: snap.size,
    });

    return { cancelled: snap.size };
  } catch (err) {
    logger.warn('[SequenceScheduler] cancelSequenceJobsForWorkflow failed (non-fatal)', {
      workflowId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { cancelled: 0 };
  }
}

/**
 * Estimate a day-level countdown string for display. Used by the
 * create_workflow tool response so the operator sees "fires in ~3 days"
 * without having to compute it.
 */
export function describeCountdown(fireAtIso: string): string {
  const diffMs = new Date(fireAtIso).getTime() - Date.now();
  if (diffMs <= 0) { return 'now'; }
  if (diffMs < HOUR_MS) {
    const mins = Math.round(diffMs / (60 * 1000));
    return `${mins}m`;
  }
  if (diffMs < DAY_MS) {
    const hrs = Math.round(diffMs / HOUR_MS);
    return `${hrs}h`;
  }
  const days = Math.round(diffMs / DAY_MS);
  return `${days}d`;
}
