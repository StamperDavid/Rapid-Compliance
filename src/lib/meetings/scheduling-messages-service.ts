/**
 * Scheduling Messages Service
 *
 * Holds the editable copy for every operator-facing scheduling touchpoint:
 *   - The /early-access success page strings
 *   - The booking confirmation email (subject + HTML body)
 *   - The Zoom meeting topic + agenda
 *   - The 24h and 1h reminder emails
 *
 * Each call site can change without code changes — operator edits the
 * copy in /settings/scheduling-messages and the next event uses the
 * updated text. When the doc doesn't exist (fresh deployment, never
 * edited), the helpers return the hardcoded `DEFAULT_MESSAGES` so the
 * existing flows continue to behave identically to before.
 *
 * Doc path: `organizations/{PLATFORM_ID}/settings/schedulingMessages`
 *
 * Template variables supported in any field via `{name}` syntax:
 *   - {firstName}    — attendee's given name
 *   - {fullName}     — attendee's full name
 *   - {meetingDate}  — formatted date, e.g. "Tuesday, Nov 4"
 *   - {meetingTime}  — formatted time, e.g. "2:00 PM"
 *   - {duration}     — minutes, e.g. "30"
 *   - {zoomLink}     — Zoom join URL (empty string if not present)
 *   - {orgName}      — operator's brand name
 *   - {operatorName} — operator display name (best-effort)
 */

import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

const SETTINGS_COLLECTION = (): string => `organizations/${PLATFORM_ID}/settings`;
const DOC_ID = 'schedulingMessages';

export interface SchedulingMessages {
  earlyAccessSuccessTitle: string;
  earlyAccessSuccessBody: string;
  demoConfirmationEmailSubject: string;
  demoConfirmationEmailBody: string;
  zoomMeetingTopic: string;
  zoomMeetingAgenda: string;
  reminder24hSubject: string;
  reminder24hBody: string;
  reminder1hSubject: string;
  reminder1hBody: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_MESSAGES: SchedulingMessages = {
  earlyAccessSuccessTitle: "You're on the list.",
  earlyAccessSuccessBody: "We'll email you the moment SalesVelocity.ai is ready for you.",
  demoConfirmationEmailSubject: 'Booking Confirmed — {meetingDate} at {meetingTime}',
  demoConfirmationEmailBody:
    '<h2>Your booking is confirmed</h2>' +
    '<p>Hi {firstName},</p>' +
    '<p>Your meeting has been scheduled for <strong>{meetingDate}</strong> at <strong>{meetingTime}</strong> ({duration} minutes).</p>' +
    '<p><strong>Join the meeting:</strong> <a href="{zoomLink}">{zoomLink}</a></p>' +
    '<p>We look forward to speaking with you!</p>',
  zoomMeetingTopic: 'Meeting with {fullName}',
  zoomMeetingAgenda: 'Booked via {orgName}',
  reminder24hSubject: 'Reminder: meeting tomorrow at {meetingTime}',
  reminder24hBody:
    'Hi {firstName},\n\nThis is a friendly reminder that we have a meeting scheduled for tomorrow at {meetingTime}.\n\nJoin via Zoom: {zoomLink}\n\nSee you then!',
  reminder1hSubject: 'Reminder: meeting in 1 hour',
  reminder1hBody:
    'Hi {firstName},\n\nQuick reminder — our meeting starts in about an hour ({meetingTime}).\n\nJoin via Zoom: {zoomLink}\n\nSee you soon!',
};

type EditableField = keyof Omit<SchedulingMessages, 'updatedAt' | 'updatedBy'>;

const FIELDS: EditableField[] = [
  'earlyAccessSuccessTitle',
  'earlyAccessSuccessBody',
  'demoConfirmationEmailSubject',
  'demoConfirmationEmailBody',
  'zoomMeetingTopic',
  'zoomMeetingAgenda',
  'reminder24hSubject',
  'reminder24hBody',
  'reminder1hSubject',
  'reminder1hBody',
];

function normalize(raw: Record<string, unknown> | null | undefined): SchedulingMessages {
  if (!raw) { return DEFAULT_MESSAGES; }
  const out = { ...DEFAULT_MESSAGES };
  for (const field of FIELDS) {
    const value = raw[field];
    if (typeof value === 'string' && value.length > 0) {
      out[field] = value;
    }
  }
  if (typeof raw.updatedAt === 'string') { out.updatedAt = raw.updatedAt; }
  if (typeof raw.updatedBy === 'string') { out.updatedBy = raw.updatedBy; }
  return out;
}

/**
 * Read the current scheduling messages config. Returns DEFAULT_MESSAGES if
 * the doc does not exist or any individual field is missing — partial
 * customization is supported.
 */
export async function getSchedulingMessages(): Promise<SchedulingMessages> {
  if (!adminDb) {
    logger.warn('[scheduling-messages] adminDb not available — returning defaults');
    return DEFAULT_MESSAGES;
  }
  try {
    const snap = await adminDb.collection(SETTINGS_COLLECTION()).doc(DOC_ID).get();
    if (!snap.exists) { return DEFAULT_MESSAGES; }
    return normalize(snap.data() as Record<string, unknown>);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[scheduling-messages] getSchedulingMessages failed — returning defaults',
      err instanceof Error ? err : new Error(msg),
    );
    return DEFAULT_MESSAGES;
  }
}

export interface SetSchedulingMessagesInput extends Partial<Omit<SchedulingMessages, 'updatedAt' | 'updatedBy'>> {
  actorUid: string;
}

export async function setSchedulingMessages(input: SetSchedulingMessagesInput): Promise<boolean> {
  if (!adminDb) { return false; }
  try {
    const ref = adminDb.collection(SETTINGS_COLLECTION()).doc(DOC_ID);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: input.actorUid,
    };
    for (const field of FIELDS) {
      const value = input[field];
      if (typeof value === 'string') {
        patch[field] = value;
      }
    }
    await ref.set(patch, { merge: true });
    logger.info('[scheduling-messages] messages updated', {
      actorUid: input.actorUid,
      fieldsTouched: Object.keys(patch).filter((k) => k !== 'updatedAt' && k !== 'updatedBy'),
    });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[scheduling-messages] setSchedulingMessages failed',
      err instanceof Error ? err : new Error(msg),
    );
    return false;
  }
}

/**
 * Substitute `{varName}` placeholders in a template string. Missing vars
 * resolve to empty string — never throws on missing keys, since templates
 * may legitimately use a subset of the available variables.
 */
export function renderTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === null || value === undefined) { return ''; }
    return String(value);
  });
}

/**
 * Convenience: format the standard scheduling-context variables from a
 * meeting record so call sites don't repeat the toLocaleDateString /
 * toLocaleTimeString boilerplate.
 */
export function buildMeetingTemplateVars(args: {
  attendeeName: string;
  startTime: Date | string;
  durationMinutes: number;
  zoomJoinUrl?: string | null;
  orgName?: string;
  operatorName?: string;
}): Record<string, string> {
  const start = typeof args.startTime === 'string' ? new Date(args.startTime) : args.startTime;
  const firstName = args.attendeeName.split(/\s+/)[0] ?? args.attendeeName;
  return {
    firstName,
    fullName: args.attendeeName,
    meetingDate: start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
    meetingTime: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    duration: String(args.durationMinutes),
    zoomLink: args.zoomJoinUrl ?? '',
    orgName: args.orgName ?? 'SalesVelocity.ai',
    operatorName: args.operatorName ?? '',
  };
}
