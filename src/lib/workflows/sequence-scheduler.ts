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

  return {
    jobIds,
    fireAts,
    firstFireAt: fireAts[0],
    lastFireAt: fireAts[fireAts.length - 1],
  };
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
        fired++;
      } else {
        await docSnap.ref.update({
          status: 'failed',
          error: result.error ?? 'sendEmail returned success=false without error',
          updatedAt: updateIso,
        });
        failed++;
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await docSnap.ref.update({
        status: 'failed',
        error: errMsg,
        updatedAt: updateIso,
      });
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
