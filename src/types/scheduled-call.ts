/**
 * Scheduled Call Types
 *
 * Represents a future-time outbound voice call scheduled via Jasper or
 * the operator UI. Stored in Firestore at `scheduledCalls`. The
 * `/api/cron/run-scheduled-calls` cron polls every minute, finds docs
 * with `status === 'scheduled' AND scheduledFor <= now`, fires the call
 * via Twilio, and flips status to `'fired'` / `'failed'`.
 *
 * Every scheduled call is also mirrored to the connected Google
 * Calendar (`SalesVelocity.ai` calendar, voice category, red color)
 * so operators see scheduled outbound calls alongside meetings + social
 * posts + email sends. The calendar event refId convention is
 * `voice-call-{scheduleId}`.
 */

import { z } from 'zod';

export const SCHEDULED_CALL_STATUSES = [
  'scheduled',
  'firing',
  'fired',
  'failed',
  'cancelled',
] as const;

export type ScheduledCallStatus = typeof SCHEDULED_CALL_STATUSES[number];

export interface ScheduledCall {
  /** Document id — duplicated into the doc body so list reads have it. */
  id: string;
  /** Recipient phone number in E.164 format (e.g. "+15551234567"). */
  to: string;
  /** Optional friendly display name for UI / calendar event title. */
  recipientName?: string;
  /** Optional CRM contact id to link the eventual call record to. */
  contactId?: string;
  /** Optional CRM lead id to link the eventual call record to. */
  leadId?: string;
  /** Free-text description of WHY we're calling. Surfaces to the AI voice agent context. */
  goal: string;
  /** ISO-8601 timestamp when the call should fire. */
  scheduledFor: string;
  status: ScheduledCallStatus;
  /** ISO-8601 timestamp when the schedule doc was created. */
  createdAt: string;
  /** uid of the operator (or `synthetic_*` / `jasper`) who scheduled this. */
  createdBy: string;
  /** Reason if cancelled. Operator-facing audit trail. */
  cancelReason?: string;
  /** ISO-8601 timestamp when the cron actually placed the Twilio call. */
  firedAt?: string;
  /** Twilio Call SID returned when the cron placed the call. */
  callSid?: string;
  /** The id of the `calls/{callId}` doc the cron created when firing. */
  firedFromScheduleId?: string;
  /** Set on failure — last error message from Twilio / TCPA / time check. */
  lastError?: string;
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

export const scheduleCallRequestSchema = z.object({
  to: z.string().min(1, 'Phone number is required'),
  recipientName: z.string().optional(),
  contactId: z.string().optional(),
  leadId: z.string().optional(),
  goal: z.string().min(1, 'Goal is required').max(2000, 'Goal exceeds maximum length (2000 characters)'),
  scheduledFor: z.string().datetime({ message: 'scheduledFor must be an ISO-8601 datetime' }),
});

export type ScheduleCallRequest = z.infer<typeof scheduleCallRequestSchema>;

export const updateScheduledCallSchema = z.object({
  scheduledFor: z.string().datetime({ message: 'scheduledFor must be an ISO-8601 datetime' }).optional(),
  goal: z.string().min(1).max(2000).optional(),
  recipientName: z.string().optional(),
  to: z.string().min(1).optional(),
});

export type UpdateScheduledCallRequest = z.infer<typeof updateScheduledCallSchema>;
