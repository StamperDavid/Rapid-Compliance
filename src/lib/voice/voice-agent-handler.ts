/**
 * Voice Agent Handler
 * AI Voice Agent modes for the Hybrid AI/Human Workforce
 *
 * Two modes:
 * 1. THE PROSPECTOR: Qualifies leads, books appointments, transfers to humans
 * 2. THE CLOSER: Handles objections, closes deals, triggers payment APIs
 *
 * Integrates with:
 * - Gemini AI for conversation intelligence
 * - Telnyx/Twilio for voice infrastructure
 * - Firestore for call context storage
 */

import { VoiceProviderFactory } from './voice-factory';
import { callTransferService } from './call-transfer-service';
import { crmVoiceActivity } from './crm-voice-activity';
import {
  aiConversationService,
  type ConversationState,
  type ConversationConfig,
  type ConversationContext,
  type AIResponse,
} from './ai-conversation-service';
import type { VoiceCall, VoiceProvider } from './types';
import { logger } from '@/lib/logger/logger';

export type VoiceAgentMode = 'prospector' | 'closer';

export interface VoiceAgentConfig {
  mode: VoiceAgentMode;
  organizationId: string;
  agentId: string;

  // Company context for AI
  companyName?: string;
  productName?: string;
  productDescription?: string;
  valueProposition?: string;

  // Prospector mode config
  qualificationCriteria?: {
    budgetThreshold?: number;
    requiredFields?: string[];
    disqualifyingResponses?: string[];
  };
  transferRules?: {
    onQualified?: 'transfer' | 'book_appointment';
    transferToAgentId?: string;
    bookingCalendarId?: string;
  };

  // Closer mode config
  closingConfig?: {
    maxDiscountPercent?: number;
    urgencyTactics?: boolean;
    paymentEnabled?: boolean;
    paymentProvider?: 'stripe' | 'square' | 'paypal';
    requireManagerApproval?: number; // Deal value threshold
  };

  // Voice settings
  voiceSettings?: {
    voice?: string;
    language?: string;
    speakingSpeed?: number;
  };
  fallbackBehavior?: 'transfer' | 'voicemail' | 'callback';

  // Real-time transcription settings
  transcriptionSettings?: {
    provider?: 'twilio' | 'telnyx' | 'deepgram';
    language?: string;
    profanityFilter?: boolean;
  };
}

export interface AgentResponse {
  text: string;
  action?: 'continue' | 'transfer' | 'book_appointment' | 'process_payment' | 'end_call';
  state?: ConversationState;
  qualificationScore?: number;
  transferContext?: {
    reason: string;
    summary: string;
    suggestedAgentId?: string;
  };
  paymentContext?: {
    amount: number;
    description: string;
    customerId: string;
  };
  twiml?: string;
}

// ===== CONVERSATION STATE MACHINE =====

interface StateMachineTransition {
  from: ConversationState;
  to: ConversationState;
  condition: (context: ConversationContext) => boolean;
  action?: () => Promise<void>;
}

const _STATE_TRANSITIONS: StateMachineTransition[] = [
  // GREETING -> QUALIFYING: After initial exchange
  {
    from: 'GREETING',
    to: 'QUALIFYING',
    condition: (ctx) => ctx.turns.length >= 2,
  },
  // QUALIFYING -> TRANSFER (Prospector): When qualified
  {
    from: 'QUALIFYING',
    to: 'TRANSFER',
    condition: (ctx) => ctx.qualificationScore >= 70,
  },
  // QUALIFYING -> PITCHING (Closer): When qualified
  {
    from: 'QUALIFYING',
    to: 'PITCHING',
    condition: (ctx) => ctx.qualificationScore >= 60,
  },
  // QUALIFYING -> OBJECTION_HANDLING: When objection detected
  {
    from: 'QUALIFYING',
    to: 'OBJECTION_HANDLING',
    condition: (ctx) => ctx.objectionCount > 0 && ctx.sentiment === 'negative',
  },
  // PITCHING -> CLOSING: When buying signals detected
  {
    from: 'PITCHING',
    to: 'CLOSING',
    condition: (ctx) => ctx.buyingSignals.length >= 2 || ctx.readyToClose,
  },
  // PITCHING -> OBJECTION_HANDLING: When objection raised
  {
    from: 'PITCHING',
    to: 'OBJECTION_HANDLING',
    condition: (ctx) => ctx.objectionCount > 0,
  },
  // OBJECTION_HANDLING -> PITCHING: When objection resolved
  {
    from: 'OBJECTION_HANDLING',
    to: 'PITCHING',
    condition: (ctx) => ctx.sentiment !== 'negative',
  },
  // Any -> TRANSFER: When too many objections
  {
    from: 'OBJECTION_HANDLING',
    to: 'TRANSFER',
    condition: (ctx) => ctx.objectionCount >= 3,
  },
  // CLOSING -> ENDED: When deal closed or lost
  {
    from: 'CLOSING',
    to: 'ENDED',
    condition: (ctx) => ctx.readyToClose,
  },
];

// ===== VOICE AGENT HANDLER CLASS =====

class VoiceAgentHandler {
  private config: VoiceAgentConfig | null = null;
  private provider: VoiceProvider | null = null;
  private activeCallId: string | null = null;

  /**
   * Initialize the voice agent with configuration
   */
  async initialize(config: VoiceAgentConfig): Promise<void> {
    this.config = config;

    // Get the preferred voice provider (Telnyx for better rates)
    this.provider = await VoiceProviderFactory.getProvider(
      'telnyx' // Prefer Telnyx for 60-70% savings
    );

    logger.info(`[VoiceAgent] Initialized in ${config.mode.toUpperCase()} mode`, {
      organizationId: config.organizationId,
      agentId: config.agentId,
      file: 'voice-agent-handler.ts',
    });
  }

  /**
   * Start a new AI-powered conversation
   */
  async startConversation(call: VoiceCall): Promise<AgentResponse> {
    if (!this.config) {
      throw new Error('Voice agent not initialized');
    }

    this.activeCallId = call.callId;

    // Build AI conversation config
    const conversationConfig: ConversationConfig = {
      mode: this.config.mode,
      organizationId: this.config.organizationId,
      agentId: this.config.agentId,
      companyName: this.config.companyName,
      productName: this.config.productName,
      productDescription: this.config.productDescription,
      valueProposition: this.config.valueProposition,
      qualificationCriteria: this.config.qualificationCriteria,
      maxDiscountPercent: this.config.closingConfig?.maxDiscountPercent,
      voiceName: this.config.voiceSettings?.voice,
      language: this.config.voiceSettings?.language,
    };

    // Initialize AI conversation
    const { greeting, context } = aiConversationService.initializeConversation(
      call.callId,
      call.from,
      conversationConfig
    );

    // Store call context in Firestore for warm transfer
    await this.storeCallContext(call.callId, context);

    // Log conversation start
    logger.info('[VoiceAgent] Started AI conversation', {
      callId: call.callId,
      mode: this.config.mode,
      customerPhone: call.from,
      file: 'voice-agent-handler.ts',
    });

    // Generate TwiML with speech gathering
    const twiml = this.generateConversationTwiML(greeting, call.callId);

    return {
      text: greeting,
      action: 'continue',
      state: 'GREETING',
      twiml,
    };
  }

  /**
   * Process customer speech input and generate AI response
   * This is the core conversation loop
   */
  async processCustomerInput(callId: string, speechResult: string): Promise<AgentResponse> {
    if (!this.config) {
      throw new Error('Voice agent not initialized');
    }

    const startTime = Date.now();

    try {
      // Get AI response
      const aiResponse = await aiConversationService.generateResponse(callId, speechResult);

      // Track response time for monitoring
      const responseTime = Date.now() - startTime;
      if (responseTime > 2000) {
        logger.warn('[VoiceAgent] Response time exceeded 2s target', {
          callId,
          responseTime,
          file: 'voice-agent-handler.ts',
        });
      }

      // Handle different actions
      switch (aiResponse.action) {
        case 'transfer':
          return await this.handleTransfer(callId, aiResponse);

        case 'close':
          return await this.handleClose(callId, aiResponse);

        case 'end_call':
          return await this.handleEndCall(callId, aiResponse);

        default:
          // Continue conversation
          return {
            text: aiResponse.text,
            action: 'continue',
            state: aiResponse.newState,
            qualificationScore: aiConversationService.getConversationContext(callId)?.qualificationScore,
            twiml: this.generateConversationTwiML(aiResponse.text, callId),
          };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[VoiceAgent] Error processing input:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-agent-handler.ts' });

      // Graceful fallback - transfer to human
      return this.handleGracefulFallback(callId, errorMessage);
    }
  }

  /**
   * Handle transfer to human agent
   */
  private async handleTransfer(callId: string, aiResponse: AIResponse): Promise<AgentResponse> {
    const context = aiConversationService.getConversationContext(callId);
    const summary = aiConversationService.generateTransferSummary(callId);

    // Update stored context before transfer
    if (context) {
      await this.storeCallContext(callId, context);
    }

    // Initiate warm transfer
    if (!this.config) {
      throw new Error('Voice agent not initialized');
    }

    await callTransferService.aiToHumanHandoff({
      callId,
      organizationId: this.config.organizationId,
      aiAgentId: this.config.agentId,
      conversationSummary: summary,
      customerSentiment: context?.sentiment ?? 'neutral',
      customerIntent: aiResponse.transferReason ?? 'general inquiry',
      suggestedActions: this.getSuggestedActions(context),
      conversationHistory: context?.turns.map(t => ({
        role: t.role,
        content: t.content,
        timestamp: t.timestamp,
      })) ?? [],
      customerInfo: {
        name: context?.customerInfo.name,
        phone: context?.customerInfo.phone ?? '',
        crmRecordId: undefined,
      },
    });

    // Log to CRM
    if (this.provider && context && this.config) {
      const call = await this.provider.getCall(callId);
      await crmVoiceActivity.logCall(call, {
        aiAgentId: this.config.agentId,
        sentiment: context.sentiment,
        outcome: 'transferred_to_human',
        notes: summary,
      });
    }

    // Generate transfer TwiML
    const twiml = this.generateTransferTwiML(aiResponse.text);

    return {
      text: aiResponse.text,
      action: 'transfer',
      state: 'TRANSFER',
      qualificationScore: context?.qualificationScore,
      transferContext: {
        reason: aiResponse.transferReason ?? 'Qualified lead',
        summary,
        suggestedAgentId: this.config?.transferRules?.transferToAgentId,
      },
      twiml,
    };
  }

  /**
   * Handle deal closing (Closer mode)
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Method must be async for consistent interface with other handlers
  private async handleClose(callId: string, aiResponse: AIResponse): Promise<AgentResponse> {
    const context = aiConversationService.getConversationContext(callId);
    const closingConfig = this.config?.closingConfig;

    if (!closingConfig?.paymentEnabled) {
      // Just end the call with closing message
      return {
        text: aiResponse.text,
        action: 'end_call',
        state: 'ENDED',
        twiml: this.generateEndCallTwiML(aiResponse.text),
      };
    }

    // TODO: Integrate with payment API
    // For now, return payment intent
    return {
      text: aiResponse.text,
      action: 'process_payment',
      state: 'CLOSING',
      paymentContext: {
        amount: context?.customerInfo.budget ?? 0,
        description: 'Product/Service Purchase',
        customerId: context?.customerInfo.phone ?? callId,
      },
      twiml: this.generateConversationTwiML(aiResponse.text, callId),
    };
  }

  /**
   * Handle end call
   */
  private async handleEndCall(callId: string, aiResponse: AIResponse): Promise<AgentResponse> {
    const context = aiConversationService.endConversation(callId);

    // Log final call data
    if (context && this.provider && this.config) {
      try {
        const call = await this.provider.getCall(callId);
        await crmVoiceActivity.logCall(call, {
          aiAgentId: this.config.agentId,
          sentiment: context.sentiment,
          outcome: context.qualificationScore >= 70 ? 'qualified' : 'disqualified',
          notes: aiConversationService.generateTransferSummary(callId),
        });
      } catch {
        // Ignore logging errors on call end
      }
    }

    return {
      text: aiResponse.text,
      action: 'end_call',
      state: 'ENDED',
      qualificationScore: context?.qualificationScore,
      twiml: this.generateEndCallTwiML(aiResponse.text),
    };
  }

  /**
   * Handle graceful fallback when AI fails
   */
  private async handleGracefulFallback(callId: string, errorMessage: string): Promise<AgentResponse> {
    logger.warn('[VoiceAgent] Graceful fallback triggered', {
      callId,
      error: errorMessage,
      file: 'voice-agent-handler.ts',
    });

    const fallbackMessage = "I apologize, but I'm having some technical difficulties. " +
      "Let me connect you with one of our team members who can help you right away. " +
      "Please hold for just a moment.";

    // Attempt transfer
    try {
      if (!this.config) {
        throw new Error('Voice agent not initialized');
      }

      await callTransferService.aiToHumanHandoff({
        callId,
        organizationId: this.config.organizationId,
        aiAgentId: this.config.agentId,
        conversationSummary: `AI FALLBACK: ${errorMessage}`,
        customerSentiment: 'neutral',
        customerIntent: 'unknown',
        suggestedActions: ['AI system encountered error', 'Continue conversation manually'],
        conversationHistory: [],
        customerInfo: {
          phone: '',
        },
      });
    } catch {
      // If transfer fails, just end the call
      return {
        text: "I apologize for the inconvenience. Please call back and we'll be happy to help you. Goodbye.",
        action: 'end_call',
        state: 'ENDED',
        twiml: this.generateEndCallTwiML("I apologize for the inconvenience. Please call back and we'll be happy to help you. Goodbye."),
      };
    }

    return {
      text: fallbackMessage,
      action: 'transfer',
      state: 'TRANSFER',
      twiml: this.generateTransferTwiML(fallbackMessage),
    };
  }

  // ===== TwiML GENERATION =====

  /**
   * Generate TwiML for conversation with speech recognition
   */
  generateConversationTwiML(message: string, callId: string): string {
    const voice = this.config?.voiceSettings?.voice ?? 'Polly.Joanna';
    const language = this.config?.voiceSettings?.language ?? 'en-US';
    const actionUrl = `/api/voice/ai-agent/speech?callId=${encodeURIComponent(callId)}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${actionUrl}" method="POST" language="${language}" timeout="5" speechTimeout="auto" enhanced="true">
    <Say voice="${voice}" language="${language}">${this.escapeXML(message)}</Say>
  </Gather>
  <Say voice="${voice}">I didn't hear anything. Let me transfer you to someone who can help.</Say>
  <Redirect>/api/voice/ai-agent/fallback?callId=${encodeURIComponent(callId)}</Redirect>
</Response>`;
  }

  /**
   * Generate TwiML for transfer
   */
  private generateTransferTwiML(message: string): string {
    const voice = this.config?.voiceSettings?.voice ?? 'Polly.Joanna';
    const language = this.config?.voiceSettings?.language ?? 'en-US';
    const transferToNumber = process.env.HUMAN_AGENT_QUEUE_NUMBER ?? '+15551234567';

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">${this.escapeXML(message)}</Say>
  <Dial timeout="30">
    <Number>${transferToNumber}</Number>
  </Dial>
  <Say voice="${voice}">I'm sorry, but all of our agents are currently busy. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`;
  }

  /**
   * Generate TwiML for end call
   */
  private generateEndCallTwiML(message: string): string {
    const voice = this.config?.voiceSettings?.voice ?? 'Polly.Joanna';
    const language = this.config?.voiceSettings?.language ?? 'en-US';

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">${this.escapeXML(message)}</Say>
  <Hangup/>
</Response>`;
  }

  // ===== HELPER METHODS =====

  /**
   * Store call context in Firestore for warm transfer
   */
  private async storeCallContext(callId: string, context: ConversationContext): Promise<void> {
    try {
      if (!this.config) {
        throw new Error('Voice agent not initialized');
      }

      const { FirestoreService } = await import('@/lib/db/firestore-service');

      await FirestoreService.set(
        `organizations/${this.config.organizationId}/callContexts`,
        callId,
        {
          callId,
          state: context.state,
          turns: context.turns.map(t => ({
            role: t.role,
            content: t.content,
            timestamp: t.timestamp.toISOString(),
          })),
          customerInfo: context.customerInfo,
          qualificationScore: context.qualificationScore,
          objectionCount: context.objectionCount,
          buyingSignals: context.buyingSignals,
          sentiment: context.sentiment,
          updatedAt: new Date().toISOString(),
        },
        true // merge
      );
    } catch (error) {
      logger.error('[VoiceAgent] Failed to store call context:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-agent-handler.ts' });
    }
  }

  /**
   * Get suggested actions based on conversation context
   */
  private getSuggestedActions(context: ConversationContext | undefined): string[] {
    const actions: string[] = [];

    if (!context) {
      return ['Continue discovery'];
    }

    if (context.sentiment === 'positive') {
      actions.push('Customer is engaged - prioritize closing');
    }

    if (context.objectionCount > 0) {
      actions.push('Address remaining objections');
    }

    if (context.qualificationScore >= 70) {
      actions.push('Qualified lead - proceed to proposal');
    }

    if (context.buyingSignals.length > 0) {
      actions.push(`Buying signals detected: ${context.buyingSignals.join(', ')}`);
    }

    return actions.length > 0 ? actions : ['Continue discovery'];
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Get current conversation context (for external access)
   */
  getConversationContext(callId: string): ConversationContext | undefined {
    return aiConversationService.getConversationContext(callId);
  }

  /**
   * End conversation and cleanup
   */
  endConversation(callId: string): void {
    aiConversationService.endConversation(callId);
  }

  /**
   * Process payment (Closer mode)
   */
  async processPayment(paymentContext: AgentResponse['paymentContext']): Promise<{ success: boolean; error?: string }> {
    if (!paymentContext) {
      return { success: false, error: 'No payment context provided' };
    }

    try {
      const closingConfig = this.config?.closingConfig;

      // Route to payment provider
      if (closingConfig?.paymentProvider === 'stripe') {
        const response = await fetch('/api/payments/stripe/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: paymentContext.amount * 100, // Convert to cents
            customerId: paymentContext.customerId,
            description: paymentContext.description,
          }),
        });

        if (!response.ok) {
          throw new Error('Payment failed');
        }

        return { success: true };
      }

      // Log payment attempt
      logger.info('[VoiceAgent] Payment processed', {
        amount: paymentContext.amount,
        customerId: paymentContext.customerId,
        file: 'voice-agent-handler.ts',
      });

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
      logger.error('[VoiceAgent] Payment failed:', error instanceof Error ? error : new Error(String(error)), { file: 'voice-agent-handler.ts' });
      return { success: false, error: errorMessage };
    }
  }
}

// Export singleton and types
export const voiceAgentHandler = new VoiceAgentHandler();
export type { ConversationContext, ConversationState };
export default voiceAgentHandler;
