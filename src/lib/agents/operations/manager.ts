/**
 * Operations Manager (L2 Orchestrator)
 * STATUS: FUNCTIONAL
 *
 * The Operations department owns the operator's calendar accuracy and
 * conflict-free scheduling. This manager sits between Jasper and the
 * SCHEDULING_SPECIALIST and is the only path by which a meeting may be
 * created, rescheduled, or cancelled.
 *
 * STANDING RULE #1 (CLAUDE.md): the manager has NO `getBrandDNA()` call
 * and NO `buildResolvedSystemPrompt` helper. Brand DNA is baked into the
 * Manager Golden Master at seed time via `scripts/lib/brand-dna-helper.js`
 * and consumed by `BaseManager.reviewOutput()` verbatim from Firestore.
 *
 * STANDING RULE #2 (CLAUDE.md): this is a NEW manager. Initial GM seeding
 * is allowed via `scripts/seed-operations-manager-gm.js`. After seed, the
 * GM can ONLY change via the grade → Prompt Engineer → human approval
 * pipeline. Nothing in this file edits its own GM.
 *
 * ARG VALIDATION (hard-line, by design):
 * - Required fields: `startTime` (ISO), `attendeeRef.{type,id}`.
 * - Default `durationMinutes`: 30 (matches AvailabilityConfig default).
 * - Raw attendee names like "John Smith" are REJECTED. Resolving a name to
 *   a CRM record is Jasper's job; by the time the request lands here it
 *   must reference an existing lead/contact/deal id. If the id is missing,
 *   the manager returns FAILED with "missing X" — it does not guess and
 *   it does not auto-pick a default attendee.
 *
 * @module agents/operations/manager
 */

import { BaseManager } from '../base-manager';
import { BaseSpecialist } from '../base-specialist';
import type {
  AgentMessage,
  AgentReport,
  ManagerConfig,
  Signal,
} from '../types';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// SYSTEM PROMPT — Operator-Calendar Integrity
// ============================================================================
//
// Note: this is the L2 manager's runtime SYSTEM_PROMPT used by the legacy
// `tools`/`outputSchema` declarative config. The REVIEW prompt that grades
// SCHEDULING_SPECIALIST output lives in the Manager Golden Master in
// Firestore (seeded by `scripts/seed-operations-manager-gm.js`) and is
// consumed by BaseManager.reviewOutput() — not from this constant.

const SYSTEM_PROMPT = `You are the Operations Manager, an L2 orchestrator for scheduling and calendar work.

## YOUR ROLE
You own the operator's calendar accuracy. You coordinate the SCHEDULING_SPECIALIST to create,
reschedule, and cancel meetings against real CRM records. You never invent times, never guess
attendees, and never accept fuzzy inputs from upstream callers.

SPECIALISTS YOU ORCHESTRATE:
- SCHEDULING_SPECIALIST: Books meetings against the operator's availability config and the
  existing meeting schedule. Validates attendee references against CRM records. Produces
  calendar entries with concrete startTime + durationMinutes.

## INTENTS YOU HANDLE
- CREATE_MEETING: Book a new meeting at a specified startTime for a specified attendee.
- RESCHEDULE_MEETING: Move an existing meeting to a new startTime.
- CANCEL_MEETING: Remove an existing meeting.

## HARD INPUT RULES
1. Every CREATE_MEETING request MUST include a concrete ISO startTime, a numeric durationMinutes
   (default 30 if absent), and an attendeeRef of {type, id} where type is 'lead' | 'contact' | 'deal'.
2. If startTime is fuzzy ("Tuesday afternoon", "next week") the request is REJECTED at the
   manager. The specialist must NEVER be asked to guess.
3. If attendeeRef is missing or only contains a name, the request is REJECTED. Resolving a name
   to a CRM id is Jasper's responsibility before delegation.
4. Slot must fall inside the operator's working hours (read AvailabilityConfig).
5. Slot must not overlap an existing meeting on the calendar.

## OUTPUT
You delegate to SCHEDULING_SPECIALIST through the manager review gate (delegateWithReview)
and return its AgentReport unchanged on success. On invalid input you return a FAILED
AgentReport whose error list names the missing or fuzzy fields verbatim.`;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * The manager-level intents this department handles. These map 1:1 onto
 * SCHEDULING_SPECIALIST actions; the manager does NOT split a single intent
 * across multiple specialists.
 */
export type OperationsIntent = 'CREATE_MEETING' | 'RESCHEDULE_MEETING' | 'CANCEL_MEETING';

/**
 * The action names emitted to SCHEDULING_SPECIALIST. The specialist contract
 * lives in `src/lib/agents/operations/scheduling/specialist.ts` (built by a
 * sibling agent). These string literals are the cross-reference — they MUST
 * match the specialist's SUPPORTED_ACTIONS exactly.
 */
export type SchedulingSpecialistAction =
  | 'create_meeting'
  | 'reschedule_meeting'
  | 'cancel_meeting';

/**
 * Reference to a CRM record this meeting is with. The id MUST resolve to a
 * real document in the corresponding collection — that resolution happens
 * inside the specialist before it books the slot. The manager only enforces
 * shape (non-empty type from the allowed enum, non-empty id string).
 */
export interface AttendeeRef {
  type: 'lead' | 'contact' | 'deal';
  id: string;
}

/**
 * Inbound payload for `CREATE_MEETING`. All fields except `title` and `notes`
 * are required at the manager boundary; missing required fields cause an
 * immediate FAILED report with a "missing X" error.
 */
export interface CreateMeetingArgs {
  intent: 'CREATE_MEETING';
  startTime: string;            // ISO 8601, must parse to a real Date
  durationMinutes?: number;      // default 30
  attendeeRef: AttendeeRef;
  title?: string;
  notes?: string;
}

/**
 * Inbound payload for `RESCHEDULE_MEETING`. The meeting being moved is
 * identified by `meetingId`; the new slot is described by `startTime` /
 * `durationMinutes` in the same shape as create.
 */
export interface RescheduleMeetingArgs {
  intent: 'RESCHEDULE_MEETING';
  meetingId: string;
  startTime: string;            // ISO 8601 — new slot
  durationMinutes?: number;      // default 30
  notes?: string;
}

/**
 * Inbound payload for `CANCEL_MEETING`. Only the meeting id is required.
 * `reason` is optional context the specialist may include in the cancellation
 * notice it composes for the attendee.
 */
export interface CancelMeetingArgs {
  intent: 'CANCEL_MEETING';
  meetingId: string;
  reason?: string;
}

/**
 * Discriminated union for the message payload this manager accepts. Jasper
 * builds one of these shapes via its delegate_to_operations tool (built by
 * the registry agent) and passes it as `AgentMessage.payload`.
 */
export type OperationsRequest =
  | CreateMeetingArgs
  | RescheduleMeetingArgs
  | CancelMeetingArgs;

/**
 * Validation result returned by the local arg-shape checks.
 */
interface ValidationOutcome {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const SCHEDULING_SPECIALIST_ID = 'SCHEDULING_SPECIALIST';
const DEFAULT_DURATION_MINUTES = 30;

const OPERATIONS_MANAGER_CONFIG: ManagerConfig = {
  identity: {
    id: 'OPERATIONS_MANAGER',
    name: 'Operations Manager',
    role: 'manager',
    status: 'FUNCTIONAL',
    reportsTo: 'JASPER',
    capabilities: [
      'meeting_creation',
      'meeting_rescheduling',
      'meeting_cancellation',
      'calendar_integrity',
      'availability_enforcement',
      'attendee_validation',
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: ['delegate', 'create_meeting', 'reschedule_meeting', 'cancel_meeting'],
  outputSchema: {
    type: 'object',
    properties: {
      intent: { type: 'string' },
      specialistReport: { type: 'object' },
    },
    required: ['intent', 'specialistReport'],
  },
  maxTokens: 2048,
  temperature: 0.2,
  specialists: [SCHEDULING_SPECIALIST_ID],
  delegationRules: [
    {
      triggerKeywords: [
        'meeting', 'schedule', 'reschedule', 'cancel meeting',
        'book a call', 'calendar', 'appointment',
      ],
      delegateTo: SCHEDULING_SPECIALIST_ID,
      priority: 10,
      requiresApproval: false,
    },
  ],
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class OperationsManager extends BaseManager {
  private specialistsRegistered = false;

  constructor() {
    super(OPERATIONS_MANAGER_CONFIG);
  }

  /**
   * Lazy-register the specialist. Mirrors ContentManager — registration is
   * idempotent and only happens once per process. The factory call is
   * deliberately late-bound (require at call time) so this manager does not
   * import a sibling-agent file that may not exist yet on a fresh worktree.
   * The runtime registration error is caught and logged so the manager can
   * still surface a clean "specialist not registered" failure path instead
   * of throwing during module import.
   */
  async initialize(): Promise<void> {
    this.log('INFO', 'Initializing Operations Manager...');
    await this.registerAllSpecialists();
    this.isInitialized = true;
    this.log(
      'INFO',
      `Operations Manager initialized with ${this.specialists.size} specialist(s)`,
    );
  }

  private async registerAllSpecialists(): Promise<void> {
    if (this.specialistsRegistered) { return; }

    try {
      const specialist = await loadSchedulingSpecialist();
      if (specialist) {
        await specialist.initialize();
        this.registerSpecialist(specialist);
      } else {
        this.log(
          'WARN',
          `Could not load ${SCHEDULING_SPECIALIST_ID} module yet — specialist will be unavailable until built. Operations Manager will return BLOCKED for any request.`,
        );
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.log('ERROR', `Failed to register ${SCHEDULING_SPECIALIST_ID}: ${errMsg}`);
      logger.error(
        '[OperationsManager] specialist registration failed',
        error instanceof Error ? error : new Error(errMsg),
      );
    }

    this.specialistsRegistered = true;
  }

  /**
   * Main entry point. Mirrors ContentManager.execute(): validates the
   * request, builds a specialist message, and routes through delegateWithReview.
   * On any validation failure we return FAILED with a flat string[] of errors
   * — never partial output, never a guessed default attendee or time.
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    if (!this.specialistsRegistered) {
      await this.registerAllSpecialists();
    }

    const pauseReport = await this.checkManagerPaused(taskId);
    if (pauseReport) { return pauseReport; }

    return this.delegateOperations(message);
  }

  /**
   * Manager-level intent dispatcher. Reads the discriminator on the payload,
   * validates the args, and forwards to the specialist via delegateWithReview.
   *
   * Public entry-point name mirrors ContentManager / OutreachManager
   * conventions so the agent-factory wiring (built by a sibling agent) can
   * call into a single coherent interface across departments.
   */
  async delegateOperations(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    const request = this.coerceRequest(message.payload);

    if (!request) {
      return this.createReport(
        taskId,
        'FAILED',
        null,
        ['Missing or unrecognized intent — payload must include intent: CREATE_MEETING | RESCHEDULE_MEETING | CANCEL_MEETING'],
      );
    }

    switch (request.intent) {
      case 'CREATE_MEETING':
        return this.handleCreateMeeting(message, request);
      case 'RESCHEDULE_MEETING':
        return this.handleRescheduleMeeting(message, request);
      case 'CANCEL_MEETING':
        return this.handleCancelMeeting(message, request);
      default: {
        // Exhaustive check — TS will error here if we add a new intent to
        // the union and forget to handle it above.
        const _exhaustive: never = request;
        return this.createReport(
          taskId,
          'FAILED',
          null,
          [`Unhandled intent in OperationsManager: ${JSON.stringify(_exhaustive)}`],
        );
      }
    }
  }

  /**
   * Signal handler. Operations doesn't currently subscribe to any broadcast
   * signals — meetings are always operator-initiated through Jasper. This
   * acknowledges any inbound signal so SignalBus doesn't treat us as
   * unresponsive, and forwards COMMAND-shaped signals to execute().
   */
  async handleSignal(signal: Signal): Promise<AgentReport> {
    if (signal.payload?.type === 'COMMAND') {
      return this.execute(signal.payload);
    }
    return this.createReport(signal.id, 'COMPLETED', { acknowledged: true });
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 220, boilerplate: 80 };
  }

  // ==========================================================================
  // INTENT HANDLERS
  // ==========================================================================

  private async handleCreateMeeting(
    message: AgentMessage,
    args: CreateMeetingArgs,
  ): Promise<AgentReport> {
    const taskId = message.id;
    const validation = this.validateCreateMeetingArgs(args);
    if (!validation.valid) {
      this.log('WARN', `CREATE_MEETING rejected: ${validation.errors.join('; ')}`);
      return this.createReport(taskId, 'FAILED', null, validation.errors);
    }

    const specialistMessage = this.buildSpecialistMessage(message, 'create_meeting', {
      startTime: args.startTime,
      durationMinutes: args.durationMinutes ?? DEFAULT_DURATION_MINUTES,
      attendeeRef: args.attendeeRef,
      title: args.title,
      notes: args.notes,
    });

    return this.delegateWithReview(SCHEDULING_SPECIALIST_ID, specialistMessage);
  }

  private async handleRescheduleMeeting(
    message: AgentMessage,
    args: RescheduleMeetingArgs,
  ): Promise<AgentReport> {
    const taskId = message.id;
    const validation = this.validateRescheduleMeetingArgs(args);
    if (!validation.valid) {
      this.log('WARN', `RESCHEDULE_MEETING rejected: ${validation.errors.join('; ')}`);
      return this.createReport(taskId, 'FAILED', null, validation.errors);
    }

    const specialistMessage = this.buildSpecialistMessage(message, 'reschedule_meeting', {
      meetingId: args.meetingId,
      startTime: args.startTime,
      durationMinutes: args.durationMinutes ?? DEFAULT_DURATION_MINUTES,
      notes: args.notes,
    });

    return this.delegateWithReview(SCHEDULING_SPECIALIST_ID, specialistMessage);
  }

  private async handleCancelMeeting(
    message: AgentMessage,
    args: CancelMeetingArgs,
  ): Promise<AgentReport> {
    const taskId = message.id;
    const validation = this.validateCancelMeetingArgs(args);
    if (!validation.valid) {
      this.log('WARN', `CANCEL_MEETING rejected: ${validation.errors.join('; ')}`);
      return this.createReport(taskId, 'FAILED', null, validation.errors);
    }

    const specialistMessage = this.buildSpecialistMessage(message, 'cancel_meeting', {
      meetingId: args.meetingId,
      reason: args.reason,
    });

    return this.delegateWithReview(SCHEDULING_SPECIALIST_ID, specialistMessage);
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  private validateCreateMeetingArgs(args: CreateMeetingArgs): ValidationOutcome {
    const errors: string[] = [];

    if (!isNonEmptyString(args.startTime)) {
      errors.push('missing startTime (ISO 8601 string required)');
    } else if (!isValidIsoDate(args.startTime)) {
      errors.push(
        `startTime is not a valid ISO 8601 date: "${args.startTime}". The specialist will not be asked to guess — Jasper must resolve fuzzy times before delegation.`,
      );
    }

    if (args.durationMinutes !== undefined) {
      if (!Number.isFinite(args.durationMinutes) || args.durationMinutes <= 0) {
        errors.push(
          `durationMinutes must be a positive number, got: ${String(args.durationMinutes)}`,
        );
      }
    }

    errors.push(...this.validateAttendeeRef(args.attendeeRef));

    return { valid: errors.length === 0, errors };
  }

  private validateRescheduleMeetingArgs(args: RescheduleMeetingArgs): ValidationOutcome {
    const errors: string[] = [];

    if (!isNonEmptyString(args.meetingId)) {
      errors.push('missing meetingId');
    }

    if (!isNonEmptyString(args.startTime)) {
      errors.push('missing startTime (ISO 8601 string required for the new slot)');
    } else if (!isValidIsoDate(args.startTime)) {
      errors.push(`startTime is not a valid ISO 8601 date: "${args.startTime}"`);
    }

    if (args.durationMinutes !== undefined) {
      if (!Number.isFinite(args.durationMinutes) || args.durationMinutes <= 0) {
        errors.push(
          `durationMinutes must be a positive number, got: ${String(args.durationMinutes)}`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private validateCancelMeetingArgs(args: CancelMeetingArgs): ValidationOutcome {
    const errors: string[] = [];
    if (!isNonEmptyString(args.meetingId)) {
      errors.push('missing meetingId');
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * AttendeeRef must be {type, id} — both populated, type from the allowed
   * enum, id non-empty. Raw names like "John Smith" are NOT acceptable.
   * Returns 0 errors when valid, otherwise a list of plain-English reasons.
   */
  private validateAttendeeRef(ref: unknown): string[] {
    const errors: string[] = [];
    if (!ref || typeof ref !== 'object') {
      errors.push('missing attendeeRef ({ type: lead|contact|deal, id: string } required)');
      return errors;
    }

    const candidate = ref as Partial<AttendeeRef> & Record<string, unknown>;
    const type = candidate.type;
    const id = candidate.id;

    if (type !== 'lead' && type !== 'contact' && type !== 'deal') {
      errors.push(
        `attendeeRef.type must be one of [lead, contact, deal], got: ${String(type)}`,
      );
    }

    if (typeof id !== 'string' || id.trim().length === 0) {
      errors.push(
        'attendeeRef.id must be a non-empty CRM record id. Raw attendee names are not accepted — Jasper resolves names to ids before delegation.',
      );
    }

    return errors;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Coerce an unknown payload to a typed OperationsRequest. Returns null if
   * the payload is not an object or the discriminator is unrecognized. We
   * avoid throwing here so the caller can return a clean FAILED report.
   */
  private coerceRequest(payload: unknown): OperationsRequest | null {
    if (!payload || typeof payload !== 'object') { return null; }
    const obj = payload as { intent?: unknown };
    const intent = obj.intent;
    if (intent === 'CREATE_MEETING'
      || intent === 'RESCHEDULE_MEETING'
      || intent === 'CANCEL_MEETING') {
      return payload as OperationsRequest;
    }
    return null;
  }

  /**
   * Build the AgentMessage that goes to SCHEDULING_SPECIALIST. The action
   * name + concrete args become the specialist's payload — the specialist
   * branches on `action` and validates the inner args against its own Zod
   * schema before performing the side effect.
   */
  private buildSpecialistMessage(
    sourceMessage: AgentMessage,
    action: SchedulingSpecialistAction,
    actionArgs: Record<string, unknown>,
  ): AgentMessage {
    return {
      id: sourceMessage.id,
      timestamp: new Date(),
      from: this.identity.id,
      to: SCHEDULING_SPECIALIST_ID,
      type: 'COMMAND',
      priority: sourceMessage.priority,
      payload: {
        action,
        args: actionArgs,
      },
      requiresResponse: true,
      traceId: sourceMessage.traceId,
    };
  }
}

// ============================================================================
// SPECIALIST FACTORY LOADER
// ============================================================================

/**
 * Late-binding loader for the SCHEDULING_SPECIALIST module. The specialist
 * file is built by a sibling agent at `src/lib/agents/operations/scheduling/specialist.ts`.
 * If the module isn't on disk yet (or hasn't exported a factory we recognize)
 * we return null and the manager surfaces a clean BLOCKED report instead of
 * crashing on import.
 *
 * Recognized factory shapes (in priority order):
 *   1. `getSchedulingSpecialist(): BaseSpecialist`
 *   2. `SchedulingSpecialist` class (constructed with no args)
 */
async function loadSchedulingSpecialist(): Promise<BaseSpecialist | null> {
  try {
    const mod: Record<string, unknown> = await import('./scheduling/specialist');
    const factory = mod.getSchedulingSpecialist;
    if (typeof factory === 'function') {
      const instance = (factory as () => BaseSpecialist)();
      if (instance instanceof BaseSpecialist) { return instance; }
    }
    const ctor = mod.SchedulingSpecialist;
    if (typeof ctor === 'function') {
      const instance = new (ctor as new () => BaseSpecialist)();
      if (instance instanceof BaseSpecialist) { return instance; }
    }
    return null;
  } catch {
    // Module not present yet — sibling agent hasn't shipped scheduling/specialist.ts.
    return null;
  }
}

// ============================================================================
// LOCAL HELPERS
// ============================================================================

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidIsoDate(value: string): boolean {
  // Reject "Tuesday afternoon" etc. — Date.parse is lenient but a real ISO
  // string round-trips through Date and includes either a 'T' or a 'Z'.
  if (!value.includes('T') && !value.includes('-')) { return false; }
  const t = Date.parse(value);
  return Number.isFinite(t);
}

// ============================================================================
// SINGLETON ACCESSOR
// ============================================================================

let _instance: OperationsManager | null = null;

/**
 * Singleton accessor — mirrors the factory pattern used by other managers
 * (getCopywriter, getCalendarCoordinator, etc.). The agent-factory wiring
 * built by a sibling agent will call this to obtain the manager.
 */
export function getOperationsManager(): OperationsManager {
  _instance ??= new OperationsManager();
  return _instance;
}
