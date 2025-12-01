/**
 * Agent Instance Manager
 * 
 * Handles the lifecycle of ephemeral agent instances spawned from Golden Master.
 * Each customer interaction gets a fresh instance that loads their memory.
 */

import {
  AgentInstance,
  CustomerMemory,
  GoldenMaster,
  CustomerSession,
  ConversationMessage,
  AgentNote,
  InstanceLifecycleService
} from '@/types/agent-memory';

export class AgentInstanceManager implements InstanceLifecycleService {
  /**
   * Spawn a new agent instance for a customer session
   * 
   * Flow:
   * 1. Get active Golden Master for org
   * 2. Check if customer exists, create or load memory
   * 3. Create new session record
   * 4. Spawn instance with Golden Master config + customer memory
   * 5. Return ready-to-use instance
   */
  async spawnInstance(customerId: string, orgId: string): Promise<AgentInstance> {
    console.log(`[Instance Manager] Spawning instance for customer: ${customerId}`);
    
    // 1. Get active Golden Master
    const goldenMaster = await this.getActiveGoldenMaster(orgId);
    if (!goldenMaster) {
      throw new Error('No active Golden Master found. Please deploy a Golden Master first.');
    }
    
    // 2. Load or create customer memory
    let customerMemory = await this.getCustomerMemory(customerId, orgId);
    if (!customerMemory) {
      console.log('[Instance Manager] New customer detected, creating memory record');
      customerMemory = await this.createCustomerMemory(customerId, orgId);
    }
    
    // 3. Create new session
    const sessionId = this.generateSessionId();
    const newSession: CustomerSession = {
      sessionId,
      startTime: new Date().toISOString(),
      goldenMasterVersion: goldenMaster.version,
      messageCount: 0,
      outcome: 'ongoing',
      sentiment: 'neutral',
      sentimentScore: 0,
      flaggedForTraining: false
    };
    
    // Add session to customer memory
    customerMemory.sessions.push(newSession);
    customerMemory.lastInteraction = newSession.startTime;
    customerMemory.totalInteractions += 1;
    
    await this.saveCustomerMemory(customerMemory);
    
    // 4. Compile system prompt with customer context
    const systemPrompt = this.compileSystemPrompt(goldenMaster, customerMemory);
    
    // 5. Create instance
    const instance: AgentInstance = {
      instanceId: this.generateInstanceId(),
      sessionId,
      customerId,
      orgId,
      goldenMasterId: goldenMaster.id,
      goldenMasterVersion: goldenMaster.version,
      systemPrompt,
      knowledgeBase: goldenMaster.knowledgeBase.documents.map(d => d.id),
      customerMemory,
      status: 'active',
      spawnedAt: new Date().toISOString(),
      currentContext: [],
      messageCount: 0,
      lastActivityAt: new Date().toISOString(),
      escalationTriggered: false,
      humanTookOver: false
    };
    
    // Store instance in active instances (Redis/Memory cache)
    await this.storeActiveInstance(instance);
    
    console.log(`[Instance Manager] Instance ${instance.instanceId} spawned successfully`);
    return instance;
  }
  
  /**
   * Compile system prompt by combining Golden Master config with customer context
   */
  private compileSystemPrompt(goldenMaster: GoldenMaster, customerMemory: CustomerMemory): string {
    const { businessContext, agentPersona, behaviorConfig } = goldenMaster;
    
    // Include training learnings in system prompt (from Golden Master)
    const trainingNotes = goldenMaster.trainedScenarios || [];
    const recentLearnings = trainingNotes.length > 0
      ? `Trained on ${trainingNotes.length} scenarios. Training completed: ${goldenMaster.trainingCompletedAt || 'Not yet'}.`
      : '';
    
    const updatedGuidelines = ''; // From training feedback if available
    const behavioralChanges = ''; // From training feedback if available
    
    let prompt = `You are an AI sales and customer service agent for ${businessContext.businessName}.

# Your Role & Objectives
${agentPersona.objectives.join('\n')}

# Business Context
Industry: ${businessContext.industry}
What we do: ${businessContext.problemSolved}
What makes us unique: ${businessContext.uniqueValue}

# Products/Services
${businessContext.topProducts}

# Pricing Strategy
${businessContext.pricingStrategy}
${businessContext.discountPolicy}

# Policies
Return Policy: ${businessContext.returnPolicy}
Warranty: ${businessContext.warrantyTerms}
Shipping: ${businessContext.geographicCoverage}
Delivery Time: ${businessContext.deliveryTimeframes}

# Your Sales Process
${businessContext.typicalSalesFlow}

Discovery Questions to Ask:
${businessContext.discoveryQuestions}

# Objection Handling
${businessContext.commonObjections}

Price Objections: ${businessContext.priceObjections}
Time Objections: ${businessContext.timeObjections}
Competitor Objections: ${businessContext.competitorObjections}

# Your Personality
Name: ${agentPersona.name || 'AI Assistant'}
Tone: ${agentPersona.tone}
Greeting: "${agentPersona.greeting}"
Closing: "${agentPersona.closingMessage}"

# Behavioral Guidelines
- Closing Aggressiveness: ${behaviorConfig.closingAggressiveness}/10
- Ask ${behaviorConfig.questionFrequency} discovery questions before recommending
- Response Length: ${behaviorConfig.responseLength}
- Proactive Level: ${behaviorConfig.proactiveLevel}/10

# When to Escalate to Human
${agentPersona.escalationRules.join('\n')}

# Compliance & Legal
${businessContext.requiredDisclosures || ''}
Prohibited Topics: ${businessContext.prohibitedTopics}
`;

    // Add customer-specific context if returning customer
    if (customerMemory.totalInteractions > 0) {
      prompt += `

# CUSTOMER CONTEXT - This is a returning customer!

Customer Name: ${customerMemory.name || 'Unknown'}
Email: ${customerMemory.email || 'Not provided'}
First Seen: ${new Date(customerMemory.firstSeen).toLocaleDateString()}
Total Interactions: ${customerMemory.totalInteractions}
Lead Status: ${customerMemory.leadInfo.status}
Lifetime Value: $${customerMemory.lifetimeValue.toFixed(2)}

## Customer Preferences
Budget: ${customerMemory.preferences.budget || 'Unknown'}
Interests: ${customerMemory.preferences.interests.join(', ') || 'None recorded'}
Communication Preference: ${customerMemory.preferences.preferredTone || 'Not specified'}

## Purchase History
${customerMemory.purchaseHistory.length > 0 
  ? customerMemory.purchaseHistory.map(p => 
      `- Order ${p.orderId}: $${p.totalAmount} on ${new Date(p.orderDate).toLocaleDateString()} (${p.status})`
    ).join('\n')
  : 'No previous purchases'
}

## Agent Notes (Insights from previous interactions)
${customerMemory.agentNotes.length > 0
  ? customerMemory.agentNotes.map(note => 
      `- [${note.category}] ${note.content}`
    ).join('\n')
  : 'No notes yet'
}

## Important Flags
${customerMemory.contextFlags.hasActiveCart ? '⚠️ Customer has items in cart!' : ''}
${customerMemory.contextFlags.hasOpenTicket ? '⚠️ Customer has an open support ticket!' : ''}
${customerMemory.contextFlags.isVIP ? '⭐ VIP Customer - provide premium service!' : ''}
${customerMemory.contextFlags.hasComplaint ? '⚠️ Customer has previous complaint - be extra attentive!' : ''}

## Recent Conversation Summary
${this.summarizeRecentConversations(customerMemory)}

**IMPORTANT**: Use this context to provide personalized, continuous service. Reference their previous interactions naturally. Don't mention you're looking at their history - just use it to be helpful.
`;
    }

    return prompt;
  }
  
  /**
   * Summarize recent conversations for context
   */
  private summarizeRecentConversations(customerMemory: CustomerMemory): string {
    const recentSessions = customerMemory.sessions.slice(-3); // Last 3 sessions
    if (recentSessions.length === 0) return 'First interaction with this customer';
    
    return recentSessions.map(session => {
      const date = new Date(session.startTime).toLocaleDateString();
      return `- ${date}: ${session.outcome} (${session.sentiment} sentiment)${session.outcomeDetails ? ' - ' + session.outcomeDetails : ''}`;
    }).join('\n');
  }
  
  /**
   * Load customer memory into instance context
   */
  async loadCustomerMemory(instanceId: string, customerId: string): Promise<void> {
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) throw new Error('Instance not found');
    
    const memory = await this.getCustomerMemory(customerId, instance.orgId);
    if (!memory) throw new Error('Customer memory not found');
    
    instance.customerMemory = memory;
    await this.storeActiveInstance(instance);
  }
  
  /**
   * Update customer memory during active session
   */
  async updateCustomerMemory(instanceId: string, updates: Partial<CustomerMemory>): Promise<void> {
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) throw new Error('Instance not found');
    
    const currentMemory = instance.customerMemory;
    const updatedMemory = { ...currentMemory, ...updates, updatedAt: new Date().toISOString() };
    
    instance.customerMemory = updatedMemory;
    await this.storeActiveInstance(instance);
    await this.saveCustomerMemory(updatedMemory);
  }
  
  /**
   * Add message to conversation history
   */
  async addMessage(
    instanceId: string,
    role: 'customer' | 'agent' | 'human_agent',
    content: string,
    metadata?: ConversationMessage['metadata']
  ): Promise<void> {
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) throw new Error('Instance not found');
    
    const message: ConversationMessage = {
      messageId: this.generateMessageId(),
      sessionId: instance.sessionId,
      timestamp: new Date().toISOString(),
      role,
      content,
      metadata
    };
    
    // Add to instance context
    instance.currentContext.push(message);
    instance.messageCount += 1;
    instance.lastActivityAt = new Date().toISOString();
    
    // Add to customer memory conversation history
    instance.customerMemory.conversationHistory.push(message);
    
    // Update session message count
    const currentSession = instance.customerMemory.sessions.find(s => s.sessionId === instance.sessionId);
    if (currentSession) {
      currentSession.messageCount += 1;
    }
    
    await this.storeActiveInstance(instance);
    await this.saveCustomerMemory(instance.customerMemory);
  }
  
  /**
   * Add a message to customer memory (simplified version for API routes)
   */
  async addMessageToMemory(
    customerId: string,
    orgId: string,
    userMessage: string,
    assistantMessage: string
  ): Promise<void> {
    try {
      // Load customer memory
      const memory = await this.getCustomerMemory(customerId, orgId);
      if (!memory) {
        console.error(`[Instance Manager] No memory found for customer ${customerId}`);
        return;
      }

      // Add messages to conversation history
      const timestamp = new Date().toISOString();
      
      memory.conversationHistory.push({
        messageId: this.generateMessageId(),
        sessionId: memory.sessions[memory.sessions.length - 1]?.sessionId || 'default',
        timestamp,
        role: 'customer',
        content: userMessage,
      });
      
      memory.conversationHistory.push({
        messageId: this.generateMessageId(),
        sessionId: memory.sessions[memory.sessions.length - 1]?.sessionId || 'default',
        timestamp,
        role: 'agent',
        content: assistantMessage,
      });

      // Keep only last 100 messages to prevent memory from growing too large
      if (memory.conversationHistory.length > 100) {
        memory.conversationHistory = memory.conversationHistory.slice(-100);
      }

      // Update last interaction
      memory.lastInteraction = timestamp;
      memory.updatedAt = timestamp;

      // Save updated memory
      await this.saveCustomerMemory(memory);
      
      console.log(`[Instance Manager] Added messages to memory for customer ${customerId}`);
    } catch (error) {
      console.error('[Instance Manager] Error adding message to memory:', error);
      // Don't throw - we don't want to fail the API call if memory update fails
    }
  }

  /**
   * Add agent note/insight
   */
  async addAgentNote(
    instanceId: string,
    category: AgentNote['category'],
    content: string,
    confidence: number = 0.8
  ): Promise<void> {
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) throw new Error('Instance not found');
    
    const note: AgentNote = {
      noteId: this.generateNoteId(),
      sessionId: instance.sessionId,
      timestamp: new Date().toISOString(),
      category,
      content,
      confidence
    };
    
    instance.customerMemory.agentNotes.push(note);
    await this.updateCustomerMemory(instanceId, { agentNotes: instance.customerMemory.agentNotes });
  }
  
  /**
   * Terminate instance and save final session state
   */
  async terminateInstance(instanceId: string, outcome: CustomerSession['outcome']): Promise<void> {
    console.log(`[Instance Manager] Terminating instance ${instanceId} with outcome: ${outcome}`);
    
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) {
      console.warn('Instance already terminated or not found');
      return;
    }
    
    const endTime = new Date().toISOString();
    
    // Update session with final outcome
    const session = instance.customerMemory.sessions.find(s => s.sessionId === instance.sessionId);
    if (session) {
      session.endTime = endTime;
      session.duration = Math.floor((new Date(endTime).getTime() - new Date(session.startTime).getTime()) / 1000);
      session.outcome = outcome;
      
      // Calculate final sentiment from messages
      const sentimentMessages = instance.currentContext.filter(m => m.metadata?.sentiment);
      if (sentimentMessages.length > 0) {
        const avgSentiment = sentimentMessages.reduce((sum, m) => sum + (m.metadata!.sentiment || 0), 0) / sentimentMessages.length;
        session.sentimentScore = avgSentiment;
        session.sentiment = avgSentiment > 0.3 ? 'positive' : avgSentiment < -0.3 ? 'negative' : 'neutral';
      }
    }
    
    // Update instance status
    instance.status = 'terminated';
    instance.terminatedAt = endTime;
    
    // Save final customer memory state
    instance.customerMemory.lastInteraction = endTime;
    instance.customerMemory.updatedAt = endTime;
    await this.saveCustomerMemory(instance.customerMemory);
    
    // Remove from active instances
    await this.removeActiveInstance(instanceId);
    
    // Archive instance for analytics (optional)
    await this.archiveInstance(instance);
    
    console.log(`[Instance Manager] Instance ${instanceId} terminated successfully`);
  }
  
  /**
   * Check instance health and auto-terminate if idle
   */
  async checkInstanceHealth(instanceId: string): Promise<'healthy' | 'idle' | 'unresponsive'> {
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) return 'unresponsive';
    
    const now = new Date().getTime();
    const lastActivity = new Date(instance.lastActivityAt).getTime();
    const idleMinutes = (now - lastActivity) / 1000 / 60;
    
    const maxIdleMinutes = 30; // Auto-terminate after 30 minutes of inactivity
    
    if (idleMinutes > maxIdleMinutes) {
      console.log(`[Instance Manager] Instance ${instanceId} idle for ${idleMinutes} minutes, auto-terminating`);
      await this.terminateInstance(instanceId, 'abandoned');
      return 'unresponsive';
    } else if (idleMinutes > 5) {
      return 'idle';
    }
    
    return 'healthy';
  }
  
  /**
   * Escalate to human agent
   */
  async escalateToHuman(instanceId: string, reason: string): Promise<void> {
    console.log(`[Instance Manager] Escalating instance ${instanceId} to human. Reason: ${reason}`);
    
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) throw new Error('Instance not found');
    
    instance.escalationTriggered = true;
    instance.escalationReason = reason;
    instance.status = 'escalated';
    
    // Update session
    const session = instance.customerMemory.sessions.find(s => s.sessionId === instance.sessionId);
    if (session) {
      session.outcome = 'escalated';
      session.outcomeDetails = reason;
    }
    
    await this.storeActiveInstance(instance);
    
    // Notify human agents (implement notification system)
    await this.notifyHumanAgents(instance, reason);
  }
  
  /**
   * Human takeover
   */
  async humanTakeover(instanceId: string, humanAgentId: string): Promise<void> {
    const instance = await this.getActiveInstance(instanceId);
    if (!instance) throw new Error('Instance not found');
    
    instance.humanTookOver = true;
    instance.humanAgentId = humanAgentId;
    instance.status = 'escalated';
    
    await this.storeActiveInstance(instance);
  }
  
  // ===== Database/Storage Methods =====
  
  private async getActiveGoldenMaster(orgId: string): Promise<GoldenMaster | null> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const goldenMasters = await FirestoreService.getAll(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.GOLDEN_MASTERS}`,
        []
      );
      const active = goldenMasters.find((gm: any) => gm.isActive === true);
      return active as GoldenMaster | null;
    } catch (error) {
      console.error('Error fetching Golden Master:', error);
      return null;
    }
  }
  
  private async getCustomerMemory(customerId: string, orgId: string): Promise<CustomerMemory | null> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      return await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.CUSTOMER_MEMORIES}`,
        customerId
      );
    } catch (error) {
      console.error('Error fetching customer memory:', error);
      return null;
    }
  }
  
  private async createCustomerMemory(customerId: string, orgId: string): Promise<CustomerMemory> {
    const memory: CustomerMemory = {
      customerId,
      orgId,
      sessions: [],
      conversationHistory: [],
      preferences: {
        interests: [],
        favoriteProducts: [],
        viewedProducts: []
      },
      purchaseHistory: [],
      leadInfo: {
        status: 'cold',
        source: 'website',
        qualificationScore: 0,
        qualificationCriteria: {
          hasBudget: false,
          hasNeed: false,
          hasTimeline: false,
          isDecisionMaker: false
        }
      },
      agentNotes: [],
      contextFlags: {
        hasActiveCart: false,
        hasOpenTicket: false,
        waitingOnRefund: false,
        isVIP: false,
        hasComplaint: false,
        isBlacklisted: false,
        isPriceShoppers: false,
        isResearcher: false,
        isBulkBuyer: false,
        isImpulseBuyer: false,
        hasReturnedMultipleItems: false,
        hasDisputedCharges: false,
        requiresHumanApproval: false
      },
      firstSeen: new Date().toISOString(),
      lastInteraction: new Date().toISOString(),
      totalInteractions: 0,
      lifetimeValue: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await this.saveCustomerMemory(memory);
    return memory;
  }
  
  private async saveCustomerMemory(memory: CustomerMemory): Promise<void> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${memory.orgId}/${COLLECTIONS.CUSTOMER_MEMORIES}`,
        memory.customerId,
        memory,
        true
      );
    } catch (error) {
      console.error('Error saving customer memory:', error);
      throw error;
    }
  }
  
  private async storeActiveInstance(instance: AgentInstance): Promise<void> {
    // Store in Firestore for persistence (in production, also use Redis for fast access)
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${instance.orgId}/activeInstances`,
        instance.instanceId,
        {
          ...instance,
          createdAt: instance.spawnedAt,
          lastActivityAt: new Date().toISOString(),
        },
        true
      );
    } catch (error) {
      console.error('Error storing active instance:', error);
    }
  }
  
  private async getActiveInstance(instanceId: string): Promise<AgentInstance | null> {
    // In production, check Redis first, then Firestore
    // For now, just check Firestore
    try {
      // Need orgId to query - this is a limitation of current design
      // In production, maintain a lookup table or use Redis with instanceId as key
      return null;
    } catch (error) {
      console.error('Error getting active instance:', error);
      return null;
    }
  }
  
  private async removeActiveInstance(instanceId: string): Promise<void> {
    try {
      // In production, remove from Redis and Firestore
      // For now, just log
      console.log('[Instance Manager] Removing active instance:', instanceId);
    } catch (error) {
      console.error('Error removing active instance:', error);
    }
  }
  
  private async archiveInstance(instance: AgentInstance): Promise<void> {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${instance.orgId}/archivedInstances`,
        instance.instanceId,
        {
          ...instance,
          archivedAt: new Date().toISOString(),
        },
        false
      );
    } catch (error) {
      console.error('Error archiving instance:', error);
    }
  }
  
  private async notifyHumanAgents(instance: AgentInstance, reason: string): Promise<void> {
    // TODO: Implement - send real-time notification to human agents
    console.log('[Instance Manager] Notifying human agents for escalation:', reason);
  }
  
  // ===== ID Generators =====
  
  private generateInstanceId(): string {
    return `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateNoteId(): string {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const agentInstanceManager = new AgentInstanceManager();




