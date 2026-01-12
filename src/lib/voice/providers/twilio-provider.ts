/**
 * Twilio Voice Provider
 * Implements VoiceProvider interface for Twilio
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

export class TwilioProvider implements VoiceProvider {
  readonly providerType: VoiceProviderType = 'twilio';
  readonly costs: VoiceProviderCosts = {
    voicePerMinuteCents: 1.3,
    smsPerMessageCents: 0.79,
    phoneNumberMonthlyCents: 1500,
    recordingPerMinuteCents: 0.25,
  };

  private client: any = null;
  private config: VoiceProviderConfig;
  private organizationId: string;

  constructor(config: VoiceProviderConfig, organizationId: string) {
    this.config = config;
    this.organizationId = organizationId;
  }

  private async getClient(): Promise<any> {
    if (!this.client) {
      const twilio = await import('twilio');
      this.client = twilio.default(this.config.accountId, this.config.authToken);
    }
    return this.client;
  }

  async initiateCall(to: string, agentId: string, options?: InitiateCallOptions): Promise<VoiceCall> {
    try {
      const client = await this.getClient();
      const twimlUrl = `${this.config.webhookBaseUrl}/api/voice/agent/${agentId}`;

      const call = await client.calls.create({
        from: options?.callerId ?? this.config.phoneNumber,
        to,
        url: twimlUrl,
        record: options?.record,
        timeout: options?.timeout ?? 30,
        statusCallback: options?.statusCallback ?? `${this.config.webhookBaseUrl}/api/voice/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        machineDetection: options?.machineDetection ? 'Enable' : undefined,
      });

      return this.mapCallToVoiceCall(call);
    } catch (error: any) {
      logger.error('[Twilio] Call initiation error:', error, { file: 'twilio-provider.ts' });
      throw new Error(`Failed to initiate call: ${error.message}`);
    }
  }

  async getCall(callId: string): Promise<VoiceCall> {
    try {
      const client = await this.getClient();
      const call = await client.calls(callId).fetch();
      return this.mapCallToVoiceCall(call);
    } catch (error: any) {
      logger.error('[Twilio] Get call error:', error, { file: 'twilio-provider.ts' });
      throw new Error(`Failed to get call: ${error.message}`);
    }
  }

  async updateCall(callId: string, options: CallControlOptions): Promise<void> {
    try {
      const client = await this.getClient();
      const updateParams: any = {};

      if (options.hangup) {
        updateParams.status = 'completed';
      } else if (options.playAudio || options.speak || options.gather) {
        // Generate TwiML and use URL
        const twiml = this.generateResponse(options);
        updateParams.twiml = twiml;
      }

      await client.calls(callId).update(updateParams);
    } catch (error: any) {
      logger.error('[Twilio] Update call error:', error, { file: 'twilio-provider.ts' });
      throw new Error(`Failed to update call: ${error.message}`);
    }
  }

  async endCall(callId: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.calls(callId).update({ status: 'completed' });
    } catch (error: any) {
      logger.error('[Twilio] End call error:', error, { file: 'twilio-provider.ts' });
      throw new Error(`Failed to end call: ${error.message}`);
    }
  }

  async transfer(callId: string, options: TransferOptions): Promise<void> {
    try {
      const client = await this.getClient();
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${options.callerId ?? this.config.phoneNumber}" timeout="${options.timeout ?? 30}">
    <Number>${options.to}</Number>
  </Dial>
</Response>`;

      await client.calls(callId).update({ twiml });
    } catch (error: any) {
      logger.error('[Twilio] Transfer error:', error, { file: 'twilio-provider.ts' });
      throw new Error(`Failed to transfer call: ${error.message}`);
    }
  }

  async addToConference(callId: string, options: ConferenceOptions): Promise<void> {
    try {
      const client = await this.getClient();
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference
      startConferenceOnEnter="${options.startConferenceOnEnter ?? true}"
      endConferenceOnExit="${options.endConferenceOnExit ?? false}"
      muted="${options.muted ?? false}"
      beep="${options.beep ?? true}"
      ${options.waitUrl ? `waitUrl="${options.waitUrl}"` : ''}
    >${options.name}</Conference>
  </Dial>
</Response>`;

      await client.calls(callId).update({ twiml });
    } catch (error: any) {
      logger.error('[Twilio] Conference error:', error, { file: 'twilio-provider.ts' });
      throw new Error(`Failed to add to conference: ${error.message}`);
    }
  }

  async muteCall(callId: string, muted: boolean): Promise<void> {
    try {
      const client = await this.getClient();
      // Twilio requires conference for muting; for direct calls we'd need to update the media stream
      // This is a simplified implementation
      logger.warn('[Twilio] Mute requires conference context', { file: 'twilio-provider.ts' });
    } catch (error: any) {
      logger.error('[Twilio] Mute error:', error, { file: 'twilio-provider.ts' });
      throw new Error(`Failed to mute call: ${error.message}`);
    }
  }

  async holdCall(callId: string, hold: boolean): Promise<void> {
    try {
      const client = await this.getClient();
      if (hold) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play loop="0">https://api.twilio.com/cowbell.mp3</Play>
</Response>`;
        await client.calls(callId).update({ twiml });
      } else {
        // Resume would require storing and restoring the previous state
        logger.warn('[Twilio] Hold resume requires state management', { file: 'twilio-provider.ts' });
      }
    } catch (error: any) {
      logger.error('[Twilio] Hold error:', error, { file: 'twilio-provider.ts' });
      throw new Error(`Failed to hold call: ${error.message}`);
    }
  }

  async sendSMS(to: string, message: string): Promise<SMSMessage> {
    try {
      const client = await this.getClient();
      const msg = await client.messages.create({
        from: this.config.phoneNumber,
        to,
        body: message,
      });

      return {
        messageId: msg.sid,
        from: msg.from,
        to: msg.to,
        body: msg.body,
        status: this.mapSMSStatus(msg.status),
        direction: 'outbound',
        sentAt: new Date(),
      };
    } catch (error: any) {
      logger.error('[Twilio] SMS error:', error, { file: 'twilio-provider.ts' });
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  async getSMS(messageId: string): Promise<SMSMessage> {
    try {
      const client = await this.getClient();
      const msg = await client.messages(messageId).fetch();

      return {
        messageId: msg.sid,
        from: msg.from,
        to: msg.to,
        body: msg.body,
        status: this.mapSMSStatus(msg.status),
        direction: msg.direction === 'outbound-api' ? 'outbound' : 'inbound',
        sentAt: msg.dateSent ? new Date(msg.dateSent) : undefined,
      };
    } catch (error: any) {
      logger.error('[Twilio] Get SMS error:', error, { file: 'twilio-provider.ts' });
      throw new Error(`Failed to get SMS: ${error.message}`);
    }
  }

  generateResponse(options: CallControlOptions): string {
    let twiml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>';

    if (options.pause) {
      twiml += `\n  <Pause length="${options.pause}"/>`;
    }

    if (options.playAudio) {
      twiml += `\n  <Play>${this.escapeXML(options.playAudio)}</Play>`;
    }

    if (options.speak) {
      const voice = options.speak.voice ?? 'Polly.Joanna';
      const language = options.speak.language ?? 'en-US';

      if (options.gather) {
        const gather = options.gather;
        const inputs = gather.input?.join(' ') ?? 'speech';
        twiml += `\n  <Gather input="${inputs}" action="${gather.action ?? ''}" timeout="${gather.timeout ?? 3}" speechTimeout="${gather.speechTimeout ?? 'auto'}">`;
        twiml += `\n    <Say voice="${voice}" language="${language}">${this.escapeXML(options.speak.text)}</Say>`;
        twiml += '\n  </Gather>';
        twiml += `\n  <Say voice="${voice}">I didn't hear anything. Goodbye.</Say>`;
      } else {
        twiml += `\n  <Say voice="${voice}" language="${language}">${this.escapeXML(options.speak.text)}</Say>`;
      }
    }

    if (options.record) {
      twiml += '\n  <Record maxLength="300" playBeep="true"/>';
    }

    if (options.hangup) {
      twiml += '\n  <Hangup/>';
    }

    twiml += '\n</Response>';
    return twiml;
  }

  parseWebhook(payload: Record<string, unknown>): VoiceWebhookPayload | SMSWebhookPayload {
    // Determine if this is a call or SMS webhook
    if (payload.CallSid || payload.CallStatus) {
      return {
        provider: 'twilio',
        callId: String(payload.CallSid ?? ''),
        event: this.mapWebhookEvent(String(payload.CallStatus ?? '')),
        from: String(payload.From ?? ''),
        to: String(payload.To ?? ''),
        status: this.mapCallStatus(String(payload.CallStatus ?? '')),
        duration: payload.CallDuration ? parseInt(String(payload.CallDuration)) : undefined,
        recordingUrl: payload.RecordingUrl ? String(payload.RecordingUrl) : undefined,
        digits: payload.Digits ? String(payload.Digits) : undefined,
        speechResult: payload.SpeechResult ? String(payload.SpeechResult) : undefined,
        answeredBy: payload.AnsweredBy ? String(payload.AnsweredBy) as any : undefined,
        timestamp: new Date(),
        rawPayload: payload,
      };
    } else {
      return {
        provider: 'twilio',
        messageId: String(payload.MessageSid ?? ''),
        event: this.mapSMSWebhookEvent(String(payload.SmsStatus ?? payload.MessageStatus ?? '')),
        from: String(payload.From ?? ''),
        to: String(payload.To ?? ''),
        body: payload.Body ? String(payload.Body) : undefined,
        status: this.mapSMSStatus(String(payload.SmsStatus ?? payload.MessageStatus ?? '')),
        timestamp: new Date(),
        rawPayload: payload,
      };
    }
  }

  async getRecording(callId: string): Promise<string | null> {
    try {
      const client = await this.getClient();
      const recordings = await client.recordings.list({ callSid: callId, limit: 1 });

      if (recordings.length === 0) {
        return null;
      }

      return `https://api.twilio.com${recordings[0].uri.replace('.json', '.mp3')}`;
    } catch (error: any) {
      logger.error('[Twilio] Get recording error:', error, { file: 'twilio-provider.ts' });
      return null;
    }
  }

  async deleteRecording(recordingId: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.recordings(recordingId).remove();
    } catch (error: any) {
      logger.error('[Twilio] Delete recording error:', error, { file: 'twilio-provider.ts' });
      throw new Error(`Failed to delete recording: ${error.message}`);
    }
  }

  async listPhoneNumbers(): Promise<Array<{ number: string; capabilities: string[] }>> {
    try {
      const client = await this.getClient();
      const numbers = await client.incomingPhoneNumbers.list();

      return numbers.map((n: any) => ({
        number: n.phoneNumber,
        capabilities: [
          n.capabilities.voice && 'voice',
          n.capabilities.sms && 'sms',
          n.capabilities.mms && 'mms',
        ].filter(Boolean) as string[],
      }));
    } catch (error: any) {
      logger.error('[Twilio] List numbers error:', error, { file: 'twilio-provider.ts' });
      throw new Error(`Failed to list phone numbers: ${error.message}`);
    }
  }

  async purchasePhoneNumber(areaCode?: string, country?: string): Promise<string> {
    try {
      const client = await this.getClient();

      // Search for available numbers
      const available = await client.availablePhoneNumbers(country ?? 'US').local.list({
        areaCode: areaCode ? parseInt(areaCode) : undefined,
        voiceEnabled: true,
        smsEnabled: true,
        limit: 1,
      });

      if (available.length === 0) {
        throw new Error('No phone numbers available in that area');
      }

      // Purchase the number
      const purchased = await client.incomingPhoneNumbers.create({
        phoneNumber: available[0].phoneNumber,
        voiceUrl: `${this.config.webhookBaseUrl}/api/voice/incoming`,
        smsUrl: `${this.config.webhookBaseUrl}/api/sms/incoming`,
      });

      return purchased.phoneNumber;
    } catch (error: any) {
      logger.error('[Twilio] Purchase number error:', error, { file: 'twilio-provider.ts' });
      throw new Error(`Failed to purchase phone number: ${error.message}`);
    }
  }

  async releasePhoneNumber(number: string): Promise<void> {
    try {
      const client = await this.getClient();
      const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: number });

      if (numbers.length > 0) {
        await client.incomingPhoneNumbers(numbers[0].sid).remove();
      }
    } catch (error: any) {
      logger.error('[Twilio] Release number error:', error, { file: 'twilio-provider.ts' });
      throw new Error(`Failed to release phone number: ${error.message}`);
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.api.accounts(this.config.accountId).fetch();
      return true;
    } catch {
      return false;
    }
  }

  // Helper methods
  private mapCallToVoiceCall(call: any): VoiceCall {
    return {
      callId: call.sid,
      from: call.from,
      to: call.to,
      status: this.mapCallStatus(call.status),
      direction: call.direction === 'outbound-api' ? 'outbound' : 'inbound',
      duration: call.duration ? parseInt(call.duration) : undefined,
      startTime: call.startTime ? new Date(call.startTime) : undefined,
      endTime: call.endTime ? new Date(call.endTime) : undefined,
    };
  }

  private mapCallStatus(status: string): CallStatus {
    const statusMap: Record<string, CallStatus> = {
      queued: 'queued',
      ringing: 'ringing',
      'in-progress': 'in-progress',
      completed: 'completed',
      busy: 'busy',
      failed: 'failed',
      'no-answer': 'no-answer',
      canceled: 'canceled',
    };
    return statusMap[status] ?? 'queued';
  }

  private mapSMSStatus(status: string): SMSStatus {
    const statusMap: Record<string, SMSStatus> = {
      queued: 'queued',
      sending: 'sending',
      sent: 'sent',
      delivered: 'delivered',
      failed: 'failed',
      undelivered: 'undelivered',
    };
    return statusMap[status] ?? 'queued';
  }

  private mapWebhookEvent(status: string): VoiceWebhookPayload['event'] {
    const eventMap: Record<string, VoiceWebhookPayload['event']> = {
      initiated: 'initiated',
      ringing: 'ringing',
      'in-progress': 'answered',
      answered: 'answered',
      completed: 'completed',
    };
    return eventMap[status] ?? 'initiated';
  }

  private mapSMSWebhookEvent(status: string): SMSWebhookPayload['event'] {
    const eventMap: Record<string, SMSWebhookPayload['event']> = {
      received: 'received',
      sent: 'sent',
      delivered: 'delivered',
      failed: 'failed',
      undelivered: 'failed',
    };
    return eventMap[status] ?? 'sent';
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

export default TwilioProvider;
