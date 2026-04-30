/**
 * Scheduling Specialist — REAL AGENT (April 29 2026)
 *
 * Sits under OPERATIONS_MANAGER. Performs actual meeting CRUD against the
 * existing meetings stack: scheduler-engine.ts (create), the Zoom integration
 * (cancel), and the activity logger (audit trail). The LLM's role is narrow
 * by design — meeting booking is deterministic; only the brand-voiced wording
 * (meeting title and notes/description) goes through the LLM.
 *
 * Standing Rule #1 — Brand DNA is BAKED INTO the GM at seed time. This file
 * has NO `getBrandDNA()` call. It loads its GM via getActiveSpecialistGMByIndustry
 * and uses `gm.systemPrompt` verbatim.
 *
 * Owner-locked behavior rules (encoded both in code AND in the GM prompt):
 *   1. Operator picks the time. `startTime` MUST be a concrete ISO string.
 *      Fuzzy/missing time => FAIL with the clear "operator must specify a time"
 *      message. The specialist NEVER picks a slot.
 *   2. CRM-only attendees. `attendeeRef: { type, id }` MUST resolve to an
 *      existing lead/contact/deal record. Raw name strings are NOT accepted.
 *      Unresolved ref => FAIL.
 *   3. No silent retries, no auto-approve bypass. Failures bubble up as
 *      AgentReport.status === 'FAILED' with an honest error.
 *
 * Supported actions:
 *   - create_meeting     — book a new meeting
 *   - reschedule_meeting — cancel old Zoom + book new slot
 *   - cancel_meeting     — cancel Zoom + mark record cancelled
 *
 * The specialist returns a real AgentReport with `data` containing the meeting
 * record on success, or `errors` on failure. NO template fallback. NO silent
 * shortcuts.
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type {
  AgentMessage,
  AgentReport,
  SpecialistConfig,
  Signal,
} from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import {
  getSubCollection,
  getLeadsCollection,
  getContactsCollection,
  getDealsCollection,
} from '@/lib/firebase/collections';
import {
  scheduleMeeting,
  type ScheduledMeeting,
  type MeetingSchedulerConfig,
  type MeetingProvider,
} from '@/lib/meetings/scheduler-engine';
import { cancelZoomMeeting } from '@/lib/integrations/zoom';
import { getAvailabilityConfig, type DayOfWeek } from '@/lib/meetings/availability-config-service';
import { logMeeting } from '@/lib/crm/activity-logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'operations/scheduling/specialist.ts';
const SPECIALIST_ID = 'SCHEDULING_SPECIALIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['create_meeting', 'reschedule_meeting', 'cancel_meeting'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Default scheduler config id used when the caller does not supply one.
 *
 * scheduleMeeting() reads from `meetingSchedulers/{id}` and requires a doc to
 * exist. Pre-seeding a single tenant-wide default keeps v1 simple — the
 * specialist falls back to creating an in-line default config doc on first
 * use if the doc is missing. When per-team scheduler routing is needed,
 * callers can pass `schedulerConfigId` explicitly via the action payload.
 */
const DEFAULT_SCHEDULER_CONFIG_ID = 'default';

const FALLBACK_LLM_MODEL: ModelName = 'claude-sonnet-4.6';
const FALLBACK_TEMPERATURE = 0.4;
const FALLBACK_MAX_TOKENS = 1500;
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 1500;

interface SchedulingSpecialistGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Scheduling Specialist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'OPERATIONS_MANAGER',
    capabilities: ['create_meeting', 'reschedule_meeting', 'cancel_meeting'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['create_meeting', 'reschedule_meeting', 'cancel_meeting'],
  outputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: FALLBACK_TEMPERATURE,
};

// ============================================================================
// INPUT CONTRACTS
// ============================================================================

const AttendeeRefSchema = z.object({
  type: z.enum(['lead', 'contact', 'deal']),
  id: z.string().min(1),
});

const IsoDateTimeSchema = z.string().refine(
  (v) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) { return false; }
    const d = new Date(v);
    return !Number.isNaN(d.getTime());
  },
  { message: 'must be a valid ISO 8601 date-time string (e.g. 2026-05-01T14:30:00-06:00)' },
);

const CreateMeetingRequestSchema = z.object({
  action: z.literal('create_meeting'),
  startTime: IsoDateTimeSchema,
  durationMinutes: z.number().int().min(15).max(240).default(30),
  attendeeRef: AttendeeRefSchema,
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).optional(),
  meetingProvider: z.enum(['zoom']).default('zoom'),
  schedulerConfigId: z.string().min(1).optional(),
});

const RescheduleMeetingRequestSchema = z.object({
  action: z.literal('reschedule_meeting'),
  meetingId: z.string().min(1),
  newStartTime: IsoDateTimeSchema,
  durationMinutes: z.number().int().min(15).max(240).optional(),
});

const CancelMeetingRequestSchema = z.object({
  action: z.literal('cancel_meeting'),
  meetingId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export type CreateMeetingRequest = z.infer<typeof CreateMeetingRequestSchema>;
export type RescheduleMeetingRequest = z.infer<typeof RescheduleMeetingRequestSchema>;
export type CancelMeetingRequest = z.infer<typeof CancelMeetingRequestSchema>;

// Pre-validation guard: detect missing/fuzzy startTime BEFORE Zod runs so we can
// emit the exact owner-mandated error string. Zod's parser would emit a slightly
// different message and the operator-facing rule is precise here.
function isMissingOrFuzzyTime(value: unknown): boolean {
  if (typeof value !== 'string') { return true; }
  const trimmed = value.trim();
  if (trimmed.length === 0) { return true; }
  // Concrete ISO 8601 starts YYYY-MM-DDTHH:MM. Anything that looks like a date
  // bucket ("tomorrow", "next week", "afternoon", "tuesday at 2") is fuzzy.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) { return true; }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime());
}

// ============================================================================
// LLM CONTEXT (brand-voiced title/description only — actual booking is code)
// ============================================================================

interface LlmCallContext {
  gm: SchedulingSpecialistGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Scheduling Specialist GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-scheduling-specialist-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<SchedulingSpecialistGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Scheduling Specialist GM ${gmRecord.id} has no usable systemPrompt ` +
      `(length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? FALLBACK_MAX_TOKENS;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: SchedulingSpecialistGMConfig = {
    systemPrompt,
    model: config.model ?? FALLBACK_LLM_MODEL,
    temperature: config.temperature ?? FALLBACK_TEMPERATURE,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };
  return { gm, resolvedSystemPrompt: gm.systemPrompt };
}

// ============================================================================
// ATTENDEE RESOLUTION (CRM-only — no raw name strings)
// ============================================================================

interface ResolvedAttendee {
  ref: { type: 'lead' | 'contact' | 'deal'; id: string };
  name: string;
  email: string;
  phone?: string;
  displayCompany?: string;
}

interface LeadOrContactRecord {
  id?: string;
  firstName?: unknown;
  lastName?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  company?: unknown;
  companyName?: unknown;
  contactId?: unknown;
}

interface DealRecord {
  id?: string;
  name?: unknown;
  contactId?: unknown;
  company?: unknown;
  companyName?: unknown;
}

function buildDisplayName(record: LeadOrContactRecord, fallback: string): string {
  if (typeof record.name === 'string' && record.name.trim().length > 0) {
    return record.name.trim();
  }
  const first = typeof record.firstName === 'string' ? record.firstName.trim() : '';
  const last = typeof record.lastName === 'string' ? record.lastName.trim() : '';
  const combined = `${first} ${last}`.trim();
  return combined.length > 0 ? combined : fallback;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') { return undefined; }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function resolveAttendee(
  ref: { type: 'lead' | 'contact' | 'deal'; id: string },
): Promise<ResolvedAttendee> {
  if (ref.type === 'lead') {
    const doc = await AdminFirestoreService.get(getLeadsCollection(), ref.id);
    if (!doc) {
      throw new Error(
        `Attendee resolution failed: lead with id=${ref.id} does not exist in CRM. ` +
        `The Scheduling Specialist refuses to book against a non-existent lead — ` +
        `Jasper should create or link the lead before scheduling.`,
      );
    }
    const record = doc as LeadOrContactRecord;
    const email = readString(record.email);
    if (!email) {
      throw new Error(
        `Attendee resolution failed: lead ${ref.id} has no email address. ` +
        `A meeting cannot be booked without an attendee email.`,
      );
    }
    return {
      ref,
      name: buildDisplayName(record, email),
      email,
      ...(readString(record.phone) ? { phone: readString(record.phone) as string } : {}),
      ...(readString(record.company) ?? readString(record.companyName)
        ? { displayCompany: readString(record.company) ?? readString(record.companyName) }
        : {}),
    };
  }

  if (ref.type === 'contact') {
    const doc = await AdminFirestoreService.get(getContactsCollection(), ref.id);
    if (!doc) {
      throw new Error(
        `Attendee resolution failed: contact with id=${ref.id} does not exist in CRM.`,
      );
    }
    const record = doc as LeadOrContactRecord;
    const email = readString(record.email);
    if (!email) {
      throw new Error(
        `Attendee resolution failed: contact ${ref.id} has no email address.`,
      );
    }
    return {
      ref,
      name: buildDisplayName(record, email),
      email,
      ...(readString(record.phone) ? { phone: readString(record.phone) as string } : {}),
      ...(readString(record.company) ?? readString(record.companyName)
        ? { displayCompany: readString(record.company) ?? readString(record.companyName) }
        : {}),
    };
  }

  // deal — resolve via the linked contact (deals don't carry email directly)
  const dealDoc = await AdminFirestoreService.get(getDealsCollection(), ref.id);
  if (!dealDoc) {
    throw new Error(
      `Attendee resolution failed: deal with id=${ref.id} does not exist in CRM.`,
    );
  }
  const dealRecord = dealDoc as DealRecord;
  const contactId = readString(dealRecord.contactId);
  if (!contactId) {
    throw new Error(
      `Attendee resolution failed: deal ${ref.id} has no contactId — ` +
      `link the deal to a contact before scheduling.`,
    );
  }
  const contactDoc = await AdminFirestoreService.get(getContactsCollection(), contactId);
  if (!contactDoc) {
    throw new Error(
      `Attendee resolution failed: deal ${ref.id} references contact ${contactId} ` +
      `which does not exist in CRM.`,
    );
  }
  const contactRecord = contactDoc as LeadOrContactRecord;
  const email = readString(contactRecord.email);
  if (!email) {
    throw new Error(
      `Attendee resolution failed: deal ${ref.id} → contact ${contactId} has no email address.`,
    );
  }
  const company =
    readString(dealRecord.company) ??
    readString(dealRecord.companyName) ??
    readString(contactRecord.company) ??
    readString(contactRecord.companyName);
  return {
    ref,
    name: buildDisplayName(contactRecord, email),
    email,
    ...(readString(contactRecord.phone) ? { phone: readString(contactRecord.phone) as string } : {}),
    ...(company ? { displayCompany: company } : {}),
  };
}

// ============================================================================
// AVAILABILITY VALIDATION
// ============================================================================

const JS_DAY_TO_CONFIG_KEY: Record<number, DayOfWeek> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((p) => parseInt(p, 10));
  return h * 60 + m;
}

async function validateSlotWithinAvailability(
  startTime: Date,
  durationMinutes: number,
): Promise<void> {
  const availability = await getAvailabilityConfig();
  const dayKey = JS_DAY_TO_CONFIG_KEY[startTime.getDay()];
  const dayHours = availability.workingHours[dayKey];
  if (!dayHours.enabled) {
    throw new Error(
      `Slot ${startTime.toISOString()} falls on ${dayKey}, which is not an available ` +
      `working day per /settings/booking. Operator must pick a different day.`,
    );
  }
  const slotStartMin = startTime.getHours() * 60 + startTime.getMinutes();
  const slotEndMin = slotStartMin + durationMinutes;
  const dayStartMin = timeToMinutes(dayHours.start);
  const dayEndMin = timeToMinutes(dayHours.end);
  if (slotStartMin < dayStartMin || slotEndMin > dayEndMin) {
    throw new Error(
      `Slot ${startTime.toISOString()} (${durationMinutes} min) falls outside ` +
      `the operator's ${dayKey} working hours ${dayHours.start}-${dayHours.end}. ` +
      `Operator must pick a different time.`,
    );
  }
}

// ============================================================================
// DOUBLE-BOOKING CHECK
// ============================================================================

interface MeetingRecordSlim {
  id?: string;
  startTime?: unknown;
  endTime?: unknown;
  status?: unknown;
  schedulerConfigId?: unknown;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) { return value; }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value && typeof value === 'object' && 'toDate' in (value as Record<string, unknown>)) {
    const conv = (value as { toDate: () => Date }).toDate;
    if (typeof conv === 'function') {
      const d = conv.call(value);
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
  }
  return null;
}

async function assertNoDoubleBooking(
  startTime: Date,
  durationMinutes: number,
  excludeMeetingId?: string,
): Promise<void> {
  const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
  const meetingsPath = getSubCollection('meetings');
  const all = (await AdminFirestoreService.getAll(meetingsPath, [])) as MeetingRecordSlim[];

  for (const m of all) {
    if (excludeMeetingId && m.id === excludeMeetingId) { continue; }
    const status = typeof m.status === 'string' ? m.status : '';
    if (status === 'cancelled') { continue; }
    const mStart = toDate(m.startTime);
    const mEnd = toDate(m.endTime);
    if (!mStart || !mEnd) { continue; }
    const overlaps =
      (startTime >= mStart && startTime < mEnd) ||
      (endTime > mStart && endTime <= mEnd) ||
      (startTime <= mStart && endTime >= mEnd);
    if (overlaps) {
      throw new Error(
        `Slot ${startTime.toISOString()} conflicts with existing meeting ${m.id ?? '(unknown)'} ` +
        `(${mStart.toISOString()} - ${mEnd.toISOString()}). Operator must pick a different time.`,
      );
    }
  }
}

// ============================================================================
// SCHEDULER CONFIG PROVISIONING
// ============================================================================

const DEFAULT_WORKING_HOURS: MeetingSchedulerConfig['workingHours'] = {
  monday:    { enabled: true,  start: '09:00', end: '17:00' },
  tuesday:   { enabled: true,  start: '09:00', end: '17:00' },
  wednesday: { enabled: true,  start: '09:00', end: '17:00' },
  thursday:  { enabled: true,  start: '09:00', end: '17:00' },
  friday:    { enabled: true,  start: '09:00', end: '17:00' },
  saturday:  { enabled: false, start: '09:00', end: '17:00' },
  sunday:    { enabled: false, start: '09:00', end: '17:00' },
};

async function ensureSchedulerConfig(
  schedulerConfigId: string,
  durationMinutes: number,
): Promise<void> {
  const path = getSubCollection('meetingSchedulers');
  const existing = await AdminFirestoreService.get(path, schedulerConfigId);
  if (existing) { return; }

  const minimal: MeetingSchedulerConfig = {
    id: schedulerConfigId,
    name: 'Default Scheduler',
    duration: durationMinutes,
    bufferBefore: 0,
    bufferAfter: 0,
    assignmentType: 'manual',
    assignedUsers: ['operator'],
    autoCreateZoom: true,
    sendReminders: true,
    reminderTimes: [24, 1],
    workingHours: DEFAULT_WORKING_HOURS,
  };
  await AdminFirestoreService.set(path, schedulerConfigId, minimal as unknown as Record<string, unknown>);
  logger.info('[SchedulingSpecialist] Provisioned minimal default scheduler config', {
    schedulerConfigId,
    file: FILE,
  });
}

// ============================================================================
// LLM-GENERATED TITLE + DESCRIPTION (the ONLY LLM call this specialist makes)
// ============================================================================

const LlmCopyResultSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(1500),
});

type LlmCopyResult = z.infer<typeof LlmCopyResultSchema>;

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (match) => (match.includes('```') ? '' : match))
    .replace(/\n?\s*```[\s\S]*$/i, '')
    .trim();
}

function buildCopyPrompt(input: {
  attendee: ResolvedAttendee;
  startTime: Date;
  durationMinutes: number;
  notes?: string;
  titleHint?: string;
}): string {
  return [
    'ACTION: produce_meeting_copy',
    '',
    'Produce a meeting title and a calendar description for the following booking.',
    'You are NOT picking the time, NOT picking the attendee, NOT validating availability —',
    'all of that is already done. Your sole job is brand-voiced wording.',
    '',
    `Attendee name: ${input.attendee.name}`,
    `Attendee email: ${input.attendee.email}`,
    `Attendee CRM type: ${input.attendee.ref.type}`,
    input.attendee.displayCompany ? `Company: ${input.attendee.displayCompany}` : '',
    `Start time (ISO): ${input.startTime.toISOString()}`,
    `Duration: ${input.durationMinutes} minutes`,
    input.titleHint ? `Operator title hint: ${input.titleHint}` : '',
    input.notes ? `Operator notes (carry through if useful): ${input.notes}` : '',
    '',
    'Respond with ONLY a valid JSON object, no markdown fences, no preamble:',
    '',
    '{',
    '  "title": "<concise meeting title, 3-200 chars, brand voice>",',
    '  "description": "<calendar event description, 10-1500 chars, brand voice, includes attendee context if helpful>"',
    '}',
    '',
    'Hard rules:',
    '- Title is a one-liner. No emojis unless the Brand DNA explicitly endorses them.',
    '- Description is plain prose. Mention attendee name and company once. Carry forward operator notes if present.',
    '- Do NOT use any phrase from the avoid list in the Brand DNA.',
    '- Do NOT fabricate agenda items the operator did not provide.',
    '- Do NOT include the literal time/date in the title — the calendar surfaces that separately.',
  ].filter((line) => line.length > 0).join('\n');
}

async function generateMeetingCopy(
  ctx: LlmCallContext,
  input: {
    attendee: ResolvedAttendee;
    startTime: Date;
    durationMinutes: number;
    notes?: string;
    titleHint?: string;
  },
): Promise<LlmCopyResult> {
  const provider = new OpenRouterProvider(PLATFORM_ID);
  const userPrompt = buildCopyPrompt(input);
  const response = await provider.chat({
    model: ctx.gm.model,
    messages: [
      { role: 'system', content: ctx.resolvedSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: ctx.gm.temperature,
    maxTokens: ctx.gm.maxTokens,
  });

  if (response.finishReason === 'length') {
    throw new Error(
      `Scheduling Specialist: LLM copy response truncated at maxTokens=${ctx.gm.maxTokens}.`,
    );
  }

  const raw = response.content ?? '';
  if (raw.trim().length === 0) {
    throw new Error('OpenRouter returned empty response for meeting copy generation');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(raw));
  } catch {
    throw new Error(
      `Scheduling Specialist meeting copy was not valid JSON: ${raw.slice(0, 200)}`,
    );
  }

  const validated = LlmCopyResultSchema.safeParse(parsed);
  if (!validated.success) {
    const issueSummary = validated.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Scheduling Specialist meeting copy did not match schema: ${issueSummary}`);
  }

  return validated.data;
}

// ============================================================================
// ACTION: create_meeting
// ============================================================================

async function executeCreateMeeting(
  req: CreateMeetingRequest,
  ctx: LlmCallContext,
): Promise<ScheduledMeeting> {
  const startTime = new Date(req.startTime);
  const durationMinutes = req.durationMinutes;

  // 1. Resolve the attendee from CRM (no raw names allowed).
  const attendee = await resolveAttendee(req.attendeeRef);

  // 2. Validate the slot falls inside the operator's available hours.
  await validateSlotWithinAvailability(startTime, durationMinutes);

  // 3. Validate no double-booking.
  await assertNoDoubleBooking(startTime, durationMinutes);

  // 4. Ensure scheduler config exists (provision a minimal default if absent).
  const schedulerConfigId = req.schedulerConfigId ?? DEFAULT_SCHEDULER_CONFIG_ID;
  await ensureSchedulerConfig(schedulerConfigId, durationMinutes);

  // 5. Generate brand-voiced title + description via the LLM. This is the ONLY
  //    LLM call this specialist makes — the rest is deterministic.
  const copy = await generateMeetingCopy(ctx, {
    attendee,
    startTime,
    durationMinutes,
    ...(req.notes !== undefined ? { notes: req.notes } : {}),
    ...(req.title !== undefined ? { titleHint: req.title } : {}),
  });

  // 6. Hand off to the existing scheduler engine — it handles Zoom creation,
  //    persistence, reminders, and CRM activity logging.
  const meeting = await scheduleMeeting({
    schedulerConfigId,
    title: req.title ?? copy.title,
    startTime,
    attendees: [
      {
        name: attendee.name,
        email: attendee.email,
        ...(attendee.phone ? { phone: attendee.phone } : {}),
      },
    ],
    notes: req.notes ?? copy.description,
    relatedEntityType: req.attendeeRef.type,
    relatedEntityId: req.attendeeRef.id,
  });

  return meeting;
}

// ============================================================================
// ACTION: reschedule_meeting
// ============================================================================

async function executeRescheduleMeeting(
  req: RescheduleMeetingRequest,
  ctx: LlmCallContext,
): Promise<ScheduledMeeting> {
  const meetingsPath = getSubCollection('meetings');
  const existing = await AdminFirestoreService.get(meetingsPath, req.meetingId);
  if (!existing) {
    throw new Error(
      `Reschedule failed: meeting ${req.meetingId} does not exist.`,
    );
  }

  const existingMeeting = existing as unknown as ScheduledMeeting & {
    zoomMeetingId?: string;
    relatedEntityType?: 'lead' | 'contact' | 'deal';
    relatedEntityId?: string;
  };

  const newStartTime = new Date(req.newStartTime);
  const durationMinutes =
    req.durationMinutes ??
    (typeof existingMeeting.duration === 'number' ? existingMeeting.duration : 30);

  await validateSlotWithinAvailability(newStartTime, durationMinutes);
  await assertNoDoubleBooking(newStartTime, durationMinutes, req.meetingId);

  // Cancel the old Zoom (best-effort — don't block the reschedule on Zoom errors)
  if (existingMeeting.zoomMeetingId) {
    try {
      await cancelZoomMeeting(existingMeeting.zoomMeetingId);
    } catch (zoomError) {
      logger.warn('[SchedulingSpecialist] Failed to cancel old Zoom meeting during reschedule', {
        meetingId: req.meetingId,
        zoomMeetingId: existingMeeting.zoomMeetingId,
        error: zoomError instanceof Error ? zoomError.message : String(zoomError),
        file: FILE,
      });
    }
  }

  // Mark old record cancelled (preserve audit trail rather than overwriting).
  await AdminFirestoreService.update(meetingsPath, req.meetingId, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    cancelReason: `rescheduled to ${req.newStartTime}`,
    updatedAt: new Date(),
  });

  // Resolve attendee from the original meeting's CRM ref so we don't accept a
  // new attendee at reschedule time.
  if (!existingMeeting.relatedEntityType || !existingMeeting.relatedEntityId) {
    throw new Error(
      `Reschedule failed: meeting ${req.meetingId} is missing relatedEntityType / ` +
      `relatedEntityId, so the CRM attendee cannot be resolved. Cancel and book ` +
      `a new meeting instead.`,
    );
  }
  const attendee = await resolveAttendee({
    type: existingMeeting.relatedEntityType,
    id: existingMeeting.relatedEntityId,
  });

  // Generate fresh brand-voiced copy for the new time.
  const copy = await generateMeetingCopy(ctx, {
    attendee,
    startTime: newStartTime,
    durationMinutes,
    ...(typeof existingMeeting.notes === 'string' ? { notes: existingMeeting.notes } : {}),
    ...(typeof existingMeeting.title === 'string' ? { titleHint: existingMeeting.title } : {}),
  });

  const newMeeting = await scheduleMeeting({
    schedulerConfigId: existingMeeting.schedulerConfigId,
    title: copy.title,
    startTime: newStartTime,
    attendees: [
      {
        name: attendee.name,
        email: attendee.email,
        ...(attendee.phone ? { phone: attendee.phone } : {}),
      },
    ],
    notes: copy.description,
    relatedEntityType: existingMeeting.relatedEntityType,
    relatedEntityId: existingMeeting.relatedEntityId,
  });

  return newMeeting;
}

// ============================================================================
// ACTION: cancel_meeting
// ============================================================================

interface CancelMeetingResult {
  meetingId: string;
  cancelledAt: string;
  reason?: string;
  zoomCancelled: boolean;
  zoomCancelError?: string;
}

async function executeCancelMeeting(
  req: CancelMeetingRequest,
): Promise<CancelMeetingResult> {
  const meetingsPath = getSubCollection('meetings');
  const existing = await AdminFirestoreService.get(meetingsPath, req.meetingId);
  if (!existing) {
    throw new Error(`Cancel failed: meeting ${req.meetingId} does not exist.`);
  }

  const existingMeeting = existing as unknown as ScheduledMeeting & {
    zoomMeetingId?: string;
    relatedEntityType?: 'lead' | 'contact' | 'deal';
    relatedEntityId?: string;
  };

  let zoomCancelled = false;
  let zoomCancelError: string | undefined;
  if (existingMeeting.zoomMeetingId) {
    try {
      await cancelZoomMeeting(existingMeeting.zoomMeetingId);
      zoomCancelled = true;
    } catch (err) {
      zoomCancelError = err instanceof Error ? err.message : String(err);
      logger.warn('[SchedulingSpecialist] Failed to cancel Zoom meeting', {
        meetingId: req.meetingId,
        zoomMeetingId: existingMeeting.zoomMeetingId,
        error: zoomCancelError,
        file: FILE,
      });
    }
  }

  const cancelledAt = new Date().toISOString();
  await AdminFirestoreService.update(meetingsPath, req.meetingId, {
    status: 'cancelled',
    cancelledAt,
    ...(req.reason ? { cancelReason: req.reason } : {}),
    updatedAt: new Date(),
  });

  // Activity log entry — best-effort, don't fail the cancel on logger errors.
  if (existingMeeting.relatedEntityType && existingMeeting.relatedEntityId) {
    try {
      await logMeeting({
        relatedEntityType: existingMeeting.relatedEntityType,
        relatedEntityId: existingMeeting.relatedEntityId,
        meetingType: 'no_show',
        subject: `Cancelled: ${existingMeeting.title ?? 'meeting'}`,
        ...(typeof existingMeeting.duration === 'number' ? { duration: existingMeeting.duration } : {}),
        notes: req.reason ?? 'Cancelled via Scheduling Specialist',
      });
    } catch (logErr) {
      logger.warn('[SchedulingSpecialist] Failed to log cancellation activity', {
        meetingId: req.meetingId,
        error: logErr instanceof Error ? logErr.message : String(logErr),
        file: FILE,
      });
    }
  }

  return {
    meetingId: req.meetingId,
    cancelledAt,
    ...(req.reason ? { reason: req.reason } : {}),
    zoomCancelled,
    ...(zoomCancelError ? { zoomCancelError } : {}),
  };
}

// ============================================================================
// SCHEDULING SPECIALIST CLASS
// ============================================================================

export class SchedulingSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Scheduling Specialist initialized (LLM-backed for copy, deterministic for booking)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, [
          'Scheduling Specialist: payload must be an object',
        ]);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, [
          'Scheduling Specialist: no action specified in payload',
        ]);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Scheduling Specialist does not support action '${rawAction}'. ` +
          `Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[SchedulingSpecialist] Executing action=${action} taskId=${taskId}`, { file: FILE });

      if (action === 'create_meeting') {
        // OWNER-MANDATED PRE-CHECK: emit the exact "operator must specify a time"
        // message before Zod runs so the operator sees the rule, not a parse error.
        if (isMissingOrFuzzyTime(payload.startTime)) {
          return this.createReport(taskId, 'FAILED', null, [
            'operator must specify a time — Jasper should reply with available slots before delegating.',
          ]);
        }
        const parsed = CreateMeetingRequestSchema.safeParse({ ...payload, action });
        if (!parsed.success) {
          const issueSummary = parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Scheduling Specialist create_meeting: invalid input: ${issueSummary}`,
          ]);
        }
        const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
        const data = await executeCreateMeeting(parsed.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      if (action === 'reschedule_meeting') {
        if (isMissingOrFuzzyTime(payload.newStartTime)) {
          return this.createReport(taskId, 'FAILED', null, [
            'operator must specify a time — Jasper should reply with available slots before delegating.',
          ]);
        }
        const parsed = RescheduleMeetingRequestSchema.safeParse({ ...payload, action });
        if (!parsed.success) {
          const issueSummary = parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Scheduling Specialist reschedule_meeting: invalid input: ${issueSummary}`,
          ]);
        }
        const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
        const data = await executeRescheduleMeeting(parsed.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      // cancel_meeting — no LLM needed; deterministic cancellation only.
      const parsed = CancelMeetingRequestSchema.safeParse({ ...payload, action });
      if (!parsed.success) {
        const issueSummary = parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Scheduling Specialist cancel_meeting: invalid input: ${issueSummary}`,
        ]);
      }
      const data = await executeCancelMeeting(parsed.data);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[SchedulingSpecialist] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;
    if (signal.payload.type === 'COMMAND') {
      return this.execute(signal.payload);
    }
    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 520, boilerplate: 60 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createSchedulingSpecialist(): SchedulingSpecialist {
  return new SchedulingSpecialist();
}

let instance: SchedulingSpecialist | null = null;

export function getSchedulingSpecialist(): SchedulingSpecialist {
  instance ??= createSchedulingSpecialist();
  return instance;
}

// ============================================================================
// INTERNAL TEST HELPERS
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  DEFAULT_SCHEDULER_CONFIG_ID,
  CreateMeetingRequestSchema,
  RescheduleMeetingRequestSchema,
  CancelMeetingRequestSchema,
  LlmCopyResultSchema,
  isMissingOrFuzzyTime,
  loadGMConfig,
  resolveAttendee,
  validateSlotWithinAvailability,
  assertNoDoubleBooking,
  ensureSchedulerConfig,
  buildCopyPrompt,
  stripJsonFences,
};

// Touch unused import explicitly so the linter doesn't flag the type-only
// MeetingProvider import (kept for downstream readers documenting intent).
export type { MeetingProvider };
