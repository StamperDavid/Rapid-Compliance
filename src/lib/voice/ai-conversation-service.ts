/**
 * AI Conversation Service
 * Handles real-time AI-powered voice conversations using Gemini
 *
 * Features:
 * - Conversation state machine: GREETING -> QUALIFYING -> PITCHING -> OBJECTION_HANDLING -> TRANSFER/CLOSE
 * - Streaming responses for low-latency (<2s)
 * - Mode-specific prompts (prospector/closer)
 * - Graceful fallback to human transfer on AI failure
 */

import { streamChatMessage, generateText, type ChatMessage } from '@/lib/ai/gemini-service';
import { logger } from '@/lib/logger/logger';

// ===== CONVERSATION STATE MACHINE =====

export type ConversationState =
  | 'GREETING'
  | 'QUALIFYING'
  | 'PITCHING'
  | 'OBJECTION_HANDLING'
  | 'CLOSING'
  | 'TRANSFER'
  | 'ENDED';

export type AIConversationMode = 'prospector' | 'closer';

export interface ConversationConfig {
  mode: AIConversationMode;
  organizationId: string;
  agentId: string;

  // Company/product context
  companyName?: string;
  productName?: string;
  productDescription?: string;
  valueProposition?: string;

  // Prospector config
  qualificationQuestions?: string[];
  qualificationCriteria?: {
    budgetThreshold?: number;
    requiredInfo?: string[];
    disqualifyingResponses?: string[];
  };

  // Closer config
  maxDiscountPercent?: number;
  urgencyOffers?: string[];
  paymentEnabled?: boolean;

  // Voice settings
  voiceName?: string;
  language?: string;
}

export interface ConversationTurn {
  role: 'agent' | 'customer';
  content: string;
  timestamp: Date;
  sentiment?: 'positive' | 'neutral' | 'negative';
  intent?: string;
}

export interface ConversationContext {
  callId: string;
  state: ConversationState;
  turns: ConversationTurn[];
  customerInfo: {
    name?: string;
    phone: string;
    email?: string;
    company?: string;
    role?: string;
    budget?: number;
    timeline?: string;
    painPoints?: string[];
  };
  qualificationScore: number;
  objectionCount: number;
  buyingSignals: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  readyToTransfer: boolean;
  readyToClose: boolean;
  lastResponseTime: number;
}

export interface AIResponse {
  text: string;
  newState: ConversationState;
  action: 'continue' | 'transfer' | 'close' | 'end_call';
  confidence: number;
  extractedInfo?: Partial<ConversationContext['customerInfo']>;
  shouldTransfer?: boolean;
  transferReason?: string;
}

// ===== SYSTEM PROMPTS =====

const PROSPECTOR_SYSTEM_PROMPT = `You are an AI sales development representative (SDR) for {companyName}. Your job is to qualify leads and book appointments or transfer qualified leads to human closers.

PRODUCT: {productName}
VALUE PROPOSITION: {valueProposition}

YOUR OBJECTIVES:
1. Build rapport and establish trust quickly
2. Identify pain points and business challenges
3. Qualify the prospect using BANT (Budget, Authority, Need, Timeline)
4. If qualified (score >= 70), prepare for warm transfer to human closer
5. Handle initial objections professionally

QUALIFICATION CRITERIA:
- Budget: Can they afford the solution?
- Authority: Are they a decision maker?
- Need: Do they have a real problem we solve?
- Timeline: Are they ready to act soon?

CONVERSATION GUIDELINES:
- Keep responses concise (2-3 sentences max for phone)
- Use open-ended questions to gather information
- Mirror the customer's language and energy
- Never be pushy or aggressive
- If disqualified, end gracefully with a resource offer

CURRENT STATE: {currentState}
QUALIFICATION SCORE: {qualificationScore}/100
OBJECTION COUNT: {objectionCount}

Respond naturally as if speaking on the phone. Do not use markdown or special formatting.`;

const CLOSER_SYSTEM_PROMPT = `You are an AI sales closer for {companyName}. You are speaking with a qualified prospect who has been transferred from an SDR.

PRODUCT: {productName}
VALUE PROPOSITION: {valueProposition}
MAX DISCOUNT AUTHORITY: {maxDiscount}%

YOUR OBJECTIVES:
1. Review what the prospect discussed with the SDR
2. Handle any remaining objections professionally
3. Present compelling offers and create urgency
4. Close the deal or schedule a concrete next step
5. If deal value exceeds threshold, transfer to human manager

OBJECTION HANDLING FRAMEWORK:
1. Acknowledge the concern ("I understand...")
2. Clarify if needed ("Just so I'm clear...")
3. Respond with value, not features
4. Confirm resolution ("Does that address your concern?")

CLOSING TECHNIQUES (use when appropriate):
- Assumptive close: "Should we start with the standard or premium plan?"
- Urgency: "Our current promotion ends this week..."
- Summary: "To recap, you get [benefits] for [price]..."

CURRENT STATE: {currentState}
BUYING SIGNALS DETECTED: {buyingSignals}

Respond naturally as if speaking on the phone. Keep responses concise for verbal delivery.`;

// ===== AI CONVERSATION SERVICE =====

class AIConversationService {
  private activeConversations = new Map<string, ConversationContext>();
  private configs = new Map<string, ConversationConfig>();

  /**
   * Initialize a new conversation
   */
  async initializeConversation(
    callId: string,
    customerPhone: string,
    config: ConversationConfig
  ): Promise<{ greeting: string; context: ConversationContext }> {
    const context: ConversationContext = {
      callId,
      state: 'GREETING',
      turns: [],
      customerInfo: {
        phone: customerPhone,
      },
      qualificationScore: 50, // Start at neutral
      objectionCount: 0,
      buyingSignals: [],
      sentiment: 'neutral',
      readyToTransfer: false,
      readyToClose: false,
      lastResponseTime: 0,
    };

    this.activeConversations.set(callId, context);
    this.configs.set(callId, config);

    // Generate personalized greeting
    const greeting = await this.generateGreeting(config);

    // Add to conversation history
    context.turns.push({
      role: 'agent',
      content: greeting,
      timestamp: new Date(),
    });

    logger.info('[AIConversation] Initialized conversation', {
      callId,
      mode: config.mode,
      file: 'ai-conversation-service.ts',
    });

    return { greeting, context };
  }

  /**
   * Generate opening greeting based on mode
   */
  private async generateGreeting(config: ConversationConfig): Promise<string> {
    const companyName = config.companyName ?? 'our company';

    if (config.mode === 'prospector') {
      return `Hi there! Thanks for taking my call. I'm an AI assistant with ${companyName}. ` +
        `I'd love to learn a bit about your business and see if we might be able to help. ` +
        `Do you have just a couple of minutes to chat?`;
    } else {
      return `Great to speak with you! I understand you've been exploring our solutions. ` +
        `I'm here to answer any questions and help you get started today. ` +
        `What would you like to know more about?`;
    }
  }

  /**
   * Process customer speech and generate AI response
   * Uses streaming for low latency
   */
  async generateResponse(
    callId: string,
    customerSpeech: string
  ): Promise<AIResponse> {
    const startTime = Date.now();

    const context = this.activeConversations.get(callId);
    const config = this.configs.get(callId);

    if (!context || !config) {
      logger.error('[AIConversation] No active conversation found', { callId, file: 'ai-conversation-service.ts' });
      return this.getFallbackResponse('transfer');
    }

    try {
      // Add customer turn to history
      context.turns.push({
        role: 'customer',
        content: customerSpeech,
        timestamp: new Date(),
      });

      // Analyze customer input
      const analysis = this.analyzeCustomerInput(customerSpeech, context);
      context.sentiment = analysis.sentiment;
      context.objectionCount += analysis.isObjection ? 1 : 0;
      if (analysis.buyingSignal) {
        context.buyingSignals.push(analysis.buyingSignal);
      }

      // Update qualification score
      context.qualificationScore = this.calculateQualificationScore(context, analysis);

      // Determine next state
      const nextState = this.determineNextState(context, config, analysis);
      context.state = nextState;

      // Check if we should transfer
      if (this.shouldTransfer(context, config)) {
        context.readyToTransfer = true;
        return {
          text: this.generateTransferMessage(context, config),
          newState: 'TRANSFER',
          action: 'transfer',
          confidence: 0.9,
          shouldTransfer: true,
          transferReason: context.qualificationScore >= 70
            ? 'Qualified lead - ready for specialist'
            : 'AI unable to continue - escalating to human',
        };
      }

      // Check if should end call
      if (this.shouldEndCall(context, analysis)) {
        return {
          text: this.generateEndCallMessage(context),
          newState: 'ENDED',
          action: 'end_call',
          confidence: 0.85,
        };
      }

      // Generate AI response
      const response = await this.callGemini(context, config, customerSpeech);

      // Add agent turn to history
      context.turns.push({
        role: 'agent',
        content: response.text,
        timestamp: new Date(),
      });

      // Track response time
      context.lastResponseTime = Date.now() - startTime;

      logger.info('[AIConversation] Generated response', {
        callId,
        state: context.state,
        qualificationScore: context.qualificationScore,
        responseTime: context.lastResponseTime,
        file: 'ai-conversation-service.ts',
      });

      return response;

    } catch (error: any) {
      logger.error('[AIConversation] Error generating response:', error, { file: 'ai-conversation-service.ts' });

      // Graceful fallback - transfer to human
      return this.getFallbackResponse('transfer');
    }
  }

  /**
   * Stream response for lower perceived latency
   */
  async *streamResponse(
    callId: string,
    customerSpeech: string
  ): AsyncGenerator<string, AIResponse, unknown> {
    const context = this.activeConversations.get(callId);
    const config = this.configs.get(callId);

    if (!context || !config) {
      return this.getFallbackResponse('transfer');
    }

    try {
      // Add customer turn
      context.turns.push({
        role: 'customer',
        content: customerSpeech,
        timestamp: new Date(),
      });

      // Build messages for Gemini
      const messages = this.buildChatMessages(context, config);
      const systemPrompt = this.buildSystemPrompt(config, context);

      let fullResponse = '';

      for await (const chunk of streamChatMessage(messages, systemPrompt, config.organizationId)) {
        fullResponse += chunk;
        yield chunk;
      }

      // Add agent turn
      context.turns.push({
        role: 'agent',
        content: fullResponse,
        timestamp: new Date(),
      });

      return {
        text: fullResponse,
        newState: context.state,
        action: 'continue',
        confidence: 0.85,
      };

    } catch (error: any) {
      logger.error('[AIConversation] Stream error:', error, { file: 'ai-conversation-service.ts' });
      return this.getFallbackResponse('transfer');
    }
  }

  /**
   * Call Gemini API for response generation
   */
  private async callGemini(
    context: ConversationContext,
    config: ConversationConfig,
    customerSpeech: string
  ): Promise<AIResponse> {
    const messages = this.buildChatMessages(context, config);
    const systemPrompt = this.buildSystemPrompt(config, context);

    // Add the current customer message
    messages.push({
      role: 'user',
      parts: [{ text: customerSpeech }],
    });

    const response = await generateText(
      this.buildConversationPrompt(context, config, customerSpeech),
      systemPrompt,
      config.organizationId
    );

    // Clean up response for voice delivery
    const cleanedText = this.cleanResponseForVoice(response.text);

    return {
      text: cleanedText,
      newState: context.state,
      action: 'continue',
      confidence: 0.85,
    };
  }

  /**
   * Build chat messages for Gemini
   */
  private buildChatMessages(context: ConversationContext, config: ConversationConfig): ChatMessage[] {
    return context.turns.map(turn => ({
      role: turn.role === 'agent' ? 'model' : 'user',
      parts: [{ text: turn.content }],
      timestamp: turn.timestamp,
    }));
  }

  /**
   * Build system prompt based on mode and context
   */
  private buildSystemPrompt(config: ConversationConfig, context: ConversationContext): string {
    const template = config.mode === 'prospector'
      ? PROSPECTOR_SYSTEM_PROMPT
      : CLOSER_SYSTEM_PROMPT;

    return template
      .replace('{companyName}', config.companyName ?? 'our company')
      .replace('{productName}', config.productName ?? 'our solution')
      .replace('{valueProposition}', config.valueProposition ?? 'helping businesses succeed')
      .replace('{currentState}', context.state)
      .replace('{qualificationScore}', String(context.qualificationScore))
      .replace('{objectionCount}', String(context.objectionCount))
      .replace('{maxDiscount}', String(config.maxDiscountPercent ?? 10))
      .replace('{buyingSignals}', context.buyingSignals.join(', ') || 'None yet');
  }

  /**
   * Build conversation prompt
   */
  private buildConversationPrompt(
    context: ConversationContext,
    config: ConversationConfig,
    customerSpeech: string
  ): string {
    const recentHistory = context.turns.slice(-6).map(t =>
      `${t.role.toUpperCase()}: ${t.content}`
    ).join('\n');

    return `CONVERSATION HISTORY:
${recentHistory}

CUSTOMER JUST SAID: "${customerSpeech}"

Current conversation state: ${context.state}
Qualification score: ${context.qualificationScore}/100
Customer sentiment: ${context.sentiment}
Objections raised: ${context.objectionCount}

Generate a natural, conversational response. Keep it concise (2-3 sentences max) since this is a phone call.
If you detect strong qualification signals (budget confirmed, decision maker, clear need), note that the prospect may be ready for transfer to a specialist.
If you detect clear disqualification or the customer wants to end the call, acknowledge gracefully.`;
  }

  /**
   * Analyze customer input for sentiment, objections, and signals
   */
  private analyzeCustomerInput(
    speech: string,
    context: ConversationContext
  ): {
    sentiment: 'positive' | 'neutral' | 'negative';
    isObjection: boolean;
    buyingSignal?: string;
    extractedInfo: Partial<ConversationContext['customerInfo']>;
  } {
    const lower = speech.toLowerCase();

    // Sentiment analysis
    const positiveWords = ['great', 'perfect', 'excellent', 'love', 'amazing', 'yes', 'definitely', 'interested', 'sounds good', 'tell me more'];
    const negativeWords = ['no', 'not interested', 'too expensive', 'busy', 'stop calling', 'remove me', 'not now'];

    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (positiveCount > negativeCount) {sentiment = 'positive';}
    if (negativeCount > positiveCount) {sentiment = 'negative';}

    // Objection detection
    const objectionPatterns = [
      'too expensive', 'cost', 'price', "can't afford", 'budget',
      'not sure', "don't know", 'maybe later', 'think about it',
      'competitor', 'other options', 'shopping around',
      'need to talk', 'discuss with', 'check with',
      'not ready', 'not right now', 'busy', 'bad time',
    ];
    const isObjection = objectionPatterns.some(p => lower.includes(p));

    // Buying signals
    const buyingSignalPatterns: Record<string, string> = {
      'how much': 'price_inquiry',
      'pricing': 'price_inquiry',
      'how do I sign up': 'ready_to_buy',
      'next steps': 'ready_to_buy',
      'get started': 'ready_to_buy',
      'sounds good': 'positive_response',
      'interested': 'interest_expressed',
      'when can': 'timeline_urgency',
      'how soon': 'timeline_urgency',
    };

    let buyingSignal: string | undefined;
    for (const [pattern, signal] of Object.entries(buyingSignalPatterns)) {
      if (lower.includes(pattern)) {
        buyingSignal = signal;
        break;
      }
    }

    // Extract info (basic patterns - would use NER in production)
    const extractedInfo: Partial<ConversationContext['customerInfo']> = {};

    // Extract name if mentioned
    const nameMatch = speech.match(/(?:I'm|I am|my name is|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (nameMatch) {
      extractedInfo.name = nameMatch[1];
    }

    // Extract company
    const companyMatch = speech.match(/(?:at|with|from|work for)\s+([A-Z][A-Za-z\s]+?)(?:\.|,|$)/);
    if (companyMatch) {
      extractedInfo.company = companyMatch[1].trim();
    }

    return { sentiment, isObjection, buyingSignal, extractedInfo };
  }

  /**
   * Calculate qualification score based on conversation
   */
  private calculateQualificationScore(
    context: ConversationContext,
    analysis: ReturnType<typeof this.analyzeCustomerInput>
  ): number {
    let score = context.qualificationScore;

    // Adjust based on sentiment
    if (analysis.sentiment === 'positive') {score += 5;}
    if (analysis.sentiment === 'negative') {score -= 10;}

    // Adjust for objections
    if (analysis.isObjection) {score -= 5;}

    // Boost for buying signals
    if (analysis.buyingSignal) {
      if (analysis.buyingSignal === 'ready_to_buy') {score += 20;}
      else if (analysis.buyingSignal === 'price_inquiry') {score += 10;}
      else {score += 5;}
    }

    // Boost for engagement (more turns = more engaged)
    const customerTurns = context.turns.filter(t => t.role === 'customer').length;
    if (customerTurns >= 3) {score += 5;}
    if (customerTurns >= 5) {score += 5;}

    // Clamp to 0-100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine next conversation state
   */
  private determineNextState(
    context: ConversationContext,
    config: ConversationConfig,
    analysis: ReturnType<typeof this.analyzeCustomerInput>
  ): ConversationState {
    const currentState = context.state;

    // State transitions based on conditions
    switch (currentState) {
      case 'GREETING':
        // Move to qualifying after initial exchange
        if (context.turns.length >= 2) {
          return 'QUALIFYING';
        }
        break;

      case 'QUALIFYING':
        // Check qualification score
        if (context.qualificationScore >= 70) {
          if (config.mode === 'prospector') {
            return 'TRANSFER';
          }
          return 'PITCHING';
        }
        // Handle objections if raised
        if (analysis.isObjection) {
          return 'OBJECTION_HANDLING';
        }
        break;

      case 'PITCHING':
        if (analysis.isObjection) {
          return 'OBJECTION_HANDLING';
        }
        if (analysis.buyingSignal === 'ready_to_buy') {
          return 'CLOSING';
        }
        break;

      case 'OBJECTION_HANDLING':
        // Return to previous flow after handling
        if (!analysis.isObjection && analysis.sentiment !== 'negative') {
          if (context.qualificationScore >= 70) {
            return 'PITCHING';
          }
          return 'QUALIFYING';
        }
        break;

      case 'CLOSING':
        if (context.buyingSignals.includes('ready_to_buy')) {
          context.readyToClose = true;
        }
        break;
    }

    return currentState;
  }

  /**
   * Determine if call should transfer to human
   */
  private shouldTransfer(context: ConversationContext, config: ConversationConfig): boolean {
    // Prospector mode: transfer when qualified
    if (config.mode === 'prospector' && context.qualificationScore >= 70) {
      return true;
    }

    // Too many objections
    if (context.objectionCount >= 3 && context.sentiment === 'negative') {
      return true;
    }

    // Customer explicitly asked for human
    const lastCustomerTurn = context.turns.filter(t => t.role === 'customer').pop();
    if (lastCustomerTurn) {
      const lower = lastCustomerTurn.content.toLowerCase();
      if (lower.includes('speak to a human') || lower.includes('real person') || lower.includes('talk to someone')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine if call should end
   */
  private shouldEndCall(
    context: ConversationContext,
    analysis: ReturnType<typeof this.analyzeCustomerInput>
  ): boolean {
    const lastCustomerTurn = context.turns.filter(t => t.role === 'customer').pop();
    if (!lastCustomerTurn) {return false;}

    const lower = lastCustomerTurn.content.toLowerCase();

    // Explicit end signals
    const endSignals = [
      'goodbye', 'bye', 'not interested', 'remove me', 'stop calling',
      "don't call again", 'hang up', 'gotta go', 'have to go',
    ];

    if (endSignals.some(s => lower.includes(s))) {
      return true;
    }

    // Persistent negative sentiment
    if (analysis.sentiment === 'negative' && context.objectionCount >= 2) {
      return true;
    }

    return false;
  }

  /**
   * Generate transfer message
   */
  private generateTransferMessage(context: ConversationContext, config: ConversationConfig): string {
    if (context.qualificationScore >= 70) {
      return `Excellent! Based on what you've shared, I think one of our specialists can really help you. ` +
        `Let me connect you with someone right now who can answer your specific questions and get you started. ` +
        `One moment please.`;
    }

    return `I want to make sure you get the best help possible. ` +
      `Let me connect you with one of our team members who can assist you further. ` +
      `Please hold for just a moment.`;
  }

  /**
   * Generate end call message
   */
  private generateEndCallMessage(context: ConversationContext): string {
    if (context.sentiment === 'negative') {
      return `I understand. Thank you for your time today. ` +
        `If anything changes, feel free to reach out. Have a great day!`;
    }

    return `Thank you so much for chatting with me today. ` +
      `I'll send over some helpful information via email. ` +
      `Take care and have a wonderful day!`;
  }

  /**
   * Get fallback response (used when AI fails)
   */
  private getFallbackResponse(action: 'transfer' | 'continue'): AIResponse {
    if (action === 'transfer') {
      return {
        text: `I apologize, but I'm having some technical difficulties. ` +
          `Let me connect you with one of our team members who can help you right away. ` +
          `Please hold for just a moment.`,
        newState: 'TRANSFER',
        action: 'transfer',
        confidence: 0.5,
        shouldTransfer: true,
        transferReason: 'AI system error - graceful fallback to human',
      };
    }

    return {
      text: `I'm sorry, could you repeat that? I want to make sure I understand you correctly.`,
      newState: 'QUALIFYING',
      action: 'continue',
      confidence: 0.5,
    };
  }

  /**
   * Clean response for voice delivery
   */
  private cleanResponseForVoice(text: string): string {
    return text
      // Remove markdown
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/#+\s/g, '')
      // Remove URLs
      .replace(/https?:\/\/[^\s]+/g, 'our website')
      // Remove bullet points
      .replace(/^[-*]\s/gm, '')
      // Clean up whitespace
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get conversation context for transfer
   */
  getConversationContext(callId: string): ConversationContext | undefined {
    return this.activeConversations.get(callId);
  }

  /**
   * Get conversation summary for transfer
   */
  generateTransferSummary(callId: string): string {
    const context = this.activeConversations.get(callId);
    if (!context) {return 'No conversation context available.';}

    const customerInfo = context.customerInfo;
    const summary = context.turns
      .map(t => `${t.role.toUpperCase()}: ${t.content}`)
      .join('\n');

    return `CALL SUMMARY
==============
Customer: ${customerInfo.name ?? 'Unknown'} (${customerInfo.phone})
Company: ${customerInfo.company ?? 'Unknown'}
Qualification Score: ${context.qualificationScore}/100
Sentiment: ${context.sentiment}
Objections Raised: ${context.objectionCount}
Buying Signals: ${context.buyingSignals.join(', ') || 'None'}

CONVERSATION:
${summary}

SUGGESTED ACTIONS:
${context.qualificationScore >= 70 ? '- Proceed to proposal/demo' : '- Continue qualification'}
${context.objectionCount > 0 ? '- Address outstanding objections' : ''}
${context.buyingSignals.length > 0 ? '- Customer showing buying intent' : ''}`;
  }

  /**
   * End conversation and cleanup
   */
  endConversation(callId: string): ConversationContext | undefined {
    const context = this.activeConversations.get(callId);
    this.activeConversations.delete(callId);
    this.configs.delete(callId);
    return context;
  }
}

// Export singleton instance
export const aiConversationService = new AIConversationService();
export default aiConversationService;
