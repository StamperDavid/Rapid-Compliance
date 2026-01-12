/**
 * VoIP Service Types
 * Provider-agnostic interfaces for voice/SMS services
 * Supports: Twilio, Telnyx, Bandwidth, Vonage
 */

export type VoiceProviderType = 'twilio' | 'telnyx' | 'bandwidth' | 'vonage';

export interface VoiceProviderConfig {
  accountId: string;
  authToken: string;
  phoneNumber: string;
  webhookBaseUrl?: string;
}

export interface VoiceCall {
  callId: string;
  from: string;
  to: string;
  status: CallStatus;
  direction: 'inbound' | 'outbound';
  duration?: number;
  recordingUrl?: string;
  startTime?: Date;
  endTime?: Date;
  answeredBy?: 'human' | 'machine' | 'unknown';
  costCents?: number;
  metadata?: Record<string, unknown>;
}

export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'on-hold'
  | 'completed'
  | 'failed'
  | 'busy'
  | 'no-answer'
  | 'canceled';

export interface SMSMessage {
  messageId: string;
  from: string;
  to: string;
  body: string;
  status: SMSStatus;
  direction: 'inbound' | 'outbound';
  sentAt?: Date;
  deliveredAt?: Date;
  costCents?: number;
}

export type SMSStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'undelivered';

export interface InitiateCallOptions {
  record?: boolean;
  timeout?: number;
  machineDetection?: boolean;
  statusCallback?: string;
  recordingCallback?: string;
  callerId?: string;
  sipHeaders?: Record<string, string>;
}

export interface CallControlOptions {
  playAudio?: string;
  speak?: {
    text: string;
    voice?: string;
    language?: string;
  };
  gather?: {
    maxDigits?: number;
    timeout?: number;
    finishOnKey?: string;
    speechTimeout?: number;
    input?: ('dtmf' | 'speech')[];
    action?: string;
  };
  record?: boolean;
  pause?: number;
  hangup?: boolean;
}

export interface TransferOptions {
  to: string;
  callerId?: string;
  timeout?: number;
  announceUrl?: string;
  whisperUrl?: string;
}

export interface ConferenceOptions {
  name: string;
  startConferenceOnEnter?: boolean;
  endConferenceOnExit?: boolean;
  muted?: boolean;
  beep?: boolean;
  waitUrl?: string;
  coach?: string;
}

export interface VoiceWebhookPayload {
  provider: VoiceProviderType;
  callId: string;
  event: 'initiated' | 'ringing' | 'answered' | 'completed' | 'recording-available' | 'dtmf' | 'speech';
  from: string;
  to: string;
  status?: CallStatus;
  duration?: number;
  recordingUrl?: string;
  digits?: string;
  speechResult?: string;
  answeredBy?: 'human' | 'machine' | 'unknown';
  timestamp: Date;
  rawPayload: Record<string, unknown>;
}

export interface SMSWebhookPayload {
  provider: VoiceProviderType;
  messageId: string;
  event: 'received' | 'sent' | 'delivered' | 'failed';
  from: string;
  to: string;
  body?: string;
  status?: SMSStatus;
  timestamp: Date;
  rawPayload: Record<string, unknown>;
}

export interface VoiceProviderCosts {
  voicePerMinuteCents: number;
  smsPerMessageCents: number;
  phoneNumberMonthlyCents: number;
  recordingPerMinuteCents: number;
}

export interface VoiceProvider {
  readonly providerType: VoiceProviderType;
  readonly costs: VoiceProviderCosts;

  // Call management
  initiateCall(to: string, agentId: string, options?: InitiateCallOptions): Promise<VoiceCall>;
  getCall(callId: string): Promise<VoiceCall>;
  updateCall(callId: string, options: CallControlOptions): Promise<void>;
  endCall(callId: string): Promise<void>;

  // Call control
  transfer(callId: string, options: TransferOptions): Promise<void>;
  addToConference(callId: string, options: ConferenceOptions): Promise<void>;
  muteCall(callId: string, muted: boolean): Promise<void>;
  holdCall(callId: string, hold: boolean): Promise<void>;

  // SMS
  sendSMS(to: string, message: string): Promise<SMSMessage>;
  getSMS(messageId: string): Promise<SMSMessage>;

  // TwiML/RCML generation (provider-specific response format)
  generateResponse(options: CallControlOptions): string;

  // Webhook parsing
  parseWebhook(payload: Record<string, unknown>): VoiceWebhookPayload | SMSWebhookPayload;

  // Recording
  getRecording(callId: string): Promise<string | null>;
  deleteRecording(recordingId: string): Promise<void>;

  // Phone number management
  listPhoneNumbers(): Promise<Array<{ number: string; capabilities: string[] }>>;
  purchasePhoneNumber(areaCode?: string, country?: string): Promise<string>;
  releasePhoneNumber(number: string): Promise<void>;

  // Health check
  validateConfig(): Promise<boolean>;
}

export interface WebRTCCredentials {
  identity: string;
  token: string;
  expires: Date;
  iceServers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
}

export interface PowerDialerConfig {
  maxConcurrentCalls: number;
  dialDelay: number;
  abandonTimeout: number;
  voicemailDetection: boolean;
  voicemailDropAudioUrl?: string;
  localPresence: boolean;
}

export interface DialerCallResult {
  call: VoiceCall;
  outcome: 'answered' | 'voicemail' | 'busy' | 'no-answer' | 'failed';
  talkTime?: number;
  disposition?: string;
  notes?: string;
}
