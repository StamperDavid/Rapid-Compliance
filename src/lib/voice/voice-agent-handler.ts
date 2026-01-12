/**
 * Voice Agent Handler
 * AI Voice Agent modes for the Hybrid AI/Human Workforce
 *
 * Two modes:
 * 1. THE PROSPECTOR: Qualifies leads, books appointments, transfers to humans
 * 2. THE CLOSER: Handles objections, closes deals, triggers payment APIs
 */

import { VoiceProviderFactory } from './voice-factory';
import { callTransferService } from './call-transfer-service';
import { crmVoiceActivity } from './crm-voice-activity';
import type { VoiceCall, CallControlOptions } from './types';
import { logger } from '@/lib/logger/logger';

export type VoiceAgentMode = 'prospector' | 'closer';

export interface VoiceAgentConfig {
  mode: VoiceAgentMode;
  organizationId: string;
  agentId: string;

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

  // Common config
  voiceSettings?: {
    voice?: string;
    language?: string;
    speakingSpeed?: number;
  };
  fallbackBehavior?: 'transfer' | 'voicemail' | 'callback';
}

export interface ConversationContext {
  callId: string;
  customerId?: string;
  customerName?: string;
  customerPhone: string;
  conversationHistory: Array<{
    role: 'agent' | 'customer';
    content: string;
    timestamp: Date;
  }>;
  sentiment: 'positive' | 'neutral' | 'negative';
  qualificationScore?: number;
  objectionCount: number;
  dealValue?: number;
  readyToClose: boolean;
  intent?: string;
}

export interface AgentResponse {
  text: string;
  action?: 'continue' | 'transfer' | 'book_appointment' | 'process_payment' | 'end_call';
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
}

class VoiceAgentHandler {
  private config: VoiceAgentConfig | null = null;
  private context: ConversationContext | null = null;
  private mode: VoiceAgentMode = 'prospector';

  /**
   * Initialize the voice agent with configuration
   */
  async initialize(config: VoiceAgentConfig): Promise<void> {
    this.config = config;
    this.mode = config.mode;
    logger.info(`[VoiceAgent] Initialized in ${config.mode.toUpperCase()} mode`, { file: 'voice-agent-handler.ts' });
  }

  /**
   * Start a new conversation
   */
  async startConversation(call: VoiceCall): Promise<AgentResponse> {
    if (!this.config) {
      throw new Error('Voice agent not initialized');
    }

    this.context = {
      callId: call.callId,
      customerPhone: call.from,
      conversationHistory: [],
      sentiment: 'neutral',
      objectionCount: 0,
      readyToClose: false,
    };

    // Generate opening based on mode
    if (this.mode === 'prospector') {
      return this.generateProspectorOpening();
    } else {
      return this.generateCloserOpening();
    }
  }

  /**
   * Process customer speech and generate response
   */
  async processCustomerInput(speechResult: string): Promise<AgentResponse> {
    if (!this.config || !this.context) {
      throw new Error('Voice agent not initialized or no active conversation');
    }

    // Add to conversation history
    this.context.conversationHistory.push({
      role: 'customer',
      content: speechResult,
      timestamp: new Date(),
    });

    // Analyze sentiment
    this.context.sentiment = await this.analyzeSentiment(speechResult);

    // Check for objections
    if (this.detectObjection(speechResult)) {
      this.context.objectionCount++;
    }

    // Route to appropriate handler based on mode
    if (this.mode === 'prospector') {
      return this.handleProspectorConversation(speechResult);
    } else {
      return this.handleCloserConversation(speechResult);
    }
  }

  /**
   * PROSPECTOR MODE: Qualify and transfer
   */
  private async handleProspectorConversation(customerInput: string): Promise<AgentResponse> {
    const criteria = this.config?.qualificationCriteria;

    // Check for disqualifying responses
    if (criteria?.disqualifyingResponses) {
      const isDisqualified = criteria.disqualifyingResponses.some(
        dq => customerInput.toLowerCase().includes(dq.toLowerCase())
      );

      if (isDisqualified) {
        return {
          text: "Thank you for your time today. It sounds like our solution might not be the best fit right now. I'll have someone follow up with some helpful resources via email. Have a great day!",
          action: 'end_call',
        };
      }
    }

    // Calculate qualification score based on conversation
    const qualificationScore = await this.calculateQualificationScore();
    this.context!.qualificationScore = qualificationScore;

    // If qualified, initiate transfer or book appointment
    if (qualificationScore >= 70) {
      const transferRules = this.config?.transferRules;

      if (transferRules?.onQualified === 'book_appointment') {
        return {
          text: "This sounds like a great fit! Let me check availability with one of our specialists. What day works best for you this week?",
          action: 'book_appointment',
        };
      }

      return {
        text: "Excellent! Based on what you've shared, I think one of our specialists can really help you. Let me connect you with someone right now who can answer your specific questions. One moment please.",
        action: 'transfer',
        transferContext: {
          reason: 'Qualified lead - ready for specialist',
          summary: this.generateConversationSummary(),
          suggestedAgentId: transferRules?.transferToAgentId,
        },
      };
    }

    // Continue qualification
    const nextQuestion = await this.getNextQualificationQuestion();
    return {
      text: nextQuestion,
      action: 'continue',
    };
  }

  /**
   * CLOSER MODE: Handle objections and close deals
   */
  private async handleCloserConversation(customerInput: string): Promise<AgentResponse> {
    const closingConfig = this.config?.closingConfig;

    // Detect buying signals
    if (this.detectBuyingSignal(customerInput)) {
      this.context!.readyToClose = true;
    }

    // Handle objections
    if (this.context!.objectionCount > 0 && this.detectObjection(customerInput)) {
      const objectionResponse = await this.handleObjection(customerInput);
      return objectionResponse;
    }

    // If ready to close and payment is enabled
    if (this.context!.readyToClose && closingConfig?.paymentEnabled) {
      const dealValue = this.context!.dealValue ?? 0;

      // Check if manager approval needed
      if (closingConfig.requireManagerApproval && dealValue >= closingConfig.requireManagerApproval) {
        return {
          text: "This is a significant investment, and I want to make sure we get you the best possible terms. Let me bring in my manager to finalize this deal for you. One moment.",
          action: 'transfer',
          transferContext: {
            reason: 'High-value deal requiring manager approval',
            summary: this.generateConversationSummary(),
          },
        };
      }

      return {
        text: "Perfect! Let me get that processed for you right now. I'll just need to confirm a few details and we'll have you all set up today.",
        action: 'process_payment',
        paymentContext: {
          amount: dealValue,
          description: 'Product/Service Purchase',
          customerId: this.context!.customerId ?? this.context!.customerPhone,
        },
      };
    }

    // Apply closing techniques
    if (closingConfig?.urgencyTactics && this.context!.sentiment !== 'negative') {
      return await this.applyClosingTechnique(customerInput);
    }

    // Continue conversation
    const response = await this.generateCloserResponse(customerInput);
    return {
      text: response,
      action: 'continue',
    };
  }

  /**
   * Handle transfer to human agent
   */
  async initiateTransfer(): Promise<void> {
    if (!this.config || !this.context) {
      throw new Error('No active conversation to transfer');
    }

    const summary = this.generateConversationSummary();

    await callTransferService.aiToHumanHandoff({
      callId: this.context.callId,
      organizationId: this.config.organizationId,
      aiAgentId: this.config.agentId,
      conversationSummary: summary,
      customerSentiment: this.context.sentiment,
      customerIntent: this.context.intent ?? 'unknown',
      suggestedActions: this.getSuggestedActions(),
      conversationHistory: this.context.conversationHistory,
      customerInfo: {
        name: this.context.customerName,
        phone: this.context.customerPhone,
        crmRecordId: this.context.customerId,
      },
    });

    // Log to CRM
    const provider = await VoiceProviderFactory.getProvider(this.config.organizationId);
    const call = await provider.getCall(this.context.callId);

    await crmVoiceActivity.logCall(this.config.organizationId, call, {
      aiAgentId: this.config.agentId,
      sentiment: this.context.sentiment,
      outcome: 'transferred_to_human',
      notes: summary,
    });
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
        // In production, use Stripe API
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
    } catch (error: any) {
      logger.error('[VoiceAgent] Payment failed:', error, { file: 'voice-agent-handler.ts' });
      return { success: false, error: error.message };
    }
  }

  // ===== HELPER METHODS =====

  private async generateProspectorOpening(): Promise<AgentResponse> {
    return {
      text: "Hi there! Thanks for reaching out. I'm here to learn a bit about your business and see how we might be able to help. Could you start by telling me what challenges you're currently facing?",
      action: 'continue',
    };
  }

  private async generateCloserOpening(): Promise<AgentResponse> {
    return {
      text: "Great to speak with you! I understand you've been exploring our solution. I'm here to answer any remaining questions and help you get started today. What would you like to know more about?",
      action: 'continue',
    };
  }

  private async analyzeSentiment(text: string): Promise<'positive' | 'neutral' | 'negative'> {
    const positiveWords = ['great', 'perfect', 'excellent', 'love', 'amazing', 'yes', 'definitely', 'interested'];
    const negativeWords = ['no', 'not', 'never', 'hate', 'terrible', 'expensive', 'too much', 'cancel'];

    const lower = text.toLowerCase();
    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private detectObjection(text: string): boolean {
    const objectionPatterns = [
      'too expensive', 'cost', 'price', "can't afford",
      'not sure', "don't know", 'maybe later',
      'competitor', 'other options', 'shopping around',
      'need to think', 'talk to', 'discuss with',
      'not ready', 'not right now', 'busy',
    ];

    const lower = text.toLowerCase();
    return objectionPatterns.some(p => lower.includes(p));
  }

  private detectBuyingSignal(text: string): boolean {
    const buyingSignals = [
      'how do I sign up', 'what are the next steps',
      'ready to start', 'let\'s do it', 'sounds good',
      'can we proceed', 'how do I pay', 'what do you need from me',
      'when can we start', 'let\'s move forward',
    ];

    const lower = text.toLowerCase();
    return buyingSignals.some(s => lower.includes(s));
  }

  private async calculateQualificationScore(): Promise<number> {
    if (!this.context) return 0;

    let score = 50; // Base score

    // Add points for conversation length (engagement)
    score += Math.min(this.context.conversationHistory.length * 5, 20);

    // Add points for positive sentiment
    if (this.context.sentiment === 'positive') score += 15;
    if (this.context.sentiment === 'negative') score -= 20;

    // Subtract for objections
    score -= this.context.objectionCount * 10;

    return Math.max(0, Math.min(100, score));
  }

  private async getNextQualificationQuestion(): Promise<string> {
    const questions = [
      "What's the biggest challenge you're facing in your business right now?",
      "How are you currently handling this process today?",
      "What would success look like for you in solving this problem?",
      "What's your timeline for implementing a solution?",
      "Who else is involved in making this decision?",
    ];

    const askedCount = Math.floor(this.context!.conversationHistory.length / 2);
    return questions[askedCount % questions.length];
  }

  private async handleObjection(customerInput: string): Promise<AgentResponse> {
    const lower = customerInput.toLowerCase();

    // Price objection
    if (lower.includes('expensive') || lower.includes('cost') || lower.includes('price')) {
      const maxDiscount = this.config?.closingConfig?.maxDiscountPercent ?? 0;

      if (maxDiscount > 0) {
        return {
          text: `I completely understand budget is important. Let me see what I can do. I can offer you a ${maxDiscount}% discount if we can get you started today. Would that work better for your budget?`,
          action: 'continue',
        };
      }

      return {
        text: "I understand the investment is significant. Let me share what kind of ROI our clients typically see - most recover their investment within 3 months and see 300% returns within a year. Would it help to walk through those numbers?",
        action: 'continue',
      };
    }

    // Time objection
    if (lower.includes('think') || lower.includes('later') || lower.includes('not ready')) {
      return {
        text: "Of course, it's a big decision. What specific concerns would you want to think through? I might be able to address them right now and save you some time.",
        action: 'continue',
      };
    }

    // Competitor objection
    if (lower.includes('competitor') || lower.includes('other') || lower.includes('shopping')) {
      return {
        text: "Smart to do your research! What specifically are you comparing? I'd love to help you understand how we stack up - we've won over a lot of customers from those alternatives.",
        action: 'continue',
      };
    }

    return {
      text: "I hear you. Can you tell me more about what's holding you back? I want to make sure I address your specific concerns.",
      action: 'continue',
    };
  }

  private async applyClosingTechnique(customerInput: string): Promise<AgentResponse> {
    const techniques = [
      // Assumptive close
      "So shall we go ahead and get you set up with the standard package, or would you prefer the premium with the additional features?",
      // Urgency
      "Just so you know, we have a special promotion ending this week that could save you 20%. Want me to lock that in for you?",
      // Summary close
      "Let me recap what we discussed - you need [solution] to solve [problem], and our product does exactly that with [benefits]. Does that sound right?",
    ];

    const index = this.context!.conversationHistory.length % techniques.length;
    return {
      text: techniques[index],
      action: 'continue',
    };
  }

  private async generateCloserResponse(customerInput: string): Promise<string> {
    // In production, use AI to generate contextual response
    return "That's a great question. Let me explain how that works...";
  }

  private generateConversationSummary(): string {
    if (!this.context) return '';

    const history = this.context.conversationHistory
      .map(h => `${h.role.toUpperCase()}: ${h.content}`)
      .join('\n');

    return `Call Summary:
Sentiment: ${this.context.sentiment}
Qualification Score: ${this.context.qualificationScore ?? 'N/A'}
Objections: ${this.context.objectionCount}
Intent: ${this.context.intent ?? 'Unknown'}

Conversation:
${history}`;
  }

  private getSuggestedActions(): string[] {
    const actions: string[] = [];

    if (this.context?.sentiment === 'positive') {
      actions.push('Customer is engaged - prioritize closing');
    }

    if (this.context?.objectionCount ?? 0 > 0) {
      actions.push('Address remaining objections');
    }

    if (this.context?.qualificationScore && this.context.qualificationScore >= 70) {
      actions.push('Qualified lead - proceed to proposal');
    }

    return actions.length > 0 ? actions : ['Continue discovery'];
  }
}

export const voiceAgentHandler = new VoiceAgentHandler();
export default voiceAgentHandler;
