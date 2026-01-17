/**
 * Call Transfer Service
 * Handles AI-to-Human handoff and warm/cold transfers
 * Supports conference bridging, whisper, and screen pop
 */

import { VoiceProviderFactory } from './voice-factory';
import { logger } from '@/lib/logger/logger';

export interface TransferAgent {
  id: string;
  name: string;
  phone: string;
  extension?: string;
  skills: string[];
  available: boolean;
  currentCalls: number;
  maxCalls: number;
}

export interface TransferRequest {
  callId: string;
  organizationId: string;
  fromAgentId?: string;
  toAgentId?: string;
  toPhone?: string;
  transferType: 'cold' | 'warm' | 'conference';
  context?: {
    contactId?: string;
    contactName?: string;
    summary?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    intent?: string;
    notes?: string;
  };
  whisperMessage?: string;
  announceMessage?: string;
}

export interface TransferResult {
  success: boolean;
  newCallId?: string;
  conferenceId?: string;
  error?: string;
}

export interface AIHandoffContext {
  callId: string;
  organizationId: string;
  aiAgentId: string;
  conversationSummary: string;
  customerSentiment: 'positive' | 'neutral' | 'negative';
  customerIntent: string;
  suggestedActions: string[];
  conversationHistory: Array<{ role: string; content: string; timestamp: Date }>;
  customerInfo: {
    name?: string;
    phone: string;
    email?: string;
    crmRecordId?: string;
    previousInteractions?: number;
  };
}

class CallTransferService {
  private activeTransfers = new Map<string, TransferRequest>();
  private availableAgents = new Map<string, TransferAgent[]>();

  /**
   * Cold transfer - immediately connects caller to new destination
   * Caller hears ringing, original agent drops off
   */
  async coldTransfer(request: TransferRequest): Promise<TransferResult> {
    try {
      const provider = await VoiceProviderFactory.getProvider(request.organizationId);

      if (!request.toPhone && !request.toAgentId) {
        throw new Error('Either toPhone or toAgentId must be provided');
      }

      const destination = request.toPhone ?? await this.getAgentPhone(request.organizationId, request.toAgentId as string);

      await provider.transfer(request.callId, {
        to: destination,
        timeout: 30,
      });

      // Log the transfer
      await this.logTransfer(request, 'cold', true);

      // Create screen pop for receiving agent
      if (request.toAgentId && request.context) {
        await this.createScreenPop(request.organizationId, request.toAgentId, request.context);
      }

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[CallTransfer] Cold transfer failed:', error instanceof Error ? error : new Error(String(error)), { file: 'call-transfer-service.ts' });
      await this.logTransfer(request, 'cold', false, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Warm transfer - introduces caller to new agent before connecting
   * Original agent can speak to new agent first (whisper)
   */
  async warmTransfer(request: TransferRequest): Promise<TransferResult> {
    try {
      const provider = await VoiceProviderFactory.getProvider(request.organizationId);

      if (!request.toPhone && !request.toAgentId) {
        throw new Error('Either toPhone or toAgentId must be provided');
      }

      const destination = request.toPhone ?? await this.getAgentPhone(request.organizationId, request.toAgentId as string);

      // Step 1: Put original call on hold
      await provider.holdCall(request.callId, true);

      // Step 2: Dial receiving agent
      const consultCall = await provider.initiateCall(destination, request.toAgentId ?? 'transfer', {
        callerId: await this.getOrganizationCallerId(request.organizationId),
      });

      // Step 3: Play whisper message if provided
      if (request.whisperMessage) {
        await provider.updateCall(consultCall.callId, {
          speak: {
            text: request.whisperMessage,
            voice: 'Polly.Joanna',
          },
        });
      }

      // Store transfer state for completion
      this.activeTransfers.set(request.callId, {
        ...request,
        callId: consultCall.callId, // Track consult call
      });

      return { success: true, newCallId: consultCall.callId };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[CallTransfer] Warm transfer failed:', error instanceof Error ? error : new Error(String(error)), { file: 'call-transfer-service.ts' });

      // Try to unhold the original call if something goes wrong
      try {
        const provider = await VoiceProviderFactory.getProvider(request.organizationId);
        await provider.holdCall(request.callId, false);
      } catch {
        // Ignore errors here
      }

      await this.logTransfer(request, 'warm', false, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Complete a warm transfer - merge calls and drop original agent
   */
  async completeWarmTransfer(originalCallId: string, consultCallId: string, organizationId: string): Promise<TransferResult> {
    try {
      const provider = await VoiceProviderFactory.getProvider(organizationId);

      // Create a conference with both parties
      const conferenceName = `transfer-${originalCallId}-${Date.now()}`;

      // Add original caller to conference (unhold first)
      await provider.holdCall(originalCallId, false);
      await provider.addToConference(originalCallId, {
        name: conferenceName,
        startConferenceOnEnter: true,
        endConferenceOnExit: false,
      });

      // Add receiving agent to conference
      await provider.addToConference(consultCallId, {
        name: conferenceName,
        startConferenceOnEnter: true,
        endConferenceOnExit: true,
      });

      // Clean up transfer state
      this.activeTransfers.delete(originalCallId);

      return { success: true, conferenceId: conferenceName };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[CallTransfer] Complete warm transfer failed:', error instanceof Error ? error : new Error(String(error)), { file: 'call-transfer-service.ts' });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Cancel a warm transfer - return to original call
   */
  async cancelWarmTransfer(originalCallId: string, consultCallId: string, organizationId: string): Promise<TransferResult> {
    try {
      const provider = await VoiceProviderFactory.getProvider(organizationId);

      // End the consult call
      await provider.endCall(consultCallId);

      // Unhold the original call
      await provider.holdCall(originalCallId, false);

      // Clean up transfer state
      this.activeTransfers.delete(originalCallId);

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[CallTransfer] Cancel warm transfer failed:', error instanceof Error ? error : new Error(String(error)), { file: 'call-transfer-service.ts' });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Conference transfer - add receiving agent to existing call
   * All parties can hear each other
   */
  async conferenceTransfer(request: TransferRequest): Promise<TransferResult> {
    try {
      const provider = await VoiceProviderFactory.getProvider(request.organizationId);

      if (!request.toPhone && !request.toAgentId) {
        throw new Error('Either toPhone or toAgentId must be provided');
      }

      const destination = request.toPhone ?? await this.getAgentPhone(request.organizationId, request.toAgentId as string);

      // Create conference
      const conferenceName = `conf-${request.callId}-${Date.now()}`;

      // Add existing call to conference
      await provider.addToConference(request.callId, {
        name: conferenceName,
        startConferenceOnEnter: true,
        endConferenceOnExit: false,
      });

      // Dial and add new participant
      const newCall = await provider.initiateCall(destination, request.toAgentId ?? 'conference', {
        callerId: await this.getOrganizationCallerId(request.organizationId),
      });

      // Play announce message if provided
      if (request.announceMessage) {
        await provider.updateCall(newCall.callId, {
          speak: {
            text: request.announceMessage,
            voice: 'Polly.Joanna',
          },
        });
      }

      // Add to conference
      await provider.addToConference(newCall.callId, {
        name: conferenceName,
        startConferenceOnEnter: true,
        endConferenceOnExit: true,
      });

      // Create screen pop for receiving agent
      if (request.toAgentId && request.context) {
        await this.createScreenPop(request.organizationId, request.toAgentId, request.context);
      }

      await this.logTransfer(request, 'conference', true);

      return { success: true, conferenceId: conferenceName, newCallId: newCall.callId };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[CallTransfer] Conference transfer failed:', error instanceof Error ? error : new Error(String(error)), { file: 'call-transfer-service.ts' });
      await this.logTransfer(request, 'conference', false, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * AI-to-Human handoff
   * Special transfer that includes full conversation context for the human agent
   */
  async aiToHumanHandoff(context: AIHandoffContext): Promise<TransferResult> {
    try {
      // Find the best available human agent
      const agent = await this.findAvailableAgent(context.organizationId, context.customerIntent);

      if (!agent) {
        logger.warn('[CallTransfer] No agents available for handoff', { file: 'call-transfer-service.ts' });
        return { success: false, error: 'No agents available' };
      }

      // Create comprehensive screen pop for human agent
      await this.createScreenPop(context.organizationId, agent.id, {
        contactId: context.customerInfo.crmRecordId,
        contactName: context.customerInfo.name,
        summary: context.conversationSummary,
        sentiment: context.customerSentiment,
        intent: context.customerIntent,
        notes: `AI Summary:\n${context.conversationSummary}\n\nSuggested Actions:\n${context.suggestedActions.join('\n')}`,
      });

      // Generate whisper message for human agent
      const whisperMessage = `Incoming transfer from AI agent. Customer ${context.customerInfo.name ?? 'unknown'} ` +
        `is ${context.customerSentiment}. Intent: ${context.customerIntent}. ` +
        `${context.suggestedActions[0] ?? ''}`;

      // Perform warm transfer
      const result = await this.warmTransfer({
        callId: context.callId,
        organizationId: context.organizationId,
        fromAgentId: context.aiAgentId,
        toAgentId: agent.id,
        transferType: 'warm',
        context: {
          contactId: context.customerInfo.crmRecordId,
          contactName: context.customerInfo.name,
          summary: context.conversationSummary,
          sentiment: context.customerSentiment,
          intent: context.customerIntent,
        },
        whisperMessage,
      });

      // Log handoff in CRM
      await this.logAIHandoff(context, agent, result.success);

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[CallTransfer] AI-to-Human handoff failed:', error instanceof Error ? error : new Error(String(error)), { file: 'call-transfer-service.ts' });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Find available agent based on skills and workload
   */
  async findAvailableAgent(organizationId: string, intent?: string): Promise<TransferAgent | null> {
    try {
      const response = await fetch(`/api/voice/agents/available?organizationId=${organizationId}&intent=${encodeURIComponent(intent ?? '')}`);
      if (!response.ok) {return null;}

      const data = await response.json() as { agents?: TransferAgent[] };
      const agents: TransferAgent[] = data.agents ?? [];

      // Find agent with matching skills and lowest workload
      const available = agents
        .filter(a => a.available && a.currentCalls < a.maxCalls)
        .sort((a, b) => {
          // Prioritize skill match
          const aHasSkill = intent && a.skills.includes(intent) ? 1 : 0;
          const bHasSkill = intent && b.skills.includes(intent) ? 1 : 0;
          if (aHasSkill !== bHasSkill) {return bHasSkill - aHasSkill;}

          // Then by workload
          return a.currentCalls - b.currentCalls;
        });

      return available[0] ?? null;
    } catch (error) {
      logger.error('[CallTransfer] Find available agent failed:', error instanceof Error ? error : new Error(String(error)), { file: 'call-transfer-service.ts' });
      return null;
    }
  }

  /**
   * Get agent phone number
   */
  private async getAgentPhone(organizationId: string, agentId: string): Promise<string> {
    const response = await fetch(`/api/voice/agents/${agentId}?organizationId=${organizationId}`);
    if (!response.ok) {
      throw new Error('Agent not found');
    }
    const data = await response.json() as { phone: string };
    return data.phone;
  }

  /**
   * Get organization caller ID
   */
  private async getOrganizationCallerId(organizationId: string): Promise<string> {
    const response = await fetch(`/api/settings/voice?organizationId=${organizationId}`);
    if (!response.ok) {
      throw new Error('Voice settings not found');
    }
    const data = await response.json() as { callerId?: string; phoneNumber: string };
    return data.callerId ?? data.phoneNumber;
  }

  /**
   * Create screen pop notification for receiving agent
   */
  private async createScreenPop(
    organizationId: string,
    agentId: string,
    context: TransferRequest['context']
  ): Promise<void> {
    try {
      await fetch('/api/voice/screen-pop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          agentId,
          ...context,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      logger.error('[CallTransfer] Create screen pop failed:', error instanceof Error ? error : new Error(String(error)), { file: 'call-transfer-service.ts' });
    }
  }

  /**
   * Log transfer in activity history
   */
  private async logTransfer(
    request: TransferRequest,
    type: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      await fetch('/api/voice/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: request.organizationId,
          callId: request.callId,
          type: 'transfer',
          subType: type,
          success,
          error,
          fromAgentId: request.fromAgentId,
          toAgentId: request.toAgentId,
          toPhone: request.toPhone,
          context: request.context,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      logger.error('[CallTransfer] Log transfer failed:', error instanceof Error ? error : new Error(String(error)), { file: 'call-transfer-service.ts' });
    }
  }

  /**
   * Log AI handoff in CRM
   */
  private async logAIHandoff(
    context: AIHandoffContext,
    agent: TransferAgent,
    success: boolean
  ): Promise<void> {
    try {
      await fetch('/api/crm/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: context.organizationId,
          entityType: 'call',
          action: 'ai_handoff',
          details: {
            callId: context.callId,
            aiAgentId: context.aiAgentId,
            humanAgentId: agent.id,
            humanAgentName: agent.name,
            conversationSummary: context.conversationSummary,
            customerSentiment: context.customerSentiment,
            customerIntent: context.customerIntent,
            suggestedActions: context.suggestedActions,
            success,
          },
          contactId: context.customerInfo.crmRecordId,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      logger.error('[CallTransfer] Log AI handoff failed:', error instanceof Error ? error : new Error(String(error)), { file: 'call-transfer-service.ts' });
    }
  }
}

export const callTransferService = new CallTransferService();
export default callTransferService;
