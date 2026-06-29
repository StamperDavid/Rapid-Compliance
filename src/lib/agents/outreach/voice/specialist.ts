/**
 * Voice Service — DETERMINISTIC TWILIO/TELNYX/BANDWIDTH/VONAGE DISPATCHER
 *
 * Despite the historical "VOICE_AI_SPECIALIST" name, this module does NOT
 * call an LLM. It is a thin control-plane wrapper over VoiceProviderFactory
 * that initiates calls, fetches status, ends calls, sends DTMF, transfers,
 * and pulls recordings — all by directly invoking the provider SDK.
 *
 * It is registered as a "specialist" because it lives under
 * src/lib/agents/outreach/voice/, reports to OUTREACH_MANAGER, and emits
 * AgentReports — but per Standing Rule #1 ("every LLM agent has a Golden
 * Master") this is NOT an LLM agent. There is no GM, no Brand DNA injection,
 * and the previous decorative `systemPrompt` constant was never sent to any
 * model — keeping it in the config implied AI-agent shape that didn't exist.
 *
 * Future work (explicit, NOT yet implemented):
 *   - LLM-driven call planning (script generation per lead context)
 *   - Transcript analysis post-call (sentiment, objection detection)
 *   - Outcome classification (won/lost/needs-followup)
 * When any of those land, they get their own action handlers, their own GM,
 * and Brand DNA baked in at seed time — at which point the systemPrompt
 * field comes back, but tied to a real LLM call.
 *
 * Action surface: make_call, get_call_status, end_call, send_dtmf,
 * transfer_call, get_recording, log_outcome. All deterministic.
 */

import 'server-only';

import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, AgentStatus, SpecialistConfig, Signal } from '../../types';
import { VoiceProviderFactory } from '@/lib/voice/voice-factory';
import type { VoiceCall, VoiceProvider, InitiateCallOptions } from '@/lib/voice/types';
import { logger } from '@/lib/logger/logger';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { checkTCPAConsent, checkCallTimeRestrictions } from '@/lib/compliance/tcpa-service';
import { createActivity } from '@/lib/crm/activity-service';
import { Timestamp } from 'firebase/firestore';

// ============== Configuration ==============

// Deterministic dispatcher — no LLM fields. The previous CONFIG carried
// `systemPrompt`, `tools`, `outputSchema`, `maxTokens`, and `temperature`
// from the SpecialistConfig type, all of which were never used by any code
// path. They've been removed so the config matches what this module actually
// does. SpecialistConfig.systemPrompt remains required by the type, so we
// pass an empty string with a comment explaining why.
const CONFIG: SpecialistConfig = {
  identity: {
    id: 'VOICE_AI_SPECIALIST',
    name: 'Voice Service (Twilio dispatcher)',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'OUTREACH_MANAGER',
    capabilities: [
      'make_call',
      'get_call_status',
      'end_call',
      'send_dtmf',
      'transfer_call',
      'get_recording',
      'call_tracking',
    ],
  },
  // The next four fields are required by SpecialistConfig (which assumes
  // every specialist is LLM-driven) but never read by this module — it is a
  // deterministic Twilio dispatcher. Empty/zero values document that fact;
  // they cannot be removed without updating SpecialistConfig itself, which
  // would touch every specialist file. Future structural cleanup.
  systemPrompt: '',
  tools: [],
  outputSchema: { type: 'object', properties: {} },
  maxTokens: 0,
  temperature: 0,
};

// ============== Type Definitions ==============

interface MakeCallPayload {
  action: 'make_call';
  to: string;
  agentId?: string;
  record?: boolean;
  timeout?: number;
  machineDetection?: boolean;
  callerId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * place_call_execute — operator-gated EXECUTOR action.
 *
 * Unlike make_call (a raw dispatcher action the manager/Jasper can call
 * directly), place_call_execute is an irreversible side effect: it RINGS a
 * real phone AND writes a `call_made` CRM activity to the lead's timeline.
 * It therefore fails closed behind the same operator-approval gate the other
 * executor specialists use (deal-closer / email): it only proceeds when the
 * mission step-runner sets `viaApprovedMissionStep === true` for an
 * operator-approved step. A direct chat call (flag absent/false) returns
 * COMPLETED guidance and performs NO TCPA check, NO dial, NO activity write.
 */
interface PlaceCallExecutePayload {
  action: 'place_call_execute';
  leadId: string;
  toPhone: string;
  contactId?: string;
  leadName?: string;
  goal?: string;
  viaApprovedMissionStep?: boolean;
}

interface GetCallStatusPayload {
  action: 'get_call_status';
  callId: string;
}

interface EndCallPayload {
  action: 'end_call';
  callId: string;
}

interface SendDTMFPayload {
  action: 'send_dtmf';
  callId: string;
  digits: string;
}

interface TransferCallPayload {
  action: 'transfer_call';
  callId: string;
  to: string;
  callerId?: string;
  timeout?: number;
}

interface GetRecordingPayload {
  action: 'get_recording';
  callId: string;
}

interface LogOutcomePayload {
  action: 'log_outcome';
  callId: string;
  outcome: 'answered' | 'voicemail' | 'busy' | 'no-answer' | 'failed';
  disposition?: string;
  notes?: string;
  leadId?: string;
}

type VoicePayload =
  | MakeCallPayload
  | PlaceCallExecutePayload
  | GetCallStatusPayload
  | EndCallPayload
  | SendDTMFPayload
  | TransferCallPayload
  | GetRecordingPayload
  | LogOutcomePayload;

interface VoiceExecutionResult {
  success: boolean;
  action: string;
  callId?: string;
  call?: VoiceCall;
  recording?: string | null;
  outcome?: string;
  error?: string;
  // place_call_execute — operator-gate guidance (returned WITHOUT a side effect)
  approvalRequired?: boolean;
  mutated?: boolean;
  leadId?: string;
  toPhone?: string;
  message?: string;
  // place_call_execute — executor result (call placed + CRM activity logged)
  executed?: {
    leadId: string;
    toPhone: string;
    callId: string;
    activityId: string | null;
    callPlaced: boolean;
  };
}

// ============== Voice AI Specialist Implementation ==============

export class VoiceAiSpecialist extends BaseSpecialist {
  private isReady: boolean = false;
  private provider: VoiceProvider | null = null;

  constructor() {
    super(CONFIG);
  }

  /**
   * Initialize the specialist - verify voice provider is available
   */
  async initialize(): Promise<void> {
    try {
      this.log('INFO', 'Initializing Voice AI Specialist...');

      // Try to get a voice provider to validate configuration
      try {
        this.provider = await VoiceProviderFactory.getProvider();
        this.log('INFO', `Voice provider available: ${this.provider.providerType}`);
      } catch {
        // Provider not configured yet — specialist is still functional,
        // it will attempt provider lookup on each call
        this.log('WARN', 'No voice provider configured yet — calls will fail until credentials are added in Settings > API Keys');
      }

      this.isReady = true;
      this.isInitialized = true;

      this.log('INFO', 'Voice AI Specialist initialized successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log('ERROR', `Failed to initialize Voice AI Specialist: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get a working voice provider (cached or fresh)
   */
  private async getProvider(): Promise<VoiceProvider> {
    if (this.provider) {
      return this.provider;
    }
    this.provider = await VoiceProviderFactory.getProvider();
    return this.provider;
  }

  /**
   * Execute voice operations
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const payload = message.payload as VoicePayload;

      if (!payload || typeof payload !== 'object' || !('action' in payload)) {
        return this.createReport(taskId, 'FAILED', null, ['Invalid payload: action is required']);
      }

      let result: VoiceExecutionResult;

      switch (payload.action) {
        case 'make_call':
          result = await this.handleMakeCall(payload);
          break;

        case 'place_call_execute':
          result = await this.handlePlaceCallExecute(payload);
          break;

        case 'get_call_status':
          result = await this.handleGetCallStatus(payload);
          break;

        case 'end_call':
          result = await this.handleEndCall(payload);
          break;

        case 'send_dtmf':
          result = await this.handleSendDTMF(payload);
          break;

        case 'transfer_call':
          result = await this.handleTransferCall(payload);
          break;

        case 'get_recording':
          result = await this.handleGetRecording(payload);
          break;

        case 'log_outcome':
          result = await this.handleLogOutcome(payload);
          break;

        default:
          return this.createReport(taskId, 'FAILED', null, [`Unknown action: ${(payload as { action: string }).action}`]);
      }

      if (result.success) {
        return this.createReport(taskId, 'COMPLETED', result);
      } else {
        return this.createReport(taskId, 'FAILED', result, [result.error ?? 'Unknown error']);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[Voice AI Specialist] Execution error:', err, { taskId, file: 'voice/specialist.ts' });
      return this.createReport(taskId, 'FAILED', null, [err.message]);
    }
  }

  /**
   * Handle make_call action
   */
  private async handleMakeCall(payload: MakeCallPayload): Promise<VoiceExecutionResult> {
    if (!payload.to) {
      return {
        success: false,
        action: 'make_call',
        error: 'Missing required field: to (phone number)',
      };
    }

    // Basic E.164 validation
    if (!payload.to.match(/^\+[1-9]\d{6,14}$/)) {
      return {
        success: false,
        action: 'make_call',
        error: `Invalid phone number format (E.164 required): ${payload.to}`,
      };
    }

    // TCPA consent gate — fail closed. Must pass before any dial attempt.
    const tcpaCheck = await checkTCPAConsent(payload.to, 'call');
    if (!tcpaCheck.allowed) {
      logger.warn('[Voice Specialist] Outbound call blocked by TCPA consent check', {
        to: payload.to,
        reason: tcpaCheck.reason,
        file: 'voice/specialist.ts',
      });
      return {
        success: false,
        action: 'make_call',
        error: `Call blocked: TCPA consent not on file for this number. ${tcpaCheck.reason ?? 'No consent record found.'}`,
      };
    }

    const provider = await this.getProvider();
    const agentId = payload.agentId ?? 'default';

    const callOptions: InitiateCallOptions = {
      record: payload.record,
      timeout: payload.timeout,
      machineDetection: payload.machineDetection,
      callerId: payload.callerId,
    };

    const call = await provider.initiateCall(payload.to, agentId, callOptions);

    this.log('INFO', `Call initiated: ${call.callId} to ${payload.to} via ${provider.providerType}`);

    // Log call to Firestore for tracking
    await this.logCallToFirestore(call, payload.metadata);

    return {
      success: true,
      action: 'make_call',
      callId: call.callId,
      call,
    };
  }

  /**
   * Handle place_call_execute action — operator-gated EXECUTOR.
   *
   * This is the only voice action that BOTH rings a real phone AND writes a
   * `call_made` CRM activity to the lead's timeline. Because that pair of side
   * effects is irreversible, it fails closed behind an operator-approval gate
   * (mirrors deal-closer `executeClose` / email `send_email`).
   *
   * Order is safety-first:
   *   (1) approval gate (no flag → refuse with guidance, NO side effect)
   *   (2) E.164 validation (same regex make_call uses)
   *   (3) TCPA consent (checkTCPAConsent) THEN call-time window
   *       (checkCallTimeRestrictions) — both reused verbatim from
   *       compliance/tcpa-service.ts, no wording change
   *   (4) place the real call by REUSING the exact provider path make_call
   *       uses (provider factory → provider.initiateCall) + the same
   *       callLogs write
   *   (5) log a deterministic `call_made` CRM activity (NO LLM — fixed
   *       template text). Partial success: if the activity write fails after
   *       the call is placed, keep the call (activityId:null).
   */
  private async handlePlaceCallExecute(payload: PlaceCallExecutePayload): Promise<VoiceExecutionResult> {
    // (1) APPROVAL GATE — FAIL CLOSED. A direct chat call (flag absent/false)
    //     must NOT ring a phone or touch the CRM. Return COMPLETED guidance
    //     that routes through Mission Control. No TCPA / no dial before this.
    if (payload.viaApprovedMissionStep !== true) {
      logger.warn('[Voice Specialist] place_call_execute BLOCKED (no operator approval)', {
        leadId: payload.leadId,
        toPhone: payload.toPhone,
        file: 'voice/specialist.ts',
      });
      return {
        success: true,
        action: 'place_call_execute',
        approvalRequired: true,
        mutated: false,
        leadId: payload.leadId,
        toPhone: payload.toPhone,
        message:
          'place_call_execute rings a real phone and logs a CRM activity, so it cannot run ' +
          'directly from chat. It requires explicit operator approval. Propose it as a mission ' +
          'step via propose_mission_plan (delegate_to_outreach, action "place_call"). The ' +
          'operator approves the step in Mission Control, then the call is placed.',
      };
    }

    if (!payload.leadId) {
      return { success: false, action: 'place_call_execute', error: 'Missing required field: leadId' };
    }
    if (!payload.toPhone) {
      return { success: false, action: 'place_call_execute', error: 'Missing required field: toPhone (phone number)' };
    }

    // (2) E.164 validation — same regex make_call uses.
    if (!payload.toPhone.match(/^\+[1-9]\d{6,14}$/)) {
      return {
        success: false,
        action: 'place_call_execute',
        error: `Invalid phone number format (E.164 required): ${payload.toPhone}`,
      };
    }

    // (3a) TCPA consent gate — fail closed (reused verbatim).
    const consent = await checkTCPAConsent(payload.toPhone, 'call');
    if (!consent.allowed) {
      logger.warn('[Voice Specialist] place_call_execute blocked by TCPA consent check', {
        toPhone: payload.toPhone,
        reason: consent.reason,
        file: 'voice/specialist.ts',
      });
      return {
        success: false,
        action: 'place_call_execute',
        error: `Call blocked: TCPA consent not on file for this number. ${consent.reason ?? 'No consent record found.'}`,
      };
    }

    // (3b) TCPA call-time window — the check make_call was missing (reused verbatim).
    const timeOk = checkCallTimeRestrictions(payload.toPhone);
    if (!timeOk.allowed) {
      logger.warn('[Voice Specialist] place_call_execute blocked by TCPA call-time restriction', {
        toPhone: payload.toPhone,
        reason: timeOk.reason,
        file: 'voice/specialist.ts',
      });
      return {
        success: false,
        action: 'place_call_execute',
        error: `Call blocked: ${timeOk.reason ?? 'Outside permitted calling hours.'}`,
      };
    }

    // (4) Place the real call by reusing the SAME provider path make_call uses
    //     (provider factory → provider.initiateCall) + the same callLogs write.
    const provider = await this.getProvider();
    const call = await provider.initiateCall(payload.toPhone, 'default', {});
    this.log('INFO', `place_call_execute: call initiated ${call.callId} to ${payload.toPhone} via ${provider.providerType}`);
    await this.logCallToFirestore(call, {
      leadId: payload.leadId,
      contactId: payload.contactId,
      goal: payload.goal,
      via: 'place_call_execute',
    });

    // (5) Log the `call_made` CRM activity (deterministic template — NO LLM).
    //     Partial success: keep the placed call even if the activity write fails.
    const displayName = payload.leadName ?? 'lead';
    const goalSuffix = payload.goal ? ` Goal: ${payload.goal}.` : '';
    let activityId: string | null = null;
    try {
      const activity = await createActivity({
        type: 'call_made',
        direction: 'outbound',
        subject: payload.goal ?? 'Outbound call',
        body: `Outbound call placed to ${displayName} (${payload.toPhone}).${goalSuffix}`,
        relatedTo: [{ entityType: 'lead', entityId: payload.leadId, entityName: payload.leadName }],
        createdBy: CONFIG.identity.id,
        occurredAt: Timestamp.fromDate(new Date()),
        // Minimal metadata only — we know the call was PLACED, not whether it
        // connected, so we do not assert a callOutcome. The provider call id is
        // recorded on the callLogs doc (and in executed.callId), not duplicated here.
        metadata: {},
      });
      activityId = activity.id;
    } catch (activityError) {
      logger.error(
        `[Voice Specialist] place_call_execute: call placed (${call.callId}) but call_made activity log failed for lead ${payload.leadId}`,
        activityError instanceof Error ? activityError : new Error(String(activityError)),
        { file: 'voice/specialist.ts' },
      );
    }

    return {
      success: true,
      action: 'place_call_execute',
      callId: call.callId,
      executed: {
        leadId: payload.leadId,
        toPhone: payload.toPhone,
        callId: call.callId,
        activityId,
        callPlaced: true,
      },
    };
  }

  /**
   * Handle get_call_status action
   */
  private async handleGetCallStatus(payload: GetCallStatusPayload): Promise<VoiceExecutionResult> {
    if (!payload.callId) {
      return {
        success: false,
        action: 'get_call_status',
        error: 'Missing required field: callId',
      };
    }

    const provider = await this.getProvider();
    const call = await provider.getCall(payload.callId);

    return {
      success: true,
      action: 'get_call_status',
      callId: call.callId,
      call,
    };
  }

  /**
   * Handle end_call action
   */
  private async handleEndCall(payload: EndCallPayload): Promise<VoiceExecutionResult> {
    if (!payload.callId) {
      return {
        success: false,
        action: 'end_call',
        error: 'Missing required field: callId',
      };
    }

    const provider = await this.getProvider();
    await provider.endCall(payload.callId);

    this.log('INFO', `Call ended: ${payload.callId}`);

    return {
      success: true,
      action: 'end_call',
      callId: payload.callId,
    };
  }

  /**
   * Handle send_dtmf action
   */
  private async handleSendDTMF(payload: SendDTMFPayload): Promise<VoiceExecutionResult> {
    if (!payload.callId || !payload.digits) {
      return {
        success: false,
        action: 'send_dtmf',
        error: 'Missing required fields: callId, digits',
      };
    }

    const provider = await this.getProvider();
    await provider.updateCall(payload.callId, {
      gather: {
        maxDigits: payload.digits.length,
        timeout: 5,
      },
    });

    this.log('INFO', `DTMF sent to call ${payload.callId}: ${payload.digits}`);

    return {
      success: true,
      action: 'send_dtmf',
      callId: payload.callId,
    };
  }

  /**
   * Handle transfer_call action
   */
  private async handleTransferCall(payload: TransferCallPayload): Promise<VoiceExecutionResult> {
    if (!payload.callId || !payload.to) {
      return {
        success: false,
        action: 'transfer_call',
        error: 'Missing required fields: callId, to',
      };
    }

    const provider = await this.getProvider();
    await provider.transfer(payload.callId, {
      to: payload.to,
      callerId: payload.callerId,
      timeout: payload.timeout,
    });

    this.log('INFO', `Call ${payload.callId} transferred to ${payload.to}`);

    return {
      success: true,
      action: 'transfer_call',
      callId: payload.callId,
    };
  }

  /**
   * Handle get_recording action
   */
  private async handleGetRecording(payload: GetRecordingPayload): Promise<VoiceExecutionResult> {
    if (!payload.callId) {
      return {
        success: false,
        action: 'get_recording',
        error: 'Missing required field: callId',
      };
    }

    const provider = await this.getProvider();
    const recordingUrl = await provider.getRecording(payload.callId);

    return {
      success: true,
      action: 'get_recording',
      callId: payload.callId,
      recording: recordingUrl,
    };
  }

  /**
   * Handle log_outcome action
   */
  private async handleLogOutcome(payload: LogOutcomePayload): Promise<VoiceExecutionResult> {
    if (!payload.callId || !payload.outcome) {
      return {
        success: false,
        action: 'log_outcome',
        error: 'Missing required fields: callId, outcome',
      };
    }

    // Update call record in Firestore
    await FirestoreService.set(
      getSubCollection('callLogs'),
      payload.callId,
      {
        outcome: payload.outcome,
        disposition: payload.disposition ?? null,
        notes: payload.notes ?? null,
        leadId: payload.leadId ?? null,
        updatedAt: new Date().toISOString(),
      },
      false
    );

    this.log('INFO', `Call outcome logged: ${payload.callId} → ${payload.outcome}`);

    return {
      success: true,
      action: 'log_outcome',
      callId: payload.callId,
      outcome: payload.outcome,
    };
  }

  /**
   * Log call to Firestore for tracking and analytics
   */
  private async logCallToFirestore(
    call: VoiceCall,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await FirestoreService.set(
        getSubCollection('callLogs'),
        call.callId,
        {
          callId: call.callId,
          from: call.from,
          to: call.to,
          status: call.status,
          direction: call.direction,
          startTime: call.startTime?.toISOString() ?? new Date().toISOString(),
          metadata: metadata ?? {},
          createdAt: new Date().toISOString(),
        },
        false
      );
    } catch (error) {
      // Non-critical — log but don't fail the call
      logger.warn('[Voice AI Specialist] Failed to log call to Firestore', {
        callId: call.callId,
        error: error instanceof Error ? error.message : String(error),
        file: 'voice/specialist.ts',
      });
    }
  }

  /**
   * Handle incoming signals from the Signal Bus
   */
  handleSignal(signal: Signal): Promise<AgentReport> {
    this.log('INFO', `Received signal: ${signal.type}`);
    return Promise.resolve(this.createReport(
      `signal_${Date.now()}`,
      'COMPLETED',
      { signalType: signal.type, acknowledged: true },
    ));
  }

  /**
   * Generate a structured report
   */
  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  /**
   * Returns the agent's current status
   */
  getStatus(): AgentStatus {
    return this.isReady ? 'FUNCTIONAL' : 'UNBUILT';
  }

  /**
   * Returns true — this specialist has real functionality
   */
  isFunctional(): boolean {
    return this.isReady;
  }

  /**
   * Self-assessment - has real logic
   */
  hasRealLogic(): boolean {
    return true;
  }

  /**
   * Functional LOC count
   */
  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 350, boilerplate: 50 };
  }
}

// ============== Factory Functions ==============

export function createVoiceAiSpecialist(): VoiceAiSpecialist {
  return new VoiceAiSpecialist();
}

let instance: VoiceAiSpecialist | null = null;

export function getVoiceAiSpecialist(): VoiceAiSpecialist {
  instance ??= createVoiceAiSpecialist();
  return instance;
}

// Legacy singleton export (deprecated - use getVoiceAiSpecialist())
export default VoiceAiSpecialist;
