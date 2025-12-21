/**
 * Twilio Voice Service
 * Voice agents - AI that speaks and listens via phone calls
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';

export interface VoiceConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

export interface VoiceCall {
  callSid: string;
  from: string;
  to: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'failed';
  duration?: number;
  recording?: string;
}

/**
 * Initiate outbound voice call
 */
export async function initiateCall(
  organizationId: string,
  to: string,
  agentId: string,
  options?: {
    record?: boolean;
    timeout?: number;
  }
): Promise<VoiceCall> {
  try {
    const config = await getTwilioConfig(organizationId);
    const twilio = await import('twilio');
    const client = twilio.default(config.accountSid, config.authToken);
    
    // TwiML URL for AI agent interaction
    const twimlUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/agent/${agentId}`;
    
    const call = await client.calls.create({
      from: config.phoneNumber,
      to,
      url: twimlUrl,
      record: options?.record,
      timeout: options?.timeout || 30,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/status`,
    });
    
    return {
      callSid: call.sid,
      from: call.from,
      to: call.to,
      status: call.status as any,
    };
  } catch (error: any) {
    console.error('[Twilio] Call initiation error:', error);
    throw new Error(`Failed to initiate call: ${error.message}`);
  }
}

/**
 * Generate TwiML response for AI agent
 */
export function generateAgentTwiML(
  message: string,
  options?: {
    voice?: 'man' | 'woman' | 'alice' | 'Polly.Joanna' | 'Polly.Matthew';
    language?: string;
    gather?: boolean;
    action?: string;
  }
): string {
  const voice = options?.voice || 'Polly.Joanna'; // Amazon Polly voices
  const language = options?.language || 'en-US';
  
  if (options?.gather) {
    // Gather user speech input
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${options.action}" language="${language}" timeout="3" speechTimeout="auto">
    <Say voice="${voice}" language="${language}">${escapeXML(message)}</Say>
  </Gather>
  <Say voice="${voice}">I didn't hear anything. Goodbye.</Say>
</Response>`;
  }
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">${escapeXML(message)}</Say>
</Response>`;
}

/**
 * Convert speech to text using Twilio/Google
 */
export async function speechToText(
  audioUrl: string,
  organizationId: string
): Promise<string> {
  try {
    // Use Whisper API for speech-to-text
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        file: audioUrl,
        model: 'whisper-1',
      }),
    });
    
    if (!response.ok) {
      throw new Error('Speech-to-text conversion failed');
    }
    
    const data = await response.json();
    return data.text;
  } catch (error: any) {
    console.error('[Speech-to-Text] Error:', error);
    throw new Error(`Speech-to-text failed: ${error.message}`);
  }
}

/**
 * Send SMS message
 */
export async function sendSMS(
  organizationId: string,
  to: string,
  message: string
): Promise<{ messageSid: string; status: string }> {
  try {
    const config = await getTwilioConfig(organizationId);
    const twilio = await import('twilio');
    const client = twilio.default(config.accountSid, config.authToken);
    
    const msg = await client.messages.create({
      from: config.phoneNumber,
      to,
      body: message,
    });
    
    return {
      messageSid: msg.sid,
      status: msg.status,
    };
  } catch (error: any) {
    console.error('[Twilio] SMS error:', error);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
}

/**
 * Get call details
 */
export async function getCallDetails(
  organizationId: string,
  callSid: string
): Promise<VoiceCall> {
  try {
    const config = await getTwilioConfig(organizationId);
    const twilio = await import('twilio');
    const client = twilio.default(config.accountSid, config.authToken);
    
    const call = await client.calls(callSid).fetch();
    
    return {
      callSid: call.sid,
      from: call.from,
      to: call.to,
      status: call.status as any,
      duration: parseInt(call.duration || '0'),
    };
  } catch (error: any) {
    console.error('[Twilio] Get call error:', error);
    throw new Error(`Failed to get call details: ${error.message}`);
  }
}

/**
 * Get call recording
 */
export async function getCallRecording(
  organizationId: string,
  callSid: string
): Promise<string | null> {
  try {
    const config = await getTwilioConfig(organizationId);
    const twilio = await import('twilio');
    const client = twilio.default(config.accountSid, config.authToken);
    
    const recordings = await client.recordings.list({ callSid, limit: 1 });
    
    if (recordings.length === 0) {
      return null;
    }
    
    return `https://api.twilio.com${recordings[0].uri.replace('.json', '.mp3')}`;
  } catch (error: any) {
    console.error('[Twilio] Get recording error:', error);
    return null;
  }
}

/**
 * Get Twilio configuration
 */
async function getTwilioConfig(organizationId: string): Promise<VoiceConfig> {
  const keys = await apiKeyService.getServiceKey(organizationId, 'twilio');
  
  if (!keys) {
    throw new Error('Twilio not configured');
  }
  
  const config = keys as any;
  
  if (!config.accountSid || !config.authToken || !config.phoneNumber) {
    throw new Error('Twilio configuration incomplete');
  }
  
  return {
    accountSid: config.accountSid,
    authToken: config.authToken,
    phoneNumber: config.phoneNumber,
  };
}

/**
 * Escape XML special characters
 */
function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Voice agent conversation handler
 */
export class VoiceAgentHandler {
  private conversationHistory: Map<string, Array<{ role: string; content: string }>> = new Map();
  
  async handleIncomingCall(
    callSid: string,
    from: string,
    agentId: string
  ): Promise<string> {
    // Initialize conversation
    this.conversationHistory.set(callSid, []);
    
    // Get agent greeting
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    const agent = await FirestoreService.get(`${COLLECTIONS.ORGANIZATIONS}/*/agents`, agentId);
    
    const greeting = (agent as any)?.greeting || 'Hello! How can I help you today?';
    
    return generateAgentTwiML(greeting, {
      gather: true,
      action: `/api/voice/agent/${agentId}/respond`,
    });
  }
  
  async handleSpeechInput(
    callSid: string,
    agentId: string,
    speechResult: string
  ): Promise<string> {
    // Get conversation history
    const history = this.conversationHistory.get(callSid) || [];
    
    // Add user input
    history.push({ role: 'user', content: speechResult });
    
    // Get AI response
    const { sendUnifiedChatMessage } = await import('@/lib/ai/unified-ai-service');
    
    const response = await sendUnifiedChatMessage({
      model: 'gpt-4-turbo', // Use GPT-4 for voice
      messages: history.map(h => ({
        role: h.role as any,
        content: h.content,
      })),
    });
    
    // Add AI response to history
    history.push({ role: 'assistant', content: response.text });
    this.conversationHistory.set(callSid, history);
    
    // Generate TwiML response
    return generateAgentTwiML(response.text, {
      gather: true,
      action: `/api/voice/agent/${agentId}/respond`,
    });
  }
  
  async endCall(callSid: string): Promise<void> {
    // Clean up conversation history
    this.conversationHistory.delete(callSid);
  }
}

export const voiceAgentHandler = new VoiceAgentHandler();


















