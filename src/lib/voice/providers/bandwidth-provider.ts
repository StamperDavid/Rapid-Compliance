/**
 * Bandwidth Voice Provider
 * Implements VoiceProvider interface for Bandwidth Communications
 * REST API: https://voice.bandwidth.com/api/v2/accounts/{accountId}/calls
 * Auth: Basic Auth with API token + secret
 */

import type {
  VoiceProvider,
  VoiceProviderType,
  VoiceProviderConfig,
  VoiceProviderCosts,
  VoiceCall,
  CallStatus,
  SMSMessage,
  SMSStatus,
  InitiateCallOptions,
  CallControlOptions,
  TransferOptions,
  ConferenceOptions,
  VoiceWebhookPayload,
  SMSWebhookPayload,
} from '../types';
import { logger } from '@/lib/logger/logger';

const BANDWIDTH_VOICE_BASE = 'https://voice.bandwidth.com/api/v2';
const BANDWIDTH_MESSAGING_BASE = 'https://messaging.bandwidth.com/api/v2';

// Bandwidth API response interfaces
interface BandwidthErrorResponse {
  type?: string;
  description?: string;
}

interface BandwidthCallData {
  callId?: string;
  from?: string;
  to?: string;
  state?: string;
  direction?: string;
  startTime?: string;
  endTime?: string;
  disconnectCause?: string;
  answerTime?: string;
  applicationId?: string;
  callUrl?: string;
  enqueuedTime?: string;
}

interface BandwidthMessageData {
  id: string;
  from: string;
  to: string[];
  text: string;
  direction?: string;
  time?: string;
  tag?: string;
}

interface BandwidthRecordingData {
  recordingId: string;
  mediaUrl?: string;
  duration?: string;
  startTime?: string;
  endTime?: string;
  fileFormat?: string;
}

interface BandwidthPhoneNumberData {
  id: string;
  phoneNumber: string;
  city?: string;
  state?: string;
  capabilities?: string[];
}

interface BandwidthWebhookData {
  eventType?: string;
  callId?: string;
  from?: string;
  to?: string;
  direction?: string;
  callState?: string;
  cause?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  recordingId?: string;
  mediaUrl?: string;
  digits?: string;
  transcription?: { text?: string };
  machineDetectionResult?: { value?: string };
  messageId?: string;
  message?: {
    id?: string;
    from?: string;
    to?: string[];
    text?: string;
    direction?: string;
    time?: string;
  };
  [key: string]: unknown;
}

export class BandwidthProvider implements VoiceProvider {
  readonly providerType: VoiceProviderType = 'bandwidth';
  readonly costs: VoiceProviderCosts = {
    voicePerMinuteCents: 0.4,
    smsPerMessageCents: 0.35,
    phoneNumberMonthlyCents: 500,
    recordingPerMinuteCents: 0.2,
  };

  private config: VoiceProviderConfig;

  constructor(config: VoiceProviderConfig) {
    this.config = config;
  }

  /**
   * Base64 encode Basic Auth credentials
   */
  private getBasicAuth(): string {
    const credentials = `${this.config.accountId}:${this.config.authToken}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  /**
   * Make authenticated request to Bandwidth Voice API
   */
  private async voiceRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${BANDWIDTH_VOICE_BASE}/accounts/${this.config.accountId}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': this.getBasicAuth(),
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch((): BandwidthErrorResponse => ({
        description: response.statusText,
      })) as BandwidthErrorResponse;
      throw new Error(error.description ?? `Bandwidth API error: ${response.status}`);
    }

    // Some endpoints return 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make authenticated request to Bandwidth Messaging API
   */
  private async messagingRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${BANDWIDTH_MESSAGING_BASE}/users/${this.config.accountId}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': this.getBasicAuth(),
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch((): BandwidthErrorResponse => ({
        description: response.statusText,
      })) as BandwidthErrorResponse;
      throw new Error(error.description ?? `Bandwidth Messaging API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async initiateCall(to: string, agentId: string, options?: InitiateCallOptions): Promise<VoiceCall> {
    try {
      const webhookUrl = `${this.config.webhookBaseUrl}/api/voice/bandwidth/agent/${agentId}`;

      const call = await this.voiceRequest<BandwidthCallData>('/calls', 'POST', {
        from: options?.callerId ?? this.config.phoneNumber,
        to,
        applicationId: this.config.accountId,
        answerUrl: webhookUrl,
        answerMethod: 'POST',
        disconnectUrl: options?.statusCallback ?? `${this.config.webhookBaseUrl}/api/voice/bandwidth/status`,
        disconnectMethod: 'POST',
        callTimeout: options?.timeout ?? 30,
        machineDetection: options?.machineDetection ? {
          mode: 'async',
          detectionTimeout: 15,
          silenceTimeout: 5,
          callbackUrl: `${this.config.webhookBaseUrl}/api/voice/bandwidth/machine-detection`,
          callbackMethod: 'POST',
        } : undefined,
      });

      return this.mapCallToVoiceCall(call);
    } catch (error: unknown) {
      logger.error('[Bandwidth] Call initiation error:', error instanceof Error ? error : undefined, { file: 'bandwidth-provider.ts' });
      throw new Error(`Failed to initiate call: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCall(callId: string): Promise<VoiceCall> {
    try {
      const call = await this.voiceRequest<BandwidthCallData>(`/calls/${callId}`);
      return this.mapCallToVoiceCall(call);
    } catch (error: unknown) {
      logger.error('[Bandwidth] Get call error:', error instanceof Error ? error : undefined, { file: 'bandwidth-provider.ts' });
      throw new Error(`Failed to get call: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateCall(callId: string, options: CallControlOptions): Promise<void> {
    try {
      if (options.hangup) {
        await this.voiceRequest<Record<string, unknown>>(`/calls/${callId}`, 'POST', {
          state: 'completed',
        });
        return;
      }

      if (options.playAudio) {
        // Use BXML to play audio
        const bxml = `<?xml version="1.0" encoding="UTF-8"?><Response><PlayAudio>${this.escapeXML(options.playAudio)}</PlayAudio></Response>`;
        await this.voiceRequest<Record<string, unknown>>(`/calls/${callId}`, 'PUT', {
          redirectUrl: undefined,
          state: 'active',
          tag: bxml,
        });
      }

      if (options.speak) {
        const voice = this.mapVoice(options.speak.voice);
        const bxml = `<?xml version="1.0" encoding="UTF-8"?><Response><SpeakSentence voice="${voice}" locale="${options.speak.language ?? 'en_US'}">${this.escapeXML(options.speak.text)}</SpeakSentence></Response>`;
        await this.voiceRequest<Record<string, unknown>>(`/calls/${callId}`, 'PUT', {
          redirectUrl: undefined,
          state: 'active',
          tag: bxml,
        });
      }

      if (options.gather) {
        const gather = options.gather;
        await this.voiceRequest<Record<string, unknown>>(`/calls/${callId}`, 'PUT', {
          redirectUrl: gather.action ?? `${this.config.webhookBaseUrl}/api/voice/bandwidth/gather`,
          redirectMethod: 'POST',
          tag: JSON.stringify({
            maxDigits: gather.maxDigits ?? 20,
            terminatingDigits: gather.finishOnKey ?? '#',
            interDigitTimeout: (gather.timeout ?? 5),
          }),
        });
      }

      if (options.record) {
        await this.voiceRequest<Record<string, unknown>>(`/calls/${callId}/recording`, 'PUT', {
          state: 'recording',
        });
      }
    } catch (error: unknown) {
      logger.error('[Bandwidth] Update call error:', error instanceof Error ? error : undefined, { file: 'bandwidth-provider.ts' });
      throw new Error(`Failed to update call: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async endCall(callId: string): Promise<void> {
    try {
      await this.voiceRequest<Record<string, unknown>>(`/calls/${callId}`, 'POST', {
        state: 'completed',
      });
    } catch (error: unknown) {
      logger.error('[Bandwidth] End call error:', error instanceof Error ? error : undefined, { file: 'bandwidth-provider.ts' });
      throw new Error(`Failed to end call: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async transfer(callId: string, options: TransferOptions): Promise<void> {
    try {
      const bxml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Response>',
        `  <Transfer transferCallerId="${options.callerId ?? this.config.phoneNumber}" callTimeout="${options.timeout ?? 30}">`,
        `    <PhoneNumber>${this.escapeXML(options.to)}</PhoneNumber>`,
        '  </Transfer>',
        '</Response>',
      ].join('\n');

      await this.voiceRequest<Record<string, unknown>>(`/calls/${callId}`, 'PUT', {
        redirectUrl: undefined,
        state: 'active',
        tag: bxml,
      });
    } catch (error: unknown) {
      logger.error('[Bandwidth] Transfer error:', error instanceof Error ? error : undefined, { file: 'bandwidth-provider.ts' });
      throw new Error(`Failed to transfer call: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async addToConference(callId: string, options: ConferenceOptions): Promise<void> {
    try {
      // Create conference via BXML
      const bxml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Response>',
        `  <Conference mute="${options.muted ?? false}" callIdsToCoach="${options.coach ?? ''}">`,
        `    ${this.escapeXML(options.name)}`,
        '  </Conference>',
        '</Response>',
      ].join('\n');

      await this.voiceRequest<Record<string, unknown>>(`/calls/${callId}`, 'PUT', {
        redirectUrl: undefined,
        state: 'active',
        tag: bxml,
      });
    } catch (error: unknown) {
      logger.error('[Bandwidth] Conference error:', error instanceof Error ? error : undefined, { file: 'bandwidth-provider.ts' });
      throw new Error(`Failed to add to conference: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async muteCall(callId: string, _muted: boolean): Promise<void> {
    // Bandwidth requires conference context for muting
    logger.warn(`[Bandwidth] Mute requires conference context for call ${callId}`, { file: 'bandwidth-provider.ts' });
    await Promise.resolve();
  }

  async holdCall(callId: string, hold: boolean): Promise<void> {
    try {
      if (hold) {
        const bxml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<Response>',
          '  <Pause duration="3600"/>',
          '</Response>',
        ].join('\n');

        await this.voiceRequest<Record<string, unknown>>(`/calls/${callId}`, 'PUT', {
          redirectUrl: undefined,
          state: 'active',
          tag: bxml,
        });
      } else {
        logger.warn('[Bandwidth] Hold resume requires state management', { file: 'bandwidth-provider.ts' });
      }
    } catch (error: unknown) {
      logger.error('[Bandwidth] Hold error:', error instanceof Error ? error : undefined, { file: 'bandwidth-provider.ts' });
      throw new Error(`Failed to hold call: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async sendSMS(to: string, message: string): Promise<SMSMessage> {
    try {
      const response = await this.messagingRequest<BandwidthMessageData>('/messages', 'POST', {
        from: this.config.phoneNumber,
        to: [to],
        text: message,
        applicationId: this.config.accountId,
      });

      return {
        messageId: response.id,
        from: response.from,
        to: response.to[0],
        body: response.text,
        status: 'queued' as SMSStatus,
        direction: 'outbound',
        sentAt: new Date(),
      };
    } catch (error: unknown) {
      logger.error('[Bandwidth] SMS error:', error instanceof Error ? error : undefined, { file: 'bandwidth-provider.ts' });
      throw new Error(`Failed to send SMS: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getSMS(messageId: string): Promise<SMSMessage> {
    try {
      const response = await this.messagingRequest<BandwidthMessageData>(`/messages/${messageId}`);

      return {
        messageId: response.id,
        from: response.from,
        to: response.to[0],
        body: response.text,
        status: this.mapSMSStatus(response.direction ?? 'out'),
        direction: response.direction === 'in' ? 'inbound' : 'outbound',
        sentAt: response.time ? new Date(response.time) : undefined,
      };
    } catch (error: unknown) {
      logger.error('[Bandwidth] Get SMS error:', error instanceof Error ? error : undefined, { file: 'bandwidth-provider.ts' });
      throw new Error(`Failed to get SMS: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  generateResponse(options: CallControlOptions): string {
    // Bandwidth uses BXML (Bandwidth XML)
    let bxml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>';

    if (options.pause) {
      bxml += `\n  <Pause duration="${options.pause}"/>`;
    }

    if (options.playAudio) {
      bxml += `\n  <PlayAudio>${this.escapeXML(options.playAudio)}</PlayAudio>`;
    }

    if (options.speak) {
      const voice = this.mapVoice(options.speak.voice);
      const locale = options.speak.language ?? 'en_US';

      if (options.gather) {
        const gather = options.gather;
        bxml += `\n  <Gather maxDigits="${gather.maxDigits ?? 20}" interDigitTimeout="${gather.timeout ?? 5}" terminatingDigits="${gather.finishOnKey ?? '#'}" gatherUrl="${gather.action ?? ''}">`;
        bxml += `\n    <SpeakSentence voice="${voice}" locale="${locale}">${this.escapeXML(options.speak.text)}</SpeakSentence>`;
        bxml += '\n  </Gather>';
        bxml += `\n  <SpeakSentence voice="${voice}">I didn't hear anything. Goodbye.</SpeakSentence>`;
      } else {
        bxml += `\n  <SpeakSentence voice="${voice}" locale="${locale}">${this.escapeXML(options.speak.text)}</SpeakSentence>`;
      }
    }

    if (options.record) {
      bxml += '\n  <Record maxDuration="300"/>';
    }

    if (options.hangup) {
      bxml += '\n  <Hangup/>';
    }

    bxml += '\n</Response>';
    return bxml;
  }

  parseWebhook(payload: Record<string, unknown>): VoiceWebhookPayload | SMSWebhookPayload {
    const data = payload as BandwidthWebhookData;
    const eventType = String(data.eventType ?? '');

    // Voice events
    if (eventType.startsWith('call') || data.callId) {
      return {
        provider: 'bandwidth',
        callId: String(data.callId ?? ''),
        event: this.mapWebhookEvent(eventType),
        from: String(data.from ?? ''),
        to: String(data.to ?? ''),
        status: this.mapCallStatusFromEvent(eventType),
        duration: data.duration ? parseFloat(data.duration) : undefined,
        recordingUrl: data.mediaUrl ? String(data.mediaUrl) : undefined,
        digits: data.digits ? String(data.digits) : undefined,
        speechResult: data.transcription?.text ? String(data.transcription.text) : undefined,
        answeredBy: data.machineDetectionResult?.value
          ? (data.machineDetectionResult.value === 'human' ? 'human' : 'machine')
          : undefined,
        timestamp: new Date(),
        rawPayload: payload,
      };
    }

    // Messaging events
    const msg = data.message;
    return {
      provider: 'bandwidth',
      messageId: String(msg?.id ?? data.messageId ?? ''),
      event: this.mapSMSWebhookEvent(eventType),
      from: String(msg?.from ?? ''),
      to: msg?.to?.[0] ?? '',
      body: msg?.text ? String(msg.text) : undefined,
      status: this.mapSMSStatusFromEvent(eventType),
      timestamp: new Date(),
      rawPayload: payload,
    };
  }

  async getRecording(callId: string): Promise<string | null> {
    try {
      const recordings = await this.voiceRequest<BandwidthRecordingData[]>(`/calls/${callId}/recordings`);
      if (recordings.length > 0) {
        return recordings[0].mediaUrl ?? null;
      }
      return null;
    } catch (error: unknown) {
      logger.error('[Bandwidth] Get recording error:', error instanceof Error ? error : undefined, { file: 'bandwidth-provider.ts' });
      return null;
    }
  }

  async deleteRecording(recordingId: string): Promise<void> {
    try {
      // Bandwidth recordings are tied to calls; the recordingId includes callId context
      await this.voiceRequest<Record<string, unknown>>(`/recordings/${recordingId}`, 'DELETE');
    } catch (error: unknown) {
      logger.error('[Bandwidth] Delete recording error:', error instanceof Error ? error : undefined, { file: 'bandwidth-provider.ts' });
      throw new Error(`Failed to delete recording: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listPhoneNumbers(): Promise<Array<{ number: string; capabilities: string[] }>> {
    try {
      const response = await this.voiceRequest<BandwidthPhoneNumberData[]>('/phoneNumbers');
      return response.map((n) => ({
        number: n.phoneNumber,
        capabilities: n.capabilities ?? ['voice', 'sms'],
      }));
    } catch (error: unknown) {
      logger.error('[Bandwidth] List numbers error:', error instanceof Error ? error : undefined, { file: 'bandwidth-provider.ts' });
      throw new Error(`Failed to list phone numbers: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async purchasePhoneNumber(areaCode?: string, _country?: string): Promise<string> {
    try {
      // Bandwidth uses a different flow: search → order → activate
      const searchParams: Record<string, unknown> = {
        quantity: 1,
        enableVoice: true,
        enableSms: true,
      };
      if (areaCode) {
        searchParams.areaCode = areaCode;
      }

      const available = await this.voiceRequest<BandwidthPhoneNumberData[]>(
        `/availableNumbers?${new URLSearchParams(Object.entries(searchParams).map(([k, v]) => [k, String(v)]))}`,
      );

      if (!available.length) {
        throw new Error('No phone numbers available in that area');
      }

      // Order the number
      const ordered = await this.voiceRequest<BandwidthPhoneNumberData>('/phoneNumbers', 'POST', {
        phoneNumber: available[0].phoneNumber,
      });

      return ordered.phoneNumber;
    } catch (error: unknown) {
      logger.error('[Bandwidth] Purchase number error:', error instanceof Error ? error : undefined, { file: 'bandwidth-provider.ts' });
      throw new Error(`Failed to purchase phone number: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async releasePhoneNumber(number: string): Promise<void> {
    try {
      // Find the number ID by listing and filtering
      const numbers = await this.voiceRequest<BandwidthPhoneNumberData[]>('/phoneNumbers');
      const match = numbers.find((n) => n.phoneNumber === number);

      if (match) {
        await this.voiceRequest<Record<string, unknown>>(`/phoneNumbers/${match.id}`, 'DELETE');
      }
    } catch (error: unknown) {
      logger.error('[Bandwidth] Release number error:', error instanceof Error ? error : undefined, { file: 'bandwidth-provider.ts' });
      throw new Error(`Failed to release phone number: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Validate by making a simple API call
      await this.voiceRequest<Record<string, unknown>>('/calls?pageSize=1');
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private mapCallToVoiceCall(call: BandwidthCallData): VoiceCall {
    return {
      callId: call.callId ?? '',
      from: call.from ?? '',
      to: call.to ?? '',
      status: this.mapCallStatus(call.state ?? ''),
      direction: call.direction === 'outbound' ? 'outbound' : 'inbound',
      startTime: call.startTime ? new Date(call.startTime) : undefined,
      endTime: call.endTime ? new Date(call.endTime) : undefined,
    };
  }

  private mapCallStatus(state: string): CallStatus {
    const statusMap: Record<string, CallStatus> = {
      initiated: 'queued',
      ringing: 'ringing',
      answered: 'in-progress',
      active: 'in-progress',
      completed: 'completed',
      disconnected: 'completed',
      rejected: 'failed',
      timeout: 'no-answer',
      cancel: 'canceled',
      error: 'failed',
    };
    return statusMap[state] ?? 'queued';
  }

  private mapCallStatusFromEvent(event: string): CallStatus {
    const eventMap: Record<string, CallStatus> = {
      callInitiated: 'queued',
      callRinging: 'ringing',
      callAnswered: 'in-progress',
      callComplete: 'completed',
      callDisconnect: 'completed',
      callTimeout: 'no-answer',
      callError: 'failed',
      callRecordingAvailable: 'in-progress',
      callDtmf: 'in-progress',
      callTranscription: 'in-progress',
    };
    return eventMap[event] ?? 'queued';
  }

  private mapSMSStatus(_status: string): SMSStatus {
    return 'sent';
  }

  private mapSMSStatusFromEvent(event: string): SMSStatus {
    const eventMap: Record<string, SMSStatus> = {
      messageReceived: 'delivered',
      messageSent: 'sent',
      messageDelivered: 'delivered',
      messageFailed: 'failed',
    };
    return eventMap[event] ?? 'sent';
  }

  private mapWebhookEvent(eventType: string): VoiceWebhookPayload['event'] {
    const eventMap: Record<string, VoiceWebhookPayload['event']> = {
      callInitiated: 'initiated',
      callRinging: 'ringing',
      callAnswered: 'answered',
      callComplete: 'completed',
      callDisconnect: 'completed',
      callRecordingAvailable: 'recording-available',
      callDtmf: 'dtmf',
      callTranscription: 'speech',
    };
    return eventMap[eventType] ?? 'initiated';
  }

  private mapSMSWebhookEvent(eventType: string): SMSWebhookPayload['event'] {
    const eventMap: Record<string, SMSWebhookPayload['event']> = {
      messageReceived: 'received',
      messageSent: 'sent',
      messageDelivered: 'delivered',
      messageFailed: 'failed',
    };
    return eventMap[eventType] ?? 'sent';
  }

  private mapVoice(voice?: string): string {
    const voiceMap: Record<string, string> = {
      'Polly.Joanna': 'julie',
      'Polly.Matthew': 'paul',
      'alice': 'julie',
      'man': 'paul',
      'woman': 'julie',
    };
    return voiceMap[voice ?? ''] ?? 'julie';
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export default BandwidthProvider;
