/**
 * Voice Service Module
 * Multi-provider VoIP abstraction layer with AI-powered conversation
 *
 * Usage:
 * ```typescript
 * import { VoiceProviderFactory, voiceAgentHandler, aiConversationService } from '@/lib/voice';
 *
 * // Get the best available provider
 * const provider = await VoiceProviderFactory.getProvider();
 *
 * // Initiate a call
 * const call = await provider.initiateCall('+15551234567', 'agent-123');
 *
 * // Start AI conversation
 * await voiceAgentHandler.initialize({ mode: 'prospector', agentId: 'ai-1' });
 * const response = await voiceAgentHandler.startConversation(call);
 *
 * // Get cost comparison
 * const costs = await VoiceProviderFactory.getCostComparison();
 * ```
 */

// Types
export * from './types';

// Factory
export { VoiceProviderFactory } from './voice-factory';

// Providers (for direct instantiation if needed)
export { TwilioProvider } from './providers/twilio-provider';
export { TelnyxProvider } from './providers/telnyx-provider';

// Voice Agent Handler (Prospector & Closer modes)
export { voiceAgentHandler } from './voice-agent-handler';
export type {
  VoiceAgentMode,
  VoiceAgentConfig,
  AgentResponse,
  ConversationContext,
  ConversationState,
} from './voice-agent-handler';

// AI Conversation Service
export { aiConversationService } from './ai-conversation-service';
export type {
  AIConversationMode,
  ConversationConfig,
  ConversationTurn,
  AIResponse,
} from './ai-conversation-service';

// Call Transfer Service
export { callTransferService } from './call-transfer-service';
export type { TransferRequest, TransferResult, AIHandoffContext } from './call-transfer-service';

// Call Context Service
export { callContextService } from './call-context-service';
export type { StoredCallContext, CallContextQuery } from './call-context-service';

// CRM Voice Activity
export { crmVoiceActivity } from './crm-voice-activity';

// TTS Voice Engine (Text-to-Speech marketplace)
export { VoiceEngineFactory } from './tts/voice-engine-factory';
export * from './tts/types';
export { NativeProvider as NativeTTSProvider } from './tts/providers/native-provider';
export { UnrealProvider as UnrealTTSProvider } from './tts/providers/unreal-provider';
export { ElevenLabsProvider as ElevenLabsTTSProvider } from './tts/providers/elevenlabs-provider';

// Legacy compatibility - re-export key functions from old API
import { VoiceProviderFactory } from './voice-factory';
import type { VoiceCall, SMSMessage } from './types';

/**
 * @deprecated Use VoiceProviderFactory.getProvider() instead
 * Legacy function for backwards compatibility
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
  const provider = await VoiceProviderFactory.getProvider(organizationId);
  return provider.initiateCall(to, agentId, options);
}

/**
 * @deprecated Use VoiceProviderFactory.getProvider() instead
 * Legacy function for backwards compatibility
 */
export async function sendSMS(
  organizationId: string,
  to: string,
  message: string
): Promise<SMSMessage> {
  const provider = await VoiceProviderFactory.getProvider(organizationId);
  return provider.sendSMS(to, message);
}

/**
 * @deprecated Use provider.generateResponse() instead
 * Legacy function for backwards compatibility
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
  const voice = options?.voice ?? 'Polly.Joanna';
  const language = options?.language ?? 'en-US';

  if (options?.gather) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${options.action ?? ''}" language="${language}" timeout="3" speechTimeout="auto">
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

function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
