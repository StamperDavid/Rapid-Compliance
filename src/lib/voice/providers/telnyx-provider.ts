/**
 * Telnyx Voice Provider
 * Implements VoiceProvider interface for Telnyx
 * 60-70% cheaper than Twilio with similar features
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

const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

export class TelnyxProvider implements VoiceProvider {
  readonly providerType: VoiceProviderType = 'telnyx';
  readonly costs: VoiceProviderCosts = {
    voicePerMinuteCents: 0.4,
    smsPerMessageCents: 0.4,
    phoneNumberMonthlyCents: 200,
    recordingPerMinuteCents: 0.2,
  };

  private config: VoiceProviderConfig;
  private organizationId: string;
  private connectionId: string | null = null;

  constructor(config: VoiceProviderConfig, organizationId: string) {
    this.config = config;
    this.organizationId = organizationId;
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${TELNYX_API_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.authToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [{ detail: response.statusText }] }));
      throw new Error(error.errors?.[0]?.detail ?? 'Telnyx API error');
    }

    return response.json();
  }

  private async getConnectionId(): Promise<string> {
    if (this.connectionId) return this.connectionId;

    // Get the first available connection (SIP or credential connection)
    const response = await this.request<any>('/connections');
    if (response.data?.length > 0) {
      this.connectionId = response.data[0].id as string;
      return this.connectionId;
    }

    throw new Error('No Telnyx connection configured. Please set up a connection in your Telnyx portal.');
  }

  async initiateCall(to: string, agentId: string, options?: InitiateCallOptions): Promise<VoiceCall> {
    try {
      const connectionId = await this.getConnectionId();
      const webhookUrl = `${this.config.webhookBaseUrl}/api/voice/telnyx/agent/${agentId}`;

      const response = await this.request<any>('/calls', 'POST', {
        connection_id: connectionId,
        to,
        from: options?.callerId ?? this.config.phoneNumber,
        webhook_url: webhookUrl,
        webhook_url_method: 'POST',
        timeout_secs: options?.timeout ?? 30,
        answering_machine_detection: options?.machineDetection ? 'detect' : 'disabled',
        record: options?.record ? 'record-from-answer' : undefined,
        custom_headers: options?.sipHeaders,
      });

      return this.mapCallToVoiceCall(response.data);
    } catch (error: any) {
      logger.error('[Telnyx] Call initiation error:', error, { file: 'telnyx-provider.ts' });
      throw new Error(`Failed to initiate call: ${error.message}`);
    }
  }

  async getCall(callId: string): Promise<VoiceCall> {
    try {
      const response = await this.request<any>(`/calls/${callId}`);
      return this.mapCallToVoiceCall(response.data);
    } catch (error: any) {
      logger.error('[Telnyx] Get call error:', error, { file: 'telnyx-provider.ts' });
      throw new Error(`Failed to get call: ${error.message}`);
    }
  }

  async updateCall(callId: string, options: CallControlOptions): Promise<void> {
    try {
      if (options.hangup) {
        await this.request(`/calls/${callId}/actions/hangup`, 'POST');
        return;
      }

      if (options.playAudio) {
        await this.request(`/calls/${callId}/actions/playback_start`, 'POST', {
          audio_url: options.playAudio,
        });
      }

      if (options.speak) {
        await this.request(`/calls/${callId}/actions/speak`, 'POST', {
          payload: options.speak.text,
          voice: this.mapVoice(options.speak.voice),
          language: options.speak.language ?? 'en-US',
        });
      }

      if (options.gather) {
        await this.request(`/calls/${callId}/actions/gather`, 'POST', {
          minimum_digits: 1,
          maximum_digits: options.gather.maxDigits ?? 20,
          timeout_millis: (options.gather.timeout ?? 5) * 1000,
          terminating_digit: options.gather.finishOnKey ?? '#',
          valid_digits: '0123456789*#',
        });
      }

      if (options.record) {
        await this.request(`/calls/${callId}/actions/record_start`, 'POST', {
          format: 'mp3',
          channels: 'single',
        });
      }

      if (options.pause && options.pause > 0) {
        await this.request(`/calls/${callId}/actions/playback_start`, 'POST', {
          audio_url: 'silence://pause',
          overlay: false,
        });
        // Wait for pause duration
        const pauseMs = options.pause * 1000;
        await new Promise(resolve => setTimeout(resolve, pauseMs));
      }
    } catch (error: any) {
      logger.error('[Telnyx] Update call error:', error, { file: 'telnyx-provider.ts' });
      throw new Error(`Failed to update call: ${error.message}`);
    }
  }

  async endCall(callId: string): Promise<void> {
    try {
      await this.request(`/calls/${callId}/actions/hangup`, 'POST');
    } catch (error: any) {
      logger.error('[Telnyx] End call error:', error, { file: 'telnyx-provider.ts' });
      throw new Error(`Failed to end call: ${error.message}`);
    }
  }

  async transfer(callId: string, options: TransferOptions): Promise<void> {
    try {
      await this.request(`/calls/${callId}/actions/transfer`, 'POST', {
        to: options.to,
        from: options.callerId ?? this.config.phoneNumber,
        timeout_secs: options.timeout ?? 30,
        audio_url: options.announceUrl,
      });
    } catch (error: any) {
      logger.error('[Telnyx] Transfer error:', error, { file: 'telnyx-provider.ts' });
      throw new Error(`Failed to transfer call: ${error.message}`);
    }
  }

  async addToConference(callId: string, options: ConferenceOptions): Promise<void> {
    try {
      // Create or join conference
      const conferenceResponse = await this.request<any>('/conferences', 'POST', {
        name: options.name,
        beep_enabled: options.beep ? 'always' : 'never',
        start_conference_on_create: options.startConferenceOnEnter ?? true,
        hold_audio_url: options.waitUrl,
      });

      // Add participant to conference
      await this.request(`/conferences/${conferenceResponse.data.id}/actions/join`, 'POST', {
        call_control_id: callId,
        mute: options.muted ?? false,
        end_conference_on_exit: options.endConferenceOnExit ?? false,
        coach_leg_id: options.coach,
      });
    } catch (error: any) {
      logger.error('[Telnyx] Conference error:', error, { file: 'telnyx-provider.ts' });
      throw new Error(`Failed to add to conference: ${error.message}`);
    }
  }

  async muteCall(callId: string, muted: boolean): Promise<void> {
    try {
      const action = muted ? 'mute' : 'unmute';
      await this.request(`/calls/${callId}/actions/${action}`, 'POST');
    } catch (error: any) {
      logger.error('[Telnyx] Mute error:', error, { file: 'telnyx-provider.ts' });
      throw new Error(`Failed to mute call: ${error.message}`);
    }
  }

  async holdCall(callId: string, hold: boolean): Promise<void> {
    try {
      const action = hold ? 'hold' : 'unhold';
      await this.request(`/calls/${callId}/actions/${action}`, 'POST', {
        audio_url: hold ? 'https://example.com/hold-music.mp3' : undefined,
      });
    } catch (error: any) {
      logger.error('[Telnyx] Hold error:', error, { file: 'telnyx-provider.ts' });
      throw new Error(`Failed to hold call: ${error.message}`);
    }
  }

  async sendSMS(to: string, message: string): Promise<SMSMessage> {
    try {
      const response = await this.request<any>('/messages', 'POST', {
        from: this.config.phoneNumber,
        to,
        text: message,
        type: 'SMS',
      });

      return {
        messageId: response.data.id,
        from: response.data.from.phone_number,
        to: response.data.to[0].phone_number,
        body: response.data.text,
        status: this.mapSMSStatus(response.data.to[0].status),
        direction: 'outbound',
        sentAt: new Date(),
      };
    } catch (error: any) {
      logger.error('[Telnyx] SMS error:', error, { file: 'telnyx-provider.ts' });
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  async getSMS(messageId: string): Promise<SMSMessage> {
    try {
      const response = await this.request<any>(`/messages/${messageId}`);
      const data = response.data;

      return {
        messageId: data.id,
        from: data.from.phone_number,
        to: data.to[0].phone_number,
        body: data.text,
        status: this.mapSMSStatus(data.to[0].status),
        direction: data.direction === 'outbound' ? 'outbound' : 'inbound',
        sentAt: data.sent_at ? new Date(data.sent_at) : undefined,
      };
    } catch (error: any) {
      logger.error('[Telnyx] Get SMS error:', error, { file: 'telnyx-provider.ts' });
      throw new Error(`Failed to get SMS: ${error.message}`);
    }
  }

  generateResponse(options: CallControlOptions): string {
    // Telnyx uses TeXML (similar to TwiML but with some differences)
    let texml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>';

    if (options.pause) {
      texml += `\n  <Pause length="${options.pause}"/>`;
    }

    if (options.playAudio) {
      texml += `\n  <Play>${this.escapeXML(options.playAudio)}</Play>`;
    }

    if (options.speak) {
      const voice = this.mapVoice(options.speak.voice);
      const language = options.speak.language ?? 'en-US';

      if (options.gather) {
        const gather = options.gather;
        texml += `\n  <Gather numDigits="${gather.maxDigits ?? 20}" timeout="${gather.timeout ?? 5}" finishOnKey="${gather.finishOnKey ?? '#'}" action="${gather.action ?? ''}">`;
        texml += `\n    <Say voice="${voice}" language="${language}">${this.escapeXML(options.speak.text)}</Say>`;
        texml += '\n  </Gather>';
        texml += `\n  <Say voice="${voice}">I didn't hear anything. Goodbye.</Say>`;
      } else {
        texml += `\n  <Say voice="${voice}" language="${language}">${this.escapeXML(options.speak.text)}</Say>`;
      }
    }

    if (options.record) {
      texml += '\n  <Record maxLength="300" playBeep="true"/>';
    }

    if (options.hangup) {
      texml += '\n  <Hangup/>';
    }

    texml += '\n</Response>';
    return texml;
  }

  parseWebhook(payload: Record<string, unknown>): VoiceWebhookPayload | SMSWebhookPayload {
    const data = (payload.data as Record<string, unknown>) ?? payload;
    const eventType = String(data.event_type ?? payload.event_type ?? '');

    // Determine if this is a call or message event
    if (eventType.startsWith('call.') || data.call_control_id) {
      return {
        provider: 'telnyx',
        callId: String(data.call_control_id ?? data.call_leg_id ?? ''),
        event: this.mapWebhookEvent(eventType),
        from: String((data.from as any)?.phone_number ?? data.from ?? ''),
        to: String((data.to as any)?.phone_number ?? data.to ?? ''),
        status: this.mapCallStatusFromEvent(eventType),
        duration: data.duration_secs ? Number(data.duration_secs) : undefined,
        recordingUrl: data.recording_url ? String(data.recording_url) : undefined,
        digits: data.digits ? String(data.digits) : undefined,
        speechResult: data.speech ? String((data.speech as any).transcript) : undefined,
        answeredBy: data.answering_machine_detection ?
          (String(data.answering_machine_detection) === 'human' ? 'human' : 'machine') : undefined,
        timestamp: new Date(),
        rawPayload: payload,
      };
    } else {
      return {
        provider: 'telnyx',
        messageId: String(data.id ?? ''),
        event: this.mapSMSWebhookEvent(eventType),
        from: String((data.from as any)?.phone_number ?? ''),
        to: String(((data.to as any[])?.[0] as any)?.phone_number ?? ''),
        body: data.text ? String(data.text) : undefined,
        status: this.mapSMSStatusFromEvent(eventType),
        timestamp: new Date(),
        rawPayload: payload,
      };
    }
  }

  async getRecording(callId: string): Promise<string | null> {
    try {
      const response = await this.request<any>(`/recordings?filter[call_leg_id]=${callId}`);
      if (response.data?.length > 0) {
        return response.data[0].download_urls?.mp3 ?? null;
      }
      return null;
    } catch (error: any) {
      logger.error('[Telnyx] Get recording error:', error, { file: 'telnyx-provider.ts' });
      return null;
    }
  }

  async deleteRecording(recordingId: string): Promise<void> {
    try {
      await this.request(`/recordings/${recordingId}`, 'DELETE');
    } catch (error: any) {
      logger.error('[Telnyx] Delete recording error:', error, { file: 'telnyx-provider.ts' });
      throw new Error(`Failed to delete recording: ${error.message}`);
    }
  }

  async listPhoneNumbers(): Promise<Array<{ number: string; capabilities: string[] }>> {
    try {
      const response = await this.request<any>('/phone_numbers');
      return response.data.map((n: any) => ({
        number: n.phone_number,
        capabilities: [
          n.voice_enabled && 'voice',
          n.sms_enabled && 'sms',
          n.mms_enabled && 'mms',
        ].filter(Boolean) as string[],
      }));
    } catch (error: any) {
      logger.error('[Telnyx] List numbers error:', error, { file: 'telnyx-provider.ts' });
      throw new Error(`Failed to list phone numbers: ${error.message}`);
    }
  }

  async purchasePhoneNumber(areaCode?: string, country?: string): Promise<string> {
    try {
      // Search for available numbers
      const searchParams = new URLSearchParams({
        'filter[country_code]': country ?? 'US',
        'filter[features]': 'voice,sms',
        'filter[limit]': '1',
      });

      if (areaCode) {
        searchParams.set('filter[national_destination_code]', areaCode);
      }

      const available = await this.request<any>(`/available_phone_numbers?${searchParams}`);

      if (!available.data?.length) {
        throw new Error('No phone numbers available in that area');
      }

      // Reserve and purchase the number
      const connectionId = await this.getConnectionId();
      const response = await this.request<any>('/number_orders', 'POST', {
        phone_numbers: [{ phone_number: available.data[0].phone_number }],
        connection_id: connectionId,
        messaging_profile_id: undefined, // Optional: add messaging profile if needed
      });

      return response.data.phone_numbers[0].phone_number;
    } catch (error: any) {
      logger.error('[Telnyx] Purchase number error:', error, { file: 'telnyx-provider.ts' });
      throw new Error(`Failed to purchase phone number: ${error.message}`);
    }
  }

  async releasePhoneNumber(number: string): Promise<void> {
    try {
      // Find the phone number ID
      const response = await this.request<any>(`/phone_numbers?filter[phone_number]=${encodeURIComponent(number)}`);

      if (response.data?.length > 0) {
        await this.request(`/phone_numbers/${response.data[0].id}`, 'DELETE');
      }
    } catch (error: any) {
      logger.error('[Telnyx] Release number error:', error, { file: 'telnyx-provider.ts' });
      throw new Error(`Failed to release phone number: ${error.message}`);
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.request('/balance');
      return true;
    } catch {
      return false;
    }
  }

  // Helper methods
  private mapCallToVoiceCall(call: any): VoiceCall {
    return {
      callId: call.call_control_id ?? call.id,
      from: call.from?.phone_number ?? call.from ?? '',
      to: call.to?.phone_number ?? call.to ?? '',
      status: this.mapCallStatus(call.state ?? call.status),
      direction: call.direction === 'outgoing' ? 'outbound' : 'inbound',
      startTime: call.start_time ? new Date(call.start_time) : undefined,
      endTime: call.end_time ? new Date(call.end_time) : undefined,
    };
  }

  private mapCallStatus(status: string): CallStatus {
    const statusMap: Record<string, CallStatus> = {
      queued: 'queued',
      ringing: 'ringing',
      active: 'in-progress',
      answered: 'in-progress',
      bridged: 'in-progress',
      hangup: 'completed',
      machine_detection_ended: 'in-progress',
    };
    return statusMap[status] ?? 'queued';
  }

  private mapCallStatusFromEvent(event: string): CallStatus {
    const eventMap: Record<string, CallStatus> = {
      'call.initiated': 'queued',
      'call.ringing': 'ringing',
      'call.answered': 'in-progress',
      'call.bridged': 'in-progress',
      'call.hangup': 'completed',
      'call.machine.detection.ended': 'in-progress',
    };
    return eventMap[event] ?? 'queued';
  }

  private mapSMSStatus(status: string): SMSStatus {
    const statusMap: Record<string, SMSStatus> = {
      queued: 'queued',
      sending: 'sending',
      sent: 'sent',
      delivered: 'delivered',
      failed: 'failed',
    };
    return statusMap[status] ?? 'queued';
  }

  private mapSMSStatusFromEvent(event: string): SMSStatus {
    const eventMap: Record<string, SMSStatus> = {
      'message.sent': 'sent',
      'message.finalized': 'delivered',
      'message.failed': 'failed',
    };
    return eventMap[event] ?? 'sent';
  }

  private mapWebhookEvent(eventType: string): VoiceWebhookPayload['event'] {
    const eventMap: Record<string, VoiceWebhookPayload['event']> = {
      'call.initiated': 'initiated',
      'call.ringing': 'ringing',
      'call.answered': 'answered',
      'call.hangup': 'completed',
      'call.recording.saved': 'recording-available',
      'call.dtmf.received': 'dtmf',
      'call.speak.ended': 'speech',
      'call.gather.ended': 'speech',
    };
    return eventMap[eventType] ?? 'initiated';
  }

  private mapSMSWebhookEvent(eventType: string): SMSWebhookPayload['event'] {
    const eventMap: Record<string, SMSWebhookPayload['event']> = {
      'message.received': 'received',
      'message.sent': 'sent',
      'message.finalized': 'delivered',
      'message.failed': 'failed',
    };
    return eventMap[eventType] ?? 'sent';
  }

  private mapVoice(voice?: string): string {
    // Map common voice names to Telnyx voices
    const voiceMap: Record<string, string> = {
      'Polly.Joanna': 'female',
      'Polly.Matthew': 'male',
      'alice': 'female',
      'man': 'male',
      'woman': 'female',
    };
    return voiceMap[voice ?? ''] ?? 'female';
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

export default TelnyxProvider;
