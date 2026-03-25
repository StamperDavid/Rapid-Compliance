/**
 * Vonage Voice Provider
 * Implements VoiceProvider interface for Vonage (formerly Nexmo)
 * Voice API: https://api.nexmo.com/v1/calls
 * Auth: JWT with application_id + private_key
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

const VONAGE_VOICE_BASE = 'https://api.nexmo.com/v1';
const VONAGE_SMS_BASE = 'https://rest.nexmo.com';

// Vonage API response interfaces
interface VonageErrorResponse {
  title?: string;
  detail?: string;
  type?: string;
}

interface VonageCallData {
  uuid?: string;
  conversation_uuid?: string;
  from?: { type?: string; number?: string };
  to?: { type?: string; number?: string };
  status?: string;
  direction?: string;
  start_time?: string;
  end_time?: string;
  duration?: string;
  rate?: string;
  price?: string;
  network?: string;
}

interface VonageCallResponse {
  uuid: string;
  conversation_uuid: string;
  status: string;
  direction: string;
}

interface VonageSMSResponse {
  messages: Array<{
    'message-id': string;
    to: string;
    status: string;
    'remaining-balance'?: string;
    'message-price'?: string;
    'error-text'?: string;
  }>;
  'message-count': string;
}

interface VonageCallsListResponse {
  _embedded?: {
    calls?: VonageCallData[];
  };
  count?: number;
}

interface VonageNumberData {
  country: string;
  msisdn: string;
  type: string;
  features: string[];
  moHttpUrl?: string;
  voiceCallbackType?: string;
  voiceCallbackValue?: string;
}

interface VonageNumbersResponse {
  count: number;
  numbers: VonageNumberData[];
}

interface VonageAvailableNumber {
  country: string;
  msisdn: string;
  type: string;
  cost: string;
  features: string[];
}

interface VonageSearchResponse {
  count: number;
  numbers: VonageAvailableNumber[];
}

interface VonageWebhookData {
  status?: string;
  uuid?: string;
  conversation_uuid?: string;
  from?: string;
  to?: string;
  direction?: string;
  duration?: string;
  start_time?: string;
  end_time?: string;
  recording_url?: string;
  dtmf?: { digits?: string; timed_out?: boolean };
  speech?: { results?: Array<{ text?: string; confidence?: string }> };
  msisdn?: string;
  messageId?: string;
  text?: string;
  type?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export class VonageProvider implements VoiceProvider {
  readonly providerType: VoiceProviderType = 'vonage';
  readonly costs: VoiceProviderCosts = {
    voicePerMinuteCents: 1.0,
    smsPerMessageCents: 0.65,
    phoneNumberMonthlyCents: 700,
    recordingPerMinuteCents: 0.4,
  };

  private config: VoiceProviderConfig;

  constructor(config: VoiceProviderConfig) {
    this.config = config;
  }

  /**
   * Generate JWT for Vonage API authentication.
   * Uses the accountId as the application_id and authToken as the API key
   * for simplified auth (API key + secret as Basic Auth).
   */
  private getAuthHeaders(): Record<string, string> {
    // Vonage supports both JWT and Basic Auth
    // We use Basic Auth with API key (accountId) + secret (authToken)
    const credentials = Buffer.from(`${this.config.accountId}:${this.config.authToken}`).toString('base64');
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make authenticated request to Vonage API
   */
  private async request<T>(
    baseUrl: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: this.getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch((): VonageErrorResponse => ({
        detail: response.statusText,
      })) as VonageErrorResponse;
      throw new Error(error.detail ?? error.title ?? `Vonage API error: ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  async initiateCall(to: string, agentId: string, options?: InitiateCallOptions): Promise<VoiceCall> {
    try {
      const webhookUrl = `${this.config.webhookBaseUrl}/api/voice/vonage/agent/${agentId}`;

      const ncco = [
        {
          action: 'connect',
          from: options?.callerId ?? this.config.phoneNumber,
          endpoint: [{ type: 'phone', number: to }],
        },
      ];

      const response = await this.request<VonageCallResponse>(
        VONAGE_VOICE_BASE,
        '/calls',
        'POST',
        {
          to: [{ type: 'phone', number: to }],
          from: { type: 'phone', number: options?.callerId ?? this.config.phoneNumber },
          ncco,
          event_url: [options?.statusCallback ?? `${this.config.webhookBaseUrl}/api/voice/vonage/status`],
          event_method: 'POST',
          answer_url: [webhookUrl],
          answer_method: 'POST',
          ringing_timer: options?.timeout ?? 30,
          machine_detection: options?.machineDetection ? 'hangup' : undefined,
        },
      );

      return {
        callId: response.uuid,
        from: options?.callerId ?? this.config.phoneNumber,
        to,
        status: this.mapCallStatus(response.status),
        direction: 'outbound',
        startTime: new Date(),
      };
    } catch (error: unknown) {
      logger.error('[Vonage] Call initiation error:', error instanceof Error ? error : undefined, { file: 'vonage-provider.ts' });
      throw new Error(`Failed to initiate call: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCall(callId: string): Promise<VoiceCall> {
    try {
      const call = await this.request<VonageCallData>(VONAGE_VOICE_BASE, `/calls/${callId}`);
      return this.mapCallToVoiceCall(call);
    } catch (error: unknown) {
      logger.error('[Vonage] Get call error:', error instanceof Error ? error : undefined, { file: 'vonage-provider.ts' });
      throw new Error(`Failed to get call: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateCall(callId: string, options: CallControlOptions): Promise<void> {
    try {
      if (options.hangup) {
        await this.request<Record<string, unknown>>(VONAGE_VOICE_BASE, `/calls/${callId}`, 'PUT', {
          action: 'hangup',
        });
        return;
      }

      if (options.playAudio) {
        await this.request<Record<string, unknown>>(VONAGE_VOICE_BASE, `/calls/${callId}/stream`, 'PUT', {
          stream_url: [options.playAudio],
          loop: 1,
        });
      }

      if (options.speak) {
        await this.request<Record<string, unknown>>(VONAGE_VOICE_BASE, `/calls/${callId}/talk`, 'PUT', {
          text: options.speak.text,
          voice_name: this.mapVoiceName(options.speak.voice),
          language: options.speak.language ?? 'en-US',
          style: 0,
        });
      }

      if (options.gather) {
        // Vonage uses NCCO for gathering input — requires updating the call flow
        const ncco = [
          {
            action: 'input',
            type: ['dtmf'],
            dtmf: {
              maxDigits: options.gather.maxDigits ?? 20,
              timeOut: options.gather.timeout ?? 5,
              submitOnHash: options.gather.finishOnKey === '#',
            },
            eventUrl: [options.gather.action ?? `${this.config.webhookBaseUrl}/api/voice/vonage/input`],
            eventMethod: 'POST',
          },
        ];

        await this.request<Record<string, unknown>>(VONAGE_VOICE_BASE, `/calls/${callId}`, 'PUT', {
          action: 'transfer',
          destination: {
            type: 'ncco',
            ncco,
          },
        });
      }

      if (options.record) {
        const ncco = [
          {
            action: 'record',
            format: 'mp3',
            endOnSilence: 5,
            endOnKey: '#',
            beepStart: true,
            eventUrl: [`${this.config.webhookBaseUrl}/api/voice/vonage/recording`],
          },
        ];

        await this.request<Record<string, unknown>>(VONAGE_VOICE_BASE, `/calls/${callId}`, 'PUT', {
          action: 'transfer',
          destination: {
            type: 'ncco',
            ncco,
          },
        });
      }
    } catch (error: unknown) {
      logger.error('[Vonage] Update call error:', error instanceof Error ? error : undefined, { file: 'vonage-provider.ts' });
      throw new Error(`Failed to update call: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async endCall(callId: string): Promise<void> {
    try {
      await this.request<Record<string, unknown>>(VONAGE_VOICE_BASE, `/calls/${callId}`, 'PUT', {
        action: 'hangup',
      });
    } catch (error: unknown) {
      logger.error('[Vonage] End call error:', error instanceof Error ? error : undefined, { file: 'vonage-provider.ts' });
      throw new Error(`Failed to end call: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async transfer(callId: string, options: TransferOptions): Promise<void> {
    try {
      const ncco = [
        {
          action: 'connect',
          from: options.callerId ?? this.config.phoneNumber,
          timeout: options.timeout ?? 30,
          endpoint: [{ type: 'phone', number: options.to }],
        },
      ];

      await this.request<Record<string, unknown>>(VONAGE_VOICE_BASE, `/calls/${callId}`, 'PUT', {
        action: 'transfer',
        destination: {
          type: 'ncco',
          ncco,
        },
      });
    } catch (error: unknown) {
      logger.error('[Vonage] Transfer error:', error instanceof Error ? error : undefined, { file: 'vonage-provider.ts' });
      throw new Error(`Failed to transfer call: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async addToConference(callId: string, options: ConferenceOptions): Promise<void> {
    try {
      const ncco = [
        {
          action: 'conversation',
          name: options.name,
          startOnEnter: options.startConferenceOnEnter ?? true,
          endOnExit: options.endConferenceOnExit ?? false,
          mute: options.muted ?? false,
          musicOnHoldUrl: options.waitUrl ? [options.waitUrl] : undefined,
        },
      ];

      await this.request<Record<string, unknown>>(VONAGE_VOICE_BASE, `/calls/${callId}`, 'PUT', {
        action: 'transfer',
        destination: {
          type: 'ncco',
          ncco,
        },
      });
    } catch (error: unknown) {
      logger.error('[Vonage] Conference error:', error instanceof Error ? error : undefined, { file: 'vonage-provider.ts' });
      throw new Error(`Failed to add to conference: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async muteCall(callId: string, muted: boolean): Promise<void> {
    try {
      await this.request<Record<string, unknown>>(VONAGE_VOICE_BASE, `/calls/${callId}`, 'PUT', {
        action: muted ? 'mute' : 'unmute',
      });
    } catch (error: unknown) {
      logger.error('[Vonage] Mute error:', error instanceof Error ? error : undefined, { file: 'vonage-provider.ts' });
      throw new Error(`Failed to mute call: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async holdCall(callId: string, hold: boolean): Promise<void> {
    try {
      if (hold) {
        // Transfer to a hold NCCO that plays hold music
        const ncco = [
          {
            action: 'stream',
            streamUrl: ['https://nexmo-community.github.io/ncco-examples/assets/voice_api_audio_streaming.mp3'],
            loop: 0,
          },
        ];

        await this.request<Record<string, unknown>>(VONAGE_VOICE_BASE, `/calls/${callId}`, 'PUT', {
          action: 'transfer',
          destination: { type: 'ncco', ncco },
        });
      } else {
        logger.warn('[Vonage] Hold resume requires state management', { file: 'vonage-provider.ts' });
      }
    } catch (error: unknown) {
      logger.error('[Vonage] Hold error:', error instanceof Error ? error : undefined, { file: 'vonage-provider.ts' });
      throw new Error(`Failed to hold call: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async sendSMS(to: string, message: string): Promise<SMSMessage> {
    try {
      const response = await this.request<VonageSMSResponse>(VONAGE_SMS_BASE, '/sms/json', 'POST', {
        api_key: this.config.accountId,
        api_secret: this.config.authToken,
        from: this.config.phoneNumber,
        to,
        text: message,
      });

      const msg = response.messages[0];
      if (msg.status !== '0') {
        throw new Error(msg['error-text'] ?? `SMS send failed with status ${msg.status}`);
      }

      return {
        messageId: msg['message-id'],
        from: this.config.phoneNumber,
        to: msg.to,
        body: message,
        status: 'sent' as SMSStatus,
        direction: 'outbound',
        sentAt: new Date(),
      };
    } catch (error: unknown) {
      logger.error('[Vonage] SMS error:', error instanceof Error ? error : undefined, { file: 'vonage-provider.ts' });
      throw new Error(`Failed to send SMS: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getSMS(_messageId: string): Promise<SMSMessage> {
    // Vonage SMS API does not have a GET message endpoint with Basic Auth
    // Message status is delivered via webhook callbacks
    logger.warn('[Vonage] SMS status retrieval relies on webhook delivery reports', { file: 'vonage-provider.ts' });
    return Promise.reject(new Error('Vonage SMS status is delivered via webhooks. Use the delivery receipt callback to track message status.'));
  }

  generateResponse(options: CallControlOptions): string {
    // Vonage uses NCCO (Nexmo Call Control Object) as JSON, but for TwiML compatibility
    // we generate an XML-like format. In production, Vonage webhook handlers use JSON NCCO.
    const ncco: Record<string, unknown>[] = [];

    if (options.pause) {
      ncco.push({
        action: 'stream',
        streamUrl: ['https://example.com/silence.mp3'],
        loop: 1,
        bargeIn: false,
      });
    }

    if (options.playAudio) {
      ncco.push({
        action: 'stream',
        streamUrl: [options.playAudio],
        loop: 1,
      });
    }

    if (options.speak) {
      if (options.gather) {
        const gather = options.gather;
        ncco.push({
          action: 'talk',
          text: options.speak.text,
          voiceName: this.mapVoiceName(options.speak.voice),
          language: options.speak.language ?? 'en-US',
          bargeIn: true,
        });
        ncco.push({
          action: 'input',
          type: ['dtmf'],
          dtmf: {
            maxDigits: gather.maxDigits ?? 20,
            timeOut: gather.timeout ?? 5,
            submitOnHash: gather.finishOnKey === '#',
          },
          eventUrl: [gather.action ?? ''],
        });
      } else {
        ncco.push({
          action: 'talk',
          text: options.speak.text,
          voiceName: this.mapVoiceName(options.speak.voice),
          language: options.speak.language ?? 'en-US',
        });
      }
    }

    if (options.record) {
      ncco.push({
        action: 'record',
        format: 'mp3',
        endOnSilence: 5,
        beepStart: true,
      });
    }

    // Return NCCO as JSON string (Vonage native format)
    return JSON.stringify(ncco);
  }

  parseWebhook(payload: Record<string, unknown>): VoiceWebhookPayload | SMSWebhookPayload {
    const data = payload as VonageWebhookData;

    // Voice webhook (has uuid or status typical of voice events)
    if (data.uuid || data.conversation_uuid || (data.status && !data.msisdn && !data.messageId)) {
      return {
        provider: 'vonage',
        callId: String(data.uuid ?? ''),
        event: this.mapWebhookEvent(String(data.status ?? '')),
        from: String(data.from ?? ''),
        to: String(data.to ?? ''),
        status: this.mapCallStatus(String(data.status ?? '')),
        duration: data.duration ? parseInt(data.duration) : undefined,
        recordingUrl: data.recording_url ? String(data.recording_url) : undefined,
        digits: data.dtmf?.digits ? String(data.dtmf.digits) : undefined,
        speechResult: data.speech?.results?.[0]?.text ? String(data.speech.results[0].text) : undefined,
        timestamp: new Date(),
        rawPayload: payload,
      };
    }

    // SMS webhook
    return {
      provider: 'vonage',
      messageId: String(data.messageId ?? data['message-id'] ?? ''),
      event: this.mapSMSWebhookEvent(String(data.type ?? data.status ?? '')),
      from: String(data.msisdn ?? data.from ?? ''),
      to: String(data.to ?? ''),
      body: data.text ? String(data.text) : undefined,
      status: this.mapSMSStatusFromEvent(String(data.status ?? '')),
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      rawPayload: payload,
    };
  }

  async getRecording(callId: string): Promise<string | null> {
    try {
      // Vonage provides recording URLs via webhooks; to retrieve them we query call details
      const call = await this.request<VonageCallData>(VONAGE_VOICE_BASE, `/calls/${callId}`);
      // Recording URL is typically provided via event webhook, not via call detail
      // Return null if not available via this path
      return call.price ? null : null;
    } catch (error: unknown) {
      logger.error('[Vonage] Get recording error:', error instanceof Error ? error : undefined, { file: 'vonage-provider.ts' });
      return null;
    }
  }

  async deleteRecording(_recordingId: string): Promise<void> {
    // Vonage doesn't have a direct recording delete API
    // Recordings auto-expire based on account settings
    logger.warn('[Vonage] Recording deletion relies on account auto-expiry settings', { file: 'vonage-provider.ts' });
    await Promise.resolve();
  }

  async listPhoneNumbers(): Promise<Array<{ number: string; capabilities: string[] }>> {
    try {
      const response = await this.request<VonageNumbersResponse>(
        VONAGE_SMS_BASE,
        `/account/numbers?api_key=${this.config.accountId}&api_secret=${this.config.authToken}`,
      );

      return response.numbers.map((n) => ({
        number: n.msisdn,
        capabilities: n.features ?? ['SMS', 'VOICE'],
      }));
    } catch (error: unknown) {
      logger.error('[Vonage] List numbers error:', error instanceof Error ? error : undefined, { file: 'vonage-provider.ts' });
      throw new Error(`Failed to list phone numbers: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async purchasePhoneNumber(areaCode?: string, country?: string): Promise<string> {
    try {
      const countryCode = country ?? 'US';
      let searchUrl = `/number/search?api_key=${this.config.accountId}&api_secret=${this.config.authToken}&country=${countryCode}&features=SMS,VOICE&size=1`;

      if (areaCode) {
        searchUrl += `&pattern=${areaCode}&search_pattern=1`;
      }

      const available = await this.request<VonageSearchResponse>(VONAGE_SMS_BASE, searchUrl);

      if (!available.numbers?.length) {
        throw new Error('No phone numbers available in that area');
      }

      // Purchase the number
      await this.request<Record<string, unknown>>(VONAGE_SMS_BASE, '/number/buy', 'POST', {
        api_key: this.config.accountId,
        api_secret: this.config.authToken,
        country: countryCode,
        msisdn: available.numbers[0].msisdn,
      });

      return available.numbers[0].msisdn;
    } catch (error: unknown) {
      logger.error('[Vonage] Purchase number error:', error instanceof Error ? error : undefined, { file: 'vonage-provider.ts' });
      throw new Error(`Failed to purchase phone number: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async releasePhoneNumber(number: string): Promise<void> {
    try {
      await this.request<Record<string, unknown>>(VONAGE_SMS_BASE, '/number/cancel', 'POST', {
        api_key: this.config.accountId,
        api_secret: this.config.authToken,
        country: 'US',
        msisdn: number,
      });
    } catch (error: unknown) {
      logger.error('[Vonage] Release number error:', error instanceof Error ? error : undefined, { file: 'vonage-provider.ts' });
      throw new Error(`Failed to release phone number: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.request<VonageCallsListResponse>(VONAGE_VOICE_BASE, '/calls?page_size=1');
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private mapCallToVoiceCall(call: VonageCallData): VoiceCall {
    return {
      callId: call.uuid ?? '',
      from: call.from?.number ?? '',
      to: call.to?.number ?? '',
      status: this.mapCallStatus(call.status ?? ''),
      direction: call.direction === 'outbound' ? 'outbound' : 'inbound',
      duration: call.duration ? parseInt(call.duration) : undefined,
      startTime: call.start_time ? new Date(call.start_time) : undefined,
      endTime: call.end_time ? new Date(call.end_time) : undefined,
    };
  }

  private mapCallStatus(status: string): CallStatus {
    const statusMap: Record<string, CallStatus> = {
      started: 'queued',
      ringing: 'ringing',
      answered: 'in-progress',
      machine: 'in-progress',
      completed: 'completed',
      timeout: 'no-answer',
      failed: 'failed',
      rejected: 'failed',
      cancelled: 'canceled',
      busy: 'busy',
      unanswered: 'no-answer',
    };
    return statusMap[status] ?? 'queued';
  }

  private mapWebhookEvent(status: string): VoiceWebhookPayload['event'] {
    const eventMap: Record<string, VoiceWebhookPayload['event']> = {
      started: 'initiated',
      ringing: 'ringing',
      answered: 'answered',
      completed: 'completed',
      timeout: 'completed',
      failed: 'completed',
    };
    return eventMap[status] ?? 'initiated';
  }

  private mapSMSWebhookEvent(type: string): SMSWebhookPayload['event'] {
    const eventMap: Record<string, SMSWebhookPayload['event']> = {
      'inbound-message': 'received',
      delivered: 'delivered',
      submitted: 'sent',
      rejected: 'failed',
      undeliverable: 'failed',
    };
    return eventMap[type] ?? 'sent';
  }

  private mapSMSStatusFromEvent(status: string): SMSStatus {
    const statusMap: Record<string, SMSStatus> = {
      delivered: 'delivered',
      submitted: 'sent',
      rejected: 'failed',
      undeliverable: 'failed',
      expired: 'failed',
      accepted: 'queued',
      buffered: 'sending',
    };
    return statusMap[status] ?? 'sent';
  }

  private mapVoiceName(voice?: string): string {
    const voiceMap: Record<string, string> = {
      'Polly.Joanna': 'Joanna',
      'Polly.Matthew': 'Matthew',
      'alice': 'Joanna',
      'man': 'Matthew',
      'woman': 'Joanna',
    };
    return voiceMap[voice ?? ''] ?? 'Joanna';
  }
}

export default VonageProvider;
